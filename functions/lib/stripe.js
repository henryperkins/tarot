/**
 * Centralized Stripe REST API utilities
 *
 * Stripe SDK is not available in Cloudflare Workers by default.
 * We use the Stripe REST API directly for compatibility.
 */

import { SUBSCRIPTION_TIERS } from '../../shared/monetization/subscription.js';

const DEFAULT_PRICE_THRESHOLDS = {
  monthly: { plus: 500, pro: 1500 },
  annual: { plus: 5000, pro: 15000 }
};

function toCents(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric * 100);
}

const PRICE_THRESHOLDS = {
  monthly: {
    plus: toCents(SUBSCRIPTION_TIERS?.plus?.price, DEFAULT_PRICE_THRESHOLDS.monthly.plus),
    pro: toCents(SUBSCRIPTION_TIERS?.pro?.price, DEFAULT_PRICE_THRESHOLDS.monthly.pro)
  },
  annual: {
    plus: toCents(SUBSCRIPTION_TIERS?.plus?.annual, DEFAULT_PRICE_THRESHOLDS.annual.plus),
    pro: toCents(SUBSCRIPTION_TIERS?.pro?.annual, DEFAULT_PRICE_THRESHOLDS.annual.pro)
  }
};

export const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * Make a request to the Stripe API
 *
 * @param {string} endpoint - API endpoint (e.g., '/customers', '/checkout/sessions')
 * @param {string} method - HTTP method
 * @param {Record<string, string> | null} body - Request body as key-value pairs
 * @param {string} secretKey - Stripe secret key
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If the API returns an error response
 */
export async function stripeRequest(endpoint, method, body, secretKey) {
  const response = await fetch(`${STRIPE_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Stripe API error');
  }

  return data;
}

/**
 * Map Stripe subscription status to internal status.
 * Used by webhook handler, subscription endpoint, and restore endpoint.
 *
 * @param {string} stripeStatus - Stripe subscription status
 * @returns {string} Internal status
 */
export function mapStripeStatus(stripeStatus) {
  const statusMap = {
    'active': 'active',
    'trialing': 'trialing',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'unpaid',
    'incomplete': 'incomplete',
    'incomplete_expired': 'expired',
    'paused': 'paused'
  };
  return statusMap[stripeStatus] || 'inactive';
}

/**
 * Select the most relevant subscription from a list.
 * Prefers active/trialing/past_due subscriptions, otherwise falls back to latest.
 *
 * @param {Array<object>} subscriptions
 * @returns {object|null}
 */
export function selectStripeSubscription(subscriptions) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) return null;

  const active = subscriptions.find(sub =>
    sub && ['active', 'trialing', 'past_due'].includes(sub.status)
  );

  return active || subscriptions[0] || null;
}

/**
 * Extract tier from Stripe subscription object.
 * Checks multiple sources in order of preference:
 * 1. price.lookup_key (containing 'pro' or 'plus', handles monthly/annual)
 * 2. price.metadata.tier
 * 3. price.unit_amount (handles both monthly and annual pricing, uses config thresholds)
 * 4. subscription.metadata.tier (legacy fallback, may be stale after portal changes)
 *
 * @param {object} subscription - Stripe subscription object
 * @returns {string|null} Tier ('pro', 'plus') or null if undetermined
 */
export function extractTierFromSubscription(subscription) {
  // Check price lookup_key (handles: plus_monthly, plus_annual, pro_monthly, pro_annual)
  const item = subscription?.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key;
  if (lookupKey) {
    if (lookupKey.includes('pro')) return 'pro';
    if (lookupKey.includes('plus')) return 'plus';
  }

  // Check price metadata
  if (item?.price?.metadata?.tier) {
    return item.price.metadata.tier;
  }

  // Fallback: derive from price amount (handles monthly and annual)
  const amount = item?.price?.unit_amount;
  const interval = item?.price?.recurring?.interval;
  if (amount) {
    if (interval === 'year') {
      // Annual: fall back to configured thresholds
      if (amount >= PRICE_THRESHOLDS.annual.pro) return 'pro';
      if (amount >= PRICE_THRESHOLDS.annual.plus) return 'plus';
    } else {
      // Monthly: fall back to configured thresholds
      if (amount >= PRICE_THRESHOLDS.monthly.pro) return 'pro';
      if (amount >= PRICE_THRESHOLDS.monthly.plus) return 'plus';
    }
  }

  // Legacy fallback: subscription metadata (may be stale after portal changes)
  if (subscription?.metadata?.tier) {
    return subscription.metadata.tier;
  }

  return null;
}

/**
 * Fetch the most relevant subscription for a Stripe customer.
 * Prefers active subscriptions, otherwise returns the most recent.
 *
 * @param {string} customerId - Stripe customer ID
 * @param {string} secretKey - Stripe secret key
 * @returns {Promise<object|null>} Subscription object or null
 */
export async function fetchLatestStripeSubscription(customerId, secretKey) {
  if (!customerId || !secretKey) return null;
  const response = await stripeRequest(
    `/subscriptions?customer=${customerId}&status=all&limit=10`,
    'GET',
    null,
    secretKey
  );
  return selectStripeSubscription(response?.data || []);
}
