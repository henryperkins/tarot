/**
 * Azure OpenAI Responses API - Streaming Support
 *
 * Provides SSE streaming for the Responses API.
 * Events follow the OpenAI Responses API format:
 * - response.created
 * - response.output_text.delta (contains text chunks)
 * - response.output_text.done
 * - response.function_call_arguments.delta (tool call arguments)
 * - response.function_call_arguments.done
 * - response.code_interpreter_call_code.delta
 * - response.code_interpreter_call_code.done
 * - response.code_interpreter_call.completed
 * - response.completed
 * - response.error
 */

import { ensureAzureConfig, resolveResponsesUser } from './azureResponses.js';

/**
 * Call Azure Responses API with streaming enabled
 * Returns a ReadableStream that emits SSE-formatted events
 *
 * @param {Object} env - Environment bindings
 * @param {Object} options - Request options
 * @param {string} options.instructions - System instructions
 * @param {string} options.input - User input
 * @param {number|null} options.maxTokens - Max output tokens (default: 400, null = no limit)
 * @param {string|null} options.reasoningEffort - Reasoning effort level ('none'|'minimal'|'low'|'medium'|'high'|'xhigh', null = omit)
 * @param {string|null} options.reasoningSummary - Reasoning summary mode ('auto'|'concise'|'detailed', null = omit)
 * @param {string} options.verbosity - Text verbosity level (default: 'medium')
 * @param {string|null} options.user - Optional end-user identifier for abuse monitoring
 * @param {Array} options.tools - Optional array of tool definitions
 * @returns {ReadableStream} SSE event stream
 */
