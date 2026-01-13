import { generateFallbackWaveform } from '../../shared/fallbackAudio.js';
import { jsonResponse, readJsonBody, sanitizeText } from '../lib/utils.js';
import { getUserFromRequest } from '../lib/auth.js';
import { getClientIdentifier } from '../lib/clientId.js';
import {
  getMonthKeyUtc,
  getResetAtUtc,
  getUsageRow,
  incrementUsageCounter
} from '../lib/usageTracking.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { getTierConfig } from '../../shared/monetization/subscription.js';
import { resolveEnv } from '../lib/environment.js';

/**
 * Cloudflare Pages Function that provides text-to-speech audio as a data URI or streaming response.
 *
 * Enhanced with gpt-4o-mini-tts steerable instructions for context-aware,
 * mystical tarot reading narration.
 *
 * Supports:
 * - Context-specific instruction templates (card-reveal, full-reading, synthesis)
 * - Voice selection (verse, nova, shimmer, alloy, echo, fable, onyx, etc.)
 * - Speed control for contemplative pacing (0.25-4.0, default 1.1)
 * - Streaming mode for real-time audio playback
 * - Graceful fallback to local waveform
 *
 * Usage:
 *
 * Non-streaming mode (returns JSON with base64 data URI):
 *   POST /api/tts
 *   Body: { "text": "...", "context": "full-reading", "voice": "verse", "speed": 0.9 }
 *   Response: { "audio": "data:audio/mp3;base64,...", "provider": "azure-gpt-4o-mini-tts" }
 *
 * Streaming mode (returns audio stream):
 *   POST /api/tts?stream=true
 *   Body: { "text": "...", "context": "full-reading", "voice": "verse", "speed": 0.9 }
 *   Response: audio/mp3 stream (content-type: audio/mp3)
 *
 * API Reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference-preview-latest#create-speech
 */
export const onRequestGet = async ({ env }) => {
  // Health check endpoint
  // TTS can use separate credentials (AZURE_OPENAI_TTS_*) or fall back to shared credentials
  const azureEndpoint = resolveEnv(env, 'AZURE_OPENAI_TTS_ENDPOINT') || resolveEnv(env, 'AZURE_OPENAI_ENDPOINT');
  const azureKey = resolveEnv(env, 'AZURE_OPENAI_TTS_API_KEY') || resolveEnv(env, 'AZURE_OPENAI_API_KEY');
  const azureDeployment = resolveEnv(env, 'AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT');
  const hasAzure = !!(azureEndpoint && azureKey && azureDeployment);
  return jsonResponse({
    status: 'ok',
    provider: hasAzure ? 'azure-openai' : 'local',
    timestamp: new Date().toISOString()
  });
};

/**
 * Get TTS limits based on subscription tier.
 * Uses shared subscription config as single source of truth.
 */
function getTTSLimits(tier) {
  const config = getTierConfig(tier);
  return {
    monthly: config.monthlyTTS,
    premium: tier === 'plus' || tier === 'pro'
  };
}

