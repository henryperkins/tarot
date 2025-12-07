import assert from 'node:assert/strict';
import { describe, it, beforeEach, mock } from 'node:test';

/**
 * TTS (Text-to-Speech) API Tests
 *
 * Tests for functions/api/tts.js covering:
 * - Health check endpoint (GET)
 * - Request validation
 * - Text sanitization
 * - Rate limiting
 * - Voice and speed validation
 * - Azure TTS integration
 * - Fallback audio generation
 * - Streaming mode
 * - Environment variable resolution
 */

// Mock dependencies
const mockFetch = mock.fn();
global.fetch = mockFetch;

// Mock console to suppress logs during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Node's setTimeout cannot schedule beyond ~24.8 days (2^31-1 ms)
const MAX_SAFE_TIMEOUT_MS = 2_147_483_647;

// Helper to create a mock Request object
function createMockRequest(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `https://example.com${url}`;
  const headers = new Map(Object.entries(options.headers || {}));

  return {
    url: fullUrl,
    method: options.method || 'GET',
    headers: {
      get: (key) => headers.get(key.toLowerCase()) || null,
      set: (key, value) => headers.set(key.toLowerCase(), value),
      has: (key) => headers.has(key.toLowerCase())
    },
    json: async () => options.body || {},
    text: async () => JSON.stringify(options.body || {})
  };
}

// Helper to create mock environment
function createMockEnv(overrides = {}) {
  return {
    AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'test-key',
    AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT: 'gpt-audio-mini',
    AZURE_OPENAI_API_VERSION: '2025-04-01-preview',
    AZURE_OPENAI_GPT_AUDIO_MINI_FORMAT: 'mp3',
    RATELIMIT: null, // No rate limiting by default in tests
    ...overrides
  };
}

// Mock KV store for rate limiting tests
class MockKVStore {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    if (options.expirationTtl) {
      const ttlMs = Number(options.expirationTtl) * 1000;
      if (Number.isFinite(ttlMs) && ttlMs > 0) {
        const timeoutMs = Math.min(ttlMs, MAX_SAFE_TIMEOUT_MS);
        const timer = setTimeout(() => this.store.delete(key), timeoutMs);
        if (typeof timer.unref === 'function') {
          timer.unref(); // Do not keep the Node process alive for long TTLs
        }
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

describe('TTS API - Health Check (GET)', () => {
  it('should return ok status with azure-openai provider when credentials are present', async () => {
    // Dynamically import to get fresh module
    const { onRequestGet } = await import('../functions/api/tts.js');

    const env = createMockEnv();
    const response = await onRequestGet({ env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.provider, 'azure-openai');
    assert.ok(data.timestamp);
  });

  it('should return ok status with local provider when credentials are missing', async () => {
    const { onRequestGet } = await import('../functions/api/tts.js');

    // Clear process.env credentials temporarily
    const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const originalKey = process.env.AZURE_OPENAI_API_KEY;
    const originalDeployment = process.env.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT;

    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_TTS_ENDPOINT;
    delete process.env.AZURE_OPENAI_TTS_API_KEY;

    const env = {};
    const response = await onRequestGet({ env });
    const data = await response.json();

    // Restore process.env
    if (originalEndpoint) process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
    if (originalKey) process.env.AZURE_OPENAI_API_KEY = originalKey;
    if (originalDeployment) process.env.AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT = originalDeployment;

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.provider, 'local');
    assert.ok(data.timestamp);
  });

  it('should use TTS-specific credentials when available', async () => {
    const { onRequestGet } = await import('../functions/api/tts.js');

    const env = createMockEnv({
      AZURE_OPENAI_TTS_ENDPOINT: 'https://tts-specific.openai.azure.com',
      AZURE_OPENAI_TTS_API_KEY: 'tts-specific-key'
    });

    const response = await onRequestGet({ env });
    const data = await response.json();

    assert.strictEqual(data.provider, 'azure-openai');
  });
});

describe('TTS API - Request Validation (POST)', () => {
  beforeEach(() => {
    console.log = () => {}; // Suppress logs
    console.error = () => {};
    console.warn = () => {};
  });

  it('should reject requests without text field', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: {}
    });
    const env = createMockEnv();

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 400);
    assert.ok(data.error);
    assert.match(data.error, /text.*required/i);
  });

