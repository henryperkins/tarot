import { useEffect, useState } from 'react';
import { SignIn, User, SignOut } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

export function UserMenu() {
  const { isAuthenticated, user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState(null);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
    setAnalyticsEnabled(null);
    setPrefsError(null);
  };

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
      } catch (error) {
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
    } catch (error) {
      setPrefsError('Failed to update');
    } finally {
      setPrefsLoading(false);
    }
  };

  return (
    <>
      <div className="relative z-40">
        {isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/50 border border-accent/20 hover:bg-surface hover:border-accent/40 transition text-xs-plus font-semibold text-accent"
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline max-w-[100px] truncate">{user?.username}</span>
            </button>

            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowDropdown(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 w-48 py-1 bg-surface border border-accent/20 rounded-xl shadow-lg z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-accent/10">
                    <p className="text-xs text-muted">Signed in as</p>
                    <p className="text-sm font-semibold text-accent truncate">{user?.username}</p>
                  </div>
                  <div className="px-4 py-3 border-b border-accent/10 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-accent">Archetype Journey</p>
                        <p className="text-[11px] text-muted">Track recurring cards</p>
                      </div>
                      <button
                        onClick={toggleAnalytics}
                        disabled={prefsLoading || analyticsEnabled === null}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                          analyticsEnabled ? 'bg-primary' : 'bg-secondary/30'
                        } ${prefsLoading || analyticsEnabled === null ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-pressed={analyticsEnabled === true}
                        aria-label="Toggle archetype journey analytics"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            analyticsEnabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {prefsError && (
                      <p className="text-[11px] text-error">{prefsError}</p>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-accent/5 flex items-center gap-2"
                  >
                    <SignOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20 transition text-xs-plus font-semibold"
          >
            <SignIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
