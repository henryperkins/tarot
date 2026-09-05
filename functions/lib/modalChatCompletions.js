import { fetchWithRetry } from './retryWithBackoff.js';

export const MODAL_DEFAULT_MODEL = 'Qwen/Qwen3.8-2.4T-A95B';
export const MODAL_DEFAULT_REASONING_EFFORT = 'medium';

const MODAL_DEFAULT_TIMEOUT_MS = 300000;
const MODAL_MAX_TIMEOUT_MS = 600000;
const MODAL_REASONING_EFFORTS = new Set(['low', 'medium', 'xhigh']);

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
    .replace(/\/v1$/, '');
  parsed.pathname = `${normalizedPath}/v1/chat/completions`;

  return parsed.toString();
}

function resolveReasoningEffort(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return MODAL_REASONING_EFFORTS.has(normalized)
    ? normalized
    : MODAL_DEFAULT_REASONING_EFFORT;
}

export function ensureModalConfig(env) {
  const proxyToken = typeof env?.MODAL_PROXY_TOKEN === 'string'
    ? env.MODAL_PROXY_TOKEN.trim()
    : '';
  if (!proxyToken) {
    throw new Error('Modal configuration is missing MODAL_PROXY_TOKEN.');
  }

  const model = typeof env?.MODAL_MODEL === 'string' && env.MODAL_MODEL.trim()
    ? env.MODAL_MODEL.trim()
    : MODAL_DEFAULT_MODEL;

  return {
    url: normalizeEndpointUrl(env?.MODAL_ENDPOINT_URL),
    proxyToken,
    model,
    reasoningEffort: resolveReasoningEffort(env?.MODAL_REASONING_EFFORT),
    timeoutMs: parseBoundedInteger(
      env?.MODAL_TIMEOUT_MS,
      MODAL_DEFAULT_TIMEOUT_MS,
      1000,
      MODAL_MAX_TIMEOUT_MS
    )
  };
}

/**
 * Call an authenticated Modal OpenAI-compatible Chat Completions endpoint.
 * The model's private reasoning content is intentionally not returned.
 */
export async function callModalChatCompletions(env, {
  systemPrompt,
  userPrompt,
  requestId = 'unknown'
}) {
  const {
    url,
    proxyToken,
    model,
    reasoningEffort,
    timeoutMs
  } = ensureModalConfig(env);

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    reasoning_effort: reasoningEffort,
    // Qwen3.8 is thinking-only. Make the supported template behavior explicit;
    // leave the output budget to the serving model instead of clipping thought
    // and answer tokens together at an application-defined limit.
    chat_template_kwargs: { enable_thinking: true, preserve_thinking: true },
    stream: false
  };

  console.log('[modalChatCompletions] Requesting Chat Completions API', {
    url,
    model,
    reasoningEffort,
    timeoutMs
  });

  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${proxyToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    },
    'modal-qwen',
    requestId,
    {
      maxRetries: 2,
      baseDelayMs: 1000,
      timeoutMs,
      includeResponseBodyInError: false
    }
  );

  const data = await response.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === 'string' ? content.trim() : '';

  if (!text) {
    throw new Error('Modal Chat Completions returned no text content.');
  }

  // Nonempty text can still be truncated, filtered, or awaiting a tool call.
  // Only a normal stop confirms this buffered response is ready for the reader.
  if (choice?.finish_reason !== 'stop') {
    throw new Error('Modal Chat Completions returned an incomplete response.');
  }

  const usage = normalizeUsage(data?.usage);
  const reasoningContentPresent = ['reasoning_content', 'reasoning'].some((field) =>
    typeof choice?.message?.[field] === 'string' && choice.message[field].trim().length > 0
  );
  if (usage) usage.reasoning_content_present = reasoningContentPresent;

  console.log('[modalChatCompletions] Completion received', {
    id: data?.id || null,
    model: data?.model || model,
    finishReason: choice.finish_reason,
    promptTokens: data?.usage?.prompt_tokens ?? null,
    completionTokens: data?.usage?.completion_tokens ?? null,
    reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? null,
    reasoningContentPresent,
    totalTokens: data?.usage?.total_tokens ?? null
  });

  return {
    text,
    usage
  };
}
