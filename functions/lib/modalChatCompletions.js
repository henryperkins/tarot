import { observeInferenceAttempt } from './inferenceAttempts.js';
import { withRetry, generateIdempotencyKey } from './retryWithBackoff.js';

export const MODAL_DEFAULT_MODEL = 'Qwen/Qwen3.8-Max-VL-Thinking';
export const MODAL_DEFAULT_REASONING_EFFORT = 'high';

const MODAL_DEFAULT_TIMEOUT_MS = 300000;
const MODAL_MAX_TIMEOUT_MS = 600000;
const MODAL_REASONING_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh']);

function parseBoundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;

  const inputTokens = usage.input_tokens ?? usage.prompt_tokens;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens
    ?? usage.completion_tokens_details?.reasoning_tokens
    ?? usage.reasoning_tokens;

  return {
    ...(Number.isFinite(inputTokens) ? { input_tokens: inputTokens } : {}),
    ...(Number.isFinite(outputTokens) ? { output_tokens: outputTokens } : {}),
    ...(Number.isFinite(usage.total_tokens) ? { total_tokens: usage.total_tokens } : {}),
    ...(Number.isFinite(reasoningTokens)
      ? { output_tokens_details: { reasoning_tokens: reasoningTokens } }
      : {})
  };
}

function normalizeEndpointUrl(value) {
  const rawEndpoint = typeof value === 'string' ? value.trim() : '';
  if (!rawEndpoint) {
    throw new Error('Modal configuration is missing MODAL_ENDPOINT_URL.');
  }

  let parsed;
  try {
    parsed = new URL(rawEndpoint);
  } catch {
    throw new Error('MODAL_ENDPOINT_URL must be a valid HTTPS URL.');
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('MODAL_ENDPOINT_URL must be a credential-free HTTPS URL without query parameters or fragments.');
  }

  const normalizedPath = parsed.pathname
    .replace(/\/+$/, '')
    .replace(/\/v1(?:\/chat\/completions)?$/, '');
  parsed.pathname = `${normalizedPath}/v1/chat/completions`;

  return parsed.toString();
}

function resolveReasoningEffort(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return MODAL_REASONING_EFFORTS.has(normalized)
    ? normalized
    : MODAL_DEFAULT_REASONING_EFFORT;
}

function samplingNumber(value, fallback, maximum, name) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > maximum) {
    throw new Error(`${name} must be a number between 0 and ${maximum}.`);
  }
  return number;
}

function streamSetting(value) {
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw new Error('MODAL_STREAM must be true or false.');
}

export function ensureModalConfig(env) {
  const clean = (value) => typeof value === 'string' ? value.trim() : '';
  const hasPair = env?.MODAL_PROXY_TOKEN_ID !== undefined || env?.MODAL_PROXY_TOKEN_SECRET !== undefined;
  let proxyToken;
  if (hasPair) {
    const id = clean(env.MODAL_PROXY_TOKEN_ID);
    const secret = clean(env.MODAL_PROXY_TOKEN_SECRET);
    if (!id || !secret || /\s/.test(id + secret)) {
      throw new Error('Modal configuration requires both MODAL_PROXY_TOKEN_ID and MODAL_PROXY_TOKEN_SECRET.');
    }
    proxyToken = `${id}.${secret}`;
  } else {
    proxyToken = clean(env?.MODAL_PROXY_TOKEN);
    if (!proxyToken || /\s/.test(proxyToken)) throw new Error('Modal configuration is missing a valid MODAL_PROXY_TOKEN.');
  }
  return {
    url: normalizeEndpointUrl(env?.MODAL_ENDPOINT_URL),
    proxyToken,
    model: clean(env?.MODAL_MODEL) || MODAL_DEFAULT_MODEL,
    reasoningEffort: resolveReasoningEffort(env?.MODAL_REASONING_EFFORT),
    timeoutMs: parseBoundedInteger(env?.MODAL_TIMEOUT_MS, MODAL_DEFAULT_TIMEOUT_MS, 1000, MODAL_MAX_TIMEOUT_MS),
    stream: streamSetting(env?.MODAL_STREAM),
    temperature: samplingNumber(env?.MODAL_TEMPERATURE, 0.3, 2, 'MODAL_TEMPERATURE'),
    topP: samplingNumber(env?.MODAL_TOP_P, 0.95, 1, 'MODAL_TOP_P')
  };
}

