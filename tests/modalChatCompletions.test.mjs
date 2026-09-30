import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as modal from '../functions/lib/modalChatCompletions.js';
const { callModalChatCompletions, ensureModalConfig } = modal;

const ENV = {
  MODAL_PROXY_TOKEN: 'wk-test.ws-test',
  MODAL_ENDPOINT_URL: 'https://example.modal.direct'
};

function completion(finishReason, content = 'A partial reading that ends before') {
  return new Response(JSON.stringify({
    id: 'modal-completion-test',
    object: 'chat.completion',
    model: 'Qwen/Qwen3.8-Max-VL-Thinking',
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
    assert.equal(body.reasoning_effort, 'high');
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

const PROMPTS = { systemPrompt: 'System', userPrompt: 'Question' };
const WEATHER = { type: 'function', function: { name: 'get_weather', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } } };
const CLOCK = { type: 'function', function: { name: 'get_time', parameters: { type: 'object' } } };

function streamed(events, { width = 7, ending = '\r\n', done = true } = {}) {
  const wire = ': keepalive' + ending + ending + events.map((event) =>
    `data: ${JSON.stringify(event)}${ending}${ending}`
  ).join('') + (done ? `data: [DONE]${ending}${ending}` : '');
  const bytes = new TextEncoder().encode(wire);
  return new Response(new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += width) controller.enqueue(bytes.slice(offset, offset + width));
      controller.close();
    }
  }), { headers: { 'content-type': 'text/event-stream' } });
}

function delta(value, finishReason = null, index = 0) {
  return { choices: [{ index, delta: value, finish_reason: finishReason }] };
}

describe('Modal configuration and request contract', () => {
  it('uses split credentials in preference to the legacy token and validates availability', async (t) => {
    const env = { ...ENV, MODAL_PROXY_TOKEN_ID: 'wk-new-test', MODAL_PROXY_TOKEN_SECRET: 'ws-new-test' };
    assert.equal(modal.isModalConfigured(env), true);
    assert.equal(ensureModalConfig(env).proxyToken, 'wk-new-test.ws-new-test');
    let request;
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return streamed([delta({ content: 'Complete.' }, 'stop')]);
    });
    const result = await callModalChatCompletions(env, PROMPTS);
    assert.equal(request.options.headers.Authorization, 'Bearer wk-new-test.ws-new-test');
    assert.equal(request.url, 'https://example.modal.direct/v1/chat/completions');
    assert.equal(request.body.model, 'Qwen/Qwen3.8-Max-VL-Thinking');
    assert.equal(request.body.stream, true);
    assert.deepEqual(request.body.stream_options, { include_usage: true });
    assert.equal(request.body.temperature, 0.3);
    assert.equal(request.body.top_p, 0.95);
    assert.equal(request.body.reasoning_effort, 'high');
    assert.equal(result.finishReason, 'stop');
    assert.deepEqual(result.toolCalls, []);
  });

  for (const pair of [
    { MODAL_PROXY_TOKEN_ID: 'wk-test' },
    { MODAL_PROXY_TOKEN_SECRET: 'ws-test' },
    { MODAL_PROXY_TOKEN_ID: '', MODAL_PROXY_TOKEN_SECRET: 'ws-test' },
    { MODAL_PROXY_TOKEN_ID: '', MODAL_PROXY_TOKEN_SECRET: '' }
  ]) {
    it(`fails closed for an incomplete declared pair (${Object.keys(pair).join(',')})`, () => {
      assert.throws(() => ensureModalConfig({ ...ENV, ...pair }), /MODAL_PROXY_TOKEN_ID.*MODAL_PROXY_TOKEN_SECRET/);
      assert.equal(modal.isModalConfigured({ ...ENV, ...pair }), false);
    });
  }

  it('preserves legacy credentials, normalizes supported URL forms, and rejects unsafe endpoints', () => {
    for (const suffix of ['', '/', '/v1', '/v1/', '/v1/chat/completions']) {
      assert.equal(ensureModalConfig({ ...ENV, MODAL_ENDPOINT_URL: `https://example.modal.direct${suffix}` }).url, 'https://example.modal.direct/v1/chat/completions');
    }
    assert.equal(ensureModalConfig(ENV).proxyToken, ENV.MODAL_PROXY_TOKEN);
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com?secret=x', 'https://example.com#fragment']) {
      assert.equal(modal.isModalConfigured({ ...ENV, MODAL_ENDPOINT_URL: url }), false);
    }
  });

  it('forwards multimodal messages, declared tools, explicit caps, and sampling overrides', async (t) => {
    const messages = [{ role: 'user', content: [{ type: 'text', text: 'What card is this?' }, { type: 'image_url', image_url: { url: 'https://example.com/card.png' } }] }];
    let body;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      body = JSON.parse(options.body);
      return completion('stop', 'The Hermit.');
    });
    await callModalChatCompletions({ ...ENV, MODAL_STREAM: 'false' }, { messages, tools: [WEATHER], toolChoice: 'none', maxTokens: 2048, temperature: 0.2, topP: 0.8 });
    assert.deepEqual(body.messages, messages);
    assert.deepEqual(body.tools, [WEATHER]);
    assert.equal(body.tool_choice, 'none');
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.temperature, 0.2);
    assert.equal(body.top_p, 0.8);
    assert.equal(body.stream, false);
    assert.equal(Object.hasOwn(body, 'stream_options'), false);
  });

  it('rejects invalid per-call options before sending a request', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => completion('stop'));
    for (const options of [{ maxTokens: 0 }, { maxTokens: 1.5 }, { temperature: -1 }, { topP: 2 }, { tools: [WEATHER], toolChoice: { type: 'function', function: { name: 'not_supplied' } } }]) {
      await assert.rejects(callModalChatCompletions(ENV, { ...PROMPTS, ...options }));
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  });
});

