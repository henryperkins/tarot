import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callClaudeCode, getClaudeCodeAccessError } from '../functions/lib/claudeCode.js';

const env = {
  TEXT_PROVIDER: 'claude-code',
  CLAUDE_CODE_GATEWAY_URL: 'https://claude.example.test',
  CLAUDE_CODE_GATEWAY_TOKEN: 'test-token',
  CLAUDE_CODE_OWNER_USER_ID: 'owner',
  CLAUDE_CODE_TIMEOUT_MS: '1000'
};
const input = { task: 'question', systemPrompt: 'Ask one question.', messages: [{ role: 'user', content: 'Career change' }] };
const result = { provider: 'claude-code', text: 'What would help you explore this change?', structured: null, model: 'claude-test', usage: { input_tokens: 12, output_tokens: 9 } };

test('Claude transport preserves prompts, returned model and usage without sending subscription credentials', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://claude.example.test/v1/generate');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(options.body), input);
    return Response.json(result);
  });
  assert.deepEqual(await callClaudeCode(env, input), result);
});

test('Claude transport rejects failed, partial and empty responses', async t => {
  for (const response of [
    () => new Response('private upstream details', { status: 429 }),
    () => Response.json({ ...result, text: '' }),
    () => Response.json({ ...result, provider: 'azure-anthropic' }),
    () => Response.json({ text: 'partial' })
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response());
    await assert.rejects(callClaudeCode(env, input), error => !error.message.includes('private upstream details'));
    t.mock.restoreAll();
  }
});

test('Claude transport cancellation covers stalled body consumption', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start() {} })));
  const pending = callClaudeCode(env, { ...input, signal: controller.signal });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, /cancel/i);
});

test('Claude gateway credentials are restricted to HTTPS or loopback HTTP', async () => {
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com?token=x']) {
    await assert.rejects(callClaudeCode({ ...env, CLAUDE_CODE_GATEWAY_URL: url }, input), /gateway URL/i);
  }
});

test('personal subscription access requires the configured authenticated owner', () => {
  assert.equal(getClaudeCodeAccessError(env, { id: 'owner' }), null);
  assert.equal(getClaudeCodeAccessError(env, { id: 'other' }).status, 403);
  assert.equal(getClaudeCodeAccessError(env, null).status, 403);
  assert.equal(getClaudeCodeAccessError({ ...env, CLAUDE_CODE_OWNER_USER_ID: '' }, { id: 'owner' }).status, 503);
  assert.equal(getClaudeCodeAccessError({}, null), null);
});
