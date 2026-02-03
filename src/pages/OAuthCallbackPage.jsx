import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function OAuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const errorParam = searchParams.get('error') || '';
  const errorDescription = searchParams.get('error_description') || '';
  const code = searchParams.get('code') || '';
  const state = searchParams.get('state') || '';
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('Completing your sign-in. This takes a moment.');
  const callbackRequestRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let redirectTimeout = null;

    const fail = (text) => {
      if (cancelled) return;
      setStatus('error');
      setMessage(text);
    };

    if (errorParam || errorDescription) {
      fail(errorDescription || errorParam || 'Login failed.');
      return () => {};
    }

    if (!code || !state) {
      fail('Missing login response.');
      return () => {};
    }

    const getCallbackPromise = () => {
      const cached = callbackRequestRef.current;
      if (cached?.search === location.search) {
        return cached.promise;
      }

      const promise = fetch(`/api/auth/oauth-callback${location.search}`, {
        method: 'POST',
        credentials: 'include'
      }).then(async response => {
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, data };
      });

      callbackRequestRef.current = { search: location.search, promise };
      return promise;
    };

    const completeLogin = async () => {
      try {
        if (!cancelled) {
          setStatus('pending');
          setMessage('Completing your sign-in. This takes a moment.');
        }
        const result = await getCallbackPromise();
        if (!result.ok) {
          const errorMessage = result.data?.error || 'Login failed.';
          fail(errorMessage);
          return;
        }

        const redirectTo = typeof result.data?.redirectTo === 'string'
          ? result.data.redirectTo
          : '/account';
        if (cancelled) return;
        setStatus('success');
        setMessage('Signed in successfully. Redirecting you now.');
        await checkAuth();

        if (cancelled) return;
        redirectTimeout = window.setTimeout(() => {
          window.location.replace(redirectTo);
        }, 900);
      } catch (err) {
        fail(err?.message || 'Login failed.');
      }
    };

    completeLogin();

    return () => {
      cancelled = true;
      if (redirectTimeout) {
        window.clearTimeout(redirectTimeout);
      }
    };
  }, [checkAuth, code, errorDescription, errorParam, location.search, state]);

  const heading = status === 'error'
    ? 'Login failed'
    : status === 'success'
      ? 'Signed in'
      : 'Signing you in...';

  return (
    <div className="min-h-screen bg-main text-main flex items-center justify-center px-6">
      <div className="max-w-sm w-full rounded-2xl border border-secondary/30 bg-surface px-6 py-8 text-center">
        <CircleNotch
          className={`h-8 w-8 text-accent mx-auto ${status === 'pending' ? 'animate-spin' : ''}`}
        />
        <h1 className="mt-4 text-lg font-semibold text-main">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {message}
        </p>
        {status === 'error' && (
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
