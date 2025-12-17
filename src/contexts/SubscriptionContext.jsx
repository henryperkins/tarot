/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  SUBSCRIPTION_TIERS,
  getEffectiveTier,
  getTierConfig,
  hasTierAtLeast,
  isSubscriptionActive,
  normalizeStatus,
  normalizeTier
} from '../../shared/monetization/subscription.js';

/**
 * Subscription tiers and their capabilities
 */
export { SUBSCRIPTION_TIERS };

/**
 * Stripe Price IDs - these should be configured in environment/config
 * Placeholders until Stripe products are created
 */
export const STRIPE_PRICE_IDS = {
  plus_monthly: 'price_plus_monthly_placeholder',
  pro_monthly: 'price_pro_monthly_placeholder'
};

const SubscriptionContext = createContext(null);

/**
 * SubscriptionProvider
 * 
 * Wraps the AuthContext to provide subscription-specific helpers and state.
 * Use this context to check tier capabilities and gate features.
 */
export function SubscriptionProvider({ children }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const subscription = useMemo(() => {
    // Default to free tier for unauthenticated or loading states
    const tier = normalizeTier(user?.subscription_tier);
    const status = normalizeStatus(user?.subscription_status);
    const provider = user?.subscription_provider || null;

    const effectiveTier = getEffectiveTier({ tier, status });
    const tierConfig = getTierConfig(effectiveTier);
    const isActive = isSubscriptionActive({ tier, status });
    const isPaid = tier === 'plus' || tier === 'pro';

    return {
      tier,
      status,
      provider,
      isActive,
      isPaid,
      config: tierConfig,
      effectiveTier,
      
      // Feature checks
      canUseAIQuestions: hasTierAtLeast(effectiveTier, 'plus'),
      canUseTTS: true, // All tiers can use TTS, just with limits
      canUseCloudJournal: hasTierAtLeast(effectiveTier, 'plus'),
      canUseAdvancedInsights: hasTierAtLeast(effectiveTier, 'plus'),
      canUseAPI: effectiveTier === 'pro',
      hasAdFreeExperience: hasTierAtLeast(effectiveTier, 'plus'),
      
      // Limits
      monthlyReadingsLimit: tierConfig.monthlyReadings,
      monthlyTTSLimit: tierConfig.monthlyTTS,
      graphRAGDepth: tierConfig.graphRAGDepth,

      // Helper to check if a spread is available
      canUseSpread: (spreadKey) => {
        if (tierConfig.spreads === 'all' || tierConfig.spreads === 'all+custom') {
          return true;
        }
        return Array.isArray(tierConfig.spreads) && tierConfig.spreads.includes(spreadKey);
      }
    };
  }, [user]);

  const value = {
    subscription,
    isAuthenticated,
    loading: authLoading,
    
    // Convenience getters
    tier: subscription.tier,
    isPaid: subscription.isPaid,
    isActive: subscription.isActive,
    effectiveTier: subscription.effectiveTier,
    
    // Feature checks re-exported at top level for convenience
    canUseAIQuestions: subscription.canUseAIQuestions,
    canUseTTS: subscription.canUseTTS,
    canUseCloudJournal: subscription.canUseCloudJournal,
    canUseAdvancedInsights: subscription.canUseAdvancedInsights,
    canUseAPI: subscription.canUseAPI,
    hasAdFreeExperience: subscription.hasAdFreeExperience,

    // Tier comparison helpers
    isFreeTier: subscription.tier === 'free',
    isPlusTier: subscription.tier === 'plus',
    isProTier: subscription.tier === 'pro',
    isEffectiveFreeTier: subscription.effectiveTier === 'free',
    isEffectivePlusTier: subscription.effectiveTier === 'plus',
    isEffectiveProTier: subscription.effectiveTier === 'pro',
    
    // Upgrade check: returns true if user would benefit from upgrading to target tier
    shouldUpgradeTo: (targetTier) => {
      const tierOrder = { free: 0, plus: 1, pro: 2 };
      return tierOrder[targetTier] > tierOrder[subscription.tier];
    }
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to access subscription context
 * @returns {Object} Subscription context value
 */
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

/**
 * Hook for feature gating with upgrade prompt info
 * @param {string} feature - Feature key to check
 * @returns {Object} { allowed: boolean, requiredTier: string|null, upgradeMessage: string|null }
 */
export function useFeatureGate(feature) {
  const { subscription, isAuthenticated } = useSubscription();

  const featureRequirements = {
    aiQuestions: { requiredTier: 'plus', message: 'AI-powered question suggestions' },
    cloudJournal: { requiredTier: 'plus', message: 'Cloud journal sync & backup' },
    advancedInsights: { requiredTier: 'plus', message: 'Advanced reading insights' },
    unlimitedReadings: { requiredTier: 'pro', message: 'Unlimited AI readings' },
    unlimitedTTS: { requiredTier: 'pro', message: 'Unlimited text-to-speech' },
    apiAccess: { requiredTier: 'pro', message: 'API access for developers' },
    customSpreads: { requiredTier: 'pro', message: 'Custom spread layouts' }
  };

  const requirement = featureRequirements[feature];
  
  if (!requirement) {
    // Unknown feature, allow by default
    return { allowed: true, requiredTier: null, upgradeMessage: null };
  }

  const tierOrder = { free: 0, plus: 1, pro: 2 };
  const currentTierLevel = tierOrder[subscription.tier] || 0;
  const requiredTierLevel = tierOrder[requirement.requiredTier] || 0;
  
  const allowed = currentTierLevel >= requiredTierLevel && subscription.isActive;

  return {
    allowed,
    requiredTier: allowed ? null : requirement.requiredTier,
    upgradeMessage: allowed ? null : requirement.message,
    isAuthenticated
  };
}
