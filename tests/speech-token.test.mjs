import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestGet } from '../functions/api/speech-token.js';

class MockAuthDb {
  constructor(sessionRow = null) {
    this.sessionRow = sessionRow;
  }

  prepare(query) {
    if (query.includes('FROM sessions')) {
      return {
        bind: () => ({
          first: async () => this.sessionRow
        })
      };
    }

    if (query.startsWith('UPDATE sessions SET last_used_at')) {
      return {
        bind: () => ({
          run: async () => ({ meta: { changes: 1 } })
        })
      };
    }

    if (query.includes('usage_tracking')) {
      return {
        bind: () => ({
          first: async () => null,
          run: async () => ({ meta: { changes: 1 } })
        })
      };
    }

    return {
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } })
      })
    };
  }
}

function createSessionRow(overrides = {}) {
  return {
    session_id: 'session-1',
    user_id: 'user-1',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    id: 'user-1',
    email: 'user@example.com',
    username: 'mystic',
    is_active: 1,
    subscription_tier: 'pro',
    subscription_status: 'active',
    subscription_provider: 'stripe',
    stripe_customer_id: 'cus_123',
    email_verified: 1,
    ...overrides
  };
}

function createRequest(cookieHeader) {
  const headers = cookieHeader ? { Cookie: cookieHeader } : {};
  return new Request('https://example.com/api/speech-token', { headers });
}

test('onRequestGet returns 401 for unauthenticated requests', async () => {
  const response = await onRequestGet({
    request: createRequest(null),
    env: {}
  });

  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.error, 'Not authenticated');
});

test('onRequestGet allows non-Pro users (subject to rate limits)', async () => {
  // A Plus-tier user should reach the speech-key check, not be blocked by tier
  const response = await onRequestGet({
    request: createRequest('session=token-1'),
    env: {
      DB: new MockAuthDb(
        createSessionRow({
          subscription_tier: 'plus',
          subscription_status: 'active'
        })
      )
    }
  });

  const payload = await response.json();
  // 503 = reached the AZURE_SPEECH_KEY check (not configured), not a 403 tier block
  assert.equal(response.status, 503);
  assert.equal(payload.error, 'Speech service not configured');
});

test('onRequestGet returns 503 when Azure Speech is not configured', async () => {
  const response = await onRequestGet({
    request: createRequest('session=token-1'),
    env: {
      DB: new MockAuthDb(createSessionRow()),
      AZURE_SPEECH_KEY: ''
    }
  });

  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.error, 'Speech service not configured');
});

test('onRequestGet returns Azure token for authenticated users', async () => {
  const originalFetch = global.fetch;
  const fetchCalls = [];

  global.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return new Response('mock-speech-token', { status: 200 });
  };

  try {
    const response = await onRequestGet({
      request: createRequest('session=token-1'),
      env: {
        DB: new MockAuthDb(createSessionRow()),
        AZURE_SPEECH_KEY: 'speech-key',
        AZURE_SPEECH_REGION: 'eastus2',
        RATELIMIT: null
      }
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.token, 'mock-speech-token');
    assert.equal(payload.region, 'eastus2');
    assert.equal(payload.expiresIn, 540);
    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0].url,
      'https://eastus2.api.cognitive.microsoft.com/sts/v1.0/issueToken'
    );
    assert.equal(fetchCalls[0].init?.method, 'POST');
    assert.equal(
      fetchCalls[0].init?.headers?.['Ocp-Apim-Subscription-Key'],
      'speech-key'
    );
    assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
  } finally {
    global.fetch = originalFetch;
  }
});
