/**
 * Journal Reflections
 * POST /api/journal/[id]/reflections - Add a reflection to a saved journal entry
 *
 * Reflections live in `journal_entries.reflections_json` as a flat string map,
 * exactly as the app writes them: a card-scoped note is keyed by the card's
 * index in `cards_json` ("0", "1", ...), which is what the journal UI
 * (useEntryMetadata), the export, and follow-up context (followUpContext.js)
 * all read. A reading-scoped note uses the reserved key "Overall". Any other
 * shape (an array, nested objects) would save fine and then be silently
 * dropped by every consumer, so this handler never writes one.
 *
 * Callers — the Custom GPT in particular — name the card by `card` and/or
 * `position`, which is what they actually know. The index is resolved here
 * against the entry's own cards, which doubles as verification that the note
 * is about a card that is really in the spread.
 *
 * Auth goes through getUserFromRequest (session cookie, bearer session token,
 * `sk_` API key, or the GPT service token), unlike the sibling followups
 * route, which is cookie-only.
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { journalAccessDenied } from '../../lib/journalAccess.js';
import { safeJsonParse } from '../../lib/utils.js';

// Matches the app's own reflection inputs (Card.jsx / ReadingBoard.jsx maxLength).
export const MAX_REFLECTION_LENGTH = 500;
// Reserved key for a note about the reading as a whole; the UI renders the key as the label.
export const READING_REFLECTION_KEY = 'Overall';

const SCOPES = new Set(['card', 'reading']);
const MODES = new Set(['append', 'replace']);

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

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

// Journal cards carry `name`; tolerate the reading API's `card` for entries
// forwarded verbatim from cardsInfo.
function cardName(card) {
  return card?.name || card?.card || '';
}

function summarizeCards(cards) {
  return cards.map((card, index) => ({
    index,
    position: card?.position ?? null,
    name: cardName(card) || null
  }));
}

/**
 * Resolve which card of the entry a card-scoped reflection belongs to.
 *
 * @param {Array<object>} cards - Entry cards, in spread order
 * @param {{ card?: string, position?: string, cardIndex?: number|string }} target
 * @returns {{ index: number } | { error: string }}
 */
export function resolveCardIndex(cards, { card, position, cardIndex } = {}) {
  const wantedName = normalizeCardName(card);
  const wantedPosition = normalizeLabel(position);
  const nameMatches = (candidate) => !wantedName || normalizeCardName(cardName(candidate)) === wantedName;
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

  if (matches.length === 1) {
    return { index: matches[0].index };
  }
  if (matches.length > 1) {
    return { error: `${card} appears more than once in this entry; specify position or cardIndex` };
  }

  // Nothing satisfied both constraints; say which one failed.
  if (wantedName && wantedPosition) {
    const byName = cards.find(nameMatches);
    return byName
      ? { error: `${cardName(byName)} is in the ${byName.position} position of this entry, not ${position}` }
      : { error: `${card} is not in this entry` };
  }
  return wantedName
    ? { error: `${card} is not in this entry` }
    : { error: `No card in this entry is in the ${position} position` };
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const logRequestId = crypto.randomUUID();

  try {
    const user = await getUserFromRequest(request, env);
    const denied = journalAccessDenied(user);
    if (denied) return denied;

    const entryId = params?.id;
    if (!entryId) {
      return json({ error: 'Entry ID is required' }, 400);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid reflection payload' }, 400);
    }

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return json({ error: 'Reflection text is required' }, 400);
    }
    if (text.length > MAX_REFLECTION_LENGTH) {
      return json(
        {
          error: `Reflection text must be ${MAX_REFLECTION_LENGTH} characters or fewer`,
          maxLength: MAX_REFLECTION_LENGTH
        },
        400
      );
    }

    const namesCard = ['card', 'position', 'cardIndex'].some((field) => isProvided(body[field]));
    const scope = isProvided(body.scope) ? body.scope : (namesCard ? 'card' : 'reading');
    if (!SCOPES.has(scope)) {
      return json({ error: 'scope must be "card" or "reading"' }, 400);
    }

    const mode = isProvided(body.mode) ? body.mode : 'append';
    if (!MODES.has(mode)) {
      return json({ error: 'mode must be "append" or "replace"' }, 400);
    }

    // Verify ownership and load the cards the note must refer to.
    const entry = await env.DB.prepare(
      'SELECT id, user_id, cards_json, reflections_json FROM journal_entries WHERE id = ?'
    ).bind(entryId).first();

    if (!entry) {
      return json({ error: 'Entry not found' }, 404);
    }
    if (entry.user_id !== user.id) {
      return json({ error: 'Unauthorized to modify this entry' }, 403);
    }

    const parsedCards = safeJsonParse(entry.cards_json, []);
    const cards = Array.isArray(parsedCards) ? parsedCards : [];

    let key = READING_REFLECTION_KEY;
    let resolvedCard = null;
    if (scope === 'card') {
      const result = resolveCardIndex(cards, body);
      if (result.error) {
        // List the entry's cards so the caller can correct itself in one retry.
        return json({ error: result.error, cards: summarizeCards(cards) }, 400);
      }
      const card = cards[result.index];
      key = String(result.index);
      resolvedCard = {
        cardIndex: result.index,
        card: cardName(card) || null,
        position: card?.position ?? null
      };
    }

    const parsedReflections = safeJsonParse(entry.reflections_json, {});
    const reflections =
      parsedReflections && typeof parsedReflections === 'object' && !Array.isArray(parsedReflections)
        ? { ...parsedReflections }
        : {};

    const existing = typeof reflections[key] === 'string' ? reflections[key].trim() : '';
    const value = mode === 'append' && existing ? `${existing}\n\n${text}` : text;
    reflections[key] = value;

    const nowSeconds = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'UPDATE journal_entries SET reflections_json = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).bind(JSON.stringify(reflections), nowSeconds, entryId, user.id).run();

    return json(
      {
        success: true,
        entry: { id: entryId },
        reflection: { key, scope, ...(resolvedCard || {}), text: value },
        reflections
      },
      200
    );
  } catch (error) {
    console.error(`[${logRequestId}] [journal] Add reflection error:`, error);
    return json({ error: 'Internal server error' }, 500);
  }
}
