/**
 * Validate and normalize Azure OpenAI configuration
 *
 * Normalizes endpoint URL to prevent double-pathing issues:
 * - Strips trailing slashes
 * - Removes /openai/v1 suffix if present
 * - Removes /openai suffix if present
 *
 * @param {Object} env - Environment bindings
 * @returns {Object} Normalized config { endpoint, apiKey, model, apiVersion }
 * @throws {Error} If required configuration is missing
 */
export function ensureAzureConfig(env) {
  const rawEndpoint = env.AZURE_OPENAI_ENDPOINT || '';
  const endpoint = rawEndpoint
    .replace(/\/+$/, '')                    // Remove trailing slashes
    .replace(/\/openai\/v1\/?$/, '')        // Remove /openai/v1 suffix if present
    .replace(/\/openai\/?$/, '');           // Remove /openai suffix if present

  const apiKey = env.AZURE_OPENAI_API_KEY;
  const model = env.AZURE_OPENAI_GPT5_MODEL;

  if (!endpoint || !apiKey || !model) {
    throw new Error('Azure OpenAI configuration is missing.');
  }

  const apiVersion = env.AZURE_OPENAI_RESPONSES_API_VERSION || env.AZURE_OPENAI_API_VERSION || 'v1';

  return {
    endpoint,
    apiKey,
    model,
    apiVersion
  };
}

const VALID_REASONING_EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
const VALID_VERBOSITY_LEVELS = new Set(['low', 'medium', 'high']);

/**
 * Determine reasoning effort based on env overrides and model defaults.
 *
 * @param {Object} env - Environment bindings
 * @param {string} modelName - Azure deployment/model name
 * @returns {string} Reasoning effort level ('none'|'minimal'|'low'|'medium'|'high'|'xhigh')
 */
export function getReasoningEffort(env = null, modelName = '') {
  const rawOverride = typeof env?.AZURE_OPENAI_REASONING_EFFORT === 'string'
    ? env.AZURE_OPENAI_REASONING_EFFORT.trim().toLowerCase()
    : null;
  if (rawOverride && VALID_REASONING_EFFORTS.has(rawOverride)) {
    return rawOverride;
  }

  const normalizedModel = typeof modelName === 'string' ? modelName.toLowerCase() : '';
  if (normalizedModel.includes('gpt-5')) {
    return 'none';
  }

  return 'medium';
}

/**
 * Determine verbosity based on env overrides and model defaults.
 *
 * @param {Object} env - Environment bindings
 * @param {string} modelName - Azure deployment/model name
 * @returns {string} Verbosity level ('low'|'medium'|'high')
 */
export function getTextVerbosity(env = null, modelName = '') {
  const rawOverride = typeof env?.AZURE_OPENAI_VERBOSITY === 'string'
    ? env.AZURE_OPENAI_VERBOSITY.trim().toLowerCase()
    : null;
  if (rawOverride && VALID_VERBOSITY_LEVELS.has(rawOverride)) {
    return rawOverride;
  }

  const normalizedModel = typeof modelName === 'string' ? modelName.toLowerCase() : '';
  if (normalizedModel.includes('gpt-5')) {
    return 'low';
  }

  return 'medium';
}

/**
 * Call Azure OpenAI Responses API
 *
 * @param {Object} env - Environment bindings
 * @param {Object} options - Request options
 * @param {string} options.instructions - System instructions
 * @param {string} options.input - User input
 * @param {number|null} options.maxTokens - Max output tokens (null = no limit, default: 900)
 * @param {string|null} options.reasoningEffort - Reasoning effort level (null = omit, 'none'|'minimal'|'low'|'medium'|'high'|'xhigh')
 * @param {string|null} options.reasoningSummary - Reasoning summary mode (null = omit, 'auto'|'concise'|'detailed')
 * @param {string} options.verbosity - Text verbosity level ('low', 'medium', 'high')
 * @param {boolean} options.returnFullResponse - When true, return { text, usage } instead of just text
 * @returns {Promise<string|Object>} Response text or { text, usage } if returnFullResponse=true
 */
export async function callAzureResponses(env, {
  instructions,
  input,
  maxTokens = 900,
  reasoningEffort = null,
  reasoningSummary = null,
  verbosity = 'medium',
  returnFullResponse = false
}) {
  const { endpoint, apiKey, model, apiVersion } = ensureAzureConfig(env);
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

  // Build request body
  // NOTE: When reasoningEffort is null, we intentionally omit the `reasoning` block.
  // When `reasoning` is enabled with a token limit, the model can consume the entire
  // `max_output_tokens` budget on reasoning tokens only, returning only a `reasoning`
  // block with `status: "incomplete"` and no `output_text` / message content.
  // For short outputs (follow-ups, questions), omit reasoning. For full readings
  // (no token limit), reasoning is beneficial.
  const body = {
    model,
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

  // Debug logging for request metadata (no secrets)
  console.log('[azureResponses] Requesting Responses API', {
    url,
    model,
    apiVersion,
    maxTokens: maxTokens ?? 'unlimited',
    reasoningEffort: reasoningEffort ?? 'omitted',
    reasoningSummary: reasoningSummary ?? 'omitted',
    verbosity,
    returnFullResponse
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
    console.warn('[azureResponses] Non-OK HTTP status from Azure Responses API', {
      status: response.status,
      statusText: response.statusText,
      bodyPreview: errText.slice(0, 500)
    });
    throw new Error(`Azure Responses API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Snapshot of the raw payload shape for debugging
  try {
    console.log('[azureResponses] Raw Azure Responses payload snapshot', {
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
    console.warn('[azureResponses] Failed to log Azure payload snapshot', logError);
  }

  // Extract text content from response
  let text = null;

  if (data.output && Array.isArray(data.output)) {
    for (const block of data.output) {
      if (block.type === 'message') {
        const messagePieces = Array.isArray(block.content) ? block.content : [];
        for (const piece of messagePieces) {
          if (piece.type === 'output_text' && piece.text) {
            text = piece.text.trim();
            break;
          }
        }
        if (text) break;
      }
    }
  }

  // Fallback: try output_text property (some models use this)
  if (!text && typeof data.output_text === 'string' && data.output_text.trim()) {
    text = data.output_text.trim();
  }

  if (!text) {
    const serialized = JSON.stringify(data, null, 2);
    console.warn('[azureResponses] No output_text returned. Raw payload:', serialized?.slice(0, 2000));
    throw new Error('Azure Responses API returned no text content.');
  }

  // Return full response object or just text based on flag
  if (returnFullResponse) {
    return {
      text,
      usage: data.usage || null
    };
  }

  return text;
}
