/**
 * Reading Stream Utilities
 *
 * Server-Sent Events (SSE) streaming helpers for tarot reading responses.
 * Provides both buffered streaming (for non-streaming backends) and
 * real-time stream wrapping (for Azure token streaming).
 *
 * Extracted from tarot-reading.js to maintain <900 line limit.
 */

// ============================================================================
// SSE Event Formatting
// ============================================================================

/**
 * Format a Server-Sent Event.
 *
 * @param {string} event - Event type (e.g., 'meta', 'delta', 'done', 'error')
 * @param {Object} data - Event payload (will be JSON-stringified)
 * @returns {string} Formatted SSE event string
 */
export function formatSSEEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ============================================================================
// Text Chunking
// ============================================================================

/**
 * Split text into chunks for streaming delivery.
 *
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Maximum characters per chunk (default: 160)
 * @returns {string[]} Array of text chunks
 */
export function chunkTextForStreaming(text, chunkSize = 160) {
  if (!text || typeof text !== 'string') return [];
  const size = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 160;
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// Buffered Stream Creation
// ============================================================================

/**
 * Create a ReadableStream that delivers a complete reading as SSE events.
 *
 * Used for non-streaming backends (local-composer, Claude) to provide
 * a consistent streaming interface to clients.
 *
 * Event sequence:
 * 1. meta - Reading metadata (themes, context, etc.)
 * 2. delta (multiple) - Text chunks
 * 3. done - Completion signal with full text
 *
 * @param {Object} responsePayload - Complete reading response
 * @param {Object} options - Streaming options
 * @param {number} options.chunkSize - Characters per delta event
 * @returns {ReadableStream} SSE stream
 */
export function createReadingStream(responsePayload, options = {}) {
  const encoder = new TextEncoder();
  const readingText = typeof responsePayload?.reading === 'string' ? responsePayload.reading : '';
  const chunks = chunkTextForStreaming(readingText, options.chunkSize);

  const meta = {
    requestId: responsePayload?.requestId || null,
    provider: responsePayload?.provider || null,
    themes: responsePayload?.themes || null,
    emotionalTone: responsePayload?.emotionalTone || null,
    ephemeris: responsePayload?.ephemeris || null,
    context: responsePayload?.context || null,
    contextDiagnostics: responsePayload?.contextDiagnostics || [],
    graphRAG: responsePayload?.graphRAG || null,
    spreadAnalysis: responsePayload?.spreadAnalysis || null,
    gateBlocked: responsePayload?.gateBlocked || false,
    gateReason: responsePayload?.gateReason || null,
    backendErrors: responsePayload?.backendErrors || null
  };

  const donePayload = {
    fullText: readingText,
    provider: responsePayload?.provider || null,
    requestId: responsePayload?.requestId || null,
    gateBlocked: responsePayload?.gateBlocked || false,
    gateReason: responsePayload?.gateReason || null
  };

  const streamEvents = [
    formatSSEEvent('meta', meta),
    ...chunks.map((chunk) => formatSSEEvent('delta', { text: chunk })),
    formatSSEEvent('done', donePayload)
  ];

  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index >= streamEvents.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(streamEvents[index]));
      index += 1;
    }
  });
}

// ============================================================================
// Stream Collection (Buffered Gate Support)
// ============================================================================

/**
 * Collect full text from an SSE stream that emits delta/done/error events.
 *
 * @param {ReadableStream} stream - SSE stream with delta/done events
 * @returns {Promise<{ fullText: string, error: string|null, sawError: boolean, donePayload: Object|null }>}
 */
export async function collectSSEStreamText(stream) {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let donePayload = null;
  let errorMessage = null;
  let sawError = false;

  const reader = stream.getReader();

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

    try {
      const data = JSON.parse(eventData);
      if (eventType === 'delta' && data?.text) {
        fullText += data.text;
      } else if (eventType === 'done') {
        donePayload = data;
        if (typeof data?.fullText === 'string') {
          fullText = data.fullText;
        }
      } else if (eventType === 'error') {
        sawError = true;
        errorMessage = data?.message || 'Streaming error';
      }
    } catch {
      // Ignore parse errors for malformed events
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';

      events.forEach(processEventBlock);
    }

    const finalChunk = decoder.decode();
    if (finalChunk) {
      buffer += finalChunk;
    }
    if (buffer.trim()) {
      processEventBlock(buffer);
    }
  } catch (error) {
    sawError = true;
    errorMessage = error?.message || 'Streaming error';
  } finally {
    reader.releaseLock();
  }

  return {
    fullText,
    error: errorMessage,
    sawError,
    donePayload
  };
}

