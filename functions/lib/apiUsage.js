import { buildTierLimitedPayload, getSubscriptionContext, isEntitled } from './entitlements.js';
import { getMonthKeyUtc, getResetAtUtc, getUsageRow, incrementUsageCounter } from './usageTracking.js';

export async function enforceApiCallLimit(env, user) {
  if (!user || user.auth_provider !== 'api_key') {
    return { allowed: true };
  }

  if (!env?.DB) {
    return { allowed: true };
  }

  if (!isEntitled(user, 'pro')) {
    return {
      allowed: false,
      status: 403,
      payload: buildTierLimitedPayload({
        message: 'API access requires an active Pro subscription',
        user,
        requiredTier: 'pro'
      })
    };
  }

  const subscription = getSubscriptionContext(user);
  const limit = Number(subscription.config?.apiCallsPerMonth || 0);

  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      allowed: false,
      status: 403,
      payload: buildTierLimitedPayload({
        message: 'API access requires an active Pro subscription',
        user,
        requiredTier: 'pro'
      })
    };
  }

  const now = new Date();
  const month = getMonthKeyUtc(now);
  const resetAt = getResetAtUtc(now);
  const nowMs = Date.now();

  try {
    const incrementResult = await incrementUsageCounter(env.DB, {
      userId: user.id,
      month,
      counter: 'apiCalls',
      limit,
      nowMs
    });

    if (incrementResult.changed === 0) {
      const row = await getUsageRow(env.DB, user.id, month);
      const used = row?.api_calls_count || limit;

      return {
        allowed: false,
        status: 429,
        payload: {
          error: 'API call limit reached for this month',
          tierLimited: true,
          currentTier: subscription.tier,
          currentStatus: subscription.status,
          effectiveTier: subscription.effectiveTier,
          limit,
          used,
          resetAt
        }
      };
    }

    return { allowed: true };
  } catch (error) {
    if (String(error?.message || '').includes('no such table')) {
      return { allowed: true };
    }
    console.warn('API usage enforcement failed, allowing request:', error);
    return { allowed: true };
  }
}