export const onRequestPost = async ({ request, env }) => {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(request.url);
    const stream = url.searchParams.get('stream') === 'true';

    // Get user and subscription info
    const user = await getUserFromRequest(request, env);
    const subscription = getSubscriptionContext(user);
    const tier = subscription.tier;
    const effectiveTier = subscription.effectiveTier;
    const ttsLimits = getTTSLimits(effectiveTier);

    const { text, context, voice, speed } = await readJsonBody(request);
    const sanitizedText = sanitizeText(text, { maxLength: 4000, collapseWhitespace: false });
    const debugLoggingEnabled = isTtsDebugLoggingEnabled(env);

    if (!sanitizedText) {
      return jsonResponse(
        { error: 'The "text" field is required.' },
        { status: 400 }
      );
    }

    // API key usage is Pro-only and subject to API call limits.
    if (user?.auth_provider === 'api_key') {
      const apiLimit = await enforceApiCallLimit(env, user);
      if (!apiLimit.allowed) {
        return jsonResponse(apiLimit.payload, { status: apiLimit.status });
      }
    }

    // Check tier-based rate limits (in addition to global rate limit)
    const rateLimitResult = await enforceTtsRateLimit(env, request, user, ttsLimits, requestId);
    if (rateLimitResult?.limited) {
      const errorMessage = rateLimitResult.tierLimited
        ? `You've reached your monthly TTS limit (${ttsLimits.monthly}). Upgrade to Plus or Pro for more.`
        : 'Too many text-to-speech requests. Please wait a few moments and try again.';

      return jsonResponse(
        {
          error: errorMessage,
          tierLimited: rateLimitResult.tierLimited || false,
          currentTier: tier,
          limit: rateLimitResult.limit ?? null,
          used: rateLimitResult.used ?? null,
          resetAt: rateLimitResult.resetAt ?? null
        },
        {
          status: 429,
          headers: {
            'retry-after': rateLimitResult.retryAfter.toString()
          }
        }
      );
    }

    // Primary: Azure OpenAI gpt-4o-mini-tts with steerable instructions
    // TTS can use separate credentials (AZURE_OPENAI_TTS_*) or fall back to shared credentials
    const azureConfig = {
      endpoint: resolveEnv(env, 'AZURE_OPENAI_TTS_ENDPOINT') || resolveEnv(env, 'AZURE_OPENAI_ENDPOINT'),
      apiKey: resolveEnv(env, 'AZURE_OPENAI_TTS_API_KEY') || resolveEnv(env, 'AZURE_OPENAI_API_KEY'),
      deployment: resolveEnv(env, 'AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT'),
      apiVersion: resolveEnv(env, 'AZURE_OPENAI_API_VERSION'),
      format: resolveEnv(env, 'AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT'),
      useV1Format: resolveEnv(env, 'AZURE_OPENAI_USE_V1_FORMAT'),
      debugLoggingEnabled
    };

    if (azureConfig.endpoint && azureConfig.apiKey && azureConfig.deployment) {
      try {
        if (stream) {
          // Return streaming response
          return await generateWithAzureGptMiniTTSStream(azureConfig, {
            text: sanitizedText,
            context: context || 'default',
            voice: voice || 'verse',
            speed: speed
          });
        } else {
          // Return complete audio as data URI
          const audio = await generateWithAzureGptMiniTTS(azureConfig, {
            text: sanitizedText,
            context: context || 'default',
            voice: voice || 'verse',
            speed: speed
          });
          if (audio) {
            return jsonResponse({ audio, provider: 'azure-gpt-4o-mini-tts' });
          }
        }
      } catch (error) {
        console.error(`[${requestId}] [tts] Azure gpt-4o-mini-tts failed, falling back to local waveform:`, error);
      }
    }

    // Fallback: local synthesized waveform (no external dependency).
    const fallbackAudio = generateFallbackWaveform(sanitizedText);

    if (stream) {
      // For streaming requests, decode base64 and return binary audio
      const base64Data = fallbackAudio.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Response(bytes, {
        headers: {
          'content-type': 'audio/wav',
          'cache-control': 'no-cache'
        }
      });
    }

    return jsonResponse({ audio: fallbackAudio, provider: 'fallback' });
  } catch (error) {
    console.error(`[${requestId}] [tts] Function error:`, error);
    return jsonResponse(
      { error: 'Unable to generate audio at this time.' },
      { status: 500 }
    );
  }
};

// sanitizeText is now imported from ../lib/utils.js

/**
 * Convert Uint8Array to base64 string.
 * Used for encoding audio binary data into data URIs.
 */
function uint8ToBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Steerable instruction templates for different tarot reading contexts.
 * These leverage gpt-4o-mini-tts's ability to control tone, pacing, and delivery style.
 */
