import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Eye, EyeSlash } from '@phosphor-icons/react';
import { clearLocalAdminLaunch, getLocalAdminLaunch, LocalAdminAccessContext, localAdminAction, localAdminEndpoint } from '../../lib/localAdminAccess.js';
import { LocalPasswordDialog, LocalPasswordForm } from './LocalAdminAccess.jsx';

const STORAGE_KEY = 'admin_api_key';

/**
 * AdminAuthGate - Protects admin content with API key authentication
 *
 * Uses sessionStorage to persist the key within a browser session.
 * Verifies the key against a same-origin admin endpoint before granting access.
 *
 * @param {Object} props
 * @param {Function} props.children - Render prop: (apiKey) => ReactNode
 */
export default function AdminAuthGate({ children, description = 'Quality monitoring & analytics', verificationPath = '/api/admin/quality-stats?days=1' }) {
  const [storedKey] = useState(() => sessionStorage.getItem(STORAGE_KEY) || '');
  const [apiKey, setApiKey] = useState(storedKey);
  const [isChecking, setIsChecking] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(!storedKey);
  const [local, setLocal] = useState(null);
  const [launch, setLaunch] = useState(getLocalAdminLaunch);
  const [useKey, setUseKey] = useState(false);
  const [managePassword, setManagePassword] = useState(false);
  const [localNotice, setLocalNotice] = useState('');

  useEffect(() => {
    clearLocalAdminLaunch();
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
    const controller = new AbortController();
    fetch(localAdminEndpoint, { cache: 'no-store', redirect: 'error', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Local sign-in storage is unavailable. Check the local migrations and reload.');
        const result = await response.json();
        if (!controller.signal.aborted) setLocal(result);
      })
      .catch(err => {
        if (!controller.signal.aborted) setLocal({ error: err.message });
      });
    return () => controller.abort();
  }, []);

  const verifyKey = useCallback(async (key, fromSession = false) => {
    if (!key) return false;

    setIsChecking(true);
    setError('');

    try {
      const res = await fetch(verificationPath, {
        headers: { 'Authorization': `Bearer ${key}` }, cache: 'no-store', redirect: 'error'
      });

      if (res.status === 401) {
        setError('Invalid API key');
        sessionStorage.removeItem(STORAGE_KEY);
        if (fromSession) {
          setApiKey('');
          setShowKey(false);
        }
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
  }, [verificationPath]);

  // Auto-verify stored key on mount
  useEffect(() => {
    if (!storedKey) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) verifyKey(storedKey, true).finally(() => {
        if (!cancelled) setInitialCheckDone(true);
      });
    });
    return () => { cancelled = true; };
  }, [storedKey, verifyKey]);

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

  const handleLogout = useCallback(() => {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (token?.startsWith('local_admin_')) localAdminAction({ action: 'logout' }, token).catch(() => {});
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
    setApiKey('');
    setShowKey(false);
    setError('');
    setUseKey(false);
    setManagePassword(false);
    setLocalNotice('');
  }, []);

  function acceptPasswordSession(token) {
    sessionStorage.setItem(STORAGE_KEY, token);
    setApiKey(token);
    setLocal({ available: true, passwordConfigured: true });
    setLaunch('');
    setIsAuthenticated(true);
    setManagePassword(false);
    setUseKey(false);
    setShowKey(false);
    setError('');
    setLocalNotice('Signed in with your local admin password.');
  }

  // Show nothing until initial check completes
  if (!initialCheckDone) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-main flex items-center justify-center">
        <div className="text-muted animate-pulse">Verifying access...</div>
      </main>
    );
  }

  // Authenticated - render children with apiKey and logout handler
  if (isAuthenticated) {
    return <LocalAdminAccessContext.Provider value={local?.available ? () => setManagePassword(true) : null}>
      {children({ apiKey, onLogout: handleLogout })}
      <span className="sr-only" role="status">{localNotice}</span>
      {managePassword && <LocalPasswordDialog mode={local.passwordConfigured ? 'change' : 'setup'} credential={apiKey}
        onCancel={() => setManagePassword(false)} onSignedIn={acceptPasswordSession} />}
    </LocalAdminAccessContext.Provider>;
  }

  const passwordMode = local?.available && (local.passwordConfigured ? 'login' : launch ? 'setup' : null);
  if (passwordMode && !useKey) return <main id="main-content" tabIndex={-1} className="min-h-screen bg-main flex items-center justify-center p-4">
    <div className="w-full max-w-sm rounded-2xl border border-secondary/30 bg-surface p-6 shadow-xl">
      <LocalPasswordForm mode={passwordMode} setupToken={passwordMode === 'setup' ? launch : undefined} onSignedIn={acceptPasswordSession} />
      <button type="button" className="mt-4 text-sm text-muted underline" onClick={() => { setApiKey(''); setUseKey(true); }}>Use admin API key</button>
    </div>
  </main>;

  // Login form
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-main flex items-center justify-center p-4">
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
            <p className="text-xs text-muted">{description}</p>
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
                className="w-full rounded-xl border border-secondary/30 bg-main px-4 py-3 pr-10 text-main placeholder:text-muted/50 focus-visible:border-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/60"
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
            className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-main transition-all hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
          >
            {isChecking ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </div>

        {passwordMode && <button type="button" className="mt-4 text-sm text-muted underline" onClick={() => setUseKey(false)}>
          {passwordMode === 'setup' ? 'Create local admin password' : 'Use local admin password'}
        </button>}
        {local?.available && !local.passwordConfigured && !launch && <p className="mt-4 text-sm text-muted">
          To create your first local admin password, run <code>npm run admin:open</code> on this computer.
        </p>}
        {!local?.available && !launch && <p className="mt-4 text-xs text-muted text-center">Contact your administrator if you need access</p>}
        {local?.error && launch && <p className="mt-4 text-sm text-error" role="alert">Local sign-in setup is unavailable. Check the local migrations and reload.</p>}
      </form>
    </main>
  );
}
