// tests/azureResponses.test.mjs
// Tests for Azure OpenAI Responses API helper module
// Run with: npm test -- tests/azureResponses.test.mjs

import { test, describe, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureAzureConfig,
  getReasoningEffort
} from '../functions/lib/azureResponses.js';

describe('ensureAzureConfig', () => {
  test('returns normalized config when all required fields present', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    const config = ensureAzureConfig(env);

    assert.strictEqual(config.endpoint, 'https://myresource.openai.azure.com');
    assert.strictEqual(config.apiKey, 'test-key');
    assert.strictEqual(config.model, 'gpt-5');
    assert.strictEqual(config.apiVersion, 'v1'); // Default
  });

  test('strips trailing slashes from endpoint', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com///',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    const config = ensureAzureConfig(env);
    assert.strictEqual(config.endpoint, 'https://myresource.openai.azure.com');
  });

  test('strips /openai/v1 suffix from endpoint', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com/openai/v1',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    const config = ensureAzureConfig(env);
    assert.strictEqual(config.endpoint, 'https://myresource.openai.azure.com');
  });

  test('strips /openai/v1/ suffix with trailing slash', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com/openai/v1/',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    const config = ensureAzureConfig(env);
    assert.strictEqual(config.endpoint, 'https://myresource.openai.azure.com');
  });

  test('strips /openai suffix from endpoint', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com/openai/',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    const config = ensureAzureConfig(env);
    assert.strictEqual(config.endpoint, 'https://myresource.openai.azure.com');
  });

  test('uses AZURE_OPENAI_RESPONSES_API_VERSION when set', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_RESPONSES_API_VERSION: 'preview'
    };

    const config = ensureAzureConfig(env);
    assert.strictEqual(config.apiVersion, 'preview');
  });

  test('falls back to AZURE_OPENAI_API_VERSION', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
      AZURE_OPENAI_API_VERSION: '2024-01-01'
    };

    const config = ensureAzureConfig(env);
    assert.strictEqual(config.apiVersion, '2024-01-01');
  });

  test('throws when endpoint is missing', () => {
    const env = {
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    assert.throws(
      () => ensureAzureConfig(env),
      /Azure OpenAI configuration is missing/
    );
  });

  test('throws when API key is missing', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    assert.throws(
      () => ensureAzureConfig(env),
      /Azure OpenAI configuration is missing/
    );
  });

  test('throws when model is missing', () => {
    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://myresource.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key'
    };

    assert.throws(
      () => ensureAzureConfig(env),
      /Azure OpenAI configuration is missing/
    );
  });
});

describe('getReasoningEffort', () => {
  test('returns high for gpt-5.1 models', () => {
    assert.strictEqual(getReasoningEffort('gpt-5.1'), 'high');
    assert.strictEqual(getReasoningEffort('GPT-5.1'), 'high');
    assert.strictEqual(getReasoningEffort('gpt-5.1-preview'), 'high');
    assert.strictEqual(getReasoningEffort('my-gpt-5.1-deployment'), 'high');
  });

  test('returns high for gpt-5-pro models', () => {
    assert.strictEqual(getReasoningEffort('gpt-5-pro'), 'high');
    assert.strictEqual(getReasoningEffort('GPT-5-PRO'), 'high');
    assert.strictEqual(getReasoningEffort('gpt-5-pro-latest'), 'high');
  });

  test('returns medium for other GPT-5 models', () => {
    assert.strictEqual(getReasoningEffort('gpt-5'), 'medium');
    assert.strictEqual(getReasoningEffort('gpt-5-turbo'), 'medium');
    assert.strictEqual(getReasoningEffort('gpt-5-codex'), 'medium');
  });

  test('returns medium for null/undefined', () => {
    assert.strictEqual(getReasoningEffort(null), 'medium');
    assert.strictEqual(getReasoningEffort(undefined), 'medium');
    assert.strictEqual(getReasoningEffort(''), 'medium');
  });

  test('returns medium for other models', () => {
    assert.strictEqual(getReasoningEffort('gpt-4'), 'medium');
    assert.strictEqual(getReasoningEffort('claude-3'), 'medium');
    assert.strictEqual(getReasoningEffort('custom-model'), 'medium');
  });
});

// Note: callAzureResponses tests require mocking fetch
// These tests verify the request body construction logic
describe('callAzureResponses request body construction', () => {
  let originalFetch;
  let capturedRequest;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    capturedRequest = null;

    // Mock fetch to capture request and return a valid response
    globalThis.fetch = mock.fn(async (url, options) => {
      capturedRequest = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          output: [{
            type: 'message',
            content: [{ type: 'output_text', text: 'Test response' }]
          }],
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
        })
      };
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('omits reasoning block when reasoningEffort is null', async () => {
    const { callAzureResponses } = await import('../functions/lib/azureResponses.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    await callAzureResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      reasoningEffort: null  // Should omit reasoning block
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.reasoning, undefined, 'reasoning block should be omitted');
  });

  test('includes reasoning block when reasoningEffort is set', async () => {
    const { callAzureResponses } = await import('../functions/lib/azureResponses.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    await callAzureResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      reasoningEffort: 'high'
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.deepStrictEqual(capturedRequest.body.reasoning, { effort: 'high' });
  });

  test('omits max_output_tokens when maxTokens is null', async () => {
    const { callAzureResponses } = await import('../functions/lib/azureResponses.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    await callAzureResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      maxTokens: null  // Should omit max_output_tokens
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.max_output_tokens, undefined, 'max_output_tokens should be omitted');
  });

  test('includes max_output_tokens when maxTokens is set', async () => {
    const { callAzureResponses } = await import('../functions/lib/azureResponses.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    await callAzureResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      maxTokens: 500
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.max_output_tokens, 500);
  });

  test('returns string by default', async () => {
    const { callAzureResponses } = await import('../functions/lib/azureResponses.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    const result = await callAzureResponses(env, {
      instructions: 'System prompt',
      input: 'User input'
    });

    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result, 'Test response');
  });

  test('returns { text, usage } when returnFullResponse is true', async () => {
    const { callAzureResponses } = await import('../functions/lib/azureResponses.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_GPT5_MODEL: 'gpt-5'
    };

    const result = await callAzureResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      returnFullResponse: true
    });

    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.text, 'Test response');
    assert.deepStrictEqual(result.usage, {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150
    });
  });
});
