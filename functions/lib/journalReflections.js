/**
 * Journal reflections (spec §7.3).
 *
 * Reflections live in journal_entries.reflections_json as a flat string map,
 * exactly as the app writes them. A card note is keyed by the card's index
 * ("0", "1", ...); a whole-reading note uses "Overall". The journal UI,
 * export and follow-up context all read that shape, so no other shape is
 * ever written.
 *
 * Contract rules:
 * - text is 1-2,000 characters, preserved verbatim;
 * - HTTP supports append/replace; MCP supports idempotent append only;
 * - a missing entry and another user's entry get the same 404.
 *
 * MCP retries are idempotent by the operation's identity (entry, target key,
 * exact text): a note already present anywhere on the target is not added
 * again. Writes use compare-and-swap on the previous JSON, so concurrent
 * appends can't lose each other.
 */

import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
import { getDeckAlias } from '../../shared/vision/deckAssets.js';
import { READING_REFLECTION_KEY } from '../../shared/journal/reflectionLabels.js';
import { safeJsonParse } from './utils.js';

export { READING_REFLECTION_KEY };
export const MAX_REFLECTION_LENGTH = 2000;
export const MAX_TARGET_REFLECTION_LENGTH = 20000;
// A failed compare-and-swap means another writer succeeded. Leave room for
// all ten card notes plus the whole-reading note to arrive concurrently.
export const MAX_WRITE_ATTEMPTS = 32;

const DEFAULT_DECK = 'rws-1909';
const NOTE_SEPARATOR = '\n\n';
const SCOPES = new Set(['card', 'reading']);

function isProvided(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeLabel(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

// "the star", "Star" and "The Star" all name the same card.
function normalizeCardName(value) {
  return normalizeLabel(value).replace(/^the\s+/, '');
}

// Journal cards carry `name`; tolerate the reading API's `card`.
function cardName(card) {
  return card?.name || card?.card || '';
}

function displayName(card) {
  return card?.displayName || cardName(card);
}

/**
 * The stored (canonical) name for a label as the reading showed it. Thoth
 * "Prince of Wands" is stored as "Knight of Wands"; deck aliases win over
 * RWS names, matching the reading pipeline's resolver.
 */
function storedNameFor(label, deckId) {
  if (typeof label !== 'string' || !label.trim()) return '';
  return canonicalizeCardName(label, deckId || DEFAULT_DECK) || label;
}

function summarizeCards(cards, deckId) {
  const showDeckLabels = Boolean(deckId) && deckId !== DEFAULT_DECK;
  return cards.map((card, index) => {
    const summary = { index, position: card?.position ?? null, name: (deckId ? cardName(card) : displayName(card)) || null };
    if (showDeckLabels) summary.label = getDeckAlias(card, deckId);
    return summary;
  });
}

/**
 * Resolve which card of the entry a card-scoped reflection belongs to.
 *
 * @param {Array<object>} cards - Entry cards, in spread order
 * @param {{ card?: string, position?: string, cardIndex?: number|string }} target - `card` is a deck label, including one returned in `reflection.card`
 * @param {{ deckId?: string|null }} [options] - The entry's deck
 * @returns {{ index: number } | { error: string }}
 */
export function resolveCardIndex(cards, { card, position, cardIndex } = {}, { deckId = null } = {}) {
  const wantedName = normalizeCardName(deckId ? storedNameFor(card, deckId) : card);
  const wantedPosition = normalizeLabel(position);
  // HTTP accepts all saved aliases and reports collisions as ambiguous. MCP
  // receives deck labels, so its explicit deck selects the canonical identity.
  const nameMatches = (candidate) => !wantedName || (deckId
    ? normalizeCardName(cardName(candidate)) === wantedName
    : [candidate?.name, candidate?.card, candidate?.displayName, candidate?.canonicalName]
      .some(name => normalizeCardName(name) === wantedName));
  const positionMatches = (candidate) => !wantedPosition || normalizeLabel(candidate?.position) === wantedPosition;
  const describe = (candidate) => `${cardName(candidate) || 'an unnamed card'} (${candidate?.position || 'no position'})`;

  if (isProvided(cardIndex)) {
    const index = Number(cardIndex);
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) {
      return { error: `cardIndex must be an integer between 0 and ${cards.length - 1}` };
    }
    const candidate = cards[index];
    if (!nameMatches(candidate) || !positionMatches(candidate)) {
      return { error: `The card at index ${index} is ${describe(candidate)}, not ${card || position}` };
    }
    return { index };
  }

  if (!wantedName && !wantedPosition) {
    return { error: 'A card-scoped reflection needs card, position, or cardIndex' };
  }

  const matches = cards
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => nameMatches(candidate) && positionMatches(candidate));

  if (matches.length === 1) return { index: matches[0].index };
  if (matches.length > 1) {
    return { error: `${card} appears more than once in this entry; specify position or cardIndex` };
  }

  // Nothing satisfied both constraints; say which one failed.
  if (wantedName && wantedPosition) {
    const byName = cards.find(nameMatches);
    return byName
      ? { error: `${card} is in the ${byName.position} position of this entry, not ${position}` }
      : { error: `${card} is not in this entry` };
  }
  return wantedName
    ? { error: `${card} is not in this entry` }
    : { error: `No card in this entry is in the ${position} position` };
}

