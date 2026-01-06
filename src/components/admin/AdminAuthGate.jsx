import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Eye, EyeSlash } from '@phosphor-icons/react';

const STORAGE_KEY = 'admin_api_key';

/**
 * AdminAuthGate - Protects admin content with API key authentication
 *
 * Uses sessionStorage to persist the key within a browser session.
 * Verifies the key against /api/admin/quality-stats before granting access.
 *
 * @param {Object} props
 * @param {Function} props.children - Render prop: (apiKey) => ReactNode
 */
export default function AdminAuthGate({ children }) {
  const [apiKey, setApiKey] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const verifyKey = useCallback(async (key) => {
    if (!key) return false;

    setIsChecking(true);
    setError('');

    try {
      const res = await fetch('/api/admin/quality-stats?days=1', {
        headers: { 'Authorization': `Bearer ${key}` }
      });

      if (res.status === 401) {
        setError('Invalid API key');
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Server error');
      }

      sessionStorage.setItem(STORAGE_KEY, key);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to verify key');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Auto-verify stored key on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem(STORAGE_KEY);
    if (storedKey) {
      setApiKey(storedKey);
      verifyKey(storedKey).finally(() => setInitialCheckDone(true));
    } else {
      setInitialCheckDone(true);
    }
  }, [verifyKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      setError('Please enter an API key');
      return;
    }
    // Normalize state to match what we verify/store
    setApiKey(normalizedKey);
    await verifyKey(normalizedKey);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
    setApiKey('');
    setError('');
  };

  // Show nothing until initial check completes
  if (!initialCheckDone) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <div className="text-muted animate-pulse">Verifying access...</div>
      </div>
    );
  }

  // Authenticated - render children with apiKey and logout handler
  if (isAuthenticated) {
    return children({ apiKey, onLogout: handleLogout });
  }

  // Login form
  return (
    <div className="min-h-screen bg-main flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-secondary/30 bg-surface p-6 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
            <ShieldCheck className="h-5 w-5 text-accent" weight="duotone" />
          </div>
          <div>
            <h1 className="font-serif text-xl text-main">Admin Dashboard</h1>
            <p className="text-xs text-muted">Quality monitoring & analytics</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-xs font-medium text-muted mb-1.5">
              Admin API Key
            </label>
            <div className="relative">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your admin API key"
                autoComplete="off"
                className="w-full rounded-xl border border-secondary/30 bg-main px-4 py-3 pr-10 text-main placeholder:text-muted/50 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? (
                  <EyeSlash className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isChecking}
            className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-main transition-all hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </div>

        <p className="mt-4 text-xs text-muted text-center">
          Contact your administrator if you need access
        </p>
      </form>
    </div>
  );
}
