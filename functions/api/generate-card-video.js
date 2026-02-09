/**
 * Cloudflare Pages Function for generating animated card reveal videos
 * using Azure OpenAI Video Generation (Sora) API.
 * 
 * POST /api/generate-card-video
 * 
 * Two-step workflow:
 * 1. Generate keyframe image with GPT-Image-1.5
 * 2. Animate keyframe with Sora-2 video generation
 * 
 * Returns job ID for async polling, or completed video if fast enough.
 */

import {
  arrayBufferToBase64,
  checkAndIncrementDailyUsage,
  decrementDailyUsage,
  jsonResponse,
  readJsonBody
} from '../lib/utils.js';
import { getUserFromRequest } from '../lib/auth.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { maybeLogPromptPayload } from '../lib/readingTelemetry.js';
import {
  buildMediaTelemetryPayload,
  persistMediaTelemetry
} from '../lib/mediaTelemetry.js';
import {
  buildKeyframePrompt,
  buildCardRevealPrompt,
  VIDEO_STYLES
} from '../lib/videoPrompts.js';
import { getCardVideoLimits } from '../../shared/monetization/media.js';

// Azure OpenAI Video Generation configuration (Sora 2 API)
// Note: AZURE_OPENAI_VIDEO_MODEL should be your Azure deployment name
const AZURE_VIDEO_API_VERSION = 'preview';
const DEFAULT_VIDEO_MODEL = 'sora-2'; // Fallback; prefer deployment name via env
// Sora 2 supported sizes: 720x1280 (portrait), 1280x720 (landscape)
const DEFAULT_VIDEO_WIDTH = 1280;
const DEFAULT_VIDEO_HEIGHT = 720;
const DEFAULT_VIDEO_SECONDS = 4;
const DEFAULT_IMAGE_TIMEOUT_MS = 45000;
const DEFAULT_VIDEO_TIMEOUT_MS = 45000;
const DEFAULT_VIDEO_STATUS_TIMEOUT_MS = 20000;
const DEFAULT_VIDEO_CONTENT_TIMEOUT_MS = 30000;
const BACKGROUND_SETTLE_DELAY_MS = 90000;
const BACKGROUND_SETTLE_RETRY_MS = 30000;
const BACKGROUND_SETTLE_MAX_ATTEMPTS = 4;

// OpenAI docs: the Sora input_reference image must match the requested video size.
// We only attempt keyframe -> input_reference when the image model can output the
// exact video resolution.
function normalizeImageModelFamily(value) {
  const v = (value || '').toLowerCase().trim();
  if (!v) return '';
  if (v === 'gpt-image' || v === 'gpt_image' || v === 'gptimage') return 'gpt-image';
  if (v === 'dall-e-3' || v === 'dalle-3' || v === 'dalle3') return 'dall-e-3';
  if (v === 'dall-e-2' || v === 'dalle-2' || v === 'dalle2') return 'dall-e-2';
  return v;
}

function inferImageModelFamily(imageModel, env) {
  const override = normalizeImageModelFamily(env?.AZURE_OPENAI_IMAGE_MODEL_FAMILY);
  if (override) return override;

  const m = (imageModel || '').toLowerCase();
  if (m.includes('dall-e-3') || m.includes('dalle-3') || m.includes('dalle3')) return 'dall-e-3';
  if (m.includes('dall-e-2') || m.includes('dalle-2') || m.includes('dalle2')) return 'dall-e-2';
  if (m.includes('gpt-image') || m.includes('gpt_image')) return 'gpt-image';

  // Conservative default: assume GPT image sizes.
  return 'gpt-image';
}

function isImageSizeSupportedForFamily(family, size) {
  if (size === 'auto') return true;
  switch (family) {
    case 'dall-e-3':
      return size === '1024x1024' || size === '1792x1024' || size === '1024x1792';
    case 'dall-e-2':
      return size === '256x256' || size === '512x512' || size === '1024x1024';
    case 'gpt-image':
    default:
      return size === '1024x1024' || size === '1536x1024' || size === '1024x1536' || size === 'auto';
  }
}

