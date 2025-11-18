export function ensureAzureConfig(env) {
  const endpoint = (env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
  const apiKey = env.AZURE_OPENAI_API_KEY;
  const model = env.AZURE_OPENAI_GPT5_MODEL;

  if (!endpoint || !apiKey || !model) {
    throw new Error('Azure OpenAI configuration is missing.');
  }

  return {
    endpoint,
    apiKey,
    model,
    apiVersion: env.AZURE_OPENAI_API_VERSION || 'preview'
  };
}

export async function callAzureResponses(env, { instructions, input, maxTokens = 900, reasoningEffort = 'medium', verbosity = 'medium' }) {
  const { endpoint, apiKey, model, apiVersion } = ensureAzureConfig(env);
  const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;

  const body = {
    model,
    instructions,
    input,
    max_output_tokens: maxTokens,
    reasoning: { effort: reasoningEffort },
    text: { verbosity }
  };

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
    throw new Error(`Azure Responses API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

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

  throw new Error('Azure Responses API returned no text content.');
}
