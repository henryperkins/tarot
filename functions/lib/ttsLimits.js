import { getTierConfig } from '../../shared/monetization/subscription.js';
import { getClientIdentifier } from './clientId.js';
import { resolveEnv } from './environment.js';
import {
  getMonthKeyUtc,
  getResetAtUtc,
  getUsageRow,
  incrementUsageCounter
} from './usageTracking.js';

const DEFAULT_RATE_LIMIT_MAX = 30;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const TTS_RATE_LIMIT_KEY_PREFIX = 'tts-rate';
const TTS_MONTHLY_KEY_PREFIX = 'tts-monthly';

export function getTtsLimits(tier) {
  const config = getTierConfig(tier);
  return {
    monthly: config.monthlyTTS,
    premium: tier === 'plus' || tier === 'pro'
  };
}

export async function enforceTtsRateLimit(
  env,
  request,
  user,
  ttsLimits = { monthly: 3, premium: false },
  requestId = 'unknown'
) {
  try {
    const store = env?.RATELIMIT;
    
    // Short-term rate limit (requests per minute)
    // Uses optimistic locking with verification to mitigate race conditions
    if (store) {
      const maxRequests = Number(resolveEnv(env, 'TTS_RATE_LIMIT_MAX')) || DEFAULT_RATE_LIMIT_MAX;
      const windowSeconds = Number(resolveEnv(env, 'TTS_RATE_LIMIT_WINDOW')) || DEFAULT_RATE_LIMIT_WINDOW_SECONDS;
      const now = Date.now();
      const windowBucket = Math.floor(now / (windowSeconds * 1000));
      const clientId = getClientIdentifier(request);
      const rateLimitKey = `${TTS_RATE_LIMIT_KEY_PREFIX}:${clientId}:${windowBucket}`;

      const existing = await store.get(rateLimitKey);
      const currentCount = existing ? Number(existing) || 0 : 0;

      if (currentCount >= maxRequests) {
        const windowBoundary = (windowBucket + 1) * windowSeconds * 1000;
        const retryAfter = Math.max(1, Math.ceil((windowBoundary - now) / 1000));
        return { limited: true, retryAfter };
      }

      const nextCount = currentCount + 1;
      await store.put(rateLimitKey, String(nextCount), {
        expirationTtl: windowSeconds
      });

      // Verify to detect race conditions - if count is higher than expected,
      // a concurrent request also incremented; re-check limit
      const verified = await store.get(rateLimitKey);
      const verifiedCount = verified ? Number(verified) || 0 : 0;
      if (verifiedCount > nextCount && verifiedCount > maxRequests) {
        const windowBoundary = (windowBucket + 1) * windowSeconds * 1000;
        const retryAfter = Math.max(1, Math.ceil((windowBoundary - now) / 1000));
        console.log(`[${requestId}] [tts] Rate limit race detected: ${verifiedCount}/${maxRequests}`);
        return { limited: true, retryAfter };
      }
    }

    // Monthly tier-based limit (prefer D1 per-user counters; fall back to KV per IP).
    const now = new Date();
    const monthKey = getMonthKeyUtc(now);
    const resetAt = getResetAtUtc(now);

    if (user?.id && env?.DB) {
      try {
        const nowMs = Date.now();

        if (ttsLimits.monthly === Infinity) {
          await incrementUsageCounter(env.DB, {
            userId: user.id,
            month: monthKey,
            counter: 'tts',
            nowMs
          });
          return { limited: false };
        }

        const incrementResult = await incrementUsageCounter(env.DB, {
          userId: user.id,
          month: monthKey,
          counter: 'tts',
          limit: ttsLimits.monthly,
          nowMs
        });

        if (incrementResult.changed === 0) {
          const row = await getUsageRow(env.DB, user.id, monthKey);
          const used = row?.tts_count || ttsLimits.monthly;
          const retryAfter = Math.max(1, Math.ceil((Date.parse(resetAt) - now.getTime()) / 1000));
          return {
            limited: true,
            tierLimited: true,
            retryAfter,
            used,
            limit: ttsLimits.monthly,
            resetAt
          };
        }

        return { limited: false };
      } catch (error) {
        // If usage tracking isn't available yet (missing migration), fall back to KV.
        if (!String(error?.message || '').includes('no such table')) {
          throw error;
        }
      }
    }

    // Monthly KV fallback with optimistic locking
    if (store && ttsLimits.monthly !== Infinity) {
      const clientId = getClientIdentifier(request);
      const monthlyKey = `${TTS_MONTHLY_KEY_PREFIX}:${clientId}:${monthKey}`;

      const monthlyCount = await store.get(monthlyKey);
      const currentMonthlyCount = monthlyCount ? Number(monthlyCount) || 0 : 0;

      if (currentMonthlyCount >= ttsLimits.monthly) {
        const retryAfter = Math.max(1, Math.ceil((Date.parse(resetAt) - now.getTime()) / 1000));
        return {
          limited: true,
          tierLimited: true,
          retryAfter,
          used: currentMonthlyCount,
          limit: ttsLimits.monthly,
          resetAt
        };
      }

      const nextCount = currentMonthlyCount + 1;
      await store.put(monthlyKey, String(nextCount), {
        expirationTtl: 35 * 24 * 60 * 60
      });

      // Verify to detect race conditions
      const verified = await store.get(monthlyKey);
      const verifiedCount = verified ? Number(verified) || 0 : 0;
      if (verifiedCount > nextCount && verifiedCount > ttsLimits.monthly) {
        const retryAfter = Math.max(1, Math.ceil((Date.parse(resetAt) - now.getTime()) / 1000));
        console.log(`[${requestId}] [tts] Monthly limit race detected: ${verifiedCount}/${ttsLimits.monthly}`);
        return {
          limited: true,
          tierLimited: true,
          retryAfter,
          used: verifiedCount,
          limit: ttsLimits.monthly,
          resetAt
        };
      }
    }

    return { limited: false };
  } catch (error) {
    console.warn(`[${requestId}] [tts] Rate limit check failed, allowing request:`, error);
    return { limited: false };
  }
}
