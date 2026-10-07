import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ANTHROPIC_DEFAULT_EFFORT,
  ANTHROPIC_DEFAULT_MODEL,
  ClaudeApiError,
  callClaudeMessages,
  ensureAnthropicConfig,
  generateClaudeText,
  isAnthropicConfigured
} from '../functions/lib/anthropicMessages.js';
import { generateClaudeApiFollowUp } from '../functions/lib/claudeApiFollowUp.js';
import { CLAUDE_API_URL_PREFIX, claudeErrorResponse, claudeSseResponse } from './helpers/claudeSse.mjs';

const ENV = { ANTHROPIC_API_KEY: 'test-only' };

function mockClaude(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(String(url).startsWith(CLAUDE_API_URL_PREFIX), `unexpected fetch: ${url}`);
    const headers = new Headers(init.headers);
    calls.push({ url: String(url), headers, body: JSON.parse(init.body) });
    const next = responses.shift();
    assert.ok(next, 'unexpected Claude call');
    return next();
  });
  return calls;
}

describe('Claude API configuration', () => {
  test('is available only with an API key', () => {
    assert.equal(isAnthropicConfigured({}), false);
    assert.equal(isAnthropicConfigured({ ANTHROPIC_API_KEY: '  ' }), false);
    assert.equal(isAnthropicConfigured(ENV), true);
    assert.throws(() => ensureAnthropicConfig({}), ClaudeApiError);
  });

  test('defaults to Opus 5.5 at xhigh effort and bounds the timeout', () => {
    const config = ensureAnthropicConfig(ENV);
    assert.equal(config.model, ANTHROPIC_DEFAULT_MODEL);
    assert.equal(ANTHROPIC_DEFAULT_MODEL, 'claude-opus-5-5');
    assert.equal(config.effort, ANTHROPIC_DEFAULT_EFFORT);
    assert.equal(config.effort, 'xhigh');
    assert.equal(config.timeoutMs, 300000);
    assert.equal(ensureAnthropicConfig({ ...ENV, ANTHROPIC_EFFORT: 'turbo' }).effort, 'xhigh');
    assert.equal(ensureAnthropicConfig({ ...ENV, ANTHROPIC_EFFORT: 'HIGH' }).effort, 'high');
    assert.equal(ensureAnthropicConfig({ ...ENV, ANTHROPIC_TIMEOUT_MS: '99999999' }).timeoutMs, 600000);
    assert.equal(ensureAnthropicConfig({ ...ENV, ANTHROPIC_MODEL: 'claude-sonnet-5-5' }).model, 'claude-sonnet-5-5');
  });
});

describe('callClaudeMessages', () => {
  test('sends an Opus 5.5 request with effort, refusal fallbacks and no sampling parameters', async (t) => {
    const calls = mockClaude(t, [() => claudeSseResponse([
      { type: 'thinking' },
      { type: 'text', text: 'First part. ' },
      { type: 'text', text: 'Second part.' }
    ])]);

    const result = await callClaudeMessages(ENV, {
      system: 'System prompt',
      messages: [{ role: 'user', content: 'User prompt' }],
      maxTokens: 32000,
      requestId: 'req-test'
    });

    assert.equal(result.text, 'First part. Second part.');
    assert.equal(result.model, 'claude-opus-5-5');
    assert.equal(result.stopReason, 'end_turn');
    assert.deepEqual(result.usage, { input_tokens: 120, output_tokens: 80, total_tokens: 200 });

    const [{ body, headers }] = calls;
    assert.equal(headers.get('x-api-key'), 'test-only');
    assert.match(headers.get('anthropic-beta'), /server-side-fallback-2026-07-01/);
    assert.equal(body.model, 'claude-opus-5-5');
    assert.equal(body.max_tokens, 32000);
    assert.deepEqual(body.output_config, { effort: 'xhigh' });
    assert.equal(body.fallbacks, 'default');
    assert.equal(body.stream, true);
    assert.equal(body.system, 'System prompt');
    assert.deepEqual(body.messages, [{ role: 'user', content: 'User prompt' }]);
    for (const rejected of ['temperature', 'top_p', 'top_k', 'thinking', 'tools']) {
      assert.ok(!(rejected in body), `${rejected} must not be sent`);
    }
  });

  test('uses a per-call effort when given', async (t) => {
    const calls = mockClaude(t, [() => claudeSseResponse('Short answer.')]);
    await generateClaudeText(ENV, { system: 'S', prompt: 'P', maxTokens: 4000, effort: 'low' });
    assert.deepEqual(calls[0].body.output_config, { effort: 'low' });
  });

  test('treats a refusal as a failure so callers can fall back', async (t) => {
    mockClaude(t, [() => claudeSseResponse('', {
      stopReason: 'refusal',
      stopDetails: { type: 'refusal', category: 'bio', explanation: null }
    })]);
    await assert.rejects(
      callClaudeMessages(ENV, { system: 'S', messages: [{ role: 'user', content: 'P' }], maxTokens: 1000 }),
      (error) => error instanceof ClaudeApiError && /declined the request \(bio\)/.test(error.message)
    );
  });

  test('treats a cut-off answer as a failure', async (t) => {
    mockClaude(t, [() => claudeSseResponse('Partial text', { stopReason: 'max_tokens' })]);
    await assert.rejects(
      callClaudeMessages(ENV, { system: 'S', messages: [{ role: 'user', content: 'P' }], maxTokens: 1000 }),
      /cut off \(max_tokens\)/
    );
  });

  test('reports only the HTTP status of an upstream error', async (t) => {
    mockClaude(t, [() => claudeErrorResponse(400)]);
    await assert.rejects(
      callClaudeMessages(ENV, { system: 'S', messages: [{ role: 'user', content: 'P' }], maxTokens: 1000 }),
      (error) => error.message === 'Claude API request failed (HTTP 400).' && !error.message.includes('private')
    );
  });

  test('stops when the caller cancels', async (t) => {
    mockClaude(t, []);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      callClaudeMessages(ENV, { system: 'S', messages: [{ role: 'user', content: 'P' }], maxTokens: 1000, signal: controller.signal }),
      /cancelled/
    );
  });

  test('rejects a missing output ceiling before calling the API', async (t) => {
    mockClaude(t, []);
    await assert.rejects(
      callClaudeMessages(ENV, { system: 'S', messages: [{ role: 'user', content: 'P' }] }),
      /maxTokens/
    );
  });
});

