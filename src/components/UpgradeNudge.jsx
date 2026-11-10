import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Sparkle, ArrowRight } from '@phosphor-icons/react';
import { CloseButton } from './CloseButton';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useModalA11y } from '../hooks/useModalA11y';
import { leavePage } from '../hooks/useAndroidBackGuard';

const PLUS_BENEFITS = [
  '50 AI readings per month',
  'AI-powered question suggestions',
  'Cloud journal sync & backup',
  'All spread layouts',
  'Ad-free experience'
];

const PRO_BENEFITS = [
  'Unlimited AI readings',
  'Unlimited voice narrations',
  'API access (1,000 calls/mo)',
  'Everything in Plus'
];

/**
 * The modal variant: a real dialog rendered on document.body, so no animated
 * or transformed ancestor can become its containing block. It owns focus while
 * open, closes with Escape, the backdrop, Back or Close, and returns focus to
 * the control that opened it. The card never grows past the viewport; its
 * content scrolls under a Close button that stays in reach.
 */
function UpgradeDialog({
  feature,
  requiredTier,
  tierConfig,
  isAuthenticated,
  dismissible,
  onClose,
  onUpgrade,
  returnFocusRef,
  prefersReducedMotion,
  className
}) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const benefits = requiredTier === 'plus' ? PLUS_BENEFITS : PRO_BENEFITS;

  useModalA11y(true, {
    onClose,
    containerRef: dialogRef,
    // Start on the title so a screen reader reads the offer from the top;
    // Tab then reaches the upgrade action and Close.
    initialFocusRef: headingRef,
    returnFocusRef,
    isolateBackground: true,
    closeOnEscape: dismissible,
    closeOnBack: dismissible ? undefined : false,
    backGuardId: 'upgradeNudge'
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-auth flex items-center justify-center bg-main/80 backdrop-blur-sm pt-[max(0.75rem,var(--safe-pad-top))] pb-[max(0.75rem,var(--safe-pad-bottom))] pl-[max(1rem,var(--safe-pad-left))] pr-[max(1rem,var(--safe-pad-right))] ${prefersReducedMotion ? '' : 'animate-fade-in'} ${className}`}
    >
      {/* Pointer shortcut only: Escape, Back and Close serve everyone else. */}
      {dismissible && (
        <div data-modal-backdrop aria-hidden="true" className="absolute inset-0" onClick={onClose} />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-3xl border border-accent/30 bg-surface shadow-2xl ${prefersReducedMotion ? '' : 'animate-pop-in'}`}
      >
        {dismissible && (
          // Opaque, so text scrolling beneath it never shows through the icon.
          <div className="absolute right-3 top-3 z-10 rounded-full bg-surface">
            <CloseButton label="Close" onClick={onClose} />
          </div>
        )}

        <div className="min-h-0 overflow-y-auto overscroll-contain p-6 short:px-5 short:py-4 text-center">
          <div className="inline-flex rounded-full bg-accent/20 p-4 mb-4 short:p-2.5 short:mb-2" aria-hidden="true">
            <Crown className="h-8 w-8 short:h-6 short:w-6 text-accent" weight="fill" />
          </div>

          <h2
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="font-serif text-2xl short:text-xl text-main text-balance mb-2 outline-hidden"
          >
            Unlock {feature}
          </h2>

          {/* The card the reader tapped says "Requires Plus", so the dialog
              names the plan the same way and keeps the feature's own name. */}
          <p id={descriptionId} className="text-sm text-muted mb-6 short:mb-4">
            {feature} comes with {tierConfig.label}, along with everything listed below.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onUpgrade}
              className={`w-full min-h-cta inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-base font-semibold text-surface transition hover:bg-primary touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${prefersReducedMotion ? '' : 'active:scale-[0.98]'}`}
            >
              <Crown className="h-5 w-5 shrink-0" weight="fill" aria-hidden="true" />
              Upgrade to {tierConfig.label} · ${tierConfig.price}/mo
              <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>

            {isAuthenticated ? null : (
              <p className="text-xs text-muted">
                Already subscribed?{' '}
                <a
                  href="/account"
                  onClick={event => {
                    // A plain click takes over the dialog's Back entry on phones
                    // (leavePage); modified clicks keep their new-tab behavior.
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    leavePage('/account');
                  }}
                  className="rounded-sm font-semibold text-accent underline underline-offset-2 hover:text-main focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
                >
                  Sign in
                </a>
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 short:mt-4 short:pt-3 border-t border-accent/20">
            <p className="text-xs text-secondary mb-3">
              {tierConfig.label} includes:
            </p>
            <ul className="text-xs text-muted space-y-1.5 text-left max-w-xs mx-auto">
              {benefits.map(benefit => (
                <li key={benefit} className="flex items-center gap-2">
                  <Sparkle className="h-3 w-3 text-accent shrink-0" aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

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
 * @param {{ current: HTMLElement | null }} [props.returnFocusRef] - Modal only: the
 *   control that receives focus when the dialog closes (by default, the one that
 *   was focused when it opened)
 */
export function UpgradeNudge({
  feature,
  requiredTier = 'plus',
  variant = 'inline',
  dismissible = true,
  onDismiss,
  onUpgrade,
  className = '',
  returnFocusRef = null
}) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { effectiveTier, isAuthenticated } = useSubscription();
  const prefersReducedMotion = useReducedMotion();

  const tierConfig = SUBSCRIPTION_TIERS[requiredTier] || SUBSCRIPTION_TIERS.plus;

  // Don't show if user already has the required tier or higher
  // Use effectiveTier: inactive paid subscriptions behave as free
  const tierOrder = { free: 0, plus: 1, pro: 2 };
  if (tierOrder[effectiveTier] >= tierOrder[requiredTier]) {
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
      // Default behavior: navigate to pricing page. From the modal on a phone,
      // the pricing page takes over the dialog's Back entry (leavePage).
      leavePage('/pricing');
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
            className="ml-auto min-h-touch px-2 inline-flex items-center text-xs font-semibold text-accent hover:text-accent/80 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) rounded"
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
      <div className={`rounded-2xl border border-accent/30 bg-linear-to-r from-accent/10 via-accent/5 to-transparent p-4 ${className}`}>
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
              className={`inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}`}
            >
              <Crown className="h-4 w-4" weight="fill" />
              Upgrade
            </button>
            {dismissible && (
              <CloseButton label="Dismiss" size="sm" onClick={handleDismiss} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Modal variant - a dialog over the page
  if (variant === 'modal') {
    return (
      <UpgradeDialog
        feature={feature}
        requiredTier={requiredTier}
        tierConfig={tierConfig}
        isAuthenticated={isAuthenticated}
        dismissible={dismissible}
        onClose={handleDismiss}
        onUpgrade={handleUpgrade}
        returnFocusRef={returnFocusRef}
        prefersReducedMotion={prefersReducedMotion}
        className={className}
      />
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
  // Use effectiveTier: inactive paid subscriptions behave as free
  const { effectiveTier } = useSubscription();
  
  const tierOrder = { free: 0, plus: 1, pro: 2 };
  const hasAccess = tierOrder[effectiveTier] >= tierOrder[requiredTier];

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