function parseWxH(size) {
  const match = typeof size === 'string' ? size.trim().match(/^(\d{2,5})x(\d{2,5})$/) : null;
  if (!match) return null;
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function getInputReferenceMode(env) {
  const raw = (env?.CARD_VIDEO_INPUT_REFERENCE || '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'disabled' || raw === 'no') return 'off';
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'enabled' || raw === 'yes') return 'on';
  return 'auto';
}

/**
 * Validate request payload
 */
function validatePayload(payload) {
  const errors = [];
  
  if (!payload.card || typeof payload.card !== 'object') {
    errors.push('card object is required');
  } else {
    if (!payload.card.name) errors.push('card.name is required');
    if (typeof payload.card.reversed !== 'boolean') {
      payload.card.reversed = false; // default
    }
  }
  
  if (!payload.question || typeof payload.question !== 'string') {
    errors.push('question string is required');
  }
  
  if (payload.style && !VIDEO_STYLES[payload.style]) {
    errors.push(`style must be one of: ${Object.keys(VIDEO_STYLES).join(', ')}`);
  }
  
  if (payload.seconds && (payload.seconds < 1 || payload.seconds > 20)) {
    errors.push('seconds must be between 1 and 20');
  }
  
  return errors;
}

/**
 * Normalize cache key inputs
 */
function normalizeCacheValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generate cache key for R2 storage
 */
function generateCacheKey(card, style, seconds, question, position, size) {
  const cardKey = `${card.name}-${card.reversed ? 'r' : 'u'}`;
  const normalizedQuestion = normalizeCacheValue(question);
  const normalizedPosition = normalizeCacheValue(position);
  const normalizedSize = normalizeCacheValue(size);
  const hash = simpleHash(`${cardKey}:${style}:${seconds}:${normalizedSize}:${normalizedPosition}:${normalizedQuestion}`);
  return `generated-video/${hash}.mp4`;
}

/**
 * Simple hash function for cache keys
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Fetch with timeout to prevent hung requests.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000, label = 'request') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const merged = { ...options, signal: controller.signal };

  try {
    return await fetch(url, merged);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Azure OpenAI ${label} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generate keyframe image using GPT-Image-1.5
 */
async function generateKeyframe(env, card, question, position, style, promptOverride = null, options = {}) {
  const endpoint = env.AZURE_OPENAI_IMAGE_ENDPOINT || env.AZURE_OPENAI_ENDPOINT;
  const apiKey = env.AZURE_OPENAI_IMAGE_API_KEY || env.AZURE_OPENAI_API_KEY;
  const model = env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
  const timeoutMs = Number.parseInt(env.AZURE_OPENAI_IMAGE_TIMEOUT_MS || DEFAULT_IMAGE_TIMEOUT_MS, 10);
  const size = typeof options.size === 'string' && options.size.trim() ? options.size.trim() : '1024x1024';
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI Image configuration is missing');
  }
  
  const normalizedEndpoint = endpoint
    .replace(/\/+$/, '')
    .replace(/\/openai\/v1\/?$/, '')
    .replace(/\/openai\/?$/, '');
  
  const prompt = promptOverride || buildKeyframePrompt(card, question, position, style);
  
  const url = `${normalizedEndpoint}/openai/v1/images/generations?api-version=preview`;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality: 'medium',
      n: 1,
      output_format: 'jpeg',
      output_compression: 90
    })
  }, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_IMAGE_TIMEOUT_MS, 'image generation');
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Keyframe generation failed (${response.status}): ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.data || !result.data[0]) {
    throw new Error('No keyframe data in response');
  }
  
  return result.data[0].b64_json;
}

/**
 * Create video generation job with Azure OpenAI Sora 2 API
 * Sora 2 uses /openai/v1/videos endpoint with size parameter instead of width/height
 */
async function createVideoJob(env, prompt, keyframeBase64, options = {}) {
  const endpoint = env.AZURE_OPENAI_VIDEO_ENDPOINT || env.AZURE_OPENAI_ENDPOINT;
  const apiKey = env.AZURE_OPENAI_VIDEO_API_KEY || env.AZURE_OPENAI_API_KEY;
  const model = env.AZURE_OPENAI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL;
  const timeoutMs = Number.parseInt(env.AZURE_OPENAI_VIDEO_TIMEOUT_MS || DEFAULT_VIDEO_TIMEOUT_MS, 10);
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI Video configuration is missing');
  }
  
  const normalizedEndpoint = endpoint
    .replace(/\/+$/, '')
    .replace(/\/openai\/v1\/?$/, '')
    .replace(/\/openai\/?$/, '');
  
  const {
    width = DEFAULT_VIDEO_WIDTH,
    height = DEFAULT_VIDEO_HEIGHT,
    seconds = DEFAULT_VIDEO_SECONDS,
    size: sizeOverride = null
  } = options;
  
  // Sora 2 API uses /videos endpoint (not /video/generations/jobs)
  const url = `${normalizedEndpoint}/openai/v1/videos?api-version=${AZURE_VIDEO_API_VERSION}`;
  
  // Sora 2 uses size string instead of separate width/height
  // Supported sizes: 720x1280 (portrait), 1280x720 (landscape)
  const size = typeof sizeOverride === 'string' && sizeOverride.trim()
    ? sizeOverride.trim()
    : `${width}x${height}`;
  
  // Sora API examples use multipart/form-data even when no reference image is supplied.
  const formData = new FormData();
    
  formData.append('model', model);
  formData.append('prompt', prompt);
  formData.append('size', size);
  formData.append('seconds', seconds.toString());

  if (keyframeBase64) {
    // Convert base64 to blob
    const binaryString = atob(keyframeBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    
    // Sora 2 API uses input_reference for reference images
    formData.append('input_reference', blob, 'keyframe.jpg');
  }

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey
    },
    body: formData
  }, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_VIDEO_TIMEOUT_MS, 'video job creation');
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Video job creation failed (${response.status}): ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Check video job status using Sora 2 API
 * Sora 2 uses /openai/v1/videos/{video_id} endpoint
 */
