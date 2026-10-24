import { fetchWithRetry } from './retryWithBackoff.js';
import { createDeadline } from './requestDeadline.js';
import { observeInferenceAttempt } from './inferenceAttempts.js';

export const OPENAI_DEFAULT_MODEL = 'gpt-5.6-sol';

/**
 * Validate and normalize native OpenAI Responses API configuration.
 *
 * @param {Object} env - Environment bindings
 * @returns {Object} Normalized config { endpoint, apiKey, model, url, authHeaders, provider }
 * @throws {Error} If OPENAI_API_KEY is missing
 */
export function ensureOpenAIConfig(env) {
  const apiKey = typeof env?.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
  if (!apiKey) {
    throw new Error('OpenAI Responses API configuration is missing. Set OPENAI_API_KEY.');
  }

  const rawBase = (env.OPENAI_BASE_URL || 'https://api.openai.com').trim();
  const endpoint = rawBase
    .replace(/\/+$/, '')
    .replace(/\/v1\/?$/, '');
  const model = env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;

  return {
    endpoint,
    apiKey,
    model,
    url: `${endpoint}/v1/responses`,
    authHeaders: { Authorization: `Bearer ${apiKey}` },
    provider: 'openai-native'
  };
}

const VALID_REASONING_EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
const VALID_VERBOSITY_LEVELS = new Set(['low', 'medium', 'high']);

function normalizeResponsesUser(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve the end-user identifier for OpenAI Responses API requests.
 *
 * Priority order:
 * 1) Explicit per-request value
 * 2) Environment fallback: OPENAI_RESPONSES_USER
 *
 * @param {Object|null} env - Environment bindings
 * @param {string|null} explicitUser - Optional per-request user identifier
 * @returns {string|null} Normalized user identifier or null when unavailable
 */
export function resolveResponsesUser(env = null, explicitUser = null) {
  return normalizeResponsesUser(explicitUser) || normalizeResponsesUser(env?.OPENAI_RESPONSES_USER);
}

/**
 * Determine reasoning effort based on env overrides and model defaults.
 *
 * @param {Object} env - Environment bindings
 * @param {string} modelName - OpenAI model name
 * @returns {string} Reasoning effort level ('none'|'minimal'|'low'|'medium'|'high'|'xhigh')
 */
export function getReasoningEffort(env = null, modelName = '') {
  const override = typeof env?.OPENAI_REASONING_EFFORT === 'string'
    ? env.OPENAI_REASONING_EFFORT.trim().toLowerCase()
    : null;
  if (override && VALID_REASONING_EFFORTS.has(override)) {
    return override;
  }

  const normalizedModel = typeof modelName === 'string' ? modelName.toLowerCase() : '';
  if (normalizedModel.includes('gpt-5')) {
    return 'high';
  }

  return 'medium';
}

/**
 * Determine verbosity based on env overrides and model defaults.
 *
 * @param {Object} env - Environment bindings
 * @param {string} modelName - OpenAI model name
 * @returns {string} Verbosity level ('low'|'medium'|'high')
 */
export function getTextVerbosity(env = null, modelName = '') {
  const override = typeof env?.OPENAI_VERBOSITY === 'string'
    ? env.OPENAI_VERBOSITY.trim().toLowerCase()
    : null;
  if (override && VALID_VERBOSITY_LEVELS.has(override)) {
    return override;
  }

  const normalizedModel = typeof modelName === 'string' ? modelName.toLowerCase() : '';
  if (normalizedModel.includes('gpt-5')) {
    return 'low';
  }

  return 'medium';
}

/** Extract the complete ordered answer; keep reasoning and shape diagnostics separate. */
export function extractOpenAIResponseContent(data) {
  const messages = [];
  const summaries = [];
  const responseShape = {
    assistantMessageCount: 0,
    outputTextPieceCount: 0,
    aggregateFallbackUsed: false
  };
  for (const block of Array.isArray(data?.output) ? data.output : []) {
    if (block?.type === 'message' && (block.role == null || block.role === 'assistant')) {
      responseShape.assistantMessageCount += 1;
      const pieces = (Array.isArray(block.content) ? block.content : [])
        .filter(piece => piece?.type === 'output_text' && typeof piece.text === 'string');
      responseShape.outputTextPieceCount += pieces.length;
      const message = pieces.map(piece => piece.text).join('');
      if (message.trim()) messages.push(message);
    } else if (block?.type === 'reasoning') {
      for (const summary of Array.isArray(block.summary) ? block.summary : []) {
        if (summary?.type === 'summary_text' && typeof summary.text === 'string' && summary.text.trim()) {
          summaries.push(summary.text);
        }
      }
    }
  }
  let text = messages.join('\n\n').trim() || null;
  if (!text && typeof data?.output_text === 'string' && data.output_text.trim()) {
    text = data.output_text.trim();
    responseShape.aggregateFallbackUsed = true;
  }
  return { text, reasoningSummary: summaries.join('\n').trim() || null, responseShape };
}

