import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SignIn, User, SignOut, BookOpen, Gear, Crown, Sparkle, Moon } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { ConfirmModal } from './ConfirmModal';
import AuthModal from './AuthModal';

export function UserMenu({ condensed = false }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { tier, isPaid } = useSubscription();
  const { resetOnboarding, onboardingComplete } = usePreferences();
  const [showDropdown, setShowDropdown] = useState(false);
  const [journeyEnabled, setJourneyEnabled] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState(null);
  const [tutorialResetOpen, setTutorialResetOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  const handleLogout = async () => {
    await logout();
    closeDropdown();
  };

  const handleReplayTutorial = () => {
    closeDropdown();
    setTutorialResetOpen(true);
  };

  const confirmReplayTutorial = useCallback(() => {
    resetOnboarding();
    setTutorialResetOpen(false);
    closeDropdown();
  }, [resetOnboarding, closeDropdown]);

  const fetchJourneyPreference = useCallback(async (force = false) => {
    if (!isAuthenticated || journeyLoading) return;
    if (!force && journeyEnabled !== null) return;
    setJourneyLoading(true);
    setJourneyError(null);
    try {
      const response = await fetch('/api/archetype-journey/preferences', { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setJourneyEnabled(false);
      } else if (response.ok) {
        const enabled = data?.preferences?.archetype_journey_enabled;
        setJourneyEnabled(enabled === undefined ? null : Boolean(enabled));
      } else {
        setJourneyError('Could not load preference. Retry.');
        setJourneyEnabled(null);
      }
    } catch {
      setJourneyError('Could not load preference. Retry.');
      setJourneyEnabled(null);
    } finally {
      setJourneyLoading(false);
    }
  }, [isAuthenticated, journeyLoading, journeyEnabled]);

  const handleRetryJourney = useCallback(() => {
    fetchJourneyPreference(true);
  }, [fetchJourneyPreference]);

  const handleToggleJourney = useCallback(async () => {
    if (journeyEnabled === null || journeyLoading) return;
    const next = !journeyEnabled;
    setJourneyLoading(true);
    setJourneyError(null);
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
      setJourneyEnabled(data?.preferences?.archetype_journey_enabled ?? next);
    } catch {
      setJourneyError('Failed to update. Retry.');
    } finally {
      setJourneyLoading(false);
    }
  }, [journeyEnabled, journeyLoading]);

  // Handle Escape key and click outside
  useEffect(() => {
    if (!showDropdown) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDropdown();
        // Return focus to trigger button
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        closeDropdown();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showDropdown, closeDropdown]);

  useEffect(() => {
    if (!showDropdown) return;
    fetchJourneyPreference();
  }, [showDropdown, fetchJourneyPreference]);

  useEffect(() => {
    if (isAuthenticated) return;
    setJourneyEnabled(null);
    setJourneyError(null);
    setJourneyLoading(false);
  }, [isAuthenticated]);

  // Get display name - show first initial on very small screens, truncated username on larger
  const getDisplayName = () => {
    if (!user?.username) return '';
    return user.username;
  };

  const getInitial = () => {
    if (!user?.username) return '?';
    return user.username.charAt(0).toUpperCase();
  };

  const nextTier = tier === 'free' ? 'plus' : tier === 'plus' ? 'pro' : null;
  const nextTierConfig = nextTier ? SUBSCRIPTION_TIERS[nextTier] : null;

  return (
    <>
      <div className="relative z-40">
        {isAuthenticated ? (
          <div className="relative">
            <button
              ref={triggerRef}
              onClick={() => setShowDropdown(!showDropdown)}
              className={`
                flex items-center gap-1.5 sm:gap-2 min-h-touch
                rounded-full border transition text-xs-plus font-semibold text-accent touch-manipulation
                active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                focus-visible:ring-offset-2 focus-visible:ring-offset-main
                ${condensed
                  ? 'h-11 w-11 max-w-11 justify-center px-0 overflow-hidden bg-surface/80 border-accent/30 hover:bg-surface hover:border-accent/50 active:bg-surface-muted sm:h-auto sm:w-auto sm:max-w-none sm:px-3 sm:justify-start sm:overflow-visible'
                  : 'px-2 sm:px-3 bg-surface/50 border-accent/20 hover:bg-surface hover:border-accent/40 active:bg-surface-muted'
                }
              `}
              aria-expanded={showDropdown}
              aria-haspopup="menu"
              aria-label={`User menu for ${user?.username || 'account'}`}
            >
              <User className="w-4 h-4 shrink-0" aria-hidden="true" />
              {/* Mobile: show initial only, tablet+: show truncated username */}
              {!condensed && <span className="xs:hidden text-xs font-bold">{getInitial()}</span>}
              <span className={`${condensed ? 'hidden sm:inline' : 'hidden xs:inline'} max-w-[60px] sm:max-w-[80px] md:max-w-[100px] truncate text-xs sm:text-xs-plus`}>
                {getDisplayName()}
              </span>
            </button>

            {showDropdown && (
              <>
                {/* Backdrop for mobile */}
                <div
                  className="fixed inset-0 z-40 bg-main/40 sm:bg-transparent"
                  onClick={closeDropdown}
                  aria-hidden="true"
                />
                <div
                  ref={dropdownRef}
                  role="menu"
                  aria-label="User menu"
                  className="
                    absolute right-0 mt-2 w-56 sm:w-48 py-1
                    bg-surface border border-accent/20 rounded-xl
                    shadow-xl z-50 animate-fade-in
                    max-h-[calc(100vh-120px)] overflow-y-auto
                  "
                >
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-accent/10">
                    <p className="text-xs text-muted">Signed in as</p>
                    <p className="text-sm font-semibold text-accent truncate">{user?.username}</p>
                    {user?.email && (
                      <p className="text-2xs text-muted/70 truncate mt-0.5">{user.email}</p>
                    )}
                    {/* Subscription tier badge */}
                    <div className="mt-2 flex items-center gap-1.5">
                      {tier === 'pro' && <Crown className="h-3.5 w-3.5 text-accent" weight="fill" />}
                      {tier === 'plus' && <Sparkle className="h-3.5 w-3.5 text-accent" weight="fill" />}
                      {tier === 'free' && <Moon className="h-3.5 w-3.5 text-muted" weight="fill" />}
                      <span className={`text-2xs font-medium ${isPaid ? 'text-accent' : 'text-muted'}`}>
                        {SUBSCRIPTION_TIERS[tier]?.name || 'Seeker'} Plan
                      </span>
                    </div>
                  </div>

                  {/* Archetype Journey toggle */}
                  <div className="px-4 py-3 border-b border-accent/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-main">
                          Archetype Journey <span className="text-2xs text-muted">(optional)</span>
                        </p>
                        <p className="text-2xs text-muted mt-0.5">
                          Track recurring cards and patterns.
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                          <Link
                            to="/journal"
                            onClick={closeDropdown}
                            className="text-2xs text-accent hover:text-accent/80"
                          >
                            View Journey
                          </Link>
                          {journeyError && (
                            <button
                              type="button"
                              onClick={handleRetryJourney}
                              className="text-2xs text-muted hover:text-main"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={journeyEnabled === true}
                        aria-label="Toggle Archetype Journey"
                        onClick={handleToggleJourney}
                        disabled={journeyEnabled === null || journeyLoading}
                        className={`
                          min-h-touch min-w-touch flex items-center justify-center touch-manipulation
                          ${journeyEnabled === null || journeyLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <span
                          className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                            ${journeyEnabled ? 'bg-accent' : 'bg-secondary/30'}
                          `}
                        >
                          <span
                            className={`
                              inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
                              ${journeyEnabled ? 'translate-x-5' : 'translate-x-1'}
                            `}
                          />
                        </span>
                      </button>
                    </div>
                    {journeyError && (
                      <p className="text-2xs text-error mt-2">{journeyError}</p>
                    )}
                  </div>

                  {/* Upgrade CTA */}
                  {nextTierConfig && (
                    <Link
                      to="/pricing"
                      onClick={closeDropdown}
                      className="
                        w-full px-4 py-3 min-h-touch
                        text-sm text-main hover:bg-accent/10 active:bg-accent/20
                        flex items-center justify-between gap-3 touch-manipulation
                        focus-visible:outline-none focus-visible:bg-accent/10
                        border-b border-accent/10
                      "
                    >
                      <div className="flex items-center gap-2">
                        {nextTier === 'pro' ? (
                          <Crown className="h-4 w-4 text-accent" weight="fill" />
                        ) : (
                          <Sparkle className="h-4 w-4 text-accent" weight="fill" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-accent">
                            Upgrade to {nextTierConfig.label}
                          </p>
                          <p className="text-2xs text-muted">
                            ${nextTierConfig.price}/month
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted">View</span>
                    </Link>
                  )}

                  {/* Account Settings Link */}
                  <Link
                    to="/account"
                    onClick={closeDropdown}
                    className="
                      w-full text-left px-4 py-3 min-h-touch
                      text-sm text-accent hover:bg-accent/5 active:bg-accent/10
                      flex items-center gap-2 touch-manipulation
                      focus-visible:outline-none focus-visible:bg-accent/5
                      border-b border-accent/10
                    "
                  >
                    <Gear className="w-4 h-4" aria-hidden="true" />
                    Account & Settings
                  </Link>
                  <Link
                    to={isPaid ? '/account#subscription' : '/pricing'}
                    onClick={closeDropdown}
                    className="
                      w-full text-left px-4 py-3 min-h-touch
                      text-sm text-accent hover:bg-accent/5 active:bg-accent/10
                      flex items-center gap-2 touch-manipulation
                      focus-visible:outline-none focus-visible:bg-accent/5
                      border-b border-accent/10
                    "
                  >
                    {isPaid ? 'Manage Subscription' : 'View Plans'}
                  </Link>

                  {/* Replay Tutorial */}
                  <button
                    role="menuitem"
                    onClick={handleReplayTutorial}
                    className="
                      w-full text-left px-4 py-3 min-h-touch
                      text-sm text-accent hover:bg-accent/5 active:bg-accent/10
                      flex items-center gap-2 touch-manipulation
                      focus-visible:outline-none focus-visible:bg-accent/5
                      border-b border-accent/10
                    "
                  >
                    <BookOpen className="w-4 h-4" aria-hidden="true" />
                    Replay Tutorial
                  </button>

                  {/* Sign out */}
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="
                      w-full text-left px-4 py-3 min-h-touch
                      text-sm text-accent hover:bg-accent/5 active:bg-accent/10
                      flex items-center gap-2 touch-manipulation
                      focus-visible:outline-none focus-visible:bg-accent/5
                    "
                  >
                    <SignOut className="w-4 h-4" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {onboardingComplete && (
              <button
                onClick={handleReplayTutorial}
                className="
                  flex items-center justify-center min-w-touch min-h-touch
                  rounded-full bg-surface/50 border border-accent/20
                  text-accent hover:bg-surface hover:border-accent/40 active:bg-surface-muted
                  transition touch-manipulation
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                  focus-visible:ring-offset-2 focus-visible:ring-offset-main
                "
                aria-label="Replay tutorial"
                title="Replay Tutorial"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <Link
              to="/account"
              className="
                flex items-center gap-1.5 px-3 sm:px-4 min-h-touch
                rounded-full border border-accent/30 text-accent
                hover:bg-surface hover:border-accent/50 active:bg-surface-muted
                transition text-xs-plus font-semibold touch-manipulation
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                focus-visible:ring-offset-2 focus-visible:ring-offset-main
              "
              aria-label="Open settings"
            >
              <Gear className="w-4 h-4" aria-hidden="true" />
              <span className="hidden xs:inline">Settings</span>
            </Link>
            <button
              onClick={() => setShowAuthModal(true)}
              className="
                flex items-center gap-1.5 px-3 sm:px-4 min-h-touch
                rounded-full bg-primary text-surface
                hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98]
                shadow-sm shadow-primary/20 transition
                text-xs-plus font-semibold touch-manipulation
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
                focus-visible:ring-offset-2 focus-visible:ring-offset-main
              "
            >
              <SignIn className="w-4 h-4" aria-hidden="true" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={tutorialResetOpen}
        onClose={() => setTutorialResetOpen(false)}
        onConfirm={confirmReplayTutorial}
        title="Replay tutorial?"
        message="This restarts the onboarding walkthrough and tips."
        confirmText="Replay tutorial"
        cancelText="Cancel"
      />

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