describe('Modal streamed finality and private reasoning', () => {
  for (const ending of ['\n', '\r\n', '\r']) {
    it(`handles fragmented UTF-8 and ${JSON.stringify(ending)} lines, ignores other choices, and retains usage tail`, async (t) => {
      const logs = [];
      t.mock.method(console, 'log', (...args) => logs.push(args));
      t.mock.method(globalThis, 'fetch', async () => streamed([
        delta({ reasoning_content: 'PRIVATE_REASONING_SENTINEL' }),
        delta({ content: 'OTHER_CHOICE_SENTINEL' }, 'stop', 1),
        delta({ content: '  Café ✨' }),
        delta({ content: ' completed.  ' }, 'stop'),
        { choices: [], usage: { prompt_tokens: 11, completion_tokens: 12, total_tokens: 23, completion_tokens_details: { reasoning_tokens: 7 } } }
      ], { width: 1, ending }));
      const result = await callModalChatCompletions(ENV, PROMPTS);
      assert.equal(result.text, 'Café ✨ completed.');
      assert.equal(result.finishReason, 'stop');
      assert.deepEqual(result.usage, { input_tokens: 11, output_tokens: 12, total_tokens: 23, output_tokens_details: { reasoning_tokens: 7 }, reasoning_content_present: true });
      assert.doesNotMatch(JSON.stringify({ result, logs }), /PRIVATE_REASONING_SENTINEL|OTHER_CHOICE_SENTINEL/);
    });
  }

  it('parses multi-line SSE data events', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('data: {"choices":\ndata: [{"index":0,"delta":{"content":"Complete."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }));
    assert.equal((await callModalChatCompletions(ENV, PROMPTS)).text, 'Complete.');
  });

  for (const { label, events, done } of [
    { label: 'EOF without DONE', events: [delta({ content: 'Partial' }, 'stop')], done: false },
    { label: 'DONE without finish', events: [delta({ content: 'Partial' })], done: true },
    { label: 'length finish', events: [delta({ content: 'Partial' }, 'length')], done: true },
    { label: 'content filter finish', events: [delta({ content: 'Partial' }, 'content_filter')], done: true },
    { label: 'content after finish', events: [delta({ content: 'Done' }, 'stop'), delta({ content: 'Unexpected' })], done: true },
    { label: 'empty stop', events: [delta({ reasoning_content: 'PRIVATE_REASONING_SENTINEL' }, 'stop')], done: true }
  ]) {
    it(`rejects ${label}`, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => streamed(events, { done }));
      await assert.rejects(callModalChatCompletions(ENV, PROMPTS), /incomplete response|no text content/);
    });
  }

  for (const mode of ['json', 'sse', 'http']) {
    it(`keeps upstream ${mode} failures out of errors and logs`, async (t) => {
      const logs = [];
      for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, (...args) => logs.push(args));
      t.mock.method(globalThis, 'fetch', async () => mode === 'sse'
        ? new Response('data: {"error":"PRIVATE_UPSTREAM_SENTINEL"}\n\n', { headers: { 'content-type': 'text/event-stream' } })
        : new Response('PRIVATE_UPSTREAM_SENTINEL', { status: mode === 'http' ? 401 : 200, headers: { 'content-type': 'application/json', 'x-secret': 'PRIVATE_HEADER_SENTINEL' } }));
      let caught;
      try { await callModalChatCompletions(ENV, PROMPTS); } catch (error) { caught = error; }
      assert.ok(caught);
      assert.doesNotMatch(JSON.stringify({ message: caught.message, logs }), /PRIVATE_UPSTREAM_SENTINEL|PRIVATE_HEADER_SENTINEL/);
    });
  }
});