export function isModalConfigured(env) {
  try {
    ensureModalConfig(env);
    return true;
  } catch {
    return false;
  }
}

class ModalResponseError extends Error {}
const incomplete = () => new ModalResponseError('Modal Chat Completions returned an incomplete response.');

// fetchWithRetry's timeout ends at headers and replaces the caller's signal.
// Keep one deadline and cancellation signal through retries and body consumption.
function requestLifetime(timeoutMs, callerSignal) {
  const controller = new AbortController();
  let failure;
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  // A pre-aborted caller can fire before the first raced operation is attached.
  aborted.catch(() => {});
  const abort = (message) => {
    if (controller.signal.aborted) return;
    failure = new ModalResponseError(message);
    controller.abort();
    rejectAbort(failure);
  };
  const onCallerAbort = () => abort('Modal Chat Completions request was cancelled.');
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => abort('Modal Chat Completions request timed out.'), timeoutMs);
  if (callerSignal?.aborted) onCallerAbort();
  return {
    signal: controller.signal,
    check() { if (failure) throw failure; },
    wait(promise) { return Promise.race([promise, aborted]); },
    close() {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  };
}

function toolPolicy(tools, toolChoice) {
  const names = new Set();
  if (tools !== undefined) {
    if (!Array.isArray(tools)) throw new Error('Modal tools must be an array of function definitions.');
    for (const tool of tools) {
      const name = tool?.function?.name;
      if (tool?.type !== 'function' || typeof name !== 'string' || !name.trim() || names.has(name)) {
        throw new Error('Modal tools must contain unique named function definitions.');
      }
      names.add(name);
    }
  }
  const choice = toolChoice ?? (names.size ? 'auto' : 'none');
  const named = choice?.type === 'function' ? choice.function?.name : null;
  if (!['auto', 'none', 'required'].includes(choice) && !(typeof named === 'string' && names.has(named))) {
    throw new Error('Modal toolChoice must select a supplied function or auto, none, or required.');
  }
  if (!names.size && choice !== 'none') throw new Error('Modal toolChoice requires supplied tool definitions.');
  return { names, named, allow: names.size > 0 && choice !== 'none', required: choice === 'required' || Boolean(named) };
}

function completionState() {
  return { text: '', finishReason: null, toolCalls: new Map(), usage: null, model: null, reasoningPresent: false };
}

function collectCompletion(state, data, streaming) {
  if (!data || typeof data !== 'object' || data.error) throw incomplete();
  if (data.usage && typeof data.usage === 'object') state.usage = data.usage;
  if (typeof data.model === 'string') state.model = data.model;
  if (!Array.isArray(data.choices)) throw incomplete();
  // Only choice zero belongs to this result. Other alternatives never supply
  // text, reasoning, finish reasons, or tool arguments to the selected answer.
  const choice = data.choices.find((item, index) => item?.index === 0 || (!streaming && index === 0 && item?.index === undefined));
  if (!choice) return;
  const message = (streaming ? choice.delta : choice.message) || {};
  if (state.finishReason !== null) {
    if (message.content || message.tool_calls?.length || choice.finish_reason) throw incomplete();
    return;
  }
  if (message.function_call) throw incomplete();
  for (const field of ['reasoning_content', 'reasoning']) {
    if (typeof message[field] === 'string' && message[field].trim()) state.reasoningPresent = true;
  }
  if (typeof message.content === 'string') state.text += message.content;
  else if (message.content !== undefined && message.content !== null) throw incomplete();
  if (message.tool_calls !== undefined && message.tool_calls !== null) {
    if (!Array.isArray(message.tool_calls)) throw incomplete();
    for (const [position, part] of message.tool_calls.entries()) {
      const index = streaming ? part?.index : position;
      if (!Number.isInteger(index) || index < 0 || !part || typeof part !== 'object') throw incomplete();
      const call = state.toolCalls.get(index) || { id: '', type: '', function: { name: '', arguments: '' } };
      if (part.type !== undefined && part.type !== null) {
        if (part.type !== 'function' || (call.type && call.type !== part.type)) throw incomplete();
        call.type = part.type;
      }
      for (const [target, key, value] of [
        [call, 'id', part.id],
        [call.function, 'name', part.function?.name],
        [call.function, 'arguments', part.function?.arguments]
      ]) {
        // Modal serializes unchanged optional delta fields as null; only
        // non-null fragments contribute to the final validated tool call.
        if (value !== undefined && value !== null) {
          if (typeof value !== 'string') throw incomplete();
          target[key] += value;
        }
      }
      state.toolCalls.set(index, call);
    }
  }
  if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
    if (typeof choice.finish_reason !== 'string') throw incomplete();
    state.finishReason = choice.finish_reason;
  }
}

