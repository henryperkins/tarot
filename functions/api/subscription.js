/**
 * Subscription Details Endpoint
 * GET /api/subscription
 *
 * Returns subscription metadata for the authenticated user, including
 * Stripe renewal info when available.
 */

import { getUserFromRequest } from '../lib/auth.js';
import { jsonResponse } from '../lib/utils.js';
import {
  mapStripeStatus,
  extractTierFromSubscription,
  fetchLatestStripeSubscription
} from '../lib/stripe.js';

function getStripeDates(subscription) {
  const toMs = (value) => (value ? value * 1000 : null);
  return {
    currentPeriodEnd: toMs(subscription?.current_period_end),
    trialEnd: toMs(subscription?.trial_end),
    cancelAt: toMs(subscription?.cancel_at),
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end)
  };
}

export async function onRequestGet(context) {
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

    const base = {
      tier: user.subscription_tier || 'free',
      status: user.subscription_status || 'inactive',
      provider: user.subscription_provider || null
    };

    let stripeDetails = null;
    if ((base.provider === 'stripe' || user.stripe_customer_id) && env.STRIPE_SECRET_KEY) {
      const subscription = await fetchLatestStripeSubscription(user.stripe_customer_id, env.STRIPE_SECRET_KEY);
      if (subscription) {
        stripeDetails = {
          status: mapStripeStatus(subscription.status),
          tier: extractTierFromSubscription(subscription),
          ...getStripeDates(subscription)
        };
      }
    }

    return jsonResponse({
      subscription: {
        ...base,
        stripe: stripeDetails
      }
    });
  } catch (error) {
    console.error(`[${requestId}] [subscription] Error:`, error);
    return jsonResponse({ error: 'Failed to load subscription details' }, { status: 500 });
  }
}
