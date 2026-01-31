/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { clearAllNarrativeCaches } from '../lib/safeStorage';
import { clearJournalInsightsCache } from '../lib/journalInsights';

const AuthContext = createContext(null);

// Cache key prefix for journal cache (must match useJournal.js)
const JOURNAL_CACHE_KEY_PREFIX = 'tarot_journal_cache';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setUser({
          id: data.id,
          email: data.email,
          username: data.firstName || data.email?.split('@')[0] || 'User',
          firstName: data.firstName,
          lastName: data.lastName,
          profileImageUrl: data.profileImageUrl
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    window.location.href = '/api/login';
    return { success: true };
  };

  const login = async () => {
    window.location.href = '/api/login';
    return { success: true };
  };

  const logout = async () => {
    setError(null);
    const logoutUserId = user?.id;
    
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
    
    window.location.href = '/api/logout';
    return { success: true };
  };

  const requestPasswordReset = async () => {
    return { success: false, error: 'Password reset is managed by Replit Auth' };
  };

  const resendVerification = async () => {
    return { success: false, error: 'Email verification is managed by Replit Auth' };
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
    resendVerification
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
