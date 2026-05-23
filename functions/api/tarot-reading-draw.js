/**
 * POST /api/tarot-reading/draw
 *
 * Draws cards on the backend for the requested spread and forwards the
 * fully-populated payload to the existing /api/tarot-reading handler.
 * Exposed in the OpenAPI Action schema as `drawTarotReading` so the
 * Tableu Custom GPT can call this when the user has NOT supplied cards.
 *
 * Reuses the standard pipeline (auth, subscription gate, rate limit,
 * AI narrative, eval, journal persistence) by delegating to
 * `tarot-reading.js`. The only new logic here is the shuffle + the
 * spread-position zip that produces `cardsInfo`.
 *
 * lib/ boundary note: this Worker handler imports from `src/lib/deck.js`
 * and `src/data/spreads.js`. CLAUDE.md normally discourages crossing
 * src/ → functions/, but those modules are environment-agnostic in
 * practice (pure data + a function whose seeded path doesn't touch
 * `window`). Treating this as a narrow exception; a follow-up should
 * move the deck/data modules into shared/ if we want to formalize it.
 */

import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { onRequestPost as tarotReadingHandler } from './tarot-reading.js';
import { drawSpread } from '../../src/lib/deck.js';
import { SPREADS } from '../../src/data/spreads.js';
import { getSpreadDefinition } from '../lib/readingQuality.js';
import { hashString } from '../../shared/utils.js';

/**
 * Resolve the canonical spread key from a payload's spreadInfo.
 * Tries `spreadInfo.key` first, then `spreadInfo.name`, then falls back
 * to the shared alias map (`getSpreadDefinition`).
 */
function resolveSpreadKey(spreadInfo) {
  if (!spreadInfo) return null;

  const rawKey = typeof spreadInfo.key === 'string' ? spreadInfo.key.trim() : '';
  if (rawKey && SPREADS[rawKey]) return rawKey;

  const def =
    getSpreadDefinition(spreadInfo.name) ||
    (rawKey ? getSpreadDefinition(rawKey) : null);

  if (def?.key && SPREADS[def.key]) return def.key;
  return null;
}

/**
 * Generate a 32-bit unsigned seed using the Workers WebCrypto API.
 */
function generateRandomSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] >>> 0) || 0x9e3779b9;
}

/**
 * Coerce caller-supplied seed (number or string) into the 32-bit
 * unsigned integer that `drawSpread`'s seeded path expects. Falls
 * back to a fresh crypto-random seed when nothing usable is provided.
 */
function coerceSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return (input >>> 0) || 0x9e3779b9;
  }
  if (typeof input === 'string' && input.trim()) {
    return (hashString(input.trim()) >>> 0) || 0x9e3779b9;
  }
  return generateRandomSeed();
}

export const onRequestPost = async (ctx) => {
  const { request } = ctx;

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    return jsonResponse(
      { error: error?.message || 'Invalid JSON payload.' },
      { status: 400 }
    );
  }

  const spreadInfo = payload?.spreadInfo;
  if (!spreadInfo || typeof spreadInfo.name !== 'string' || !spreadInfo.name.trim()) {
    return jsonResponse({ error: 'Missing spread information.' }, { status: 400 });
  }

  if (spreadInfo.key === 'custom') {
    return jsonResponse(
      { error: 'Custom spreads cannot be drawn server-side; supply cardsInfo via createTarotReading instead.' },
      { status: 400 }
    );
  }

  const spreadKey = resolveSpreadKey(spreadInfo);
  if (!spreadKey) {
    return jsonResponse(
      {
        error: `Unknown spread "${spreadInfo.name}". Provide a known spread.key (single, threeCard, fiveCard, decision, relationship, celtic) or display name.`
      },
      { status: 400 }
    );
  }

  const spread = SPREADS[spreadKey];
  const positions = Array.isArray(spread?.positions) ? spread.positions : null;
  if (!positions || positions.length === 0) {
    return jsonResponse(
      { error: `Spread "${spreadKey}" has no position labels available.` },
      { status: 500 }
    );
  }

  // Defaults: full 78-card pool, reversals allowed. Both are caller-overridable.
  const allowReversals = payload?.allowReversals !== false;
  const includeMinors = payload?.includeMinors !== false;
  const seed = coerceSeed(payload?.seed);

  let drawn;
  try {
    drawn = drawSpread({ spreadKey, useSeed: true, seed, includeMinors });
  } catch (error) {
    return jsonResponse(
      { error: error?.message || 'Failed to draw cards.' },
      { status: 422 }
    );
  }

  if (!allowReversals) {
    drawn = drawn.map((card) => ({ ...card, isReversed: false }));
  }

  if (drawn.length > positions.length) {
    return jsonResponse(
      { error: `Drew ${drawn.length} cards but spread "${spreadKey}" defines only ${positions.length} positions.` },
      { status: 500 }
    );
  }

  const cardsInfo = drawn.map((card, i) => ({
    position: positions[i],
    card: card.name,
    orientation: card.isReversed ? 'Reversed' : 'Upright',
    meaning: card.isReversed ? card.reversed : card.upright,
    number: typeof card.number === 'number' ? card.number : null,
    suit: card.suit || null,
    rank: card.rank || null,
    rankValue: typeof card.rankValue === 'number' ? card.rankValue : null
  }));

  // Forward to /api/tarot-reading with the populated cardsInfo. The existing
  // handler runs the entire pipeline (auth, rate limit, subscription gate,
  // schema validation, AI narrative, eval, journal) on this synthesized
  // payload, so we don't duplicate any of it here.
  const forwardedPayload = {
    ...payload,
    spreadInfo: { ...spreadInfo, key: spreadKey, name: spread.name },
    cardsInfo
  };

  const forwardedUrl = new URL(request.url);
  forwardedUrl.pathname = '/api/tarot-reading';
  // Draw endpoint is documented as sync; strip any SSE flag the caller sent.
  forwardedUrl.searchParams.delete('stream');

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete('content-length'); // body has changed
  forwardedHeaders.set('content-type', 'application/json');
  // Remove streaming Accept so the downstream handler returns JSON.
  if ((forwardedHeaders.get('accept') || '').includes('text/event-stream')) {
    forwardedHeaders.set('accept', 'application/json');
  }

  const forwardedRequest = new Request(forwardedUrl.toString(), {
    method: 'POST',
    headers: forwardedHeaders,
    body: JSON.stringify(forwardedPayload)
  });

  const innerResponse = await tarotReadingHandler({ ...ctx, request: forwardedRequest });

  const contentType = innerResponse.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Defensive fall-through: hand back whatever the inner handler returned
    // unmodified (errors, redirects, or any non-JSON edge case).
    return innerResponse;
  }

  let innerBody;
  try {
    innerBody = await innerResponse.json();
  } catch {
    return innerResponse;
  }

  const augmented = {
    ...innerBody,
    cardsInfo,
    spreadInfo: { key: spreadKey, name: spread.name },
    seed
  };

  return jsonResponse(augmented, { status: innerResponse.status });
};
