import { getTierConfig } from '../../shared/monetization/subscription.js';
import { sha256Hex } from './crypto.js';
import { getMonthKeyUtc, getResetAtUtc } from './usageTracking.js';

export const MAX_NARRATION_CHARS = 64000;
export const NARRATION_DEADLINE_MS = 120000;
const RESERVATION_LIFETIME_MS = NARRATION_DEADLINE_MS + 60000;

export function getTtsLimits(tier) {
  return { monthly: getTierConfig(tier).monthlyTTS, premium: tier === 'plus' || tier === 'pro' };
}

async function identityFor(request, user) {
  if (user?.id) return `user:${user.id}`;
  // Only trust the edge-supplied address. Forwarded headers are caller-controlled.
  const ip = request?.headers?.get('cf-connecting-ip') || 'local-anonymous';
  return `guest:${await sha256Hex(`narration-v1:${ip}`)}`;
}

function unavailable() {
  return { allowed: false, status: 503, payload: { error: 'Narration is temporarily unavailable. Please try again.', errorCode: 'ACCOUNTING_UNAVAILABLE', retryable: true } };
}

async function consumeAbuseLimit(db, identity, scope, max, windowSeconds = 60) {
  const now = Date.now();
  const windowKey = Math.floor(now / (windowSeconds * 1000));
  const row = await db.prepare(`
    INSERT INTO narration_request_limits (identity, scope, window_key, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(identity, scope, window_key) DO UPDATE SET count = count + 1 WHERE count < ?
    RETURNING count
  `).bind(identity, scope, windowKey, max).first();
  if (row) return { allowed: true };
  const retryAfter = Math.max(1, Math.ceil(((windowKey + 1) * windowSeconds * 1000 - now) / 1000));
  return { allowed: false, status: 429, retryAfter, payload: { error: 'Too many narration requests. Please wait a moment.', errorCode: 'RATE_LIMIT' } };
}

/** Reserve one complete narration; D1 constraints serialize quota/concurrency. */
export async function reserveNarration({ env, request, user, limits = getTtsLimits('free') }) {
  if (!env?.DB) return unavailable();
  const db = env.DB;
  const identity = await identityFor(request, user);
  const month = getMonthKeyUtc();
  const now = Date.now();
  try {
    const abuse = await consumeAbuseLimit(db, identity, 'narration', 30);
    if (!abuse.allowed) return abuse;
    // A crash lease outlives the synthesis deadline. Normal failures release
    // immediately; abandoned work cannot permanently consume the allowance.
    await db.prepare("UPDATE narration_requests SET state = 'released', updated_at = ? WHERE identity = ? AND state = 'reserved' AND expires_at <= ?").bind(now, identity, now).run();
    await db.prepare("DELETE FROM narration_requests WHERE identity = ? AND state != 'reserved' AND updated_at < ?").bind(identity, now - 90 * 86400000).run();
    await db.prepare('DELETE FROM narration_request_limits WHERE identity = ? AND window_key < ?').bind(identity, Math.floor(now / 60000) - 1).run();
    let seed = 0;
    if (user?.id) {
      const previous = await db.prepare('SELECT tts_count FROM usage_tracking WHERE user_id = ? AND month = ?').bind(user.id, month).first();
      seed = Number(previous?.tts_count) || 0;
    } else if (env.RATELIMIT) {
      // Preserve guest usage during rollout; only new keys use hashed identity.
      const legacyIp = request?.headers?.get('cf-connecting-ip') || 'anonymous';
      seed = Number(await env.RATELIMIT.get(`tts-monthly:${legacyIp}:${month}`)) || 0;
    }
    await db.prepare('INSERT OR IGNORE INTO narration_monthly_usage (identity, month, used) VALUES (?, ?, ?)').bind(identity, month, Math.max(0, seed)).run();
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO narration_requests (id, identity, user_id, month, monthly_limit, state, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?)`).bind(id, identity, user?.id || null, month, Number.isFinite(limits.monthly) ? limits.monthly : -1, now + RESERVATION_LIFETIME_MS, now).run();
    return { allowed: true, reservation: { id } };
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('narration_monthly_limit')) {
      const row = await db.prepare('SELECT used, reserved FROM narration_monthly_usage WHERE identity = ? AND month = ?').bind(identity, month).first().catch(() => null);
      return { allowed: false, status: 429, retryAfter: 60, payload: { error: 'Your monthly narration allowance is used up. View plans for more.', errorCode: 'TIER_LIMIT', tierLimited: true, used: row?.used ?? limits.monthly, limit: limits.monthly, resetAt: getResetAtUtc() } };
    }
    if (message.includes('narration_requests.identity')) {
      return { allowed: false, status: 409, retryAfter: 2, payload: { error: 'A narration is already being prepared. Please wait a moment.', errorCode: 'NARRATION_BUSY', retryable: true } };
    }
    return unavailable();
  }
}

export async function settleNarration(env, reservation) {
  const result = await env.DB.prepare("UPDATE narration_requests SET state = 'settled', updated_at = ? WHERE id = ? AND state = 'reserved'").bind(Date.now(), reservation.id).run();
  if (!result.meta?.changes) {
    const row = await env.DB.prepare('SELECT state FROM narration_requests WHERE id = ?').bind(reservation.id).first();
    if (row?.state !== 'settled') throw new Error('Narration reservation is no longer active');
  }
}

export async function releaseNarration(env, reservation) {
  if (!reservation) return;
  await env.DB.prepare("UPDATE narration_requests SET state = 'released', updated_at = ? WHERE id = ? AND state = 'reserved'").bind(Date.now(), reservation.id).run();
}
