/**
 * Service-account authentication for trusted first-party integrations.
 *
 * The Tableu Custom GPT / ChatGPT App calls this backend with a static bearer
 * token (documented as a "service account" in
 * docs/integrations/openai/*). Unlike per-user API keys — which derive their
 * entitlements from a Stripe-backed user record and are Pro-only — a service
 * token is an owner-controlled shared secret that authenticates as a synthetic
 * user entitled at a fixed tier (Plus by default, Pro if configured).
 *
 * This is a deliberate, out-of-band entitlement grant: it lets the owner's own
 * GPT reach subscription-gated spreads (e.g. Celtic Cross needs Plus) without
 * provisioning a paying account or minting a DB-backed key. It is only active
 * when `GPT_SERVICE_TOKEN` is configured; when unset, auth behaves exactly as
 * before.
 *
 * The synthetic identity is backed by a real `users` row, provisioned on first
 * use (see `ensureServiceUserRow`). Most per-user tables — `usage_tracking`,
 * `journal_entries`, `card_appearances`, … — declare
 * `FOREIGN KEY (user_id) REFERENCES users(id)`, and D1 enforces foreign keys by
 * default. Without that row every such write fails with
 * `FOREIGN KEY constraint failed`; for `usage_tracking` in particular the
 * failure is swallowed by `enforceReadingLimit`, which would silently hand the
 * service account unlimited unmetered readings.
 *
 * Env vars:
 * - `GPT_SERVICE_TOKEN`  (secret)   Shared bearer token the GPT presents. When
 *                                   absent/empty, service auth is disabled.
 * - `GPT_SERVICE_TIER`   (var)      'plus' (default) or 'pro'. Never downgrades
 *                                   below Plus — the whole point is Plus-or-higher.
 * - `GPT_SERVICE_USER_ID`(var)      Optional stable id for usage tracking.
 * - `GPT_SERVICE_EMAIL`  (var)      Optional email stamped on the synthetic user
 *                                   for observability. The backing row always
 *                                   uses a derived, collision-proof address.
 */

import { sha256Hex, timingSafeEqual } from './crypto.js';
import { normalizeTier } from '../../shared/monetization/subscription.js';

// Reject trivially short/guessable tokens even if misconfigured. A real token
// should be long and random (e.g. `openssl rand -hex 32`).
export const MIN_SERVICE_TOKEN_LENGTH = 24;

// Service accounts are entitled at Plus-or-higher by contract.
const DEFAULT_SERVICE_TIER = 'plus';
const ALLOWED_SERVICE_TIERS = new Set(['plus', 'pro']);
const DEFAULT_SERVICE_USER_ID = 'service:gpt';

// Per-isolate memo of service ids whose `users` row is known to exist, so the
// provisioning round-trip happens once per isolate rather than per request.
const ensuredServiceUserIds = new Set();

/**
 * Resolve the entitlement tier for the service account.
 * Clamps to Plus minimum so a typo or `free` value can't silently strip the
 * elevated access the service token exists to provide.
 *
 * @param {object} env - Worker environment bindings
 * @returns {'plus'|'pro'}
 */
export function resolveServiceTier(env) {
  const configured = normalizeTier(env?.GPT_SERVICE_TIER);
  return ALLOWED_SERVICE_TIERS.has(configured) ? configured : DEFAULT_SERVICE_TIER;
}

/**
 * Whether service-token auth is configured (and usable) for this environment.
 *
 * @param {object} env - Worker environment bindings
 * @returns {boolean}
 */
export function isServiceAuthConfigured(env) {
  const token = typeof env?.GPT_SERVICE_TOKEN === 'string' ? env.GPT_SERVICE_TOKEN : '';
  return token.length >= MIN_SERVICE_TOKEN_LENGTH;
}

// Warn at most once per isolate about a misconfigured (too-short) token —
// matchesServiceToken runs on every Bearer request, so an unconditional warn
// would spam logs (and log-ingestion cost) on each one.
let hasWarnedShortToken = false;

// The configured token is static for the isolate's lifetime, so memoize its
// digest instead of re-hashing it on every request. Keyed on the raw value so a
// rotated token (new value) recomputes rather than returning a stale hash.
let cachedExpectedToken = null;
let cachedExpectedHashPromise = null;

function getExpectedTokenHash(configuredToken) {
  if (configuredToken !== cachedExpectedToken) {
    cachedExpectedToken = configuredToken;
    cachedExpectedHashPromise = sha256Hex(configuredToken);
  }
  return cachedExpectedHashPromise;
}

/**
 * Constant-time check that a presented bearer token matches the configured
 * service token. Both sides are SHA-256 hashed first so the comparison is
 * fixed-width and cannot leak the token length through timing.
 *
 * @param {string} token - Bearer token presented by the caller
 * @param {object} env - Worker environment bindings
 * @returns {Promise<boolean>}
 */
export async function matchesServiceToken(token, env) {
  if (typeof token !== 'string' || !token) return false;
  if (!isServiceAuthConfigured(env)) {
    if (typeof env?.GPT_SERVICE_TOKEN === 'string' && env.GPT_SERVICE_TOKEN.length > 0 && !hasWarnedShortToken) {
      hasWarnedShortToken = true;
      console.warn(
        `[serviceAuth] GPT_SERVICE_TOKEN is set but shorter than the ${MIN_SERVICE_TOKEN_LENGTH}-char minimum; ignoring it.`
      );
    }
    return false;
  }

  const [presented, expected] = await Promise.all([
    sha256Hex(token),
    getExpectedTokenHash(env.GPT_SERVICE_TOKEN)
  ]);
  return timingSafeEqual(presented, expected);
}

