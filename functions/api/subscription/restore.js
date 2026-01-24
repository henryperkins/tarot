/**
 * Restore Purchases Endpoint
 * POST /api/subscription/restore
 *
 * Re-syncs subscription status from Stripe for authenticated users.
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { jsonResponse } from '../../lib/utils.js';
import {
  mapStripeStatus,
  extractTierFromSubscription,
  fetchLatestStripeSubscription
} from '../../lib/stripe.js';

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

    const tierFromStripe = extractTierFromSubscription(subscription);
    if (!tierFromStripe) {
      console.warn(`[${requestId}] [subscription] Could not determine tier from Stripe subscription ${subscription.id}, preserving current tier.`);
    }
    const tier = tierFromStripe || user.subscription_tier || 'free';
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
