/**
 * Azure OpenAI Responses API - Streaming Support
 *
 * Provides SSE streaming for the Responses API.
 * Events follow the OpenAI Responses API format:
 * - response.created
 * - response.output_text.delta (contains text chunks)
 * - response.output_text.done
 * - response.completed
 * - response.error
 */

import { ensureAzureConfig } from './azureResponses.js';

/**
 * Call Azure Responses API with streaming enabled
 * Returns a ReadableStream that emits SSE-formatted events
 *
 * @param {Object} env - Environment bindings
 * @param {Object} options - Request options
 * @param {string} options.instructions - System instructions
 * @param {string} options.input - User input
 * @param {number} options.maxTokens - Max output tokens (default: 400)
 * @param {string} options.verbosity - Text verbosity level (default: 'medium')
 * @returns {ReadableStream} SSE event stream
 */
export async function callAzureResponsesStream(env, {
  instructions,
  input,
  maxTokens = 400,
  verbosity = 'medium'
}) {
  const { endpoint, apiKey, model, apiVersion } = ensureAzureConfig(env);
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

  const body = {
    model,
    instructions,
    input,
    max_output_tokens: maxTokens,
    text: { verbosity },
    stream: true
  };

  console.log('[azureResponsesStream] Starting streaming request', {
    url,
    model,
    apiVersion,
    maxTokens,
    verbosity
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[azureResponsesStream] Non-OK HTTP status', {
      status: response.status,
      statusText: response.statusText,
      bodyPreview: errText.slice(0, 500)
    });
    throw new Error(`Azure Responses API error ${response.status}: ${errText}`);
  }

  if (!response.body) {
    throw new Error('Azure Responses API returned no body for streaming');
  }

  return response.body;
}

/**
 * Transform Azure SSE stream to a simplified SSE format for the frontend
 *
 * Azure emits events like:
 *   event: response.output_text.delta
 *   data: {"type":"response.output_text.delta","delta":"Hello","output_index":0,...}
 *
 * We transform to a simpler format:
 *   event: delta
 *   data: {"text":"Hello"}
 *
 *   event: done
 *   data: {"fullText":"Hello world"}
 *
 *   event: error
 *   data: {"message":"Error description"}
 *
 * @param {ReadableStream} azureStream - Raw SSE stream from Azure
 * @returns {ReadableStream} Transformed SSE stream
 */
export function transformAzureStream(azureStream) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let buffer = '';
  let fullText = '';
  let eventType = '';
  let eventData = '';

  return new ReadableStream({
    async start(controller) {
      const reader = azureStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Stream ended - send done event with full text
            const doneEvent = formatSSE('done', { fullText });
            controller.enqueue(encoder.encode(doneEvent));
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (separated by double newline)
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete event in buffer

          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue;

            // Parse SSE event
            const lines = eventBlock.split('\n');
            eventType = '';
            eventData = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                eventData = line.slice(5).trim();
              }
            }

            // Skip empty events
            if (!eventType && !eventData) continue;

            // Handle different event types
            try {
              if (eventType === 'response.output_text.delta' ||
                  (eventData && eventData.includes('"type":"response.output_text.delta"'))) {
                const parsed = JSON.parse(eventData);
                const delta = parsed.delta || '';
                if (delta) {
                  fullText += delta;
                  const deltaEvent = formatSSE('delta', { text: delta });
                  controller.enqueue(encoder.encode(deltaEvent));
                }
              } else if (eventType === 'response.completed' ||
                         (eventData && eventData.includes('"type":"response.completed"'))) {
                // Response completed - we'll send done event after stream ends
                console.log('[azureResponsesStream] Response completed event received');
              } else if (eventType === 'response.error' ||
                         eventType === 'error' ||
                         (eventData && eventData.includes('"type":"response.error"'))) {
                const parsed = JSON.parse(eventData);
                const errorMsg = parsed.error?.message || parsed.message || 'Unknown error';
                const errorEvent = formatSSE('error', { message: errorMsg });
                controller.enqueue(encoder.encode(errorEvent));
              }
              // Ignore other event types (response.created, response.in_progress, etc.)
            } catch (parseError) {
              console.warn('[azureResponsesStream] Failed to parse event:', eventData?.slice(0, 200));
            }
          }
        }
      } catch (error) {
        console.error('[azureResponsesStream] Stream processing error:', error.message);
        const errorEvent = formatSSE('error', { message: error.message });
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    }
  });
}

/**
 * Format an SSE event string
 *
 * @param {string} event - Event type
 * @param {Object} data - Event data
 * @returns {string} Formatted SSE event
 */
function formatSSE(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Create SSE Response with proper headers
 *
 * @param {ReadableStream} stream - SSE event stream
 * @param {Object} options - Additional response options
 * @returns {Response} SSE Response object
 */
export function createSSEResponse(stream, options = {}) {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
    ...options.headers
  };

  return new Response(stream, {
    status: options.status || 200,
    headers
  });
}

/**
 * Send an SSE error response (non-streaming)
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {Response} SSE error response
 */
export function createSSEErrorResponse(message, status = 500) {
  const encoder = new TextEncoder();
  const errorEvent = formatSSE('error', { message });
  const doneEvent = formatSSE('done', { fullText: '', error: true });

  const body = encoder.encode(errorEvent + doneEvent);

  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  });
}

export default {
  callAzureResponsesStream,
  transformAzureStream,
  createSSEResponse,
  createSSEErrorResponse
};