/**
 * Build the synthetic user object for an authenticated service request.
 * Shaped to match the user records returned elsewhere by `getUserFromRequest`
 * so downstream entitlement/subscription logic treats it uniformly.
 *
 * `auth_provider: 'service'` (not 'api_key') keeps it clear of the Pro-only,
 * metered API-key limiter in the reading pipeline while remaining observable
 * in logs.
 *
 * @param {object} env - Worker environment bindings
 * @returns {object} Synthetic user
 */
export function buildServiceUser(env) {
  const tier = resolveServiceTier(env);
  const rawId = typeof env?.GPT_SERVICE_USER_ID === 'string' ? env.GPT_SERVICE_USER_ID.trim() : '';
  const rawEmail = typeof env?.GPT_SERVICE_EMAIL === 'string' ? env.GPT_SERVICE_EMAIL.trim() : '';
  return {
    id: rawId || DEFAULT_SERVICE_USER_ID,
    email: rawEmail || null,
    username: 'gpt-service',
    subscription_tier: tier,
    subscription_status: 'active',
    subscription_provider: 'service',
    stripe_customer_id: null,
    email_verified: true,
    auth_provider: 'service',
    is_service_account: true
  };
}

/**
 * Username stamped on the backing `users` row.
 *
 * Always contains a colon, which `isValidUsername` (`/^[a-zA-Z0-9_]{3,30}$/`)
 * rejects — so the value can never collide with a username a real account can
 * register, whatever `GPT_SERVICE_USER_ID` is set to.
 *
 * @param {string} id - Service user id
 * @returns {string}
 */
function serviceRowUsername(id) {
  return id.includes(':') ? id : `service:${id}`;
}

/**
 * Email stamped on the backing `users` row. Derived rather than taken from
 * `GPT_SERVICE_EMAIL` so a misconfigured value can't collide with a real
 * account's address and quietly block provisioning. `.invalid` is reserved by
 * RFC 2606, so it is never deliverable — no password reset can be routed to it.
 *
 * @param {string} id - Service user id
 * @returns {string}
 */
function serviceRowEmail(id) {
  return `${serviceRowUsername(id)}@service.invalid`;
}

/** @returns {string} 32 unguessable random bytes, hex-encoded */
function unusableSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ensure a `users` row exists for the service account.
 *
 * Per-user tables carry `FOREIGN KEY (user_id) REFERENCES users(id)` and D1
 * enforces foreign keys by default, so without this row the service account
 * cannot be metered (`enforceReadingLimit` swallows the constraint failure and
 * allows the request) and journal saves fail with a 500.
 *
 * `password_hash`/`password_salt` are fresh random bytes with no known
 * preimage, so the row can never be used to sign in; the derived `.invalid`
 * email means no reset mail can be delivered either.
 *
 * Best-effort: a failure here is logged loudly but does not fail the request —
 * the token itself is still valid. It must never fail *silently*, since that is
 * exactly the quota-bypass this function exists to prevent.
 *
 * @param {object} env - Worker environment bindings (requires env.DB)
 * @param {object} user - Synthetic user from `buildServiceUser`
 * @returns {Promise<boolean>} Whether the row is present
 */
export async function ensureServiceUserRow(env, user) {
  const db = env?.DB;
  const id = user?.id;
  if (!db || !id) return false;
  if (ensuredServiceUserIds.has(id)) return true;

  try {
    const nowSeconds = Math.floor(Date.now() / 1000);

    // OR IGNORE makes concurrent cold starts idempotent: the loser of the race
    // is a no-op rather than a primary-key error.
    await db
      .prepare(
        `INSERT OR IGNORE INTO users (
           id, email, username, password_hash, password_salt,
           created_at, updated_at, is_active, email_verified,
           subscription_tier, subscription_status, subscription_provider, auth_provider
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 'active', 'service', 'service')`
      )
      .bind(
        id,
        serviceRowEmail(id),
        serviceRowUsername(id),
        unusableSecret(),
        unusableSecret(),
        nowSeconds,
        nowSeconds,
        user.subscription_tier
      )
      .run();

    // Verify rather than trust: OR IGNORE also swallows a unique-constraint
    // collision on email/username, which would leave the FK unsatisfied.
    const row = await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!row) {
      console.error(
        `[serviceAuth] Could not provision the users row for "${id}" — it is still absent after INSERT OR IGNORE, ` +
        'likely a unique-constraint collision on email/username. Reading quota will not be enforced and journal ' +
        'saves will fail until this is resolved.'
      );
      return false;
    }

    ensuredServiceUserIds.add(id);
    return true;
  } catch (error) {
    console.error(
      `[serviceAuth] Failed to provision the users row for "${id}": ${error?.message || error}. ` +
      'Reading quota will not be enforced and journal saves will fail until this is resolved.'
    );
    return false;
  }
}

/**
 * Resolve a service user from a bearer token, or null when the token does not
 * match (or service auth is not configured).
 *
 * @param {string} token - Bearer token presented by the caller
 * @param {object} env - Worker environment bindings
 * @returns {Promise<object|null>}
 */
export async function resolveServiceUser(token, env) {
  const matched = await matchesServiceToken(token, env);
  if (!matched) return null;

  const user = buildServiceUser(env);
  // Awaited, not fire-and-forget: downstream writes on this same request
  // (usage_tracking, journal_entries) need the row to already exist.
  await ensureServiceUserRow(env, user);
  return user;
}
