import { jsonResponse, sanitizeText } from '../lib/utils.js';
import { getUserFromRequest } from '../lib/auth.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { getTtsLimits, reserveNarration, settleNarration, releaseNarration, MAX_NARRATION_CHARS, NARRATION_DEADLINE_MS } from '../lib/ttsLimits.js';
import { NARRATION_PROVIDERS, isServerNarrationProvider } from '../../shared/narrationProviders.js';

const TTS_MODEL = '@cf/deepgram/aura-2-en';
const TTS_PROVIDER = 'workers-ai-aura-2';
const TTS_SPEAKER = 'cora';
const ELEVENLABS_MODEL = 'eleven_v4';
const ELEVENLABS_VOICE = 'EXAVITQu4vr4xnSDxMaL'; // Sarah
const MAX_PIECE_CHARS = 1900;
const MAX_REQUEST_BYTES = 512 * 1024;
// Diagnostic heuristics for normally completed MP3 pieces that may be truncated.
const TYPICAL_BYTES_PER_CHAR = 390;
const MIN_BYTES_PER_CHAR = 250;
const MIN_CHECKED_CHARS = 100;

function getNarrationProvider(env, requestedProvider) {
  const apiKey = typeof env?.ELEVENLABS_API_KEY === 'string' ? env.ELEVENLABS_API_KEY.trim() : '';
  const providerId = requestedProvider || (apiKey ? 'elevenlabs' : 'deepgram');
  if (providerId === 'elevenlabs') {
    if (!apiKey) return null;
    const model = env.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_MODEL;
    const voice = env.ELEVENLABS_VOICE_ID?.trim() || ELEVENLABS_VOICE;
    return {
      id: 'elevenlabs', model, voice,
      async synthesize(text, { signal, previousText, nextText }) {
        // Native Worker fetch keeps credentials server-side and permits aborting
        // both headers and audio bodies. Never retry a paid synthesis request.
        let response;
        try {
          response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`, {
            method: 'POST',
            headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
            body: JSON.stringify({
              text, model_id: model,
              ...(previousText ? { previous_text: previousText } : {}),
              ...(nextText ? { next_text: nextText } : {})
            }),
            signal
          });
        } catch {
          throw new Error('Narration provider unavailable');
        }
        const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
        if (!response.ok || !response.body || !['audio/mpeg', 'audio/mp3'].includes(contentType)) {
          try { void response.body?.cancel().catch(() => {}); } catch { /* Best effort. */ }
          // Upstream error bodies can include private reading text. Discard them.
          throw new Error('Narration provider returned no audio');
        }
        return response.body;
      }
    };
  }
  return env?.AI?.run ? {
    id: TTS_PROVIDER, model: TTS_MODEL, voice: TTS_SPEAKER,
    synthesize: text => env.AI.run(TTS_MODEL, { text, speaker: TTS_SPEAKER })
  } : null;
}

/** One request is one narration, up to 64,000 characters, never silently cut.
 * Full readings stream ordered MP3 pieces; failed or cancelled synthesis does
 * not consume the monthly narration allowance. No local tone replaces speech.
 */
export const onRequestGet = async ({ env }) => {
  const provider = getNarrationProvider(env);
  return jsonResponse({
    status: 'ok', provider: provider?.id || 'unavailable',
    model: provider?.model || TTS_MODEL, voice: provider?.voice || TTS_SPEAKER,
    providers: NARRATION_PROVIDERS.map(({ id }) => {
      const configured = getNarrationProvider(env, id);
      return {
        id, available: Boolean(configured),
        model: configured?.model || (id === 'elevenlabs' ? env?.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_MODEL : TTS_MODEL),
        voice: configured?.voice || (id === 'elevenlabs' ? env?.ELEVENLABS_VOICE_ID?.trim() || ELEVENLABS_VOICE : TTS_SPEAKER)
      };
    }),
    format: 'mp3', maxCharacters: MAX_NARRATION_CHARS,
    timestamp: new Date().toISOString()
  });
};

async function readNarrationBody(request) {
  if (Number(request.headers?.get('content-length')) > MAX_REQUEST_BYTES) {
    throw Object.assign(new Error('Narration request is too large.'), { status: 413 });
  }
  let text;
  if (request.body?.getReader) {
    const reader = request.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.byteLength;
        if (bytes > MAX_REQUEST_BYTES) {
          await reader.cancel();
          throw Object.assign(new Error('Narration request is too large.'), { status: 413 });
        }
        chunks.push(result.value);
      }
    } finally { reader.releaseLock(); }
    const decoder = new TextDecoder();
    text = chunks.map(chunk => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
  } else {
    text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      throw Object.assign(new Error('Narration request is too large.'), { status: 413 });
    }
  }
  try { return JSON.parse(text || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON payload.'), { status: 400 }); }
}

export const onRequestPost = async ({ request, env }) => {
  let reservation;
  try {
    const body = await readNarrationBody(request);
    if (typeof body.text === 'string' && body.text.length > MAX_NARRATION_CHARS) {
      return jsonResponse({ error: `Narration can contain up to ${MAX_NARRATION_CHARS.toLocaleString('en-US')} characters.`, errorCode: 'NARRATION_TOO_LONG' }, { status: 413 });
    }
    const text = sanitizeText(body.text, { collapseWhitespace: false });
    if (!text) return jsonResponse({ error: 'The "text" field is required.' }, { status: 400 });
    if (Object.hasOwn(body, 'provider') && !isServerNarrationProvider(body.provider)) {
      return jsonResponse({ error: 'Choose ElevenLabs or Deepgram for narration.', errorCode: 'INVALID_NARRATION_PROVIDER' }, { status: 400 });
    }
    const provider = getNarrationProvider(env, body.provider);
    if (!provider) return jsonResponse({ error: 'Narration is temporarily unavailable. Please try again.', errorCode: 'SERVICE_UNAVAILABLE', retryable: true }, { status: 503 });
    const user = await getUserFromRequest(request, env);
    if (user?.auth_provider === 'api_key') {
      const apiLimit = await enforceApiCallLimit(env, user);
      if (!apiLimit.allowed) return jsonResponse(apiLimit.payload, { status: apiLimit.status });
    }
    const subscription = getSubscriptionContext(user);
    const accounting = await reserveNarration({ env, request, user, limits: getTtsLimits(subscription.effectiveTier) });
    if (!accounting.allowed) {
      return jsonResponse({ ...accounting.payload, currentTier: subscription.tier }, { status: accounting.status, headers: accounting.retryAfter ? { 'retry-after': String(accounting.retryAfter) } : {} });
    }
    reservation = accounting.reservation;
    const audio = await createNarrationStream(env, request, text, reservation, provider);
    if (new URL(request.url).searchParams.get('stream') === 'true') {
      return new Response(audio, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'x-tts-provider': provider.id } });
    }
    const bytes = new Uint8Array(await new Response(audio).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return jsonResponse({ audio: `data:audio/mpeg;base64,${btoa(binary)}`, provider: provider.id });
  } catch (error) {
    await releaseNarration(env, reservation).catch(() => {});
    return jsonResponse({ error: error.status ? error.message : 'Narration could not finish. Please try again.', errorCode: error.status === 413 ? 'NARRATION_TOO_LONG' : 'NARRATION_UNAVAILABLE', retryable: !error.status }, { status: error.status || 503 });
  }
};

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


async function createNarrationStream(env, request, text, reservation, provider) {
  const pieces = splitForSpeech(text);
  const upstream = new AbortController();
  let activeReader;
  let cancelled = false;
  let finished = false;
  let rejectDeadline;
  const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
  // An already-aborted caller can reject before the first race is installed.
  deadline.catch(() => {});
  const cancelReader = reader => {
    try { void reader?.cancel?.().catch(() => {}); }
    catch { /* Provider cancellation is best effort and must not block refunds. */ }
  };
  // Every run/body read races the same bounded deadline. Workers AI bindings
  // do not guarantee cancellation before a response exists; cancel late bodies
  // and never retry an outstanding inference.
  const timer = setTimeout(() => {
    cancelled = true;
    rejectDeadline(new Error('Narration timed out'));
    upstream.abort();
    cancelReader(activeReader);
  }, NARRATION_DEADLINE_MS);
  const abort = () => {
    cancelled = true;
    rejectDeadline(new Error('Narration cancelled'));
    upstream.abort();
    cancelReader(activeReader);
  };
  request.signal?.addEventListener('abort', abort, { once: true });
  if (request.signal?.aborted) abort();
  const cleanup = () => {
    clearTimeout(timer);
    request.signal?.removeEventListener('abort', abort);
  };
  const runPiece = async index => {
    if (cancelled || request.signal?.aborted) throw new Error('Narration cancelled');
    const pending = Promise.resolve().then(() => {
      if (cancelled || request.signal?.aborted) throw new Error('Narration cancelled');
      return provider.synthesize(pieces[index], {
        signal: upstream.signal,
        previousText: pieces[index - 1]?.slice(-500),
        nextText: pieces[index + 1]?.slice(0, 500)
      });
    });
    pending.then(stream => { if (cancelled) cancelReader(stream); }, () => {});
    const stream = await Promise.race([pending, deadline]);
    if (!stream?.getReader) throw new Error('Narration provider returned no audio');
    return stream;
  };
  let first;
  try { first = await runPiece(0); }
  catch (error) { cancelled = true; upstream.abort(); cleanup(); throw error; }

  return new ReadableStream({
    async start(controller) {
      try {
        for (const [index, piece] of pieces.entries()) {
          const source = index === 0 ? first : await runPiece(index);
          activeReader = source.getReader();
          let bytes = 0;
          try {
            for (;;) {
              const { value, done } = await Promise.race([activeReader.read(), deadline]);
              if (done) break;
              bytes += value.byteLength;
              controller.enqueue(value);
            }
          } catch (error) {
            cancelReader(activeReader);
            throw error;
          } finally { activeReader.releaseLock(); activeReader = null; }
          if (!bytes) throw new Error('Narration provider returned empty audio');
          if (cancelled) throw new Error('Narration cancelled');
          if (provider.id === TTS_PROVIDER && piece.length >= MIN_CHECKED_CHARS && bytes < piece.length * MIN_BYTES_PER_CHAR) {
            console.warn(`[tts] Aura-2 piece ${index + 1}/${pieces.length} returned ${bytes} bytes ` +
              `for ${piece.length} characters (usually about ${piece.length * TYPICAL_BYTES_PER_CHAR})`);
          }
        }
        await settleNarration(env, reservation);
        finished = true;
        controller.close();
      } catch (error) {
        cancelled = true;
        upstream.abort();
        cancelReader(activeReader);
        await releaseNarration(env, reservation).catch(() => {});
        try { controller.error(error); } catch { /* Consumer already cancelled. */ }
      } finally { cleanup(); }
    },
    async cancel() {
      if (finished) return;
      abort();
      cleanup();
      await releaseNarration(env, reservation);
    }
  });
}
