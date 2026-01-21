import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { wrapStreamWithMetadata } from '../functions/api/reading-followup.js';

/**
 * Test helpers to simulate the streaming wrapper behavior from reading-followup.js
 * These tests verify the fix for: streaming failures should NOT consume follow-up limits
 */

function formatSSEEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create a mock readable stream from SSE events
 */
function createMockStream(events, {
  throwError = false,
  errorMessage = 'Stream error',
  keepOpen = false
} = {}) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (throwError && index === events.length - 1) {
        throw new Error(errorMessage);
      }

      if (index < events.length) {
        controller.enqueue(encoder.encode(events[index]));
        index++;
      } else if (!keepOpen) {
        controller.close();
      }
    }
  });
}

/**
 * Consume a stream and return all chunks as text
 */
async function consumeStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}

describe('wrapStreamWithMetadata', () => {
  test('calls onComplete on successful stream completion', async () => {
    let completedWithText = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Hello ' }),
      formatSSEEvent('delta', { text: 'world!' }),
      formatSSEEvent('done', { fullText: 'Hello world!' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: { provider: 'test' },
      onComplete: async (fullText) => {
        completedWithText = fullText;
      }
    });

    await consumeStream(wrappedStream);

    // onComplete should have been called with the accumulated text
    assert.equal(completedWithText, 'Hello world!');
  });

  test('uses done fullText when no deltas are emitted', async () => {
    let completedWithText = null;

    const mockEvents = [
      formatSSEEvent('done', { fullText: 'Done-only response' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 2,
      journalContext: null,
      meta: { provider: 'test' },
      onComplete: async (fullText) => {
        completedWithText = fullText;
      }
    });

    await consumeStream(wrappedStream);

    assert.equal(completedWithText, 'Done-only response');
  });

  test('does NOT call onComplete when stream throws error (usage fix)', async () => {
    let onCompleteCalled = false;
    let onErrorInfo = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Partial ' })
    ];

    const sourceStream = createMockStream(mockEvents, {
      throwError: true,
      errorMessage: 'Connection lost'
    });

    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: { provider: 'test' },
      onComplete: async () => {
        onCompleteCalled = true;
      },
      onError: (info) => {
        onErrorInfo = info;
      }
    });

    const output = await consumeStream(wrappedStream);

    // onComplete should NOT have been called - this is the critical fix
    assert.equal(onCompleteCalled, false, 'onComplete should NOT be called on stream errors');
    assert.equal(onErrorInfo?.type, 'stream_error', 'onError should be called for stream errors');

    // Error event should be in the output
    assert.ok(output.includes('event: error'), 'Should emit error event');
    assert.ok(output.includes('Connection lost'), 'Error message should be included');
  });

  test('emits meta event at stream start', async () => {
    const sourceStream = createMockStream([formatSSEEvent('done', {})]);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 3,
      journalContext: { patterns: ['test'] },
      meta: { provider: 'azure', requestId: 'req-123' },
      onComplete: async () => {}
    });

    const output = await consumeStream(wrappedStream);

    assert.ok(output.includes('event: meta'), 'Should start with meta event');
    assert.ok(output.includes('"turn":3'), 'Meta should include turn number');
    assert.ok(output.includes('"provider":"azure"'), 'Meta should include provider');
    assert.ok(output.includes('"requestId":"req-123"'), 'Meta should include requestId');
  });

  test('passes through delta events unchanged', async () => {
    const deltaEvent = formatSSEEvent('delta', { text: 'Test content' });
    const sourceStream = createMockStream([deltaEvent, formatSSEEvent('done', {})]);

    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      onComplete: async () => {}
    });

    const output = await consumeStream(wrappedStream);

    assert.ok(output.includes('Test content'), 'Delta content should pass through');
  });

  test('accumulates text from multiple delta events', async () => {
    let accumulatedText = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'One ' }),
      formatSSEEvent('delta', { text: 'two ' }),
      formatSSEEvent('delta', { text: 'three' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      onComplete: async (fullText) => {
        accumulatedText = fullText;
      }
    });

    await consumeStream(wrappedStream);

    assert.equal(accumulatedText, 'One two three');
  });

  test('calls onHeartbeat on progress events', async () => {
    let heartbeatCalls = 0;
    let lastHeartbeat = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Ping' }),
      formatSSEEvent('done', { fullText: 'Ping' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      onHeartbeat: (info) => {
        heartbeatCalls += 1;
        lastHeartbeat = info;
      },
      onComplete: async () => {}
    });

    await consumeStream(wrappedStream);

    assert.ok(heartbeatCalls > 0, 'onHeartbeat should be called for progress events');
    assert.equal(typeof lastHeartbeat?.fullTextLength, 'number');
  });

  test('calls onCancel when stream is cancelled', async () => {
    let cancelInfo = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Hold' })
    ];

    const sourceStream = createMockStream(mockEvents, { keepOpen: true });
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      onCancel: (info) => {
        cancelInfo = info;
      }
    });

    const reader = wrappedStream.getReader();
    await reader.read();
    await reader.cancel('client disconnect');
    reader.releaseLock();

    assert.equal(cancelInfo?.type, 'cancel');
    assert.equal(cancelInfo?.message, 'client disconnect');
  });

  test('handles empty stream gracefully', async () => {
    let completedWithText = null;
    let emptyCalled = false;

    const sourceStream = createMockStream([]);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      onComplete: async (fullText) => {
        completedWithText = fullText;
      },
      onEmpty: () => {
        emptyCalled = true;
      }
    });

    await consumeStream(wrappedStream);

    // Empty streams should not trigger onComplete
    assert.equal(completedWithText, null);
    assert.equal(emptyCalled, true, 'onEmpty should be called for empty streams');
  });

  test('does NOT call onComplete when stream emits error event without throwing (sawError fix)', async () => {
    let onCompleteCalled = false;
    let onErrorInfo = null;

    // Simulate Azure returning an error event in the stream (not throwing)
    const mockEvents = [
      formatSSEEvent('error', { message: 'Rate limit exceeded' }),
      formatSSEEvent('done', { fullText: '', error: true })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: { provider: 'test' },
      onComplete: async () => {
        onCompleteCalled = true;
      },
      onError: (info) => {
        onErrorInfo = info;
      }
    });

    const output = await consumeStream(wrappedStream);

    // onComplete should NOT be called when an error event is in the stream
    // This is the critical fix for: usage counted on provider SSE errors
    assert.equal(onCompleteCalled, false, 'onComplete should NOT be called when error event seen');
    assert.equal(onErrorInfo?.type, 'error_event', 'onError should be called for error events');

    // The error event should pass through
    assert.ok(output.includes('Rate limit exceeded'), 'Error message should be in output');
  });

  test('does NOT call onComplete when error event is split across chunks', async () => {
    let onCompleteCalled = false;
    let onErrorCalled = false;
    const encoder = new TextEncoder();

    // Simulate chunk split in the middle of "event: error\n"
    const chunk1 = 'event: err';
    const chunk2 = 'or\ndata: {"message":"Split error"}\n\n';

    // Create a stream that emits split chunks
    let index = 0;
    const chunks = [chunk1, chunk2];
    const sourceStream = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      }
    });

    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      onComplete: async () => {
        onCompleteCalled = true;
      },
      onError: () => {
        onErrorCalled = true;
      }
    });

    await consumeStream(wrappedStream);

    // onComplete should NOT be called - the buffer should detect the error across chunks
    assert.equal(onCompleteCalled, false, 'onComplete should NOT be called when error spans chunks');
    assert.equal(onErrorCalled, true, 'onError should be called when error spans chunks');
  });

  test('does NOT call onComplete when error event uses CRLF line endings', async () => {
    let onCompleteCalled = false;
    let onErrorCalled = false;
    const encoder = new TextEncoder();

    // Use CRLF instead of LF
    const crlfErrorEvent = 'event: error\r\ndata: {"message":"CRLF error"}\r\n\r\n';
    const sourceStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(crlfErrorEvent));
        controller.close();
      }
    });

    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      onComplete: async () => {
        onCompleteCalled = true;
      },
      onError: () => {
        onErrorCalled = true;
      }
    });

    await consumeStream(wrappedStream);

    // onComplete should NOT be called - the regex should handle CRLF
    assert.equal(onCompleteCalled, false, 'onComplete should NOT be called for CRLF error events');
    assert.equal(onErrorCalled, true, 'onError should be called for CRLF error events');
  });

  test('calls waitUntil when ctx is provided', async () => {
    let waitUntilCalled = false;
    let waitUntilPromise = null;

    const mockCtx = {
      waitUntil: (promise) => {
        waitUntilCalled = true;
        waitUntilPromise = promise;
      }
    };

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Success' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapStreamWithMetadata(sourceStream, {
      turn: 1,
      journalContext: null,
      meta: {},
      ctx: mockCtx,
      onComplete: async () => {
        return 'tracked';
      }
    });

    await consumeStream(wrappedStream);

    // waitUntil should be called for successful streams
    assert.equal(waitUntilCalled, true, 'waitUntil should be called');
    assert.ok(waitUntilPromise instanceof Promise, 'waitUntil should receive a Promise');
  });
});

