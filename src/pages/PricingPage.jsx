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
            ? 'border border-accent/40 bg-transparent text-accent cursor-default'
            : isPaid
              ? 'border border-accent bg-accent text-main hover:bg-accent/90'
              : 'border border-secondary/60 bg-transparent text-main hover:bg-secondary/10'
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

  const tiers = ['free', 'plus', 'pro'];

  // Feature comparison data
  const features = [
    { feature: 'AI Readings per Month', free: '5', plus: '50', pro: 'Unlimited' },
    { feature: 'Voice Narrations', free: '3/mo', plus: '50/mo', pro: 'Unlimited' },
    { feature: 'Basic Spreads (1-5 cards)', free: true, plus: true, pro: true },
    { feature: 'Advanced Spreads (Celtic Cross)', free: false, plus: true, pro: true },
    { feature: 'AI Question Suggestions', free: false, plus: true, pro: true, highlight: true },
    { feature: 'Cloud Journal Sync', free: false, plus: true, pro: true },
    { feature: 'Advanced Insights & Analytics', free: false, plus: true, pro: true },
    { feature: 'Full GraphRAG Context', free: false, plus: true, pro: true },
    { feature: 'Ad-Free Experience', free: false, plus: true, pro: true },
    { feature: 'Custom Spread Builder', free: false, plus: false, pro: true, highlight: true },
    { feature: 'API Access', free: false, plus: false, pro: '1,000 calls/mo' },
    { feature: 'Priority Support', free: false, plus: false, pro: true }
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
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 mb-6">
            <Sparkle className="h-4 w-4 text-accent" weight="fill" />
            <span className="text-sm text-accent">Unlock deeper readings</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl text-main mb-4">
            Choose Your Path
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            From casual seekers to devoted practitioners, find the plan that matches your journey with the cards.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-md mx-auto mb-8 rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-center">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

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
                        ? 'border border-accent/40 bg-transparent text-accent cursor-default'
                        : isPaid
                          ? 'border border-accent bg-accent text-main hover:bg-accent/90'
                          : 'border border-secondary/60 bg-transparent text-main hover:bg-secondary/10'
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
                Yes! You can cancel your subscription at any time. You'll continue to have access to your plan's features until the end of your billing period.
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
                Once you reach your monthly AI reading limit, you can still draw cards and perform manual readings. You'll be invited to upgrade for more AI-powered interpretations.
              </p>
            </details>
            <details className="group rounded-2xl border border-secondary/30 bg-surface p-4">
              <summary className="flex items-center justify-between cursor-pointer text-main font-medium">
                Do you offer refunds?
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-muted">
                If you're not satisfied within the first 7 days of your subscription, contact us for a full refund. We want you to feel confident in your choice.
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
