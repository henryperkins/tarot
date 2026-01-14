import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { createToolRoundTripStream } from '../functions/api/reading-followup.js';

function formatAzureEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`;
}

function createMockAzureStream(eventChunks) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index >= eventChunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(eventChunks[index]));
      index += 1;
    }
  });
}

async function collectSseEvents(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;

        const lines = block.split(/\r?\n/);
        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          }
        }

        let parsed = null;
        try {
          parsed = eventData ? JSON.parse(eventData) : null;
        } catch {
          parsed = eventData || null;
        }

        events.push({ eventType, data: parsed });
      }
    }
  } finally {
    reader.releaseLock();
  }

  return events;
}

const env = {
  AZURE_OPENAI_ENDPOINT: 'https://example.test',
  AZURE_OPENAI_API_KEY: 'test-key',
  AZURE_OPENAI_GPT5_MODEL: 'test-model',
  AZURE_OPENAI_RESPONSES_API_VERSION: 'v1'
};

const tools = [
  {
    type: 'function',
    name: 'save_memory_note',
    description: 'test tool',
    parameters: { type: 'object', properties: {}, required: [] }
  }
];

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createToolRoundTripStream', () => {
  test('streams deltas directly when no tool calls occur', async () => {
    const azureEvents = [
      formatAzureEvent('response.output_text.delta', { delta: 'Hello ' }),
      formatAzureEvent('response.output_text.delta', { delta: 'world!' })
    ];

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      if (callCount !== 1) {
        throw new Error('Unexpected continuation request');
      }
      return new Response(createMockAzureStream(azureEvents), { status: 200 });
    };

    const stream = createToolRoundTripStream(env, {
      instructions: 'sys',
      userInput: 'q',
      tools,
      maxTokens: 50,
      verbosity: 'medium',
      requestId: 'req-test',
      onToolCall: async () => ({ success: true })
    });

    const events = await collectSseEvents(stream);
    const deltas = events.filter(e => e.eventType === 'delta').map(e => e.data?.text);
    const dones = events.filter(e => e.eventType === 'done').map(e => e.data);

    assert.deepEqual(deltas, ['Hello ', 'world!']);
    assert.equal(dones.length, 1);
    assert.equal(dones[0].fullText, 'Hello world!');
    assert.equal(dones[0].isEmpty, false);
  });

  test('executes tool calls then streams continuation text with a single done event', async () => {
    const memoryArgs = {
      text: 'User prefers concise answers.',
      category: 'communication',
      keywords: ['concise']
    };

    const initialAzureEvents = [
      formatAzureEvent('response.output_item.added', {
        item: { type: 'function_call', call_id: 'call-1', name: 'save_memory_note' }
      }),
      formatAzureEvent('response.function_call_arguments.delta', {
        call_id: 'call-1',
        delta: JSON.stringify(memoryArgs)
      }),
      formatAzureEvent('response.function_call_arguments.done', { call_id: 'call-1' })
    ];

    const continuationAzureEvents = [
      formatAzureEvent('response.output_text.delta', { delta: 'Answer ' }),
      formatAzureEvent('response.output_text.delta', { delta: 'text' })
    ];

    const toolCalls = [];
    let callCount = 0;
    globalThis.fetch = async (_url, init) => {
      callCount += 1;
      const body = JSON.parse(init?.body || '{}');

      if (callCount === 1) {
        assert.equal(typeof body.input, 'string');
        return new Response(createMockAzureStream(initialAzureEvents), { status: 200 });
      }

      if (callCount === 2) {
        assert.ok(Array.isArray(body.input), 'Continuation should send conversation array');
        return new Response(createMockAzureStream(continuationAzureEvents), { status: 200 });
      }

      throw new Error('Unexpected extra fetch call');
    };

    const stream = createToolRoundTripStream(env, {
      instructions: 'sys',
      userInput: 'q',
      tools,
      maxTokens: 50,
      verbosity: 'medium',
      requestId: 'req-test',
      onToolCall: async (callId, name, args) => {
        toolCalls.push({ callId, name, args });
        return { success: true };
      }
    });

    const events = await collectSseEvents(stream);
    const deltas = events.filter(e => e.eventType === 'delta').map(e => e.data?.text);
    const dones = events.filter(e => e.eventType === 'done').map(e => e.data);

    assert.deepEqual(toolCalls, [{ callId: 'call-1', name: 'save_memory_note', args: memoryArgs }]);
    assert.deepEqual(deltas, ['Answer ', 'text']);
    assert.equal(dones.length, 1, 'Should emit exactly one done event');
    assert.equal(dones[0].fullText, 'Answer text');
    assert.equal(dones[0].isEmpty, false);
  });
});

