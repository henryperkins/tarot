import { generateFallbackWaveform } from '../../shared/fallbackAudio.js';

/**
 * Cloudflare Pages Function that provides text-to-speech audio as a data URI or streaming response.
 *
 * Enhanced with gpt-4o-mini-tts steerable instructions for context-aware,
 * mystical tarot reading narration.
 *
 * Supports:
 * - Context-specific instruction templates (card-reveal, full-reading, synthesis)
 * - Voice selection (nova, shimmer, alloy, echo, fable, onyx)
 * - Speed control for contemplative pacing (0.25-4.0, default 1.1)
 * - Streaming mode for real-time audio playback
 * - Graceful fallback to local waveform
 *
 * Usage:
 *
 * Non-streaming mode (returns JSON with base64 data URI):
 *   POST /api/tts
 *   Body: { "text": "...", "context": "full-reading", "voice": "nova", "speed": 0.9 }
 *   Response: { "audio": "data:audio/mp3;base64,...", "provider": "azure-gpt-4o-mini-tts" }
 *
 * Streaming mode (returns audio stream):
 *   POST /api/tts?stream=true
 *   Body: { "text": "...", "context": "full-reading", "voice": "nova", "speed": 0.9 }
 *   Response: audio/mp3 stream (content-type: audio/mp3, transfer-encoding: chunked)
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

export const onRequestPost = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const stream = url.searchParams.get('stream') === 'true';

    const { text, context, voice, speed } = await readJson(request);
    const sanitizedText = sanitizeText(text);

    if (!sanitizedText) {
      return jsonResponse(
        { error: 'The "text" field is required.' },
        { status: 400 }
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
      useV1Format: resolveEnv(env, 'AZURE_OPENAI_USE_V1_FORMAT')
    };

    if (azureConfig.endpoint && azureConfig.apiKey && azureConfig.deployment) {
      try {
        if (stream) {
          // Return streaming response
          return await generateWithAzureGptMiniTTSStream(azureConfig, {
            text: sanitizedText,
            context: context || 'default',
            voice: voice || 'nova',
            speed: speed
          });
        } else {
          // Return complete audio as data URI
          const audio = await generateWithAzureGptMiniTTS(azureConfig, {
            text: sanitizedText,
            context: context || 'default',
            voice: voice || 'nova',
            speed: speed
          });
          if (audio) {
            return jsonResponse({ audio, provider: 'azure-gpt-4o-mini-tts' });
          }
        }
      } catch (error) {
        console.error('Azure OpenAI gpt-4o-mini-tts failed, falling back to local waveform:', error);
      }
    }

    // Fallback: local synthesized waveform (no external dependency).
    const fallbackAudio = generateFallbackWaveform(sanitizedText);

    if (stream) {
      // For streaming requests, return the fallback as a single-chunk stream
      return new Response(fallbackAudio.split(',')[1], {
        headers: {
          'content-type': 'audio/wav',
          'transfer-encoding': 'chunked'
        }
      });
    }

    return jsonResponse({ audio: fallbackAudio, provider: 'fallback' });
  } catch (error) {
    console.error('tts function error:', error);
    return jsonResponse(
      { error: 'Unable to generate audio at this time.' },
      { status: 500 }
    );
  }
};

async function readJson(request) {
  if (request.headers.get('content-length') === '0') {
    return {};
  }

  const text = await request.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON payload.');
  }
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, 4000); // Increased for full readings; gpt-4o-mini-tts handles longer text well
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
 * Enhanced Azure OpenAI TTS generation with optional steerable instructions.
 *
 * For steerable-capable models (e.g. gpt-4o-mini-tts, audio-preview variants), includes
 * context-aware instructions. For standard models (tts-1, tts-1-hd), omits unsupported fields.
 * This keeps behavior model-agnostic while preserving rich narration when available.
 *
 * API Reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference-preview-latest#create-speech
 */
