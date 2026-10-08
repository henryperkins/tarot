import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, CircleNotch, EnvelopeOpen, WarningCircle } from '@phosphor-icons/react';
import { GlobalNav } from '../components/GlobalNav';
import { InstallFooter } from '../components/InstallFooter';
import { useResponsiveSticky } from '../hooks/useResponsiveSticky';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [verification, setVerification] = useState({ token, status: 'pending', message: '' });
  if (verification.token !== token) {
    setVerification({ token, status: 'pending', message: '' });
  }
  const status = !token ? 'error' : verification.token === token ? verification.status : 'pending';
  const message = !token
    ? 'Verification link is missing a token. Request a new verification email from the sign-in dialog.'
    : verification.token === token ? verification.message : '';
  const headerRef = useResponsiveSticky();

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();

    const verify = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (!response.ok) {
          const reason = data.error;
          const friendly =
            reason === 'invalid_or_expired_token'
              ? 'This verification link is invalid or has expired. Request a new one from the sign-in dialog.'
              : reason === 'missing_token'
                ? 'Verification token missing. Request a new email.'
                : reason;
          throw new Error(friendly || 'Unable to verify email');
        }

        setVerification({ token, status: 'success', message: 'Your email is confirmed. You can sign in and enable password recovery.' });
      } catch (err) {
        if (controller.signal.aborted) return;
        setVerification({ token, status: 'error', message: err.message || 'Unable to verify email' });
      }
    };

    verify();
    return () => controller.abort();
  }, [token]);

  const renderStatusIcon = () => {
    if (status === 'pending') {
      return <CircleNotch className="h-6 w-6 animate-spin text-secondary" aria-hidden="true" />;
    }
    if (status === 'success') {
      return <CheckCircle className="h-6 w-6 text-secondary" weight="duotone" aria-hidden="true" />;
    }
    return (
      <WarningCircle
        className={`h-6 w-6 ${status === 'error' ? 'text-error' : 'text-warning'}`}
        weight="duotone"
        aria-hidden="true"
      />
    );
  };
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

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl pl-[max(1rem,var(--safe-pad-left))] pr-[max(1rem,var(--safe-pad-right))] py-10 short:py-6">
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
            <div className="shrink-0 rounded-full bg-secondary/10 p-3 text-secondary">
              <EnvelopeOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 break-words">
              <h1 className="font-serif text-2xl text-accent">Verify your email</h1>
              <p className="text-sm text-muted mt-1">
                Confirming your email keeps your account recoverable.
              </p>
            </div>
          </div>

          <div role="status" aria-atomic="true" className="mt-6 flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-muted px-4 py-3">
            <div className="shrink-0">{renderStatusIcon()}</div>
            <div className="min-w-0 break-words">
              <p className="text-sm font-semibold text-main">
                {status === 'pending' && 'Checking your link...'}
                {status === 'success' && 'Email verified'}
                {status === 'error' && 'Verification failed'}
              </p>
              <p className="text-xs text-muted mt-1">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Link to="/" className={`${navigationClasses} underline underline-offset-4`}>
              Return to home
            </Link>
            <Link to="/account" className={`${navigationClasses} underline underline-offset-4`}>
              Go to account
            </Link>
          </div>
        </div>
        <InstallFooter />
      </main>
    </div>
  );
}