async function readCompletion(response, lifetime) {
  if (!response.body) throw incomplete();
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const streaming = response.headers.get('content-type')?.toLowerCase().includes('text/event-stream');
  const state = completionState();
  let text = '';
  let line = '';
  let dataLines = [];
  let afterCR = false;
  let done = false;
  const cancel = () => { reader.cancel().catch(() => {}); };
  lifetime.signal.addEventListener('abort', cancel, { once: true });
  const dispatchLine = () => {
    if (line === '') {
      if (dataLines.length) {
        const payload = dataLines.join('\n');
        dataLines = [];
        if (payload.trim() === '[DONE]') done = true;
        else collectCompletion(state, JSON.parse(payload), true);
      }
    } else if (line === 'data' || line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    line = '';
  };
  const consume = (chunk) => {
    if (!streaming) { text += chunk; return; }
    for (const character of chunk) {
      if (done) break;
      if (afterCR) {
        afterCR = false;
        if (character === '\n') continue;
      }
      if (character === '\r' || character === '\n') {
        dispatchLine();
        afterCR = character === '\r';
      } else line += character;
    }
  };
  try {
    while (!done) {
      lifetime.check();
      const chunk = await lifetime.wait(reader.read());
      lifetime.check();
      if (chunk.done) { consume(decoder.decode()); break; }
      consume(decoder.decode(chunk.value, { stream: true }));
    }
    if (streaming) {
      if (!done) throw incomplete();
    } else collectCompletion(state, JSON.parse(text), false);
    return state;
  } catch (error) {
    lifetime.check();
    if (error instanceof ModalResponseError) throw error;
    throw new ModalResponseError('Modal Chat Completions returned an invalid response.');
  } finally {
    lifetime.signal.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
}

function completedResult(state, policy) {
  const text = state.text.trim();
  const toolCalls = [...state.toolCalls.entries()].sort(([left], [right]) => left - right).map(([, call]) => call);
  if (state.finishReason === 'tool_calls') {
    if (!policy.allow || !toolCalls.length) throw incomplete();
    const ids = new Set();
    for (const call of toolCalls) {
      if (!call.id.trim() || ids.has(call.id) || call.type !== 'function' || !policy.names.has(call.function.name) || (policy.named && call.function.name !== policy.named)) throw incomplete();
      ids.add(call.id);
      let argumentsObject;
      try { argumentsObject = JSON.parse(call.function.arguments); } catch { throw incomplete(); }
      if (!argumentsObject || typeof argumentsObject !== 'object' || Array.isArray(argumentsObject)) throw incomplete();
    }
  } else {
    if (state.finishReason !== 'stop' || toolCalls.length || policy.required) throw incomplete();
    if (!text) throw new ModalResponseError('Modal Chat Completions returned no text content.');
  }
  const usage = normalizeUsage(state.usage) || (state.reasoningPresent ? {} : null);
  if (usage) usage.reasoning_content_present = state.reasoningPresent;
  return { text, usage, toolCalls, finishReason: state.finishReason };
}

/**
 * Buffer a complete Modal answer (including SSE) before exposing it to callers.
 * Tool calls are returned only for explicitly supplied tools; never executed.
 * Private reasoning text and upstream error bodies are never returned or logged.
 */
async function callModalChatCompletionsInternal(env, {
  systemPrompt,
  userPrompt,
  requestId = 'unknown',
  messages,
  tools,
  toolChoice,
  stream,
  temperature,
  topP,
  maxTokens,
  signal
} = {}) {
  const config = ensureModalConfig(env);
  const policy = toolPolicy(tools, toolChoice);
  if (maxTokens !== undefined && (!Number.isSafeInteger(maxTokens) || maxTokens <= 0)) throw new Error('Modal maxTokens must be a positive integer.');
  const selectedMessages = messages ?? [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
  if (!Array.isArray(selectedMessages) || !selectedMessages.length) throw new Error('Modal messages must be a nonempty array.');
  const streaming = stream === undefined ? config.stream : streamSetting(stream);
  const body = {
    model: config.model,
    messages: selectedMessages,
    reasoning_effort: config.reasoningEffort,
    chat_template_kwargs: { enable_thinking: true, preserve_thinking: true },
    stream: streaming,
    ...(streaming ? { stream_options: { include_usage: true } } : {}),
    temperature: samplingNumber(temperature, config.temperature, 2, 'Modal temperature'),
    top_p: samplingNumber(topP, config.topP, 1, 'Modal topP'),
    ...(tools !== undefined ? { tools } : {}),
    ...(toolChoice !== undefined ? { tool_choice: toolChoice } : {}),
    // Full readings remain uncapped. A caller can explicitly bound a short task.
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {})
  };
  const lifetime = requestLifetime(config.timeoutMs, signal);
  try {
    lifetime.check();
    console.log('[modalChatCompletions] Requesting Chat Completions API', {
      model: config.model, reasoningEffort: config.reasoningEffort,
      timeoutMs: config.timeoutMs, stream: streaming
    });
    const response = await lifetime.wait(withRetry(async (attempt) => {
      lifetime.check();
      let response;
      try {
        response = await lifetime.wait(fetch(config.url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.proxyToken}`,
            'content-type': 'application/json',
            'X-Idempotency-Key': generateIdempotencyKey(requestId, attempt)
          },
          body: JSON.stringify(body),
          signal: lifetime.signal
        }));
      } catch {
        lifetime.check();
        throw new TypeError('Modal Chat Completions network request failed.');
      }
      if (!response.ok) {
        response.body?.cancel().catch(() => {});
        throw new ModalResponseError(`Modal Chat Completions returned HTTP ${response.status}.`);
      }
      return response;
    }, 'modal-qwen', requestId, { maxRetries: 2, baseDelayMs: 1000 }));
    const completion = await readCompletion(response, lifetime);
    let result;
    try { result = completedResult(completion, policy); } catch (error) {
      throw Object.assign(error, { model: completion.model, usage: normalizeUsage(completion.usage) });
    }
    result.model = completion.model;
    console.log('[modalChatCompletions] Completion received', {
      model: config.model,
      finishReason: result.finishReason,
      promptTokens: result.usage?.input_tokens ?? null,
      completionTokens: result.usage?.output_tokens ?? null,
      reasoningTokens: result.usage?.output_tokens_details?.reasoning_tokens ?? null,
      reasoningContentPresent: result.usage?.reasoning_content_present ?? false,
      totalTokens: result.usage?.total_tokens ?? null,
      toolCallCount: result.toolCalls.length
    });
    return result;
  } finally {
    lifetime.close();
  }
}

/** Opt-in task telemetry; full readings log quality decisions in their caller. */
export async function callModalChatCompletions(env, options = {}) {
  if (!options.telemetry) return callModalChatCompletionsInternal(env, options);
  return observeInferenceAttempt(env, {
    ...options.telemetry, provider: 'modal-qwen',
    requestedModel: env?.MODAL_MODEL || MODAL_DEFAULT_MODEL, signal: options.signal
  }, () => callModalChatCompletionsInternal(env, options));
}