async function generateWithAzureGptMiniTTS(env, { text, context, voice, speed }) {
  // Azure OpenAI TTS endpoint structure (two formats supported):
  // Format 1 (v1, preferred): POST {endpoint}/openai/v1/audio/speech?api-version=preview
  // Format 2 (deployment-specific): POST {endpoint}/openai/deployments/{deployment}/audio/speech?api-version={version}
  //
  // Required env vars:
  // - AZURE_OPENAI_TTS_ENDPOINT (or AZURE_OPENAI_ENDPOINT): https://YOUR-RESOURCE.openai.azure.com
  // - AZURE_OPENAI_TTS_API_KEY (or AZURE_OPENAI_API_KEY): API key for the Azure OpenAI resource
  // - AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT: deployment name (e.g., "gpt-audio-mini")
  // - AZURE_OPENAI_API_VERSION: optional, defaults based on format
  // - AZURE_OPENAI_USE_V1_FORMAT: optional, set to "true" to use v1 format (default: false)
  //
  // Note: TTS-specific credentials (AZURE_OPENAI_TTS_*) take precedence, falling back to shared credentials
  //
  // API Reference: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/reference-preview-latest#create-speech
  //
  // Returns audio as base64 data URI.

  const endpoint = env.endpoint.replace(/\/+$/, '');
  const deployment = env.deployment;
  const format = env.format || 'mp3';
  const useV1Format = env.useV1Format === 'true' || env.useV1Format === true;

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
  // Per official docs: input, instructions (optional), model, response_format, speed, stream_format, voice
  // Content-Type is documented as multipart/form-data, but JSON works and is shown in examples
  const payload = {
    input: text,           // Required: text to synthesize (max 4096 chars)
    model: deployment,     // Required: deployment/model identifier
    voice: selectedVoice,  // Required: voice selection
    response_format: format, // Optional: audio format (mp3, wav, opus, flac, etc.)
    speed: selectedSpeed   // Optional: playback speed (0.25-4.0, default 1.0)
  };

  // Check if this deployment supports steerable instructions
  // gpt-4o-mini-tts and similar models support instructions
  // tts-1 and tts-1-hd do NOT support instructions (per API docs)
  const isSteerableModel = deployment.toLowerCase().includes('gpt-4o') ||
                          deployment.toLowerCase().includes('mini-tts') ||
                          deployment.toLowerCase().includes('audio-preview');

  if (isSteerableModel) {
    // KEY FEATURE: Steerable tone and delivery (gpt-4o-mini-tts only)
    // Per API docs: "Does not work with tts-1 or tts-1-hd"
    payload.instructions = instructions;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': env.apiKey,
      'content-type': 'application/json'  // JSON works despite docs saying multipart/form-data
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure TTS error ${response.status}: ${errText}`);
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
  const endpoint = env.endpoint.replace(/\/+$/, '');
  const deployment = env.deployment;
  const format = env.format || 'mp3';
  const useV1Format = env.useV1Format === 'true' || env.useV1Format === true;

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

  // Build payload with streaming enabled
  // Per API docs: stream_format can be 'sse' or 'audio'
  // Note: 'sse' is not supported for tts-1 or tts-1-hd models
  const payload = {
    input: text,
    model: deployment,
    voice: selectedVoice,
    response_format: format,
    speed: selectedSpeed,
    stream_format: 'audio' // Stream raw audio chunks (safer, works with all models)
  };

  // Check if this deployment supports steerable instructions
  const isSteerableModel = deployment.toLowerCase().includes('gpt-4o') ||
                          deployment.toLowerCase().includes('mini-tts') ||
                          deployment.toLowerCase().includes('audio-preview');

  if (isSteerableModel) {
    payload.instructions = instructions;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': env.apiKey,
      'content-type': 'application/json'  // JSON works despite docs saying multipart/form-data
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure TTS streaming error ${response.status}: ${errText}`);
  }

  // Return the streaming response directly
  // The response body is a ReadableStream of audio chunks
  const mime = format === 'wav' ? 'audio/wav' : `audio/${format}`;
  return new Response(response.body, {
    headers: {
      'content-type': mime,
      'transfer-encoding': 'chunked',
      'cache-control': 'no-cache'
    }
  });
}


function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {})
    }
  });
}

function resolveEnv(env, key) {
  if (env && typeof env[key] !== 'undefined' && env[key] !== null) {
    return env[key];
  }

  if (typeof process !== 'undefined' && process.env && typeof process.env[key] !== 'undefined') {
    return process.env[key];
  }

  return undefined;
}
