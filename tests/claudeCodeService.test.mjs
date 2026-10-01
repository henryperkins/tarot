import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createClaudeCodeServer } from '../services/claude-code/server.mjs';
import { buildSubscriptionEnv, parseClaudeOutput } from '../services/claude-code/runner.mjs';

const token = 'test-only-'.repeat(5);
const body = { task: 'question', systemPrompt: 'Ask a question.', messages: [{ role: 'user', content: 'Career' }] };
const result = { provider: 'claude-code', text: 'What matters to you?', structured: null, model: 'claude-test', usage: {} };
async function service(t, options = {}) {
  const server = createClaudeCodeServer({ token, run: async () => result, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}
function send(url, input = body, options = {}) {
  return fetch(`${url}/v1/generate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input), ...options });
}

test('private gateway authenticates before accepting any generation', async t => {
  let calls = 0;
  const url = await service(t, { run: async () => { calls++; return result; } });
  assert.equal((await send(url, body, { headers: {} })).status, 401);
  assert.equal(calls, 0);
  assert.deepEqual(await (await send(url)).json(), result);
  assert.equal(calls, 1);
});

test('gateway rejects unknown tasks and oversized requests without inference', async t => {
  const url = await service(t, { maxBodyBytes: 512, run: async () => assert.fail('invalid input reached inference') });
  assert.equal((await send(url, { ...body, task: 'shell' })).status, 400);
  assert.equal((await send(url, { ...body, systemPrompt: 'x'.repeat(1024) })).status, 413);
});

test('gateway caps concurrency and queue and cancels disconnected active work', async t => {
  let started;
  const running = new Promise(resolve => { started = resolve; });
  let cancelled;
  const stopped = new Promise(resolve => { cancelled = resolve; });
  const url = await service(t, {
    concurrency: 1, maxQueue: 0,
    run: async (_input, { signal }) => {
      started();
      await new Promise((resolve, reject) => signal.addEventListener('abort', () => { cancelled(); reject(new Error('cancelled')); }, { once: true }));
    }
  });
  const controller = new AbortController();
  const first = send(url, body, { signal: controller.signal });
  first.catch(() => {});
  await running;
  assert.equal((await send(url)).status, 429);
  controller.abort();
  await assert.rejects(first);
  await stopped;
});

test('subscription environment excludes inherited API, provider and agent settings', () => {
  const clean = buildSubscriptionEnv({ HOME: '/test', PATH: '/bin', ANTHROPIC_API_KEY: 'paid', ANTHROPIC_AUTH_TOKEN: 'paid', ANTHROPIC_BASE_URL: 'https://proxy', CLAUDE_CODE_USE_FOUNDRY: '1', CLAUDE_CODE_OAUTH_TOKEN: 'personal', CLAUDE_CODE_BARE: '1', NODE_OPTIONS: '--require bad.js' });
  assert.equal(clean.HOME, '/test');
  for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_BARE', 'NODE_OPTIONS']) assert.equal(clean[key], undefined);
});

test('CLI parser accepts only complete successful output and captures actual model', () => {
  const init = { type: 'system', subtype: 'init', model: 'claude-test' };
  const done = { type: 'result', subtype: 'success', is_error: false, result: 'An answer.', stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 3 } };
  const output = [init, done].map(value => JSON.stringify(value)).join('\n');
  assert.deepEqual(parseClaudeOutput(output), { ...result, text: 'An answer.', usage: done.usage });
  for (const value of [{ ...done, stop_reason: 'max_tokens' }, { ...done, is_error: true }, { ...done, subtype: 'error_max_turns' }, init]) {
    assert.throws(() => parseClaudeOutput(JSON.stringify(value)), /complete|failed/i);
  }
  assert.throws(() => parseClaudeOutput(`${output}\n${JSON.stringify({ type: 'assistant', message: { content: 'late data' } })}`), /complete/i);
});

test('queued requests expire and disconnected queued work never starts', async t => {
  let finish;
  let start;
  const started = new Promise(resolve => { start = resolve; });
  let calls = 0;
  const url = await service(t, { maxQueue: 1, queueTimeoutMs: 25, run: async (_input, { signal }) => {
    calls++; start();
    await new Promise((resolve, reject) => {
      finish = resolve;
      signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    });
    return result;
  } });
  const first = send(url);
  await started;
  assert.equal((await send(url)).status, 429);
  const controller = new AbortController();
  const queued = send(url, body, { signal: controller.signal });
  queued.catch(() => {});
  await new Promise(resolve => setTimeout(resolve, 10));
  controller.abort();
  await assert.rejects(queued);
  // fetch rejects locally before the peer observes the closed socket. Release
  // the active slot only after the service has processed that disconnection.
  let remaining = 1;
  for (let attempt = 0; attempt < 20 && remaining; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    const health = await fetch(`${url}/healthz`, { headers: { Authorization: `Bearer ${token}` } });
    remaining = (await health.json()).queued;
  }
  assert.equal(remaining, 0);
  finish();
  assert.equal((await first).status, 200);
  assert.equal(calls, 1);
});

test('CLI structured completion accepts tool_use only with a validated expected schema', () => {
  const schema = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'], additionalProperties: false };
  const output = [
    { type: 'system', subtype: 'init', model: 'claude-test' },
    { type: 'result', subtype: 'success', is_error: false, stop_reason: 'tool_use', result: '{"answer":"Hello"}', structured_output: { answer: 'Hello' }, usage: {} }
  ].map(value => JSON.stringify(value)).join('\n');
  assert.deepEqual(parseClaudeOutput(output, schema).structured, { answer: 'Hello' });
  assert.throws(() => parseClaudeOutput(output), /complete|failed/);
  assert.throws(() => parseClaudeOutput(output.replace('"answer":"Hello"}', '"wrong":"Hello"}'), schema), /structured|complete/);
});

test('gateway shutdown aborts active and queued requests without starting queued inference', async t => {
  let started;
  const running = new Promise(resolve => { started = resolve; });
  let calls = 0;
  let cancelled = 0;
  const server = createClaudeCodeServer({ token, run: async (_input, { signal }) => {
    calls++;
    started();
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => {
      cancelled++;
      reject(new Error('cancelled'));
    }, { once: true }));
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.shutdown());
  const url = `http://127.0.0.1:${server.address().port}`;
  const first = send(url).catch(() => null);
  await running;
  const second = send(url).catch(() => null);
  let queued = 0;
  for (let attempt = 0; attempt < 40 && !queued; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    const health = await fetch(`${url}/healthz`, { headers: { Authorization: `Bearer ${token}` } });
    queued = (await health.json()).queued;
  }
  assert.equal(queued, 1);
  const stopped = server.shutdown();
  assert.equal(server.shutdown(), stopped);
  await stopped;
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(cancelled, 1);
});
