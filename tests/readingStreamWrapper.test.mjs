import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { wrapReadingStreamWithMetadata } from '../functions/lib/readingStream.js';

/**
 * Tests for wrapReadingStreamWithMetadata in functions/lib/readingStream.js
 *
 * Verifies:
 * - done-fallback: fullText from done event is used when deltas are empty
 * - onCancel: callback is invoked when stream is cancelled
 * - quota release on cancel
 */

function formatSSEEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create a mock readable stream from SSE events
 */
function createMockStream(events, { keepOpen = false } = {}) {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
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

describe('wrapReadingStreamWithMetadata - done fallback', () => {
  test('uses delta-accumulated text when deltas are present', async () => {
    let completedWithText = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Hello ' }),
      formatSSEEvent('delta', { text: 'world!' }),
      formatSSEEvent('done', { fullText: 'Hello world!' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: { provider: 'test' },
      onComplete: async (fullText) => {
        completedWithText = fullText;
      }
    });

    await consumeStream(wrappedStream);

    assert.equal(completedWithText, 'Hello world!');
  });

  test('uses done.fullText when no delta events are emitted', async () => {
    let completedWithText = null;

    // Simulate Azure emitting only a done event with fullText (no deltas)
    const mockEvents = [
      formatSSEEvent('done', { fullText: 'Response from done only' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: { provider: 'test' },
      onComplete: async (fullText) => {
        completedWithText = fullText;
      }
    });

    await consumeStream(wrappedStream);

    // Should use the fullText from done event, not empty string
    assert.equal(completedWithText, 'Response from done only');
  });

  test('uses done.fullText when deltas are dropped/empty', async () => {
    let completedWithText = null;

    // Simulate partial delta followed by done with complete text
    // (deltas were dropped or empty)
    const mockEvents = [
      formatSSEEvent('delta', { text: '' }), // Empty delta
      formatSSEEvent('done', { fullText: 'Complete response text' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: { provider: 'test' },
      onComplete: async (fullText) => {
        completedWithText = fullText;
      }
    });

    await consumeStream(wrappedStream);

    // Should fall back to done.fullText since deltas were empty
    assert.equal(completedWithText, 'Complete response text');
  });

  test('prefers delta text over done.fullText when deltas have content', async () => {
    let completedWithText = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'From deltas' }),
      formatSSEEvent('done', { fullText: 'Different text from done' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: { provider: 'test' },
      onComplete: async (fullText) => {
        completedWithText = fullText;
      }
    });

    await consumeStream(wrappedStream);

    // Should use delta-accumulated text, not done.fullText
    assert.equal(completedWithText, 'From deltas');
  });
});

describe('wrapReadingStreamWithMetadata - onCancel', () => {
  test('calls onCancel when stream is cancelled', async () => {
    let cancelInfo = null;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Partial response' })
    ];

    const sourceStream = createMockStream(mockEvents, { keepOpen: true });
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: { provider: 'test' },
      onComplete: async () => {},
      onCancel: async (info) => {
        cancelInfo = info;
      }
    });

    const reader = wrappedStream.getReader();
    await reader.read(); // Read the meta event
    await reader.cancel('user cancelled');
    reader.releaseLock();

    assert.ok(cancelInfo, 'onCancel should be called');
    assert.equal(cancelInfo.reason, 'user cancelled');
  });

  test('onCancel is invoked with waitUntil when ctx provided', async () => {
    let waitUntilCalled = false;
    let waitUntilPromise = null;
    let cancelCalled = false;

    const mockCtx = {
      waitUntil: (promise) => {
        waitUntilCalled = true;
        waitUntilPromise = promise;
      }
    };

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Content' })
    ];

    const sourceStream = createMockStream(mockEvents, { keepOpen: true });
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: {},
      ctx: mockCtx,
      onComplete: async () => {},
      onCancel: async () => {
        cancelCalled = true;
        return 'quota released';
      }
    });

    const reader = wrappedStream.getReader();
    await reader.read();
    await reader.cancel('client disconnect');
    reader.releaseLock();

    assert.ok(cancelCalled, 'onCancel should be called');
    assert.ok(waitUntilCalled, 'waitUntil should be called for cancel callback');
    assert.ok(waitUntilPromise instanceof Promise, 'waitUntil should receive a Promise');
  });

  test('onCancel is not called on normal stream completion', async () => {
    let cancelCalled = false;
    let completeCalled = false;

    const mockEvents = [
      formatSSEEvent('delta', { text: 'Complete' }),
      formatSSEEvent('done', { fullText: 'Complete' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: {},
      onComplete: async () => {
        completeCalled = true;
      },
      onCancel: async () => {
        cancelCalled = true;
      }
    });

    await consumeStream(wrappedStream);

    assert.ok(completeCalled, 'onComplete should be called');
    assert.ok(!cancelCalled, 'onCancel should NOT be called on normal completion');
  });
});

describe('wrapReadingStreamWithMetadata - error handling', () => {
  test('does NOT call onComplete when error event is present', async () => {
    let completeCalled = false;
    let errorInfo = null;

    const mockEvents = [
      formatSSEEvent('error', { message: 'Rate limit exceeded' }),
      formatSSEEvent('done', { fullText: '' })
    ];

    const sourceStream = createMockStream(mockEvents);
    const wrappedStream = wrapReadingStreamWithMetadata(sourceStream, {
      meta: {},
      onComplete: async () => {
        completeCalled = true;
      },
      onError: async (info) => {
        errorInfo = info;
      }
    });

    await consumeStream(wrappedStream);

    assert.ok(!completeCalled, 'onComplete should NOT be called when error event seen');
    assert.ok(errorInfo, 'onError should be called');
    assert.equal(errorInfo.error, true);
  });
});
