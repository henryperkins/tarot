/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

/**
 * Subscription tiers and their capabilities
 */
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
    const tier = user?.subscription_tier || 'free';
    const status = user?.subscription_status || 'inactive';
    const provider = user?.subscription_provider || null;

    const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
    const isActive = status === 'active' || tier === 'free';
    const isPaid = tier === 'plus' || tier === 'pro';

    return {
      tier,
      status,
      provider,
      isActive,
      isPaid,
      config: tierConfig,
      
      // Feature checks
      canUseAIQuestions: isPaid && isActive,
      canUseTTS: true, // All tiers can use TTS, just with limits
      canUseCloudJournal: isPaid && isActive,
      canUseAdvancedInsights: isPaid && isActive,
      canUseAPI: tier === 'pro' && isActive,
      hasAdFreeExperience: isPaid && isActive,
      
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