describe('generateClaudeApiFollowUp', () => {
  test('runs the memory tool and sends the assistant turn back unchanged', async (t) => {
    const calls = mockClaude(t, [
      () => claudeSseResponse([
        { type: 'thinking' },
        { type: 'text', text: 'Noted.' },
        { type: 'tool_use', id: 'toolu_1', name: 'save_memory_note', input: { text: 'User prefers concrete steps.', category: 'communication' } }
      ], { stopReason: 'tool_use' }),
      () => claudeSseResponse('The Hermit asks you to slow down.')
    ]);
    const toolCalls = [];

    const result = await generateClaudeApiFollowUp(ENV, {
      systemPrompt: 'System',
      userPrompt: 'Question',
      enableMemoryTool: true,
      onToolCall: async (name, args) => {
        toolCalls.push({ name, args });
        return { success: true, message: 'Saved' };
      }
    });

    assert.equal(result.text, 'Noted.\n\nThe Hermit asks you to slow down.');
    assert.deepEqual(toolCalls, [{ name: 'save_memory_note', args: { text: 'User prefers concrete steps.', category: 'communication' } }]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.tools[0].name, 'save_memory_note');
    assert.deepEqual(calls[0].body.output_config, { effort: 'medium' });

    const [, assistantTurn, toolTurn] = calls[1].body.messages;
    assert.equal(assistantTurn.role, 'assistant');
    assert.deepEqual(assistantTurn.content.map((block) => block.type), ['thinking', 'text', 'tool_use']);
    assert.equal(assistantTurn.content[0].signature, 'test-signature');
    assert.equal(toolTurn.role, 'user');
    assert.equal(toolTurn.content[0].type, 'tool_result');
    assert.equal(toolTurn.content[0].tool_use_id, 'toolu_1');
    assert.deepEqual(JSON.parse(toolTurn.content[0].content), { success: true, message: 'Saved' });
    // The tool set and system prompt stay identical between turns.
    assert.deepEqual(calls[1].body.tools, calls[0].body.tools);
    assert.equal(calls[1].body.system, calls[0].body.system);
  });

  test('offers no tools when memory is off', async (t) => {
    const calls = mockClaude(t, [() => claudeSseResponse('Answer without memory.')]);
    const result = await generateClaudeApiFollowUp(ENV, { systemPrompt: 'S', userPrompt: 'Q', enableMemoryTool: false });
    assert.equal(result.text, 'Answer without memory.');
    assert.ok(!('tools' in calls[0].body));
  });

  test('stops after two memory rounds', async (t) => {
    const toolTurn = () => claudeSseResponse([
      { type: 'tool_use', id: `toolu_${Math.random()}`, name: 'save_memory_note', input: { text: 'Note text.', category: 'general' } }
    ], { stopReason: 'tool_use' });
    mockClaude(t, [toolTurn, toolTurn, toolTurn]);
    await assert.rejects(
      generateClaudeApiFollowUp(ENV, {
        systemPrompt: 'S', userPrompt: 'Q', enableMemoryTool: true,
        onToolCall: async () => ({ success: true })
      }),
      /round-trip limit/
    );
  });
});
