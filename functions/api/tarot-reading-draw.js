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
 * The shuffle and spread-position zip live in functions/lib/serverDraw.js,
 * which the MCP draw tool shares.
 */

import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { onRequestPost as tarotReadingHandler } from './tarot-reading.js';
import { drawForSpread } from '../lib/serverDraw.js';

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

  const drawn = drawForSpread(payload);
  if (!drawn.ok) {
    return jsonResponse({ error: drawn.error }, { status: drawn.status });
  }
  const { spreadKey, spreadInfo: drawnSpreadInfo, cardsInfo, seed } = drawn;

  // Forward to /api/tarot-reading with the populated cardsInfo. The existing
  // handler runs the entire pipeline (auth, rate limit, subscription gate,
  // schema validation, AI narrative, eval, journal) on this synthesized
  // payload, so we don't duplicate any of it here.
  const forwardedPayload = {
    ...payload,
    spreadInfo: { ...payload.spreadInfo, key: spreadKey, name: drawnSpreadInfo.name },
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

  // The crisis gate replaces the reading with support resources. Attaching the
  // drawn cards would invite a caller to present or save a card reading anyway.
  if (innerBody?.gateReason === 'crisis_gate') {
    return jsonResponse(innerBody, { status: innerResponse.status });
  }

  const augmented = {
    ...innerBody,
    cardsInfo,
    spreadInfo: drawnSpreadInfo,
    seed
  };

  return jsonResponse(augmented, { status: innerResponse.status });
};