const INSTRUCTION_TEMPLATES = {
  'card-reveal': `Speak gently and mystically, as a tarot reader revealing a single card with reverence.
    Use a slightly slower pace with brief pauses after the card name and orientation.
    Convey wisdom and contemplation in your tone.`,

  'full-reading': `Speak as a wise, compassionate tarot reader sharing a complete reading.
    Use a thoughtful, contemplative tone with natural pauses between card descriptions and themes.
    Allow space for reflection—speak slowly and deliberately, as if sitting across from the querent.
    Convey mystical depth while remaining grounded and accessible.
    Maintain a gentle, trauma-informed presence throughout.`,

  'synthesis': `Speak as a tarot reader weaving together the threads of a reading into cohesive guidance.
    Use a flowing, storytelling cadence that connects themes and patterns.
    Pause briefly between major insights to allow integration.
    Convey both wisdom and warmth, emphasizing agency and empowerment.`,

  'question': `Speak gently and clearly, acknowledging the querent's question with respect.
    Use a warm, inviting tone that creates space for exploration rather than fixed answers.`,

  'reflection': `Speak softly and affirmingly, honoring the querent's personal reflections.
    Use a validating, supportive tone that acknowledges their intuitive insights.`,

  'default': `Speak thoughtfully and gently, as a tarot reader sharing wisdom.
    Use a mystical yet grounded tone with natural pacing and slight pauses for contemplation.`
};

/**
 * Build TTS request configuration shared by both streaming and non-streaming modes.
 * Extracts common logic for endpoint construction, payload building, and parameter validation.
 *
 * @param {Object} env - Environment configuration
 * @param {Object} options - TTS options
 * @param {string} options.text - Text to synthesize
 * @param {string} options.context - Context template (card-reveal, full-reading, etc.)
 * @param {string} [options.voice='verse'] - Voice selection
 * @param {number} [options.speed=1.1] - Speech speed (0.25-4.0)
 * @returns {Object} Request configuration with url, payload, format, etc.
 */
function buildTTSRequest(env, { text, context, voice, speed }) {
  const endpoint = env.endpoint.replace(/\/+$/, '');
  const deployment = env.deployment;
  const format = env.format || 'mp3';
  const useV1Format = env.useV1Format === 'true' || env.useV1Format === true;
  const debugLoggingEnabled = Boolean(env.debugLoggingEnabled);

  // API version logic:
  // - v1 format uses "preview"
  // - deployment format uses dated preview version (e.g., "2025-04-01-preview")
  const apiVersion = useV1Format
    ? 'preview'
    : (env.apiVersion || '2025-04-01-preview');

  // Select instruction template based on context
  const instructions = INSTRUCTION_TEMPLATES[context] || INSTRUCTION_TEMPLATES.default;

  // Voice validation (gpt-4o-mini-tts voices - 11 available)
  // Base voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse
  const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
  const selectedVoice = validVoices.includes(voice) ? voice : 'verse';

  // Speed validation (0.25 - 4.0 range per API spec)
  const selectedSpeed = speed !== undefined
    ? Math.max(0.25, Math.min(4.0, speed))
    : 1.1; // Default: slightly faster for engaging tarot reading pace

  // Build URL based on format preference
  const url = useV1Format
    ? `${endpoint}/openai/v1/audio/speech?api-version=${apiVersion}`
    : `${endpoint}/openai/deployments/${deployment}/audio/speech?api-version=${apiVersion}`;

  // Build payload per API specification
  const payload = {
    input: text,
    model: deployment,
    voice: selectedVoice,
    response_format: format,
    speed: selectedSpeed
  };

  // Check if this deployment supports steerable instructions
  const isSteerableModel = /gpt-4o|mini-tts|audio-preview/i.test(deployment);

  if (isSteerableModel) {
    payload.instructions = instructions;
  }

  return { url, payload, format, useV1Format, apiVersion, debugLoggingEnabled };
}

/**
 * Enhanced Azure OpenAI TTS generation with optional steerable instructions.
 *
 * For steerable-capable models (e.g. gpt-4o-mini-tts, audio-preview variants), includes
 * context-aware instructions. For standard models (tts-1, tts-1-hd), omits unsupported fields.
 * This keeps behavior model-agnostic while preserving rich narration when available.
 *
 * API Reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference-preview-latest#create-speech
 */
