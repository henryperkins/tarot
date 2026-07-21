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
 * Env vars:
 * - `GPT_SERVICE_TOKEN`  (secret)   Shared bearer token the GPT presents. When
 *                                   absent/empty, service auth is disabled.
 * - `GPT_SERVICE_TIER`   (var)      'plus' (default) or 'pro'. Never downgrades
 *                                   below Plus — the whole point is Plus-or-higher.
 * - `GPT_SERVICE_USER_ID`(var)      Optional stable id for usage tracking.
 * - `GPT_SERVICE_EMAIL`  (var)      Optional email stamped on the synthetic user.
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
 * Resolve a service user from a bearer token, or null when the token does not
 * match (or service auth is not configured).
 *
 * @param {string} token - Bearer token presented by the caller
 * @param {object} env - Worker environment bindings
 * @returns {Promise<object|null>}
 */
export async function resolveServiceUser(token, env) {
  const matched = await matchesServiceToken(token, env);
  return matched ? buildServiceUser(env) : null;
}
