import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { callModalChatCompletions } from '../functions/lib/modalChatCompletions.js';

const ENV = {
  MODAL_PROXY_TOKEN: 'wk-test.ws-test',
  MODAL_ENDPOINT_URL: 'https://example.modal.direct'
};

function completion(finishReason, content = 'A partial reading that ends before') {
  return new Response(JSON.stringify({
    id: 'modal-completion-test',
    object: 'chat.completion',
    model: 'Qwen/Qwen3.8-2.4T-A95B',
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: finishReason
    }]
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

describe('Modal completion finality', () => {
  for (const finishReason of ['length', 'content_filter', 'tool_calls', 'function_call', null, undefined, 'unknown']) {
    it(`rejects nonempty content with finish_reason ${String(finishReason)}`, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => completion(finishReason));

      await assert.rejects(
        callModalChatCompletions(ENV, { systemPrompt: 'System', userPrompt: 'Question' }),
        /Modal Chat Completions returned an incomplete response/
      );
    });
  }

  it('accepts text after a normal stop', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => completion('stop', '  A complete reading.  '));

    const result = await callModalChatCompletions(ENV, { systemPrompt: 'System', userPrompt: 'Question' });

    assert.equal(result.text, 'A complete reading.');
  });

  it('rejects an empty completion even after a normal stop', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => completion('stop', ' \n '));

    await assert.rejects(
      callModalChatCompletions(ENV, { systemPrompt: 'System', userPrompt: 'Question' }),
      /Modal Chat Completions returned no text content/
    );
  });
});

describe('Modal thinking and unconstrained output', () => {
  it('requests thinking without any application output cap, including a stale deployed cap variable', async (t) => {
    let body;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      body = JSON.parse(options.body);
      return completion('stop', 'A complete reading.');
    });
    await callModalChatCompletions({ ...ENV, MODAL_MAX_TOKENS: '8192' }, { systemPrompt: 'System', userPrompt: 'Question' });
    assert.equal(Object.hasOwn(body, 'max_tokens'), false);
    assert.equal(Object.hasOwn(body, 'max_completion_tokens'), false);
    assert.equal(body.chat_template_kwargs.enable_thinking, true);
    assert.equal(body.chat_template_kwargs.preserve_thinking, true);
    assert.equal(body.reasoning_effort, 'medium');
  });

  for (const usage of [
    { completion_tokens_details: { reasoning_tokens: 508 } },
    { output_tokens_details: { reasoning_tokens: 664 } },
    { reasoning_tokens: 0 }
  ]) {
    it(`retains and logs actual reasoning evidence from ${JSON.stringify(usage)} without exposing private text`, async (t) => {
      const logs = [];
      t.mock.method(console, 'log', (...args) => logs.push(args));
      t.mock.method(globalThis, 'fetch', async () => Response.json({
        id: 'reasoning-evidence',
        choices: [{ finish_reason: 'stop', message: { content: 'A complete reading.', reasoning_content: 'PRIVATE_REASONING_MUST_STAY_PRIVATE' } }],
        usage
      }));
      const result = await callModalChatCompletions(ENV, { systemPrompt: 'System', userPrompt: 'Question' });
      const expected = usage.completion_tokens_details?.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens;
      assert.equal(result.usage.output_tokens_details.reasoning_tokens, expected);
      assert.equal(result.usage.reasoning_content_present, true);
      const received = logs.find(([message]) => message.includes('Completion received'))[1];
      assert.equal(received.reasoningTokens, expected);
      assert.equal(received.reasoningContentPresent, true);
      assert.doesNotMatch(JSON.stringify({ result, logs }), /PRIVATE_REASONING_MUST_STAY_PRIVATE/);
    });
  }

  it('does not infer thinking from ordinary output counts when reasoning evidence is absent', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'A complete reading.' } }], usage: { completion_tokens: 100 } }));
    const result = await callModalChatCompletions(ENV, { systemPrompt: 'System', userPrompt: 'Question' });
    assert.equal(result.usage.reasoning_content_present, false);
    assert.equal(result.usage.output_tokens_details, undefined);
  });
});