async function getVideoJobStatus(env, jobId) {
  const endpoint = env.AZURE_OPENAI_VIDEO_ENDPOINT || env.AZURE_OPENAI_ENDPOINT;
  const apiKey = env.AZURE_OPENAI_VIDEO_API_KEY || env.AZURE_OPENAI_API_KEY;
  const timeoutMs = Number.parseInt(env.AZURE_OPENAI_VIDEO_STATUS_TIMEOUT_MS || DEFAULT_VIDEO_STATUS_TIMEOUT_MS, 10);
  
  const normalizedEndpoint = endpoint
    .replace(/\/+$/, '')
    .replace(/\/openai\/v1\/?$/, '')
    .replace(/\/openai\/?$/, '');
  
  // Sora 2 API uses /videos/{video_id} (not /video/generations/jobs/{job_id})
  const url = `${normalizedEndpoint}/openai/v1/videos/${jobId}?api-version=${AZURE_VIDEO_API_VERSION}`;
  
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'api-key': apiKey
    }
  }, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_VIDEO_STATUS_TIMEOUT_MS, 'video status');
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Video job status check failed (${response.status}): ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Get video content using Sora 2 API
 * Sora 2 uses /openai/v1/videos/{video_id}/content?variant=video
 */
async function getVideoContent(env, videoId) {
  const endpoint = env.AZURE_OPENAI_VIDEO_ENDPOINT || env.AZURE_OPENAI_ENDPOINT;
  const apiKey = env.AZURE_OPENAI_VIDEO_API_KEY || env.AZURE_OPENAI_API_KEY;
  const timeoutMs = Number.parseInt(env.AZURE_OPENAI_VIDEO_CONTENT_TIMEOUT_MS || DEFAULT_VIDEO_CONTENT_TIMEOUT_MS, 10);
  
  const normalizedEndpoint = endpoint
    .replace(/\/+$/, '')
    .replace(/\/openai\/v1\/?$/, '')
    .replace(/\/openai\/?$/, '');
  
  // Sora 2 API uses /videos/{video_id}/content with variant query param
  const url = `${normalizedEndpoint}/openai/v1/videos/${videoId}/content?api-version=${AZURE_VIDEO_API_VERSION}&variant=video`;
  
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'api-key': apiKey
    }
  }, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_VIDEO_CONTENT_TIMEOUT_MS, 'video content');
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Video content retrieval failed (${response.status}): ${errorText}`);
  }
  
  return response;
}

/**
 * Check R2 cache for existing video
 */
async function checkCache(env, cacheKey) {
  if (!env.R2_LOGS) return null;

  try {
    let object = await env.R2_LOGS.get(cacheKey);
    // Fallback to legacy keys stored without .mp4 extension
    if (!object && cacheKey.endsWith('.mp4')) {
      object = await env.R2_LOGS.get(cacheKey.slice(0, -4));
    }
    if (object) {
      const arrayBuffer = await object.arrayBuffer();
      return arrayBufferToBase64(arrayBuffer);
    }
  } catch (err) {
    console.error('R2 video cache check failed:', err.message);
  }
  
  return null;
}

/**
 * Store video in R2 cache
 */
async function storeInCache(env, cacheKey, videoData, metadata = {}) {
  if (!env.R2_LOGS) return;
  
  try {
    await env.R2_LOGS.put(cacheKey, videoData, {
      httpMetadata: { contentType: 'video/mp4' },
      customMetadata: { 
        created: new Date().toISOString(),
        ...metadata
      }
    });
  } catch (err) {
    console.error('R2 video cache store failed:', err.message);
  }
}

/**
 * Store pending job info in KV for polling
 */
async function storePendingJob(env, userId, jobId, metadata) {
  if (!env.METRICS_DB) return;
  
  try {
    await env.METRICS_DB.put(`video_job:${jobId}`, JSON.stringify({
      userId,
      ...metadata,
      created: Date.now()
    }), { expirationTtl: 3600 }); // 1 hour TTL
  } catch (err) {
    console.error('Failed to store pending job:', err.message);
  }
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeVideoJobStatus(status) {
  return status === 'succeeded' ? 'completed' : status;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPendingJobMeta(env, jobId) {
  if (!env?.METRICS_DB || !jobId) return null;
  try {
    const raw = await env.METRICS_DB.get(`video_job:${jobId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to load pending video job metadata:', err.message);
    return null;
  }
}

