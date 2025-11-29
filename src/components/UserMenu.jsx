import { useEffect, useState, useRef, useCallback } from 'react';
import { SignIn, User, SignOut, BookOpen } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import AuthModal from './AuthModal';

export function UserMenu({ condensed = false }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { resetOnboarding, onboardingComplete } = usePreferences();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState(null);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
  }, []);

  const handleLogout = async () => {
    await logout();
    closeDropdown();
    setAnalyticsEnabled(null);
    setPrefsError(null);
  };

  const handleReplayTutorial = () => {
    resetOnboarding();
    closeDropdown();
  };

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

  // Fetch analytics preference when dropdown opens
  useEffect(() => {
    if (!isAuthenticated || !showDropdown || prefsLoading || analyticsEnabled !== null) return;
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
          setPrefsError('Unable to load analytics preference');
          setAnalyticsEnabled(false);
        }
      } catch {
        if (!cancelled) {
          setPrefsError('Unable to load analytics preference');
          setAnalyticsEnabled(false);
        }
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    };
    fetchPrefs();
    return () => { cancelled = true; };
  }, [isAuthenticated, showDropdown, prefsLoading, analyticsEnabled]);

  const toggleAnalytics = async () => {
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
  };

  // Get display name - show first initial on very small screens, truncated username on larger
  const getDisplayName = () => {
    if (!user?.username) return '';
    return user.username;
  };

  const getInitial = () => {
    if (!user?.username) return '?';
    return user.username.charAt(0).toUpperCase();
  };

  return (
    <>
      <div className="relative z-40">
        {isAuthenticated ? (
          <div className="relative">
            <button
              ref={triggerRef}
              onClick={() => setShowDropdown(!showDropdown)}
              className={`
                flex items-center gap-1.5 sm:gap-2 min-h-[44px]
                rounded-full border transition text-xs-plus font-semibold text-accent touch-manipulation
                active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                focus-visible:ring-offset-2 focus-visible:ring-offset-main
                ${condensed
                  ? 'h-11 w-11 justify-center px-0 bg-surface/80 border-accent/30 hover:bg-surface hover:border-accent/50 active:bg-surface-muted sm:h-auto sm:w-auto sm:px-3 sm:justify-start'
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
                  className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
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
                      <p className="text-[11px] text-muted/70 truncate mt-0.5">{user.email}</p>
                    )}
                  </div>

                  {/* Analytics toggle */}
                  <div className="px-4 py-3 border-b border-accent/10 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="analytics-toggle" className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-accent">Archetype Journey</p>
                        <p className="text-[11px] text-muted leading-tight">Track recurring cards</p>
                      </label>
                      <button
                        id="analytics-toggle"
                        role="switch"
                        onClick={toggleAnalytics}
                        disabled={prefsLoading || analyticsEnabled === null}
                        className={`
                          relative inline-flex h-7 w-12 shrink-0 items-center rounded-full
                          transition-colors touch-manipulation
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
                          focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                          ${analyticsEnabled ? 'bg-primary' : 'bg-secondary/30'}
                          ${prefsLoading || analyticsEnabled === null ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                        aria-checked={analyticsEnabled === true}
                        aria-label="Toggle archetype journey analytics"
                      >
                        <span
                          className={`
                            inline-block h-5 w-5 transform rounded-full bg-white shadow-sm
                            transition-transform duration-200
                            ${analyticsEnabled ? 'translate-x-6' : 'translate-x-1'}
                          `}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                    {prefsError && (
                      <p className="text-[11px] text-error" role="alert">{prefsError}</p>
                    )}
                  </div>

                  {/* Replay Tutorial */}
                  <button
                    role="menuitem"
                    onClick={handleReplayTutorial}
                    className="
                      w-full text-left px-4 py-3 min-h-[44px]
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
                      w-full text-left px-4 py-3 min-h-[44px]
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
                  flex items-center justify-center min-w-[44px] min-h-[44px]
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
            <button
              onClick={() => setShowAuthModal(true)}
              className="
                flex items-center gap-1.5 px-3 sm:px-4 min-h-[44px]
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

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
