/**
 * Server-side draw for a known spread, shared by POST /api/tarot-reading/draw
 * and the MCP draw_tarot_reading tool (spec §6.1).
 *
 * lib/ boundary note: imports src/lib/deck.js and src/data/spreads.js. Both
 * are environment-agnostic (pure data, plus a seeded shuffle that never
 * touches window); this is the same narrow exception the draw route already
 * made.
 */

import { drawSpread } from '../../src/lib/deck.js';
import { SPREADS } from '../../src/data/spreads.js';
import { getSpreadDefinition } from './readingQuality.js';
import { hashString } from '../../shared/utils.js';
import { buildReadingRequestCard } from '../../shared/contracts/readingRequestCards.js';

/**
 * Resolve the canonical spread key from a payload's spreadInfo.
 * Tries `spreadInfo.key` first, then `spreadInfo.name`, then the shared
 * alias map (`getSpreadDefinition`).
 */
export function resolveSpreadKey(spreadInfo) {
  if (!spreadInfo) return null;

  const rawKey = typeof spreadInfo.key === 'string' ? spreadInfo.key.trim() : '';
  if (rawKey && SPREADS[rawKey]) return rawKey;

  const def =
    getSpreadDefinition(spreadInfo.name) ||
    (rawKey ? getSpreadDefinition(rawKey) : null);

  if (def?.key && SPREADS[def.key]) return def.key;
  return null;
}

/** 32-bit unsigned seed from the Workers WebCrypto API. */
function generateRandomSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] >>> 0) || 0x9e3779b9;
}

/**
 * Coerce a caller-supplied seed (number or string) into the 32-bit unsigned
 * integer that `drawSpread`'s seeded path expects. Preserve the existing
 * /api behavior: every nonempty string, including decimal text, is hashed.
 * The MCP tool converts returned decimal replay seeds to numbers before
 * calling this helper (Task 12). Falls back to a fresh crypto-random seed
 * when nothing usable is provided.
 */
export function coerceSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return (input >>> 0) || 0x9e3779b9;
  }
  if (typeof input === 'string' && input.trim()) {
    return (hashString(input.trim()) >>> 0) || 0x9e3779b9;
  }
  return generateRandomSeed();
}

/**
 * Draw cards for the requested spread.
 *
 * @param {object} payload - { spreadInfo, seed?, allowReversals?, includeMinors?, deckStyle? }
 */
export function drawForSpread(payload) {
  const spreadInfo = payload?.spreadInfo;
  if (!spreadInfo || typeof spreadInfo.name !== 'string' || !spreadInfo.name.trim()) {
    return { ok: false, status: 400, error: 'Missing spread information.' };
  }

  if (spreadInfo.key === 'custom') {
    return {
      ok: false,
      status: 400,
      error: 'Custom spreads cannot be drawn server-side; supply cardsInfo via createTarotReading instead.'
    };
  }

  const spreadKey = resolveSpreadKey(spreadInfo);
  if (!spreadKey) {
    return {
      ok: false,
      status: 400,
      error: `Unknown spread "${spreadInfo.name}". Provide a known spread.key (single, threeCard, fiveCard, decision, relationship, celtic) or display name.`
    };
  }

  const spread = SPREADS[spreadKey];
  const positions = Array.isArray(spread?.positions) ? spread.positions : null;
  if (!positions || positions.length === 0) {
    return { ok: false, status: 500, error: `Spread "${spreadKey}" has no position labels available.` };
  }

  // Defaults: full 78-card pool, reversals allowed. Both are caller-overridable.
  const allowReversals = payload?.allowReversals !== false;
  const includeMinors = payload?.includeMinors !== false;
  const seed = coerceSeed(payload?.seed);

  let drawn;
  try {
    drawn = drawSpread({ spreadKey, useSeed: true, seed, includeMinors });
  } catch (error) {
    return { ok: false, status: 422, error: error?.message || 'Failed to draw cards.' };
  }

  if (!allowReversals) {
    drawn = drawn.map((card) => ({ ...card, isReversed: false }));
  }

  if (drawn.length > positions.length) {
    return {
      ok: false,
      status: 500,
      error: `Drew ${drawn.length} cards but spread "${spreadKey}" defines only ${positions.length} positions.`
    };
  }

  const requestDeckStyle = typeof payload?.deckStyle === 'string' ? payload.deckStyle.trim() : '';
  const spreadDeckStyle = typeof spreadInfo.deckStyle === 'string' ? spreadInfo.deckStyle.trim() : '';
  const deckStyle = requestDeckStyle || spreadDeckStyle || 'rws-1909';
  const cardsInfo = drawn.map((card, i) => buildReadingRequestCard(card, {
    deckStyle,
    position: positions[i]
  }));

  return {
    ok: true,
    spreadKey,
    spreadInfo: { key: spreadKey, name: spread.name },
    cardsInfo,
    seed,
    deckStyle
  };
}
