import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { jsonRequest, seedSession, seedUser } from './helpers/journalFixtures.mjs';
import { loadActiveUserById } from '../functions/lib/auth.js';
import { onRequestPost as tarotReading, resolveReadingUser } from '../functions/api/tarot-reading.js';
import { SPREADS } from '../src/data/spreads.js';

async function setup() {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', tier: 'plus', username: 'owner' });
  await seedUser(d1, { id: 'user-2', tier: 'free' });
  await seedSession(d1, { id: 'session-2', userId: 'user-2' });
  await seedUser(d1, { id: 'user-off', active: 0 });
  return { d1, env: { DB: d1 } };
}

describe('loadActiveUserById', () => {
  it('returns the validateSession user shape', async () => {
    const { env } = await setup();
    const user = await loadActiveUserById(env.DB, 'user-1');
    assert.equal(user.id, 'user-1');
    assert.equal(user.username, 'owner');
    assert.equal(user.subscription_tier, 'plus');
    assert.equal(user.subscription_status, 'active');
    assert.equal(user.auth_provider, 'session');
    assert.equal(user.sessionId, null);
  });

  it('returns null for an unknown, inactive or missing id', async () => {
    const { env } = await setup();
    assert.equal(await loadActiveUserById(env.DB, 'nobody'), null);
    assert.equal(await loadActiveUserById(env.DB, 'user-off'), null);
    assert.equal(await loadActiveUserById(env.DB, ''), null);
    assert.equal(await loadActiveUserById(null, 'user-1'), null);
  });
});

describe('resolveReadingUser', () => {
  it('uses the principal and ignores request credentials', async () => {
    const { env } = await setup();
    const request = new Request('https://internal/api/tarot-reading', { headers: { Cookie: 'session=session-2' } });
    const { user, unauthorized } = await resolveReadingUser({ request, env, principal: { userId: 'user-1' } });
    assert.equal(unauthorized, false);
    assert.equal(user.id, 'user-1');
  });

  it('refuses a principal that no longer resolves', async () => {
    const { env } = await setup();
    const request = new Request('https://internal/api/tarot-reading');
    const result = await resolveReadingUser({ request, env, principal: { userId: 'user-off' } });
    assert.deepEqual(result, { user: null, unauthorized: true });
  });

  it('falls back to request credentials without a principal', async () => {
    const { env } = await setup();
    const request = new Request('https://example.com/api/tarot-reading', { headers: { Cookie: 'session=session-2' } });
    const { user, unauthorized } = await resolveReadingUser({ request, env, principal: null });
    assert.equal(unauthorized, false);
    assert.equal(user.id, 'user-2');
  });
});

describe('tarot-reading with a principal', () => {
  it('answers 401 when the principal no longer resolves', async () => {
    const { env } = await setup();
    const payload = {
      spreadInfo: { name: SPREADS.single.name, key: 'single' },
      cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }]
    };
    const response = await tarotReading({
      request: jsonRequest('https://internal/api/tarot-reading', { body: payload }),
      env,
      waitUntil: () => {},
      principal: { userId: 'user-off' }
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'Not authenticated');
  });
});
