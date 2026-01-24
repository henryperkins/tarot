/**
 * Centralized Stripe REST API utilities
 *
 * Stripe SDK is not available in Cloudflare Workers by default.
 * We use the Stripe REST API directly for compatibility.
 */

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
 * Extract tier from Stripe subscription object.
 * Checks multiple sources in order of preference:
 * 1. subscription.metadata.tier
 * 2. price.lookup_key (containing 'pro' or 'plus', handles monthly/annual)
 * 3. price.metadata.tier
 * 4. price.unit_amount (handles both monthly and annual pricing)
 *
 * @param {object} subscription - Stripe subscription object
 * @returns {string|null} Tier ('pro', 'plus') or null if undetermined
 */
export function extractTierFromSubscription(subscription) {
  // Check subscription metadata first
  if (subscription?.metadata?.tier) {
    return subscription.metadata.tier;
  }

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
      // Annual: $199.99 = 19999 cents -> pro, $79.99 = 7999 cents -> plus
      if (amount >= 15000) return 'pro';
      if (amount >= 5000) return 'plus';
    } else {
      // Monthly: $19.99 = 1999 cents -> pro, $7.99 = 799 cents -> plus
      if (amount >= 1500) return 'pro';
      if (amount >= 500) return 'plus';
    }
  }

  return null;
}

/**
 * Fetch the latest subscription for a Stripe customer.
 *
 * @param {string} customerId - Stripe customer ID
 * @param {string} secretKey - Stripe secret key
 * @returns {Promise<object|null>} Subscription object or null
 */
export async function fetchLatestStripeSubscription(customerId, secretKey) {
  if (!customerId || !secretKey) return null;
  const response = await stripeRequest(
    `/subscriptions?customer=${customerId}&status=all&limit=1`,
    'GET',
    null,
    secretKey
  );
  return response?.data?.[0] || null;
}
