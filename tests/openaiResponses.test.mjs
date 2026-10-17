// tests/openaiResponses.test.mjs
// Tests for native OpenAI Responses API helper module
// Run with: npm test -- tests/openaiResponses.test.mjs

import { test, describe, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureOpenAIConfig,
  getReasoningEffort,
  getTextVerbosity,
  resolveResponsesUser
} from '../functions/lib/openaiResponses.js';

describe('ensureOpenAIConfig', () => {
  test('defaults to native OpenAI with bearer authentication', () => {
    const config = ensureOpenAIConfig({ OPENAI_API_KEY: 'test-key' });
    assert.deepEqual(config, {
      endpoint: 'https://api.openai.com',
      apiKey: 'test-key',
      model: 'gpt-5.6-sol',
      url: 'https://api.openai.com/v1/responses',
      authHeaders: { Authorization: 'Bearer test-key' },
      provider: 'openai-native'
    });
  });

  for (const baseUrl of ['https://example.test', 'https://example.test///', 'https://example.test/v1', 'https://example.test/v1/']) {
    test(`normalizes native base URL ${baseUrl}`, () => {
      const config = ensureOpenAIConfig({ OPENAI_API_KEY: 'test-key', OPENAI_BASE_URL: baseUrl, OPENAI_MODEL: 'custom-model' });
      assert.equal(config.url, 'https://example.test/v1/responses');
      assert.equal(config.model, 'custom-model');
    });
  }

  test('rejects missing and blank native credentials', () => {
    for (const env of [undefined, {}, { OPENAI_API_KEY: '' }, { OPENAI_API_KEY: '   ' }]) {
      assert.throws(() => ensureOpenAIConfig(env), /Set OPENAI_API_KEY/);
    }
  });

  test('Azure-only credentials cannot configure native inference', () => {
    assert.throws(() => ensureOpenAIConfig({
      AZURE_OPENAI_ENDPOINT: 'https://retired.example',
      AZURE_OPENAI_API_KEY: 'retired-key',
      AZURE_OPENAI_GPT5_MODEL: 'retired-model'
    }), /Set OPENAI_API_KEY/);
  });

  test('ignores retired Azure endpoint, deployment and API version settings', () => {
    const config = ensureOpenAIConfig({
      OPENAI_API_KEY: 'native-key',
      AZURE_OPENAI_ENDPOINT: 'https://retired.example',
      AZURE_OPENAI_API_KEY: 'retired-key',
      AZURE_OPENAI_GPT5_MODEL: 'retired-model',
      AZURE_OPENAI_RESPONSES_API_VERSION: 'retired-version'
    });
    assert.equal(config.model, 'gpt-5.6-sol');
    assert.equal(config.url, 'https://api.openai.com/v1/responses');
    assert.deepEqual(config.authHeaders, { Authorization: 'Bearer native-key' });
  });
});

describe('getReasoningEffort', () => {
  test('returns high for GPT-5 variants', () => {
    assert.strictEqual(getReasoningEffort(null, 'gpt-5.1'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'GPT-5.1'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'gpt-5.1-preview'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'my-gpt-5.1-deployment'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'gpt-5-pro'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'GPT-5-PRO'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'gpt-5-pro-latest'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'gpt-5'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'gpt-5-turbo'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'gpt-5-codex'), 'high');
    assert.strictEqual(getReasoningEffort(null, 'gpt-5.2'), 'high');
  });

  test('returns medium for null/undefined model', () => {
    assert.strictEqual(getReasoningEffort(null, null), 'medium');
    assert.strictEqual(getReasoningEffort(null, undefined), 'medium');
    assert.strictEqual(getReasoningEffort(null, ''), 'medium');
  });

  test('returns medium for other models', () => {
    assert.strictEqual(getReasoningEffort(null, 'gpt-4'), 'medium');
    assert.strictEqual(getReasoningEffort(null, 'claude-3'), 'medium');
    assert.strictEqual(getReasoningEffort(null, 'custom-model'), 'medium');
  });

  test('returns high for gpt-5.6-sol (the native default model)', () => {
    assert.strictEqual(getReasoningEffort(null, 'gpt-5.6-sol'), 'high');
  });

  test('respects env override', () => {
    const env = { OPENAI_REASONING_EFFORT: 'low' };
    assert.strictEqual(getReasoningEffort(env, 'gpt-5.2'), 'low');
  });

  test('prefers OPENAI_REASONING_EFFORT on the native path', () => {
    const env = {
      OPENAI_API_KEY: 'sk-test',
      OPENAI_REASONING_EFFORT: 'high',
      AZURE_OPENAI_REASONING_EFFORT: 'xhigh'
    };
    assert.strictEqual(getReasoningEffort(env, 'gpt-5.6-sol'), 'high');
  });

  test('uses the native reasoning override without a credential dependency', () => {
    const env = {
      OPENAI_REASONING_EFFORT: 'high',
      AZURE_OPENAI_REASONING_EFFORT: 'xhigh'
    };
    assert.strictEqual(getReasoningEffort(env, 'gpt-5'), 'high');
  });

  test('ignores retired Azure reasoning defaults', () => {
    const env = {
      OPENAI_API_KEY: 'sk-test',
      AZURE_OPENAI_REASONING_EFFORT: 'medium'
    };
    assert.strictEqual(getReasoningEffort(env, 'gpt-5.6-sol'), 'high');
  });

  test('ignores an invalid native override and falls through to the model default', () => {
    const env = { OPENAI_API_KEY: 'sk-test', OPENAI_REASONING_EFFORT: 'bogus' };
    assert.strictEqual(getReasoningEffort(env, 'gpt-5.6-sol'), 'high');
  });
});

