import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestPost as createCheckoutSession } from '../functions/api/create-checkout-session.js';

const jsonResponse = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });

const baseDeps = {
  getUserFromRequest: async () => null,
  jsonResponse,
  readJsonBody: async () => ({}),
  sanitizeRedirectUrl: (value, _request, _env, fallbackPath) => value || `https://example.com${fallbackPath}`,
  stripeRequest: async () => ({}),
  fetchLatestStripeSubscription: async () => null,
  mapStripeStatus: (status) => status,
  extractTierFromSubscription: () => null,
  getTierConfig: () => ({ trialDays: 0 }),
  isActiveStatus: (status) => ['active', 'trialing', 'past_due'].includes(status)
};

test('routes active Stripe customers to the billing portal', async () => {
  const calls = [];
  const deps = {
    ...baseDeps,
    getUserFromRequest: async () => ({
      id: 'user-1',
      auth_provider: 'session',
      stripe_customer_id: 'cus_123',
      subscription_tier: 'plus',
      subscription_status: 'active',
      subscription_provider: 'stripe'
    }),
    readJsonBody: async () => ({
      tier: 'pro',
      interval: 'monthly',
      cancelUrl: 'https://example.com/pricing'
    }),
    fetchLatestStripeSubscription: async () => ({
      status: 'active',
      items: { data: [] }
    }),
    extractTierFromSubscription: () => 'plus',
    stripeRequest: async (endpoint, method, body) => {
      calls.push({ endpoint, method, body });
      return { url: `https://stripe.test${endpoint}` };
    }
  };

  const response = await createCheckoutSession(
    {
      request: new Request('https://example.com/api/create-checkout-session', { method: 'POST' }),
      env: { STRIPE_SECRET_KEY: 'sk_test' }
    },
    deps
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.flow, 'portal');
  assert.equal(payload.url, 'https://stripe.test/billing_portal/sessions');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, '/billing_portal/sessions');
});

test('creates checkout sessions with trial days when configured', async () => {
  const calls = [];
  const deps = {
    ...baseDeps,
    getUserFromRequest: async () => ({
      id: 'user-2',
      auth_provider: 'session',
      stripe_customer_id: 'cus_456',
      subscription_tier: 'free',
      subscription_status: 'inactive',
      subscription_provider: 'stripe'
    }),
    readJsonBody: async () => ({
      tier: 'plus',
      interval: 'monthly',
      successUrl: 'https://example.com/account?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://example.com/pricing'
    }),
    getTierConfig: () => ({ trialDays: 7 }),
    stripeRequest: async (endpoint, method, body) => {
      calls.push({ endpoint, method, body });
      if (endpoint === '/checkout/sessions') {
        return { id: 'cs_123', url: 'https://checkout.test/session' };
      }
      return { id: 'cus_456' };
    }
  };

  const response = await createCheckoutSession(
    {
      request: new Request('https://example.com/api/create-checkout-session', { method: 'POST' }),
      env: {
        STRIPE_SECRET_KEY: 'sk_test',
        STRIPE_PRICE_ID_PLUS: 'price_plus'
      }
    },
    deps
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.url, 'https://checkout.test/session');
  const checkoutCall = calls.find((call) => call.endpoint === '/checkout/sessions');
  assert.equal(checkoutCall.body['subscription_data[trial_period_days]'], '7');
});
