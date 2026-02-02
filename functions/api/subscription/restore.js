/**
 * Restore Purchases Endpoint
 * POST /api/subscription/restore
 *
 * Re-syncs subscription status from Stripe for authenticated users.
 * 
 * Rate limited to prevent Stripe API abuse (max 5 requests per minute per user).
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { jsonResponse } from '../../lib/utils.js';
import {
  mapStripeStatus,
  extractTierFromSubscription,
  fetchLatestStripeSubscription
} from '../../lib/stripe.js';
import { getClientIdentifier } from '../../lib/clientId.js';

const RESTORE_RATE_LIMIT_KEY_PREFIX = 'restore-rate';
const RESTORE_RATE_LIMIT_MAX = 5;
const RESTORE_RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * Check and enforce rate limit for restore requests.
 * Uses user ID if authenticated, falls back to client IP.
 */
async function checkRestoreRateLimit(env, request, user, requestId) {
  const store = env?.RATELIMIT;
  if (!store) {
    return { limited: false };
  }

  try {
    const now = Date.now();
    const windowBucket = Math.floor(now / (RESTORE_RATE_LIMIT_WINDOW_SECONDS * 1000));
    // Prefer user ID for rate limiting, fall back to IP
    const identifier = user?.id || getClientIdentifier(request);
    const rateLimitKey = `${RESTORE_RATE_LIMIT_KEY_PREFIX}:${identifier}:${windowBucket}`;

    const existing = await store.get(rateLimitKey);
    const currentCount = existing ? Number(existing) || 0 : 0;

    if (currentCount >= RESTORE_RATE_LIMIT_MAX) {
      const windowBoundary = (windowBucket + 1) * RESTORE_RATE_LIMIT_WINDOW_SECONDS * 1000;
      const retryAfter = Math.max(1, Math.ceil((windowBoundary - now) / 1000));
      return { limited: true, retryAfter };
    }

    const nextCount = currentCount + 1;
    await store.put(rateLimitKey, String(nextCount), {
      expirationTtl: RESTORE_RATE_LIMIT_WINDOW_SECONDS
    });

    return { limited: false };
  } catch (error) {
    // If rate limiting fails, allow the request but log
    console.warn(`[${requestId}] [subscription] Rate limit check failed, allowing request:`, error);
    return { limited: false };
  }
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

    // Rate limit check to prevent Stripe API abuse
    const rateLimit = await checkRestoreRateLimit(env, request, user, requestId);
    if (rateLimit.limited) {
      return jsonResponse(
        {
          error: 'Too many restore requests. Please wait before trying again.',
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter)
          }
        }
      );
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
