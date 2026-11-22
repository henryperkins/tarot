import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeBufferedCodexReading, streamCodexSubscription } from '../functions/lib/codexSubscription.js';

const env = { CODEX_SUBSCRIPTION_GATEWAY_URL: 'https://codex.test', CODEX_SUBSCRIPTION_GATEWAY_TOKEN: 'test', CODEX_SUBSCRIPTION_TIMEOUT_MS: 1000 };
const input = { task: 'reading', systemPrompt: 'Interpret the supplied cards.', messages: [{ role: 'user', content: 'The Star' }] };
const result = text => ({ provider: 'codex-subscription', model: 'codex-test', modelSource: 'configured', text, structured: null, usage: {} });
const encoder = new TextEncoder();
const event = (type, data) => encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

test('buffered Codex readings wait through keepalives and return only the validated completion', async t => {
  const selected = { ...input, model: 'codex-test' };
  const completed = { ...result('The Star offers hope.'), usage: { input_tokens: 12, output_tokens: 5 } };
  let upstream;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Accept, 'text/event-stream; mode=buffered');
    assert.deepEqual(JSON.parse(options.body), selected);
    return new Response(new ReadableStream({ start(controller) {
      upstream = controller;
      controller.enqueue(event('meta', { provider: 'codex-subscription' }));
      controller.enqueue(encoder.encode(': keepalive\n\n'));
      controller.enqueue(event('delta', { text: completed.text }));
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  let settled = false;
  const reading = completeBufferedCodexReading(env, selected).then(value => { settled = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  upstream.enqueue(event('done', completed));
  assert.deepEqual(await reading, completed);
});

test('buffered Codex readings reject missing, inconsistent or wrong-model completions', async t => {
  const completion = result('The Star offers hope.');
  for (const [terminal, message] of [
    [null, /without completion/],
    [{ ...completion, text: 'Different source.' }, /does not match/],
    [{ ...completion, model: 'different-model' }, /different model/]
  ]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(event('delta', { text: completion.text }));
      if (terminal) controller.enqueue(event('done', terminal));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } }));
    await assert.rejects(completeBufferedCodexReading(env, { ...input, model: 'codex-test' }), message);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

for (const stop of ['cancel', 'timeout']) {
  test(`a buffered Codex reading stops on ${stop} even when the gateway sends keepalives`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const controller = new AbortController();
    let fetchSignal;
    let upstream;
    let cancelled = false;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      fetchSignal = options.signal;
      return new Response(new ReadableStream({
        start(stream) { upstream = stream; },
        cancel() { cancelled = true; }
      }), { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const pending = completeBufferedCodexReading(env, { ...input, signal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    t.mock.timers.tick(750);
    upstream.enqueue(encoder.encode(': keepalive\n\n'));
    await new Promise(resolve => setImmediate(resolve));
    if (stop === 'cancel') controller.abort();
    else t.mock.timers.tick(250);
    await assert.rejects(pending, stop === 'cancel' ? /cancel/ : /timed out/);
    assert.equal(fetchSignal.aborted, true);
    assert.equal(cancelled, true);
  });
}

test('Codex transport exposes deltas while the gateway completion remains pending', async t => {
  let upstream;
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Accept, 'text/event-stream');
    assert.equal(options.redirect, 'manual');
    return new Response(new ReadableStream({ start(controller) { upstream = controller; }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const iterator = streamCodexSubscription(env, input);
  const first = iterator.next();
  await new Promise(resolve => setImmediate(resolve));
  upstream.enqueue(event('delta', { text: 'The Star offers hope.\n\n' }));
  assert.deepEqual((await first).value, { type: 'delta', text: 'The Star offers hope.\n\n' });
  upstream.enqueue(event('delta', { text: 'Begin gently.' }));
  assert.equal((await iterator.next()).value.text, 'Begin gently.');
  upstream.enqueue(event('done', result('The Star offers hope.\n\nBegin gently.')));
  const completed = await iterator.next();
  assert.equal(completed.value.type, 'done');
  assert.equal(completed.value.result.text, 'The Star offers hope.\n\nBegin gently.');
  assert.equal((await iterator.next()).done, true);
  assert.equal(cancelled, true);
});

test('Codex transport preserves split UTF-8 and rejects a divergent final source', async t => {
  const make = (finalText) => new Response(new ReadableStream({ start(controller) {
    const bytes = event('delta', { text: 'Espérance\n\n' });
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.enqueue(event('done', result(finalText)));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
  t.mock.method(globalThis, 'fetch', async () => make('Espérance\n\n'));
  const events = [];
  for await (const item of streamCodexSubscription(env, input)) events.push(item);
  assert.equal(events[0].text, 'Espérance\n\n');
  t.mock.method(globalThis, 'fetch', async () => make('A replacement reading.'));
  await assert.rejects(async () => { for await (const _ of streamCodexSubscription(env, input)) { /* drain */ } }, /match|source/i);
});

test('Codex transport fails on truncated and explicit error streams without synthesizing a done event', async t => {
  for (const ending of ['truncated', 'error']) {
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(event('delta', { text: 'A beginning.' }));
      if (ending === 'error') controller.enqueue(event('error', { message: 'private upstream failure' }));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } }));
    const seen = [];
    await assert.rejects(async () => { for await (const item of streamCodexSubscription(env, input)) seen.push(item); }, error => !error.message.includes('private upstream'));
    assert.deepEqual(seen, [{ type: 'delta', text: 'A beginning.' }]);
    t.mock.restoreAll();
  }
});

test('a different personal Readings model cannot complete an explicit selection stream', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(event('delta', { text: 'The Star.' }));
    controller.enqueue(event('done', result('The Star.')));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const events = streamCodexSubscription(env, { ...input, model: 'personal-test' });
  assert.equal((await events.next()).value.type, 'delta');
  await assert.rejects(events.next(), /different model/);
});

test('Codex transport aborts an in-progress body and cancels when its consumer stops early', async t => {
  for (const mode of ['abort', 'return']) {
    const controller = new AbortController();
    let cancelled = false;
    let signal;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      signal = options.signal;
      return new Response(new ReadableStream({ start(stream) { stream.enqueue(event('delta', { text: 'The Star' })); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
    });
    const iterator = streamCodexSubscription(env, { ...input, signal: controller.signal });
    assert.equal((await iterator.next()).value.text, 'The Star');
    if (mode === 'abort') {
      const pending = iterator.next();
      controller.abort();
      await assert.rejects(pending, /cancel/);
    } else await iterator.return();
    assert.equal(signal.aborted, true);
    assert.equal(cancelled, true);
    t.mock.restoreAll();
  }
});
