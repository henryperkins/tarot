#!/usr/bin/env node
/**
 * Test Azure OpenAI Responses API integration
 * Run: AZURE_OPENAI_ENDPOINT=xxx AZURE_OPENAI_API_KEY=xxx AZURE_OPENAI_GPT5_MODEL=xxx node scripts/test-azure-responses.mjs
 */

const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, '');
const apiKey = process.env.AZURE_OPENAI_API_KEY;
const model = process.env.AZURE_OPENAI_GPT5_MODEL;
const apiVersion = process.env.AZURE_OPENAI_RESPONSES_API_VERSION || process.env.AZURE_OPENAI_API_VERSION || 'v1';

console.log('🔍 Testing Azure OpenAI Responses API\n');
console.log('Configuration:');
console.log('- Endpoint:', endpoint ? '✓ Set' : '✗ Missing');
console.log('- API Key:', apiKey ? '✓ Set' : '✗ Missing');
console.log('- Model:', model || '✗ Missing');
console.log('- API Version:', apiVersion);

if (!endpoint || !apiKey || !model) {
  console.error('\n❌ Missing required environment variables');
  console.error('Required: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_GPT5_MODEL');
  process.exit(1);
}

const url = `${endpoint}/openai/v1/responses?api-version=${encodeURIComponent(apiVersion)}`;
console.log('\nRequest URL:', url);

const body = {
  model,
  instructions: 'You are a tarot intention coach. Write ONE open, agency-forward question.',
  input: 'Focus: my career\nTimeframe: this week\nDepth: Focused guidance',
  max_output_tokens: 120,
  reasoning: { effort: 'low' },
  text: { verbosity: 'low' }
};

console.log('\nRequest body:', JSON.stringify(body, null, 2));
console.log('\n📡 Sending request...\n');

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  console.log('Response status:', response.status, response.statusText);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  const responseText = await response.text();

  if (!response.ok) {
    console.error('\n❌ Request failed');
    console.error('Status:', response.status);
    console.error('Response:', responseText);
    process.exit(1);
  }

  const data = JSON.parse(responseText);
  console.log('\n✅ Success! Response data:');
  console.log(JSON.stringify(data, null, 2));

  // Try to extract the question
  let question = null;
  if (data.output && Array.isArray(data.output)) {
    for (const block of data.output) {
      if (block.type === 'message') {
        const messagePieces = Array.isArray(block.content) ? block.content : [];
        for (const piece of messagePieces) {
          if (piece.type === 'output_text' && piece.text) {
            question = piece.text.trim();
            break;
          }
        }
      }
      if (question) break;
    }
  }

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    question = data.output_text.trim();
  }

  if (question) {
    console.log('\n📝 Generated question:', question);
  } else {
    console.warn('\n⚠️  Could not extract question from response');
  }

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
