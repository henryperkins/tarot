import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';

function parseHash(hash) {
  if (!hash || !hash.startsWith('#')) return {};
  const params = new URLSearchParams(hash.slice(1));
  return Object.fromEntries(params.entries());
}

function parseState(stateValue) {
  if (!stateValue) return null;
  try {
    if (typeof atob === 'function') {
      return JSON.parse(atob(stateValue));
    }
    return null;
  } catch {
    return null;
  }
}

export default function OAuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [error, setError] = useState('');
  const hashParams = useMemo(() => parseHash(location.hash), [location.hash]);
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    const stateParam = queryParams.get('state') || hashParams.state;
    const errorDescription =
      queryParams.get('error_description')
      || queryParams.get('error')
      || hashParams.error_description
      || hashParams.error;
    const state = parseState(stateParam);
    const returnUrl = state?.returnUrl || '/account';
    const code = queryParams.get('code') || hashParams.code;

    if (errorDescription) {
      setError(errorDescription);
      return;
    }

    if (!code) {
      setError('Missing OAuth code from login provider.');
      return;
    }

    if (!stateParam) {
      setError('Missing OAuth state from login provider.');
      return;
    }

    let cancelled = false;

    const exchange = async () => {
      try {
        const response = await fetch(`/api/auth/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(stateParam)}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Unable to sign in with Auth0');
        }

        if (cancelled) return;
        await checkAuth();
        const destination = data.redirectTo || returnUrl;
        window.location.assign(destination);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Unable to sign in with Auth0');
      }
    };

    exchange();

    return () => {
      cancelled = true;
    };
  }, [hashParams, queryParams, checkAuth, navigate]);

  return (
    <div className="min-h-screen bg-main text-main flex items-center justify-center px-6">
      <div className="max-w-sm w-full rounded-2xl border border-secondary/30 bg-surface px-6 py-8 text-center">
        <CircleNotch className="h-8 w-8 animate-spin text-accent mx-auto" />
        <h1 className="mt-4 text-lg font-semibold text-main">
          {error ? 'Login failed' : 'Signing you in...'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {error || 'Confirming your account with Auth0. This takes a moment.'}
        </p>
        {error && (
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-accent/40 px-4 py-2 text-xs font-semibold text-main hover:bg-accent/10 transition"
          >
            Back to account
          </button>
        )}
      </div>
    </div>
  );
}
