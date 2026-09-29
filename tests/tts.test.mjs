import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { onRequestGet, onRequestPost, splitForSpeech } from '../functions/api/tts.js';

/**
 * TTS (Text-to-Speech) API Tests
 *
 * Tests for functions/api/tts.js covering:
 * - Health check endpoint (GET)
 * - Request validation and text sanitization
 * - Rate limiting
 * - Deepgram Aura-2 on Workers AI, in pieces for long text
 * - Streaming mode
 * - Fallback audio generation
 */

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

/**
 * Workers AI stand-in for Aura-2. Each call returns a stream holding
 * "<n>", where n counts calls from 1, so tests can check the order of pieces.
 * `failOn` lists call numbers that reject; `delayMs` delays given calls.
 */
function createAuraAI({ failOn = [], delayMs = {} } = {}) {
  const calls = [];
  return {
    calls,
    async run(model, input) {
      calls.push({ model, input });
      const callNumber = calls.length;
      if (delayMs[callNumber]) {
        await new Promise((resolve) => setTimeout(resolve, delayMs[callNumber]));
      }
      if (failOn.includes(callNumber)) {
        throw new Error(`Aura-2 call ${callNumber} failed`);
      }
      return new Response(`<${callNumber}>`).body;
    }
  };
}

// Helper to create mock environment
function createMockEnv(overrides = {}) {
  return {
    AI: createAuraAI(),
    RATELIMIT: null, // No rate limiting by default in tests
    ...overrides
  };
}

function decodeDataUri(dataUri) {
  const [prefix, base64] = dataUri.split(',');
  return { prefix, text: Buffer.from(base64, 'base64').toString() };
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
  it('reports Aura-2 when the Workers AI binding is present', async () => {
    const response = await onRequestGet({ env: createMockEnv() });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.provider, 'workers-ai-aura-2');
    assert.strictEqual(data.model, '@cf/deepgram/aura-2-en');
    assert.ok(data.timestamp);
  });

  it('reports the local provider without the binding', async () => {
    const response = await onRequestGet({ env: {} });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.provider, 'local');
  });
});

describe('TTS API - Request Validation (POST)', () => {
  beforeEach(() => {
    console.log = () => {}; // Suppress logs
    console.error = () => {};
    console.warn = () => {};
  });

  it('should reject requests without text field', async () => {
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
    assert.strictEqual(env.AI.calls.length, 0);
  });

  it('should reject requests with empty text', async () => {
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

  it('should handle non-string text input', async () => {
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

  it('should return 400 for invalid JSON body', async () => {
    const request = {
      url: 'https://example.com/api/tts',
      method: 'POST',
      headers: {
        get: () => null,
        set: () => {},
        has: () => false
      },
      text: async () => 'not valid json {'
    };

    const response = await onRequestPost({ request, env: createMockEnv() });
    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, 'Invalid JSON payload.');
  });
});

describe('TTS API - Aura-2 speech', () => {
  beforeEach(() => {
    console.log = () => {};
    console.error = () => {};
  });

  it('speaks the trimmed text with the Cora voice and returns an MP3 data URI', async () => {
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: '   The Fool card represents new beginnings.   ', voice: 'nova', speed: 0.85, emotion: 'hopeful' }
    });
    const env = createMockEnv();

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.provider, 'workers-ai-aura-2');
    assert.deepStrictEqual(decodeDataUri(data.audio), { prefix: 'data:audio/mpeg;base64', text: '<1>' });
    assert.deepStrictEqual(env.AI.calls, [{
      model: '@cf/deepgram/aura-2-en',
      input: { text: 'The Fool card represents new beginnings.', speaker: 'cora' }
    }]);
  });

  it('limits text to 4096 characters', async () => {
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'a'.repeat(5000) }
    });
    const env = createMockEnv();

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
    const spoken = env.AI.calls.map((call) => call.input.text).join('');
    assert.strictEqual(spoken.length, 4096);
  });

  it('speaks long text in pieces and keeps their order when later pieces finish first', async () => {
    const sentence = 'The Tower asks what was never built to last. ';
    const text = sentence.repeat(90).trim(); // about 4,000 characters
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text }
    });
    const env = createMockEnv({ AI: createAuraAI({ delayMs: { 1: 20 } }) });

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(env.AI.calls.length, 3);
    for (const call of env.AI.calls) {
      assert.ok(call.input.text.length <= 1900);
      assert.ok(call.input.text.endsWith('last.'), 'Pieces should end at a sentence');
    }
    assert.strictEqual(decodeDataUri(data.audio).text, '<1><2><3>');
  });
});