// ============================================================================
// Real-time Stream Wrapping
// ============================================================================

/**
 * Wrap an upstream SSE stream with custom metadata and completion handling.
 *
 * Used for Azure token streaming to:
 * 1. Inject our own meta event (replacing upstream meta)
 * 2. Collect full text from delta events
 * 3. Trigger completion callback for metrics/tracking
 * 4. Handle SSE events split across network chunks
 *
 * @param {ReadableStream} stream - Upstream SSE stream from Azure
 * @param {Object} options - Wrapping options
 * @param {Object} options.meta - Metadata to inject as first event
 * @param {Object} options.ctx - Context with waitUntil for background tasks
 * @param {Function} options.onComplete - Async callback with full text
 * @returns {ReadableStream} Wrapped SSE stream
 */
export function wrapReadingStreamWithMetadata(stream, { meta, ctx, onComplete }) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const fullTextChunks = [];
  let sawError = false;
  // Buffer for SSE events that may be split across chunks
  let sseBuffer = '';
  // Keep reference to reader for cancel handling
  let reader = null;

  // Helper to process complete SSE events from buffer
  function processCompleteEvents(buffer, isFinal = false) {
    const events = buffer.split(/\r?\n\r?\n/);
    // Keep the last element as potential incomplete event (unless final)
    const remainder = isFinal ? '' : (events.pop() || '');
    const forwardEvents = [];

    for (const eventBlock of events) {
      if (!eventBlock.trim()) continue;

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

      // Drop upstream meta events to avoid duplicate meta payloads
      if (eventType === 'meta') {
        continue;
      }

      // Check for error events
      if (eventType === 'error') {
        sawError = true;
      }

      // Extract text from delta events
      if (eventType === 'delta' && eventData) {
        try {
          const data = JSON.parse(eventData);
          if (data.text) {
            fullTextChunks.push(data.text);
          }
        } catch {
          // Ignore parse errors
        }
      }

      forwardEvents.push(eventBlock);
    }

    return { remainder, forwardEvents };
  }

  return new ReadableStream({
    async start(controller) {
      const metaEvent = formatSSEEvent('meta', meta);
      controller.enqueue(encoder.encode(metaEvent));

      reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Flush any remaining bytes from the TextDecoder
            // This handles incomplete multi-byte sequences at stream end
            const finalChunk = decoder.decode();
            if (finalChunk) {
              sseBuffer += finalChunk;
            }

            // Process any remaining buffered content
            if (sseBuffer.length > 0) {
              const { forwardEvents } = processCompleteEvents(sseBuffer, true);
              forwardEvents.forEach((ev) => controller.enqueue(encoder.encode(`${ev}\n\n`)));
            }

            if (!sawError && onComplete) {
              const mergedText = fullTextChunks.join('');
              const trackingPromise = onComplete(mergedText).catch(err => {
                console.warn('[wrapReadingStreamWithMetadata] onComplete error:', err.message);
              });
              if (ctx?.waitUntil) {
                ctx.waitUntil(trackingPromise);
              }
            } else if (sawError) {
              console.log('[wrapReadingStreamWithMetadata] Skipping completion due to error event');
            }
            controller.close();
            break;
          }

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          sseBuffer += chunk;

          // Process complete SSE events, keeping any trailing incomplete event
          // This handles events that span multiple chunks (common on slow networks)
          const { remainder, forwardEvents } = processCompleteEvents(sseBuffer, false);
          sseBuffer = remainder;

          // Forward only non-meta events to the client
          forwardEvents.forEach((ev) => controller.enqueue(encoder.encode(`${ev}\n\n`)));
        }
      } catch (error) {
        console.error('[wrapReadingStreamWithMetadata] Stream error:', error.message);

        const errorEvent = formatSSEEvent('error', { message: error.message });
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },

    cancel(reason) {
      // Client disconnected - stop reading from upstream
      console.log('[wrapReadingStreamWithMetadata] Client disconnected:', reason?.message || reason || 'unknown');
      if (reader) {
        reader.cancel(reason).catch(() => {
          // Ignore cancel errors - upstream may already be closed
        });
      }
    }
  });
}
