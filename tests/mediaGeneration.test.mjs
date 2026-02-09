import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { onRequestPost as onStoryArtPost } from '../functions/api/generate-story-art.js';
import { onRequestPost as onCardVideoPost } from '../functions/api/generate-card-video.js';
import { onRequestGet as onCardVideoStatus } from '../functions/api/generate-card-video.js';
import { getUtcDateKey } from '../functions/lib/utils.js';

const mockFetch = mock.fn();
global.fetch = mockFetch;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Upper bound for KV expiry timers in tests (1 hour); avoids unrealistic multi-day timeouts.
const MAX_SAFE_TIMEOUT_MS = 60 * 60 * 1000;

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
    text: async () => (options.body ? JSON.stringify(options.body) : ''),
    json: async () => options.body || {}
  };
}

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
          timer.unref();
        }
      }
    }
  }

  async delete(key) {
    this.store.delete(key);
  }
}

function createMockDb(user) {
  const result = {
    session_id: 'session-1',
    user_id: user.id,
    email: user.email || 'test@example.com',
    username: user.username || 'tester',
    is_active: 1,
    subscription_tier: user.subscription_tier,
    subscription_status: user.subscription_status,
    subscription_provider: user.subscription_provider || null,
    email_verified: true
  };
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => result,
        run: async () => ({ success: true })
      })
    })
  };
}

function createBaseEnv(overrides = {}) {
  return {
    FEATURE_STORY_ART: 'true',
    FEATURE_CARD_VIDEO: 'true',
    AZURE_OPENAI_IMAGE_ENDPOINT: 'https://test.openai.azure.com',
    AZURE_OPENAI_IMAGE_API_KEY: 'test-key',
    AZURE_OPENAI_VIDEO_ENDPOINT: 'https://test.openai.azure.com',
    AZURE_OPENAI_VIDEO_API_KEY: 'test-key',
    METRICS_DB: new MockKVStore(),
    R2_LOGS: null,
    ...overrides
  };
}

describe('Media generation APIs', () => {
  beforeEach(() => {
    mockFetch.mock.resetCalls();
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  it('enforces story art quality by tier (ignores payload override)', async () => {
    let capturedQuality = null;

    mockFetch.mock.mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      capturedQuality = body.quality;
      return new Response(JSON.stringify({
        data: [{ b64_json: 'abc', revised_prompt: '' }]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const env = createBaseEnv({ DB: createMockDb(user) });

    const request = createMockRequest('/api/generate-story-art', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        cards: [{ name: 'The Fool', position: 'Present', reversed: false }],
        question: 'What should I focus on?',
        format: 'single',
        style: 'watercolor',
        quality: 'high'
      }
    });

    const response = await onStoryArtPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(capturedQuality, 'low');
  });

  it('refunds story art usage on generation failure', async () => {
    mockFetch.mock.mockImplementation(async () => new Response('fail', { status: 500 }));

    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    const env = createBaseEnv({ DB: createMockDb(user), METRICS_DB: metrics });

    const request = createMockRequest('/api/generate-story-art', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        cards: [{ name: 'The Fool', position: 'Present', reversed: false }],
        question: 'What should I focus on?',
        format: 'single',
        style: 'watercolor'
      }
    });

    const response = await onStoryArtPost({ request, env });
    assert.equal(response.status, 500);

    const dateKey = getUtcDateKey(new Date());
    const usageKey = `media_usage:story-art:${user.id}:${dateKey}`;
    const usageValue = await metrics.get(usageKey);
    assert.equal(usageValue, null);
  });

  it('refunds card video usage when job fails', async () => {
    mockFetch.mock.mockImplementation(async () => new Response(JSON.stringify({ status: 'failed' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    const env = createBaseEnv({ DB: createMockDb(user), METRICS_DB: metrics });

    const dateKey = getUtcDateKey(new Date());
    const usageKey = `media_usage:card-video:${user.id}:${dateKey}`;
    await metrics.put(usageKey, '1');
    await metrics.put('video_job:job-123', JSON.stringify({
      userId: user.id,
      usageKey,
      usageDateKey: dateKey,
      usageRefunded: false,
      requestId: 'req-1'
    }));

    const request = createMockRequest('/api/generate-card-video?jobId=job-123', {
      method: 'GET',
      headers: { authorization: 'Bearer test' }
    });

    const response = await onCardVideoStatus({ request, env });
    assert.equal(response.status, 200);

    const usageValue = await metrics.get(usageKey);
    assert.equal(usageValue, null);

    const updatedJobRaw = await metrics.get('video_job:job-123');
    const updatedJob = updatedJobRaw ? JSON.parse(updatedJobRaw) : null;
    assert.equal(updatedJob?.usageRefunded, true);
  });

  it('refunds card video usage in background when client does not poll', async () => {
    mockFetch.mock.mockImplementation(async (url) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes('/openai/v1/videos?')) {
        return new Response(JSON.stringify({ id: 'job-bg-123', status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (requestUrl.includes('/openai/v1/videos/job-bg-123?')) {
        return new Response(JSON.stringify({ status: 'failed' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in background settlement test: ${requestUrl}`);
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    const env = createBaseEnv({
      DB: createMockDb(user),
      METRICS_DB: metrics,
      CARD_VIDEO_BACKGROUND_SETTLE_DELAY_MS: '0',
      CARD_VIDEO_BACKGROUND_SETTLE_RETRY_DELAY_MS: '0',
      CARD_VIDEO_BACKGROUND_SETTLE_MAX_ATTEMPTS: '1'
    });

    const backgroundTasks = [];
    const request = createMockRequest('/api/generate-card-video', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        card: { name: 'The Fool', reversed: false },
        question: 'What should I focus on?',
        position: 'Present',
        style: 'mystical',
        seconds: 4
      }
    });

    const response = await onCardVideoPost({
      request,
      env,
      waitUntil: (promise) => {
        backgroundTasks.push(promise);
      }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.status, 'pending');
    assert.equal(payload.jobId, 'job-bg-123');
    assert.equal(backgroundTasks.length, 1);

    await Promise.allSettled(backgroundTasks);

    const dateKey = getUtcDateKey(new Date());
    const usageKey = `media_usage:card-video:${user.id}:${dateKey}`;
    const usageValue = await metrics.get(usageKey);
    assert.equal(usageValue, null);

    const updatedJobRaw = await metrics.get('video_job:job-bg-123');
    const updatedJob = updatedJobRaw ? JSON.parse(updatedJobRaw) : null;
    assert.equal(updatedJob?.usageRefunded, true);
    assert.equal(updatedJob?.usageFinalized, true);
  });

  it('generates card video without input_reference when keyframe cannot match video size', async () => {
    let captured = null;

    mockFetch.mock.mockImplementation(async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({ id: 'job-123', status: 'queued' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const env = createBaseEnv({ DB: createMockDb(user) });

    const request = createMockRequest('/api/generate-card-video', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        card: { name: 'Seven of Cups', suit: 'cups', reversed: false },
        question: 'How can I connect better with the people I love?',
        position: 'Present',
        style: 'mystical',
        seconds: 4
      }
    });

    const response = await onCardVideoPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.status, 'pending');
    assert.equal(payload.jobId, 'job-123');

    assert.ok(captured?.url?.includes('/openai/v1/videos'), 'Should call video endpoint');
    assert.ok(captured?.options?.body instanceof FormData, 'Should send multipart form data');
    assert.equal(captured.options.body.get('input_reference'), null);
  });
});