describe('Modal explicit tool completions', () => {
  it('accepts nullable unchanged tool fields in the live Modal SSE shape', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => streamed([
      delta({ content: null, tool_calls: null }),
      delta({ tool_calls: [{ index: 0, id: 'call_weather', type: 'function', function: { name: 'get_weather', arguments: '{' } }] }),
      delta({ tool_calls: [{ index: 0, id: null, type: 'function', function: { name: null, arguments: '"city": "Paris"' } }] }),
      delta({ tool_calls: [{ index: 0, id: null, type: null, function: { name: null, arguments: null } }] }),
      delta({ tool_calls: [{ index: 0, id: null, type: 'function', function: { name: null, arguments: '}' } }] }),
      delta({ content: null, tool_calls: null }, 'tool_calls'),
      { choices: [], usage: { prompt_tokens: 12, completion_tokens: 20 } }
    ]));
    const result = await callModalChatCompletions(ENV, { ...PROMPTS, tools: [WEATHER], toolChoice: 'auto' });
    assert.deepEqual(result.toolCalls, [{ id: 'call_weather', type: 'function', function: { name: 'get_weather', arguments: '{"city": "Paris"}' } }]);
    assert.equal(result.finishReason, 'tool_calls');
    assert.equal(result.usage.output_tokens, 20);
  });

  it('assembles interleaved indexed tool arguments without executing tools', async (t) => {
    const events = [
      delta({ tool_calls: [{ index: 1, id: 'call_time', type: 'function', function: { name: 'get_time', arguments: '{' } }, { index: 0, id: 'call_weather', type: 'function', function: { name: 'get_weather', arguments: '{"city":' } }] }),
      delta({ tool_calls: [{ index: 0, function: { arguments: '"Paris"}' } }, { index: 1, function: { arguments: '}' } }] }),
      delta({}, 'tool_calls')
    ];
    t.mock.method(globalThis, 'fetch', async () => streamed(events));
    const result = await callModalChatCompletions(ENV, { ...PROMPTS, tools: [WEATHER, CLOCK], toolChoice: 'required' });
    assert.equal(result.text, '');
    assert.equal(result.finishReason, 'tool_calls');
    assert.deepEqual(result.toolCalls, [
      { id: 'call_weather', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } },
      { id: 'call_time', type: 'function', function: { name: 'get_time', arguments: '{}' } }
    ]);
  });

  it('accepts a configured named tool in buffered JSON mode', async (t) => {
    const toolCall = { id: 'call_weather', type: 'function', function: { name: 'get_weather', arguments: '{"city":"Paris"}' } };
    t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ index: 0, finish_reason: 'tool_calls', message: { content: null, tool_calls: [toolCall] } }] }));
    assert.deepEqual((await callModalChatCompletions(ENV, { ...PROMPTS, tools: [WEATHER], toolChoice: { type: 'function', function: { name: 'get_weather' } } })).toolCalls, [toolCall]);
  });

  for (const { label, options, call, finish = 'tool_calls' } of [
    { label: 'text-only caller', options: {}, call: { id: 'call_a', type: 'function', function: { name: 'get_weather', arguments: '{}' } } },
    { label: 'choice none', options: { tools: [WEATHER], toolChoice: 'none' }, call: { id: 'call_a', type: 'function', function: { name: 'get_weather', arguments: '{}' } } },
    { label: 'undeclared name', options: { tools: [WEATHER] }, call: { id: 'call_a', type: 'function', function: { name: 'other', arguments: '{}' } } },
    { label: 'wrong named choice', options: { tools: [WEATHER, CLOCK], toolChoice: { type: 'function', function: { name: 'get_weather' } } }, call: { id: 'call_a', type: 'function', function: { name: 'get_time', arguments: '{}' } } },
    { label: 'partial arguments', options: { tools: [WEATHER] }, call: { id: 'call_a', type: 'function', function: { name: 'get_weather', arguments: '{"city":' } } },
    { label: 'missing id', options: { tools: [WEATHER] }, call: { type: 'function', function: { name: 'get_weather', arguments: '{}' } } },
    { label: 'tool calls with stop', options: { tools: [WEATHER] }, call: { id: 'call_a', type: 'function', function: { name: 'get_weather', arguments: '{}' } }, finish: 'stop' }
  ]) {
    it(`rejects ${label}`, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ finish_reason: finish, message: { content: 'Possible answer', tool_calls: [call] } }] }));
      await assert.rejects(callModalChatCompletions(ENV, { ...PROMPTS, ...options }), /incomplete response|invalid tool/);
    });
  }

  it('rejects ordinary text when a tool is required', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => completion('stop', 'No tool.'));
    await assert.rejects(callModalChatCompletions(ENV, { ...PROMPTS, tools: [WEATHER], toolChoice: 'required' }), /incomplete response/);
  });
});

describe('Modal whole-response cancellation', () => {
  for (const mode of ['timeout', 'caller']) {
    it(`${mode} cancellation covers a stalled response body and cancels its reader`, async (t) => {
      let cancelled = false;
      let receivedSignal;
      const caller = new AbortController();
      t.mock.method(globalThis, 'fetch', async (_url, options) => {
        receivedSignal = options.signal;
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
      });
      const pending = callModalChatCompletions({ ...ENV, MODAL_TIMEOUT_MS: '1000' }, { ...PROMPTS, signal: caller.signal });
      if (mode === 'caller') setTimeout(() => caller.abort(new Error('PRIVATE_ABORT_REASON')), 10);
      await assert.rejects(pending, mode === 'timeout' ? /timed out/ : /cancelled/);
      assert.equal(receivedSignal.aborted, true);
      assert.equal(cancelled, true);
    });
  }

  it('never sends a request for an already-aborted caller', async (t) => {
    const caller = new AbortController();
    caller.abort(new Error('PRIVATE_ABORT_REASON'));
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => completion('stop'));
    await assert.rejects(callModalChatCompletions(ENV, { ...PROMPTS, signal: caller.signal }), /cancelled/);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
});
