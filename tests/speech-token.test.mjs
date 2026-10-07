import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from '../functions/api/speech-token.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { getMonthKeyUtc } from '../functions/lib/usageTracking.js';

async function setup(tier = 'plus') {
  const DB = await createD1();
  await DB.prepare('INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at, subscription_tier, subscription_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('speech-user', 'speech@example.test', 'speech', 'unused', 'unused', 1, 1, tier, 'active').run();
  await DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)').bind('speech-session', 'speech-user', 1, Math.floor(Date.now() / 1000) + 3600, 1).run();
  await DB.prepare('INSERT INTO usage_tracking (user_id, month, tts_count, created_at, updated_at) VALUES (?, ?, 2, 1, 1)').bind('speech-user', getMonthKeyUtc()).run();
  return DB;
}
const request = authenticated => new Request('https://example.test/api/speech-token', { headers: authenticated ? { Cookie: 'session=speech-session' } : {} });

test('speech tokens require authentication', async () => {
  assert.equal((await onRequestGet({ request: request(false), env: {} })).status, 401);
});

test('all signed-in tiers can obtain tokens and refreshing never debits narration', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('test-only-token'));
  for (const tier of ['free', 'plus', 'pro']) {
    const DB = await setup(tier);
    for (let i = 0; i < 2; i++) {
      const response = await onRequestGet({ request: request(true), env: { DB, AZURE_SPEECH_KEY: 'test-only', AZURE_SPEECH_REGION: 'eastus2' } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).expiresIn, 540);
      assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
    }
    assert.equal(DB.rows('SELECT tts_count FROM usage_tracking')[0].tts_count, 2);
    assert.deepEqual(DB.rows('SELECT * FROM narration_requests'), []);
  }
});

test('failed speech token configuration preserves the narration allowance', async () => {
  const DB = await setup();
  const response = await onRequestGet({ request: request(true), env: { DB } });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'Speech service not configured');
  assert.equal(DB.rows('SELECT tts_count FROM usage_tracking')[0].tts_count, 2);
});

test('token bursts are atomically bounded separately from narration', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('test-only-token'); });
  const DB = await setup();
  const env = { DB, AZURE_SPEECH_KEY: 'test-only' };
  const responses = await Promise.all(Array.from({ length: 8 }, () => onRequestGet({ request: request(true), env })));
  assert.equal(responses.filter(response => response.status === 200).length, 6);
  assert.equal(responses.filter(response => response.status === 429).length, 2);
  assert.equal(calls, 6);
  assert.equal(DB.rows('SELECT tts_count FROM usage_tracking')[0].tts_count, 2);
});

for (const stalledPart of ['headers', 'body']) {
  test(`speech token ${stalledPart} stall has a bounded deadline without narration debit`, async t => {
    const DB = await setup();
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let called;
    const started = new Promise(resolve => { called = resolve; });
    let signal;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      signal = options.signal;
      called();
      if (stalledPart === 'headers') return new Promise(() => {});
      return new Response(new ReadableStream({ start() {} }));
    });
    const pending = onRequestGet({ request: request(true), env: { DB, AZURE_SPEECH_KEY: 'test-only' } });
    await started;
    await new Promise(resolve => setImmediate(resolve));
    t.mock.timers.tick(15000);
    for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
    const response = await Promise.race([pending, Promise.resolve(null)]);
    assert.notEqual(response, null);
    assert.equal(response.status, 503);
    assert.equal(signal.aborted, true);
    assert.equal(DB.rows('SELECT tts_count FROM usage_tracking')[0].tts_count, 2);
  });
}