/**
 * Whether `text` is already one of the notes on a target. The stored value
 * is its notes joined by a blank line, so this matches whole notes (or runs
 * of whole paragraphs), not substrings.
 */
export function noteIsPresent(stored, text) {
  if (!stored || !text) return false;
  return `${NOTE_SEPARATOR}${stored}${NOTE_SEPARATOR}`.includes(`${NOTE_SEPARATOR}${text}${NOTE_SEPARATOR}`);
}

function parseReflections(json) {
  const parsed = safeJsonParse(json, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
}

function successBody(entryId, key, target, text, reflections, extra = {}, policy = 'mcp') {
  return {
    success: true,
    ...(policy === 'http' ? { entry: { id: entryId } } : { entryId, key }),
    reflection: { key, ...target, text },
    reflections,
    ...extra
  };
}

/**
 * Write a reflection to one of the user's entries under the caller's policy.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.DB is required
 * @param {object} params.user - Authenticated, journal-entitled user
 * @param {string} params.entryId
 * @param {object} params.input - { text, scope?, card?, position?, cardIndex? }
 * @param {'http'|'mcp'} [params.policy] - Internal caller policy, never request JSON
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function addJournalReflection({ env, user, entryId, input, policy = 'mcp' }) {
  const isHttp = policy === 'http';
  if (!entryId) return { status: 400, body: { error: 'Entry ID is required' } };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { status: 400, body: { error: 'Invalid reflection payload' } };
  }
  if (!isHttp && isProvided(input.mode)) {
    return { status: 400, body: { error: 'Reflections are append-only; mode is not supported' } };
  }

  const text = typeof input.text === 'string' ? input.text : '';
  if (!text.trim()) return { status: 400, body: { error: 'Reflection text is required' } };
  if (text.length > MAX_REFLECTION_LENGTH) {
    return {
      status: 400,
      body: {
        error: `Reflection text must be ${MAX_REFLECTION_LENGTH} characters or fewer`,
        maxLength: MAX_REFLECTION_LENGTH
      }
    };
  }

  const namesCard = ['card', 'position', 'cardIndex'].some((field) => isProvided(input[field]));
  const scope = isProvided(input.scope) ? input.scope : (namesCard ? 'card' : 'reading');
  if (!SCOPES.has(scope)) return { status: 400, body: { error: 'scope must be "card" or "reading"' } };

  const mode = isHttp && isProvided(input.mode) ? input.mode : 'append';
  if (mode !== 'append' && mode !== 'replace') {
    return { status: 400, body: { error: 'mode must be "append" or "replace"' } };
  }

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    // Scoped to the user: another user's entry is indistinguishable from none.
    const entry = await env.DB.prepare(
      'SELECT id, user_id, cards_json, reflections_json, deck_id FROM journal_entries WHERE id = ? AND user_id = ?'
    ).bind(entryId, user.id).first();
    if (!entry || entry.user_id !== user.id) return { status: 404, body: { error: 'Entry not found' } };

    const parsedCards = safeJsonParse(entry.cards_json, []);
    const cards = Array.isArray(parsedCards) ? parsedCards : [];

    let key = READING_REFLECTION_KEY;
    let target = { scope: 'reading' };
    if (scope === 'card') {
      const deckId = isHttp ? null : entry.deck_id || DEFAULT_DECK;
      const resolved = resolveCardIndex(cards, input, { deckId });
      if (resolved.error) {
        return { status: 400, body: { error: resolved.error, cards: summarizeCards(cards, deckId) } };
      }
      const card = cards[resolved.index];
      const canonicalName = cardName(card);
      key = String(resolved.index);
      // The input resolver treats card names as deck labels. Return that same
      // label so a caller can retry using reflection.card without changing cards.
      target = {
        scope: 'card', cardIndex: resolved.index,
        card: isHttp ? displayName(card) || null : canonicalName
          ? getDeckAlias({ ...card, name: canonicalName }, entry.deck_id || DEFAULT_DECK)
          : null,
        position: card?.position ?? null
      };
    }

    const reflections = parseReflections(entry.reflections_json);
    const existing = typeof reflections[key] === 'string' ? reflections[key] : '';
    if (!isHttp && noteIsPresent(existing, text)) {
      return { status: 200, body: successBody(entryId, key, target, existing, reflections, { alreadyPresent: true }) };
    }

    const value = mode === 'append' && existing ? `${existing}${NOTE_SEPARATOR}${text}` : text;
    if (!isHttp && value.length > MAX_TARGET_REFLECTION_LENGTH) {
      return { status: 400, body: { error: 'This reflection is full', maxLength: MAX_TARGET_REFLECTION_LENGTH } };
    }
    reflections[key] = value;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = await env.DB.prepare(
      'UPDATE journal_entries SET reflections_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND reflections_json IS ?'
    ).bind(JSON.stringify(reflections), nowSeconds, entryId, user.id, entry.reflections_json ?? null).run();

    if ((result?.meta?.changes ?? 0) === 1) {
      return { status: 200, body: successBody(entryId, key, target, value, reflections, {}, policy) };
    }
    // Someone else changed the entry since it was read: re-read and retry.
  }

  return {
    status: 409,
    body: isHttp
      ? { error: 'Entry changed concurrently; reflection was not appended', code: 'reflection_conflict' }
      : { error: 'The entry changed while saving. Please retry.' }
  };
}
