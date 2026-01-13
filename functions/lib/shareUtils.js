import { computeJournalStats } from '../../shared/journal/stats.js';
import { getTimestamp } from '../../shared/journal/utils.js';
import { safeJsonParse } from './utils.js';

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
    sessionSeed: row.session_seed
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