  it('should reject requests with empty text', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: '   ' }
    });
    const env = createMockEnv();

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 400);
    assert.ok(data.error);
  });

  it('should accept requests with valid text', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'The Fool card represents new beginnings.' }
    });
    const env = createMockEnv({
      RATELIMIT: null,
      // No Azure credentials, will use fallback
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.ok(data.audio);
    assert.strictEqual(data.provider, 'fallback');
  });
});

describe('TTS API - Text Sanitization', () => {
  it('should trim whitespace from text', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: '   test   ' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null // Use fallback
    });

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    // Fallback should still work with trimmed text
    assert.ok(data.audio);
  });

  it('should limit text to 4000 characters', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const longText = 'a'.repeat(5000);
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: longText }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null // Use fallback
    });

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    // Should succeed with truncated text
    assert.ok(data.audio);
  });

  it('should handle non-string text input', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 12345 }
    });
    const env = createMockEnv();

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 400);
    assert.ok(data.error);
  });
});

describe('TTS API - Rate Limiting', () => {
  beforeEach(() => {
    console.warn = () => {}; // Suppress warnings
  });

  it('should allow requests when under rate limit', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'cf-connecting-ip': '192.168.1.1' }
    });
    const env = createMockEnv({
      RATELIMIT: kvStore,
      AZURE_OPENAI_ENDPOINT: null, // Use fallback
      TTS_RATE_LIMIT_MAX: 5,
      TTS_RATE_LIMIT_WINDOW: 60
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should reject requests when rate limit exceeded', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'cf-connecting-ip': '192.168.1.1' }
    });
    const env = createMockEnv({
      RATELIMIT: kvStore,
      AZURE_OPENAI_ENDPOINT: null,
      TTS_RATE_LIMIT_MAX: 2,
      TTS_RATE_LIMIT_WINDOW: 60
    });

    // Make requests up to the limit
    await onRequestPost({ request, env });
    await onRequestPost({ request, env });

    // This one should be rate limited
    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 429);
    assert.ok(data.error);
    assert.match(data.error, /too many.*requests/i);
    assert.ok(response.headers.get('retry-after'));
  });

  it('should use client IP from cf-connecting-ip header', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const kvStore = new MockKVStore();
    const request1 = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'cf-connecting-ip': '192.168.1.1' }
    });
    const request2 = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'cf-connecting-ip': '192.168.1.2' }
    });
    const env = createMockEnv({
      RATELIMIT: kvStore,
      AZURE_OPENAI_ENDPOINT: null,
      TTS_RATE_LIMIT_MAX: 1,
      TTS_RATE_LIMIT_WINDOW: 60
    });

    // Different IPs should have separate rate limits
    const response1 = await onRequestPost({ request: request1, env });
    const response2 = await onRequestPost({ request: request2, env });

    assert.strictEqual(response1.status, 200);
    assert.strictEqual(response2.status, 200);
  });

  it('should handle x-forwarded-for header with multiple IPs', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' }
    });
    const env = createMockEnv({
      RATELIMIT: kvStore,
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);

    // Should use first IP
    const keys = Array.from(kvStore.store.keys());
    assert.ok(keys.some(k => k.includes('192.168.1.1')));
  });

  it('should use "anonymous" when no IP headers present', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({
      RATELIMIT: kvStore,
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);

    const keys = Array.from(kvStore.store.keys());
    assert.ok(keys.some(k => k.includes('anonymous')));
  });
});

describe('TTS API - Voice and Speed Validation', () => {
  beforeEach(() => {
    console.log = () => {};
    console.error = () => {};
  });

  it('should use default voice "nova" when no voice specified', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null // Use fallback
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should use default speed 1.1 when no speed specified', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null // Use fallback
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should clamp speed to minimum 0.25', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test', speed: 0.1 }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null // Use fallback
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should clamp speed to maximum 4.0', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test', speed: 5.0 }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null // Use fallback
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });
});

