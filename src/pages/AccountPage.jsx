import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Crown,
  Sparkle,
  Moon,
  SignOut,
  BookOpen,
  Eye,
  CreditCard,
  ArrowRight,
  CircleNotch,
  Check,
  CaretRight,
  Envelope,
  ChartLine
} from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useToast } from '../contexts/ToastContext';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * Settings toggle component - matches UserMenu style
 */
function SettingsToggle({ id, label, description, enabled, loading, onChange, error }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <label htmlFor={id} className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-main">{label}</p>
        {description && <p className="text-xs text-muted leading-tight mt-0.5">{description}</p>}
      </label>
      <button
        id={id}
        role="switch"
        onClick={onChange}
        disabled={loading || enabled === null}
        className={`
          relative inline-flex h-7 w-12 shrink-0 items-center rounded-full
          transition-colors touch-manipulation
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
          focus-visible:ring-offset-2 focus-visible:ring-offset-surface
          ${enabled ? 'bg-primary' : 'bg-secondary/30'}
          ${loading || enabled === null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-checked={enabled === true}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`
            inline-block h-5 w-5 transform rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
          aria-hidden="true"
        />
      </button>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}

/**
 * Account section card
 */
function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-secondary/30 bg-surface overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-secondary/20 bg-surface-muted/50">
          {Icon && <Icon className="h-4 w-4 text-accent" weight="duotone" />}
          <h2 className="text-sm font-semibold text-main">{title}</h2>
        </div>
      )}
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
}

/**
 * AccountPage - User account and subscription management
 */
