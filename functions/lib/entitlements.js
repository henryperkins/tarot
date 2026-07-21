import {
  getEffectiveTier,
  getTierConfig,
  hasTierAtLeast,
  isSubscriptionActive,
  normalizeStatus,
  normalizeTier
} from '../../shared/monetization/subscription.js';

export function getSubscriptionContext(user) {
  const tier = normalizeTier(user?.subscription_tier);
  const status = normalizeStatus(user?.subscription_status);
  const provider = user?.subscription_provider || null;
  const effectiveTier = getEffectiveTier({ tier, status });
  const isActive = isSubscriptionActive({ tier, status });

  return {
    tier,
    status,
    provider,
    effectiveTier,
    isActive,
    config: getTierConfig(effectiveTier)
  };
}

export function isApiKeyUser(user) {
  return user?.auth_provider === 'api_key';
}

export function isServiceUser(user) {
  return user?.auth_provider === 'service';
}

// Non-interactive credentials: API keys and service tokens. Neither is tied to
// a human session, so neither may perform account or billing operations
// (profile edits, password changes, deletion, Stripe checkout/portal).
//
// Note this is deliberately NOT the check for the Pro-only metered API-call
// limiter — that one stays `isApiKeyUser`, since service tokens are exempt from
// per-key API metering by design.
export function isMachineCredential(user) {
  return isApiKeyUser(user) || isServiceUser(user);
}

export function isEntitled(user, requiredTier) {
  const { effectiveTier } = getSubscriptionContext(user);
  return hasTierAtLeast(effectiveTier, requiredTier);
}

export function buildTierLimitedPayload({ message, user, requiredTier }) {
  const { tier, status, effectiveTier } = getSubscriptionContext(user);
  return {
    error: message,
    tierLimited: true,
    currentTier: tier,
    currentStatus: status,
    effectiveTier,
    requiredTier
  };
}

