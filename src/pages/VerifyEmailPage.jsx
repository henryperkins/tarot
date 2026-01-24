import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, CircleNotch, EnvelopeOpen, WarningCircle } from '@phosphor-icons/react';
import { GlobalNav } from '../components/GlobalNav';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState(token ? 'pending' : 'missing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification link is missing a token. Request a new verification email from the sign-in dialog.');
      return;
    }

    const verify = async () => {
      setStatus('pending');
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => ({}));

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

        setStatus('success');
        setMessage('Your email is confirmed. You can sign in and enable password recovery.');
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Unable to verify email');
      }
    };

    verify();
  }, [token]);

  const renderStatusIcon = () => {
    if (status === 'pending') {
      return <CircleNotch className="h-6 w-6 animate-spin text-secondary" aria-hidden="true" />;
    }
    if (status === 'success') {
      return <CheckCircle className="h-6 w-6 text-secondary" weight="duotone" aria-hidden="true" />;
    }
    return <WarningCircle className="h-6 w-6 text-amber-300" weight="duotone" aria-hidden="true" />;
  };

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
            <div className="rounded-full bg-secondary/10 p-3 text-secondary">
              <EnvelopeOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-accent">Verify your email</h1>
              <p className="text-sm text-muted mt-1">
                Confirming your email keeps your account recoverable.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-surface-muted px-4 py-3">
            {renderStatusIcon()}
            <div>
              <p className="text-sm font-semibold text-main">
                {status === 'pending' && 'Checking your link...'}
                {status === 'success' && 'Email verified'}
                {status === 'error' && 'Verification failed'}
              </p>
              <p className="text-xs text-muted mt-1">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-muted">
            <Link to="/" className="underline underline-offset-4 hover:text-main">
              Return to home
            </Link>
            <Link to="/account" className="underline underline-offset-4 hover:text-main">
              Go to account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
