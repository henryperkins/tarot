/**
 * Usage Status Endpoint
 * GET /api/usage
 *
 * Returns current-month usage counters for account UI.
 * Phase 1 enforces readings via D1; other counters may be added later.
 */

import { getUserFromRequest } from '../lib/auth.js';
import { jsonResponse } from '../lib/utils.js';
import { enforceApiCallLimit } from '../lib/apiUsage.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { getMonthKeyUtc, getResetAtUtc, getUsageRow } from '../lib/usageTracking.js';

const defaultDeps = {
  getUserFromRequest,
  jsonResponse,
  enforceApiCallLimit,
  getSubscriptionContext,
  getMonthKeyUtc,
  getResetAtUtc,
  getUsageRow
};

export async function onRequestGet(context, deps = defaultDeps) {
  const { request, env } = context;
  const {
    getUserFromRequest: getUser,
    jsonResponse: toJson,
    enforceApiCallLimit: enforceLimit,
    getSubscriptionContext: getContext,
    getMonthKeyUtc: getMonthKey,
    getResetAtUtc: getResetAt,
    getUsageRow: loadUsageRow
  } = deps;
  const requestId = crypto.randomUUID();

  try {
    const user = await getUser(request, env);
    if (!user) {
      return toJson({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.auth_provider === 'api_key') {
      const apiLimit = await enforceLimit(env, user);
      if (!apiLimit.allowed) {
        return toJson(apiLimit.payload, { status: apiLimit.status });
      }
    }

    const month = getMonthKey();
    const resetAt = getResetAt();
    const subscription = getContext(user);
    const tier = subscription.tier;
    const effectiveTier = subscription.effectiveTier;
    const status = subscription.status;
    const config = subscription.config;

    let readingsUsed = 0;
    let ttsUsed = 0;
    let apiCallsUsed = 0;
    let updatedAt = null;
    let trackingAvailable = true;

    try {
      const row = await loadUsageRow(env.DB, user.id, month);
      readingsUsed = row?.readings_count || 0;
      ttsUsed = row?.tts_count || 0;
      apiCallsUsed = row?.api_calls_count || 0;
      updatedAt = row?.updated_at || row?.created_at || null;
    } catch (error) {
      if (error.message?.includes('no such table')) {
        trackingAvailable = false;
      } else {
        console.warn(`[${requestId}] [usage] Lookup failed:`, error.message);
        trackingAvailable = false;
      }
      readingsUsed = 0;
      ttsUsed = 0;
      apiCallsUsed = 0;
      updatedAt = null;
    }

    const readingsLimit = config.monthlyReadings;
    const ttsLimit = config.monthlyTTS;
    const apiCallsLimit = config.apiAccess ? (config.apiCallsPerMonth || 0) : null;

    const readingsUnlimited = readingsLimit === Infinity;
    const readingsRemaining = readingsUnlimited ? null : Math.max(0, readingsLimit - readingsUsed);

    const ttsUnlimited = ttsLimit === Infinity;
    const ttsRemaining = ttsUnlimited ? null : Math.max(0, ttsLimit - ttsUsed);

    const apiCallsUnlimited = apiCallsLimit === Infinity;
    const apiCallsRemaining =
      apiCallsLimit === null ? null : Math.max(0, apiCallsLimit - apiCallsUsed);
    const updatedAtIso = trackingAvailable && updatedAt
      ? new Date(updatedAt).toISOString()
      : null;

    return toJson({
      month,
      resetAt,
      updatedAt: updatedAtIso,
      tier,
      status,
      effectiveTier,
      trackingAvailable,
      readings: {
        used: readingsUsed,
        limit: readingsUnlimited ? null : readingsLimit,
        remaining: readingsRemaining,
        unlimited: readingsUnlimited,
        source: trackingAvailable ? 'd1' : null
      },
      tts: {
        used: ttsUsed,
        limit: ttsUnlimited ? null : ttsLimit,
        remaining: ttsRemaining,
        unlimited: ttsUnlimited,
        source: trackingAvailable ? 'd1' : null
      },
      apiCalls: {
        enabled: config.apiAccess === true,
        used: apiCallsUsed,
        limit: apiCallsLimit,
        remaining: apiCallsRemaining,
        unlimited: apiCallsUnlimited,
        source: trackingAvailable ? 'd1' : null
      }
    });
  } catch (error) {
    console.error(`[${requestId}] [usage] Endpoint error:`, error);
    return toJson(
      { error: 'Failed to load usage status' },
      { status: 500 }
    );
  }
}
