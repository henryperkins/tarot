import { computeJournalStats } from '../../shared/journal/stats.js';
import { getTimestamp } from '../../shared/journal/utils.js';
import { safeJsonParse } from './utils.js';
import { SHARE_TITLE_MAX_LENGTH, replaceInvalidXmlCharacters } from '../../shared/journal/shareTitles.js';

export { SHARE_TITLE_MAX_LENGTH };

export function defaultShareTitle(scope) {
  return scope === 'entry' ? 'Shared reading' : 'Journal snapshot';
}

/**
 * A share title is one line of at most 80 characters; blank means the default.
 * Titles appear in link previews, so whitespace runs (including newlines)
 * collapse to single spaces and the limit never splits a character.
 */
export function normalizeShareTitle(value) {
  if (typeof value !== 'string') return null;
  const collapsed = replaceInvalidXmlCharacters(value).replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  return Array.from(collapsed).slice(0, SHARE_TITLE_MAX_LENGTH).join('').trim();
}

export function hydrateJournalEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    ts: row.created_at ? row.created_at * 1000 : Date.now(),
    spread: row.spread_name,
    spreadKey: row.spread_key,
    question: row.question,
    cards: safeJsonParse(row.cards_json, []),
    personalReading: row.narrative,
    themes: safeJsonParse(row.themes_json, null),
    reflections: safeJsonParse(row.reflections_json, {}),
    context: row.context,
    provider: row.provider,
    sessionSeed: row.session_seed,
    deckId: row.deck_id || null
  };
}

/**
 * The part of a journal entry that anyone holding a share link may read.
 * A link shares what the shared page shows: the question, spread, cards in
 * their deck, and when the reading happened. The narrative, reflections,
 * themes, context, provider and seed stay with the owner; journal stats and
 * link metadata are computed from the full entry on the server instead.
 */
export function toPublicShareEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    ts: entry.ts,
    spread: entry.spread,
    spreadKey: entry.spreadKey,
    question: entry.question,
    cards: Array.isArray(entry.cards) ? entry.cards : [],
    deckId: entry.deckId || null
  };
}

export async function loadEntriesForUser(env, userId, entryIds) {
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return [];
  }
  const placeholders = entryIds.map(() => '?').join(', ');
  const query = `
    SELECT id, user_id, created_at, spread_key, spread_name, question, cards_json, narrative,
           themes_json, reflections_json, context, provider, session_seed
    FROM journal_entries
    WHERE user_id = ? AND id IN (${placeholders})
  `;
  const params = [userId, ...entryIds];
  const result = await env.DB.prepare(query).bind(...params).all();
  const mapped = result.results.map(hydrateJournalEntry);
  const byId = new Map(mapped.map((entry) => [entry.id, entry]));
  return entryIds.map((id) => byId.get(id)).filter(Boolean);
}

export async function loadRecentEntries(env, userId, limit = 5) {
  const result = await env.DB.prepare(`
    SELECT id, user_id, created_at, spread_key, spread_name, question, cards_json, narrative,
           themes_json, reflections_json, context, provider, session_seed
    FROM journal_entries
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userId, limit).all();
  return result.results.map(hydrateJournalEntry);
}

export function buildSharePayload(entries) {
  const stats = computeJournalStats(entries);
  return {
    stats,
    entries
  };
}

function buildContextBreakdown(entries) {
  const contextMap = new Map();
  entries.forEach((entry) => {
    const key = entry?.context || 'general';
    contextMap.set(key, (contextMap.get(key) || 0) + 1);
  });
  return Array.from(contextMap.entries()).map(([name, count]) => ({ name, count }));
}

function deriveLastEntryTimestamp(entries) {
  return entries.reduce((latest, entry) => {
    const ts = getTimestamp(entry) || 0;
    return ts > latest ? ts : latest;
  }, 0);
}

export function buildShareMeta(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { entryCount: 0, spreadKeys: [], contexts: [], lastEntryTs: null };
  }

  const spreadKeys = Array.from(new Set(entries.map((entry) => entry.spreadKey).filter(Boolean))).slice(0, 6);

  return {
    entryCount: entries.length,
    spreadKeys,
    contexts: buildContextBreakdown(entries),
    lastEntryTs: deriveLastEntryTimestamp(entries)
  };
}
