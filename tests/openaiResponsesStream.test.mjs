import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  callOpenAIResponsesStream,
  callOpenAIResponsesStreamWithConversation,
  transformOpenAIStream
} from '../functions/lib/openaiResponsesStream.js';

function formatOpenAIEvent(event, data = {}) {
  return `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`;
}

function createMockOpenAIStream(eventChunks) {
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

        events.push({
          eventType,
          data: eventData ? JSON.parse(eventData) : null
        });
      }
    }
  } finally {
    reader.releaseLock();
  }

  return events;
}

const baseEnv = {
  OPENAI_BASE_URL: 'https://example.test',
  OPENAI_API_KEY: 'test-key',
  OPENAI_MODEL: 'gpt-5-test',
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('transformOpenAIStream', () => {
  test('emits code interpreter lifecycle/code events and preserves text done payload', async () => {
    const openaiEvents = [
      formatOpenAIEvent('response.code_interpreter_call.in_progress', { item_id: 'ci_1', output_index: 0 }),
      formatOpenAIEvent('response.code_interpreter_call_code.delta', { item_id: 'ci_1', output_index: 0, delta: 'print(' }),
      formatOpenAIEvent('response.code_interpreter_call_code.done', { item_id: 'ci_1', output_index: 0, code: 'print("hi")' }),
      formatOpenAIEvent('response.code_interpreter_call.completed', { item_id: 'ci_1', output_index: 0 }),
      formatOpenAIEvent('response.output_text.delta', { delta: 'Final answer' }),
      formatOpenAIEvent('response.output_text.done', { text: 'Final answer' }),
      formatOpenAIEvent('response.completed', { response: { status: 'completed' } })
    ];

    const transformed = transformOpenAIStream(createMockOpenAIStream(openaiEvents));
    const events = await collectSseEvents(transformed);

    const statusEvents = events.filter(e => e.eventType === 'code_interpreter_status');
    const deltaEvents = events.filter(e => e.eventType === 'code_interpreter_delta');
    const doneEvents = events.filter(e => e.eventType === 'code_interpreter_done');
    const textDeltas = events.filter(e => e.eventType === 'delta');
    const streamDone = events.filter(e => e.eventType === 'done');

    assert.deepEqual(statusEvents.map(e => e.data?.status), ['in_progress', 'completed']);
    assert.equal(deltaEvents.length, 1);
    assert.equal(deltaEvents[0].data?.code, 'print(');
    assert.equal(doneEvents.length, 1);
    assert.equal(doneEvents[0].data?.code, 'print("hi")');
    assert.deepEqual(textDeltas.map(e => e.data?.text), ['Final answer']);
    assert.equal(streamDone.length, 1);
    assert.equal(streamDone[0].data?.fullText, 'Final answer');
    assert.equal(streamDone[0].data?.isEmpty, false);
  });
});

describe('streaming request payloads', () => {
  for (const continuation of [false, true]) {
    test(`Azure-only credentials cannot start a ${continuation ? 'continuation' : 'text'} stream`, async () => {
      let calls = 0;
      globalThis.fetch = async () => {
        calls += 1;
        throw new Error('Unexpected inference request');
      };
      const call = continuation ? callOpenAIResponsesStreamWithConversation : callOpenAIResponsesStream;
      await assert.rejects(call({
        AZURE_OPENAI_ENDPOINT: 'https://retired.example',
        AZURE_OPENAI_API_KEY: 'retired-key',
        AZURE_OPENAI_GPT5_MODEL: 'retired-model'
      }, { instructions: 'sys', input: 'hello', conversation: [] }), /Set OPENAI_API_KEY/);
      assert.equal(calls, 0);
    });
  }

  test('callOpenAIResponsesStream includes explicit user in request body', async () => {
    let capturedBody = null;
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://example.test/v1/responses');
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      assert.equal(init.headers['api-key'], undefined);
      capturedBody = JSON.parse(init.body);
      return new Response(createMockOpenAIStream([]), { status: 200 });
    };

    await callOpenAIResponsesStream(baseEnv, {
      instructions: 'sys',
      input: 'hello',
      user: 'reader-42',
      tools: [{ type: 'function', name: 'save_memory_note', parameters: { type: 'object' } }]
    });

    assert.ok(capturedBody, 'request body should be captured');
    assert.equal(capturedBody.user, 'reader-42');
    assert.equal(capturedBody.model, 'gpt-5-test');
    assert.equal(capturedBody.stream, true);
    assert.equal(capturedBody.store, false);
    assert.equal(capturedBody.tools[0].name, 'save_memory_note');
  });

  test('callOpenAIResponsesStreamWithConversation falls back to env user', async () => {
    let capturedBody = null;
    globalThis.fetch = async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return new Response(createMockOpenAIStream([]), { status: 200 });
    };

    await callOpenAIResponsesStreamWithConversation(
      { ...baseEnv, OPENAI_RESPONSES_USER: 'env-reader' },
      {
        instructions: 'sys',
        conversation: [{ role: 'user', content: 'hi' }]
      }
    );

    assert.ok(capturedBody, 'request body should be captured');
    assert.equal(capturedBody.user, 'env-reader');
  });
});
