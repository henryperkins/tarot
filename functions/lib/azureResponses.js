export function ensureAzureConfig(env) {
  const endpoint = (env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
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

export async function callAzureResponses(env, { instructions, input, maxTokens = 900, reasoningEffort = 'medium', verbosity = 'medium' }) {
  const { endpoint, apiKey, model, apiVersion } = ensureAzureConfig(env);
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

  // NOTE:
  // We intentionally DO NOT set the `reasoning` field here.
  // When `reasoning` is enabled, the model can consume the entire
  // `max_output_tokens` budget on reasoning tokens only, returning
  // only a `reasoning` block with `status: "incomplete"` and no
  // `output_text` / message content (as seen in the logs).
  //
  // For this endpoint we just want the final question text, so we
  // rely on the default behavior and request only text output.
  const body = {
    model,
    instructions,
    input,
    max_output_tokens: maxTokens,
    text: { verbosity }
  };

  // Debug logging for request metadata (no secrets)
  console.log('[azureResponses] Requesting Responses API', {
    url,
    model,
    apiVersion,
    maxTokens,
    reasoningEffort,
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

  if (data.output && Array.isArray(data.output)) {
    for (const block of data.output) {
      if (block.type === 'message') {
        const messagePieces = Array.isArray(block.content) ? block.content : [];
        for (const piece of messagePieces) {
          if (piece.type === 'output_text' && piece.text) {
            return piece.text.trim();
          }
        }
      }
    }
  }

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const serialized = JSON.stringify(data, null, 2);
  console.warn('[azureResponses] No output_text returned. Raw payload:', serialized?.slice(0, 2000));
  throw new Error('Azure Responses API returned no text content.');
}
