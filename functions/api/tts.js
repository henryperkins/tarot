import { generateFallbackWaveform } from '../../shared/fallbackAudio.js';
import { jsonResponse, readJsonBody, sanitizeText } from '../lib/utils.js';
import { getUserFromRequest } from '../lib/auth.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { getTtsLimits, enforceTtsRateLimit, NARRATION_UNIT_CHARS } from '../lib/ttsLimits.js';

const TTS_MODEL = '@cf/deepgram/aura-2-en';
const TTS_PROVIDER = 'workers-ai-aura-2';
// Deepgram describes Cora as smooth, melodic and caring, for storytelling.
const TTS_SPEAKER = 'cora';
// Deepgram takes at most 2,000 characters per request.
const MAX_PIECE_CHARS = 1900;

/**
 * Text-to-speech for readings with Deepgram Aura-2 on Workers AI.
 *
 * Aura-2 takes no speed, style or emotion instructions, so every reading uses
 * one speaker and the browser applies the listener's speed setting. Requests
 * may still carry `voice`, `speed`, `format`, `context` and `emotion`; they
 * are ignored. Audio is always MP3.
 *
 * Requests may also carry `narrationId`. Everything spoken for one reading
 * shares an id and counts as one narration per 4,096 characters, not one per
 * request (see enforceTtsRateLimit).
 *
 * Non-streaming mode (returns JSON with base64 data URI):
 *   POST /api/tts
 *   Body: { "text": "..." }
 *   Response: { "audio": "data:audio/mpeg;base64,...", "provider": "workers-ai-aura-2" }
 *
 * Streaming mode (returns the MP3 as it is generated):
 *   POST /api/tts?stream=true
 *   Body: { "text": "..." }
 *   Response: audio/mpeg stream; the x-tts-provider header names the provider
 *
 * If Workers AI fails before audio starts, both modes return a short local
 * waveform instead (provider "fallback").
 */
export const onRequestGet = async ({ env }) => {
  // Health check endpoint
  return jsonResponse({
    status: 'ok',
    provider: env?.AI?.run ? TTS_PROVIDER : 'local',
    model: TTS_MODEL,
    format: 'mp3',
    timestamp: new Date().toISOString()
  });
};

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
    const ttsLimits = getTtsLimits(effectiveTier);

    const { text, narrationId } = await readJsonBody(request);
    const sanitizedText = sanitizeText(text, { maxLength: NARRATION_UNIT_CHARS, collapseWhitespace: false });

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
    const rateLimitResult = await enforceTtsRateLimit(env, request, user, ttsLimits, requestId, {
      narrationId,
      chars: sanitizedText.length
    });
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

    if (env?.AI?.run) {
      try {
        const pieces = await startSpeech(env, sanitizedText);
        if (stream) {
          return new Response(joinStreams(pieces), {
            headers: {
              'content-type': 'audio/mpeg',
              'cache-control': 'no-cache',
              'x-tts-provider': TTS_PROVIDER
            }
          });
        }
        const bytes = await readPieces(pieces);
        // audio/mpeg, not audio/mp3: Safari rejects audio/mp3.
        return jsonResponse({ audio: `data:audio/mpeg;base64,${uint8ToBase64(bytes)}`, provider: TTS_PROVIDER });
      } catch (error) {
        console.error(`[${requestId}] [tts] Aura-2 failed, falling back to local waveform:`, error);
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
          'cache-control': 'no-cache',
          'x-tts-provider': 'fallback'
        }
      });
    }

    return jsonResponse({ audio: fallbackAudio, provider: 'fallback' });
  } catch (error) {
    // Return 400 for JSON parse errors (client mistake)
    if (error?.message === 'Invalid JSON payload.') {
      return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 });
    }
    console.error(`[${requestId}] [tts] Function error:`, error);
    return jsonResponse(
      { error: 'Unable to generate audio at this time.' },
      { status: 500 }
    );
  }
};

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
 * Split text into pieces Aura-2 accepts, breaking after a sentence where one
 * ends in the second half of a piece, otherwise between words.
 */
export function splitForSpeech(text) {
  const pieces = [];
  let rest = text.trim();
  while (rest.length > MAX_PIECE_CHARS) {
    const head = rest.slice(0, MAX_PIECE_CHARS);
    const sentenceEnd = Math.max(
      head.lastIndexOf('\n'),
      ...['. ', '! ', '? '].map((mark) => head.lastIndexOf(mark) + 1)
    );
    const wordEnd = head.lastIndexOf(' ');
    let cut = MAX_PIECE_CHARS;
    if (sentenceEnd > MAX_PIECE_CHARS / 2) {
      cut = sentenceEnd;
    } else if (wordEnd > 0) {
      cut = wordEnd;
    }
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

/**
 * Start Aura-2 on every piece at once and return promises for their MP3
 * streams, in order. Waits for the first piece to start so that a failure
 * there can still fall back to the local waveform.
 */
async function startSpeech(env, text) {
  const pieces = splitForSpeech(text).map((piece) =>
    env.AI.run(TTS_MODEL, { text: piece, speaker: TTS_SPEAKER })
  );
  // Later pieces are awaited after earlier ones. Without a handler now, one
  // that fails in the meantime counts as an unhandled rejection.
  pieces.forEach((piece) => piece.catch(() => {}));

  const first = await pieces[0];
  if (typeof first?.pipeTo !== 'function') {
    throw new Error('Aura-2 returned no audio stream');
  }
  return pieces;
}

/**
 * Play the pieces' MP3 streams back to back as one stream.
 */
function joinStreams(pieces) {
  const { readable, writable } = new TransformStream();
  const pipePieces = async () => {
    try {
      for (const piece of pieces) {
        await (await piece).pipeTo(writable, { preventClose: true });
      }
      await writable.close();
    } catch (error) {
      await writable.abort(error).catch(() => {});
    }
  };
  pipePieces();
  return readable;
}

/**
 * Read every piece at the same time and join the MP3 bytes in order.
 * Reading them one by one would make a long reading wait for each in turn.
 */
async function readPieces(pieces) {
  const parts = await Promise.all(
    pieces.map(async (piece) => new Uint8Array(await new Response(await piece).arrayBuffer()))
  );
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