async function persistPendingJobMeta(env, jobId, jobMeta) {
  if (!env?.METRICS_DB || !jobId || !jobMeta) return false;
  try {
    await env.METRICS_DB.put(`video_job:${jobId}`, JSON.stringify(jobMeta), {
      expirationTtl: 3600
    });
    return true;
  } catch (err) {
    console.warn('Failed to persist pending video job metadata:', err.message);
    return false;
  }
}

async function markVideoUsageFinalized(env, jobId, jobMeta, reason = 'completed') {
  if (!jobMeta || jobMeta.usageFinalized || jobMeta.usageRefunded) return jobMeta;
  const nextMeta = {
    ...jobMeta,
    usageFinalized: true,
    usageSettlementReason: reason,
    usageSettledAt: Date.now()
  };
  await persistPendingJobMeta(env, jobId, nextMeta);
  return nextMeta;
}

async function refundVideoUsageIfNeeded(env, jobId, jobMeta, reason = 'failed') {
  if (!jobMeta?.usageKey || jobMeta.usageRefunded || jobMeta.usageFinalized) return jobMeta;
  await decrementDailyUsage(env, {
    key: jobMeta.usageKey,
    dateKey: jobMeta.usageDateKey
  });
  const nextMeta = {
    ...jobMeta,
    usageRefunded: true,
    usageFinalized: true,
    usageSettlementReason: reason,
    usageSettledAt: Date.now()
  };
  await persistPendingJobMeta(env, jobId, nextMeta);
  return nextMeta;
}

async function settleUsageForUnpolledVideoJob(env, jobId) {
  const initialDelayMs = parseNonNegativeInt(
    env?.CARD_VIDEO_BACKGROUND_SETTLE_DELAY_MS,
    BACKGROUND_SETTLE_DELAY_MS
  );
  const retryDelayMs = parseNonNegativeInt(
    env?.CARD_VIDEO_BACKGROUND_SETTLE_RETRY_DELAY_MS,
    BACKGROUND_SETTLE_RETRY_MS
  );
  const maxAttempts = Math.max(1, parseNonNegativeInt(
    env?.CARD_VIDEO_BACKGROUND_SETTLE_MAX_ATTEMPTS,
    BACKGROUND_SETTLE_MAX_ATTEMPTS
  ));

  if (initialDelayMs > 0) {
    await delay(initialDelayMs);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const jobMeta = await loadPendingJobMeta(env, jobId);
    if (!jobMeta?.usageKey || jobMeta.usageRefunded || jobMeta.usageFinalized) {
      return;
    }

    let normalizedStatus = '';
    try {
      const jobStatus = await getVideoJobStatus(env, jobId);
      normalizedStatus = normalizeVideoJobStatus(jobStatus?.status);
    } catch (_err) {
      if (attempt < maxAttempts - 1 && retryDelayMs > 0) {
        await delay(retryDelayMs);
      }
      continue;
    }

    if (normalizedStatus === 'completed') {
      await markVideoUsageFinalized(env, jobId, jobMeta, 'background-complete');
      return;
    }

    if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
      await refundVideoUsageIfNeeded(env, jobId, jobMeta, 'background-failed');
      return;
    }

    if (attempt < maxAttempts - 1 && retryDelayMs > 0) {
      await delay(retryDelayMs);
    }
  }

  // Safety net: if retries exhausted while job is still processing, refund
  // reserved usage rather than stranding it permanently.
  const finalMeta = await loadPendingJobMeta(env, jobId);
  if (finalMeta?.usageKey && !finalMeta.usageRefunded && !finalMeta.usageFinalized) {
    await refundVideoUsageIfNeeded(env, jobId, finalMeta, 'background-timeout');
  }
}

/**
 * Main handler - Create video generation job
 */
