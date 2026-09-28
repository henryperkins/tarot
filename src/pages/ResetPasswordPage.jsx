import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, LockKey, WarningCircle } from '@phosphor-icons/react';
import { GlobalNav } from '../components/GlobalNav';
import { useResponsiveSticky } from '../hooks/useResponsiveSticky';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null);
  const [success, setSuccess] = useState('');
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const headerRef = useResponsiveSticky();

  const tokenMissing = !token;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || success) return;
    setError('');
    setErrorField(null);

    if (tokenMissing) {
      setError('This reset link is missing or invalid.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      setErrorField('password');
      passwordRef.current?.focus();
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords need to match.');
      setErrorField('confirmPassword');
      confirmPasswordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = data.error;
        setError(
          reason === 'invalid_or_expired_token' || reason === 'missing_token'
            ? 'This reset link is invalid or has expired. Request a new link from the sign-in dialog.'
            : response.status === 429
              ? 'Too many reset attempts. Please wait a moment and try again.'
              : 'We could not reset your password. Please try again.'
        );
        return;
      }

      setSuccess('Password updated. You can sign in with your new password.');
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('We could not reach Tableu. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = `
    min-w-0 w-full px-4 py-3 rounded-xl bg-surface-muted border border-primary/30
    text-base text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/60
    focus:border-primary/50 transition disabled:opacity-60 disabled:cursor-not-allowed
  `;
  const navigationClasses = 'min-h-touch min-w-touch inline-flex items-center justify-center rounded-lg px-2 py-2 text-sm text-muted hover:text-main transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <div className="min-h-screen bg-main text-main">
      <header
        ref={headerRef}
        className="sticky top-0 z-sticky-nav border-b border-secondary/20 bg-main/95 backdrop-blur-sm pt-[max(var(--safe-pad-top),0.75rem)] pl-[max(var(--safe-pad-left),1rem)] pr-[max(var(--safe-pad-right),1rem)]"
      >
        <div className="mx-auto max-w-2xl px-4 py-3">
          <GlobalNav condensed withUserChip />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-4 py-10 short:py-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`${navigationClasses} mb-4 gap-2`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <div className="min-w-0 rounded-2xl border border-primary/30 bg-surface p-4 sm:p-6 shadow-xl shadow-main/20">
          <div className="flex flex-col items-start gap-3 sm:flex-row">
            <div className="shrink-0 rounded-full bg-primary/10 p-3 text-primary">
              <LockKey className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 break-words">
              <h1 className="font-serif text-2xl text-accent">Reset your password</h1>
              <p className="text-sm text-muted mt-1">
                Choose a new password for your Tableu account. Reset links expire after 30 minutes.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} aria-busy={loading} className="mt-6 space-y-4">
            {tokenMissing && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/60 bg-warning/10 px-3 py-2 text-warning">
                <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="fill" aria-hidden="true" />
                <p className="text-sm text-warning/90">
                  This reset link is missing a token. Try requesting a fresh link from the sign-in dialog.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-accent mb-1">
                New password
              </label>
              <input
                ref={passwordRef}
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorField) {
                    setErrorField(null);
                    setError('');
                  }
                }}
                aria-invalid={errorField === 'password'}
                aria-describedby={errorField === 'password' ? 'reset-password-error' : undefined}
                className={inputClasses}
                placeholder="At least 8 characters"
                required
                disabled={loading || tokenMissing || Boolean(success)}
              />
            </div>

            <div>
              <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-accent mb-1">
                Confirm password
              </label>
              <input
                ref={confirmPasswordRef}
                id="reset-password-confirm"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorField) {
                    setErrorField(null);
                    setError('');
                  }
                }}
                aria-invalid={errorField === 'confirmPassword'}
                aria-describedby={errorField === 'confirmPassword' ? 'reset-password-error' : undefined}
                className={inputClasses}
                placeholder="Re-enter password"
                required
                disabled={loading || tokenMissing || Boolean(success)}
              />
            </div>

            {error && (
              <div id="reset-password-error" role="alert" aria-atomic="true" className="break-words rounded-xl border border-error/50 bg-error/10 px-3 py-2 text-sm text-error">
                {error}
              </div>
            )}

            {success && (
              <div role="status" aria-atomic="true" className="flex items-start gap-2 rounded-xl border border-secondary/50 bg-secondary/10 px-3 py-2 text-sm text-secondary">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="duotone" aria-hidden="true" />
                <div className="min-w-0 break-words">
                  <p className="font-semibold text-main">Password reset</p>
                  <p className="text-secondary text-sm">{success}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || tokenMissing || Boolean(success)}
              className="
                min-h-touch w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-surface
                hover:bg-primary/90 active:bg-primary/80 transition
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {loading ? 'Updating password...' : 'Update password'}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Link to="/" className={`${navigationClasses} underline underline-offset-4`}>
              Return to home
            </Link>
            <Link to="/account" className={`${navigationClasses} underline underline-offset-4`}>
              Continue to account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