export async function callAzureResponsesStream(env, {
  instructions,
  input,
  maxTokens = 400,
  reasoningEffort = null,
  reasoningSummary = null,
  verbosity = 'medium',
  user = null,
  tools = null
}) {
  const { endpoint, apiKey, model, apiVersion } = ensureAzureConfig(env);
  const resolvedUser = resolveResponsesUser(env, user);
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

  const body = {
    model,
    instructions,
    input,
    text: { verbosity },
    stream: true
  };

  if (maxTokens !== null) {
    body.max_output_tokens = maxTokens;
  }

  if (reasoningEffort !== null || reasoningSummary !== null) {
    body.reasoning = {};
    if (reasoningEffort !== null) {
      body.reasoning.effort = reasoningEffort;
    }
    if (reasoningSummary !== null) {
      body.reasoning.summary = reasoningSummary;
    }
  }

  if (resolvedUser) {
    body.user = resolvedUser;
  }

  // Add tools if provided
  if (tools && Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
  }

  console.log('[azureResponsesStream] Starting streaming request', {
    url,
    model,
    apiVersion,
    maxTokens: maxTokens ?? 'unlimited',
    reasoningEffort: reasoningEffort ?? 'omitted',
    reasoningSummary: reasoningSummary ?? 'omitted',
    verbosity,
    userProvided: Boolean(resolvedUser)
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
  let reasoningSummary = '';
  let reader = null;

  const processEventBlock = (eventBlock, controller) => {
    if (!eventBlock.trim()) return;

    const lines = eventBlock.split(/\r?\n/);
    let eventType = '';
    const dataLines = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    const eventData = dataLines.join('\n');
    if (!eventType && !eventData) return;

    try {
      const parsed = eventData ? JSON.parse(eventData) : {};
      const dataType = parsed.type || eventType;

      if (dataType === 'response.output_text.delta') {
        const delta = typeof parsed.delta === 'string' ? parsed.delta : (parsed.text || '');
        if (delta) {
          fullText += delta;
          const deltaEvent = formatSSE('delta', { text: delta });
          controller.enqueue(encoder.encode(deltaEvent));
        }
      } else if (dataType === 'response.output_text.done') {
        if (typeof parsed.text === 'string' && parsed.text.length > 0) {
          fullText = parsed.text;
        }
      } else if (dataType === 'response.reasoning_summary_text.delta') {
        const delta = typeof parsed.delta === 'string' ? parsed.delta : '';
        if (delta) {
          reasoningSummary += delta;
          const reasoningEvent = formatSSE('reasoning', { text: delta, partial: true });
          controller.enqueue(encoder.encode(reasoningEvent));
        }
      } else if (dataType === 'response.reasoning_summary_text.done') {
        if (parsed.text) {
          reasoningSummary = parsed.text;
        }
        const reasoningEvent = formatSSE('reasoning', { text: reasoningSummary, partial: false });
        controller.enqueue(encoder.encode(reasoningEvent));
      } else if (dataType === 'response.code_interpreter_call_code.delta') {
        const codeDelta = typeof parsed.delta === 'string' ? parsed.delta : '';
        if (codeDelta) {
          const codeEvent = formatSSE('code_interpreter_delta', {
            code: codeDelta,
            itemId: parsed.item_id || null,
            outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
          });
          controller.enqueue(encoder.encode(codeEvent));
        }
      } else if (dataType === 'response.code_interpreter_call_code.done') {
        const codeEvent = formatSSE('code_interpreter_done', {
          code: typeof parsed.code === 'string' ? parsed.code : '',
          itemId: parsed.item_id || null,
          outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
        });
        controller.enqueue(encoder.encode(codeEvent));
      } else if (dataType === 'response.code_interpreter_call.in_progress' ||
        dataType === 'response.code_interpreter_call.interpreting' ||
        dataType === 'response.code_interpreter_call.completed') {
        const codeStatusEvent = formatSSE('code_interpreter_status', {
          status: dataType.replace('response.code_interpreter_call.', ''),
          itemId: parsed.item_id || null,
          outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
        });
        controller.enqueue(encoder.encode(codeStatusEvent));
      } else if (dataType === 'response.completed') {
        console.log('[azureResponsesStream] Response completed event received');
      } else if (dataType === 'response.error' || dataType === 'error') {
        const errorMsg = parsed.error?.message || parsed.message || 'Unknown error';
        const errorEvent = formatSSE('error', { message: errorMsg });
        controller.enqueue(encoder.encode(errorEvent));
      }
      // Ignore other event types (response.created, response.in_progress, etc.)
    } catch (parseError) {
      console.warn('[azureResponsesStream] Failed to parse event:', {
        event: eventData?.slice(0, 200),
        error: parseError?.message
      });
    }
  };

  return new ReadableStream({
    async start(controller) {
      reader = azureStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            const finalChunk = decoder.decode();
            if (finalChunk) {
              buffer += finalChunk;
            }

            const trailingEvents = buffer.split(/\r?\n\r?\n/);
            buffer = '';
            trailingEvents.forEach((eventBlock) => processEventBlock(eventBlock, controller));

            // Stream ended - send done event with full text and reasoning
            // Include isEmpty flag so consumers know if this was a tool-only response
            const isEmpty = !fullText || !fullText.trim();
            const doneEvent = formatSSE('done', { fullText, reasoningSummary: reasoningSummary || null, isEmpty });
            controller.enqueue(encoder.encode(doneEvent));
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (separated by double newline)
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || ''; // Keep incomplete event in buffer

          for (const eventBlock of events) {
            processEventBlock(eventBlock, controller);
          }
        }
      } catch (error) {
        console.error('[azureResponsesStream] Stream processing error:', error.message);
        const errorEvent = formatSSE('error', { message: error.message });
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      } finally {
        reader?.releaseLock();
      }
    },
    cancel(reason) {
      if (reader) {
        reader.cancel(reason).catch(() => {
          // Ignore cancel errors - upstream may already be closed
        });
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

/**
 * Transform Azure SSE stream with tool call support
 *
 * Similar to transformAzureStream but also handles:
 * - response.function_call_arguments.delta (accumulates tool call args)
 * - response.function_call_arguments.done (signals tool call complete)
 * - response.output_item.added (new output item, including function calls)
 *
 * Returns an object with:
 * - stream: ReadableStream for text deltas
 * - toolCallPromise: Promise that resolves with tool call info if one occurs
 *
 * @param {ReadableStream} azureStream - Raw SSE stream from Azure
 * @param {Object} options
 * @param {Function} options.onToolCall - Callback when tool call detected: (callId, name, args) => result
 * @returns {{ stream: ReadableStream, getToolCalls: () => Array }}
 */
export function transformAzureStreamWithTools(azureStream, { onToolCall = null } = {}) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let buffer = '';
  let fullText = '';
  let reader = null;
  let cancelled = false;

  // Tool call accumulation
  const toolCalls = new Map(); // callId -> { name, arguments }
  let currentCallId = null;
  const pendingToolCalls = [];

  const stream = new ReadableStream({
    async start(controller) {
      reader = azureStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            const finalChunk = decoder.decode();
            if (finalChunk) {
              buffer += finalChunk;
            }

            const trailingEvents = buffer.split(/\r?\n\r?\n/);
            buffer = '';
            for (const eventBlock of trailingEvents) {
              if (!eventBlock.trim()) continue;
              if (cancelled) break;

              // Parse SSE event
              const lines = eventBlock.split(/\r?\n/);
              let eventType = '';
              const dataLines = [];

              for (const line of lines) {
                if (line.startsWith('event:')) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataLines.push(line.slice(5).trim());
                }
              }

              const eventData = dataLines.join('\n');
              if (!eventType && !eventData) continue;

              try {
                const parsed = eventData ? JSON.parse(eventData) : {};
                const dataType = parsed.type || eventType;

                if (dataType === 'response.output_text.delta') {
                  const delta = typeof parsed.delta === 'string' ? parsed.delta : (parsed.text || '');
                  if (delta) {
                    fullText += delta;
                    const deltaEvent = formatSSE('delta', { text: delta });
                    controller.enqueue(encoder.encode(deltaEvent));
                  }
                } else if (dataType === 'response.output_text.done') {
                  if (typeof parsed.text === 'string' && parsed.text.length > 0) {
                    fullText = parsed.text;
                  }
                } else if (dataType === 'response.output_item.added') {
                  if (parsed.item?.type === 'function_call') {
                    currentCallId = parsed.item.call_id;
                    toolCalls.set(currentCallId, {
                      name: parsed.item.name || '',
                      arguments: ''
                    });
                  }
                } else if (dataType === 'response.function_call_arguments.delta') {
                  const callId = parsed.call_id || currentCallId;
                  const argDelta = parsed.delta || '';
                  if (callId && toolCalls.has(callId)) {
                    toolCalls.get(callId).arguments += argDelta;
                  }
                } else if (dataType === 'response.function_call_arguments.done') {
                  const callId = parsed.call_id || currentCallId;
                  if (callId && toolCalls.has(callId)) {
                    const tc = toolCalls.get(callId);
                    let parsedArgs = {};
                    try {
                      parsedArgs = JSON.parse(tc.arguments || '{}');
                    } catch {
                      parsedArgs = {};
                    }
                    pendingToolCalls.push({
                      callId,
                      name: tc.name,
                      arguments: parsedArgs
                    });

                    // Emit tool_call event
                    const toolCallEvent = formatSSE('tool_call', {
                      callId,
                      name: tc.name,
                      arguments: parsedArgs
                    });
                    controller.enqueue(encoder.encode(toolCallEvent));
                  }
                } else if (dataType === 'response.code_interpreter_call_code.delta') {
                  const codeDelta = typeof parsed.delta === 'string' ? parsed.delta : '';
                  if (codeDelta) {
                    const codeEvent = formatSSE('code_interpreter_delta', {
                      code: codeDelta,
                      itemId: parsed.item_id || null,
                      outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
                    });
                    controller.enqueue(encoder.encode(codeEvent));
                  }
                } else if (dataType === 'response.code_interpreter_call_code.done') {
                  const codeEvent = formatSSE('code_interpreter_done', {
                    code: typeof parsed.code === 'string' ? parsed.code : '',
                    itemId: parsed.item_id || null,
                    outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
                  });
                  controller.enqueue(encoder.encode(codeEvent));
                } else if (dataType === 'response.code_interpreter_call.in_progress' ||
                  dataType === 'response.code_interpreter_call.interpreting' ||
                  dataType === 'response.code_interpreter_call.completed') {
                  const codeStatusEvent = formatSSE('code_interpreter_status', {
                    status: dataType.replace('response.code_interpreter_call.', ''),
                    itemId: parsed.item_id || null,
                    outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
                  });
                  controller.enqueue(encoder.encode(codeStatusEvent));
                } else if (dataType === 'response.completed') {
                  console.log('[azureResponsesStream] Response completed');
                } else if (dataType === 'response.error' || dataType === 'error') {
                  const errorMsg = parsed.error?.message || parsed.message || 'Unknown error';
                  const errorEvent = formatSSE('error', { message: errorMsg });
                  controller.enqueue(encoder.encode(errorEvent));
                }
              } catch (parseError) {
                console.warn('[azureResponsesStream] Failed to parse event:', {
                  event: eventData?.slice(0, 200),
                  error: parseError?.message
                });
              }
            }

            // Process any pending tool calls before closing
            if (!cancelled && pendingToolCalls.length > 0 && onToolCall) {
              for (const tc of pendingToolCalls) {
                try {
                  const result = await onToolCall(tc.callId, tc.name, tc.arguments);
                  // Emit tool_result event so caller knows tool was executed
                  const toolResultEvent = formatSSE('tool_result', {
                    callId: tc.callId,
                    name: tc.name,
                    result
                  });
                  controller.enqueue(encoder.encode(toolResultEvent));
                } catch (err) {
                  console.warn('[azureResponsesStream] Tool call error:', err.message);
                }
              }
            }

            // Stream ended - send done event with full text
            // Include isEmpty flag so consumers know if this was a tool-only response
            const isEmpty = !fullText || !fullText.trim();
            const doneEvent = formatSSE('done', { fullText, isEmpty });
            controller.enqueue(encoder.encode(doneEvent));
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (separated by double newline)
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || '';

          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue;
            if (cancelled) break;

            // Parse SSE event
            const lines = eventBlock.split(/\r?\n/);
            let eventType = '';
            const dataLines = [];

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
              }
            }

            const eventData = dataLines.join('\n');
            if (!eventType && !eventData) continue;

            try {
              const parsed = eventData ? JSON.parse(eventData) : {};
              const dataType = parsed.type || eventType;

              // Handle text deltas
              if (dataType === 'response.output_text.delta') {
                const delta = typeof parsed.delta === 'string' ? parsed.delta : (parsed.text || '');
                if (delta) {
                  fullText += delta;
                  const deltaEvent = formatSSE('delta', { text: delta });
                  controller.enqueue(encoder.encode(deltaEvent));
                }
              }
              // Handle output text done
              else if (dataType === 'response.output_text.done') {
                if (typeof parsed.text === 'string' && parsed.text.length > 0) {
                  fullText = parsed.text;
                }
              }
              // Handle function call output item added
              else if (dataType === 'response.output_item.added') {
                if (parsed.item?.type === 'function_call') {
                  currentCallId = parsed.item.call_id;
                  toolCalls.set(currentCallId, {
                    name: parsed.item.name || '',
                    arguments: ''
                  });
                }
              }
              // Handle function call arguments delta
              else if (dataType === 'response.function_call_arguments.delta') {
                const callId = parsed.call_id || currentCallId;
                const argDelta = parsed.delta || '';
                if (callId && toolCalls.has(callId)) {
                  toolCalls.get(callId).arguments += argDelta;
                }
              }
              // Handle function call arguments done
              else if (dataType === 'response.function_call_arguments.done') {
                const callId = parsed.call_id || currentCallId;
                if (callId && toolCalls.has(callId)) {
                  const tc = toolCalls.get(callId);
                  let parsedArgs = {};
                  try {
                    parsedArgs = JSON.parse(tc.arguments || '{}');
                  } catch {
                    parsedArgs = {};
                  }
                  pendingToolCalls.push({
                    callId,
                    name: tc.name,
                    arguments: parsedArgs
                  });

                  // Emit tool_call event
                  const toolCallEvent = formatSSE('tool_call', {
                    callId,
                    name: tc.name,
                    arguments: parsedArgs
                  });
                  controller.enqueue(encoder.encode(toolCallEvent));
                }
              }
              // Handle code interpreter code delta
              else if (dataType === 'response.code_interpreter_call_code.delta') {
                const codeDelta = typeof parsed.delta === 'string' ? parsed.delta : '';
                if (codeDelta) {
                  const codeEvent = formatSSE('code_interpreter_delta', {
                    code: codeDelta,
                    itemId: parsed.item_id || null,
                    outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
                  });
                  controller.enqueue(encoder.encode(codeEvent));
                }
              }
              // Handle code interpreter code completion
              else if (dataType === 'response.code_interpreter_call_code.done') {
                const codeEvent = formatSSE('code_interpreter_done', {
                  code: typeof parsed.code === 'string' ? parsed.code : '',
                  itemId: parsed.item_id || null,
                  outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
                });
                controller.enqueue(encoder.encode(codeEvent));
              }
              // Handle code interpreter call lifecycle states
              else if (dataType === 'response.code_interpreter_call.in_progress' ||
                dataType === 'response.code_interpreter_call.interpreting' ||
                dataType === 'response.code_interpreter_call.completed') {
                const codeStatusEvent = formatSSE('code_interpreter_status', {
                  status: dataType.replace('response.code_interpreter_call.', ''),
                  itemId: parsed.item_id || null,
                  outputIndex: typeof parsed.output_index === 'number' ? parsed.output_index : null
                });
                controller.enqueue(encoder.encode(codeStatusEvent));
              }
              // Handle completion
              else if (dataType === 'response.completed') {
                console.log('[azureResponsesStream] Response completed');
              }
              // Handle errors
              else if (dataType === 'response.error' || dataType === 'error') {
                const errorMsg = parsed.error?.message || parsed.message || 'Unknown error';
                const errorEvent = formatSSE('error', { message: errorMsg });
                controller.enqueue(encoder.encode(errorEvent));
              }
            } catch (parseError) {
              console.warn('[azureResponsesStream] Failed to parse event:', {
                event: eventData?.slice(0, 200),
                error: parseError?.message
              });
            }
          }
        }
      } catch (error) {
        console.error('[azureResponsesStream] Stream processing error:', error.message);
        const errorEvent = formatSSE('error', { message: error.message });
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      } finally {
        reader?.releaseLock();
      }
    },
    cancel(reason) {
      cancelled = true;
      if (reader) {
        reader.cancel(reason).catch(() => {
          // Ignore cancel errors - upstream may already be closed
        });
      }
    }
  });

  return {
    stream,
    getToolCalls: () => [...pendingToolCalls],
    getFullText: () => fullText
  };
}

