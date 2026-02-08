/**
 * Cloudflare Pages Function for generating story illustrations using GPT-Image-1.5
 * via Azure OpenAI.
 * 
 * POST /api/generate-story-art
 * 
 * Generates personalized artwork capturing a reading's essence.
 * Supports triptych (3-panel), single scene, and card vignette formats.
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
  buildTriptychPrompt,
  buildSingleScenePrompt,
  buildCardVignettePrompt,
  STYLE_PROMPTS
} from '../lib/storyArtPrompts.js';
import { getStoryArtLimits } from '../../shared/monetization/media.js';

// Azure OpenAI Image Generation configuration
const AZURE_IMAGE_API_VERSION = 'preview';
const DEFAULT_MODEL = 'gpt-image-1.5';
const DEFAULT_QUALITY = 'medium';
const DEFAULT_FORMAT = 'jpeg';
const DEFAULT_COMPRESSION = 85;
const DEFAULT_IMAGE_TIMEOUT_MS = 45000;

// Size mappings for different formats
const FORMAT_SIZES = {
  triptych: '1536x1024',    // landscape
  single: '1536x1024',      // landscape
  panoramic: '1536x1024',   // landscape
  vignette: '1024x1536',    // portrait
  square: '1024x1024'       // square
};

/**
 * Validate request payload
 */
function validatePayload(payload) {
  const errors = [];
  
  if (!payload.cards || !Array.isArray(payload.cards) || payload.cards.length === 0) {
    errors.push('cards array is required');
  }
  
  if (!payload.question || typeof payload.question !== 'string') {
    errors.push('question string is required');
  }
  
  const validFormats = ['triptych', 'single', 'panoramic', 'vignette'];
  if (payload.format && !validFormats.includes(payload.format)) {
    errors.push(`format must be one of: ${validFormats.join(', ')}`);
  }
  
  if (payload.style && !STYLE_PROMPTS[payload.style]) {
    errors.push(`style must be one of: ${Object.keys(STYLE_PROMPTS).join(', ')}`);
  }
  
  return errors;
}

/**
 * Generate cache key for R2 storage
 */
function generateCacheKey(cards, question, style, format) {
  const cardKey = cards.map(c => `${c.name}-${c.position}-${c.reversed ? 'r' : 'u'}`).join('|');
  const hash = simpleHash(`${cardKey}:${question}:${style}:${format}`);
  return `generated-art/${hash}.jpeg`;
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
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_IMAGE_TIMEOUT_MS, label = 'request') {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const merged = { ...options, signal: controller.signal };

  try {
    return await fetch(url, merged);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Azure Image API ${label} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Azure OpenAI Image Generation API
 */
async function generateImage(env, prompt, options = {}) {
  const endpoint = env.AZURE_OPENAI_IMAGE_ENDPOINT || env.AZURE_OPENAI_ENDPOINT;
  const apiKey = env.AZURE_OPENAI_IMAGE_API_KEY || env.AZURE_OPENAI_API_KEY;
  const model = env.AZURE_OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number.parseInt(env.AZURE_OPENAI_IMAGE_TIMEOUT_MS || DEFAULT_IMAGE_TIMEOUT_MS, 10);
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI Image configuration is missing');
  }
  
  // Normalize endpoint
  const normalizedEndpoint = endpoint
    .replace(/\/+$/, '')
    .replace(/\/openai\/v1\/?$/, '')
    .replace(/\/openai\/?$/, '');
  
  const {
    size = '1536x1024',
    quality = DEFAULT_QUALITY,
    outputFormat = DEFAULT_FORMAT,
    compression = DEFAULT_COMPRESSION,
    background = 'opaque'
  } = options;
  
  const url = `${normalizedEndpoint}/openai/v1/images/generations?api-version=${AZURE_IMAGE_API_VERSION}`;
  
  const body = {
    model,
    prompt,
    size,
    quality,
    n: 1,
    output_format: outputFormat,
    output_compression: compression,
    background
  };
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(body)
  }, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_IMAGE_TIMEOUT_MS, 'image generation');
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure Image API error (${response.status}): ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.data || !result.data[0]) {
    throw new Error('No image data in response');
  }
  
  return {
    b64_json: result.data[0].b64_json,
    revised_prompt: result.data[0].revised_prompt
  };
}

/**
 * Check R2 cache for existing image
 */