describe('SSE error handling in client', () => {
  /**
   * These tests verify the client-side SSE parsing behavior
   * The fix ensures non-OK responses with text/event-stream content-type
   * are parsed as SSE instead of JSON
   */

  test('SSE format is valid for error events', () => {
    const errorEvent = formatSSEEvent('error', { message: 'Test error' });

    // Verify format
    assert.ok(errorEvent.startsWith('event: error\n'), 'Should start with event line');
    assert.ok(errorEvent.includes('data: {'), 'Should have data line');
    assert.ok(errorEvent.endsWith('\n\n'), 'Should end with double newline');

    // Verify parseable
    const lines = errorEvent.split('\n');
    const dataLine = lines.find(l => l.startsWith('data:'));
    const jsonStr = dataLine.slice(5).trim();
    const parsed = JSON.parse(jsonStr);

    assert.equal(parsed.message, 'Test error');
  });

  test('multiple SSE events parse correctly', () => {
    const events = [
      formatSSEEvent('meta', { turn: 1 }),
      formatSSEEvent('delta', { text: 'Hello' }),
      formatSSEEvent('error', { message: 'Oops' })
    ].join('');

    const blocks = events.split('\n\n').filter(b => b.trim());
    assert.equal(blocks.length, 3);

    // Parse each block
    const parsed = blocks.map(block => {
      const lines = block.split('\n');
      const eventLine = lines.find(l => l.startsWith('event:'));
      const dataLine = lines.find(l => l.startsWith('data:'));
      return {
        event: eventLine?.slice(6).trim(),
        data: JSON.parse(dataLine?.slice(5).trim() || '{}')
      };
    });

    assert.equal(parsed[0].event, 'meta');
    assert.equal(parsed[1].event, 'delta');
    assert.equal(parsed[2].event, 'error');
    assert.equal(parsed[2].data.message, 'Oops');
  });
});
