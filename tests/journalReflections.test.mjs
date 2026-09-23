import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequestPost } from '../functions/api/journal/reflections.js';

// Realistic long random token (>= MIN_SERVICE_TOKEN_LENGTH chars, no sk_ prefix).
const SERVICE_TOKEN = 'svc_reflections_0123456789abcdef0123456789abcdef';

const PLUS_SESSION = {
  session_id: 'session-1',
  user_id: 'user-1',
  email: 'test@example.com',
  username: 'test-user',
  is_active: 1,
  subscription_tier: 'plus',
  subscription_status: 'active',
  subscription_provider: 'stripe',
  stripe_customer_id: 'cus_123'
};

// Journal card shape as written by src/hooks/useSaveReading.js: `name`, not `card`.
const CARDS = [
  { position: 'Past', name: 'The Hermit', number: 9, orientation: 'Upright' },
  { position: 'Present', name: 'Three of Cups', suit: 'Cups', rank: 'Three', rankValue: 3, orientation: 'Reversed' },
  { position: 'Future', name: 'The Star', number: 17, orientation: 'Upright' }
];

function entryFixture(overrides = {}) {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    cards_json: JSON.stringify(CARDS),
    reflections_json: null,
    ...overrides
  };
}

/**
 * Minimal D1 double: session lookup (cookie auth), service-user provisioning
 * (bearer auth), the entry select, and the reflections UPDATE.
 */
class MockDB {
  constructor({ sessionRow = null, entryRow = null } = {}) {
    this.sessionRow = sessionRow;
    this.entryRow = entryRow;
    this.users = new Map();
    this.updates = [];
    this.queries = [];
  }

