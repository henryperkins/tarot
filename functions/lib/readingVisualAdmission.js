import { canonicalVisualCueJSON, hashVisualCueText, visualCueBindingSchema } from '../../shared/contracts/visualCueBatches.js';

const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const LIMIT_KEYS = ['rateLimit', 'windowMs', 'totalLimit', 'globalRateLimit', 'globalTotalLimit',
  'maxDispatchCostMicrousd', 'scopeCostLimitMicrousd', 'globalCostLimitMicrousd'];
const configString = value => typeof value === 'string' ? value.trim() : '';
const dispatchConfigurations = new WeakSet();

/** Operator-selected limits and conservative per-call cost are mandatory. Neither
 * model configuration nor a reading/guest ID supplies spending authorization. */
export function getVisualInitialLimits(env) {
  let value;
  try { value = JSON.parse(env?.VISUAL_INITIAL_LIMITS); } catch { return null; }
  if (!value || !LIMIT_KEYS.every(key => positiveInteger(value[key]))
      || value.provider !== configString(env?.VISUAL_CUE_PROVIDER)
      || value.model !== configString(env?.VISUAL_CUE_MODEL)
      || !value.provider || !value.model) return null;
  return value;
}

/** Configuration only, with no probes, claims, reservations or provider calls. */
export function getVisualInitialReadiness(env) {
  if (!env?.DB) return { ready: false, reason: 'missing_initial_admission_storage' };
  if (!getVisualInitialLimits(env)) return { ready: false, reason: 'initial_limits_unavailable' };
  return { ready: true, reason: null };
}

/** Internal immutable capsule pins the exact limits and provider settings used
 * by this reservation. Mutable environment state never supplies the later call. */
export function captureVisualInitialDispatchConfiguration(env) {
  const configured = getVisualInitialLimits(env);
  if (!env?.DB || !configured) return null;
  const limits = Object.freeze(Object.fromEntries(['provider', 'model', ...LIMIT_KEYS]
    .map(key => [key, configured[key]])));
  const providerEnv = Object.freeze({
    VISUAL_CUE_PROVIDER: limits.provider, VISUAL_CUE_MODEL: limits.model,
    VISUAL_CUE_REASONING_EFFORT: env.VISUAL_CUE_REASONING_EFFORT,
    VISUAL_CUE_TIMEOUT_MS: env.VISUAL_CUE_TIMEOUT_MS, AI: env.AI
  });
  const configuration = Object.freeze({ limits, providerEnv, aiRun: env.AI?.run, db: env.DB });
  dispatchConfigurations.add(configuration);
  return configuration;
}

/** Synchronous final fence. Run after every ownership/storage await and again
 * inside the provider's deferred callback, immediately before actual dispatch. */
export function isVisualInitialDispatchConfigurationCurrent(env, configuration) {
  if (!dispatchConfigurations.has(configuration) || env?.DB !== configuration.db) return false;
  const limits = getVisualInitialLimits(env);
  if (!limits) return false;
  const current = Object.fromEntries(['provider', 'model', ...LIMIT_KEYS].map(key => [key, limits[key]]));
  return canonicalVisualCueJSON(current) === canonicalVisualCueJSON(configuration.limits)
    && env.VISUAL_CUE_REASONING_EFFORT === configuration.providerEnv.VISUAL_CUE_REASONING_EFFORT
    && env.VISUAL_CUE_TIMEOUT_MS === configuration.providerEnv.VISUAL_CUE_TIMEOUT_MS
    && env.AI === configuration.providerEnv.AI && env.AI?.run === configuration.aiRun;
}

/** Prepare server-only identity with no SQL. Optional admission latency cannot
 * delay prose startup; the private visual /init route mints durable authority. */
export async function prepareVisualInitialAdmission({ env, userId = null, request = null }) {
  if (!getVisualInitialReadiness(env).ready) return null;
  let aggregateScope;
  if (userId) aggregateScope = `user:${await hashVisualCueText(String(userId))}`;
  else {
    const identity = typeof env.VISUAL_INITIAL_TRUSTED_IDENTITY?.resolve === 'function'
      ? env.VISUAL_INITIAL_TRUSTED_IDENTITY.resolve(request)
      : request?.cf ? request.headers.get('CF-Connecting-IP') : null;
    // Initial attribution accepts only an already resolved trusted string.
    // An optional asynchronous resolver degrades visuals immediately; observing
    // its rejection never awaits it, stores its late value, or schedules work.
    if (identity && typeof identity.then === 'function') {
      Promise.resolve(identity).catch(() => {});
      return null;
    }
    if (typeof identity !== 'string' || !identity.trim()) return null;
    aggregateScope = `guest-edge:${await hashVisualCueText(identity.trim())}`;
  }
  return { userId, aggregateScope };
}

/** Only private server callers can mint this row. admissionContext is created
 * by the start helper, never copied from a public reading payload or headers. */
