import { hydrateJournalEntry } from './shareUtils.js';

function safeJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function loadShareRecord(env, token) {
  const row = await env.DB.prepare(`
    SELECT token, user_id, scope, title, created_at, expires_at, view_count, meta_json
    FROM share_tokens
    WHERE token = ?
  `).bind(token).first();
  if (!row) return null;
  return {
    token: row.token,
    userId: row.user_id,
    scope: row.scope,
    title: row.title,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewCount: row.view_count || 0,
    meta: safeJson(row.meta_json, {})
  };
}

export async function loadShareEntries(env, token) {
  const result = await env.DB.prepare(`
    SELECT je.* , ste.sort_index
    FROM share_token_entries ste
    JOIN journal_entries je ON je.id = ste.entry_id
    WHERE ste.token = ?
    ORDER BY ste.sort_index ASC
  `).bind(token).all();
  return result.results.map(hydrateJournalEntry);
}

export async function loadShareNotes(env, token) {
  const result = await env.DB.prepare(`
    SELECT id, author_name, body, card_position, created_at
    FROM share_notes
    WHERE token = ?
    ORDER BY created_at ASC
  `).bind(token).all();
  return result.results.map((row) => ({
    id: row.id,
    authorName: row.author_name || 'Guest Seeker',
    body: row.body,
    cardPosition: row.card_position || null,
    createdAt: row.created_at * 1000
  }));
}
