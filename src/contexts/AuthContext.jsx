/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { clearAllNarrativeCaches } from '../lib/safeStorage';
import { clearJournalInsightsCache } from '../lib/journalInsights';
import {
  getCurrentPathname,
  normalizeRoutePath,
  shouldSkipAuthCheckForPath
} from '../lib/authRouteUtils';

const AuthContext = createContext(null);

// Cache key prefix for journal cache (must match useJournal.js)
const JOURNAL_CACHE_KEY_PREFIX = 'tarot_journal_cache';

/**
 * Normalize user data from API response into consistent context shape
 * @param {object} userData - Raw user data from API
 * @param {object} [existingUser] - Existing user state for preserving fields
 * @returns {object} Normalized user object
 */
function normalizeUser(userData, existingUser = null) {
  if (!userData) return null;
  
  return {
    id: userData.id,
    email: userData.email,
    username: userData.username || userData.email?.split('@')[0] || 'User',
    subscription_tier: userData.subscription_tier || 'free',
    subscription_status: userData.subscription_status || 'inactive',
    subscription_provider: userData.subscription_provider || null,
    stripe_customer_id:
      userData.stripe_customer_id !== undefined
        ? userData.stripe_customer_id
        : existingUser?.stripe_customer_id ?? null,
    email_verified: Boolean(userData.email_verified),
    auth_provider: userData.auth_provider || existingUser?.auth_provider || 'session',
    full_name: userData.full_name || existingUser?.full_name || null,
    avatar_url: userData.avatar_url || existingUser?.avatar_url || null
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !shouldSkipAuthCheckForPath(getCurrentPathname()));
  const [error, setError] = useState(null);
  const [routePathname, setRoutePathname] = useState(() => getCurrentPathname());
  const hasCompletedInitialCheckRef = useRef(false);
  const previousSkipAuthRef = useRef(shouldSkipAuthCheckForPath(routePathname));

  const checkAuth = useCallback(async (pathname = getCurrentPathname()) => {
    if (shouldSkipAuthCheckForPath(pathname)) {
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        const userData = data?.user;
        if (userData) {
          setUser(prevUser => normalizeUser(userData, prevUser));
        } else {
          setUser(null);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        if (response.status !== 401) {
          setError(data?.error || 'Unable to confirm authentication');
        }
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setError(err?.message || 'Auth check failed');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateRoutePathname = (nextPathname = getCurrentPathname()) => {
      const normalizedPathname = normalizeRoutePath(nextPathname);
      setRoutePathname((currentPathname) => (
        currentPathname === normalizedPathname ? currentPathname : normalizedPathname
      ));
    };

    const handleRouteChange = (event) => {
      updateRoutePathname(event?.detail?.pathname || getCurrentPathname());
    };

    const handlePopState = () => {
      updateRoutePathname(getCurrentPathname());
    };

    window.addEventListener('tableau:route-change', handleRouteChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('tableau:route-change', handleRouteChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const shouldSkipAuthCheck = shouldSkipAuthCheckForPath(routePathname);
    const skippedPreviousRoute = previousSkipAuthRef.current;
    previousSkipAuthRef.current = shouldSkipAuthCheck;

    if (shouldSkipAuthCheck) {
      setError(null);
      setLoading(false);
      return;
    }

    if (!hasCompletedInitialCheckRef.current || skippedPreviousRoute) {
      hasCompletedInitialCheckRef.current = true;
      checkAuth(routePathname);
    }
  }, [checkAuth, routePathname]);

  const register = async (email, username, password) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, username, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = data?.error || 'Registration failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const userData = data?.user;
      if (userData) {
        setUser(normalizeUser(userData));
      }

      return { success: true, verification_sent: data?.verification_sent };
    } catch (err) {
      const errorMessage = err?.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = data?.error || 'Login failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const userData = data?.user;
      if (userData) {
        setUser(normalizeUser(userData));
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err?.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    setError(null);
    const logoutUserId = user?.id;

    let response;
    let logoutError = null;
    try {
      response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout failed:', err);
      logoutError = err?.message || 'Unable to log out';
    }

    if (response && !response.ok) {
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      logoutError = data?.error || 'Unable to log out';
    }

    // Clear local state even if server logout failed.
    clearAllNarrativeCaches();
    
    if (logoutUserId && typeof localStorage !== 'undefined') {
      try {
        const journalCacheKey = `${JOURNAL_CACHE_KEY_PREFIX}_${logoutUserId}`;
        localStorage.removeItem(journalCacheKey);
        clearJournalInsightsCache(logoutUserId);
      } catch (e) {
        console.warn('Failed to clear user caches on logout:', e);
      }
    }

    setUser(null);
    if (logoutError) {
      setError(logoutError);
      return { success: false, error: logoutError };
    }
    return { success: true };
  };

  const requestPasswordReset = async (email) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMessage = data?.error || 'Unable to send reset link';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err?.message || 'Unable to send reset link';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const resendVerification = async (email) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorMessage = data?.error || 'Unable to send verification email';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (err) {
      const errorMessage = err?.message || 'Unable to send verification email';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const startOAuth = async (redirectTo = '/account', connection = '') => {
    setError(null);
    try {
      const response = await fetch('/api/auth/oauth-start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          redirectTo,
          connection
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMessage = data?.error || 'Unable to start social login';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      const authorizeUrl = data?.authorizeUrl;
      if (typeof authorizeUrl !== 'string' || !authorizeUrl) {
        const errorMessage = 'OAuth authorize URL missing';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      window.location.assign(authorizeUrl);
      return { success: true };
    } catch (err) {
      const errorMessage = err?.message || 'Unable to start social login';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    checkAuth,
    requestPasswordReset,
    resendVerification,
    startOAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
