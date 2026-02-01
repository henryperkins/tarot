import { jsonResponse, readJsonBody, sanitizeText } from '../lib/utils.js';
import { generateFallbackWaveform } from '../../shared/fallbackAudio.js';
import { getUserFromRequest } from '../lib/auth.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { enforceTtsRateLimit, getTtsLimits } from '../lib/ttsLimits.js';
import { getActingInstructions, EMOTION_DESCRIPTIONS } from '../../src/data/emotionMapping.js';
import { resolveEnvStrict } from '../lib/environment.js';

/**
 * Cloudflare Pages Function that provides text-to-speech audio using Hume AI's Octave TTS.
 * 
 * Hume AI Octave TTS offers emotionally expressive voices with natural prosody and voice continuity.
 * Perfect for tarot readings where tone, emotion, and mystical atmosphere matter.
 *
 * Supports:
 * - Context-specific voice descriptions (mystical, contemplative, wise)
 * - Voice selection from Hume's preset library (Wise Wizard, Mysterious Woman, etc.)
 * - Custom voice design through natural language descriptions
 * - Speech continuity across multiple utterances via context.generationId
 * - Speed control and trailing silence
 *
 * API Documentation: https://dev.hume.ai/reference/text-to-speech-tts
 *
 * Usage:
 *
 * Basic request:
 *   POST /api/tts-hume
 *   Body: { "text": "...", "voiceName": "ITO" }
 *   Response: { "audio": "data:audio/mpeg;base64,...", "provider": "hume-ai", "generationId": "..." }
 *
 * Context-aware request with custom voice:
 *   POST /api/tts-hume
 *   Body: { 
 *     "text": "The Fool represents...", 
 *     "context": "card-reveal",
 *     "description": "a mystical, gentle voice with contemplative pacing"
 *   }
 *
 * Continued speech (maintains voice consistency):
 *   POST /api/tts-hume
 *   Body: { 
 *     "text": "Next, we see The Magician...", 
 *     "previousGenerationId": "generation-id-from-previous-call"
 *   }
 */

// Voice name mappings for different tarot reading contexts
const CONTEXT_VOICES = {
  'card-reveal': 'ITO',
  'full-reading': 'ITO',
  'synthesis': 'KORA',
  'question': 'STELLA',
  'reflection': 'DACHER',
  'default': 'ITO'
};

// Context-specific voice descriptions for acting instructions
const CONTEXT_DESCRIPTIONS = {
  'card-reveal': 'Speak gently and mystically, as a tarot reader revealing a card with reverence. Use a slightly slower pace with brief pauses. Convey wisdom and contemplation.',
  
  'full-reading': 'Speak as a wise, compassionate tarot reader sharing a complete reading. Use a thoughtful, contemplative tone with natural pauses. Allow space for reflection—speak slowly and deliberately. Convey mystical depth while remaining grounded and accessible.',
  
  'synthesis': 'Speak as a tarot reader weaving together the threads of a reading. Use a flowing, storytelling cadence that connects themes. Pause briefly between major insights. Convey both wisdom and warmth.',
  
  'question': 'Speak gently and clearly, acknowledging the question with respect. Use a warm, inviting tone that creates space for exploration.',
  
  'reflection': 'Speak softly and affirmingly, honoring personal reflections. Use a validating, supportive tone that acknowledges intuitive insights.',
  
  'default': 'Speak thoughtfully and gently, as a tarot reader sharing wisdom. Use a mystical yet grounded tone with natural pacing and slight pauses for contemplation.'
};

export const onRequestGet = async ({ env }) => {
  // Health check endpoint
  const hasHumeKey = !!resolveEnvStrict(env, 'HUME_API_KEY');
  return jsonResponse({
    status: 'ok',
    provider: hasHumeKey ? 'hume-ai' : 'unavailable',
    timestamp: new Date().toISOString()
  });
};

