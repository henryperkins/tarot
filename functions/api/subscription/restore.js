/**
 * Restore Purchases Endpoint
 * POST /api/subscription/restore
 *
 * Re-syncs subscription status from Stripe for authenticated users.
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { jsonResponse } from '../../lib/utils.js';
import { stripeRequest } from '../../lib/stripe.js';

function mapStripeStatus(stripeStatus) {
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

function extractTierFromSubscription(subscription) {
  if (subscription?.metadata?.tier) {
    return subscription.metadata.tier;
  }

  const item = subscription?.items?.data?.[0];
  const lookupKey = item?.price?.lookup_key;
  if (lookupKey) {
    if (lookupKey.includes('pro')) return 'pro';
    if (lookupKey.includes('plus')) return 'plus';
  }

  if (item?.price?.metadata?.tier) {
    return item.price.metadata.tier;
  }

  const amount = item?.price?.unit_amount;
  if (amount) {
    if (amount >= 1500) return 'pro';
    if (amount >= 500) return 'plus';
  }

  return 'plus';
}

async function fetchLatestStripeSubscription(customerId, secretKey) {
  if (!customerId || !secretKey) return null;
  const response = await stripeRequest(
    `/subscriptions?customer=${customerId}&status=all&limit=1`,
    'GET',
    null,
    secretKey
  );
  return response?.data?.[0] || null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return jsonResponse({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.auth_provider === 'api_key') {
      return jsonResponse({ error: 'Session authentication required' }, { status: 401 });
    }

    if (!env.STRIPE_SECRET_KEY) {
      return jsonResponse({ error: 'Payment system not configured' }, { status: 500 });
    }

    if (!user.stripe_customer_id) {
      return jsonResponse({ error: 'No Stripe customer found for this account' }, { status: 400 });
    }

    const subscription = await fetchLatestStripeSubscription(user.stripe_customer_id, env.STRIPE_SECRET_KEY);

    if (!subscription) {
      return jsonResponse({ error: 'No subscription found to restore' }, { status: 404 });
    }

    const tier = extractTierFromSubscription(subscription);
    const status = mapStripeStatus(subscription.status);
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      UPDATE users
      SET subscription_tier = ?,
          subscription_status = ?,
          subscription_provider = 'stripe',
          updated_at = ?
      WHERE id = ?
    `).bind(tier, status, now, user.id).run();

    return jsonResponse({
      restored: true,
      subscription: {
        tier,
        status,
        provider: 'stripe'
      }
    });
  } catch (error) {
    console.error(`[${requestId}] [subscription] Restore error:`, error);
    return jsonResponse({ error: 'Failed to restore purchases' }, { status: 500 });
  }
}
