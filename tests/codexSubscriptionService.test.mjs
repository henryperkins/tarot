import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

const token = 'codex-test-token-that-is-at-least-32-characters';
const input = { task: 'reading', systemPrompt: 'Interpret.', messages: [{ role: 'user', content: 'The Star.' }] };
const result = { provider: 'codex-subscription', text: 'A reading.', structured: null, model: 'gpt-6.1-sol', modelSource: 'configured', usage: {} };

test('Codex gateway authenticates requests, validates bodies and isolates upstream errors', async t => {
  const module = await import('../services/codex-subscription/server.mjs').catch(() => null);
  assert.ok(module?.createCodexSubscriptionServer, 'Codex gateway must be implemented');
  let calls = 0;
  const server = module.createCodexSubscriptionServer({ token, run: async request => {
    calls++;
    if (request.messages[0].content === 'error') throw new Error('private credential');
    return result;
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.shutdown());
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (body, auth = token) => fetch(`${url}/v1/generate`, { method: 'POST', headers: { Authorization: `Bearer ${auth}` }, body: JSON.stringify(body) });
  assert.equal((await post(input, 'invalid')).status, 401);
  assert.equal((await post({})).status, 400);
  assert.equal(calls, 0);
  assert.deepEqual(await (await post(input)).json(), result);
  const failure = await post({ ...input, messages: [{ role: 'user', content: 'error' }] });
  assert.equal(failure.status, 503);
  assert.doesNotMatch(await failure.text(), /private credential/);
  const health = await fetch(`${url}/healthz`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await health.json()).provider, 'codex-subscription');
});

test('gateway cancellation drains the owned runner before shutdown completes', async t => {
  const { createCodexSubscriptionServer } = await import('../services/codex-subscription/server.mjs');
  let started;
  const admitted = new Promise(resolve => { started = resolve; });
  let cleaned = false;
  const server = createCodexSubscriptionServer({ token, run: async (_input, { signal }) => {
    started();
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    await new Promise(resolve => setTimeout(resolve, 20));
    cleaned = true;
    throw new Error('cancelled');
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.shutdown());
  const pending = fetch(`http://127.0.0.1:${server.address().port}/v1/generate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) }).catch(() => null);
  await admitted;
  await server.shutdown();
  assert.equal(cleaned, true);
  await pending;
});

test('SSE gateway forwards a delta while generation is still pending and preserves exact done text', async t => {
  const { createCodexSubscriptionServer } = await import('../services/codex-subscription/server.mjs');
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const server = createCodexSubscriptionServer({ token, run: async (_input, { onDelta }) => {
    onDelta('First. ');
    await gate;
    onDelta('Second.');
    return { ...result, text: 'First. Second.' };
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { finish(); return server.shutdown(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, body: JSON.stringify(input)
  });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /event: delta/);
  assert.match(first, /First\. /);
  assert.doesNotMatch(first, /event: done/);
  finish();
  let rest = '';
  while (true) { const next = await reader.read(); if (next.done) break; rest += new TextDecoder().decode(next.value); }
  assert.match(rest, /event: done/);
  assert.match(rest, /First\. Second\./);
});

test('SSE gateway ends with a sanitized error after partial generation fails', async t => {
  const { createCodexSubscriptionServer } = await import('../services/codex-subscription/server.mjs');
  const server = createCodexSubscriptionServer({ token, run: async (_input, { onDelta }) => {
    onDelta('A partial reading.');
    throw new Error('private provider detail');
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.shutdown());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, body: JSON.stringify(input)
  });
  const body = await response.text();
  assert.match(body, /event: delta/);
  assert.match(body, /event: error/);
  assert.doesNotMatch(body, /event: done|private provider detail/);
});
