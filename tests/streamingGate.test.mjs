import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequestGet, onRequestPost } from '../functions/api/tarot-reading.js';

function makeRequest(payload) {
  return new Request('http://localhost/api/tarot-reading?stream=true', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'text/event-stream'
    },
    body: JSON.stringify(payload)
  });
}

function createAzureStream(deltas) {
  const encoder = new TextEncoder();
  const events = deltas.map((delta) => (
    `event: response.output_text.delta\n` +
    `data: ${JSON.stringify({ type: 'response.output_text.delta', delta })}\n\n`
  ));

  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(encoder.encode(events[index]));
        index += 1;
      } else {
        controller.close();
      }
    }
  });
}

async function collectSSEEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';

  const processEventBlock = (eventBlock) => {
    if (!eventBlock.trim()) return;
    const lines = eventBlock.split(/\r?\n/);
    let eventType = '';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        eventData = line.slice(5).trim();
      }
    }

    if (!eventType || !eventData) return;
    events.push({
      event: eventType,
      data: JSON.parse(eventData)
    });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || '';
    chunks.forEach(processEventBlock);
  }

  if (buffer.trim()) {
    processEventBlock(buffer);
  }

  reader.releaseLock();
  return events;
}

const BASE_PAYLOAD = {
  spreadInfo: { name: 'One-Card Insight' },
  cardsInfo: [
    {
      position: 'One-Card Insight',
      card: 'The Fool',
      orientation: 'Upright',
      meaning: 'New beginnings'
    }
  ],
  userQuestion: 'What opens next?',
  reflectionsText: ''
};

const VALID_MODAL_READING = [
  '### Opening',
  '',
  'A fresh threshold is visible, but it asks for curiosity rather than certainty.',
  '',
  '### The Fool — One-Card Insight',
  '',
  'The Fool is the central card in this reading, showing an opening that has not yet been overplanned. Because its energy favors direct experience over perfect preparation, the uncertainty around your question can become useful information. This card invites you to take one reversible next step, notice what changes, and let the path answer you through experience.',
  '',
  '### Guidance',
  '',
  'Choose a small action that preserves freedom. Write down what you expect, take the step, and compare the real result with the fear or hope that came before it.',
  '',
  '### Closing',
  '',
  'You do not need the whole route today. You need enough trust to meet the next honest moment.'
].join('\n');

const UNSAFE_MODAL_READING = VALID_MODAL_READING.replace(
  'Choose a small action that preserves freedom.',
  'You should hurt him to make a point.'
);

function makeSafeMockAI({ safetyFlag = true, safety = 1, tone = 4 } = {}) {
  return {
    run: async () => ({
      response: JSON.stringify({
        scores: {
          personalization: 4,
          tarot_coherence: 4,
          tone,
          safety,
          overall: Math.min(4, tone, safety),
          safety_flag: safetyFlag
        }
      })
    })
  };
}

