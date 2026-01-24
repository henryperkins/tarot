import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, LockKey, WarningCircle } from '@phosphor-icons/react';
import { GlobalNav } from '../components/GlobalNav';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tokenMissing = !token;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (tokenMissing) {
      setError('This reset link is missing or invalid.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords need to match.');
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
        const friendly =
          reason === 'invalid_or_expired_token'
            ? 'This reset link is invalid or has expired. Request a new link from the sign-in dialog.'
            : reason;
        throw new Error(friendly || 'Unable to reset password');
      }

      setSuccess('Password updated. You can sign in with your new password.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = `
    w-full px-4 py-3 rounded-xl bg-surface-muted border border-primary/30
    text-main placeholder-main/40 focus:outline-none focus:ring-2 focus:ring-primary/60
    focus:border-primary/50 transition disabled:opacity-60 disabled:cursor-not-allowed
  `;

  return (
    <div className="min-h-screen bg-main text-main">
      <header
        className="sticky top-0 z-30 border-b border-secondary/20 bg-main/95 backdrop-blur-sm pt-[max(var(--safe-pad-top),0.75rem)] pl-[max(var(--safe-pad-left),1rem)] pr-[max(var(--safe-pad-right),1rem)]"
      >
        <div className="mx-auto max-w-2xl px-4 py-3">
          <GlobalNav condensed withUserChip />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-4 py-10 short:py-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-main transition"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <div className="rounded-2xl border border-primary/30 bg-surface px-6 py-6 shadow-xl shadow-main/20">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <LockKey className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-accent">Reset your password</h1>
              <p className="text-sm text-muted mt-1">
                Choose a new password for your Tableu account. Reset links expire after 30 minutes.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {tokenMissing && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-amber-50">
                <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="fill" aria-hidden="true" />
                <p className="text-sm text-amber-50/90">
                  This reset link is missing a token. Try requesting a fresh link from the sign-in dialog.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-accent mb-1">
                New password
              </label>
              <input
                id="reset-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                placeholder="At least 8 characters"
                required
                disabled={loading || tokenMissing}
              />
            </div>

            <div>
              <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-accent mb-1">
                Confirm password
              </label>
              <input
                id="reset-password-confirm"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClasses}
                placeholder="Re-enter password"
                required
                disabled={loading || tokenMissing}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-error/50 bg-error/10 px-3 py-2 text-sm text-error">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-start gap-2 rounded-xl border border-secondary/50 bg-secondary/10 px-3 py-2 text-sm text-secondary">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="duotone" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-main">Password reset</p>
                  <p className="text-secondary text-sm">{success}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || tokenMissing}
              className="
                w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-surface
                hover:bg-primary/90 active:bg-primary/80 transition
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            >
              {loading ? 'Updating password...' : 'Update password'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-muted">
            <Link to="/" className="underline underline-offset-4 hover:text-main">
              Return to home
            </Link>
            <Link to="/account" className="underline underline-offset-4 hover:text-main">
              Continue to account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
