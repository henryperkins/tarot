import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { onRequestPost as onStoryArtPost } from '../functions/api/generate-story-art.js';
import {
  onRequestPost as onCardVideoPost,
  onRequestGet as onCardVideoStatus
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

// Workers AI stand-in for FLUX.2 [dev]: records each call with its form fields.
function createImageAI({ fail = false } = {}) {
  const calls = [];
  return {
    calls,
    async run(model, input) {
      const { body, contentType } = input.multipart;
      const form = await new Response(body, { headers: { 'content-type': contentType } }).formData();
      calls.push({
        model,
        prompt: form.get('prompt'),
        width: form.get('width'),
        height: form.get('height')
      });
      if (fail) throw new Error('model unavailable');
      return { image: 'abc' };
    }
  };
}

function createBaseEnv(overrides = {}) {
  return {
    FEATURE_STORY_ART: 'true',
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

  it('generates story art with FLUX.2 [dev] from a prompt without the reading text', async () => {
    const ai = createImageAI();
    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const env = createBaseEnv({ DB: createMockDb(user), AI: ai });

    const request = createMockRequest('/api/generate-story-art', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        cards: [{ name: 'The Fool', number: 0, position: 'Present', reversed: false, meaning: 'New beginnings' }],
        question: 'What should I focus on?',
        narrative: 'I keep circling the same decision.',
        format: 'single',
        style: 'watercolor'
      }
    });

    const response = await onStoryArtPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.image, 'abc');
    assert.equal(payload.format, 'jpeg');
    assert.equal(ai.calls.length, 1);
    assert.equal(ai.calls[0].model, '@cf/black-forest-labs/flux-2-dev');
    assert.equal(ai.calls[0].width, '1536');
    assert.equal(ai.calls[0].height, '1024');
    assert.doesNotMatch(ai.calls[0].prompt, /Fool|Present|New beginnings|focus on|circling/);
    assert.equal(mockFetch.mock.calls.length, 0);
  });

  it('refunds story art usage on generation failure', async () => {
    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const metrics = new MockKVStore();
    const env = createBaseEnv({ DB: createMockDb(user), METRICS_DB: metrics, AI: createImageAI({ fail: true }) });

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

  describe('stalled FLUX.2 requests', () => {
    // Workers AI stand-in whose calls hang unless listed in `answers`
    // (call number -> image); `nextCall()` resolves once another call starts.
    function createStallingAI(answers = {}) {
      const waiters = [];
      let count = 0;
      return {
        get count() { return count; },
        nextCall: () => new Promise((resolve) => waiters.push(resolve)),
        run: () => {
          count += 1;
          waiters.splice(0).forEach((resolve) => resolve());
          return answers[count] ? Promise.resolve({ image: answers[count] }) : new Promise(() => {});
        }
      };
    }

    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const storyArtRequest = () => createMockRequest('/api/generate-story-art', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        cards: [{ name: 'The Fool', number: 0, position: 'Present', reversed: false }],
        question: 'What should I focus on?',
        format: 'single',
        style: 'watercolor'
      }
    });

    it('does not retry an uncancellable inference after its deadline', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const ai = createStallingAI({ 2: 'must-not-run' });
      const metrics = new MockKVStore();
      const env = createBaseEnv({ DB: createMockDb(user), METRICS_DB: metrics, AI: ai });
      const firstCall = ai.nextCall();
      const pending = onStoryArtPost({ request: storyArtRequest(), env });
      await firstCall;
      t.mock.timers.tick(35000);
      const response = await pending;
      const payload = await response.json();
      assert.equal(response.status, 500);
      assert.match(payload.details, /timed out after 35000ms/);
      assert.equal(ai.count, 1, 'The binding has no cancellation API; never overlap a retry');
      const usageKey = `media_usage:story-art:${user.id}:${getUtcDateKey(new Date())}`;
      assert.equal(await metrics.get(usageKey), null);
    });
  });

  it('rejects malformed story-art card payloads before provider calls', async () => {
    const ai = createImageAI();
    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const env = createBaseEnv({ DB: createMockDb(user), AI: ai });

    const request = createMockRequest('/api/generate-story-art', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        cards: [{ name: '   ', position: 'Present', reversed: false }],
        question: 'What should I focus on?',
        format: 'single',
        style: 'watercolor'
      }
    });

    const response = await onStoryArtPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /cards\[0\]\.name is required/);
    assert.equal(ai.calls.length, 0);
  });

  it('accepts vignette story-art requests with multiple cards by trimming to the lead card', async () => {
    const ai = createImageAI();
    const user = {
      id: 'user-pro',
      subscription_tier: 'pro',
      subscription_status: 'active'
    };
    const env = createBaseEnv({ DB: createMockDb(user), AI: ai });

    const request = createMockRequest('/api/generate-story-art', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        cards: [
          { name: 'The Fool', position: 'Past — influences that led here', reversed: false },
          { name: 'The Magician', position: 'Present — where you stand now', reversed: false }
        ],
        question: 'What should I focus on?',
        format: 'vignette',
        style: 'watercolor'
      }
    });

    const response = await onStoryArtPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(ai.calls.length, 1);
    assert.equal(ai.calls[0].width, '1024');
    assert.equal(ai.calls[0].height, '1536');
  });

  it('keeps story-art prompts under the configured budget', async () => {
    const ai = createImageAI();
    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const env = createBaseEnv({
      DB: createMockDb(user),
      AI: ai,
      MEDIA_PROMPT_BUDGET_GUARDS: 'true',
      MEDIA_PROMPT_BUDGET_STORY_ART_CHARS: '7000'
    });

    const request = createMockRequest('/api/generate-story-art', {
      method: 'POST',
      headers: { authorization: 'Bearer test' },
      body: {
        cards: [{ name: 'The Fool', position: 'Present', reversed: false, meaning: 'New beginnings' }],
        question: 'What should I focus on?',
        narrative: 'I am at a major transition point and need symbolic guidance for the next chapter.',
        format: 'single',
        style: 'watercolor'
      }
    });

    const response = await onStoryArtPost({ request, env });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(ai.calls.length, 1);
    assert.equal(ai.calls[0].prompt.length > 0, true);
    assert.equal(ai.calls[0].prompt.length <= 7000, true);
  });

  it('returns explicit budget error when story-art prompt cannot fit hard cap', async () => {
    const ai = createImageAI();
    const user = {
      id: 'user-plus',
      subscription_tier: 'plus',
      subscription_status: 'active'
    };
    const env = createBaseEnv({
      DB: createMockDb(user),
      AI: ai,
      MEDIA_PROMPT_BUDGET_GUARDS: 'true',
      MEDIA_PROMPT_BUDGET_STORY_ART_CHARS: '200'
    });

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
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, 'media_prompt_budget_exceeded');
    assert.equal(ai.calls.length, 0);
  });

  for (const [name, handler, method, suffix] of [
    ['generation', onCardVideoPost, 'POST', ''],
    ['capability discovery', onCardVideoStatus, 'GET', '?capabilities=true'],
    ['job polling', onCardVideoStatus, 'GET', '?jobId=saved-job']
  ]) {
    it(`retires card video ${name} without provider or allowance access`, async () => {
      const env = new Proxy({}, { get() { throw new Error('Retired routes must not access services or accounting'); } });
      const request = new Request(`https://example.test/api/generate-card-video${suffix}`, { method });
      const response = await handler({ request, env });
      assert.equal(response.status, 410);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), {
        error: 'Card video generation has been retired.',
        errorCode: 'CARD_VIDEO_RETIRED',
        cardVideo: false
      });
      assert.equal(mockFetch.mock.callCount(), 0);
    });
  }

});