export const onRequestPost = async ({ request, env }) => {
  const requestId = crypto.randomUUID();
  try {
    const user = await getUserFromRequest(request, env);
    const subscription = getSubscriptionContext(user);
    const tier = subscription.tier;
    const effectiveTier = subscription.effectiveTier;
    const ttsLimits = getTtsLimits(effectiveTier);

    // API key usage is Pro-only and subject to API call limits.
    if (user?.auth_provider === 'api_key') {
      const apiLimit = await enforceApiCallLimit(env, user);
      if (!apiLimit.allowed) {
        return jsonResponse(apiLimit.payload, { status: apiLimit.status });
      }
    }

    const {
      text,
      context,
      voiceName,
      description,
      emotion,
      speed,
      previousGenerationId,
      trailingSilence
    } = await readJsonBody(request);

    const sanitizedText = sanitizeText(text, { maxLength: 5000, collapseWhitespace: false });

    if (!sanitizedText) {
      return jsonResponse(
        { error: 'The "text" field is required.' },
        { status: 400 }
      );
    }

    const rateLimitResult = await enforceTtsRateLimit(env, request, user, ttsLimits, requestId);
    if (rateLimitResult?.limited) {
      const errorCode = rateLimitResult.tierLimited ? 'TIER_LIMIT' : 'RATE_LIMIT';
      const errorMessage = rateLimitResult.tierLimited
        ? `You've reached your monthly TTS limit (${ttsLimits.monthly}). Upgrade to Plus or Pro for more.`
        : 'Too many text-to-speech requests. Please wait a few moments and try again.';

      return jsonResponse(
        {
          error: errorMessage,
          errorCode,
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

    const selectedVoiceName = voiceName ||
      (context && CONTEXT_VOICES[context]) ||
      CONTEXT_VOICES.default;

    // Check for Hume API key
    const humeApiKey = resolveEnvStrict(env, 'HUME_API_KEY');
    if (!humeApiKey) {
      return buildFallbackResponse(sanitizedText, selectedVoiceName, 'Hume AI is not configured.');
    }

    try {
      // Build the utterance object
      const utterance = {
        text: sanitizedText
      };

      // Add voice (use context-based voice if not provided)
      utterance.voice = {
        name: selectedVoiceName,
        provider: 'HUME_AI'
      };

      // Add voice description/acting instructions
      // Priority: custom description > emotion-based > context-based
      if (description) {
        utterance.description = description;
      } else if (emotion && EMOTION_DESCRIPTIONS[emotion]) {
        utterance.description = getActingInstructions(emotion);
      } else if (context && CONTEXT_DESCRIPTIONS[context]) {
        utterance.description = CONTEXT_DESCRIPTIONS[context];
      }

      // Add speed if provided (0.5-2.0 range)
      if (speed !== undefined) {
        utterance.speed = Math.max(0.5, Math.min(2.0, speed));
      }

      // Add trailing silence if provided (0-5 seconds) - API uses snake_case
      if (trailingSilence !== undefined) {
        const clamped = Math.max(0, Math.min(5, Number(trailingSilence)));
        utterance.trailing_silence = clamped;
      }

      // Build the TTS request payload - format is REQUIRED as an object
      const ttsPayload = {
        utterances: [utterance],
        format: { type: 'mp3' } // Required object: { type: 'mp3' | 'pcm' | 'wav' }
      };

      // Add continuation context if provided
      if (previousGenerationId) {
        ttsPayload.context = {
          generationId: previousGenerationId
        };
      }

      // Call Hume AI TTS API (non-streaming endpoint)
      // Endpoint: POST https://api.hume.ai/v0/tts
      const response = await fetch('https://api.hume.ai/v0/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hume-Api-Key': humeApiKey
        },
        body: JSON.stringify(ttsPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${requestId}] [tts-hume] API error:`, response.status, errorText);
        
        // Try to parse error message from Hume
        let errorMessage = `Hume TTS failed (${response.status})`;
        try {
          const errorBody = JSON.parse(errorText);
          errorMessage = errorBody.error ?? errorBody.message ?? errorMessage;
        } catch {
          // Keep default message if parsing fails
        }
        
        return buildFallbackResponse(sanitizedText, selectedVoiceName, errorMessage);
      }

      // Parse the response
      const result = await response.json();
      
      // Extract the first generation
      const generation = result.generations?.[0];
      if (!generation?.audio) {
        throw new Error('No audio generated in response');
      }

      // Extract generation ID correctly (may be in context or at top level)
      const generationId = generation.context?.generationId ?? generation.id ?? null;

      // The audio is already base64-encoded, create data URI (mp3 format)
      const dataUri = `data:audio/mpeg;base64,${generation.audio}`;

      return jsonResponse({ 
        audio: dataUri, 
        provider: 'hume-ai',
        generationId,
        voiceUsed: selectedVoiceName
      });

    } catch (error) {
      console.error(`[${requestId}] [tts-hume] Generation failed:`, error);
      return buildFallbackResponse(
        sanitizedText,
        selectedVoiceName,
        'Unable to generate audio with Hume AI at this time.'
      );
    }

  } catch (error) {
    console.error(`[${requestId}] [tts-hume] Function error:`, error);
    return jsonResponse(
      { error: 'Unable to process TTS request.' },
      { status: 500 }
    );
  }
};

// sanitizeText is now imported from ../lib/utils.js

function buildFallbackResponse(text, voiceUsed, warning) {
  const fallbackAudio = generateFallbackWaveform(text);
  return jsonResponse({
    audio: fallbackAudio,
    provider: 'fallback',
    generationId: null,
    voiceUsed: voiceUsed || CONTEXT_VOICES.default,
    warning
  });
}
