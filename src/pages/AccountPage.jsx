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
  ChartLine,
  SpeakerHigh,
  Waveform,
  ArrowCounterClockwise,
  Palette
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
  const { tier, subscription: _subscription, loading: _subLoading } = useSubscription();
  const {
    resetOnboarding,
    // Audio settings
    voiceOn,
    setVoiceOn,
    autoNarrate,
    setAutoNarrate,
    ambienceOn,
    setAmbienceOn,
    ttsProvider,
    setTtsProvider,
    // Theme/experience settings
    theme,
    setTheme,
    includeMinors,
    setIncludeMinors,
    reversalFramework,
    setReversalFramework
  } = usePreferences();
  const { publish } = useToast();
  const prefersReducedMotion = useReducedMotion();

  // Analytics preferences state (mirrored from UserMenu)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState(null);

  // Billing portal + usage dashboard
  const [portalLoading, setPortalLoading] = useState(false);
  const [usageStatus, setUsageStatus] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(null);

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

  // No redirect - guests can access settings sections

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

  // Fetch usage status for the dashboard
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    const fetchUsage = async () => {
      setUsageLoading(true);
      setUsageError(null);
      try {
        const response = await fetch('/api/usage', { credentials: 'include' });
        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load usage');
        }

        setUsageStatus(data);
      } catch (error) {
        if (!cancelled) {
          setUsageError(error.message || 'Unable to load usage');
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    };

    fetchUsage();
    return () => { cancelled = true; };
  }, [isAuthenticated, tier]);

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

  const handleManageBilling = useCallback(async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ returnUrl: `${window.location.origin}/account` })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to open billing portal');
      }

      if (!data.url) {
        throw new Error('No billing portal URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      publish({
        title: 'Billing portal unavailable',
        description: error.message || 'Unable to open billing portal. Please try again.',
        type: 'error'
      });
    } finally {
      setPortalLoading(false);
    }
  }, [portalLoading, publish]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleReplayTutorial = () => {
    resetOnboarding();
    navigate('/');
  };

  // Loading state - only wait for auth, not subscription (guests don't need it)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <CircleNotch className="h-8 w-8 text-accent animate-spin" />
      </div>
    );
  }

  const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
  const isPaid = tier === 'plus' || tier === 'pro';
  const tierIcons = { free: Moon, plus: Sparkle, pro: Crown };
  const TierIcon = tierIcons[tier] || Moon;
  const readingUsage = usageStatus?.readings || null;
  const ttsUsage = usageStatus?.tts || null;
  const apiCallsUsage = usageStatus?.apiCalls || null;

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
          <h1 className="font-serif text-3xl text-main">{isAuthenticated ? 'Account' : 'Settings'}</h1>
          <p className="text-sm text-muted mt-1">
            {isAuthenticated ? 'Manage your profile, subscription, and preferences' : 'Customize your reading experience'}
          </p>
        </div>

        {/* Profile Section - Auth only */}
        {isAuthenticated && (
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
        )}

        {/* Subscription Section - Auth only */}
        {isAuthenticated && (
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

          {/* Usage dashboard */}
          <div className="border-t border-secondary/20 pt-4 mb-4">
            <p className="text-xs uppercase tracking-wider text-muted mb-2">Usage this month</p>

            {usageLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <CircleNotch className="h-4 w-4 animate-spin text-accent" />
                Loading usage…
              </div>
            ) : usageError ? (
              <p className="text-sm text-error">{usageError}</p>
            ) : readingUsage?.source ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">AI readings</span>
                  <span className="text-muted">
                    {readingUsage.unlimited
                      ? `${readingUsage.used} used · Unlimited`
                      : `${readingUsage.used}/${readingUsage.limit}`}
                  </span>
                </div>

                {!readingUsage.unlimited && typeof readingUsage.limit === 'number' && readingUsage.limit > 0 && (
                  <div className="h-2 rounded-full bg-secondary/20 overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{
                        width: `${Math.min(100, Math.round((readingUsage.used / readingUsage.limit) * 100))}%`
                      }}
                    />
                  </div>
                )}

                {ttsUsage && (
                  <>
                    <div className="flex items-center justify-between text-sm pt-2">
                      <span className="text-secondary">Voice narrations</span>
                      <span className="text-muted">
                        {ttsUsage.unlimited
                          ? `${ttsUsage.used} used · Unlimited`
                          : `${ttsUsage.used}/${ttsUsage.limit}`}
                      </span>
                    </div>

                    {!ttsUsage.unlimited && typeof ttsUsage.limit === 'number' && ttsUsage.limit > 0 && (
                      <div className="h-2 rounded-full bg-secondary/20 overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{
                            width: `${Math.min(100, Math.round((ttsUsage.used / ttsUsage.limit) * 100))}%`
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                {apiCallsUsage?.enabled && (
                  <>
                    <div className="flex items-center justify-between text-sm pt-2">
                      <span className="text-secondary">API calls</span>
                      <span className="text-muted">
                        {typeof apiCallsUsage.limit === 'number'
                          ? `${apiCallsUsage.used}/${apiCallsUsage.limit}`
                          : apiCallsUsage.used}
                      </span>
                    </div>

                    {typeof apiCallsUsage.limit === 'number' && apiCallsUsage.limit > 0 && (
                      <div className="h-2 rounded-full bg-secondary/20 overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{
                            width: `${Math.min(100, Math.round((apiCallsUsage.used / apiCallsUsage.limit) * 100))}%`
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs text-muted">
                  Resets {usageStatus?.resetAt ? new Date(usageStatus.resetAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'next month'} (UTC)
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Usage tracking unavailable.
              </p>
            )}
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
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className={`
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-accent/60 bg-transparent px-4 py-3 text-sm font-semibold text-main
                    hover:bg-accent/10 transition
                    ${portalLoading ? 'opacity-70 cursor-not-allowed' : ''}
                    ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
                  `}
                >
                  <CreditCard className="h-4 w-4" weight="fill" />
                  Manage Billing
                  {portalLoading ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <CaretRight className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
          </div>
        </SectionCard>
        )}

        {/* Audio Settings Section - Available to all users */}
        <SectionCard title="Audio" icon={SpeakerHigh}>
          <div className="divide-y divide-secondary/20">
            <SettingsToggle
              id="voice-toggle"
              label="Reader Voice"
              description="AI narration for card reveals and full readings"
              enabled={voiceOn}
              onChange={() => setVoiceOn(!voiceOn)}
            />
            <SettingsToggle
              id="auto-narrate-toggle"
              label="Auto-Narrate"
              description={voiceOn ? "Automatically play narration as readings stream in" : "Enable Reader Voice first"}
              enabled={autoNarrate && voiceOn}
              onChange={() => setAutoNarrate(!autoNarrate)}
              loading={!voiceOn}
            />
            <SettingsToggle
              id="ambience-toggle"
              label="Table Ambience"
              description="Soft shuffle, candle crackle, and mystic room tone"
              enabled={ambienceOn}
              onChange={() => setAmbienceOn(!ambienceOn)}
            />
          </div>

          {/* Voice Engine Selector */}
          {voiceOn && (
            <div className="mt-4 pt-4 border-t border-secondary/20">
              <div className="flex items-center gap-2 mb-3">
                <Waveform className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">Voice Engine</span>
              </div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Select voice engine">
                {[
                  { id: 'hume', label: 'Hume AI', desc: 'Expressive' },
                  { id: 'azure', label: 'Azure', desc: 'Clear' },
                  { id: 'azure-sdk', label: 'Azure SDK', desc: 'Word sync' }
                ].map(engine => (
                  <button
                    key={engine.id}
                    type="button"
                    role="radio"
                    aria-checked={ttsProvider === engine.id}
                    onClick={() => setTtsProvider(engine.id)}
                    className={`
                      px-3 py-2.5 rounded-xl text-center transition-all touch-manipulation
                      ${ttsProvider === engine.id
                        ? 'bg-accent/20 border-2 border-accent text-main'
                        : 'bg-surface-muted/50 border border-secondary/30 text-muted hover:text-main hover:border-secondary/50'
                      }
                    `}
                  >
                    <span className="block text-xs font-semibold">{engine.label}</span>
                    <span className="block text-[0.65rem] opacity-75">{engine.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Theme & Experience Section */}
        <SectionCard title="Appearance" icon={Palette}>
          <div className="divide-y divide-secondary/20">
            <SettingsToggle
              id="theme-toggle"
              label="Light Mode"
              description="Switch to high contrast light theme"
              enabled={theme === 'light'}
              onChange={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            />
            <SettingsToggle
              id="deck-toggle"
              label="Full Deck"
              description="Include Minor Arcana (78 cards vs 22 Major only)"
              enabled={includeMinors}
              onChange={() => setIncludeMinors(!includeMinors)}
            />
          </div>

          {/* Reversal Framework Selector */}
          <div className="mt-4 pt-4 border-t border-secondary/20">
            <div className="flex items-center gap-2 mb-3">
              <ArrowCounterClockwise className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Reversal Lens</span>
            </div>
            <select
              id="reversal-framework-select"
              value={reversalFramework || 'auto'}
              onChange={e => setReversalFramework(e.target.value === 'auto' ? null : e.target.value)}
              className="
                w-full rounded-xl border border-secondary/30 bg-surface-muted/50
                px-3 py-2.5 text-sm text-main
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                transition
              "
              aria-describedby="reversal-description"
            >
              <option value="auto">Auto (recommended)</option>
              <option value="blocked">Blocked energy</option>
              <option value="delayed">Timing & delays</option>
              <option value="internalized">Internal process</option>
              <option value="contextual">Context-based</option>
              <option value="shadow">Shadow Integration (Jungian)</option>
              <option value="mirror">Mirror / reflection</option>
              <option value="potentialBlocked">Unrealized potential</option>
            </select>
            <p id="reversal-description" className="mt-2 text-xs text-muted">
              How reversed cards are interpreted in AI readings
            </p>
          </div>
        </SectionCard>

        {/* Analytics Settings Section - Auth only (requires API) */}
        {isAuthenticated && (
        <SectionCard title="Analytics" icon={ChartLine}>
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
        )}

        {/* Actions Section - Auth only */}
        {isAuthenticated && (
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
        )}

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
