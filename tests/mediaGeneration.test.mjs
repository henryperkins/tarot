import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { onRequestPost as onStoryArtPost } from '../functions/api/generate-story-art.js';
import {
  onRequestPost as onCardVideoPost,
  onRequestGet as onCardVideoStatus,
  reconcilePendingVideoUsage
} from '../functions/api/generate-card-video.js';
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

  async list({ prefix = '', limit = 100, cursor = null } = {}) {
    const allKeys = Array.from(this.store.keys())
      .filter((key) => key.startsWith(prefix));
    const startIndex = Number.parseInt(cursor || '0', 10);
    const safeStartIndex = Number.isFinite(startIndex) && startIndex >= 0 ? startIndex : 0;
    const nextKeys = allKeys.slice(safeStartIndex, safeStartIndex + limit);
    const nextIndex = safeStartIndex + nextKeys.length;
    return {
      keys: nextKeys.map((name) => ({ name })),
      list_complete: nextIndex >= allKeys.length,
      cursor: nextIndex >= allKeys.length ? '' : String(nextIndex)
    };
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

function createMockDbWithD1RateLimit(user) {
  const authResult = {
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
  const counters = new Map();

  return {
    prepare: (sql) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();
      return {
        bind: (...args) => ({
          first: async () => {
            if (normalized.includes('insert into _request_rate_limits')) {
              const key = String(args[0]);
              const nextCount = (counters.get(key) || 0) + 1;
              counters.set(key, nextCount);
              return { request_count: nextCount };
            }
            if (normalized.includes('from sessions') && normalized.includes('join users')) {
              return authResult;
            }
            return authResult;
          },
          run: async () => {
            if (normalized.startsWith('delete from _request_rate_limits')) {
              return { success: true };
            }
            return { success: true };
          }
        }),
        run: async () => ({ success: true })
      };
    }
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

  it('refunds card video usage during scheduled reconciliation when client does not poll', async () => {
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
      CARD_VIDEO_USAGE_RECONCILE_MIN_AGE_MS: '0',
      CARD_VIDEO_USAGE_RECONCILE_BATCH_SIZE: '10'
    });

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

    const response = await onCardVideoPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.status, 'pending');
    assert.equal(payload.jobId, 'job-bg-123');

    const reconcileStats = await reconcilePendingVideoUsage(env, { minAgeMs: 0, batchSize: 10 });
    assert.equal(reconcileStats.refunded, 1);

    const dateKey = getUtcDateKey(new Date());
    const usageKey = `media_usage:card-video:${user.id}:${dateKey}`;
    const usageValue = await metrics.get(usageKey);
    assert.equal(usageValue, null);

    const updatedJobRaw = await metrics.get('video_job:job-bg-123');
    const updatedJob = updatedJobRaw ? JSON.parse(updatedJobRaw) : null;
    assert.equal(updatedJob?.usageRefunded, true);
    assert.equal(updatedJob?.usageFinalized, true);
  });

  it('reconciles unsettled jobs beyond the first KV page', async () => {
    const staleSettledCount = 120;
    const targetJobId = 'job-unsettled-final-page';

    mockFetch.mock.mockImplementation(async (url) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes(`/openai/v1/videos/${targetJobId}?`)) {
        return new Response(JSON.stringify({ status: 'failed' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in paginated reconcile test: ${requestUrl}`);
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    const dateKey = getUtcDateKey(new Date());
    const usageKey = `media_usage:card-video:${user.id}:${dateKey}`;
    await metrics.put(usageKey, '1');

    for (let i = 0; i < staleSettledCount; i += 1) {
      const settledJobId = `job-settled-${String(i).padStart(3, '0')}`;
      await metrics.put(`video_job:${settledJobId}`, JSON.stringify({
        userId: user.id,
        usageKey: `usage:${settledJobId}`,
        usageDateKey: dateKey,
        usageRefunded: false,
        usageFinalized: true,
        created: Date.now() - 600000
      }));
    }

    await metrics.put(`video_job:${targetJobId}`, JSON.stringify({
      userId: user.id,
      usageKey,
      usageDateKey: dateKey,
      usageRefunded: false,
      usageFinalized: false,
      created: Date.now() - 600000
    }));

    const env = createBaseEnv({
      DB: createMockDb(user),
      METRICS_DB: metrics,
      CARD_VIDEO_USAGE_RECONCILE_MIN_AGE_MS: '0',
      CARD_VIDEO_USAGE_RECONCILE_BATCH_SIZE: '1'
    });

    const stats = await reconcilePendingVideoUsage(env, {
      minAgeMs: 0,
      batchSize: 1,
      maxPages: 5
    });

    assert.equal(stats.refunded, 1);
    assert.equal(await metrics.get(usageKey), null);
    const updatedJobRaw = await metrics.get(`video_job:${targetJobId}`);
    const updatedJob = updatedJobRaw ? JSON.parse(updatedJobRaw) : null;
    assert.equal(updatedJob?.usageRefunded, true);
    assert.equal(updatedJob?.usageFinalized, true);
  });

  it('refunds stale processing jobs during scheduled reconciliation timeout', async () => {
    const jobId = 'job-processing-stale';
    mockFetch.mock.mockImplementation(async (url) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes(`/openai/v1/videos/${jobId}?`)) {
        return new Response(JSON.stringify({ status: 'processing' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in stale processing reconcile test: ${requestUrl}`);
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    const dateKey = getUtcDateKey(new Date());
    const usageKey = `media_usage:card-video:${user.id}:${dateKey}`;
    await metrics.put(usageKey, '1');
    await metrics.put(`video_job:${jobId}`, JSON.stringify({
      userId: user.id,
      usageKey,
      usageDateKey: dateKey,
      usageRefunded: false,
      usageFinalized: false,
      created: Date.now() - 10_000
    }));

    const env = createBaseEnv({
      DB: createMockDb(user),
      METRICS_DB: metrics,
      CARD_VIDEO_USAGE_RECONCILE_MIN_AGE_MS: '0',
      CARD_VIDEO_USAGE_RECONCILE_BATCH_SIZE: '10',
      CARD_VIDEO_USAGE_RECONCILE_MAX_PENDING_AGE_MS: '1000'
    });

    const stats = await reconcilePendingVideoUsage(env, {
      minAgeMs: 0,
      batchSize: 10,
      maxPendingAgeMs: 1000
    });

    assert.equal(stats.refunded, 1);
    assert.equal(await metrics.get(usageKey), null);
    const updatedJobRaw = await metrics.get(`video_job:${jobId}`);
    const updatedJob = updatedJobRaw ? JSON.parse(updatedJobRaw) : null;
    assert.equal(updatedJob?.usageRefunded, true);
    assert.equal(updatedJob?.usageSettlementReason, 'scheduled-timeout');
  });

  it('applies batchSize to unsettled jobs processed during reconciliation', async () => {
    const failedJobs = ['job-failed-a', 'job-failed-b', 'job-failed-c'];
    mockFetch.mock.mockImplementation(async (url) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (failedJobs.some((jobId) => requestUrl.includes(`/openai/v1/videos/${jobId}?`))) {
        return new Response(JSON.stringify({ status: 'failed' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in batch size reconcile test: ${requestUrl}`);
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    const dateKey = getUtcDateKey(new Date());

    for (let i = 0; i < 140; i += 1) {
      const settledJobId = `job-settled-${String(i).padStart(3, '0')}`;
      await metrics.put(`video_job:${settledJobId}`, JSON.stringify({
        userId: user.id,
        usageKey: `usage:${settledJobId}`,
        usageDateKey: dateKey,
        usageRefunded: false,
        usageFinalized: true,
        created: Date.now() - 600000
      }));
    }

    for (const jobId of failedJobs) {
      const usageKey = `media_usage:card-video:${user.id}:${dateKey}:${jobId}`;
      await metrics.put(usageKey, '1');
      await metrics.put(`video_job:${jobId}`, JSON.stringify({
        userId: user.id,
        usageKey,
        usageDateKey: dateKey,
        usageRefunded: false,
        usageFinalized: false,
        created: Date.now() - 600000
      }));
    }

    const env = createBaseEnv({
      DB: createMockDb(user),
      METRICS_DB: metrics,
      CARD_VIDEO_USAGE_RECONCILE_MIN_AGE_MS: '0',
      CARD_VIDEO_USAGE_RECONCILE_BATCH_SIZE: '2'
    });

    const stats = await reconcilePendingVideoUsage(env, {
      minAgeMs: 0,
      batchSize: 2,
      maxPages: 10
    });

    assert.equal(stats.refunded, 2);
    const firstTwo = failedJobs.slice(0, 2);
    for (const jobId of firstTwo) {
      const usageKey = `media_usage:card-video:${user.id}:${dateKey}:${jobId}`;
      assert.equal(await metrics.get(usageKey), null);
    }
    const untouchedUsageKey = `media_usage:card-video:${user.id}:${dateKey}:${failedJobs[2]}`;
    assert.equal(await metrics.get(untouchedUsageKey), '1');
  });

  it('uses a supported fallback keyframe size when video size is unsupported', async () => {
    let capturedVideo = null;
    let capturedImageSize = null;

    mockFetch.mock.mockImplementation(async (url, options) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes('/openai/v1/images/generations?')) {
        const body = JSON.parse(options.body);
        capturedImageSize = body.size;
        return new Response(JSON.stringify({
          data: [{ b64_json: 'aGVsbG8=' }]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (requestUrl.includes('/openai/v1/videos?')) {
        capturedVideo = { url: requestUrl, options };
        return new Response(JSON.stringify({ id: 'job-123', status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in keyframe fallback test: ${requestUrl}`);
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

    assert.equal(capturedImageSize, '1536x1024');
    assert.ok(capturedVideo?.url?.includes('/openai/v1/videos'), 'Should call video endpoint');
    assert.ok(capturedVideo?.options?.body instanceof FormData, 'Should send multipart form data');
    assert.notEqual(capturedVideo.options.body.get('input_reference'), null);
  });

  it('retries video job creation without input_reference when provider rejects the reference', async () => {
    const videoBodies = [];

    mockFetch.mock.mockImplementation(async (url, options) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes('/openai/v1/images/generations?')) {
        return new Response(JSON.stringify({
          data: [{ b64_json: 'aGVsbG8=' }]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (requestUrl.includes('/openai/v1/videos?')) {
        videoBodies.push(options.body);
        const hasInputReference = options.body.get('input_reference') !== null;
        if (hasInputReference) {
          return new Response('input_reference size mismatch', { status: 400 });
        }
        return new Response(JSON.stringify({ id: 'job-456', status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in input_reference retry test: ${requestUrl}`);
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
    assert.equal(payload.jobId, 'job-456');
    assert.equal(videoBodies.length, 2);
    assert.notEqual(videoBodies[0].get('input_reference'), null);
    assert.equal(videoBodies[1].get('input_reference'), null);
  });

  it('retries video job creation without input_reference when provider reports inpaint dimension mismatch', async () => {
    const videoBodies = [];

    mockFetch.mock.mockImplementation(async (url, options) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes('/openai/v1/images/generations?')) {
        return new Response(JSON.stringify({
          data: [{ b64_json: 'aGVsbG8=' }]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (requestUrl.includes('/openai/v1/videos?')) {
        videoBodies.push(options.body);
        const hasInputReference = options.body.get('input_reference') !== null;
        if (hasInputReference) {
          return new Response(JSON.stringify({
            error: {
              message: 'Inpaint image must match the requested width and height',
              type: 'invalid_request_error',
              param: null,
              code: null
            }
          }), { status: 400, headers: { 'content-type': 'application/json' } });
        }
        return new Response(JSON.stringify({ id: 'job-789', status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in inpaint mismatch retry test: ${requestUrl}`);
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
    assert.equal(payload.jobId, 'job-789');
    assert.equal(videoBodies.length, 2);
    assert.notEqual(videoBodies[0].get('input_reference'), null);
    assert.equal(videoBodies[1].get('input_reference'), null);
  });

  it('returns 503 when card video provider configuration is missing', async () => {
    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const env = createBaseEnv({
      DB: createMockDb(user),
      AZURE_OPENAI_VIDEO_ENDPOINT: '',
      AZURE_OPENAI_VIDEO_API_KEY: '',
      AZURE_OPENAI_ENDPOINT: '',
      AZURE_OPENAI_API_KEY: ''
    });

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

    const response = await onCardVideoPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.error, 'Card video service is unavailable');
    assert.equal(payload.code, 'video_service_unavailable');
  });

  it('rejects unsupported card video duration values before provider calls', async () => {
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
        card: { name: 'The Fool', reversed: false },
        question: 'What should I focus on?',
        position: 'Present',
        style: 'mystical',
        seconds: 5
      }
    });

    const response = await onCardVideoPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /seconds must be one of: 4, 8, 12/);
    assert.equal(mockFetch.mock.calls.length, 0);
  });

  it('rejects non-integer card video duration values', async () => {
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
        card: { name: 'The Fool', reversed: false },
        question: 'What should I focus on?',
        position: 'Present',
        style: 'mystical',
        seconds: 'fast'
      }
    });

    const response = await onCardVideoPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /seconds must be a positive integer/);
    assert.equal(mockFetch.mock.calls.length, 0);
  });

  it('enforces tier-specific max duration after provider duration validation', async () => {
    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const env = createBaseEnv({ DB: createMockDb(user) });

    const request = createMockRequest('/api/generate-card-video', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        card: { name: 'The Fool', reversed: false },
        question: 'What should I focus on?',
        position: 'Present',
        style: 'mystical',
        seconds: 8
      }
    });

    const response = await onCardVideoPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.match(payload.error, /Videos longer than 4s require Pro subscription/);
    assert.equal(mockFetch.mock.calls.length, 0);
  });

  it('throttles repeated card video POST requests in a short window', async () => {
    mockFetch.mock.mockImplementation(async (url) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes('/openai/v1/videos?')) {
        return new Response(JSON.stringify({ id: 'job-rate-1', status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in POST rate-limit test: ${requestUrl}`);
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const env = createBaseEnv({
      DB: createMockDb(user),
      RATELIMIT: new MockKVStore(),
      CARD_VIDEO_POST_RATE_LIMIT_MAX: '1',
      CARD_VIDEO_POST_RATE_LIMIT_WINDOW_SECONDS: '60'
    });

    const requestBody = {
      card: { name: 'The Fool', reversed: false },
      question: 'What should I focus on?',
      position: 'Present',
      style: 'mystical',
      seconds: 4
    };

    const firstRequest = createMockRequest('/api/generate-card-video', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test',
        'cf-connecting-ip': '203.0.113.10'
      },
      body: requestBody
    });
    const firstResponse = await onCardVideoPost({ request: firstRequest, env });
    assert.equal(firstResponse.status, 200);

    const secondRequest = createMockRequest('/api/generate-card-video', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test',
        'cf-connecting-ip': '203.0.113.10'
      },
      body: requestBody
    });
    const secondResponse = await onCardVideoPost({ request: secondRequest, env });
    const secondPayload = await secondResponse.json();

    assert.equal(secondResponse.status, 429);
    assert.equal(secondPayload.code, 'card_video_rate_limited');
    const retryAfterPost = Number.parseInt(secondResponse.headers.get('retry-after') || '0', 10);
    assert.equal(Number.isInteger(retryAfterPost), true);
    assert.equal(retryAfterPost > 0 && retryAfterPost <= 60, true);
  });

  it('throttles repeated card video status polling requests', async () => {
    mockFetch.mock.mockImplementation(async (url) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes('/openai/v1/videos/job-status-limit?')) {
        return new Response(JSON.stringify({ status: 'processing' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in GET rate-limit test: ${requestUrl}`);
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    await metrics.put('video_job:job-status-limit', JSON.stringify({
      userId: user.id,
      usageFinalized: false,
      usageRefunded: false
    }));

    const env = createBaseEnv({
      DB: createMockDb(user),
      METRICS_DB: metrics,
      RATELIMIT: new MockKVStore(),
      CARD_VIDEO_STATUS_RATE_LIMIT_MAX: '1',
      CARD_VIDEO_STATUS_RATE_LIMIT_WINDOW_SECONDS: '60'
    });

    const firstRequest = createMockRequest('/api/generate-card-video?jobId=job-status-limit', {
      method: 'GET',
      headers: {
        authorization: 'Bearer test',
        'cf-connecting-ip': '203.0.113.20'
      }
    });
    const firstResponse = await onCardVideoStatus({ request: firstRequest, env });
    assert.equal(firstResponse.status, 200);

    const secondRequest = createMockRequest('/api/generate-card-video?jobId=job-status-limit', {
      method: 'GET',
      headers: {
        authorization: 'Bearer test',
        'cf-connecting-ip': '203.0.113.20'
      }
    });
    const secondResponse = await onCardVideoStatus({ request: secondRequest, env });
    const secondPayload = await secondResponse.json();

    assert.equal(secondResponse.status, 429);
    assert.equal(secondPayload.code, 'card_video_status_rate_limited');
    const retryAfterStatus = Number.parseInt(secondResponse.headers.get('retry-after') || '0', 10);
    assert.equal(Number.isInteger(retryAfterStatus), true);
    assert.equal(retryAfterStatus > 0 && retryAfterStatus <= 60, true);
  });

  it('uses D1 backend for POST rate limiting when configured', async () => {
    mockFetch.mock.mockImplementation(async (url) => {
      const requestUrl = typeof url === 'string' ? url : String(url);
      if (requestUrl.includes('/openai/v1/videos?')) {
        return new Response(JSON.stringify({ id: 'job-d1-rate-1', status: 'queued' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
      throw new Error(`Unexpected fetch URL in D1 POST rate-limit test: ${requestUrl}`);
    });

    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const env = createBaseEnv({
      DB: createMockDbWithD1RateLimit(user),
      CARD_VIDEO_RATE_LIMIT_BACKEND: 'd1',
      CARD_VIDEO_POST_RATE_LIMIT_MAX: '1',
      CARD_VIDEO_POST_RATE_LIMIT_WINDOW_SECONDS: '60'
    });

    const requestBody = {
      card: { name: 'The Fool', reversed: false },
      question: 'What should I focus on?',
      position: 'Present',
      style: 'mystical',
      seconds: 4
    };

    const firstRequest = createMockRequest('/api/generate-card-video', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test',
        'cf-connecting-ip': '203.0.113.30'
      },
      body: requestBody
    });
    const firstResponse = await onCardVideoPost({ request: firstRequest, env });
    assert.equal(firstResponse.status, 200);

    const secondRequest = createMockRequest('/api/generate-card-video', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test',
        'cf-connecting-ip': '203.0.113.30'
      },
      body: requestBody
    });
    const secondResponse = await onCardVideoPost({ request: secondRequest, env });
    const secondPayload = await secondResponse.json();

    assert.equal(secondResponse.status, 429);
    assert.equal(secondPayload.code, 'card_video_rate_limited');
    const retryAfterPost = Number.parseInt(secondResponse.headers.get('retry-after') || '0', 10);
    assert.equal(Number.isInteger(retryAfterPost), true);
    assert.equal(retryAfterPost > 0 && retryAfterPost <= 60, true);
  });
});
