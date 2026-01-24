/**
 * Reading Limit Enforcement
 *
 * Handles monthly reading quota tracking for both authenticated and anonymous users.
 * Supports D1 database tracking (preferred) with KV fallback for anonymous users.
 *
 * Extracted from tarot-reading.js to maintain <900 line limit.
 */

import {
  decrementUsageCounter,
  getMonthKeyUtc,
  getResetAtUtc,
  getUsageRow,
  incrementUsageCounter
} from './usageTracking.js';
import { getHashedClientIdentifier } from './clientId.js';

// ============================================================================
// Constants
// ============================================================================

const READINGS_MONTHLY_KEY_PREFIX = 'readings-monthly';
// 35 days TTL: slightly longer than a month to handle timezone edge cases
// and ensure the counter persists through the full billing period
const READINGS_MONTHLY_TTL_SECONDS = 35 * 24 * 60 * 60;

// ============================================================================
// Reservation Release
// ============================================================================

/**
 * Release a reading reservation (used on error paths to refund quota).
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object|null} reservation - Reservation object from enforceReadingLimit
 */
export async function releaseReadingReservation(env, reservation) {
  if (!reservation) return;

  try {
    if (reservation.type === 'd1') {
      await decrementUsageCounter(env.DB, {
        userId: reservation.userId,
        month: reservation.month,
        counter: 'readings',
        nowMs: Date.now()
      });
      return;
    }

    if (reservation.type === 'kv') {
      const store = env?.RATELIMIT;
      if (!store) return;

      // Best-effort decrement with verification
      // Note: KV doesn't support atomic decrement, so there's a small race window
      const existing = await store.get(reservation.key);
      const currentCount = existing ? Number(existing) || 0 : 0;
      const next = Math.max(0, currentCount - 1);

      await store.put(reservation.key, String(next), {
        expirationTtl: READINGS_MONTHLY_TTL_SECONDS
      });

      // Verify the decrement succeeded (detect concurrent modifications)
      const verified = await store.get(reservation.key);
      const verifiedCount = verified ? Number(verified) || 0 : 0;
      if (verifiedCount !== next && verifiedCount !== next - 1) {
        // Concurrent modification detected, but decrement is best-effort
        // so we just log and continue
        console.log(`[releaseReadingReservation] KV concurrent modification: expected ${next}, got ${verifiedCount}`);
      }
    }
  } catch (error) {
    console.warn('Failed to release reading reservation:', error?.message || error);
  }
}

// ============================================================================
// Limit Enforcement
// ============================================================================

/**
 * Enforce monthly reading limits.
 *
 * Returns an object with:
 * - allowed: boolean - whether the request should proceed
 * - used: number - current usage count
 * - limit: number|null - monthly limit (null for unlimited)
 * - resetAt: string - ISO timestamp when the limit resets
 * - reservation: object|null - reservation to release on error
 * - message: string|undefined - error message when not allowed
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Request} request - Incoming request (for client identification)
 * @param {Object|null} user - Authenticated user object
 * @param {Object} subscription - Subscription context with config
 * @param {string} requestId - Request ID for logging
 * @returns {Promise<Object>} Limit enforcement result
 */