  prepare(query) {
    this.queries.push(query);
    const db = this;
    return {
      bind: (...args) => ({
        first: async () => {
          if (query.includes('FROM sessions')) return db.sessionRow;
          if (/FROM users WHERE id = \?/i.test(query)) return db.users.get(args[0]) || null;
          if (query.includes('FROM journal_entries')) {
            return db.entryRow && db.entryRow.id === args[0] ? db.entryRow : null;
          }
          return null;
        },
        run: async () => {
          if (/INSERT OR IGNORE INTO users/i.test(query)) {
            const [id] = args;
            if (!db.users.has(id)) db.users.set(id, { id, auth_provider: 'service' });
            return { meta: { changes: 1 } };
          }
          if (query.includes('UPDATE journal_entries')) {
            db.updates.push(args);
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        all: async () => ({ results: [] })
      })
    };
  }
}

function makeRequest(body, { entryId = 'entry-1', cookie = 'session=token-1', bearer = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  } else if (cookie) {
    headers.Cookie = cookie;
  }
  return new Request(`https://example.com/api/journal/${entryId}/reflections`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function post(body, { db, env = {}, entryId = 'entry-1', ...requestOptions } = {}) {
  const response = await onRequestPost({
    request: makeRequest(body, { entryId, ...requestOptions }),
    env: { DB: db, ...env },
    params: { id: entryId }
  });
  return { response, payload: await response.json() };
}

function storedReflections(db) {
  assert.equal(db.updates.length, 1, 'expected exactly one UPDATE journal_entries');
  return JSON.parse(db.updates[0][0]);
}

describe('POST /api/journal/:id/reflections', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const db = new MockDB({ entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'note' }, { db, cookie: null });

    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Not authenticated');
    assert.equal(db.updates.length, 0);
  });

  it('rejects users below Plus with a tier-limited 403', async () => {
    const db = new MockDB({
      sessionRow: { ...PLUS_SESSION, subscription_tier: 'free', subscription_status: 'inactive' },
      entryRow: entryFixture()
    });
    const { response, payload } = await post({ text: 'note' }, { db });

    assert.equal(response.status, 403);
    assert.equal(payload.tierLimited, true);
    assert.equal(payload.requiredTier, 'plus');
    assert.equal(db.updates.length, 0);
  });

  it('returns 404 when the entry does not exist', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: null });
    const { response, payload } = await post({ text: 'note' }, { db, entryId: 'missing' });

    assert.equal(response.status, 404);
    assert.equal(payload.error, 'Entry not found');
  });

  it('returns 404 when the entry belongs to another user', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture({ user_id: 'someone-else' }) });
    const { response } = await post({ text: 'note' }, { db });

    assert.equal(response.status, 404);
    assert.equal(db.updates.length, 0);
  });

  it('rejects blank reflection text with 400', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: '   ', card: 'The Hermit' }, { db });

    assert.equal(response.status, 400);
    assert.match(payload.error, /text/i);
    assert.equal(db.updates.length, 0);
  });

  it('rejects reflection text longer than the audited contract (2000 chars)', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'x'.repeat(2001), card: 'The Hermit' }, { db });

    assert.equal(response.status, 400);
    assert.equal(payload.maxLength, 2000);
    assert.equal(db.updates.length, 0);
  });

  it('rejects an unknown scope with 400', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response } = await post({ text: 'note', scope: 'spread' }, { db });

    assert.equal(response.status, 400);
    assert.equal(db.updates.length, 0);
  });

  it('writes a card reflection under the resolved card index', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post(
      { text: 'six months alone', scope: 'card', card: 'The Hermit', position: 'Past' },
      { db }
    );

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(storedReflections(db), { 0: 'six months alone' });

    // UPDATE ... SET reflections_json = ?, updated_at = ? WHERE id = ? AND user_id = ?
    const bound = db.updates[0];
    assert.equal(typeof bound[1], 'number', 'updated_at should be bumped');
    assert.equal(bound[2], 'entry-1');
    assert.equal(bound[3], 'user-1');

    assert.equal(payload.reflection.key, '0');
    assert.equal(payload.reflection.scope, 'card');
    assert.equal(payload.reflection.cardIndex, 0);
    assert.equal(payload.reflection.card, 'The Hermit');
    assert.equal(payload.reflection.position, 'Past');
  });

  it('resolves a card by name alone, case-insensitively', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'hope returns', card: 'the star' }, { db });

    assert.equal(response.status, 200);
    assert.deepEqual(storedReflections(db), { 2: 'hope returns' });
    assert.equal(payload.reflection.card, 'The Star');
    assert.equal(payload.reflection.position, 'Future');
  });

  it('resolves a card by position alone', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'friends around me', position: 'present' }, { db });

    assert.equal(response.status, 200);
    assert.deepEqual(storedReflections(db), { 1: 'friends around me' });
    assert.equal(payload.reflection.card, 'Three of Cups');
  });

  it('resolves a card by explicit cardIndex', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'note', cardIndex: 1, card: 'Three of Cups' }, { db });

    assert.equal(response.status, 200);
    assert.deepEqual(storedReflections(db), { 1: 'note' });
    assert.equal(payload.reflection.position, 'Present');
  });

  it('rejects a card/position mismatch and lists the entry cards for correction', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'note', card: 'The Hermit', position: 'Future' }, { db });

    assert.equal(response.status, 400);
    assert.match(payload.error, /Hermit/);
    assert.deepEqual(
      payload.cards,
      [
        { index: 0, position: 'Past', name: 'The Hermit' },
        { index: 1, position: 'Present', name: 'Three of Cups' },
        { index: 2, position: 'Future', name: 'The Star' }
      ]
    );
    assert.equal(db.updates.length, 0);
  });

  it('rejects a card that is not in the entry', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'note', card: 'The Tower' }, { db });

    assert.equal(response.status, 400);
    assert.match(payload.error, /Tower/);
    assert.equal(db.updates.length, 0);
  });

  it('rejects a card-scoped reflection that names no card', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response } = await post({ text: 'note', scope: 'card' }, { db });

    assert.equal(response.status, 400);
    assert.equal(db.updates.length, 0);
  });

  it('stores reading-scoped reflections under the Overall key', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'whole reading felt gentle', scope: 'reading' }, { db });

    assert.equal(response.status, 200);
    assert.deepEqual(storedReflections(db), { Overall: 'whole reading felt gentle' });
    assert.equal(payload.reflection.key, 'Overall');
    assert.equal(payload.reflection.scope, 'reading');
    assert.equal(payload.reflection.cardIndex, undefined);
  });

  it('defaults to reading scope when no card is named', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { response, payload } = await post({ text: 'general note' }, { db });

    assert.equal(response.status, 200);
    assert.equal(payload.reflection.scope, 'reading');
    assert.deepEqual(storedReflections(db), { Overall: 'general note' });
  });

  it('appends to an existing reflection by default and preserves other keys', async () => {
    const db = new MockDB({
      sessionRow: PLUS_SESSION,
      entryRow: entryFixture({ reflections_json: JSON.stringify({ 0: 'first thought', 1: 'untouched' }) })
    });
    const { response, payload } = await post({ text: 'second thought', card: 'The Hermit' }, { db });

    assert.equal(response.status, 200);
    assert.deepEqual(storedReflections(db), { 0: 'first thought\n\nsecond thought', 1: 'untouched' });
    assert.equal(payload.reflection.text, 'first thought\n\nsecond thought');
    assert.deepEqual(payload.reflections, { 0: 'first thought\n\nsecond thought', 1: 'untouched' });
  });

  it('replaces an existing reflection when mode is replace', async () => {
    const db = new MockDB({
      sessionRow: PLUS_SESSION,
      entryRow: entryFixture({ reflections_json: JSON.stringify({ 0: 'first thought' }) })
    });
    const { response } = await post({ text: 'rewritten', card: 'The Hermit', mode: 'replace' }, { db });

    assert.equal(response.status, 200);
    assert.deepEqual(storedReflections(db), { 0: 'rewritten' });
  });

  it('treats malformed stored reflections as empty rather than failing', async () => {
    const db = new MockDB({
      sessionRow: PLUS_SESSION,
      entryRow: entryFixture({ reflections_json: 'not json at all' })
    });
    const { response } = await post({ text: 'fresh start', card: 'The Star' }, { db });

    assert.equal(response.status, 200);
    assert.deepEqual(storedReflections(db), { 2: 'fresh start' });
  });

  it('accepts the GPT service bearer token and writes as the service user', async () => {
    const serviceUserId = 'service:reflections-test';
    const db = new MockDB({ entryRow: entryFixture({ user_id: serviceUserId }) });
    const { response, payload } = await post(
      { text: 'via the GPT', card: 'The Hermit', position: 'Past' },
      {
        db,
        bearer: SERVICE_TOKEN,
        env: { GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: serviceUserId }
      }
    );

    assert.equal(response.status, 200);
    assert.equal(payload.reflection.key, '0');
    assert.equal(db.updates[0][3], serviceUserId, 'UPDATE must be scoped to the service user');
  });

  it('writes a shape the journal UI renders (string map, not an entries array)', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION, entryRow: entryFixture() });
    const { payload } = await post({ text: 'visible in the app', card: 'The Hermit' }, { db });

    // Mirrors src/components/journal/entry-card/hooks/useEntryMetadata.js, which
    // drops anything that is not a non-empty string.
    const rendered = Object.entries(payload.reflections).filter(
      ([, note]) => typeof note === 'string' && note.trim()
    );
    assert.deepEqual(rendered, [['0', 'visible in the app']]);
  });
});
