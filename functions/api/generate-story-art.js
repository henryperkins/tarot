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
import {
  MEDIA_PROMPT_LIMITS,
  sanitizeMediaCards,
  sanitizeMediaQuestion,
  sanitizeMediaReflections
} from '../lib/mediaPromptSanitization.js';
import {
  enforceMediaPromptBudget,
  resolveMediaPromptBudgets
} from '../lib/mediaPromptBudget.js';

// Azure OpenAI Image Generation configuration
const AZURE_IMAGE_API_VERSION = 'preview';
const DEFAULT_MODEL = 'gpt-image-1.5';
const DEFAULT_QUALITY = 'medium';
const DEFAULT_FORMAT = 'jpeg';
const DEFAULT_COMPRESSION = 85;
const DEFAULT_IMAGE_TIMEOUT_MS = 45000;
const STORY_ART_SANITIZED_FIELDS = Object.freeze([
  'cards[].name',
  'cards[].position',
  'cards[].meaning',
  'question',
  'narrative'
]);

const FORMAT_CARD_LIMITS = Object.freeze({
  triptych: { min: 1, max: MEDIA_PROMPT_LIMITS.maxCards },
  single: { min: 1, max: MEDIA_PROMPT_LIMITS.maxCards },
  panoramic: { min: 1, max: MEDIA_PROMPT_LIMITS.maxCards },
  vignette: { min: 1, max: 1 }
});

// Size mappings for different formats
const FORMAT_SIZES = {
  triptych: '1536x1024',    // landscape
  single: '1536x1024',      // landscape
  panoramic: '1536x1024',   // landscape
  vignette: '1024x1536',    // portrait
  square: '1024x1024'       // square
};

function isMediaPromptSanitizationEnabled(env) {
  return env.MEDIA_PROMPT_SANITIZATION_V2 !== 'false';
}

function isMediaPromptBudgetGuardsEnabled(env) {
  return env.MEDIA_PROMPT_BUDGET_GUARDS !== 'false';
}

function addValidationError(errors, code, message) {
  errors.push({ code, message });
}

function normalizeStoryArtPayload(payload) {
  return {
    ...payload,
    cards: sanitizeMediaCards(Array.isArray(payload.cards) ? payload.cards : []),
    question: sanitizeMediaQuestion(payload.question),
    narrative: sanitizeMediaReflections(payload.narrative || '')
  };
}

/**
 * Validate request payload
 */
function validatePayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    addValidationError(errors, 'invalid_payload_structure', 'request body must be an object');
    return errors;
  }

  if (!Array.isArray(payload.cards) || payload.cards.length === 0) {
    addValidationError(errors, 'invalid_cards', 'cards array is required');
  }

  if (typeof payload.question !== 'string' || !payload.question.trim()) {
    addValidationError(errors, 'invalid_question', 'question string is required');
  } else if (payload.question.trim().length > MEDIA_PROMPT_LIMITS.question) {
    addValidationError(
      errors,
      'invalid_question_length',
      `question must be ${MEDIA_PROMPT_LIMITS.question} characters or fewer`
    );
  }

  if (payload.narrative !== undefined && payload.narrative !== null) {
    if (typeof payload.narrative !== 'string') {
      addValidationError(errors, 'invalid_narrative', 'narrative must be a string when provided');
    } else if (payload.narrative.trim().length > MEDIA_PROMPT_LIMITS.reflections) {
      addValidationError(
        errors,
        'invalid_narrative_length',
        `narrative must be ${MEDIA_PROMPT_LIMITS.reflections} characters or fewer`
      );
    }
  }

  const validFormats = ['triptych', 'single', 'panoramic', 'vignette'];
  if (payload.format && !validFormats.includes(payload.format)) {
    addValidationError(errors, 'invalid_format', `format must be one of: ${validFormats.join(', ')}`);
  }

  if (payload.style && !STYLE_PROMPTS[payload.style]) {
    addValidationError(errors, 'invalid_style', `style must be one of: ${Object.keys(STYLE_PROMPTS).join(', ')}`);
  }

  if (Array.isArray(payload.cards) && payload.cards.length > 0) {
    const selectedFormat = payload.format || 'single';
    const formatLimits = FORMAT_CARD_LIMITS[selectedFormat] || FORMAT_CARD_LIMITS.single;
    if (payload.cards.length < formatLimits.min || payload.cards.length > formatLimits.max) {
      addValidationError(
        errors,
        'invalid_card_count',
        `${selectedFormat} format requires ${formatLimits.min}-${formatLimits.max} cards`
      );
    }

    payload.cards.forEach((card, index) => {
      if (!card || typeof card !== 'object' || Array.isArray(card)) {
        addValidationError(errors, 'invalid_card_shape', `cards[${index}] must be an object`);
        return;
      }

      const rawName = typeof card.name === 'string' ? card.name : (typeof card.card === 'string' ? card.card : '');
      if (!rawName.trim()) {
        addValidationError(errors, 'invalid_card_name', `cards[${index}].name is required`);
      } else if (rawName.trim().length > MEDIA_PROMPT_LIMITS.cardName) {
        addValidationError(
          errors,
          'invalid_card_name_length',
          `cards[${index}].name must be ${MEDIA_PROMPT_LIMITS.cardName} characters or fewer`
        );
      }

      if (card.position !== undefined && card.position !== null) {
        if (typeof card.position !== 'string' || !card.position.trim()) {
          addValidationError(errors, 'invalid_card_position', `cards[${index}].position must be a non-empty string`);
        } else if (card.position.trim().length > MEDIA_PROMPT_LIMITS.position) {
          addValidationError(
            errors,
            'invalid_card_position_length',
            `cards[${index}].position must be ${MEDIA_PROMPT_LIMITS.position} characters or fewer`
          );
        }
      }

      if (card.meaning !== undefined && card.meaning !== null) {
        if (typeof card.meaning !== 'string') {
          addValidationError(errors, 'invalid_card_meaning', `cards[${index}].meaning must be a string when provided`);
        } else if (card.meaning.trim().length > MEDIA_PROMPT_LIMITS.meaning) {
          addValidationError(
            errors,
            'invalid_card_meaning_length',
            `cards[${index}].meaning must be ${MEDIA_PROMPT_LIMITS.meaning} characters or fewer`
          );
        }
      }
    });
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
    return jsonResponse({
      error: errors.map(({ message }) => message).join('; '),
      code: errors[0]?.code || 'invalid_payload',
      errors
    }, 400);
  }

  const sanitizationApplied = isMediaPromptSanitizationEnabled(env);
  const normalizedPayload = sanitizationApplied
    ? normalizeStoryArtPayload(payload)
    : payload;

  const {
    cards,
    question,
    narrative = '',
    format = 'single',
    style = 'watercolor'
  } = normalizedPayload;
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
        sanitizationApplied,
        sanitizedFields: sanitizationApplied ? STORY_ART_SANITIZED_FIELDS : [],
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
  let promptBudgetMeta = null;
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

  if (isMediaPromptBudgetGuardsEnabled(env)) {
    const budgets = resolveMediaPromptBudgets(env);
    promptBudgetMeta = enforceMediaPromptBudget(prompt, budgets.storyArt);
    if (!promptBudgetMeta.ok) {
      return jsonResponse({
        error: promptBudgetMeta.message,
        code: promptBudgetMeta.errorCode,
        budget: promptBudgetMeta.budget,
        originalLength: promptBudgetMeta.originalLength,
        finalLength: promptBudgetMeta.finalLength,
        trimmedSections: promptBudgetMeta.trimmedSections
      }, 400);
    }
    prompt = promptBudgetMeta.prompt;
  } else {
    promptBudgetMeta = {
      originalLength: typeof prompt === 'string' ? prompt.length : 0,
      finalLength: typeof prompt === 'string' ? prompt.length : 0,
      slimmed: false,
      trimmedSections: []
    };
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
        promptLength: promptBudgetMeta.finalLength,
        promptOriginalLength: promptBudgetMeta.originalLength,
        promptFinalLength: promptBudgetMeta.finalLength,
        promptSlimmed: Boolean(promptBudgetMeta.slimmed),
        promptSlimmingSteps: promptBudgetMeta.trimmedSections,
        sanitizationApplied,
        sanitizedFields: sanitizationApplied ? STORY_ART_SANITIZED_FIELDS : [],
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
        promptLength: promptBudgetMeta.finalLength,
        promptOriginalLength: promptBudgetMeta.originalLength,
        promptFinalLength: promptBudgetMeta.finalLength,
        promptSlimmed: Boolean(promptBudgetMeta.slimmed),
        promptSlimmingSteps: promptBudgetMeta.trimmedSections,
        sanitizationApplied,
        sanitizedFields: sanitizationApplied ? STORY_ART_SANITIZED_FIELDS : [],
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