export async function enforceReadingLimit(env, request, user, subscription, requestId) {
  const limit = subscription?.config?.monthlyReadings ?? 5;
  const now = new Date();
  const month = getMonthKeyUtc(now);
  const resetAt = getResetAtUtc(now);

  // Hash client identifier for privacy - prevents raw IP storage in D1
  // The hash is consistent per IP, so rate limiting still works correctly
  const clientId = await getHashedClientIdentifier(request);

  // Authenticated users: use D1 tracking (also tracks unlimited tiers for usage meter).
  if (user?.id && env?.DB) {
    try {
      const nowMs = Date.now();

      if (limit === Infinity) {
        await incrementUsageCounter(env.DB, {
          userId: user.id,
          month,
          counter: 'readings',
          nowMs
        });
        const row = await getUsageRow(env.DB, user.id, month);
        return {
          allowed: true,
          used: row?.readings_count || 0,
          limit: null,
          resetAt,
          reservation: { type: 'd1', userId: user.id, month }
        };
      }

      const incrementResult = await incrementUsageCounter(env.DB, {
        userId: user.id,
        month,
        counter: 'readings',
        limit,
        nowMs
      });

      if (incrementResult.changed === 0) {
        const row = await getUsageRow(env.DB, user.id, month);
        const used = row?.readings_count || limit;
        return {
          allowed: false,
          used,
          limit,
          resetAt,
          message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`
        };
      }

      const row = await getUsageRow(env.DB, user.id, month);
      const used = row?.readings_count || 0;
      console.log(`[${requestId}] Reading usage: ${used}/${limit} (${subscription?.effectiveTier || subscription?.tier || 'free'})`);

      return {
        allowed: true,
        used,
        limit,
        resetAt,
        reservation: { type: 'd1', userId: user.id, month }
      };
    } catch (error) {
      console.error(`[${requestId}] Usage tracking error (allowing request):`, error.message);
      return { allowed: true, used: 0, limit: limit === Infinity ? null : limit, resetAt };
    }
  }

  // Anonymous users: prefer D1 for atomic increments when available
  if (!user?.id && env?.DB && limit !== Infinity) {
    try {
      const guestUserId = `guest:${clientId}`;
      const nowMs = Date.now();
      const incrementResult = await incrementUsageCounter(env.DB, {
        userId: guestUserId,
        month,
        counter: 'readings',
        limit,
        nowMs
      });

      if (incrementResult.changed === 0) {
        const row = await getUsageRow(env.DB, guestUserId, month);
        const used = row?.readings_count || limit;
        return {
          allowed: false,
          used,
          limit,
          resetAt,
          message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`
        };
      }

      const row = await getUsageRow(env.DB, guestUserId, month);
      const used = row?.readings_count || 0;
      console.log(`[${requestId}] Guest reading usage: ${used}/${limit}`);

      return {
        allowed: true,
        used,
        limit,
        resetAt,
        reservation: { type: 'd1', userId: guestUserId, month }
      };
    } catch (error) {
      console.warn(`[${requestId}] Guest usage tracking error (DB), falling back to KV:`, error?.message || error);
    }
  }

  // Anonymous users: enforce IP-based monthly quota in KV when available.
  // Uses optimistic locking with retry to mitigate race conditions.
  if (limit !== Infinity && env?.RATELIMIT) {
    const key = `${READINGS_MONTHLY_KEY_PREFIX}:${clientId}:${month}`;
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const existing = await env.RATELIMIT.get(key);
        const currentCount = existing ? Number(existing) || 0 : 0;

        if (currentCount >= limit) {
          return {
            allowed: false,
            used: currentCount,
            limit,
            resetAt,
            message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`
          };
        }

        const nextCount = currentCount + 1;
        await env.RATELIMIT.put(key, String(nextCount), {
          expirationTtl: READINGS_MONTHLY_TTL_SECONDS
        });

        // Verify the write to detect race conditions
        const verifyCount = await env.RATELIMIT.get(key);
        const verifiedValue = verifyCount ? Number(verifyCount) || 0 : 0;

        // If verified value is higher than expected, a concurrent request incremented it
        // In this case, re-check if we're now over the limit
        if (verifiedValue > nextCount) {
          if (verifiedValue > limit) {
            // Race detected and we're now over limit - deny this request
            console.warn(`[${requestId}] KV race detected (attempt ${attempt + 1}): expected ${nextCount}, got ${verifiedValue}`);
            return {
              allowed: false,
              used: verifiedValue,
              limit,
              resetAt,
              message: `You've reached your monthly reading limit (${limit}). Upgrade for more readings.`
            };
          }
          // Race detected but still under limit - our increment was still valid
          console.log(`[${requestId}] KV concurrent increment detected (attempt ${attempt + 1}): ${verifiedValue}/${limit}`);
        }

        return {
          allowed: true,
          used: verifiedValue,
          limit,
          resetAt,
          reservation: { type: 'kv', key }
        };
      } catch (error) {
        if (attempt === MAX_RETRIES - 1) {
          console.warn(`[${requestId}] Guest usage tracking failed after ${MAX_RETRIES} attempts, allowing request:`, error?.message || error);
        }
      }
    }
  }

  return { allowed: true, used: 0, limit: limit === Infinity ? null : limit, resetAt };
}
