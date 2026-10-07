import { sha256Hex } from './crypto.js';
import { getSubscriptionContext } from './entitlements.js';

const DAILY_LIMITS = Object.freeze({
  vision: { free: 5, plus: 20, pro: 100 },
  question: { free: 0, plus: 30, pro: 100 },
  summary: { free: 0, plus: 3, pro: 10 }
});
const FEATURE_LABELS = { vision: 'Photo recognition', question: 'Question suggestions', summary: 'Journal summaries' };
// Longer than every supported task deadline. A lost Worker cannot hold the
// identity forever; its unknown outcome conservatively consumes a daily slot.
const ATTEMPT_WINDOW_MS = 60000;
const RETENTION_MS = 30 * 86400000;
const RESERVATION_TTL_MS = 15 * 60 * 1000;

function unavailable() {
  return { allowed: false, status: 503, payload: {
    error: 'This feature is temporarily unavailable. Please try again shortly.',
    code: 'feature_accounting_unavailable', retryable: true
  } };
}

export async function resolveFeatureIdentity(request, user) {
  if (user?.id) return `user:${String(user.id)}`;
  // Cloudflare overwrites this header at its edge. Never accept client-chosen
  // forwarded headers, body identifiers or user agents as quota identities.
  const ip = request?.headers?.get('CF-Connecting-IP')?.trim();
  if (!ip) throw new Error('Guest feature identity is unavailable.');
  return `guest:${await sha256Hex(`tableu-feature-guest:${ip}`)}`;
}

function dailyLimit(env, feature, tier) {
  const fallback = DAILY_LIMITS[feature]?.[tier];
  if (fallback === undefined) throw new Error('Unknown metered feature.');
  // Entitlements still govern free text access; an override cannot grant it.
  if (fallback === 0) return 0;
  const override = Number(env?.[`FEATURE_${feature.toUpperCase()}_${tier.toUpperCase()}_DAILY_LIMIT`]);
  return Number.isSafeInteger(override) && override > 0 ? override : fallback;
}

function attemptLimits(env, feature, tier, limit) {
  const prefix = `FEATURE_${feature.toUpperCase()}_${tier.toUpperCase()}`;
  const daily = Number(env?.[`${prefix}_DAILY_ATTEMPT_LIMIT`]);
  const minute = Number(env?.[`${prefix}_MINUTE_ATTEMPT_LIMIT`]);
  return {
    daily: Number.isSafeInteger(daily) && daily > 0 ? Math.max(limit, daily) : Math.min(Number.MAX_SAFE_INTEGER, limit * 3),
    minute: Number.isSafeInteger(minute) && minute > 0 ? minute : feature === 'vision' ? 5 : 10
  };
}

/**
 * Reserve one daily slot and one active operation in a single conditional SQL
 * INSERT. The partial unique index is a second defense against concurrent
 * operations. Storage errors never authorize expensive inference.
 */
