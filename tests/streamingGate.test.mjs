import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequestPost } from '../functions/api/tarot-reading.js';

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

describe('streaming gate metadata', () => {
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
      assert.equal(meta.data.gateReason, 'safety_flag');
      assert.ok(done.data.fullText.includes('A Moment of Reflection'));
      assert.equal(done.data.gateBlocked, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
