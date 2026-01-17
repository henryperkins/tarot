import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Crown,
  Sparkle,
  Check,
  X,
  Star,
  Lightning,
  Eye,
  CloudArrowUp,
  Microphone,
  ArrowRight,
  CircleNotch,
  Cards,
  Moon,
  Graph,
  Stack,
  Lightbulb,
  Headset,
  Table,
  Info,
  Code
} from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { GlobalNav } from '../components/GlobalNav';
import AuthModal from '../components/AuthModal';
import { MobileInfoSection } from '../components/MobileInfoSection';
import { GlobalNav } from '../components/GlobalNav';
import { UserMenu } from '../components/UserMenu';
import { useToast } from '../contexts/ToastContext';

function formatCount(value) {
  if (value === Infinity) return 'Unlimited';
  return value;
}

function formatPerMonth(value) {
  if (value === Infinity) return 'Unlimited';
  return `${value}/mo`;
}

function TierCard({ tierKey, config, isCurrent, onSelect, isLoading, disabled }) {
  const prefersReducedMotion = useReducedMotion();
  const isFree = tierKey === 'free';
  const isPaid = !isFree;
  const trialDays = Number.isFinite(config.trialDays) ? config.trialDays : 0;
  const primaryBillingLine = trialDays > 0 ? `Free ${trialDays}-day trial` : 'Billed today';
  const secondaryBillingLine = trialDays > 0
    ? 'Billed monthly · Total due today: $0'
    : `Billed monthly · Total due today: $${config.price}`;
  const policyLine = isPaid ? 'Cancel anytime · 7-day refund on first purchase' : null;

  const iconMap = {
    free: Moon,
    plus: Sparkle,
    pro: Crown
  };
  const TierIcon = iconMap[tierKey];

  return (
    <div
      className={[
        'relative rounded-3xl border bg-surface/80 p-6 backdrop-blur',
        isCurrent
          ? 'border-accent/80 ring-2 ring-accent/40'
          : 'border-secondary/40 hover:border-accent/60',
        prefersReducedMotion ? '' : 'transition-transform hover:-translate-y-0.5'
      ].join(' ')}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${isPaid ? 'bg-accent/15' : 'bg-secondary/20'}`}>
            <TierIcon className={`h-5 w-5 ${isPaid ? 'text-accent' : 'text-secondary'}`} weight="fill" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{config.name}</p>
            <p className="text-lg font-semibold text-main">{config.label}</p>
          </div>
        </div>

        <div className="text-right">
          {isFree ? (
            <p className="text-3xl font-bold text-main">Free</p>
          ) : (
            <p className="text-main">
              <span className="text-3xl font-bold">${config.price}</span>
              <span className="ml-1 text-sm text-muted">/month</span>
            </p>
          )}
          {isPaid && (
            <div className="mt-1 text-[11px] text-muted space-y-0.5">
              <p>{primaryBillingLine}</p>
              <p>{secondaryBillingLine}</p>
              <p>{policyLine}</p>
            </div>
          )}
        </div>
      </div>

      {tierKey === 'plus' && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Star className="h-3.5 w-3.5" weight="fill" />
          Most popular
        </div>
      )}

      {isCurrent && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Check className="h-3.5 w-3.5" weight="bold" />
          Current plan
        </div>
      )}

      <ul className="mb-6 space-y-2 text-sm">
        {/* Core limits */}
        <li className="flex items-center gap-2">
          <Cards className="h-4 w-4 text-accent" weight="fill" />
          <span className="text-secondary">
            {formatCount(config.monthlyReadings)} AI readings/month
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Microphone className="h-4 w-4 text-accent" weight="fill" />
          <span className="text-secondary">
            {formatPerMonth(config.monthlyTTS)} voice narrations
          </span>
        </li>

        {/* Spreads access */}
        <li className="flex items-center gap-2">
          <Stack className="h-4 w-4 text-accent" weight="fill" />
          <span className="text-secondary">
            {config.spreads === 'all+custom'
              ? 'All spreads + custom'
              : config.spreads === 'all'
                ? 'All spread layouts'
                : '3 core spreads'}
          </span>
        </li>

        {/* GraphRAG depth */}
        <li className="flex items-center gap-2">
          <Graph className="h-4 w-4 text-accent" weight="fill" />
          <span className="text-secondary inline-flex items-center gap-1">
            {config.graphRAGDepth === 'full' ? 'Deep context memory' : 'Essential context memory'}
            <Info
              className="h-3.5 w-3.5 text-muted"
              title="GraphRAG keeps more of your reading history in context."
              aria-label="GraphRAG keeps more of your reading history in context."
            />
          </span>
        </li>

        {/* AI questions */}
        <li className="flex items-center gap-2">
          {config.aiQuestions ? (
            <Check className="h-4 w-4 text-accent" weight="bold" />
          ) : (
            <X className="h-4 w-4 text-secondary" />
          )}
          <span className="text-secondary">Guided AI questions</span>
        </li>

        {/* Advanced insights */}
        <li className="flex items-center gap-2">
          {config.advancedInsights ? (
            <Lightbulb className="h-4 w-4 text-accent" weight="fill" />
          ) : (
            <X className="h-4 w-4 text-secondary" />
          )}
          <span className="text-secondary">Advanced insights & patterns</span>
        </li>

        {/* Cloud journal */}
        <li className="flex items-center gap-2">
          {config.cloudJournal ? (
            <CloudArrowUp className="h-4 w-4 text-accent" weight="fill" />
          ) : (
            <X className="h-4 w-4 text-secondary" />
          )}
          <span className="text-secondary">Cloud-synced journal</span>
        </li>

        {/* Ad-free */}
        <li className="flex items-center gap-2">
          {config.adFree ? (
            <Check className="h-4 w-4 text-accent" weight="bold" />
          ) : (
            <X className="h-4 w-4 text-secondary" />
          )}
          <span className="text-secondary">Ad-free experience</span>
        </li>

        {/* API access (Pro only) */}
        {config.apiAccess && (
          <li className="flex items-center gap-2">
            <Code className="h-4 w-4 text-accent" weight="fill" />
            <span className="text-secondary inline-flex items-center gap-1">
              Developer access · {config.apiCallsPerMonth?.toLocaleString()} calls/mo
              <Info
                className="h-3.5 w-3.5 text-muted"
                title="Includes API access for integrating Tableu into your workflows."
                aria-label="Includes API access for integrating Tableu into your workflows."
              />
            </span>
          </li>
        )}

        {/* Priority support hint for Pro */}
        {tierKey === 'pro' && (
          <li className="flex items-center gap-2">
            <Headset className="h-4 w-4 text-accent" weight="fill" />
            <span className="text-secondary">Priority support</span>
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(tierKey)}
        disabled={disabled || isLoading || isCurrent}
        className={[
          'inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold',
          isCurrent
            ? 'bg-secondary/30 text-secondary cursor-default'
            : isPaid
              ? 'bg-amber-500 text-neutral-900 shadow-md hover:bg-amber-400'
              : 'border-2 border-secondary/60 bg-transparent text-main hover:border-accent hover:bg-secondary/10',
          prefersReducedMotion ? '' : 'transition'
        ].join(' ')}
      >
        {isCurrent
          ? 'Current plan'
          : isFree
            ? 'Continue free'
            : `Upgrade to ${config.label}`}
        {isLoading && <CircleNotch className="h-4 w-4 animate-spin" />}
      </button>
    </div>
  );
}

const heroBenefits = [
  {
    label: 'Paid plans keep full context intact',
    icon: Eye
  },
  {
    label: 'Plus unlocks AI questions & cloud sync',
    icon: Sparkle
  },
  {
    label: 'Pro adds unlimited readings and developer tools',
    icon: Lightning
  }
];

const comparisonFeatures = [
  { key: 'monthlyReadings', label: 'AI readings/month', type: 'count' },
  { key: 'monthlyTTS', label: 'Voice narrations/month', type: 'count' },
  { key: 'spreads', label: 'Spread layouts', type: 'spreads' },
  {
    key: 'graphRAGDepth',
    label: 'Context memory',
    type: 'graphRAG',
    tooltip: 'GraphRAG keeps more of your reading history in context.'
  },
  { key: 'aiQuestions', label: 'Guided AI questions', type: 'boolean' },
  { key: 'advancedInsights', label: 'Advanced insights & patterns', type: 'boolean' },
  { key: 'cloudJournal', label: 'Cloud-synced journal', type: 'boolean' },
  { key: 'adFree', label: 'Ad-free experience', type: 'boolean' },
  {
    key: 'apiAccess',
    label: 'Developer access',
    type: 'api',
    tooltip: 'Includes API access for integrating Tableu into your workflows.'
  },
  { key: 'prioritySupport', label: 'Priority support', type: 'tier-check', tiers: ['pro'] },
  { key: 'refundWindow', label: 'Refund window', type: 'refund' }
];

const mobileTopDifferences = [
  { title: 'Readings per month', detail: 'Seeker 5 · Plus 50 · Pro unlimited' },
  { title: 'Voice narration', detail: 'Seeker 3 · Plus 50 · Pro unlimited' },
  { title: 'Spread layouts', detail: 'Seeker 3 core · Plus all · Pro all + custom' },
  { title: 'Context memory', detail: 'Essential on Seeker · Deep on Plus/Pro' },
  { title: 'Developer access', detail: 'Pro includes developer tools' }
];

function ComparisonModal({ isOpen, onClose }) {
  const prefersReducedMotion = useReducedMotion();
  const tiers = ['free', 'plus', 'pro'];

  const renderValue = (feature, tier) => {
    const config = SUBSCRIPTION_TIERS[tier];

    switch (feature.type) {
      case 'count':
        return formatCount(config[feature.key]);
      case 'spreads':
        if (config.spreads === 'all+custom') return 'All + custom';
        if (config.spreads === 'all') return 'All 6 spreads';
        return '3 core spreads';
      case 'graphRAG':
        return config.graphRAGDepth === 'full' ? 'Full depth' : 'Limited';
      case 'boolean':
        return config[feature.key] ? (
          <Check className="mx-auto h-4 w-4 text-accent" weight="bold" />
        ) : (
          <X className="mx-auto h-4 w-4 text-secondary/50" />
        );
      case 'api':
        return config.apiAccess ? (
          <span>{config.apiCallsPerMonth?.toLocaleString()} calls/mo</span>
        ) : (
          <X className="mx-auto h-4 w-4 text-secondary/50" />
        );
      case 'tier-check':
        return feature.tiers?.includes(tier) ? (
          <Check className="mx-auto h-4 w-4 text-accent" weight="bold" />
        ) : (
          <X className="mx-auto h-4 w-4 text-secondary/50" />
        );
      case 'refund':
        return tier === 'free' ? (
          <span className="text-secondary/50">—</span>
        ) : (
          <span>7 days</span>
        );
      default:
        return '—';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
    >
      {/* Backdrop */}
      <div
        className={[
          'absolute inset-0 bg-black/70 backdrop-blur-sm',
          prefersReducedMotion ? '' : 'animate-fade-in'
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        className={[
          'relative max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-secondary/30 bg-main shadow-2xl',
          prefersReducedMotion ? '' : 'animate-scale-in'
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-secondary/20 px-6 py-4">
          <h2 id="comparison-modal-title" className="text-lg font-semibold text-main">
            Compare all features
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted transition hover:bg-secondary/20 hover:text-main"
            aria-label="Close comparison"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                  Feature
                </th>
                {tiers.map((tier) => (
                  <th
                    key={tier}
                    className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-muted"
                  >
                    {SUBSCRIPTION_TIERS[tier].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature, idx) => (
                <tr
                  key={feature.key}
                  className={idx < comparisonFeatures.length - 1 ? 'border-b border-secondary/20' : ''}
                >
                  <td className="px-4 py-2.5 text-secondary">
                    <span className="inline-flex items-center gap-1.5">
                      {feature.label}
                      {feature.tooltip && (
                        <span title={feature.tooltip} aria-label={feature.tooltip}>
                          <Info className="h-3.5 w-3.5 text-muted" />
                        </span>
                      )}
                    </span>
                  </td>
                  {tiers.map((tier) => (
                    <td key={tier} className="px-4 py-2.5 text-center text-main">
                      {renderValue(feature, tier)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        <div className="border-t border-secondary/20 px-6 py-3 text-center">
          <p className="text-xs text-muted">
            All paid plans include a 7-day refund window on first purchase
          </p>
        </div>
      </div>
    </div>
  );
}

const faqs = [
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. You can cancel Plus or Pro from your account settings. Your plan will stay active until the end of the current billing period.'
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'Stripe supports all major credit and debit cards, plus Apple Pay and Google Pay where available.'
  },
  {
    question: 'What happens when I hit my reading limit?',
    answer:
      'You keep access to your journal and past readings. New AI readings pause until your month renews or you upgrade tiers.'
  },
  {
    question: 'Do you offer refunds?',
    answer: 'We offer a 7-day refund window on first-time upgrades if the paid plan is not a fit.'
  }
];

function FAQItem({ item, index }) {
  const [open, setOpen] = useState(false);
  const questionId = `faq-question-${index}`;
  const answerId = `faq-answer-${index}`;

  return (
    <div className="rounded-2xl border border-secondary/30 bg-surface/80">
      <button
        type="button"
        id={questionId}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={answerId}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-main">{item.question}</span>
        <span className="text-xs text-muted" aria-hidden="true">{open ? '–' : '+'}</span>
      </button>
      <div
        id={answerId}
        role="region"
        aria-labelledby={questionId}
        hidden={!open}
        className={open ? 'px-4 pb-3' : ''}
      >
        {open && <p className="text-xs text-muted">{item.answer}</p>}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { tier: currentTier, loading: subscriptionLoading } = useSubscription();
  const prefersReducedMotion = useReducedMotion();
  const { publish } = useToast();

  const [loadingTier, setLoadingTier] = useState(null);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingTier, setPendingTier] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const tiers = ['free', 'plus', 'pro'];

  const handleSelectTier = useCallback(
    async (tier) => {
      setError('');

      // Free tier - just go to home
      if (tier === 'free') {
        navigate('/');
        return;
      }

      // Require authentication for paid tiers
      if (!isAuthenticated) {
        setPendingTier(tier);
        setShowAuthModal(true);
        return;
      }

      // Already on this tier
      if (tier === currentTier) {
        return;
      }

      try {
        setLoadingTier(tier);

        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            tier,
            successUrl: `${window.location.origin}/account?session_id={CHECKOUT_SESSION_ID}&upgrade=success`,
            cancelUrl: `${window.location.origin}/pricing`
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create checkout session');
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }
      } catch (err) {
        console.error('Checkout error:', err);
        setError(err.message || 'Unable to start checkout. Please try again.');
      } finally {
        setLoadingTier(null);
      }
    },
    [isAuthenticated, currentTier, navigate]
  );

  const handleRestorePurchases = useCallback(async () => {
    if (restoreLoading) return;
    if (!isAuthenticated) {
      setPendingRestore(true);
      setShowAuthModal(true);
      return;
    }

    setRestoreLoading(true);
    try {
      const response = await fetch('/api/subscription/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to restore purchases');
      }
      publish({
        title: 'Purchases restored',
        description: 'We refreshed your subscription status.',
        type: 'success'
      });
    } catch (err) {
      publish({
        title: 'Restore failed',
        description: err.message || 'Unable to restore purchases.',
        type: 'error'
      });
    } finally {
      setRestoreLoading(false);
    }
  }, [restoreLoading, isAuthenticated, publish]);

  const handleAuthModalClose = useCallback(() => {
    setShowAuthModal(false);
    if (pendingTier && isAuthenticated) {
      handleSelectTier(pendingTier);
    }
    if (pendingRestore && isAuthenticated) {
      handleRestorePurchases();
    }
    setPendingTier(null);
    setPendingRestore(false);
  }, [pendingTier, pendingRestore, isAuthenticated, handleSelectTier, handleRestorePurchases]);

  // Only show sticky CTA for confirmed free-tier users (not during loading)
  const showMobileSticky = !subscriptionLoading && currentTier === 'free';

  return (
    <div className="min-h-screen bg-main text-main">
<<<<<<< HEAD
      {/* Unified header with GlobalNav (includes UserMenu via withUserChip) - sticky with safe-area padding */}
      <header 
        className="sticky top-0 z-40 border-b border-secondary/20 bg-main/95 backdrop-blur-sm"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
          paddingLeft: 'max(env(safe-area-inset-left, 0px), 1rem)',
          paddingRight: 'max(env(safe-area-inset-right, 0px), 1rem)',
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-3">
          <GlobalNav condensed withUserChip />
=======
      {/* Header */}
      <header
        className="
          full-bleed sticky top-0 z-30
          bg-surface/95 backdrop-blur
          border-b border-secondary/20
          px-4 sm:px-5 md:px-6
          pr-[max(1rem,env(safe-area-inset-right))]
          pl-[max(1rem,env(safe-area-inset-left))]
          shadow-lg shadow-primary/20
          header-sticky
        "
      >
        <div className="mx-auto max-w-6xl py-3">
          <div className="header-sticky__row flex flex-wrap items-center gap-2 sm:gap-3 justify-between">
            <div className="header-sticky__nav flex-1 w-full sm:w-auto">
              <GlobalNav condensed withUserChip />
            </div>
            <div className="hidden sm:block">
              <div className="header-sticky__user header-sticky__user--fab">
                <UserMenu condensed />
              </div>
            </div>
          </div>
>>>>>>> 25ae633 (up)
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        {/* Hero */}
        <section className="mb-10 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Plans for deeper practice
            </p>
            <div className="space-y-3">
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl md:text-5xl">
                Keep every reading grounded and growing
              </h1>
              <p className="max-w-2xl text-sm text-muted sm:text-base">
                Start on Seeker, then step into Plus and Pro for deeper context, cloud-synced journals, and
                voice rituals each month.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => handleSelectTier('plus')}
                disabled={loadingTier !== null}
                className={[
                  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-md',
                  'bg-amber-500 text-neutral-900 hover:bg-amber-400',
                  prefersReducedMotion ? '' : 'transition hover:scale-[1.02]'
                ].join(' ')}
              >
                <Sparkle className="h-4 w-4" weight="fill" />
                Upgrade to Plus
                {loadingTier === 'plus' ? (
                  <CircleNotch className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSelectTier('pro')}
                disabled={loadingTier !== null}
                className={[
                  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold',
                  'border-2 border-secondary/60 bg-transparent text-main hover:border-amber-500/60 hover:bg-secondary/10',
                  prefersReducedMotion ? '' : 'transition hover:scale-[1.02]'
                ].join(' ')}
              >
                <Crown className="h-4 w-4" weight="fill" />
                Explore Pro
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSelectTier('free')}
              disabled={loadingTier !== null}
              className="mt-1 text-xs text-muted underline underline-offset-4"
            >
              Or stay on the Seeker plan for free
            </button>

            <button
              type="button"
              onClick={handleRestorePurchases}
              disabled={restoreLoading}
              className="text-xs text-muted underline underline-offset-4"
            >
              {restoreLoading ? 'Restoring purchases…' : 'Restore purchases'}
            </button>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {heroBenefits.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-2xl border border-secondary/30 bg-surface/80 px-3 py-2 backdrop-blur"
                >
                  <div className="rounded-full bg-accent/15 p-2">
                    <Icon className="h-4 w-4 text-accent" weight="fill" />
                  </div>
                  <p className="text-xs text-secondary sm:text-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop "plans at a glance" panel */}
          <div className="hidden rounded-3xl border border-secondary/30 bg-surface/80 p-6 lg:block">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Plans at a glance
                </p>
                <p className="mt-1 text-sm text-secondary">
                  From <span className="font-semibold text-main">$7.99/month</span>
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-main/80 px-3 py-1 text-[11px] text-muted">
                <Lightning className="h-3.5 w-3.5 text-accent" weight="fill" />
                <span>For steady readers & practitioners</span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {['plus', 'pro'].map((tier) => {
                const config = SUBSCRIPTION_TIERS[tier];
                const isCurrent = currentTier === tier;
                return (
                  <div
                    key={tier}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-secondary/30 bg-main/70 px-4 py-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                        {config.name}
                      </p>
                      <p className="text-sm text-main">
                        ${config.price}/mo · {formatCount(config.monthlyReadings)} readings
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatPerMonth(config.monthlyTTS)} voice narrations
                      </p>
                    </div>
                    {isCurrent ? (
                      <span className="rounded-full bg-primary/20 px-3 py-1 text-[11px] font-semibold text-primary">
                        Current
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectTier(tier)}
                        disabled={loadingTier !== null}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-neutral-900 hover:bg-amber-400 transition"
                      >
                        Choose
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {error && (
          <div className="mx-auto mb-8 max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Plans */}
        <section id="plans" className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Choose your path
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => {
              const config = SUBSCRIPTION_TIERS[tier];
              const isCurrent = currentTier === tier;
              return (
                <TierCard
                  key={tier}
                  tierKey={tier}
                  config={config}
                  isCurrent={isCurrent}
                  onSelect={handleSelectTier}
                  isLoading={loadingTier === tier}
                  disabled={loadingTier !== null}
                />
              );
            })}
          </div>
        </section>

        {/* Mobile differences accordion */}
        <section className="mb-10 lg:hidden">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Top differences
          </h2>
          <div className="space-y-2">
            {mobileTopDifferences.map((item) => (
              <MobileInfoSection key={item.title} title={item.title} variant="block">
                {item.detail}
              </MobileInfoSection>
            ))}
          </div>
        </section>

        {/* Compare Features Button */}
        <div className="mb-10 flex justify-center">
          <button
            type="button"
            onClick={() => setShowComparisonModal(true)}
            className={[
              'inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-surface/80 px-5 py-2.5 text-sm font-medium text-secondary backdrop-blur',
              'hover:border-accent/60 hover:text-main',
              prefersReducedMotion ? '' : 'transition'
            ].join(' ')}
          >
            <Table className="h-4 w-4" />
            Compare all features
          </button>
        </div>

        {/* Why upgrade */}
        <section className="mb-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-secondary/30 bg-surface/80 p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-main">
              <Sparkle className="h-4 w-4" weight="fill" />
              Keep context sacred
            </h3>
            <p className="text-sm text-muted">
              Plus and Pro preserve deep context memory so returning seekers feel seen without you repeating
              setup every time.
            </p>
          </div>
          <div className="rounded-3xl border border-secondary/30 bg-surface/80 p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-main">
              <Microphone className="h-4 w-4" weight="fill" />
              Rituals with voice
            </h3>
            <p className="text-sm text-muted">
              Narrate spreads out loud and let seekers replay them later with generous voice narration limits.
            </p>
          </div>
          <div className="rounded-3xl border border-secondary/30 bg-surface/80 p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-main">
              <CloudArrowUp className="h-4 w-4" weight="fill" />
              Journals that travel
            </h3>
            <p className="text-sm text-muted">
              Cloud sync keeps readings and reflections backed up across devices for long-term seekers.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Common questions
          </h2>
          <div className="space-y-3">
            {faqs.map((item, index) => (
              <FAQItem key={item.question} item={item} index={index} />
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-secondary/20 pt-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Ready to deepen your practice?
              </p>
              <p className="mt-1 text-sm text-secondary">
                Start a reading, then upgrade when you&apos;re ready for more ritual, context, and monetization.
              </p>
            </div>
            <Link
              to="/"
              className={[
                'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold',
                'bg-main/90 text-accent border border-secondary/40',
                prefersReducedMotion ? '' : 'transition hover:scale-[1.02]'
              ].join(' ')}
            >
              <Lightning className="h-4 w-4" weight="fill" />
              Start a Reading Now
            </Link>
          </div>
          <button
            type="button"
            onClick={handleRestorePurchases}
            disabled={restoreLoading}
            className="mt-4 text-xs text-muted underline underline-offset-4"
          >
            {restoreLoading ? 'Restoring purchases…' : 'Restore purchases'}
          </button>
        </section>
      </main>

      {/* Sticky mobile CTA */}
      {showMobileSticky && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-secondary/40 bg-main/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="text-xs text-muted">
              <p className="font-semibold text-main">Upgrade to Plus</p>
              <p>$7.99/month · cancel anytime</p>
            </div>
            <button
              type="button"
              onClick={() => handleSelectTier('plus')}
              disabled={loadingTier !== null}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-xs font-semibold text-neutral-900 shadow-md hover:bg-amber-400 transition"
            >
              Go Plus
              {loadingTier === 'plus' ? (
                <CircleNotch className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={handleAuthModalClose} />

      {/* Comparison Modal */}
      <ComparisonModal isOpen={showComparisonModal} onClose={() => setShowComparisonModal(false)} />
    </div>
  );
}