export async function createVisualInitialAdmission({ env, userId = null, request = null,
  readingResultId, visualToken, binding, admissionContext = null, expiresAt = Date.now() + 86400000 }) {
  if (!getVisualInitialReadiness(env).ready || !visualCueBindingSchema.safeParse(binding).success
      || binding.readingResultId !== readingResultId || typeof visualToken !== 'string' || !visualToken
      || !positiveInteger(expiresAt)) return false;
  const context = admissionContext || await prepareVisualInitialAdmission({ env, userId, request });
  if (!context || context.userId !== userId
      || !/^(?:user|guest-edge):[a-f0-9]{64}$/.test(context.aggregateScope)
      || (userId ? context.aggregateScope !== `user:${await hashVisualCueText(String(userId))}`
        : !context.aggregateScope.startsWith('guest-edge:'))) return false;
  const aggregateScope = context.aggregateScope;
  const tokenHash = await hashVisualCueText(visualToken);
  const result = await env.DB.prepare(`INSERT INTO visual_initial_admissions
    (reading_result_id, user_id, aggregate_scope, binding_json, token_hash, expires_at, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE (? IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = ? AND is_active = 1))
      AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = ?)
      AND NOT EXISTS (SELECT 1 FROM visual_result_revocations WHERE reading_result_id = ?)
    ON CONFLICT(reading_result_id) DO NOTHING`)
    .bind(readingResultId, userId, aggregateScope, JSON.stringify(binding), tokenHash,
      expiresAt, Date.now(), userId, userId, userId, readingResultId).run();
  if (Number(result?.meta?.changes || 0) > 0) return true;
  const prior = await env.DB.prepare(`SELECT 1 AS admitted FROM visual_initial_admissions
    WHERE reading_result_id = ? AND user_id IS ? AND aggregate_scope = ? AND binding_json = ?
      AND token_hash = ? AND expires_at > ?
      AND (? IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = ? AND is_active = 1))
      AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = ?)
      AND NOT EXISTS (SELECT 1 FROM visual_result_revocations WHERE reading_result_id = ?)`)
    .bind(readingResultId, userId, aggregateScope, JSON.stringify(binding), tokenHash, Date.now(),
      userId, userId, userId, readingResultId).first();
  return !!prior;
}

/** One atomic D1 INSERT is the final durable spending check for every original
 * provider invocation. Counts and integer USD bounds include all reservations,
 * even unknown usage, failure, timeout, cancellation and deleted sources. */
export async function reserveVisualInitialDispatch({ env, userId = null, binding, visualToken, dispatchId, configuration = null }) {
  const captured = configuration || captureVisualInitialDispatchConfiguration(env);
  if (!isVisualInitialDispatchConfigurationCurrent(env, captured)
      || !visualCueBindingSchema.safeParse(binding).success || !visualToken || !dispatchId) return false;
  const limits = captured.limits;
  const now = Date.now();
  const result = await env.DB.prepare(`INSERT INTO visual_initial_reservations
    (dispatch_id, reading_result_id, aggregate_scope, reserved_cost_microusd, reserved_at)
    SELECT ?, a.reading_result_id, a.aggregate_scope, ?, ? FROM visual_initial_admissions a
      JOIN reading_visual_results r ON r.id = a.reading_result_id
    WHERE a.reading_result_id = ? AND a.user_id IS ? AND r.user_id IS a.user_id
      AND a.token_hash = ? AND a.expires_at > ? AND r.binding_json = ?
      AND json_extract(a.binding_json, '$.spreadHash') = json_extract(r.binding_json, '$.spreadHash')
      AND json_extract(a.binding_json, '$.contextHash') = json_extract(r.binding_json, '$.contextHash')
      AND json_extract(a.binding_json, '$.artworkEdition') = json_extract(r.binding_json, '$.artworkEdition')
      AND json_extract(a.binding_json, '$.catalogVersion') = json_extract(r.binding_json, '$.catalogVersion')
      AND r.status NOT IN ('cancelled', 'revoked', 'expired') AND r.active_attempt_id IS NULL
      AND (r.expires_at IS NULL OR r.expires_at > ?)
      AND (a.user_id IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = a.user_id AND is_active = 1))
      AND NOT EXISTS (SELECT 1 FROM visual_owner_revocations WHERE user_id = a.user_id)
      AND NOT EXISTS (SELECT 1 FROM visual_result_revocations WHERE reading_result_id = a.reading_result_id)
      AND NOT EXISTS (SELECT 1 FROM journal_visual_state s WHERE s.reading_result_id = a.reading_result_id
        AND (s.attempt_id IS NOT NULL OR s.retry_status = 'revoked'))
      AND (SELECT COUNT(*) FROM visual_initial_reservations v WHERE v.aggregate_scope = a.aggregate_scope) < ?
      AND (SELECT COUNT(*) FROM visual_initial_reservations v WHERE v.aggregate_scope = a.aggregate_scope AND v.reserved_at > ?) < ?
      AND (SELECT COUNT(*) FROM visual_initial_reservations) < ?
      AND (SELECT COUNT(*) FROM visual_initial_reservations v WHERE v.reserved_at > ?) < ?
      AND COALESCE((SELECT SUM(v.reserved_cost_microusd) FROM visual_initial_reservations v
        WHERE v.aggregate_scope = a.aggregate_scope), 0) <= ?
      AND COALESCE((SELECT SUM(v.reserved_cost_microusd) FROM visual_initial_reservations v), 0) <= ?
    ON CONFLICT(dispatch_id) DO NOTHING`)
    .bind(dispatchId, limits.maxDispatchCostMicrousd, now, binding.readingResultId, userId,
      await hashVisualCueText(visualToken), now, JSON.stringify(binding), now,
      limits.totalLimit, now - limits.windowMs, limits.rateLimit, limits.globalTotalLimit,
      now - limits.windowMs, limits.globalRateLimit,
      limits.scopeCostLimitMicrousd - limits.maxDispatchCostMicrousd,
      limits.globalCostLimitMicrousd - limits.maxDispatchCostMicrousd).run();
  return Number(result?.meta?.changes || 0) > 0;
}
