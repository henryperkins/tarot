import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as journal from '../functions/api/journal.js';
import * as journalById from '../functions/api/journal/[id].js';

// The journal routes must accept every credential getUserFromRequest resolves,
// in particular the GPT service token, while the app's cookie session keeps
// working unchanged.

const SERVICE_TOKEN = 'svc_journal_auth_0123456789abcdef0123456789abcdef';

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

const SAVE_BODY = {
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  cards: [{ position: 'Past', name: 'The Hermit', orientation: 'Upright', number: 9 }],
  personalReading: 'A season of solitude.',
  sessionSeed: 'test-seed-1'
};

class MockDB {
  constructor({ sessionRow = null, entryRow = null, existingBySeed = null } = {}) {
    this.sessionRow = sessionRow;
    this.entryRow = entryRow;
    this.existingBySeed = existingBySeed;
    this.users = new Map();
    this.inserts = [];
    this.deletes = [];
    this.countBinds = [];
  }

  prepare(query) {
    const db = this;
    return {
      bind: (...args) => ({
        first: async () => {
          if (query.includes('FROM sessions')) return db.sessionRow;
          if (/FROM users WHERE id = \?/i.test(query)) return db.users.get(args[0]) || null;
          if (query.includes('COUNT(*)')) {
            db.countBinds.push(args);
            return { total: 0 };
          }
          if (query.includes('session_seed = ?')) return db.existingBySeed;
          if (query.includes('FROM journal_entries')) return db.entryRow;
          return null;
        },
        run: async () => {
          if (/INSERT OR IGNORE INTO users/i.test(query)) {
            const [id] = args;
            if (!db.users.has(id)) db.users.set(id, { id, auth_provider: 'service' });
            return { meta: { changes: 1 } };
          }
          if (query.includes('INSERT INTO journal_entries')) {
            db.inserts.push(args);
            return { meta: { changes: 1 } };
          }
          if (query.includes('DELETE FROM journal_entries')) {
            db.deletes.push(args);
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        all: async () => ({ results: [] })
      })
    };
  }
}

function serviceEnv(db, userId) {
  return { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: userId };
}

function request(path, { method = 'GET', bearer = null, cookie = null, body } = {}) {
  const headers = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return new Request(`https://example.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function entryRowFor(userId) {
  return {
    id: 'entry-1',
    user_id: userId,
    created_at: 1_700_000_000,
    spread_key: 'threeCard',
    spread_name: 'Three-Card Story',
    question: null,
    cards_json: JSON.stringify(SAVE_BODY.cards),
    narrative: 'A season of solitude.',
    themes_json: null,
    reflections_json: null,
    context: null,
    provider: null,
    session_seed: 'test-seed-1',
    user_preferences_json: null,
    deck_id: null,
    request_id: null,
    extracted_steps: null,
    step_embeddings: null,
    extraction_version: null,
    location_latitude: null,
    location_longitude: null,
    location_timezone: null,
    location_consent: 0
  };
}

describe('journal routes accept bearer service-token auth', () => {
  it('GET /api/journal lists entries for the service user', async () => {
    const userId = 'service:journal-list';
    const db = new MockDB();
    const response = await journal.onRequestGet({
      request: request('/api/journal', { bearer: SERVICE_TOKEN }),
      env: serviceEnv(db, userId)
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.entries, []);
    assert.deepEqual(db.countBinds[0], [userId], 'entries must be scoped to the service user');
  });

  it('POST /api/journal saves an entry owned by the service user', async () => {
    const userId = 'service:journal-save';
    const db = new MockDB();
    const response = await journal.onRequestPost({
      request: request('/api/journal', { method: 'POST', bearer: SERVICE_TOKEN, body: SAVE_BODY }),
      env: serviceEnv(db, userId)
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.success, true);
    assert.ok(payload.entry?.id, 'response should carry the new entry id');
    assert.equal(db.inserts.length, 1);
    // INSERT INTO journal_entries (id, user_id, created_at, updated_at, spread_key, ...)
    assert.equal(db.inserts[0][1], userId);
    assert.equal(db.inserts[0][4], 'threeCard');
  });

  it('POST /api/journal deduplicates a repeated sessionSeed for the service user', async () => {
    const userId = 'service:journal-dedup';
    const db = new MockDB({ existingBySeed: { id: 'entry-existing', created_at: 1_700_000_000 } });
    const response = await journal.onRequestPost({
      request: request('/api/journal', { method: 'POST', bearer: SERVICE_TOKEN, body: SAVE_BODY }),
      env: serviceEnv(db, userId)
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.deduplicated, true);
    assert.equal(payload.entry.id, 'entry-existing');
    assert.equal(db.inserts.length, 0);
  });

  it('GET /api/journal/:id returns the service user entry', async () => {
    const userId = 'service:journal-get-one';
    const db = new MockDB({ entryRow: entryRowFor(userId) });
    const response = await journalById.onRequestGet({
      request: request('/api/journal/entry-1', { bearer: SERVICE_TOKEN }),
      env: serviceEnv(db, userId),
      params: { id: 'entry-1' }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.entry.id, 'entry-1');
  });

  it('DELETE /api/journal/:id removes the service user entry', async () => {
    const userId = 'service:journal-delete';
    const db = new MockDB({ entryRow: entryRowFor(userId) });
    const response = await journalById.onRequestDelete({
      request: request('/api/journal/entry-1', { method: 'DELETE', bearer: SERVICE_TOKEN }),
      env: serviceEnv(db, userId),
      params: { id: 'entry-1' }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.deepEqual(db.deletes[0], ['entry-1']);
  });
});

describe('journal routes keep working for the app session cookie', () => {
  it('POST /api/journal still saves for a cookie session', async () => {
    const db = new MockDB({ sessionRow: PLUS_SESSION });
    const response = await journal.onRequestPost({
      request: request('/api/journal', { method: 'POST', cookie: 'session=token-1', body: SAVE_BODY }),
      env: { DB: db }
    });

    assert.equal(response.status, 201);
    assert.equal(db.inserts[0][1], 'user-1');
  });

  it('POST /api/journal rejects requests with neither cookie nor bearer token', async () => {
    const db = new MockDB();
    const response = await journal.onRequestPost({
      request: request('/api/journal', { method: 'POST', body: SAVE_BODY }),
      env: { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN }
    });

    assert.equal(response.status, 401);
    assert.equal(db.inserts.length, 0);
  });

  it('POST /api/journal rejects a wrong bearer token', async () => {
    const db = new MockDB();
    const response = await journal.onRequestPost({
      request: request('/api/journal', { method: 'POST', bearer: 'not-the-service-token-0123456789', body: SAVE_BODY }),
      env: { DB: db, GPT_SERVICE_TOKEN: SERVICE_TOKEN }
    });

    assert.equal(response.status, 401);
  });
});