/**
 * Call Azure Responses API with conversation history (for tool continuations)
 *
 * After a tool call, we need to continue the conversation by sending:
 * 1. The original user input
 * 2. The assistant's function_call
 * 3. The function_call_output (tool result)
 *
 * @param {Object} env - Environment bindings
 * @param {Object} options - Request options
 * @param {string} options.instructions - System instructions
 * @param {Array} options.conversation - Conversation history array
 * @param {number|null} options.maxTokens - Max output tokens
 * @param {string} options.verbosity - Text verbosity level
 * @param {string|null} options.user - Optional end-user identifier for abuse monitoring
 * @returns {ReadableStream} SSE event stream
 */
export async function callAzureResponsesStreamWithConversation(env, {
  instructions,
  conversation,
  maxTokens = 400,
  verbosity = 'medium',
  user = null
}) {
  const { endpoint, apiKey, model, apiVersion } = ensureAzureConfig(env);
  const resolvedUser = resolveResponsesUser(env, user);
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

  const body = {
    model,
    instructions,
    input: conversation,
    text: { verbosity },
    stream: true
  };

  if (maxTokens !== null) {
    body.max_output_tokens = maxTokens;
  }

  if (resolvedUser) {
    body.user = resolvedUser;
  }

  console.log('[azureResponsesStream] Starting continuation request', {
    url,
    model,
    conversationLength: conversation.length,
    maxTokens: maxTokens ?? 'unlimited',
    verbosity,
    userProvided: Boolean(resolvedUser)
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
    console.error('[azureResponsesStream] Continuation request failed', {
      status: response.status,
      statusText: response.statusText,
      bodyPreview: errText.slice(0, 500)
    });
    throw new Error(`Azure Responses API continuation error ${response.status}: ${errText}`);
  }

  if (!response.body) {
    throw new Error('Azure Responses API returned no body for continuation');
  }

  return response.body;
}

/**
 * Build conversation array for tool continuation
 *
 * @param {string} userInput - Original user message
 * @param {Array} toolCalls - Tool calls from assistant [{ callId, name, arguments }]
 * @param {Array} toolResults - Tool results [{ callId, result }]
 * @param {string} [initialAssistantText] - Assistant text emitted before tool calls
 * @returns {Array} Conversation array for Azure Responses API
 */
export function buildToolContinuationConversation(userInput, toolCalls, toolResults, initialAssistantText = '') {
  const conversation = [
    { role: 'user', content: userInput }
  ];

  if (typeof initialAssistantText === 'string' && initialAssistantText.trim()) {
    conversation.push({ role: 'assistant', content: initialAssistantText });
  }

  // Add each tool call and its result
  for (const tc of toolCalls) {
    // Add the function call from assistant
    conversation.push({
      type: 'function_call',
      call_id: tc.callId,
      name: tc.name,
      arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments)
    });

    // Find matching result
    const result = toolResults.find(r => r.callId === tc.callId);
    if (result) {
      conversation.push({
        type: 'function_call_output',
        call_id: tc.callId,
        output: typeof result.result === 'string' ? result.result : JSON.stringify(result.result)
      });
    }
  }

  return conversation;
}

export default {
  callAzureResponsesStream,
  callAzureResponsesStreamWithConversation,
  buildToolContinuationConversation,
  transformAzureStream,
  transformAzureStreamWithTools,
  createSSEResponse,
  createSSEErrorResponse
};
