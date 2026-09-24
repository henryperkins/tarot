import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { jsonRequest, seedEntry, seedSession, seedUser, THREE_CARDS } from './helpers/journalFixtures.mjs';
import { onRequestGet as listJournal, onRequestPost as saveJournal } from '../functions/api/journal.js';
import { onRequestDelete as deleteEntry, onRequestGet as getEntry } from '../functions/api/journal/[id].js';
import { onRequestPost as addReflection } from '../functions/api/journal/reflections.js';

// Realistic long random token (>= MIN_SERVICE_TOKEN_LENGTH chars, no sk_ prefix).
const SERVICE_TOKEN = 'svc_journal_guard_0123456789abcdef0123456789abcdef';

const SAVE_BODY = {
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  cards: THREE_CARDS,
  personalReading: 'A reading.'
};

async function setup() {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1' });
  await seedSession(d1, { id: 'session-1', userId: 'user-1' });
  await seedEntry(d1, { id: 'entry-1', userId: 'user-1' });
  const env = { DB: d1, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'service:journal-test' };
  return { d1, env };
}

function countEntries(d1) {
  return d1.rows('SELECT COUNT(*) AS n FROM journal_entries')[0].n;
}

const listRoute = (env, headers) => listJournal({
  request: new Request('https://example.com/api/journal', { headers }), env
});
const saveRoute = (env, headers) => saveJournal({
  request: jsonRequest('https://example.com/api/journal', { body: SAVE_BODY, headers }), env, waitUntil: () => {}
});
const getRoute = (env, headers) => getEntry({
  request: new Request('https://example.com/api/journal/entry-1', { headers }), env, params: { id: 'entry-1' }
});
const deleteRoute = (env, headers) => deleteEntry({
  request: new Request('https://example.com/api/journal/entry-1', { method: 'DELETE', headers }), env, params: { id: 'entry-1' }
});
const reflectRoute = (env, headers) => addReflection({
  request: jsonRequest('https://example.com/api/journal/entry-1/reflections', { body: { text: 'note', scope: 'reading' }, headers }),
  env,
  params: { id: 'entry-1' }
});

const ROUTES = [
  ['GET /api/journal', listRoute],
  ['POST /api/journal', saveRoute],
  ['GET /api/journal/:id', getRoute],
  ['DELETE /api/journal/:id', deleteRoute],
  ['POST /api/journal/:id/reflections', reflectRoute]
];

describe('journal routes refuse the synthetic GPT service account', () => {
  for (const [name, call] of ROUTES) {
    it(`${name} answers 403 service_account_journal_forbidden`, async () => {
      const { d1, env } = await setup();
      const response = await call(env, { Authorization: `Bearer ${SERVICE_TOKEN}` });

      assert.equal(response.status, 403);
      const payload = await response.json();
      assert.equal(payload.code, 'service_account_journal_forbidden');
      assert.equal(payload.error, 'Journal requires a personal account');
      assert.equal(countEntries(d1), 1, 'nothing written or deleted');
      assert.equal(d1.rows('SELECT reflections_json FROM journal_entries')[0].reflections_json, null);
    });
  }
});

describe('journal routes accept personal credentials', () => {
  it('POST /api/journal saves with a bearer session token', async () => {
    const { d1, env } = await setup();
    const response = await saveRoute(env, { Authorization: 'Bearer session-1' });

    assert.equal(response.status, 201);
    const { entry } = await response.json();
    assert.equal(d1.rows('SELECT user_id FROM journal_entries WHERE id = ?', [entry.id])[0].user_id, 'user-1');
  });

  it('POST /api/journal saves with the session cookie', async () => {
    const { env } = await setup();
    const response = await saveRoute(env, { Cookie: 'session=session-1' });
    assert.equal(response.status, 201);
  });

  it('GET /api/journal/:id returns the entry to its owner', async () => {
    const { env } = await setup();
    const response = await getRoute(env, { Authorization: 'Bearer session-1' });
    assert.equal(response.status, 200);
  });

  it('DELETE /api/journal/:id deletes for its owner', async () => {
    const { d1, env } = await setup();
    const response = await deleteRoute(env, { Authorization: 'Bearer session-1' });
    assert.equal(response.status, 200);
    assert.equal(countEntries(d1), 0);
  });

  it('POST /api/journal answers 401 without credentials', async () => {
    const { env } = await setup();
    const response = await saveRoute(env, {});
    assert.equal(response.status, 401);
  });

  it('POST /api/journal answers 401 for an unknown bearer token', async () => {
    const { env } = await setup();
    const response = await saveRoute(env, { Authorization: 'Bearer not-a-real-token-at-all-0123456789' });
    assert.equal(response.status, 401);
  });
});