export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const requestId = crypto.randomUUID
    ? crypto.randomUUID()
    : `card_video_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const startTime = Date.now();
  console.log(`[${requestId}] [card-video] === CARD VIDEO REQUEST START ===`);
  
  // Check feature flag
  if (env.FEATURE_CARD_VIDEO !== 'true') {
    return jsonResponse({ error: 'Card video feature is not enabled' }, 503);
  }
  
  // Authenticate user
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }
  
  // Check subscription tier
  const subscription = getSubscriptionContext(user);
  const tier = subscription?.effectiveTier || 'free';
  const limits = getCardVideoLimits(tier, {
    availableStyles: Object.keys(VIDEO_STYLES)
  });

  if (!env.METRICS_DB) {
    return jsonResponse({ error: 'Video job tracking is unavailable' }, 503);
  }
  
  if (!limits.enabled) {
    return jsonResponse({ 
      error: 'Card videos require a Plus or Pro subscription',
      upgrade: true 
    }, 403);
  }
  
  // Parse and validate request
  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (_err) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  
  const errors = validatePayload(payload);
  if (errors.length > 0) {
    return jsonResponse({ error: errors.join('; ') }, 400);
  }
  
  const {
    card,
    question,
    position = 'Present',
    style = 'mystical',
    seconds = DEFAULT_VIDEO_SECONDS
  } = payload;
  const imageModel = env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
  const videoModel = env.AZURE_OPENAI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL;
  const imageEndpointSource = env.AZURE_OPENAI_IMAGE_ENDPOINT ? 'image' : 'shared';
  const imageApiKeySource = env.AZURE_OPENAI_IMAGE_API_KEY ? 'image' : 'shared';
  const videoEndpointSource = env.AZURE_OPENAI_VIDEO_ENDPOINT ? 'video' : 'shared';
  const videoApiKeySource = env.AZURE_OPENAI_VIDEO_API_KEY ? 'video' : 'shared';

  const requestedVideoSize = typeof env.AZURE_OPENAI_VIDEO_SIZE === 'string' && env.AZURE_OPENAI_VIDEO_SIZE.trim()
    ? env.AZURE_OPENAI_VIDEO_SIZE.trim()
    : `${DEFAULT_VIDEO_WIDTH}x${DEFAULT_VIDEO_HEIGHT}`;
  const parsedSize = parseWxH(requestedVideoSize) || { width: DEFAULT_VIDEO_WIDTH, height: DEFAULT_VIDEO_HEIGHT };
  const videoWidth = parsedSize.width;
  const videoHeight = parsedSize.height;
  const videoSize = `${videoWidth}x${videoHeight}`;
  
  // Validate tier access
  if (!limits.styles.includes(style)) {
    return jsonResponse({ 
      error: `Style '${style}' requires Pro subscription`,
      allowedStyles: limits.styles 
    }, 403);
  }
  
  if (seconds > limits.maxSeconds) {
    return jsonResponse({ 
      error: `Videos longer than ${limits.maxSeconds}s require Pro subscription`,
      maxSeconds: limits.maxSeconds 
    }, 403);
  }

  // Check cache first
  const cacheKey = generateCacheKey(card, style, seconds, question, position, videoSize);
  const cacheStart = Date.now();
  const cachedVideo = await checkCache(env, cacheKey);
  
  if (cachedVideo) {
    const totalMs = Date.now() - startTime;
    await persistMediaTelemetry(env, buildMediaTelemetryPayload({
      requestId,
      timestamp: new Date().toISOString(),
      feature: 'card-video',
      status: 'completed',
      provider: 'azure-openai-video',
      models: {
        image: imageModel,
        video: videoModel
      },
      apiVersion: {
        image: 'preview',
        video: AZURE_VIDEO_API_VERSION
      },
      tier,
      input: {
        style,
        seconds,
        width: videoWidth,
        height: videoHeight,
        questionLength: typeof question === 'string' ? question.length : 0,
        imageEndpointSource,
        imageApiKeySource,
        videoEndpointSource,
        videoApiKeySource
      },
      output: {
        cached: true,
        format: 'mp4'
      },
      timings: {
        totalMs,
        cacheMs: Date.now() - cacheStart
      }
    }), { key: `media:card-video:${requestId}` });
    console.log(`[${requestId}] [card-video] Cache hit in ${totalMs}ms`);
    console.log(`[${requestId}] [card-video] === CARD VIDEO REQUEST END ===`);
    return jsonResponse({
      success: true,
      status: 'completed',
      video: cachedVideo,
      format: 'mp4',
      cached: true,
      style,
      seconds,
      cacheKey,
      requestId
    });
  }
  
  let usageReservation = null;
  if (Number.isFinite(limits.maxPerDay)) {
    const usage = await checkAndIncrementDailyUsage(env, {
      feature: 'card-video',
      userId: user.id,
      limit: limits.maxPerDay
    });
    if (!usage.allowed) {
      return jsonResponse({
        error: 'Daily card video limit reached.',
        limit: usage.limit,
        remaining: usage.remaining,
        resetsAt: usage.resetsAt
      }, 429);
    }
    usageReservation = usage;
  }

  try {
    // Build keyframe prompt (even if we don't generate the image) so we can reuse the
    // starting pose description for prompt alignment.
    const keyframeResult = buildKeyframePrompt(card, question, position, style);
    const keyframePromptStr = typeof keyframeResult === 'string' ? keyframeResult : keyframeResult.prompt;
    const startingPoseDescription = typeof keyframeResult === 'object' ? keyframeResult.startingPoseDescription : null;

    const inputRefMode = getInputReferenceMode(env);
    const imageFamily = inferImageModelFamily(imageModel, env);
    const canMatchVideoSize = isImageSizeSupportedForFamily(imageFamily, videoSize);
    const shouldTryKeyframe = inputRefMode === 'on' || (inputRefMode === 'auto' && canMatchVideoSize);

    let keyframeBase64 = null;
    let keyframeMs = 0;

    if (shouldTryKeyframe) {
      maybeLogPromptPayload(env, requestId, 'card-video-keyframe', '', keyframeResult, null, {
        personalization: { displayName: user?.display_name }
      });
      const keyframeStart = Date.now();
      console.log(`[${requestId}] [card-video] Generating keyframe`, {
        model: imageModel,
        style,
        seconds,
        size: videoSize,
        imageEndpointSource,
        imageApiKeySource
      });
      try {
        keyframeBase64 = await generateKeyframe(env, card, question, position, style, keyframePromptStr, {
          size: videoSize
        });
        keyframeMs = Date.now() - keyframeStart;
      } catch (err) {
        // Fall back to prompt-only video generation instead of failing the whole request.
        console.warn(`[${requestId}] [card-video] Keyframe generation failed; continuing without input_reference:`, err?.message || err);
      }
    } else if (inputRefMode !== 'off') {
      console.warn(
        `[${requestId}] [card-video] Skipping input_reference: image model '${imageModel}' (family: ${imageFamily}) cannot generate ${videoSize} keyframes.`
      );
    }
    
    // Step 2: Build video prompt (use startingPoseDescription for pose consistency)
    const videoPrompt = buildCardRevealPrompt(card, question, position, style, startingPoseDescription);
    maybeLogPromptPayload(env, requestId, 'card-video', '', videoPrompt, null, {
      personalization: { displayName: user?.display_name }
    });
    
    // Step 3: Create video job
    const jobStart = Date.now();
    console.log(`[${requestId}] [card-video] Creating video job`, {
      model: videoModel,
      width: videoWidth,
      height: videoHeight,
      seconds,
      inputReference: Boolean(keyframeBase64),
      videoEndpointSource,
      videoApiKeySource
    });
    const job = await createVideoJob(env, videoPrompt, keyframeBase64, {
      width: videoWidth,
      height: videoHeight,
      seconds,
      size: videoSize
    });
    const jobMs = Date.now() - jobStart;
    
    // Store job info for polling
    await storePendingJob(env, user.id, job.id, {
      card: card.name,
      style,
      seconds,
      width: videoWidth,
      height: videoHeight,
      inputReferenceUsed: Boolean(keyframeBase64),
      cacheKey,
      requestId,
      tier,
      imageModel,
      videoModel,
      usageKey: usageReservation?.key || null,
      usageDateKey: usageReservation?.dateKey || null,
      usageRefunded: false,
      usageFinalized: false
    });

    if (usageReservation?.key && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(
        settleUsageForUnpolledVideoJob(env, job.id).catch((err) => {
          console.warn(`[${requestId}] [card-video] Background usage settlement failed for job ${job.id}:`, err?.message || err);
        })
      );
    }

    const totalMs = Date.now() - startTime;
    await persistMediaTelemetry(env, buildMediaTelemetryPayload({
      requestId,
      timestamp: new Date().toISOString(),
      feature: 'card-video',
      status: 'pending',
      provider: 'azure-openai-video',
      models: {
        image: imageModel,
        video: videoModel
      },
      apiVersion: {
        image: 'preview',
        video: AZURE_VIDEO_API_VERSION
      },
      tier,
      input: {
        style,
        seconds,
        width: videoWidth,
        height: videoHeight,
        questionLength: typeof question === 'string' ? question.length : 0,
        keyframePromptLength: typeof keyframePromptStr === 'string' ? keyframePromptStr.length : 0,
        videoPromptLength: typeof videoPrompt === 'string' ? videoPrompt.length : 0,
        inputReferenceMode: inputRefMode,
        inputReferenceUsed: Boolean(keyframeBase64),
        imageEndpointSource,
        imageApiKeySource,
        videoEndpointSource,
        videoApiKeySource
      },
      output: {
        cached: false,
        format: 'mp4',
        jobId: job.id
      },
      timings: {
        totalMs,
        keyframeMs,
        jobMs
      }
    }), { key: `media:card-video:${requestId}` });
    console.log(`[${requestId}] [card-video] Job created in ${totalMs}ms (jobId=${job.id})`);
    console.log(`[${requestId}] [card-video] === CARD VIDEO REQUEST END ===`);
    
    return jsonResponse({
      success: true,
      status: 'pending',
      jobId: job.id,
      cacheKey,
      message: 'Video generation started. Poll /api/generate-card-video?jobId=... for completion.',
      estimatedSeconds: seconds * 10, // rough estimate
      requestId
    });
    
  } catch (err) {
    if (usageReservation?.key) {
      await decrementDailyUsage(env, {
        key: usageReservation.key,
        dateKey: usageReservation.dateKey
      });
    }
    const totalMs = Date.now() - startTime;
    await persistMediaTelemetry(env, buildMediaTelemetryPayload({
      requestId,
      timestamp: new Date().toISOString(),
      feature: 'card-video',
      status: 'error',
      provider: 'azure-openai-video',
      models: {
        image: imageModel,
        video: videoModel
      },
      apiVersion: {
        image: 'preview',
        video: AZURE_VIDEO_API_VERSION
      },
      tier,
      input: {
        style,
        seconds,
        width: videoWidth,
        height: videoHeight,
        questionLength: typeof question === 'string' ? question.length : 0,
        imageEndpointSource,
        imageApiKeySource,
        videoEndpointSource,
        videoApiKeySource
      },
      output: {
        cached: false,
        format: 'mp4'
      },
      timings: {
        totalMs
      },
      error: {
        name: err?.name || 'Error',
        message: err?.message || 'Unknown error'
      }
    }), { key: `media:card-video:${requestId}` });
    console.error('Video generation failed:', err.message);
    console.log(`[${requestId}] [card-video] === CARD VIDEO REQUEST END (ERROR) ===`);
    return jsonResponse({ 
      error: 'Video generation failed',
      details: err.message,
      requestId
    }, 500);
  }
}

/**
 * Status polling handler
 * GET /api/generate-card-video?jobId=xxx
 */
export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  const statusStart = Date.now();

  if (!jobId) {
    return jsonResponse({ error: 'jobId parameter required' }, 400);
  }

  if (!env.METRICS_DB) {
    return jsonResponse({ error: 'Video job tracking is unavailable' }, 503);
  }
  
  // Check feature flag
  if (env.FEATURE_CARD_VIDEO !== 'true') {
    return jsonResponse({ error: 'Card video feature is not enabled' }, 503);
  }
  
  // Authenticate user
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }
  
  let jobMeta = null;
  try {
    const jobMetaRaw = await env.METRICS_DB.get(`video_job:${jobId}`);
    jobMeta = jobMetaRaw ? JSON.parse(jobMetaRaw) : null;
  } catch (err) {
    console.error('Failed to load job metadata:', err.message);
    return jsonResponse({ error: 'Failed to load job metadata' }, 500);
  }

  if (!jobMeta?.userId) {
    return jsonResponse({ error: 'Job not found' }, 404);
  }

  if (jobMeta.userId !== user.id) {
    return jsonResponse({ error: 'Not authorized for this job' }, 403);
  }

  try {
    const jobStatus = await getVideoJobStatus(env, jobId);
    let resolvedJobMeta = jobMeta || {};
    
    // Check if job is complete
    // Sora 2: status is 'completed' and video ID is the jobId itself
    // Sora 1 (legacy): status is 'succeeded' and has generations array
    const isCompleted = jobStatus.status === 'completed' || 
      (jobStatus.status === 'succeeded' && jobStatus.generations?.length > 0);
    
    if (isCompleted) {
      const requestId = resolvedJobMeta.requestId || `video_${jobId}`;
      resolvedJobMeta = await markVideoUsageFinalized(env, jobId, resolvedJobMeta, 'client-complete');

      if (resolvedJobMeta.cacheKey) {
        const cachedVideo = await checkCache(env, resolvedJobMeta.cacheKey);
        if (cachedVideo) {
          return jsonResponse({
            success: true,
            status: 'completed',
            video: cachedVideo,
            format: 'mp4',
            cached: true,
            cacheKey: resolvedJobMeta.cacheKey || null,
            style: resolvedJobMeta.style || null,
            seconds: resolvedJobMeta.seconds || null,
            cardName: resolvedJobMeta.card || null,
            requestId
          });
        }
      }

      // Sora 2 uses the video ID directly, Sora 1 uses generation.id
      const videoId = jobStatus.generations?.[0]?.id || jobId;
      
      // Get video content
      const videoResponse = await getVideoContent(env, videoId);
      const videoBuffer = await videoResponse.arrayBuffer();
      
      // Cache the video
      if (resolvedJobMeta.cacheKey) {
        await storeInCache(env, resolvedJobMeta.cacheKey, videoBuffer, {
          card: resolvedJobMeta.card,
          style: resolvedJobMeta.style
        });
      }
      const totalMs = resolvedJobMeta.created ? Date.now() - resolvedJobMeta.created : (Date.now() - statusStart);
      await persistMediaTelemetry(env, buildMediaTelemetryPayload({
        requestId,
        timestamp: new Date().toISOString(),
        feature: 'card-video',
        status: 'completed',
        provider: 'azure-openai-video',
        models: {
          image: resolvedJobMeta.imageModel || (env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-1.5'),
          video: resolvedJobMeta.videoModel || (env.AZURE_OPENAI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL)
        },
        apiVersion: {
          image: 'preview',
          video: AZURE_VIDEO_API_VERSION
        },
        tier: resolvedJobMeta.tier || null,
        input: {
          style: resolvedJobMeta.style || null,
          seconds: resolvedJobMeta.seconds || null,
          width: DEFAULT_VIDEO_WIDTH,
          height: DEFAULT_VIDEO_HEIGHT
        },
        output: {
          cached: false,
          format: 'mp4',
          jobId,
          generationId: videoId,
          bytes: videoBuffer.byteLength
        },
        timings: {
          totalMs,
          statusMs: Date.now() - statusStart
        }
      }), {
        key: `media:card-video:${requestId}`
      });
      
      // Return base64 encoded video
      const base64 = arrayBufferToBase64(videoBuffer);
      
      return jsonResponse({
        success: true,
        status: 'completed',
        video: base64,
        format: 'mp4',
        cached: false,
        cacheKey: resolvedJobMeta.cacheKey || null,
        style: resolvedJobMeta.style || null,
        seconds: resolvedJobMeta.seconds || null,
        cardName: resolvedJobMeta.card || null,
        requestId
      });
    }
    
    // Job still in progress or failed
    const normalizedStatus = normalizeVideoJobStatus(jobStatus.status);

    if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
      resolvedJobMeta = await refundVideoUsageIfNeeded(env, jobId, resolvedJobMeta, 'client-failed');
      const requestId = resolvedJobMeta.requestId || `video_${jobId}`;
      await persistMediaTelemetry(env, buildMediaTelemetryPayload({
        requestId,
        timestamp: new Date().toISOString(),
        feature: 'card-video',
        status: 'failed',
        provider: 'azure-openai-video',
        models: {
          image: resolvedJobMeta.imageModel || (env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-1.5'),
          video: resolvedJobMeta.videoModel || (env.AZURE_OPENAI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL)
        },
        apiVersion: {
          image: 'preview',
          video: AZURE_VIDEO_API_VERSION
        },
        tier: resolvedJobMeta.tier || null,
        input: {
          style: resolvedJobMeta.style || null,
          seconds: resolvedJobMeta.seconds || null,
          width: DEFAULT_VIDEO_WIDTH,
          height: DEFAULT_VIDEO_HEIGHT
        },
        output: {
          cached: false,
          format: 'mp4',
          jobId
        },
        timings: {
          totalMs: resolvedJobMeta.created ? Date.now() - resolvedJobMeta.created : null,
          statusMs: Date.now() - statusStart
        },
        error: {
          name: 'VideoJobFailed',
          message: `status:${normalizedStatus}`
        }
      }), {
        key: `media:card-video:${requestId}`
      });
    }

    return jsonResponse({
      success: true,
      status: normalizedStatus,
      jobId,
      message: normalizedStatus === 'failed' || normalizedStatus === 'cancelled'
        ? 'Video generation failed' 
        : 'Video still generating...'
    });
    
  } catch (err) {
    await persistMediaTelemetry(env, buildMediaTelemetryPayload({
      requestId: `video_${jobId}`,
      timestamp: new Date().toISOString(),
      feature: 'card-video',
      status: 'error',
      provider: 'azure-openai-video',
      models: {
        image: env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-1.5',
        video: env.AZURE_OPENAI_VIDEO_MODEL || DEFAULT_VIDEO_MODEL
      },
      apiVersion: {
        image: 'preview',
        video: AZURE_VIDEO_API_VERSION
      },
      output: {
        cached: false,
        format: 'mp4',
        jobId
      },
      timings: {
        statusMs: Date.now() - statusStart
      },
      error: {
        name: err?.name || 'Error',
        message: err?.message || 'Unknown error'
      }
    }), {
      key: `media:card-video:video_${jobId}`
    });
    console.error('Video status check failed:', err.message);
    return jsonResponse({ 
      error: 'Failed to check video status',
      details: err.message 
    }, 500);
  }
}

export default { onRequestPost, onRequestGet };