async function checkCache(env, cacheKey) {
  if (!env.R2_LOGS) return null;
  
  try {
    const object = await env.R2_LOGS.get(cacheKey);
    if (object) {
      const arrayBuffer = await object.arrayBuffer();
      return arrayBufferToBase64(arrayBuffer);
    }
  } catch (err) {
    console.error('R2 cache check failed:', err.message);
  }
  
  return null;
}

/**
 * Store image in R2 cache
 */
async function storeInCache(env, cacheKey, base64Data) {
  if (!env.R2_LOGS) return;
  
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    await env.R2_LOGS.put(cacheKey, bytes.buffer, {
      httpMetadata: { contentType: 'image/jpeg' },
      customMetadata: { created: new Date().toISOString() }
    });
  } catch (err) {
    console.error('R2 cache store failed:', err.message);
  }
}

/**
 * Main handler
 */
export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const requestId = crypto.randomUUID
    ? crypto.randomUUID()
    : `story_art_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const startTime = Date.now();
  console.log(`[${requestId}] [story-art] === STORY ART REQUEST START ===`);
  
  // Check feature flag
  if (env.FEATURE_STORY_ART !== 'true') {
    return jsonResponse({ error: 'Story art feature is not enabled' }, 503);
  }
  
  // Authenticate user
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }
  
  // Check subscription tier
  const subscription = getSubscriptionContext(user);
  const tier = subscription?.effectiveTier || 'free';
  const limits = getStoryArtLimits(tier, {
    availableStyles: Object.keys(STYLE_PROMPTS),
    availableFormats: ['triptych', 'single', 'panoramic', 'vignette']
  });
  
  if (!limits.enabled) {
    return jsonResponse({ 
      error: 'Story art requires a Plus or Pro subscription',
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
    cards,
    question,
    narrative = '',
    format = 'single',
    style = 'watercolor'
  } = payload;
  const quality = limits.quality || DEFAULT_QUALITY;
  const imageModel = env.AZURE_OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
  const endpointSource = env.AZURE_OPENAI_IMAGE_ENDPOINT ? 'image' : 'shared';
  const apiKeySource = env.AZURE_OPENAI_IMAGE_API_KEY ? 'image' : 'shared';
  const requestedSize = FORMAT_SIZES[format] || FORMAT_SIZES.single;
  
  // Validate tier access to format/style
  if (!limits.formats.includes(format)) {
    return jsonResponse({ 
      error: `Format '${format}' requires Pro subscription`,
      allowedFormats: limits.formats 
    }, 403);
  }
  
  if (!limits.styles.includes(style)) {
    return jsonResponse({ 
      error: `Style '${style}' requires Pro subscription`,
      allowedStyles: limits.styles 
    }, 403);
  }

  // Generate cache key and check cache
  const cacheKey = generateCacheKey(cards, question, style, format);
  const cacheStart = Date.now();
  const cachedImage = await checkCache(env, cacheKey);
  
  if (cachedImage) {
    const totalMs = Date.now() - startTime;
    await persistMediaTelemetry(env, buildMediaTelemetryPayload({
      requestId,
      timestamp: new Date().toISOString(),
      feature: 'story-art',
      status: 'completed',
      provider: 'azure-openai-image',
      models: { image: imageModel },
      apiVersion: { image: AZURE_IMAGE_API_VERSION },
      tier,
      input: {
        cardCount: Array.isArray(cards) ? cards.length : 0,
        format,
        style,
        quality,
        size: requestedSize,
        questionLength: typeof question === 'string' ? question.length : 0,
        narrativeLength: typeof narrative === 'string' ? narrative.length : 0,
        endpointSource,
        apiKeySource
      },
      output: {
        cached: true,
        format: 'jpeg'
      },
      timings: {
        totalMs,
        cacheMs: Date.now() - cacheStart
      }
    }), { key: `media:story-art:${requestId}` });
    console.log(`[${requestId}] [story-art] Cache hit in ${totalMs}ms`);
    console.log(`[${requestId}] [story-art] === STORY ART REQUEST END ===`);
    return jsonResponse({
      success: true,
      image: cachedImage,
      format: 'jpeg',
      cached: true,
      style,
      artFormat: format,
      cacheKey,
      requestId
    });
  }
  
  // Build prompt based on format
  let prompt = null;
  try {
    switch (format) {
      case 'triptych':
        prompt = buildTriptychPrompt(cards, question, style);
        break;
      case 'vignette':
        // For vignette, use first card
        prompt = buildCardVignettePrompt(cards[0], question, cards[0].position, style);
        break;
      case 'single':
      case 'panoramic':
      default:
        prompt = buildSingleScenePrompt(cards, question, style, narrative);
        break;
    }
  } catch (err) {
    return jsonResponse({ error: `Failed to build prompt: ${err.message}` }, 500);
  }
  maybeLogPromptPayload(env, requestId, 'story-art', '', prompt, null, { personalization: { displayName: user?.display_name } });
  
  let usageReservation = null;
  if (Number.isFinite(limits.maxPerDay)) {
    const usage = await checkAndIncrementDailyUsage(env, {
      feature: 'story-art',
      userId: user.id,
      limit: limits.maxPerDay
    });
    if (!usage.allowed) {
      return jsonResponse({
        error: 'Daily story art limit reached.',
        limit: usage.limit,
        remaining: usage.remaining,
        resetsAt: usage.resetsAt
      }, 429);
    }
    usageReservation = usage;
  }

  // Generate image
  try {
    const size = requestedSize;
    console.log(`[${requestId}] [story-art] Calling Azure image generation`, {
      model: imageModel,
      size,
      quality,
      endpointSource,
      apiKeySource
    });
    const apiStart = Date.now();
    const result = await generateImage(env, prompt, {
      size,
      quality,
      outputFormat: DEFAULT_FORMAT,
      compression: DEFAULT_COMPRESSION
    });
    const apiMs = Date.now() - apiStart;
    
    // Cache the result
    await storeInCache(env, cacheKey, result.b64_json);
    
    const totalMs = Date.now() - startTime;
    await persistMediaTelemetry(env, buildMediaTelemetryPayload({
      requestId,
      timestamp: new Date().toISOString(),
      feature: 'story-art',
      status: 'completed',
      provider: 'azure-openai-image',
      models: { image: imageModel },
      apiVersion: { image: AZURE_IMAGE_API_VERSION },
      tier,
      input: {
        cardCount: Array.isArray(cards) ? cards.length : 0,
        format,
        style,
        quality,
        size,
        questionLength: typeof question === 'string' ? question.length : 0,
        narrativeLength: typeof narrative === 'string' ? narrative.length : 0,
        promptLength: typeof prompt === 'string' ? prompt.length : 0,
        endpointSource,
        apiKeySource
      },
      output: {
        cached: false,
        format: 'jpeg',
        revisedPromptLength: typeof result.revised_prompt === 'string' ? result.revised_prompt.length : 0
      },
      timings: {
        totalMs,
        apiMs
      }
    }), { key: `media:story-art:${requestId}` });
    console.log(`[${requestId}] [story-art] Generated in ${totalMs}ms`);
    console.log(`[${requestId}] [story-art] === STORY ART REQUEST END ===`);
    return jsonResponse({
      success: true,
      image: result.b64_json,
      format: 'jpeg',
      cached: false,
      style,
      artFormat: format,
      cacheKey,
      revisedPrompt: result.revised_prompt,
      requestId
    });
    
  } catch (_err) {
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
      feature: 'story-art',
      status: 'error',
      provider: 'azure-openai-image',
      models: { image: imageModel },
      apiVersion: { image: AZURE_IMAGE_API_VERSION },
      tier,
      input: {
        cardCount: Array.isArray(cards) ? cards.length : 0,
        format,
        style,
        quality,
        size: requestedSize,
        questionLength: typeof question === 'string' ? question.length : 0,
        narrativeLength: typeof narrative === 'string' ? narrative.length : 0,
        promptLength: typeof prompt === 'string' ? prompt.length : 0,
        endpointSource,
        apiKeySource
      },
      output: {
        cached: false,
        format: 'jpeg'
      },
      timings: {
        totalMs
      },
      error: {
        name: _err?.name || 'Error',
        message: _err?.message || 'Unknown error'
      }
    }), { key: `media:story-art:${requestId}` });
    console.error('Image generation failed:', _err.message);
    console.log(`[${requestId}] [story-art] === STORY ART REQUEST END (ERROR) ===`);
    return jsonResponse({ 
      error: 'Image generation failed',
      details: _err.message,
      requestId
    }, 500);
  }
}

export default { onRequestPost };
