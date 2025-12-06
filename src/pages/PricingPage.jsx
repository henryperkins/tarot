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
  Code,
  ArrowRight,
  CircleNotch,
  Cards,
  Moon
} from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import AuthModal from '../components/AuthModal';

/**
 * Feature row for comparison table
 */
function FeatureRow({ feature, free, plus, pro, highlight = false }) {
  const renderValue = (val) => {
    if (val === true) {
      return <Check className="h-5 w-5 text-accent mx-auto" weight="bold" />;
    }
    if (val === false) {
      return <X className="h-5 w-5 text-muted/40 mx-auto" weight="bold" />;
    }
    return <span className="text-sm text-main">{val}</span>;
  };

  return (
    <div className={`grid grid-cols-4 gap-4 py-3 ${highlight ? 'bg-accent/5 -mx-4 px-4 rounded-xl' : ''}`}>
      <div className="text-sm text-secondary">{feature}</div>
      <div className="text-center">{renderValue(free)}</div>
      <div className="text-center">{renderValue(plus)}</div>
      <div className="text-center">{renderValue(pro)}</div>
    </div>
  );
}

/**
 * Tier card for mobile/responsive view
 */
function TierCard({ tier, config, isCurrentTier, onSelect, isLoading, disabled }) {
  const prefersReducedMotion = useReducedMotion();
  const isPaid = tier !== 'free';

  const tierIcons = {
    free: Moon,
    plus: Sparkle,
    pro: Crown
  };

  const TierIcon = tierIcons[tier];

  return (
    <div
      className={`
        relative rounded-3xl border p-6 transition-all
        ${isCurrentTier
          ? 'border-accent bg-accent/5 ring-2 ring-accent/30'
          : 'border-secondary/40 bg-surface hover:border-accent/50'
        }
        ${tier === 'plus' ? 'lg:scale-105 lg:shadow-xl lg:shadow-accent/10' : ''}
      `}
    >
      {tier === 'plus' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-main">
            <Star className="h-3 w-3" weight="fill" />
            Most Popular
          </span>
        </div>
      )}

      {isCurrentTier && (
        <div className="absolute -top-3 right-4">
          <span className="inline-flex items-center rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
            Current Plan
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <div className={`inline-flex rounded-full p-3 mb-3 ${isPaid ? 'bg-accent/20' : 'bg-secondary/20'}`}>
          <TierIcon className={`h-8 w-8 ${isPaid ? 'text-accent' : 'text-secondary'}`} weight="fill" />
        </div>
        <h3 className="font-serif text-2xl text-main">{config.name}</h3>
        <p className="text-xs uppercase tracking-[0.2em] text-muted mt-1">{config.label}</p>
      </div>

      <div className="text-center mb-6">
        {isPaid ? (
          <>
            <span className="text-4xl font-bold text-main">${config.price}</span>
            <span className="text-muted">/month</span>
          </>
        ) : (
          <span className="text-4xl font-bold text-main">Free</span>
        )}
      </div>

      <ul className="space-y-3 mb-6">
        <li className="flex items-center gap-2 text-sm">
          <Cards className="h-4 w-4 text-accent shrink-0" />
          <span className="text-secondary">
            {config.monthlyReadings === Infinity ? 'Unlimited' : config.monthlyReadings} AI readings/month
          </span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          <Microphone className="h-4 w-4 text-accent shrink-0" />
          <span className="text-secondary">
            {config.monthlyTTS === Infinity ? 'Unlimited' : config.monthlyTTS} voice narrations/month
          </span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          {config.aiQuestions ? (
            <Check className="h-4 w-4 text-accent shrink-0" />
          ) : (
            <X className="h-4 w-4 text-muted/40 shrink-0" />
          )}
          <span className={config.aiQuestions ? 'text-secondary' : 'text-muted'}>
            AI question suggestions
          </span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          {config.cloudJournal ? (
            <Check className="h-4 w-4 text-accent shrink-0" />
          ) : (
            <X className="h-4 w-4 text-muted/40 shrink-0" />
          )}
          <span className={config.cloudJournal ? 'text-secondary' : 'text-muted'}>
            Cloud journal sync
          </span>
        </li>
        <li className="flex items-center gap-2 text-sm">
          {config.advancedInsights ? (
            <Check className="h-4 w-4 text-accent shrink-0" />
          ) : (
            <X className="h-4 w-4 text-muted/40 shrink-0" />
          )}
          <span className={config.advancedInsights ? 'text-secondary' : 'text-muted'}>
            Advanced insights
          </span>
        </li>
        {tier === 'pro' && (
          <li className="flex items-center gap-2 text-sm">
            <Code className="h-4 w-4 text-accent shrink-0" />
            <span className="text-secondary">API access ({config.apiCallsPerMonth} calls/mo)</span>
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(tier)}
        disabled={disabled || isCurrentTier || isLoading}
        className={`
          w-full rounded-full py-3 px-6 text-sm font-semibold transition
          ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
          ${isCurrentTier
            ? 'border border-accent/60 bg-accent/10 text-main cursor-default'
            : isPaid
              ? 'border border-accent bg-accent text-main hover:bg-accent/90 shadow-sm'
              : 'border border-secondary/60 bg-surface-muted/60 text-main hover:bg-secondary/20 shadow-sm'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isLoading ? (
          <CircleNotch className="h-5 w-5 animate-spin mx-auto" />
        ) : isCurrentTier ? (
          'Current Plan'
        ) : isPaid ? (
          <span className="inline-flex items-center gap-2">
            <Crown className="h-4 w-4" weight="fill" />
            Upgrade to {config.label}
          </span>
        ) : (
          'Get Started Free'
        )}
      </button>
    </div>
  );
}

/**
 * PricingPage - Full pricing page with tier comparison and Stripe checkout
 */
export default function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { tier: currentTier, loading: subscriptionLoading } = useSubscription();
  const prefersReducedMotion = useReducedMotion();

  const [loadingTier, setLoadingTier] = useState(null);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingTier, setPendingTier] = useState(null);

  const tiers = ['free', 'plus', 'pro'];
  const tierOrderMap = { free: 0, plus: 1, pro: 2 };

  const handleSelectTier = useCallback(async (tier) => {
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

    // Create checkout session
    setLoadingTier(tier);
    try {
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

      // Redirect to Stripe Checkout
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
  }, [isAuthenticated, currentTier, navigate]);

  // Handle auth modal close - continue to checkout if user logged in with pending tier
  const handleAuthModalClose = useCallback(() => {
    setShowAuthModal(false);
    if (pendingTier && isAuthenticated) {
      handleSelectTier(pendingTier);
    }
    setPendingTier(null);
  }, [pendingTier, isAuthenticated, handleSelectTier]);

  const formatMonthly = (value) => (value === Infinity ? 'Unlimited' : `${value}/mo`);
  const formatCount = (value) => (value === Infinity ? 'Unlimited' : value);
  const hasCustomSpreads = (tierConfig) => tierConfig.spreads === 'all+custom';
  const hasAdvancedSpreads = (tierConfig) => tierConfig.spreads === 'all' || tierConfig.spreads === 'all+custom';

  // Feature comparison data
  const features = [
    {
      feature: 'AI Readings per Month',
      free: formatCount(SUBSCRIPTION_TIERS.free.monthlyReadings),
      plus: formatCount(SUBSCRIPTION_TIERS.plus.monthlyReadings),
      pro: formatCount(SUBSCRIPTION_TIERS.pro.monthlyReadings)
    },
    {
      feature: 'Voice Narrations',
      free: formatMonthly(SUBSCRIPTION_TIERS.free.monthlyTTS),
      plus: formatMonthly(SUBSCRIPTION_TIERS.plus.monthlyTTS),
      pro: formatMonthly(SUBSCRIPTION_TIERS.pro.monthlyTTS)
    },
    { feature: 'Basic Spreads (1-5 cards)', free: true, plus: true, pro: true },
    {
      feature: 'Advanced Spreads (Celtic Cross)',
      free: hasAdvancedSpreads(SUBSCRIPTION_TIERS.free),
      plus: hasAdvancedSpreads(SUBSCRIPTION_TIERS.plus),
      pro: hasAdvancedSpreads(SUBSCRIPTION_TIERS.pro)
    },
    { feature: 'AI Question Suggestions', free: SUBSCRIPTION_TIERS.free.aiQuestions, plus: SUBSCRIPTION_TIERS.plus.aiQuestions, pro: SUBSCRIPTION_TIERS.pro.aiQuestions, highlight: true },
    { feature: 'Cloud Journal Sync', free: SUBSCRIPTION_TIERS.free.cloudJournal, plus: SUBSCRIPTION_TIERS.plus.cloudJournal, pro: SUBSCRIPTION_TIERS.pro.cloudJournal },
    { feature: 'Advanced Insights & Analytics', free: SUBSCRIPTION_TIERS.free.advancedInsights, plus: SUBSCRIPTION_TIERS.plus.advancedInsights, pro: SUBSCRIPTION_TIERS.pro.advancedInsights },
    { feature: 'Full GraphRAG Context', free: SUBSCRIPTION_TIERS.free.graphRAGDepth === 'full', plus: SUBSCRIPTION_TIERS.plus.graphRAGDepth === 'full', pro: SUBSCRIPTION_TIERS.pro.graphRAGDepth === 'full' },
    { feature: 'Ad-Free Experience', free: SUBSCRIPTION_TIERS.free.adFree, plus: SUBSCRIPTION_TIERS.plus.adFree, pro: SUBSCRIPTION_TIERS.pro.adFree },
    { feature: 'Custom Spread Builder', free: false, plus: hasCustomSpreads(SUBSCRIPTION_TIERS.plus), pro: hasCustomSpreads(SUBSCRIPTION_TIERS.pro), highlight: true },
    { feature: 'API Access', free: false, plus: false, pro: SUBSCRIPTION_TIERS.pro.apiAccess ? `${SUBSCRIPTION_TIERS.pro.apiCallsPerMonth} calls/mo` : false },
    { feature: 'Priority Support', free: false, plus: false, pro: true }
  ];

  const valueProps = [
    {
      title: 'Context that stays true',
      description: 'GraphRAG semantic scoring keeps prompts grounded in the querent\'s story so premium users feel the difference.',
      icon: Sparkle
    },
    {
      title: 'Voice & ritual built-in',
      description: 'Narrate readings, guide intentions, and keep seekers engaged with ambient UX that feels premium.',
      icon: Microphone
    },
    {
      title: 'Cloud-safe journals',
      description: 'Cloud sync and backups keep notes safe while you upsell ad-free focus and advanced insights.',
      icon: CloudArrowUp
    }
  ];

  const planHighlights = [
    {
      tier: 'plus',
      title: 'Plus amplifies weekly readers',
      bullets: [
        `${SUBSCRIPTION_TIERS.plus.monthlyReadings} AI readings and ${SUBSCRIPTION_TIERS.plus.monthlyTTS} narrations each month`,
        'AI-generated question prompts to unblock seekers',
        'Cloud journal sync, advanced insights, and ad-free sessions'
      ]
    },
    {
      tier: 'pro',
      title: 'Pro is built for practitioners and builders',
      bullets: [
        `${SUBSCRIPTION_TIERS.pro.monthlyReadings === Infinity ? 'Unlimited' : SUBSCRIPTION_TIERS.pro.monthlyReadings} AI readings plus unlimited narration`,
        'Custom spreads with full GraphRAG depth and advanced insights',
        `API access with ${SUBSCRIPTION_TIERS.pro.apiCallsPerMonth} calls each month`
      ]
    }
  ];

  const heroStats = [
    {
      label: 'GraphRAG context',
      detail: 'Paid tiers keep full passages & scoring',
      icon: Eye
    },
    {
      label: 'Upgrade gates',
      detail: 'AI questions + cloud sync are Plus+',
      icon: Lightning
    },
    {
      label: 'Power features',
      detail: 'Unlimited + API for practitioners',
      icon: Code
    }
  ];

  const heroBenefits = [
    {
      label: 'GraphRAG stays intact on paid plans',
      icon: Eye
    },
    {
      label: 'AI questions + cloud sync unlock at Plus',
      icon: Sparkle
    },
    {
      label: 'Unlimited readings & API reserved for Pro',
      icon: Lightning
    },
    {
      label: 'Stripe checkout ready with refund support',
      icon: CloudArrowUp
    }
  ];

  const upgradeMoments = [
    {
      tier: 'plus',
      badge: 'Weekly readers',
      title: 'Lock in Plus before you hit the limits',
      bullets: [
        `${SUBSCRIPTION_TIERS.plus.monthlyReadings} AI readings + ${SUBSCRIPTION_TIERS.plus.monthlyTTS} narrations per month`,
        'AI question prompts, cloud journal sync, and ad-free focus',
        'Best for seekers who rely on guided readings every week'
      ]
    },
    {
      tier: 'pro',
      badge: 'Practitioners & builders',
      title: 'Pro keeps your practice premium',
      bullets: [
        'Unlimited readings and narration with full GraphRAG depth',
        `Custom spreads and ${SUBSCRIPTION_TIERS.pro.apiCallsPerMonth} API calls for client portals`,
        'For readers who sell sessions or automate tarot workflows'
      ]
    }
  ];

  const paidPerks = [
    {
      label: 'AI question suggestions',
      detail: 'Plus & Pro unlock guided prompts so seekers never get stuck.',
      icon: Sparkle
    },
    {
      label: 'Cloud journal sync',
      detail: 'Keep notes safe across devices with backups for every reading.',
      icon: CloudArrowUp
    },
    {
      label: 'Ad-free focus',
      detail: 'Remove distractions during spreads and rituals on paid plans.',
      icon: Moon
    },
    {
      label: 'Full GraphRAG depth',
      detail: 'Premium tiers keep full passages and semantic scoring intact.',
      icon: Eye
    }
  ];

  return (
    <div className="min-h-screen bg-main text-main">
      {/* Header */}
      <header className="border-b border-secondary/20">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-accent hover:text-accent/80 transition">
            <Eye className="h-6 w-6" weight="duotone" />
            <span className="font-serif text-xl">Tableu</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm text-muted hover:text-main transition">
              Reading
            </Link>
            <Link to="/journal" className="text-sm text-muted hover:text-main transition">
              Journal
            </Link>
      </nav>
    </div>
  </header>

  <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[32px] border border-secondary/30 bg-gradient-to-br from-primary/10 via-surface to-surface-muted p-6 md:p-10 mb-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-12 -top-20 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute -right-16 top-6 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-32 w-72 rounded-full bg-secondary/10 blur-3xl" />
          </div>

          <div className="relative grid items-center gap-10 md:grid-cols-[1.05fr,0.95fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2 text-xs font-semibold text-accent">
                <Sparkle className="h-4 w-4" weight="fill" />
                Monetization ready
              </div>
              <h1 className="font-serif text-4xl md:text-5xl text-main leading-tight">
                Earn while keeping seekers grounded
              </h1>
              <p className="text-lg text-muted max-w-2xl">
                Paid tiers preserve full GraphRAG context, premium rituals, and a clear upgrade path—so free users try everything once and know exactly why to convert.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {heroBenefits.map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-2xl border border-secondary/30 bg-surface/80 px-3 py-2 backdrop-blur"
                  >
                    <div className="rounded-full bg-accent/15 p-2">
                      <Icon className="h-4 w-4 text-accent" weight="fill" />
                    </div>
                    <p className="text-sm text-secondary">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectTier('plus')}
                  disabled={loadingTier !== null}
                  className={`
                    inline-flex items-center gap-2 rounded-full border border-accent bg-accent px-6 py-3 text-sm font-semibold text-main shadow-sm
                    ${prefersReducedMotion ? '' : 'hover:scale-[1.02] transition'}
                    disabled:opacity-60 disabled:cursor-not-allowed
                  `}
                >
                  <Sparkle className="h-4 w-4" weight="fill" />
                  Upgrade to Plus
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTier('pro')}
                  disabled={loadingTier !== null}
                  className={`
                    inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-surface px-6 py-3 text-sm font-semibold text-main
                    ${prefersReducedMotion ? '' : 'hover:scale-[1.02] transition'}
                    disabled:opacity-60 disabled:cursor-not-allowed
                  `}
                >
                  <Crown className="h-4 w-4" weight="fill" />
                  Go Pro
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTier('free')}
                  disabled={loadingTier !== null}
                  className={`
                    inline-flex items-center gap-2 rounded-full border border-secondary/40 px-6 py-3 text-sm font-semibold text-main
                    ${prefersReducedMotion ? '' : 'hover:scale-[1.02] transition'}
                    disabled:opacity-60 disabled:cursor-not-allowed
                  `}
                >
                  <Cards className="h-4 w-4" weight="fill" />
                  Start free
                </button>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" weight="bold" />
                  Cancel anytime
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" weight="bold" />
                  7-day refund window for paid tiers
                </span>
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" weight="bold" />
                  Secure Stripe checkout
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-secondary/40 bg-surface/90 p-6 shadow-2xl shadow-accent/10">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">Plan snapshot</p>
                  <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                    <Lightning className="h-3.5 w-3.5" weight="fill" />
                    Conversion ready
                  </span>
                </div>

                <div className="space-y-3">
                  {tiers.map((tier) => {
                    const config = SUBSCRIPTION_TIERS[tier];
                    const isPaid = tier !== 'free';
                    const isCurrent = currentTier === tier;
                    const tierIcons = { free: Moon, plus: Sparkle, pro: Crown };
                    const TierIcon = tierIcons[tier];

                    return (
                      <div
                        key={tier}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                          isPaid ? 'border-accent/40 bg-accent/5' : 'border-secondary/30 bg-surface-muted/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full p-2 ${isPaid ? 'bg-accent/20' : 'bg-secondary/20'}`}>
                            <TierIcon className={`h-5 w-5 ${isPaid ? 'text-accent' : 'text-secondary'}`} weight="fill" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-main">{config.name}</p>
                            <p className="text-xs text-muted">
                              {isPaid ? `$${config.price}/mo • ${config.label}` : 'Start free • Seeker'}
                            </p>
                          </div>
                        </div>
                        {isCurrent ? (
                          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                            Current
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectTier(tier)}
                            disabled={loadingTier !== null}
                            className={`
                              inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold
                              border ${isPaid ? 'border-accent text-main' : 'border-secondary/50 text-secondary'}
                              ${prefersReducedMotion ? '' : 'hover:scale-[1.02] transition'}
                              disabled:opacity-60 disabled:cursor-not-allowed
                            `}
                          >
                            {isPaid ? 'Upgrade' : 'Choose'}
                            {!prefersReducedMotion && <ArrowRight className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {heroStats.map(({ label, detail, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-secondary/30 bg-surface-muted/60 px-3 py-2.5 flex items-start gap-3"
                    >
                      <div className="rounded-full bg-accent/15 p-2">
                        <Icon className="h-4 w-4 text-accent" weight="bold" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
                        <p className="text-sm text-main">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Error Message */}
        {error && (
          <div className="max-w-md mx-auto mb-8 rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-center">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Upgrade Moments */}
        <div className="grid gap-4 md:grid-cols-2 mb-10">
          {upgradeMoments.map(({ tier, badge, title, bullets }) => {
            const config = SUBSCRIPTION_TIERS[tier];
            const isCurrent = currentTier === tier;
            const currentOrder = tierOrderMap[currentTier] ?? 0;
            const targetOrder = tierOrderMap[tier] ?? 0;
            const alreadyCovered = currentOrder > targetOrder;
            const disabled = loadingTier !== null || isCurrent || alreadyCovered;

            return (
              <div
                key={tier}
                className={`rounded-3xl border p-5 flex flex-col gap-3 ${
                  tier === 'pro'
                    ? 'border-accent/50 bg-gradient-to-br from-accent/10 via-surface to-surface-muted'
                    : 'border-secondary/30 bg-surface/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                    <Sparkle className="h-4 w-4" weight="fill" />
                    {badge}
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{config.label}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl text-main">{title}</h3>
                    <p className="text-sm text-muted">${config.price}/mo • {config.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTier(tier)}
                    disabled={disabled}
                    className={`
                      inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold
                      border ${isCurrent
                        ? 'border-accent/60 bg-accent/12 text-main cursor-default'
                        : tier === 'pro'
                          ? 'border-accent bg-accent text-main shadow-sm'
                          : 'border-secondary/40 bg-surface text-main shadow-sm'}
                      ${prefersReducedMotion ? '' : 'hover:scale-[1.02] transition'}
                      disabled:opacity-60 disabled:cursor-not-allowed
                    `}
                  >
                    {loadingTier === tier ? (
                      <CircleNotch className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {isCurrent ? 'Current plan' : alreadyCovered ? 'Included' : `Upgrade to ${config.label}`}
                        {!disabled && <ArrowRight className="h-4 w-4" />}
                      </>
                    )}
                  </button>
                </div>
                <ul className="space-y-2">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-secondary">
                      <Check className="h-4 w-4 text-accent shrink-0" weight="bold" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Value Props */}
        <div className="grid gap-4 md:grid-cols-3 mb-10">
          {valueProps.map(({ title, description, icon: Icon }) => (
            <div key={title} className="rounded-3xl border border-secondary/30 bg-surface p-5 flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                <Icon className="h-4 w-4" weight="fill" />
                Monetization win
              </div>
              <h3 className="font-serif text-xl text-main">{title}</h3>
              <p className="text-sm text-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Paid Perks callout */}
        <div className="rounded-3xl border border-secondary/30 bg-gradient-to-br from-surface via-surface to-accent/5 p-6 mb-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                <Sparkle className="h-4 w-4" weight="fill" />
                Plus & Pro perks
              </div>
              <p className="text-sm text-muted">
                Upsell the features seekers feel immediately—then keep them with focus and depth.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSelectTier('plus')}
              disabled={loadingTier !== null}
              className={`
                inline-flex items-center gap-2 rounded-full border border-accent bg-accent px-4 py-2 text-sm font-semibold text-main shadow-sm
                ${prefersReducedMotion ? '' : 'hover:scale-[1.02] transition'}
                disabled:opacity-60 disabled:cursor-not-allowed
              `}
            >
              <Sparkle className="h-4 w-4" weight="fill" />
              Upgrade now
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {paidPerks.map(({ label, detail, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-secondary/20 bg-surface-muted/60 p-3 flex items-start gap-3"
              >
                <div className="rounded-full bg-accent/15 p-2">
                  <Icon className="h-4 w-4 text-accent" weight="fill" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-main">{label}</p>
                  <p className="text-xs text-muted leading-snug">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier Cards - Mobile/Tablet View */}
        <div className="grid gap-6 md:grid-cols-3 lg:hidden mb-12">
          {tiers.map((tier) => (
            <TierCard
              key={tier}
              tier={tier}
              config={SUBSCRIPTION_TIERS[tier]}
              isCurrentTier={currentTier === tier}
              onSelect={handleSelectTier}
              isLoading={loadingTier === tier}
              disabled={loadingTier !== null && loadingTier !== tier}
            />
          ))}
        </div>

        {/* Plan Highlights */}
        <div className="hidden lg:grid grid-cols-2 gap-4 mb-12">
          {planHighlights.map(({ tier, title, bullets }) => {
            const config = SUBSCRIPTION_TIERS[tier];
            const isPro = tier === 'pro';
            const currentOrder = tierOrderMap[currentTier] ?? 0;
            const targetOrder = tierOrderMap[tier] ?? 0;
            const alreadyCovered = currentOrder > targetOrder;
            const isCurrent = currentTier === tier;
            const disabled = loadingTier !== null || isCurrent || alreadyCovered;
            const ctaLabel = isCurrent
              ? 'Current Plan'
              : alreadyCovered
                ? 'Included'
                : tier === 'pro'
                  ? 'Upgrade to Pro'
                  : 'Upgrade to Plus';
            return (
              <div
                key={tier}
                className={`rounded-3xl border p-6 flex flex-col gap-4 ${
                  isPro
                    ? 'border-accent/50 bg-gradient-to-br from-accent/10 via-surface to-surface-muted'
                    : 'border-secondary/30 bg-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  {tier === 'pro' ? (
                    <Crown className="h-5 w-5 text-accent" weight="fill" />
                  ) : (
                    <Sparkle className="h-5 w-5 text-accent" weight="fill" />
                  )}
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{config.label}</p>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-2xl text-main">{title}</h3>
                    <p className="text-sm text-muted">
                      ${config.price}/mo • {config.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTier(tier)}
                    disabled={disabled}
                    className={`
                      inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold
                      border ${isCurrent
                        ? 'border-accent/60 bg-accent/12 text-main cursor-default'
                        : isPro
                          ? 'border-accent bg-accent text-main shadow-sm'
                          : 'border-accent/60 bg-accent/12 text-main shadow-sm'}
                      ${prefersReducedMotion ? '' : 'hover:scale-[1.02] transition'}
                      disabled:opacity-60 disabled:cursor-not-allowed
                    `}
                  >
                    {loadingTier === tier ? (
                      <CircleNotch className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {ctaLabel}
                        {!disabled && <ArrowRight className="h-4 w-4" />}
                      </>
                    )}
                  </button>
                </div>
                <ul className="space-y-2">
                  {bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-secondary">
                      <Check className="h-4 w-4 text-accent shrink-0" weight="bold" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Desktop Feature Comparison Table */}
        <div className="hidden lg:block rounded-3xl border border-secondary/40 bg-surface p-8 mb-12">
          {/* Table Header */}
          <div className="grid grid-cols-4 gap-4 pb-6 border-b border-secondary/20">
            <div></div>
            {tiers.map((tier) => {
              const config = SUBSCRIPTION_TIERS[tier];
              const isPaid = tier !== 'free';
              const tierIcons = { free: Moon, plus: Sparkle, pro: Crown };
              const TierIcon = tierIcons[tier];

              return (
                <div key={tier} className="text-center">
                  <div className={`inline-flex rounded-full p-2 mb-2 ${isPaid ? 'bg-accent/20' : 'bg-secondary/20'}`}>
                    <TierIcon className={`h-6 w-6 ${isPaid ? 'text-accent' : 'text-secondary'}`} weight="fill" />
                  </div>
                  <h3 className="font-serif text-xl text-main">{config.name}</h3>
                  <p className="text-xs uppercase tracking-[0.15em] text-muted">{config.label}</p>
                  <div className="mt-2">
                    {isPaid ? (
                      <span className="text-2xl font-bold text-main">${config.price}<span className="text-sm text-muted font-normal">/mo</span></span>
                    ) : (
                      <span className="text-2xl font-bold text-main">Free</span>
                    )}
                  </div>
                  {tier === 'plus' && (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs text-accent">
                      <Star className="h-3 w-3" weight="fill" />
                      Most Popular
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feature Rows */}
          <div className="divide-y divide-secondary/10 py-4">
            {features.map((row) => (
              <FeatureRow
                key={row.feature}
                feature={row.feature}
                free={row.free}
                plus={row.plus}
                pro={row.pro}
                highlight={row.highlight}
              />
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="grid grid-cols-4 gap-4 pt-6 border-t border-secondary/20">
            <div></div>
            {tiers.map((tier) => {
              const config = SUBSCRIPTION_TIERS[tier];
              const isPaid = tier !== 'free';
              const isCurrent = currentTier === tier;

              return (
                <div key={tier} className="text-center">
                  <button
                    type="button"
                    onClick={() => handleSelectTier(tier)}
                    disabled={isCurrent || loadingTier !== null}
                    className={`
                      w-full rounded-full py-3 px-4 text-sm font-semibold transition
                      ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
                      ${isCurrent
                        ? 'border border-accent/60 bg-accent/10 text-main cursor-default'
                        : isPaid
                          ? 'border border-accent bg-accent text-main hover:bg-accent/90 shadow-sm'
                          : 'border border-secondary/60 bg-surface-muted/60 text-main hover:bg-secondary/20 shadow-sm'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {loadingTier === tier ? (
                      <CircleNotch className="h-5 w-5 animate-spin mx-auto" />
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : isPaid ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        Upgrade <ArrowRight className="h-4 w-4" />
                      </span>
                    ) : (
                      'Get Started'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-2xl text-center text-main mb-8">Common Questions</h2>
          <div className="space-y-4">
            <details className="group rounded-2xl border border-secondary/30 bg-surface p-4">
              <summary className="flex items-center justify-between cursor-pointer text-main font-medium">
                Can I cancel anytime?
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-muted">
                Yes! You can cancel your subscription at any time. You&apos;ll continue to have access to your plan&apos;s features until the end of your billing period.
              </p>
            </details>
            <details className="group rounded-2xl border border-secondary/30 bg-surface p-4">
              <summary className="flex items-center justify-between cursor-pointer text-main font-medium">
                What payment methods do you accept?
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-muted">
                We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.
              </p>
            </details>
            <details className="group rounded-2xl border border-secondary/30 bg-surface p-4">
              <summary className="flex items-center justify-between cursor-pointer text-main font-medium">
                What happens when I hit my reading limit?
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-muted">
                Once you reach your monthly AI reading limit, you can still draw cards and perform manual readings. You&apos;ll be invited to upgrade for more AI-powered interpretations.
              </p>
            </details>
            <details className="group rounded-2xl border border-secondary/30 bg-surface p-4">
              <summary className="flex items-center justify-between cursor-pointer text-main font-medium">
                Do you offer refunds?
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-muted">
                If you&apos;re not satisfied within the first 7 days of your subscription, contact us for a full refund. We want you to feel confident in your choice.
              </p>
            </details>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12 pt-12 border-t border-secondary/20">
          <p className="text-muted mb-4">Ready to deepen your practice?</p>
          <Link
            to="/"
            className={`
              inline-flex items-center gap-2 rounded-full border border-primary/60 px-6 py-3
              text-sm font-medium text-main hover:bg-primary/10 transition
              ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
            `}
          >
            <Lightning className="h-4 w-4" />
            Start a Reading Now
          </Link>
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
      />
    </div>
  );
}