/**
 * Call OpenAI Responses API
 *
 * @param {Object} env - Environment bindings
 * @param {Object} options - Request options
 * @param {string} options.instructions - System instructions
 * @param {string} options.input - User input
 * @param {number|null} options.maxTokens - Max output tokens (null = no limit, default: 900)
 * @param {string|null} options.reasoningEffort - Reasoning effort level (null = omit, 'none'|'minimal'|'low'|'medium'|'high'|'xhigh')
 * @param {string|null} options.reasoningSummary - Reasoning summary mode (null = omit, 'auto'|'concise'|'detailed')
 * @param {string} options.verbosity - Text verbosity level ('low', 'medium', 'high')
 * @param {string|null} options.user - Optional end-user identifier for abuse monitoring
 * @param {boolean} options.returnFullResponse - When true, return { text, usage } instead of just text
 * @returns {Promise<string|Object>} Response text or { text, usage } if returnFullResponse=true
 */
export async function callOpenAIResponses(env, options) {
  if (!options.telemetry) return callOpenAIResponsesImpl(env, options);
  const config = ensureOpenAIConfig(env);
  const result = await observeInferenceAttempt(env, {
    ...options.telemetry, signal: options.signal,
    provider: config.provider, requestedModel: config.model
  }, () => callOpenAIResponsesImpl(env, { ...options, returnFullResponse: true }));
  return options.returnFullResponse ? result : result.text;
}

async function callOpenAIResponsesImpl(env, {
  instructions,
  input,
  maxTokens = 900,
  reasoningEffort = null,
  reasoningSummary = null,
  verbosity = 'medium',
  user = null,
  returnFullResponse = false,
  requestId = 'unknown',
  signal,
  timeoutMs = 120000
}) {
  const { model, url, authHeaders, provider } = ensureOpenAIConfig(env);
  const resolvedUser = resolveResponsesUser(env, user);

  // Build request body
  // NOTE: When reasoningEffort is null, we intentionally omit the `reasoning` block.
  // When `reasoning` is enabled with a token limit, the model can consume the entire
  // `max_output_tokens` budget on reasoning tokens only, returning only a `reasoning`
  // block with `status: "incomplete"` and no `output_text` / message content.
  // Callers budget for both reasoning and the requested final answer.
  const body = {
    model,
    store: false,
    instructions,
    input,
    text: { verbosity }
  };

  // Only include max_output_tokens if maxTokens is not null
  if (maxTokens !== null) {
    body.max_output_tokens = maxTokens;
  }

  // Only include reasoning block if effort or summary is specified
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

  // Debug logging for request metadata (no secrets)
  console.log('[openaiResponses] Requesting Responses API', {
    url,
    provider,
    model,
    maxTokens: maxTokens ?? 'unlimited',
    reasoningEffort: reasoningEffort ?? 'omitted',
    reasoningSummary: reasoningSummary ?? 'omitted',
    verbosity,
    userProvided: Boolean(resolvedUser),
    returnFullResponse
  });

  // Use retry logic with exponential backoff
  const deadline = createDeadline({ signal, timeoutMs });
  let data;
  try {
    data = await deadline.run(() => fetchWithRetry(
      url,
      {
        method: 'POST',
        signal: deadline.signal,
        headers: {
          ...authHeaders,
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      'openai-native',
      requestId,
      {
        maxRetries: 3,
        baseDelayMs: 1000,
        timeoutMs,
        includeResponseBodyInError: false,
        consumeResponse: (response) => response.json()
      }
    ));
  } finally {
    deadline.dispose();
  }
  if (data.status && data.status !== 'completed') {
    const error = new Error(`Responses API returned ${data.status}; a complete answer is required.`);
    error.code = 'response_incomplete';
    error.model = data.model || null;
    error.usage = data.usage || null;
    throw error;
  }
  if (data.error || data.incomplete_details || (Array.isArray(data.output) && data.output.some((item) => item?.status === 'incomplete' || item?.status === 'failed'))) {
    const error = new Error('Responses API returned an incomplete or failed answer.');
    error.code = 'response_incomplete';
    error.model = data.model || null;
    error.usage = data.usage || null;
    throw error;
  }

  // Snapshot of the raw payload shape for debugging
  try {
    console.log('[openaiResponses] Raw OpenAI Responses payload snapshot', {
      id: data.id,
      model: data.model,
      created: data.created,
      outputTypes: Array.isArray(data.output) ? data.output.map(block => block?.type) : typeof data.output,
      hasMessageBlocks: Array.isArray(data.output)
        ? data.output.some(block => block?.type === 'message')
        : false,
      hasOutputTextField: typeof data.output_text === 'string' && data.output_text.trim().length > 0
    });
  } catch (logError) {
    console.warn('[openaiResponses] Failed to log OpenAI payload snapshot', logError);
  }

  const { text, reasoningSummary: reasoningSummaryText, responseShape } = extractOpenAIResponseContent(data);

  if (!text) {
    throw new Error('OpenAI Responses API returned no text content.');
  }

  if (reasoningSummaryText) {
    console.log('[openaiResponses] Reasoning summary extracted:', reasoningSummaryText.length, 'chars');
  }

  // Return full response object or just text based on flag
  if (returnFullResponse) {
    return {
      text,
      reasoningSummary: reasoningSummaryText,
      responseShape,
      model: data.model || null,
      usage: data.usage || null
    };
  }

  return text;
}
