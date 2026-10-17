import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost } from '../functions/api/speech-token.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { getMonthKeyUtc } from '../functions/lib/usageTracking.js';

for (const [method, handler] of [['GET', onRequestGet], ['POST', onRequestPost]]) {
  test(`retired speech token ${method} never accesses providers or accounting`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('No provider request is allowed'); });
    const env = new Proxy({}, { get() { throw new Error('No service or allowance access is allowed'); } });
    for (const authenticated of [false, true]) {
      const request = new Request('https://example.test/api/speech-token', {
        method,
        headers: authenticated ? { Cookie: 'session=old-session' } : {}
      });
      const response = await handler({ request, env });
      assert.equal(response.status, 410);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), {
        error: 'This narration option has been retired. Use reader voice.',
        errorCode: 'SPEECH_PROVIDER_RETIRED'
      });
    }
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
