import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { onRequestPost as createPortalSession } from '../functions/api/create-portal-session.js';
import { onRequestGet as getUsageStatus } from '../functions/api/usage.js';
import { onRequest as archetypeJourney } from '../functions/api/archetype-journey.js';
import { jsonResponse as baseJsonResponse } from '../functions/lib/utils.js';

const jsonResponse = (data, init = {}) => baseJsonResponse(data, { status: init.status ?? 200 });

function createMockDb({ prefsRow = { archetype_journey_enabled: 1, show_badges: 0 } } = {}) {
  const calls = [];
  return {
    calls,
    prepare(query) {
      return {
        bind: (...args) => {
          calls.push({ query, args });
          return {
            first: async () => {
              if (query.includes('FROM user_analytics_prefs')) {
                return prefsRow;
              }
              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
            all: async () => ({ results: [] })
          };
        }
      };
    }
  };
}

describe('create-portal-session API', () => {
  it('returns session-required error for API key auth', async () => {
    const response = await createPortalSession(
      { request: new Request('https://example.com/api/create-portal-session', { method: 'POST' }), env: { STRIPE_SECRET_KEY: 'sk_test' } },
      {
        getUserFromRequest: async () => ({ auth_provider: 'api_key' }),
        jsonResponse,
        readJsonBody: async () => ({}),
        sanitizeRedirectUrl: (url) => url || 'https://example.com/account',
        stripeRequest: async () => ({ url: '' })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, 'SESSION_REQUIRED');
  });

  it('returns configuration error when Stripe key is missing', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await createPortalSession(
        { request: new Request('https://example.com/api/create-portal-session', { method: 'POST' }), env: {} },
        {
          getUserFromRequest: async () => ({ id: 'user-1' }),
          jsonResponse,
          readJsonBody: async () => ({}),
          sanitizeRedirectUrl: (url) => url || 'https://example.com/account',
          stripeRequest: async () => ({ url: '' })
        }
      );
      const body = await response.json();

      assert.equal(response.status, 500);
      assert.equal(body.code, 'STRIPE_NOT_CONFIGURED');
    } finally {
      console.error = originalError;
    }
  });
});

describe('usage API freshness', () => {
  const baseDeps = {
    jsonResponse,
    enforceApiCallLimit: async () => ({ allowed: true }),
    getSubscriptionContext: () => ({
      tier: 'plus',
      status: 'active',
      effectiveTier: 'plus',
      config: {
        monthlyReadings: 100,
        monthlyTTS: 50,
        apiAccess: true,
        apiCallsPerMonth: 25
      }
    }),
    getMonthKeyUtc: () => '2025-01',
    getResetAtUtc: () => '2025-02-01T00:00:00.000Z'
  };

  it('uses the usage row timestamp when tracking is available', async () => {
    const updatedAt = 1_700_000_000_000;
    const response = await getUsageStatus(
      { request: new Request('https://example.com/api/usage'), env: { DB: {} } },
      {
        ...baseDeps,
        getUserFromRequest: async () => ({
          id: 'user-123',
          auth_provider: 'session',
          subscription_tier: 'plus',
          subscription_status: 'active'
        }),
        getUsageRow: async () => ({
          readings_count: 2,
          tts_count: 1,
          api_calls_count: 0,
          updated_at: updatedAt
        })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.updatedAt, new Date(updatedAt).toISOString());
    assert.equal(body.trackingAvailable, true);
  });

  it('omits updatedAt when tracking is unavailable', async () => {
    const response = await getUsageStatus(
      { request: new Request('https://example.com/api/usage'), env: { DB: {} } },
      {
        ...baseDeps,
        getUserFromRequest: async () => ({
          id: 'user-123',
          auth_provider: 'session',
          subscription_tier: 'free',
          subscription_status: 'active'
        }),
        getUsageRow: async () => {
          throw new Error('no such table usage_tracking');
        }
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.trackingAvailable, false);
    assert.equal(body.updatedAt, null);
  });
});

describe('archetype journey preferences and reset', () => {
  it('returns preferences without hitting analytics queries', async () => {
    const db = createMockDb({ prefsRow: { archetype_journey_enabled: 1, show_badges: 0 } });
    const response = await archetypeJourney(
      { request: new Request('https://example.com/api/archetype-journey/preferences'), env: { DB: db } },
      { getUserFromRequest: async () => ({ id: 'user-1', auth_provider: 'session' }) }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.preferences.archetype_journey_enabled, true);
    assert.equal(body.preferences.show_badges, false);
    assert.equal(db.calls[0].query.includes('FROM user_analytics_prefs'), true);
  });

  it('resets analytics data and clears related tables', async () => {
    const db = createMockDb();
    const response = await archetypeJourney(
      { request: new Request('https://example.com/api/archetype-journey/reset', { method: 'POST' }), env: { DB: db } },
      { getUserFromRequest: async () => ({ id: 'user-1', auth_provider: 'session' }) }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    const deleteTables = db.calls
      .filter((call) => call.query.startsWith('DELETE FROM'))
      .map((call) => call.query.trim());
    assert.equal(deleteTables.includes('DELETE FROM card_appearances WHERE user_id = ?'), true);
    assert.equal(deleteTables.includes('DELETE FROM archetype_badges WHERE user_id = ?'), true);
  });
});
