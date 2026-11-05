import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  onRequestGet,
  onRequestPut,
  normalizeAccountPreferences
} from '../functions/api/account/preferences.js';
import { jsonResponse as baseJsonResponse } from '../functions/lib/utils.js';

const jsonResponse = (data, init = {}) => baseJsonResponse(data, { status: init.status ?? 200 });

function createDb({ stored = null, missingColumn = false } = {}) {
  const state = { stored, writes: [] };
  return {
    state,
    prepare(query) {
      return {
        bind: (...args) => ({
          first: async () => {
            if (missingColumn) throw new Error('D1_ERROR: no such column: preferences_json');
            if (query.startsWith('SELECT preferences_json')) return { preferences_json: state.stored };
            return null;
          },
          run: async () => {
            if (query.startsWith('UPDATE users SET preferences_json')) {
              state.stored = args[0];
              state.writes.push(args);
            }
            return { meta: { changes: 1 } };
          }
        })
      };
    }
  };
}

function deps({ user = { id: 'user-1', auth_provider: 'email' }, body = {}, now = 1_800_000_000 } = {}) {
  return {
    getUserFromRequest: async () => user,
    isMachineCredential: candidate => candidate?.auth_provider === 'api_key',
    jsonResponse,
    readJsonBody: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
    now: () => now
  };
}

const request = (method = 'GET') => new Request('https://example.com/api/account/preferences', { method });

describe('account preferences API', () => {
  it('requires a signed-in session, not a machine credential', async () => {
    const db = createDb();
    const anonymous = await onRequestGet({ request: request(), env: { DB: db } }, deps({ user: null }));
    assert.equal(anonymous.status, 401);
    const apiKey = await onRequestPut({ request: request('PUT'), env: { DB: db } }, deps({ user: { id: 'u', auth_provider: 'api_key' } }));
    assert.equal(apiKey.status, 401);
    assert.equal(db.state.writes.length, 0);
  });

  it('reads nothing stored as null, and an unmigrated database as unavailable', async () => {
    const empty = await onRequestGet({ request: request(), env: { DB: createDb() } }, deps());
    assert.deepEqual(await empty.json(), { preferences: null, available: true });

    const unmigrated = await onRequestGet({ request: request(), env: { DB: createDb({ missingColumn: true }) } }, deps());
    assert.equal(unmigrated.status, 200);
    assert.deepEqual(await unmigrated.json(), { preferences: null, available: false });

    const put = await onRequestPut({ request: request('PUT'), env: { DB: createDb({ missingColumn: true }) } }, deps({ body: { onboardingCompleted: true } }));
    assert.equal(put.status, 503);
  });

  it('stores only the fields the reader chose, sanitized as reading requests are', async () => {
    const db = createDb();
    const response = await onRequestPut({ request: request('PUT'), env: { DB: db } }, deps({
      body: {
        personalization: {
          displayName: '  **Henry**  ',
          readingTone: 'gentle',
          spiritualFrame: 'cosmic-nonsense',
          tarotExperience: 'experienced',
          preferredSpreadDepth: 'deep'
        },
        explicitFields: ['displayName', 'readingTone', 'spiritualFrame', 'notAField', 'readingTone'],
        onboardingCompleted: true
      }
    }));
    assert.equal(response.status, 200);
    const { preferences } = await response.json();
    assert.equal(preferences.personalization.readingTone, 'gentle');
    assert.ok(preferences.personalization.displayName.includes('Henry'));
    assert.ok(!preferences.personalization.displayName.includes('*'));
    // Not chosen, so not stored; an invalid choice is dropped, not kept.
    assert.equal('tarotExperience' in preferences.personalization, false);
    assert.equal('spiritualFrame' in preferences.personalization, false);
    assert.deepEqual(preferences.explicitFields, ['displayName', 'readingTone']);
    assert.equal(preferences.onboardingCompletedAt, 1_800_000_000);
    assert.deepEqual(JSON.parse(db.state.stored), preferences);

    const read = await onRequestGet({ request: request(), env: { DB: db } }, deps());
    assert.deepEqual((await read.json()).preferences, preferences);
  });

  it('keeps the first onboarding completion; replaying the tutorial elsewhere does not undo it', async () => {
    const db = createDb({
      stored: JSON.stringify(normalizeAccountPreferences({ onboardingCompleted: true }, { now: 1_700_000_000 }))
    });
    const later = await onRequestPut({ request: request('PUT'), env: { DB: db } }, deps({
      body: { personalization: {}, explicitFields: [], onboardingCompleted: false },
      now: 1_800_000_000
    }));
    const { preferences } = await later.json();
    assert.equal(preferences.onboardingCompletedAt, 1_700_000_000);
    assert.equal(preferences.updatedAt, 1_800_000_000);
  });

  it('replaces the chosen fields, so a reset on one device clears them everywhere', async () => {
    const db = createDb({
      stored: JSON.stringify(normalizeAccountPreferences({
        personalization: { displayName: 'Henry' }, explicitFields: ['displayName']
      }, { now: 1 }))
    });
    const reset = await onRequestPut({ request: request('PUT'), env: { DB: db } }, deps({
      body: { personalization: {}, explicitFields: [] }
    }));
    const { preferences } = await reset.json();
    assert.deepEqual(preferences.personalization, {});
    assert.deepEqual(preferences.explicitFields, []);
    assert.equal(preferences.onboardingCompletedAt, null);
  });

  it('round-trips through the real users schema (every migration applied)', async () => {
    const { createD1 } = await import('./helpers/d1Sqlite.mjs');
    const DB = await createD1();
    await DB.prepare(`INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at)
      VALUES ('reader', 'reader@example.test', 'reader', 'hash', 'salt', 1, 1)`).run();
    const reader = { id: 'reader', auth_provider: 'email' };

    const before = await onRequestGet({ request: request(), env: { DB } }, deps({ user: reader }));
    assert.deepEqual(await before.json(), { preferences: null, available: true });

    const saved = await onRequestPut({ request: request('PUT'), env: { DB } }, deps({
      user: reader,
      body: { personalization: { tarotExperience: 'intermediate' }, explicitFields: ['tarotExperience'], onboardingCompleted: true }
    }));
    assert.equal(saved.status, 200);

    const after = await onRequestGet({ request: request(), env: { DB } }, deps({ user: reader }));
    const { preferences } = await after.json();
    assert.deepEqual(preferences.personalization, { tarotExperience: 'intermediate' });
    assert.equal(preferences.onboardingCompletedAt, 1_800_000_000);
    const row = await DB.prepare('SELECT updated_at FROM users WHERE id = ?').bind('reader').first();
    assert.equal(row.updated_at, 1_800_000_000);
  });

  it('rejects malformed payloads without writing', async () => {
    const db = createDb();
    const invalid = await onRequestPut({ request: request('PUT'), env: { DB: db } }, deps({ body: new Error('Invalid JSON payload.') }));
    assert.equal(invalid.status, 400);
    const list = await onRequestPut({ request: request('PUT'), env: { DB: db } }, deps({ body: [] }));
    assert.equal(list.status, 400);
    assert.equal(db.state.writes.length, 0);
  });
});
