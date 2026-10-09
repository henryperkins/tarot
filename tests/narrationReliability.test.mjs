import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestPost as narrate } from '../functions/api/tts.js';
import { onRequestPost as retiredHume } from '../functions/api/tts-hume.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const request = (text, stream = false, signal) => new Request(`https://example.test/api/tts${stream ? '?stream=true' : ''}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.30' }, body: JSON.stringify({ text, provider: 'deepgram' }), signal
});
const used = DB => DB.rows('SELECT used, reserved FROM narration_monthly_usage');

for (const stream of [false, true]) {
  test(`implausibly short ${stream ? 'streamed' : 'buffered'} audio logs counts without private text`, async t => {
    const DB = await createD1();
    const text = 'Private reading content. '.repeat(10);
    const warn = t.mock.method(console, 'warn', () => {});
    const AI = { run: async () => new Response(new Uint8Array(12)).body };
    const response = await narrate({ request: request(text, stream), env: { DB, AI } });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    assert.equal(warn.mock.callCount(), 1);
    const message = warn.mock.calls[0].arguments[0];
    assert.match(message, /piece 1\/1 returned 12 bytes/);
    assert.match(message, new RegExp(`${text.trim().length} characters`));
    assert.ok(!message.includes('Private reading content'));
    assert.deepEqual(used(DB), [{ used: 1, reserved: 0 }]);
  });
}

test('short snippets and normally sized audio do not raise a diagnostic warning', async t => {
  const DB = await createD1();
  const warn = t.mock.method(console, 'warn', () => {});
  for (const [text, bytes] of [['A short snippet.', 12], ['A'.repeat(120), 120 * 390]]) {
    const response = await narrate({ request: request(text), env: { DB, AI: {
      run: async () => new Response(new Uint8Array(bytes)).body
    } } });
    assert.equal(response.status, 200);
  }
  assert.equal(warn.mock.callCount(), 0);
});

test('the retired Hume route does not debit or call a provider', async () => {
  const DB = await createD1();
  const response = await retiredHume({ request: request('A reading.'), env: { DB } });
  assert.equal(response.status, 410);
  assert.deepEqual(used(DB), []);
});

test('long narration preserves the end and uses one allowance unit', async () => {
  const DB = await createD1();
  const text = 'A'.repeat(5000) + ' THE END';
  const pieces = [];
  const AI = { run: async (_model, input) => { pieces.push(input.text); return new Response(input.text).body; } };
  const response = await narrate({ request: request(text), env: { DB, AI } });
  assert.equal(response.status, 200);
  assert.equal(pieces.join(' '), text.match(/A{1,1900}/g).join(' ') + ' THE END');
  assert.ok(pieces.at(-1).endsWith('THE END'));
  assert.deepEqual(used(DB), [{ used: 1, reserved: 0 }]);
});

test('oversized narration is rejected without silent truncation or synthesis', async () => {
  const DB = await createD1();
  let calls = 0;
  const response = await narrate({ request: request('x'.repeat(64001)), env: { DB, AI: { run: async () => { calls++; } } } });
  assert.equal(response.status, 413);
  assert.equal(calls, 0);
  assert.deepEqual(used(DB), []);
});

test('provider failure returns a retryable error and releases the allowance', async () => {
  const DB = await createD1();
  const response = await narrate({ request: request('A reading.'), env: { DB, AI: { run: async () => { throw new Error('Provider unavailable'); } } } });
  assert.equal(response.status, 503);
  assert.deepEqual(used(DB), [{ used: 0, reserved: 0 }]);
});

test('stream body failure releases rather than settling partial narration', async () => {
  const DB = await createD1();
  const AI = { run: async () => new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.error(new Error('Truncated body')); } }) };
  const response = await narrate({ request: request('A reading.', true), env: { DB, AI } });
  assert.equal(response.status, 200);
  await assert.rejects(response.arrayBuffer(), /Truncated body/);
  assert.deepEqual(used(DB), [{ used: 0, reserved: 0 }]);
});

test('the body deadline cancels a stalled audio stream and releases its reservation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const DB = await createD1();
  let cancelled = false;
  const AI = { run: async () => new ReadableStream({ cancel() { cancelled = true; } }) };
  const response = await narrate({ request: request('A reading.', true), env: { DB, AI } });
  const reading = response.arrayBuffer();
  t.mock.timers.tick(120000);
  await assert.rejects(reading, /timed out/);
  assert.equal(cancelled, true);
  assert.deepEqual(used(DB), [{ used: 0, reserved: 0 }]);
});

test('consumer cancellation stops body consumption and releases once', async () => {
  const DB = await createD1();
  let cancelled = false;
  const AI = { run: async () => new ReadableStream({ cancel() { cancelled = true; } }) };
  const response = await narrate({ request: request('A reading.', true), env: { DB, AI } });
  await response.body.cancel();
  assert.equal(cancelled, true);
  assert.deepEqual(used(DB), [{ used: 0, reserved: 0 }]);
});

test('a hung upstream cancellation cannot delay a body-deadline refund', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const DB = await createD1();
  const AI = { run: async () => new ReadableStream({ cancel() { return new Promise(() => {}); } }) };
  const response = await narrate({ request: request('A reading.', true), env: { DB, AI } });
  const reading = response.arrayBuffer().then(() => 'completed', () => 'failed');
  t.mock.timers.tick(120000);
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  const result = await Promise.race([reading, Promise.resolve('still pending')]);
  assert.equal(result, 'failed');
  assert.deepEqual(used(DB), [{ used: 0, reserved: 0 }]);
});

test('pre-aborted requests never start paid inference', async () => {
  const DB = await createD1();
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const response = await narrate({ request: request('A reading.', true, controller.signal), env: { DB, AI: { run: async () => { calls++; return new Response('audio').body; } } } });
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
  assert.deepEqual(used(DB), [{ used: 0, reserved: 0 }]);
});

test('caller abort refunds even when the upstream cancellation never resolves', async () => {
  const DB = await createD1();
  const controller = new AbortController();
  const AI = { run: async () => new ReadableStream({ cancel() { return new Promise(() => {}); } }) };
  const response = await narrate({ request: request('A reading.', true, controller.signal), env: { DB, AI } });
  const reading = response.arrayBuffer().then(() => 'completed', () => 'failed');
  controller.abort();
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(await Promise.race([reading, Promise.resolve('still pending')]), 'failed');
  assert.deepEqual(used(DB), [{ used: 0, reserved: 0 }]);
});