export default function AccountPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();
  const { tier, subscription, loading: subLoading } = useSubscription();
  const { resetOnboarding } = usePreferences();
  const { publish } = useToast();
  const prefersReducedMotion = useReducedMotion();

  // Analytics preferences state (mirrored from UserMenu)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState(null);

  // Handle upgrade success from Stripe redirect
  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      publish({
        title: 'Welcome to your new plan!',
        description: 'Your subscription is now active. Enjoy your enhanced features.',
        type: 'success'
      });
      // Clean up URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, publish]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Fetch analytics preference
  useEffect(() => {
    if (!isAuthenticated || prefsLoading || analyticsEnabled !== null) return;
    let cancelled = false;
    const fetchPrefs = async () => {
      setPrefsLoading(true);
      setPrefsError(null);
      try {
        const response = await fetch('/api/archetype-journey', { credentials: 'include' });
        if (cancelled) return;
        if (response.status === 403) {
          await response.json().catch(() => ({}));
          setAnalyticsEnabled(false);
        } else if (response.ok) {
          setAnalyticsEnabled(true);
        } else {
          setPrefsError('Unable to load preference');
          setAnalyticsEnabled(false);
        }
      } catch {
        if (!cancelled) {
          setPrefsError('Unable to load preference');
          setAnalyticsEnabled(false);
        }
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    };
    fetchPrefs();
    return () => { cancelled = true; };
  }, [isAuthenticated, prefsLoading, analyticsEnabled]);

  const toggleAnalytics = useCallback(async () => {
    if (analyticsEnabled === null || prefsLoading) return;
    const next = !analyticsEnabled;
    setPrefsLoading(true);
    setPrefsError(null);
    try {
      const response = await fetch('/api/archetype-journey/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archetype_journey_enabled: next })
      });
      if (!response.ok) {
        throw new Error('Failed to update preference');
      }
      const data = await response.json().catch(() => ({}));
      setAnalyticsEnabled(data?.preferences?.archetype_journey_enabled ?? next);
    } catch {
      setPrefsError('Failed to update');
    } finally {
      setPrefsLoading(false);
    }
  }, [analyticsEnabled, prefsLoading]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleReplayTutorial = () => {
    resetOnboarding();
    navigate('/');
  };

  // Loading state
  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <CircleNotch className="h-8 w-8 text-accent animate-spin" />
      </div>
    );
  }

  // Not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
  const isPaid = tier === 'plus' || tier === 'pro';
  const tierIcons = { free: Moon, plus: Sparkle, pro: Crown };
  const TierIcon = tierIcons[tier] || Moon;

  return (
    <div className="min-h-screen bg-main text-main">
      {/* Header */}
      <header className="border-b border-secondary/20">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
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

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="font-serif text-3xl text-main">Account</h1>
          <p className="text-sm text-muted mt-1">Manage your profile and subscription</p>
        </div>

        {/* Profile Section */}
        <SectionCard title="Profile" icon={User}>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-accent">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-main truncate">{user?.username}</p>
              <p className="text-sm text-muted truncate flex items-center gap-1">
                <Envelope className="h-3.5 w-3.5" />
                {user?.email}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Subscription Section */}
        <SectionCard title="Subscription" icon={CreditCard}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isPaid ? 'bg-accent/20' : 'bg-secondary/20'}`}>
              <TierIcon className={`h-6 w-6 ${isPaid ? 'text-accent' : 'text-secondary'}`} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-main">{tierConfig.name}</p>
                <span className="text-xs uppercase tracking-wider text-muted bg-secondary/20 px-2 py-0.5 rounded-full">
                  {tierConfig.label}
                </span>
              </div>
              <p className="text-sm text-muted">
                {isPaid ? (
                  <>${tierConfig.price}/month</>
                ) : (
                  'Free plan'
                )}
              </p>
            </div>
          </div>

          {/* Current plan features */}
          <div className="border-t border-secondary/20 pt-4 mb-4">
            <p className="text-xs uppercase tracking-wider text-muted mb-2">Your plan includes</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-sm text-secondary">
                <Check className="h-4 w-4 text-accent shrink-0" />
                {tierConfig.monthlyReadings === Infinity ? 'Unlimited' : tierConfig.monthlyReadings} AI readings/month
              </li>
              <li className="flex items-center gap-2 text-sm text-secondary">
                <Check className="h-4 w-4 text-accent shrink-0" />
                {tierConfig.monthlyTTS === Infinity ? 'Unlimited' : tierConfig.monthlyTTS} voice narrations/month
              </li>
              {tierConfig.cloudJournal && (
                <li className="flex items-center gap-2 text-sm text-secondary">
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  Cloud journal sync
                </li>
              )}
              {tierConfig.advancedInsights && (
                <li className="flex items-center gap-2 text-sm text-secondary">
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  Advanced insights
                </li>
              )}
              {tierConfig.apiAccess && (
                <li className="flex items-center gap-2 text-sm text-secondary">
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  API access ({tierConfig.apiCallsPerMonth} calls/mo)
                </li>
              )}
            </ul>
          </div>

          {/* Upgrade/Manage buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!isPaid ? (
              <Link
                to="/pricing"
                className={`
                  flex-1 inline-flex items-center justify-center gap-2 rounded-full
                  border border-accent bg-accent px-4 py-3 text-sm font-semibold text-main
                  hover:bg-accent/90 transition
                  ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
                `}
              >
                <Crown className="h-4 w-4" weight="fill" />
                Upgrade Plan
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/pricing"
                  className={`
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-secondary/60 bg-transparent px-4 py-3 text-sm font-semibold text-main
                    hover:bg-secondary/10 transition
                    ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
                  `}
                >
                  View Plans
                  <CaretRight className="h-4 w-4" />
                </Link>
                {/* TODO: Add Stripe Customer Portal link when available */}
              </>
            )}
          </div>
        </SectionCard>

        {/* Settings Section */}
        <SectionCard title="Settings" icon={ChartLine}>
          <div className="divide-y divide-secondary/20">
            <SettingsToggle
              id="analytics-toggle"
              label="Archetype Journey"
              description="Track recurring cards and patterns across your readings"
              enabled={analyticsEnabled}
              loading={prefsLoading}
              onChange={toggleAnalytics}
              error={prefsError}
            />
          </div>
        </SectionCard>

        {/* Actions Section */}
        <SectionCard>
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleReplayTutorial}
              className="
                w-full flex items-center gap-3 px-2 py-3 -mx-2 rounded-xl
                text-sm text-main hover:bg-accent/5 active:bg-accent/10
                transition touch-manipulation text-left
              "
            >
              <BookOpen className="h-5 w-5 text-accent" />
              <span>Replay Tutorial</span>
              <CaretRight className="h-4 w-4 text-muted ml-auto" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="
                w-full flex items-center gap-3 px-2 py-3 -mx-2 rounded-xl
                text-sm text-main hover:bg-accent/5 active:bg-accent/10
                transition touch-manipulation text-left
              "
            >
              <SignOut className="h-5 w-5 text-accent" />
              <span>Sign Out</span>
              <CaretRight className="h-4 w-4 text-muted ml-auto" />
            </button>
          </div>
        </SectionCard>

        {/* Back to Reading */}
        <div className="text-center pt-4">
          <Link
            to="/"
            className="text-sm text-muted hover:text-accent transition"
          >
            Back to Reading
          </Link>
        </div>
      </main>
    </div>
  );
}