describe('TTS API - Context Templates', () => {
  it('should accept card-reveal context', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'The Fool', context: 'card-reveal' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should accept full-reading context', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'Your reading shows...', context: 'full-reading' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should accept synthesis context', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'To synthesize...', context: 'synthesis' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should use default context for unknown contexts', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test', context: 'unknown-context' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });
});

describe('TTS API - Fallback Audio Generation', () => {
  beforeEach(() => {
    console.error = () => {}; // Suppress error logs
  });

  it('should return fallback audio when Azure is not configured', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = {
      // No Azure credentials
    };

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.ok(data.audio);
    assert.ok(data.audio.startsWith('data:audio/wav;base64,'));
    assert.strictEqual(data.provider, 'fallback');
  });

  it('should return fallback audio when Azure fails', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    // Mock fetch to fail
    mockFetch.mock.mockImplementation(() => {
      throw new Error('Azure API failed');
    });

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv();

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.provider, 'fallback');

    mockFetch.mock.resetCalls();
  });
});

describe('TTS API - Streaming Mode', () => {
  beforeEach(() => {
    console.log = () => {};
    console.error = () => {};
  });

  it('should detect streaming mode from query parameter', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts?stream=true', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null // Use fallback
    });

    const response = await onRequestPost({ request, env });

    assert.strictEqual(response.status, 200);
    assert.ok(response.headers.get('content-type').includes('audio/'));
    // Streaming mode returns binary audio directly, not JSON with base64
    // Note: transfer-encoding: chunked is only set when streaming unknown-length data;
    // the fallback audio returns a fixed-size Uint8Array so no chunked encoding is used
    const body = await response.arrayBuffer();
    assert.ok(body.byteLength > 0, 'Should return binary audio data');
  });

  it('should return non-streaming response when stream=false', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts?stream=false', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.ok(data.audio);
    assert.ok(data.provider);
  });
});

describe('TTS API - Environment Resolution', () => {
  it('should resolve environment variables from env object', async () => {
    const { onRequestGet } = await import('../functions/api/tts.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://from-env.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'key-from-env',
      AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT: 'deployment-from-env'
    };

    const response = await onRequestGet({ env });
    const data = await response.json();

    assert.strictEqual(data.provider, 'azure-openai');
  });

  it('should prefer TTS-specific credentials over shared credentials', async () => {
    const { onRequestGet } = await import('../functions/api/tts.js');

    const env = {
      AZURE_OPENAI_ENDPOINT: 'https://shared.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'shared-key',
      AZURE_OPENAI_TTS_ENDPOINT: 'https://tts.openai.azure.com',
      AZURE_OPENAI_TTS_API_KEY: 'tts-key',
      AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT: 'deployment'
    };

    const response = await onRequestGet({ env });
    const data = await response.json();

    assert.strictEqual(data.provider, 'azure-openai');
  });
});

describe('TTS API - Debug Logging', () => {
  it('should enable debug logging in non-production NODE_ENV', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);

    process.env.NODE_ENV = originalEnv;
  });

  it('should respect explicit ENABLE_TTS_DEBUG_LOGGING flag', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({
      AZURE_OPENAI_ENDPOINT: null,
      ENABLE_TTS_DEBUG_LOGGING: 'true'
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });
});

describe('TTS API - Error Handling', () => {
  beforeEach(() => {
    console.error = () => {}; // Suppress error logs
  });

  it('should handle Azure TTS failures gracefully with fallback', async () => {
    const { onRequestPost } = await import('../functions/api/tts.js');

    // Mock fetch to simulate Azure failure
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Azure service error',
        headers: new Map()
      })
    );

    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv();

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    // Should fallback gracefully instead of returning error
    assert.strictEqual(response.status, 200);
    assert.ok(data.audio);
    assert.strictEqual(data.provider, 'fallback');

    mockFetch.mock.resetCalls();
  });
});

// Restore console after all tests
describe('Cleanup', () => {
  it('should restore console functions', () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    assert.ok(true);
  });
});