async function generateWithAzureGptMiniTTS(env, { text, context, voice, speed }) {
  const { url, payload, format, debugLoggingEnabled } = buildTTSRequest(env, { text, context, voice, speed });

  if (debugLoggingEnabled) {
    console.log('[TTS] Request URL:', url);
    console.log('[TTS] Request payload:', JSON.stringify(payload, null, 2));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': env.apiKey,
      'content-type': 'application/json'  // JSON works despite docs saying multipart/form-data
    },
    body: JSON.stringify(payload)
  });

  if (debugLoggingEnabled) {
    console.log('[TTS] Response status:', response.status, response.statusText);
    console.log('[TTS] Response headers:', JSON.stringify([...response.headers.entries()]));
  }

  if (!response.ok) {
    let errText = '';
    if (debugLoggingEnabled) {
      errText = await response.text().catch(() => '');
    }
    console.error('[TTS] Azure request failed', response.status, response.statusText);
    if (debugLoggingEnabled && errText) {
      console.error('[TTS] Error response body:', errText);
    }
    throw new Error(`Azure TTS error ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));
  const mime = format === 'wav' ? 'audio/wav' : `audio/${format}`;
  return `data:${mime};base64,${base64}`;
}

/**
 * Streaming Azure OpenAI TTS generation.
 *
 * Uses the stream_format parameter to request Server-Sent Events (SSE)
 * or raw audio streaming from Azure OpenAI.
 *
 * Per API docs: "sse is not supported for tts-1 or tts-1-hd"
 * Use stream_format: 'audio' for all models
 *
 * API Reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference-preview-latest#create-speech
 */
async function generateWithAzureGptMiniTTSStream(env, { text, context, voice, speed }) {
  const { url, payload, format, debugLoggingEnabled } = buildTTSRequest(env, { text, context, voice, speed });

  // Add streaming parameter
  payload.stream_format = 'audio'; // Stream raw audio chunks (safer, works with all models)

  if (debugLoggingEnabled) {
    console.log('[TTS Streaming] Request URL:', url);
    console.log('[TTS Streaming] Request payload:', JSON.stringify(payload, null, 2));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': env.apiKey,
      'content-type': 'application/json'  // JSON works despite docs saying multipart/form-data
    },
    body: JSON.stringify(payload)
  });

  if (debugLoggingEnabled) {
    console.log('[TTS Streaming] Response status:', response.status, response.statusText);
  }

  if (!response.ok) {
    let errText = '';
    if (debugLoggingEnabled) {
      errText = await response.text().catch(() => '');
    }
    console.error('[TTS Streaming] Azure request failed', response.status, response.statusText);
    if (debugLoggingEnabled && errText) {
      console.error('[TTS Streaming] Error response body:', errText);
    }
    throw new Error(`Azure TTS streaming error ${response.status}`);
  }

  // Return the streaming response directly
  // The response body is a ReadableStream of audio chunks
  const mime = format === 'wav' ? 'audio/wav' : `audio/${format}`;
  return new Response(response.body, {
    headers: {
      'content-type': mime,
      'cache-control': 'no-cache'
    }
  });
}
const DEFAULT_RATE_LIMIT_MAX = 30;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const TTS_RATE_LIMIT_KEY_PREFIX = 'tts-rate';
const TTS_MONTHLY_KEY_PREFIX = 'tts-monthly';

async function enforceTtsRateLimit(env, request, user, ttsLimits = { monthly: 3, premium: false }, requestId = 'unknown') {
  try {
    const store = env?.RATELIMIT;
    
    // Short-term rate limit (requests per minute)
    if (store) {
      const maxRequests = Number(resolveEnv(env, 'TTS_RATE_LIMIT_MAX')) || DEFAULT_RATE_LIMIT_MAX;
      const windowSeconds = Number(resolveEnv(env, 'TTS_RATE_LIMIT_WINDOW')) || DEFAULT_RATE_LIMIT_WINDOW_SECONDS;
      const now = Date.now();
      const windowBucket = Math.floor(now / (windowSeconds * 1000));
      const clientId = getClientIdentifier(request);
      const rateLimitKey = `${TTS_RATE_LIMIT_KEY_PREFIX}:${clientId}:${windowBucket}`;

      const existing = await store.get(rateLimitKey);
      const currentCount = existing ? Number(existing) || 0 : 0;

      if (currentCount >= maxRequests) {
        const windowBoundary = (windowBucket + 1) * windowSeconds * 1000;
        const retryAfter = Math.max(1, Math.ceil((windowBoundary - now) / 1000));
        return { limited: true, retryAfter };
      }

      await store.put(rateLimitKey, String(currentCount + 1), {
        expirationTtl: windowSeconds
      });
    }

    // Monthly tier-based limit (prefer D1 per-user counters; fall back to KV per IP).
    const now = new Date();
    const monthKey = getMonthKeyUtc(now);
    const resetAt = getResetAtUtc(now);

    if (user?.id && env?.DB) {
      try {
        const nowMs = Date.now();

        if (ttsLimits.monthly === Infinity) {
          await incrementUsageCounter(env.DB, {
            userId: user.id,
            month: monthKey,
            counter: 'tts',
            nowMs
          });
          return { limited: false };
        }

        const incrementResult = await incrementUsageCounter(env.DB, {
          userId: user.id,
          month: monthKey,
          counter: 'tts',
          limit: ttsLimits.monthly,
          nowMs
        });

        if (incrementResult.changed === 0) {
          const row = await getUsageRow(env.DB, user.id, monthKey);
          const used = row?.tts_count || ttsLimits.monthly;
          const retryAfter = Math.max(1, Math.ceil((Date.parse(resetAt) - now.getTime()) / 1000));
          return {
            limited: true,
            tierLimited: true,
            retryAfter,
            used,
            limit: ttsLimits.monthly,
            resetAt
          };
        }

        return { limited: false };
      } catch (error) {
        // If usage tracking isn't available yet (missing migration), fall back to KV.
        if (!String(error?.message || '').includes('no such table')) {
          throw error;
        }
      }
    }

    if (store && ttsLimits.monthly !== Infinity) {
      const clientId = getClientIdentifier(request);
      const monthlyKey = `${TTS_MONTHLY_KEY_PREFIX}:${clientId}:${monthKey}`;

      const monthlyCount = await store.get(monthlyKey);
      const currentMonthlyCount = monthlyCount ? Number(monthlyCount) || 0 : 0;

      if (currentMonthlyCount >= ttsLimits.monthly) {
        const retryAfter = Math.max(1, Math.ceil((Date.parse(resetAt) - now.getTime()) / 1000));
        return {
          limited: true,
          tierLimited: true,
          retryAfter,
          used: currentMonthlyCount,
          limit: ttsLimits.monthly,
          resetAt
        };
      }

      await store.put(monthlyKey, String(currentMonthlyCount + 1), {
        expirationTtl: 35 * 24 * 60 * 60
      });
    }

    return { limited: false };
  } catch (error) {
    console.warn(`[${requestId}] [tts] Rate limit check failed, allowing request:`, error);
    return { limited: false };
  }
}

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

function isTtsDebugLoggingEnabled(env) {
  const explicit = resolveEnv(env, 'ENABLE_TTS_DEBUG_LOGGING');
  if (typeof explicit !== 'undefined') {
    return parseBooleanFlag(explicit);
  }

  const nodeEnv = resolveEnv(env, 'NODE_ENV');
  if (nodeEnv && nodeEnv.toLowerCase() !== 'production') {
    return true;
  }

  const mode = resolveEnv(env, 'MODE');
  if (mode && mode.toLowerCase() !== 'production') {
    return true;
  }

  return false;
}
