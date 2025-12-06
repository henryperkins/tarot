import { useState } from 'react';
import { Crown, Sparkle, X, ArrowRight } from '@phosphor-icons/react';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * UpgradeNudge - A component to prompt users to upgrade their subscription
 * 
 * @param {Object} props
 * @param {string} props.feature - The feature name being gated (for display)
 * @param {string} [props.requiredTier='plus'] - The minimum tier required
 * @param {string} [props.variant='inline'] - Display variant: 'inline', 'banner', 'modal'
 * @param {boolean} [props.dismissible=true] - Whether the nudge can be dismissed
 * @param {Function} [props.onDismiss] - Callback when dismissed
 * @param {Function} [props.onUpgrade] - Callback when upgrade button is clicked
 * @param {string} [props.className] - Additional CSS classes
 */
export function UpgradeNudge({
  feature,
  requiredTier = 'plus',
  variant = 'inline',
  dismissible = true,
  onDismiss,
  onUpgrade,
  className = ''
}) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { tier, isAuthenticated } = useSubscription();
  const prefersReducedMotion = useReducedMotion();

  const tierConfig = SUBSCRIPTION_TIERS[requiredTier] || SUBSCRIPTION_TIERS.plus;
  const currentTierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;

  // Don't show if user already has the required tier or higher
  const tierOrder = { free: 0, plus: 1, pro: 2 };
  if (tierOrder[tier] >= tierOrder[requiredTier]) {
    return null;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleUpgrade = () => {
    // Navigate to pricing page or open upgrade modal
    onUpgrade?.();
    if (!onUpgrade) {
      // Default behavior: navigate to pricing page
      window.location.href = '/pricing';
    }
  };

  // Inline variant - compact, fits within content
  if (variant === 'inline') {
    return (
      <div className={`rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-accent shrink-0" weight="fill" />
          <span className="text-xs text-secondary">
            <span className="font-medium text-accent">{tierConfig.label}</span>
            {' '}feature: {feature}
          </span>
          <button
            type="button"
            onClick={handleUpgrade}
            className="ml-auto text-xs font-semibold text-accent hover:text-accent/80 transition"
          >
            Upgrade
          </button>
        </div>
      </div>
    );
  }

  // Banner variant - full-width, more prominent
  if (variant === 'banner') {
    return (
      <div className={`rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-accent/20 p-2 shrink-0">
            <Sparkle className="h-5 w-5 text-accent" weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-main">
              Unlock {feature}
            </p>
            <p className="text-xs text-muted mt-0.5">
              Upgrade to {tierConfig.name} ({tierConfig.label}) for ${tierConfig.price}/month to access this feature.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUpgrade}
              className={`inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}`}
            >
              <Crown className="h-4 w-4" weight="fill" />
              Upgrade
            </button>
            {dismissible && (
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-full p-1.5 text-muted hover:text-main hover:bg-surface-muted transition"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Modal variant - centered card overlay
  if (variant === 'modal') {
    return (
      <div className={`fixed inset-0 z-[200] flex items-center justify-center bg-main/80 backdrop-blur-sm ${prefersReducedMotion ? '' : 'animate-fade-in'} ${className}`}>
        <div className={`relative w-full max-w-md mx-4 rounded-3xl border border-accent/30 bg-surface p-6 shadow-2xl ${prefersReducedMotion ? '' : 'animate-pop-in'}`}>
          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted hover:text-main hover:bg-surface-muted transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          
          <div className="text-center">
            <div className="inline-flex rounded-full bg-accent/20 p-4 mb-4">
              <Crown className="h-8 w-8 text-accent" weight="fill" />
            </div>
            
            <h3 className="font-serif text-2xl text-main mb-2">
              Unlock {feature}
            </h3>
            
            <p className="text-sm text-muted mb-6">
              This feature is available on the {tierConfig.name} plan.
              Upgrade to access {feature.toLowerCase()} and more premium features.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleUpgrade}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-full border border-accent bg-accent px-6 py-3 text-base font-semibold text-main transition ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}`}
              >
                <Crown className="h-5 w-5" weight="fill" />
                Upgrade to {tierConfig.label} - ${tierConfig.price}/mo
                <ArrowRight className="h-5 w-5" />
              </button>
              
              {isAuthenticated ? null : (
                <p className="text-xs text-muted">
                  Already subscribed?{' '}
                  <a href="/login" className="text-accent hover:underline">
                    Sign in
                  </a>
                </p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-accent/20">
              <p className="text-xs text-secondary mb-3">
                {tierConfig.label} includes:
              </p>
              <ul className="text-xs text-muted space-y-1.5 text-left max-w-xs mx-auto">
                {requiredTier === 'plus' ? (
                  <>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      50 AI readings per month
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      AI-powered question suggestions
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      Cloud journal sync & backup
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      All spread layouts
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      Ad-free experience
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      Unlimited AI readings
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      Custom spread builder
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      API access (1,000 calls/mo)
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkle className="h-3 w-3 text-accent shrink-0" />
                      Everything in Plus
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * FeatureGate - Wrapper component that shows content or upgrade nudge
 * 
 * @param {Object} props
 * @param {string} props.feature - Feature name for display
 * @param {string} [props.requiredTier='plus'] - Minimum required tier
 * @param {React.ReactNode} props.children - Content to show if allowed
 * @param {React.ReactNode} [props.fallback] - Custom fallback (default: UpgradeNudge)
 * @param {string} [props.nudgeVariant='inline'] - Variant for the upgrade nudge
 */
export function FeatureGate({
  feature,
  requiredTier = 'plus',
  children,
  fallback,
  nudgeVariant = 'inline'
}) {
  const { tier } = useSubscription();
  
  const tierOrder = { free: 0, plus: 1, pro: 2 };
  const hasAccess = tierOrder[tier] >= tierOrder[requiredTier];

  if (hasAccess) {
    return children;
  }

  if (fallback) {
    return fallback;
  }

  return (
    <UpgradeNudge
      feature={feature}
      requiredTier={requiredTier}
      variant={nudgeVariant}
    />
  );
}

export default UpgradeNudge;