describe('getTextVerbosity', () => {
  test('defaults to low for GPT-5 variants', () => {
    assert.strictEqual(getTextVerbosity(null, 'gpt-5.6-sol'), 'low');
  });

  test('prefers OPENAI_VERBOSITY on the native path', () => {
    const env = {
      OPENAI_API_KEY: 'sk-test',
      OPENAI_VERBOSITY: 'high',
      AZURE_OPENAI_VERBOSITY: 'medium'
    };
    assert.strictEqual(getTextVerbosity(env, 'gpt-5.6-sol'), 'high');
  });

  test('uses the native verbosity override without a credential dependency', () => {
    const env = { OPENAI_VERBOSITY: 'high', AZURE_OPENAI_VERBOSITY: 'medium' };
    assert.strictEqual(getTextVerbosity(env, 'gpt-5.6-sol'), 'high');
  });

  test('ignores retired Azure verbosity defaults', () => {
    assert.equal(getTextVerbosity({ AZURE_OPENAI_VERBOSITY: 'high' }, 'gpt-5.6-sol'), 'low');
  });
});

describe('resolveResponsesUser', () => {
  test('uses explicit user when provided', () => {
    const env = { OPENAI_RESPONSES_USER: 'env-user' };
    assert.strictEqual(resolveResponsesUser(env, 'request-user'), 'request-user');
  });

  test('falls back to env user when explicit user is missing', () => {
    const env = { OPENAI_RESPONSES_USER: 'env-user' };
    assert.strictEqual(resolveResponsesUser(env, null), 'env-user');
  });

  test('returns null when both explicit and env values are blank', () => {
    const env = { OPENAI_RESPONSES_USER: '   ' };
    assert.strictEqual(resolveResponsesUser(env, '  '), null);
  });

  test('ignores the retired Azure user setting', () => {
    assert.equal(resolveResponsesUser({ AZURE_OPENAI_RESPONSES_USER: 'retired-reader' }), null);
  });
});

// Note: callOpenAIResponses tests require mocking fetch
// These tests verify the request body construction logic
describe('callOpenAIResponses request body construction', () => {
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

  test('rejects Azure-only credentials before making any inference request', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');
    await assert.rejects(callOpenAIResponses({
      AZURE_OPENAI_ENDPOINT: 'https://retired.example',
      AZURE_OPENAI_API_KEY: 'retired-key',
      AZURE_OPENAI_GPT5_MODEL: 'retired-model'
    }, { instructions: 'System prompt', input: 'User input' }), /Set OPENAI_API_KEY/);
    assert.equal(capturedRequest, null);
  });

  test('omits reasoning block when reasoningEffort is null', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      reasoningEffort: null  // Should omit reasoning block
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.reasoning, undefined, 'reasoning block should be omitted');
  });

  test('uses bearer auth and native responses URL when OPENAI_API_KEY is set', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_API_KEY: 'openai-test-key',
      OPENAI_BASE_URL: 'https://api.openai.com/v1/',
      OPENAI_MODEL: 'gpt-5.4'
    };

    await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      reasoningEffort: null
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.url, 'https://api.openai.com/v1/responses');
    assert.strictEqual(capturedRequest.options.headers.Authorization, 'Bearer openai-test-key');
    assert.strictEqual(capturedRequest.options.headers['api-key'], undefined);
    assert.strictEqual(capturedRequest.body.model, 'gpt-5.4');
  });

  test('includes reasoning block when reasoningEffort is set', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      reasoningEffort: 'high'
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.deepStrictEqual(capturedRequest.body.reasoning, { effort: 'high' });
  });

  test('omits max_output_tokens when maxTokens is null', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      maxTokens: null  // Should omit max_output_tokens
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.max_output_tokens, undefined, 'max_output_tokens should be omitted');
  });

  test('includes max_output_tokens when maxTokens is set', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      maxTokens: 500
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.max_output_tokens, 500);
  });

  test('includes user when explicitly provided', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      user: 'reader-123'
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.user, 'reader-123');
  });

  test('includes env fallback user when explicit user is not provided', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5',
      OPENAI_RESPONSES_USER: 'env-reader'
    };

    await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input'
    });

    assert.ok(capturedRequest, 'Fetch should have been called');
    assert.strictEqual(capturedRequest.body.user, 'env-reader');
  });

  test('returns string by default', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    const result = await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input'
    });

    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result, 'Test response');
  });

  test('returns { text, usage } when returnFullResponse is true', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    const result = await callOpenAIResponses(env, {
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

  test('includes reasoningSummary when provided in output blocks', async () => {
    const { callOpenAIResponses } = await import('../functions/lib/openaiResponses.js');

    const env = {
      OPENAI_BASE_URL: 'https://example.test',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'gpt-5'
    };

    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      json: async () => ({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Test response' }]
          },
          {
            type: 'reasoning',
            summary: [{ type: 'summary_text', text: 'Reasoning summary' }]
          }
        ],
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 }
      })
    }));

    const result = await callOpenAIResponses(env, {
      instructions: 'System prompt',
      input: 'User input',
      returnFullResponse: true
    });

    assert.strictEqual(result.text, 'Test response');
    assert.strictEqual(result.reasoningSummary, 'Reasoning summary');
  });
});
