/** Seed helpers for tests that run against tests/helpers/d1Sqlite.mjs. */

// Journal card shape as written by src/hooks/useSaveReading.js: `name`, not `card`.
export const THREE_CARDS = Object.freeze([
  { position: 'Past', name: 'The Hermit', number: 9, orientation: 'Upright' },
  { position: 'Present', name: 'Three of Cups', suit: 'Cups', rank: 'Three', rankValue: 3, orientation: 'Reversed' },
  { position: 'Future', name: 'The Star', number: 17, orientation: 'Upright' }
]);

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function seedUser(d1, {
  id = 'user-1',
  tier = 'plus',
  status = 'active',
  authProvider = null,
  username = null,
  email = null,
  active = 1
} = {}) {
  const now = nowSeconds();
  await d1.prepare(
    `INSERT INTO users (
       id, email, username, password_hash, password_salt, created_at, updated_at,
       is_active, email_verified, subscription_tier, subscription_status, auth_provider
     ) VALUES (?, ?, ?, 'hash', 'salt', ?, ?, ?, 1, ?, ?, ?)`
  ).bind(
    id,
    email ?? `${id.replace(/[^A-Za-z0-9]/g, '.')}@example.com`,
    username ?? id.replace(/[^A-Za-z0-9_]/g, '_'),
    now,
    now,
    active,
    tier,
    status,
    authProvider
  ).run();
  return { id };
}

export async function seedSession(d1, { id = 'session-1', userId = 'user-1', ttlSeconds = 3600 } = {}) {
  const now = nowSeconds();
  await d1.prepare(
    'INSERT INTO sessions (id, user_id, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, now, now + ttlSeconds, now).run();
  return { id };
}

export async function seedEntry(d1, {
  id = 'entry-1',
  userId = 'user-1',
  cards = THREE_CARDS,
  reflections = null,
  deckId = null,
  spreadKey = 'threeCard',
  spreadName = 'Three-Card Story (Past · Present · Future)',
  sessionSeed = null,
  requestId = null,
  narrative = 'A reading.'
} = {}) {
  const now = nowSeconds();
  const reflectionsJson = reflections === null
    ? null
    : (typeof reflections === 'string' ? reflections : JSON.stringify(reflections));
  await d1.prepare(
    `INSERT INTO journal_entries (
       id, user_id, created_at, updated_at, spread_key, spread_name, cards_json,
       narrative, reflections_json, session_seed, request_id, deck_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, now, now, spreadKey, spreadName, JSON.stringify(cards),
    narrative, reflectionsJson, sessionSeed, requestId, deckId
  ).run();
  return { id };
}

export function jsonRequest(url, { method = 'POST', body, headers = {} } = {}) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
