import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser } from './helpers/journalFixtures.mjs';
import { MemoryKV } from './helpers/memoryKv.mjs';
import { hashPassword } from '../functions/lib/auth.js';
import { onRequestPost } from '../functions/api/auth/login.js';

const PASSWORD = 'correct horse battery';

async function setup() {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', username: 'henry' });
  await seedUser(d1, { id: 'user-off', username: 'gone', active: 0 });
  for (const id of ['user-1', 'user-off']) {
    const { hash, salt } = await hashPassword(PASSWORD);
    await d1.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, id).run();
  }
  const env = { DB: d1, RATELIMIT: new MemoryKV() };
  const login = (body, ip = '203.0.113.20') => onRequestPost({
    env,
    request: new Request('https://tarot.example/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify(body)
    })
  });
  return { d1, login };
}

describe('POST /api/auth/login', () => {
  it('signs in with the right password and sets a session cookie', async () => {
    const { login } = await setup();
    const response = await login({ email: 'User.1@example.com', password: PASSWORD });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.user.id, 'user-1');
    assert.equal(body.user.subscription_tier, 'plus');
    assert.match(response.headers.get('set-cookie'), /^session=[^;]+; HttpOnly; SameSite=Lax; Secure; Max-Age=\d+; Path=\/$/);
  });

  it('answers 400, 401 and 403 without a session for bad input, wrong credentials and inactive accounts', async () => {
    const { login } = await setup();
    const cases = [
      [{ email: 'user.1@example.com' }, 400, 'Email and password are required'],
      [{ email: 'user.1@example.com', password: 'wrong' }, 401, 'Invalid email or password'],
      [{ email: 'nobody@example.com', password: PASSWORD }, 401, 'Invalid email or password'],
      [{ email: 'user.off@example.com', password: PASSWORD }, 403, 'Account is inactive']
    ];
    for (const [body, status, error] of cases) {
      const response = await login(body);
      assert.equal(response.status, status, error);
      assert.equal((await response.json()).error, error);
      assert.equal(response.headers.get('set-cookie'), null);
    }
  });

  it('refuses a client after five failed attempts, even with the right password', async () => {
    const { login } = await setup();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await login({ email: 'user.1@example.com', password: 'wrong' })).status, 401);
    }
    const limited = await login({ email: 'user.1@example.com', password: PASSWORD });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);

    const otherClient = await login({ email: 'user.1@example.com', password: PASSWORD }, '203.0.113.21');
    assert.equal(otherClient.status, 200);
  });
});
