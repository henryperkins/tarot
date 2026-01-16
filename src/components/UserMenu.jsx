import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SignIn, User, SignOut, BookOpen, Gear, Crown, Sparkle, Moon } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import AuthModal from './AuthModal';

export function UserMenu({ condensed = false }) {
  const { isAuthenticated, user, logout } = useAuth();
  const { tier, isPaid } = useSubscription();
  const { resetOnboarding, onboardingComplete } = usePreferences();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
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
                flex items-center gap-1.5 sm:gap-2 min-h-[44px]
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
                      <p className="text-[11px] text-muted/70 truncate mt-0.5">{user.email}</p>
                    )}
                    {/* Subscription tier badge */}
                    <div className="mt-2 flex items-center gap-1.5">
                      {tier === 'pro' && <Crown className="h-3.5 w-3.5 text-accent" weight="fill" />}
                      {tier === 'plus' && <Sparkle className="h-3.5 w-3.5 text-accent" weight="fill" />}
                      {tier === 'free' && <Moon className="h-3.5 w-3.5 text-muted" weight="fill" />}
                      <span className={`text-[11px] font-medium ${isPaid ? 'text-accent' : 'text-muted'}`}>
                        {SUBSCRIPTION_TIERS[tier]?.name || 'Seeker'} Plan
                      </span>
                    </div>
                  </div>

                  {/* Upgrade CTA */}
                  {nextTierConfig && (
                    <Link
                      to="/pricing"
                      onClick={closeDropdown}
                      className="
                        w-full px-4 py-3 min-h-[44px]
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
                          <p className="text-[11px] text-muted">
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
                      w-full text-left px-4 py-3 min-h-[44px]
                      text-sm text-accent hover:bg-accent/5 active:bg-accent/10
                      flex items-center gap-2 touch-manipulation
                      focus-visible:outline-none focus-visible:bg-accent/5
                      border-b border-accent/10
                    "
                  >
                    <Gear className="w-4 h-4" aria-hidden="true" />
                    Settings
                  </Link>

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
            <Link
              to="/account"
              className="
                flex items-center gap-1.5 px-3 sm:px-4 min-h-[44px]
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
