export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Seeker',
    label: 'Free',
    monthlyReadings: 5,
    monthlyTTS: 3,
    spreads: ['single', 'threeCard', 'fiveCard'],
    cloudJournal: false,
    advancedInsights: false,
    adFree: false,
    apiAccess: false,
    aiQuestions: false,
    graphRAGDepth: 'limited'
  },
  plus: {
    name: 'Enlightened',
    label: 'Plus',
    price: 7.99,
    monthlyReadings: 50,
    monthlyTTS: 50,
    spreads: 'all',
    cloudJournal: true,
    advancedInsights: true,
    adFree: true,
    apiAccess: false,
    aiQuestions: true,
    graphRAGDepth: 'full'
  },
  pro: {
    name: 'Mystic',
    label: 'Pro',
    price: 19.99,
    monthlyReadings: Infinity,
    monthlyTTS: Infinity,
    spreads: 'all+custom',
    cloudJournal: true,
    advancedInsights: true,
    adFree: true,
    apiAccess: true,
    apiCallsPerMonth: 1000,
    aiQuestions: true,
    graphRAGDepth: 'full'
  }
};

export const TIER_ORDER = { free: 0, plus: 1, pro: 2 };

// Internal statuses stored in `users.subscription_status`.
// Stripe statuses are mapped to this set in `functions/api/webhooks/stripe.js`.
export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];

export function normalizeTier(value) {
  const tier = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUBSCRIPTION_TIERS[tier] ? tier : 'free';
}

export function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return status || 'inactive';
}

export function isPaidTier(tier) {
  const normalized = normalizeTier(tier);
  return normalized === 'plus' || normalized === 'pro';
}

export function isActiveStatus(status) {
  const normalized = normalizeStatus(status);
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(normalized);
}

export function isSubscriptionActive({ tier, status }) {
  const normalizedTier = normalizeTier(tier);
  if (normalizedTier === 'free') return true;
  return isActiveStatus(status);
}

// Converts a stored tier/status pair into the tier that should be used for
// feature gating. Inactive paid subscriptions behave as free for entitlements.
export function getEffectiveTier({ tier, status }) {
  const normalizedTier = normalizeTier(tier);
  return isSubscriptionActive({ tier: normalizedTier, status }) ? normalizedTier : 'free';
}

export function hasTierAtLeast(tier, requiredTier) {
  const current = TIER_ORDER[normalizeTier(tier)] ?? 0;
  const required = TIER_ORDER[normalizeTier(requiredTier)] ?? 0;
  return current >= required;
}

export function getTierConfig(tier) {
  return SUBSCRIPTION_TIERS[normalizeTier(tier)] || SUBSCRIPTION_TIERS.free;
}

