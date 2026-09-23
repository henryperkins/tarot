import { Miniflare } from 'miniflare';
import { hashApiKey } from '../../functions/lib/apiKeys.js';

export const OWNER_KEY = `sk_${'a'.repeat(64)}`;
export const OTHER_KEY = `sk_${'b'.repeat(64)}`;

// A real local D1 database: exercise SQL constraints, atomic writes and auth joins.
export async function journalFixture() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("fixture"); } };',
    // Production's date (wrangler.jsonc). Newer runtimes reject future dates.
    compatibilityDate: '2025-11-24',
    d1Databases: ['DB']
  });
  // A failed setup must still stop workerd, or the test process never exits.
  try {
    return await seedJournalDb(mf);
  } catch (error) {
    await mf.dispose().catch(() => {});
    throw error;
  }
}

async function seedJournalDb(mf) {
  const db = await mf.getD1Database('DB');
  await db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, username TEXT, is_active INTEGER, subscription_tier TEXT, subscription_status TEXT, subscription_provider TEXT, stripe_customer_id TEXT, email_verified INTEGER, auth_provider TEXT, auth_subject TEXT, full_name TEXT, avatar_url TEXT);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER, last_used_at INTEGER);
CREATE TABLE journal_followups (entry_id TEXT, user_id TEXT, turn_number INTEGER, question TEXT, answer TEXT, canonical_answer TEXT, journal_context_json TEXT, created_at INTEGER);
CREATE TABLE api_keys (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), key_hash TEXT, key_prefix TEXT, is_active INTEGER, expires_at INTEGER, last_used_at INTEGER);
CREATE TABLE journal_entries (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), created_at INTEGER, updated_at INTEGER, spread_key TEXT, spread_name TEXT, question TEXT, cards_json TEXT, narrative TEXT, themes_json TEXT, reflections_json TEXT, context TEXT, provider TEXT, session_seed TEXT, user_preferences_json TEXT, deck_id TEXT, request_id TEXT, location_latitude REAL, location_longitude REAL, location_timezone TEXT, location_consent INTEGER, extracted_steps TEXT, step_embeddings TEXT, extraction_version TEXT);`);
  for (const [id, key] of [['owner', OWNER_KEY], ['other', OTHER_KEY]]) {
    await db.prepare("INSERT INTO users (id, email, username, is_active, subscription_tier, subscription_status, subscription_provider, email_verified, auth_provider) VALUES (?, ?, ?, 1, 'pro', 'active', 'stripe', 1, 'password')")
      .bind(id, `${id}@example.test`, id).run();
    await db.prepare('INSERT INTO api_keys (id, user_id, key_hash, key_prefix, is_active) VALUES (?, ?, ?, ?, 1)')
      .bind(`key-${id}`, id, await hashApiKey(key), key.slice(0, 10)).run();
    await db.prepare('INSERT INTO sessions VALUES (?, ?, ?, 0)')
      .bind(`session-${id}`, id, Math.floor(Date.now() / 1000) + 3600).run();
  }
  return { db, close: () => mf.dispose() };
}

export const SAVED_READING = {
  spread: 'Three-Card Story', spreadKey: 'threeCard', question: 'What can I practice?',
  cards: [
    { position: 'Past', name: 'The Hermit', orientation: 'Upright', number: 9 },
    { position: 'Present', name: 'Three of Cups', orientation: 'Reversed', suit: 'Cups', rank: 'Three', rankValue: 3 },
    { position: 'Future', name: 'The Hermit', orientation: 'Reversed', number: 9 }
  ],
  personalReading: '  A quiet beginning.\n\n### Practice\nKeep your own pace.  ',
  themes: { suitFocus: 'Cups' }, provider: 'local-composer', requestId: 'reading-1',
  deckId: 'rws-1909', userPreferences: { readingTone: 'gentle' }, sessionSeed: 'returned-draw-seed'
};

export function apiRequest(path, body, key = OWNER_KEY) {
  return new Request(`https://example.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