describe('streaming gate metadata', () => {
  it('reports Modal as primary while preserving the legacy local health provider label', async () => {
    const modalResponse = await onRequestGet({
      env: {
        MODAL_PROXY_TOKEN: 'wk-test.ws-test',
        MODAL_ENDPOINT_URL: 'https://example.modal.direct',
        MODAL_MODEL: 'Qwen/Qwen3.8-2.4T-A95B'
      }
    });
    assert.equal((await modalResponse.json()).provider, 'modal-qwen');

    const localResponse = await onRequestGet({ env: {} });
    assert.equal((await localResponse.json()).provider, 'local');
  });

  it('keeps Modal primary when a streaming client and a Responses fallback are both configured', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];
    globalThis.fetch = async (url) => {
      requestedUrls.push(String(url));

      if (String(url).endsWith('/v1/chat/completions')) {
        return new Response(JSON.stringify({
          id: 'modal-stream-priority',
          object: 'chat.completion',
          created: 1787866189,
          model: 'Qwen/Qwen3.8-2.4T-A95B',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: VALID_MODAL_READING,
                reasoning_content: 'Private model reasoning.'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 200,
            completion_tokens: 300,
            total_tokens: 500,
            reasoning_tokens: 100
          }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }

      return new Response(createAzureStream([VALID_MODAL_READING]), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      });
    };

    const env = {
      MODAL_PROXY_TOKEN: 'wk-test.ws-test',
      MODAL_ENDPOINT_URL: 'https://example.modal.direct',
      MODAL_MODEL: 'Qwen/Qwen3.8-2.4T-A95B',
      OPENAI_API_KEY: 'openai-test-key',
      OPENAI_BASE_URL: 'https://api.openai.example',
      OPENAI_MODEL: 'gpt-5-test',
      OPENAI_STREAMING_ENABLED: 'true',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      STREAMING_SAFETY_SCAN_ENABLED: 'false',
      STREAMING_QUALITY_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    };

    try {
      const response = await onRequestPost({ request: makeRequest(BASE_PAYLOAD), env });
      assert.equal(response.status, 200);

      const events = await collectSSEEvents(response);
      const meta = events.find((event) => event.event === 'meta');
      const done = events.find((event) => event.event === 'done');

      assert.equal(meta?.data.provider, 'modal-qwen');
      assert.equal(done?.data.provider, 'modal-qwen');
      assert.equal(done?.data.fullText, VALID_MODAL_READING);
      assert.deepEqual(requestedUrls, ['https://example.modal.direct/v1/chat/completions']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('forces a safety scan for buffered Modal SSE output when streaming gates are disabled', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      id: 'modal-unsafe-reading',
      object: 'chat.completion',
      model: 'Qwen/Qwen3.8-2.4T-A95B',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: UNSAFE_MODAL_READING
          },
          finish_reason: 'stop'
        }
      ]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

    const env = {
      MODAL_PROXY_TOKEN: 'wk-test.ws-test',
      MODAL_ENDPOINT_URL: 'https://example.modal.direct',
      MODAL_MODEL: 'Qwen/Qwen3.8-2.4T-A95B',
      OPENAI_STREAMING_ENABLED: 'true',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      STREAMING_SAFETY_SCAN_ENABLED: 'false',
      STREAMING_QUALITY_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    };

    try {
      const response = await onRequestPost({ request: makeRequest(BASE_PAYLOAD), env });
      assert.equal(response.status, 200);

      const events = await collectSSEEvents(response);
      const meta = events.find((event) => event.event === 'meta');
      const done = events.find((event) => event.event === 'done');

      assert.equal(meta?.data.gateBlocked, true);
      assert.equal(meta?.data.gateReason, 'safety_flag_true');
      assert.equal(done?.data.gateBlocked, true);
      assert.ok(done?.data.fullText.includes('A Moment of Reflection'));
      assert.ok(!done?.data.fullText.includes('hurt him'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('redacts Modal upstream failure details when a Responses fallback succeeds', async () => {
    const originalFetch = globalThis.fetch;
    const requestedUrls = [];
    globalThis.fetch = async (url) => {
      requestedUrls.push(String(url));

      if (String(url).endsWith('/v1/chat/completions')) {
        return new Response('upstream-detail: internal-router-node=gpu-17', {
          status: 401,
          headers: { 'content-type': 'text/plain' }
        });
      }

      if (String(url).endsWith('/v1/responses')) {
        return new Response(JSON.stringify({ output_text: VALID_MODAL_READING }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const env = {
      MODAL_PROXY_TOKEN: 'wk-test.ws-test',
      MODAL_ENDPOINT_URL: 'https://example.modal.direct',
      MODAL_MODEL: 'Qwen/Qwen3.8-2.4T-A95B',
      OPENAI_API_KEY: 'openai-test-key',
      OPENAI_BASE_URL: 'https://api.openai.example',
      OPENAI_MODEL: 'gpt-5-test',
      OPENAI_STREAMING_ENABLED: 'true',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    };

    try {
      const response = await onRequestPost({ request: makeRequest(BASE_PAYLOAD), env });
      assert.equal(response.status, 200);

      const events = await collectSSEEvents(response);
      const meta = events.find((event) => event.event === 'meta');

      assert.equal(meta?.data.provider, 'openai-native');
      assert.deepEqual(meta?.data.backendErrors, [
        {
          backend: 'modal-qwen',
          error: 'Narrative provider request failed.',
          code: 'provider_request_failed'
        }
      ]);
      assert.ok(!JSON.stringify(meta?.data.backendErrors).includes('internal-router-node'));
      assert.deepEqual(requestedUrls, [
        'https://example.modal.direct/v1/chat/completions',
        'https://api.openai.example/v1/responses'
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  for (const stream of [false, true]) {
    it(`falls back from truncated Modal text before returning ${stream ? 'SSE' : 'JSON'}`, async (t) => {
      const requestedUrls = [];
      const truncatedReading = `${VALID_MODAL_READING}\n\nA truncated closing that ends before`;
      t.mock.method(globalThis, 'fetch', async (url) => {
        requestedUrls.push(String(url));
        if (String(url).endsWith('/v1/chat/completions')) {
          return new Response(JSON.stringify({
            choices: [{
              index: 0,
              message: { role: 'assistant', content: truncatedReading },
              finish_reason: 'length'
            }]
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (String(url).endsWith('/v1/responses')) {
          return new Response(JSON.stringify({ output_text: VALID_MODAL_READING }), {
            headers: { 'content-type': 'application/json' }
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const env = {
        MODAL_PROXY_TOKEN: 'wk-test.ws-test',
        MODAL_ENDPOINT_URL: 'https://example.modal.direct',
        MODAL_MODEL: 'Qwen/Qwen3.8-2.4T-A95B',
        OPENAI_API_KEY: 'openai-test-key',
        OPENAI_BASE_URL: 'https://api.openai.example',
        OPENAI_MODEL: 'gpt-5-test',
        OPENAI_STREAMING_ENABLED: 'true',
        ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
        EVAL_ENABLED: 'false',
        EVAL_GATE_ENABLED: 'false',
        GRAPHRAG_ENABLED: 'false'
      };
      const request = stream ? makeRequest(BASE_PAYLOAD) : new Request('http://localhost/api/tarot-reading', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(BASE_PAYLOAD)
      });
      const response = await onRequestPost({ request, env });
      assert.equal(response.status, 200);

      let metadata;
      if (stream) {
        const events = await collectSSEEvents(response);
        const done = events.find((event) => event.event === 'done');
        metadata = events.find((event) => event.event === 'meta')?.data;
        assert.equal(done?.data.provider, 'openai-native');
        assert.equal(done?.data.fullText, VALID_MODAL_READING);
        assert.equal(events.filter((event) => event.event === 'delta').map((event) => event.data.text).join(''), VALID_MODAL_READING);
        assert.ok(!JSON.stringify(events).includes('A truncated closing'));
      } else {
        metadata = await response.json();
        assert.equal(metadata.reading, VALID_MODAL_READING);
        assert.ok(!JSON.stringify(metadata).includes('A truncated closing'));
      }

      assert.equal(metadata?.provider, 'openai-native');
      assert.deepEqual(metadata?.backendErrors, [{
        backend: 'modal-qwen',
        error: 'Narrative provider request failed.',
        code: 'provider_request_failed'
      }]);
      assert.deepEqual(requestedUrls, [
        'https://example.modal.direct/v1/chat/completions',
        'https://api.openai.example/v1/responses'
      ]);
    });
  }

  it('buffers output and reports gate metadata when blocked', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      createAzureStream(['The Fool signals a new beginning.']),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

    const mockAI = {
      run: async () => ({
        response: JSON.stringify({
          scores: {
            personalization: 4,
            tarot_coherence: 4,
            tone: 4,
            safety: 1,
            overall: 1,
            safety_flag: true
          }
        })
      })
    };

    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_STREAMING_ENABLED: 'true',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'true',
      EVAL_GATE_ENABLED: 'true',
      GRAPHRAG_ENABLED: 'false',
      AI: mockAI
    };

    try {
      const request = makeRequest(BASE_PAYLOAD);
      const response = await onRequestPost({ request, env });

      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));

      const events = await collectSSEEvents(response);
      const meta = events.find((evt) => evt.event === 'meta');
      const done = events.find((evt) => evt.event === 'done');

      assert.ok(meta, 'meta event should be present');
      assert.equal(meta.data.gateBlocked, true);
      assert.equal(meta.data.gateReason, 'safety_flag_true');
      assert.ok(done.data.fullText.includes('A Moment of Reflection'));
      assert.equal(done.data.gateBlocked, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('buffers output and applies safety scan when eval gate is off', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      createAzureStream(['The Fool warns that you should hurt him to make a point.']),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_STREAMING_ENABLED: 'true',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    };

    try {
      const request = makeRequest(BASE_PAYLOAD);
      const response = await onRequestPost({ request, env });

      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));

      const events = await collectSSEEvents(response);
      const meta = events.find((evt) => evt.event === 'meta');
      const done = events.find((evt) => evt.event === 'done');

      assert.ok(meta, 'meta event should be present');
      assert.equal(meta.data.gateBlocked, true);
      assert.equal(meta.data.gateReason, 'safety_flag_true');
      assert.ok(done.data.fullText.includes('A Moment of Reflection'));
      assert.equal(done.data.gateBlocked, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('forces safety buffering when streaming gates are disabled', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      createAzureStream(['The Fool warns that you should hurt him to make a point.']),
      { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );

    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_STREAMING_ENABLED: 'true',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      STREAMING_SAFETY_SCAN_ENABLED: 'false',
      STREAMING_QUALITY_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    };

    try {
      const request = makeRequest(BASE_PAYLOAD);
      const response = await onRequestPost({ request, env });

      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));

      const events = await collectSSEEvents(response);
      const meta = events.find((evt) => evt.event === 'meta');
      const done = events.find((evt) => evt.event === 'done');

      assert.ok(meta, 'meta event should be present');
      assert.equal(meta.data.gateBlocked, true);
      assert.equal(meta.data.gateReason, 'safety_flag_true');
      assert.ok(done.data.fullText.includes('A Moment of Reflection'));
      assert.equal(done.data.gateBlocked, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('applies safety scan to buffered backends when eval gate is off', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({
        output_text: 'The Fool warns that you should hurt him to make a point.'
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_STREAMING_ENABLED: 'false',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'false',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false'
    };

    try {
      const request = makeRequest(BASE_PAYLOAD);
      const response = await onRequestPost({ request, env });

      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));

      const events = await collectSSEEvents(response);
      const meta = events.find((evt) => evt.event === 'meta');
      const done = events.find((evt) => evt.event === 'done');

      assert.ok(meta, 'meta event should be present');
      assert.equal(meta.data.gateBlocked, true);
      assert.equal(meta.data.gateReason, 'safety_flag_true');
      assert.ok(done.data.fullText.includes('A Moment of Reflection'));
      assert.equal(done.data.gateBlocked, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('forces the model eval gate for non-English readings even when the global eval gate is off', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({
        output_text: [
          '### Apertura',
          '',
          '**The Fool** abre un camino nuevo.',
          '',
          '### Guidance',
          '',
          'Avanza con cuidado y curiosidad.',
          '',
          '- Toma una accion pequena hoy.',
          '',
          '### Closing',
          '',
          'El camino se aclara paso a paso.'
        ].join('\n')
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_STREAMING_ENABLED: 'false',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'true',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false',
      AI: makeSafeMockAI({ safetyFlag: true, safety: 1 })
    };

    try {
      const request = makeRequest({
        ...BASE_PAYLOAD,
        userQuestion: '¿Cómo puedo avanzar en esta relación?'
      });
      const response = await onRequestPost({ request, env });

      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));

      const events = await collectSSEEvents(response);
      const meta = events.find((evt) => evt.event === 'meta');
      const done = events.find((evt) => evt.event === 'done');

      assert.ok(meta, 'meta event should be present');
      assert.equal(meta.data.gateBlocked, true);
      assert.equal(meta.data.gateReason, 'safety_flag_true');
      assert.ok(done.data.fullText.includes('A Moment of Reflection'));
      assert.equal(done.data.gateBlocked, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('forces the model eval gate for wellbeing readings even when the global eval gate is off', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      JSON.stringify({
        output_text: [
          '### Opening',
          '',
          '**The Fool** suggests a fresh start around your wellbeing.',
          '',
          '### Guidance',
          '',
          'Approach burnout with one grounded step at a time.',
          '',
          '- Make one supportive choice today.',
          '',
          '### Closing',
          '',
          'Your path can open gradually.'
        ].join('\n')
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_ENDPOINT: 'https://example.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_STREAMING_ENABLED: 'false',
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'true',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false',
      AI: makeSafeMockAI({ safetyFlag: true, safety: 1 })
    };

    try {
      const request = makeRequest({
        ...BASE_PAYLOAD,
        userQuestion: 'How should I think about my anxiety and sleep?'
      });
      const response = await onRequestPost({ request, env });

      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type')?.includes('text/event-stream'));

      const events = await collectSSEEvents(response);
      const meta = events.find((evt) => evt.event === 'meta');
      const done = events.find((evt) => evt.event === 'done');

      assert.ok(meta, 'meta event should be present');
      assert.equal(meta.data.gateBlocked, true);
      assert.equal(meta.data.gateReason, 'safety_flag_true');
      assert.ok(done.data.fullText.includes('A Moment of Reflection'));
      assert.equal(done.data.gateBlocked, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
