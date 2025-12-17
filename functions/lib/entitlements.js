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