describe('splitForSpeech', () => {
  it('leaves text under the limit whole', () => {
    assert.deepStrictEqual(splitForSpeech('  One short line.  '), ['One short line.']);
  });

  it('breaks between words when no sentence ends late enough', () => {
    const pieces = splitForSpeech('word '.repeat(800));
    assert.ok(pieces.length > 1);
    for (const piece of pieces) {
      assert.ok(piece.length <= 1900);
      assert.match(piece, /^word( word)*$/);
    }
  });

  it('cuts text with no spaces at the limit', () => {
    const pieces = splitForSpeech('x'.repeat(4000));
    assert.deepStrictEqual(pieces.map((piece) => piece.length), [1900, 1900, 200]);
  });
});

describe('TTS API - Streaming Mode', () => {
  beforeEach(() => {
    console.log = () => {};
    console.error = () => {};
  });

  it('streams MP3 pieces in order with the provider header', async () => {
    const text = 'The Star pours water on the land and into the pool. '.repeat(80).trim();
    const request = createMockRequest('/api/tts?stream=true', {
      method: 'POST',
      body: { text }
    });
    const env = createMockEnv({ AI: createAuraAI({ delayMs: { 1: 20 } }) });

    const response = await onRequestPost({ request, env });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'audio/mpeg');
    assert.strictEqual(response.headers.get('x-tts-provider'), 'workers-ai-aura-2');
    assert.strictEqual(await response.text(), '<1><2><3>');
  });

  it('returns JSON when stream=false', async () => {
    const request = createMockRequest('/api/tts?stream=false', {
      method: 'POST',
      body: { text: 'test' }
    });

    const response = await onRequestPost({ request, env: createMockEnv() });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.provider, 'workers-ai-aura-2');
  });
});

describe('TTS API - Fallback Audio Generation', () => {
  beforeEach(() => {
    console.error = () => {}; // Suppress error logs
  });

  it('returns fallback audio without the Workers AI binding', async () => {
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });

    const response = await onRequestPost({ request, env: {} });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.ok(data.audio.startsWith('data:audio/wav;base64,'));
    assert.strictEqual(data.provider, 'fallback');
  });

  it('returns fallback audio when Aura-2 fails', async () => {
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({ AI: createAuraAI({ failOn: [1] }) });

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.provider, 'fallback');
  });

  it('returns fallback audio when a later piece fails', async () => {
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'The Moon hides the path. '.repeat(100).trim() }
    });
    const env = createMockEnv({ AI: createAuraAI({ failOn: [2] }) });

    const response = await onRequestPost({ request, env });
    const data = await response.json();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.provider, 'fallback');
  });

  it('streams fallback WAV audio when Aura-2 fails before any audio', async () => {
    const request = createMockRequest('/api/tts?stream=true', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({ AI: createAuraAI({ failOn: [1] }) });

    const response = await onRequestPost({ request, env });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('content-type'), 'audio/wav');
    assert.strictEqual(response.headers.get('x-tts-provider'), 'fallback');
  });
});

describe('TTS API - Rate Limiting', () => {
  beforeEach(() => {
    console.warn = () => {}; // Suppress warnings
  });

  it('should allow requests when under rate limit', async () => {
    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'cf-connecting-ip': '192.168.1.1' }
    });
    const env = createMockEnv({
      RATELIMIT: kvStore,
      TTS_RATE_LIMIT_MAX: 5,
      TTS_RATE_LIMIT_WINDOW: 60
    });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);
  });

  it('should reject requests when rate limit exceeded', async () => {
    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'cf-connecting-ip': '192.168.1.1' }
    });
    const env = createMockEnv({
      RATELIMIT: kvStore,
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
    assert.strictEqual(env.AI.calls.length, 2);
  });

  it('should use client IP from cf-connecting-ip header', async () => {
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
    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' },
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' }
    });
    const env = createMockEnv({ RATELIMIT: kvStore });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);

    // Should use first IP
    const keys = Array.from(kvStore.store.keys());
    assert.ok(keys.some(k => k.includes('192.168.1.1')));
  });

  it('should use "anonymous" when no IP headers present', async () => {
    const kvStore = new MockKVStore();
    const request = createMockRequest('/api/tts', {
      method: 'POST',
      body: { text: 'test' }
    });
    const env = createMockEnv({ RATELIMIT: kvStore });

    const response = await onRequestPost({ request, env });
    assert.strictEqual(response.status, 200);

    const keys = Array.from(kvStore.store.keys());
    assert.ok(keys.some(k => k.includes('anonymous')));
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
