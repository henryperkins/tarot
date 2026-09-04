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
