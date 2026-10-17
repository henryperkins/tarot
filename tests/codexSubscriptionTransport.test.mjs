import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callCodexSubscription } from '../functions/lib/codexSubscription.js';
import { callPersonalTextProvider, getPersonalTextAccessError, getPersonalTextProvider } from '../functions/lib/personalTextProvider.js';

const env = {
  TEXT_PROVIDER: 'codex-subscription', CODEX_SUBSCRIPTION_OWNER_USER_ID: 'owner',
  CODEX_SUBSCRIPTION_GATEWAY_URL: 'https://codex.example.test', CODEX_SUBSCRIPTION_GATEWAY_TOKEN: 'test-token', CODEX_SUBSCRIPTION_TIMEOUT_MS: '1000'
};
const input = { task: 'reading', systemPrompt: 'Interpret the supplied cards.', messages: [{ role: 'user', content: 'The Star. How can I begin?' }] };
const result = { provider: 'codex-subscription', text: 'The Star offers a gentle beginning.', structured: null, model: 'codex-test', modelSource: 'configured', usage: { input_tokens: 12, output_tokens: 9 } };

test('Codex gateway preserves prompts, model provenance and usage without subscription credentials', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://codex.example.test/v1/generate');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(options.body), input);
    return Response.json(result);
  });
  assert.deepEqual(await callPersonalTextProvider(env, input), result);
});

test('personal provider selection fails closed on unknown modes and unselected inference', () => {
  assert.equal(getPersonalTextProvider({ TEXT_PROVIDER: ' CODEX-SUBSCRIPTION ' }), 'codex-subscription');
  assert.equal(getPersonalTextProvider({ TEXT_PROVIDER: 'legacy' }), null);
  assert.equal(getPersonalTextProvider({}), null);
  assert.throws(() => getPersonalTextProvider({ TEXT_PROVIDER: 'codex' }), /Invalid TEXT_PROVIDER/);
  assert.throws(() => callPersonalTextProvider({}, input), /not selected/);
});

test('Codex owner access rejects missing configuration, other accounts and service users', () => {
  assert.equal(getPersonalTextAccessError(env, { id: 'owner' }), null);
  for (const user of [null, { id: 'other' }, { id: 'owner', auth_provider: 'service' }]) {
    assert.equal(getPersonalTextAccessError(env, user).status, 403);
  }
  assert.equal(getPersonalTextAccessError({ ...env, CODEX_SUBSCRIPTION_OWNER_USER_ID: '' }, { id: 'owner' }).status, 503);
});

test('Codex transport rejects redirects without following or revealing gateway details', async t => {
  for (const status of [301, 302, 303, 307, 308]) {
    let calls = 0;
    let cancelled = false;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      calls++;
      assert.equal(options.redirect, 'manual');
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status, headers: { Location: 'https://untrusted.example/private' } });
    });
    await assert.rejects(callCodexSubscription(env, input), error => error.status === status && !/untrusted|test-token/.test(error.message));
    assert.equal(calls, 1);
    assert.equal(cancelled, true);
    t.mock.restoreAll();
  }
});

test('Codex gateway credentials are never sent to insecure or ambiguous URLs', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('invalid destination contacted'));
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com?token=x', 'https://example.com#fragment']) {
    await assert.rejects(callCodexSubscription({ ...env, CODEX_SUBSCRIPTION_GATEWAY_URL: url }, input), /gateway URL/);
  }
});

test('Codex transport bounds output bytes and rejects malformed UTF-8, JSON and provider payloads', async t => {
  const fixtures = [
    () => new Response('private error text', { status: 429 }),
    () => new Response(new Uint8Array([0xff])),
    () => new Response('not JSON'),
    () => new Response('x'.repeat(2097153)),
    () => Response.json({ ...result, provider: 'claude-code' }),
    () => Response.json({ ...result, text: '' }),
    () => Response.json({ text: 'partial' })
  ];
  for (const makeResponse of fixtures) {
    t.mock.method(globalThis, 'fetch', async () => makeResponse());
    await assert.rejects(callCodexSubscription(env, input), error => !error.message.includes('private error text'));
    t.mock.restoreAll();
  }
});

test('Codex cancellation stops both pending connection and stalled response reads', async t => {
  for (const phase of ['fetch', 'body']) {
    const controller = new AbortController();
    let downstreamSignal;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      downstreamSignal = options.signal;
      return phase === 'fetch' ? new Promise(() => {}) : new Response(new ReadableStream({ start() {} }));
    });
    const pending = callCodexSubscription(env, { ...input, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(pending, /cancel/i);
    assert.equal(downstreamSignal.aborted, true);
    t.mock.restoreAll();
  }
});

test('Codex transport times out a stalled body and cancels upstream work', async t => {
  let cancelled = false;
  let signal;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    signal = options.signal;
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  });
  await assert.rejects(callCodexSubscription(env, input), /timed out/);
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
});

test('Codex structured responses are validated before application tool execution', async t => {
  const responseSchema = { type: 'object', additionalProperties: false, required: ['answer'], properties: { answer: { type: 'string' } } };
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ...result, structured: { command: 'unexpected' } }));
  await assert.rejects(callCodexSubscription(env, { ...input, responseSchema }), /structured/);
});
