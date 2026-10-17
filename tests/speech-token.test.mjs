import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost } from '../functions/api/speech-token.js';

for (const [method, handler] of [['GET', onRequestGet], ['POST', onRequestPost]]) {
  test(`retired speech-token ${method} cannot authenticate, debit, read secrets, or call Azure`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Retired speech tokens must never call an upstream'); });
    const env = new Proxy({}, { get() { throw new Error('Retired speech tokens must never read environment bindings'); } });
    const request = new Proxy({}, { get() { throw new Error('Retired speech tokens must never resolve authentication'); } });
    const response = await handler({ request, env });
    assert.equal(response.status, 410);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const payload = await response.json();
    assert.equal(payload.errorCode, 'SPEECH_PROVIDER_RETIRED');
    assert.equal(payload.token, undefined);
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('repeated retired token requests preserve an existing narration allowance', async () => {
  const DB = await createD1();
  await DB.prepare("INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at) VALUES ('speech-user', 'speech@example.test', 'speech', 'unused', 'unused', 1, 1)").run();
  await DB.prepare('INSERT INTO usage_tracking (user_id, month, tts_count, created_at, updated_at) VALUES (?, ?, 2, 1, 1)').bind('speech-user', getMonthKeyUtc()).run();
  const responses = await Promise.all(Array.from({ length: 8 }, () => onRequestGet({ env: { DB } })));
  assert.ok(responses.every(response => response.status === 410));
  assert.equal(DB.rows('SELECT tts_count FROM usage_tracking')[0].tts_count, 2);
  assert.deepEqual(DB.rows('SELECT * FROM narration_requests'), []);
  assert.deepEqual(DB.rows('SELECT * FROM narration_monthly_usage'), []);
  assert.deepEqual(DB.rows('SELECT * FROM narration_request_limits'), []);
});