export async function reserveFeatureUsage({ env, request, user = null, feature, nowMs = Date.now() }) {
  try {
    if (!env?.DB?.prepare) return unavailable();
    const tier = getSubscriptionContext(user).effectiveTier;
    const limit = dailyLimit(env, feature, tier);
    if (!limit) return { allowed: false, status: 403, payload: {
      error: 'This feature requires an active Plus or Pro subscription.', code: 'feature_tier_required'
    } };
    const attempts = attemptLimits(env, feature, tier, limit);
    const identity = await resolveFeatureIdentity(request, user);
    const dayKey = new Date(nowMs).toISOString().slice(0, 10);
    const resetAt = new Date(`${dayKey}T00:00:00.000Z`).getTime() + 86400000;
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      UPDATE feature_usage SET state = 'completed', settled_at = ?
      WHERE identity_key = ? AND feature = ? AND state = 'reserved' AND expires_at <= ?
    `).bind(nowMs, identity, feature, nowMs).run();
    // Bounded cleanup never removes an active lease or recent attempt evidence.
    await env.DB.prepare(`
      DELETE FROM feature_usage WHERE id IN (
        SELECT id FROM feature_usage WHERE identity_key = ? AND feature = ?
        AND state != 'reserved' AND created_at < ? LIMIT 100
      )
    `).bind(identity, feature, nowMs - RETENTION_MS).run();
    const result = await env.DB.prepare(`
      INSERT INTO feature_usage (id, identity_key, feature, day_key, state, created_at, expires_at)
      SELECT ?, ?, ?, ?, 'reserved', ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM feature_usage WHERE identity_key = ? AND feature = ? AND state = 'reserved'
      ) AND (
        SELECT COUNT(*) FROM feature_usage
        WHERE identity_key = ? AND feature = ? AND day_key = ? AND state IN ('reserved', 'completed')
      ) < ? AND (
        SELECT COUNT(*) FROM feature_usage WHERE identity_key = ? AND feature = ? AND day_key = ?
      ) < ? AND (
        SELECT COUNT(*) FROM feature_usage WHERE identity_key = ? AND feature = ? AND created_at > ?
      ) < ?
    `).bind(id, identity, feature, dayKey, nowMs, nowMs + RESERVATION_TTL_MS,
      identity, feature, identity, feature, dayKey, limit,
      identity, feature, dayKey, attempts.daily, identity, feature, nowMs - ATTEMPT_WINDOW_MS, attempts.minute).run();
    if (result?.meta?.changes === 1) return { allowed: true, reservationId: id };
    const active = await env.DB.prepare(`
      SELECT expires_at FROM feature_usage WHERE identity_key = ? AND feature = ? AND state = 'reserved'
    `).bind(identity, feature).first();
    if (active) return { allowed: false, status: 429, payload: {
      error: `${FEATURE_LABELS[feature]} is already in progress. Please wait for it to finish.`,
      code: 'feature_busy', retryable: true, limit, resetAt: new Date(active.expires_at).toISOString()
    } };
    const usage = await env.DB.prepare(`
      SELECT SUM(CASE WHEN day_key = ? AND state IN ('reserved', 'completed') THEN 1 ELSE 0 END) AS daily_usage,
        SUM(CASE WHEN day_key = ? THEN 1 ELSE 0 END) AS daily_attempts,
        COUNT(CASE WHEN created_at > ? THEN 1 END) AS minute_attempts,
        MIN(CASE WHEN created_at > ? THEN created_at END) AS oldest_minute_attempt
      FROM feature_usage WHERE identity_key = ? AND feature = ?
    `).bind(dayKey, dayKey, nowMs - ATTEMPT_WINDOW_MS, nowMs - ATTEMPT_WINDOW_MS, identity, feature).first();
    const dailyExhausted = usage?.daily_usage >= limit;
    const attemptsExhausted = usage?.daily_attempts >= attempts.daily;
    const code = dailyExhausted ? 'feature_daily_limit' : attemptsExhausted ? 'feature_attempt_daily_limit' : 'feature_attempt_rate_limit';
    const retryAt = dailyExhausted || attemptsExhausted ? resetAt : (usage?.oldest_minute_attempt ?? nowMs) + ATTEMPT_WINDOW_MS;
    return { allowed: false, status: 429, payload: {
      error: dailyExhausted ? `You've reached today's limit for ${FEATURE_LABELS[feature].toLowerCase()}. Please try again tomorrow.`
        : attemptsExhausted ? `Too many attempts for ${FEATURE_LABELS[feature].toLowerCase()} today. Please try again tomorrow.`
        : `Too many recent attempts for ${FEATURE_LABELS[feature].toLowerCase()}. Please wait before trying again.`,
      code, retryable: true, limit: dailyExhausted ? limit : attemptsExhausted ? attempts.daily : attempts.minute,
      resetAt: new Date(retryAt).toISOString(), retryAfter: Math.max(1, Math.ceil((retryAt - nowMs) / 1000))
    } };

  } catch {
    return unavailable();
  }
}

/** Completion and release are idempotent; a late failure cannot refund success. */
export async function settleFeatureUsage(env, reservationId, { completed }) {
  if (!reservationId) return true;
  try {
    // Refund the completed-operation allowance while retaining attempt evidence.
    const result = completed
      ? await env.DB.prepare(`
          UPDATE feature_usage SET state = 'completed', settled_at = ? WHERE id = ? AND state = 'reserved'
        `).bind(Date.now(), reservationId).run()
      : await env.DB.prepare(`
          UPDATE feature_usage SET state = 'released', settled_at = ? WHERE id = ? AND state = 'reserved'
        `).bind(Date.now(), reservationId).run();
    return result?.success !== false;
  } catch {
    // Keep the reservation rather than silently granting another expensive call.
    console.warn('[featureUsage] Unable to settle feature reservation.');
    return false;
  }
}

/** Read bytes incrementally so chunked uploads cannot bypass Content-Length. */
export async function readFeatureJsonBody(request, maxBytes) {
  const tooLarge = () => Object.assign(new Error('Request body exceeds the size limit.'), { status: 413 });
  const length = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > maxBytes) throw tooLarge();
  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON payload.'), { status: 400 }); }
}
