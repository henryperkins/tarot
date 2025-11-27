import { useState } from 'react';
import { ArrowLeft, ArrowRight, User, EnvelopeSimple, Lock, Check, CircleNotch, CloudArrowUp, Warning } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { useAuth } from '../../contexts/AuthContext';

/**
 * AccountSetup - Step 2 of onboarding
 *
 * Explains benefits of account creation and provides
 * inline registration form. Users can skip if preferred.
 */
export function AccountSetup({ onNext, onBack }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const { isAuthenticated, user, register, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await register(email, username, password);
    
    setIsSubmitting(false);
    
    if (result.success) {
      onNext();
    } else {
      setError(result.error || 'Registration failed. Please try again.');
    }
  };

  // If already authenticated, show success state
  if (isAuthenticated && user) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className={`text-center mb-4 sm:mb-6 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
        >
          <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
            You&apos;re All Set
          </h2>
        </div>

        {/* Already authenticated content */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div
            className={`rounded-2xl border border-success/30 bg-success/10 p-6 text-center max-w-sm ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.1s' }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-success" weight="bold" aria-hidden="true" />
            </div>
            <p className="text-lg text-main font-medium mb-2">
              You&apos;re signed in as {user.username || user.email}
            </p>
            <p className="text-sm text-muted">
              Your readings will sync across devices automatically.
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className={`flex gap-3 pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-1 min-h-[48px] px-4 py-3 rounded-xl border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Back</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-accent text-surface font-semibold text-base transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            Continue
            <ArrowRight className="w-5 h-5" weight="bold" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`text-center mb-4 sm:mb-6 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
          Save Your Journey
        </h2>
        <p className={`text-muted mt-2 max-w-md mx-auto ${isLandscape ? 'text-sm' : ''}`}>
          Create an account to keep your readings safe and synced.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
        {/* Benefits */}
        <div
          className={`rounded-2xl border border-accent/20 bg-surface/50 p-5 ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          } ${isLandscape ? 'p-4' : ''}`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <CloudArrowUp className="w-5 h-5 text-accent" weight="duotone" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-main">Benefits of an account</h3>
          </div>
          <ul className={`space-y-2 ${isLandscape ? 'text-sm' : ''}`}>
            <li className="flex items-start gap-2 text-muted">
              <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
              <span>Sync your readings across devices</span>
            </li>
            <li className="flex items-start gap-2 text-muted">
              <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
              <span>Track patterns over time</span>
            </li>
            <li className="flex items-start gap-2 text-muted">
              <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
              <span>Never lose your insights</span>
            </li>
          </ul>
        </div>

        {/* Registration form */}
        <form
          onSubmit={handleSubmit}
          className={`space-y-4 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
          style={{ animationDelay: '0.2s' }}
        >
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
              <Warning className="w-5 h-5 shrink-0" weight="fill" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Email input */}
          <div>
            <label htmlFor="signup-email" className="flex items-center gap-2 text-sm text-accent mb-2">
              <EnvelopeSimple className="w-4 h-4" weight="duotone" aria-hidden="true" />
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full bg-surface border border-primary/40 rounded-xl px-4 py-3 text-base text-main placeholder-muted/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all"
            />
          </div>

          {/* Username input */}
          <div>
            <label htmlFor="signup-username" className="flex items-center gap-2 text-sm text-accent mb-2">
              <User className="w-4 h-4" weight="duotone" aria-hidden="true" />
              Username
            </label>
            <input
              id="signup-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              autoComplete="username"
              className="w-full bg-surface border border-primary/40 rounded-xl px-4 py-3 text-base text-main placeholder-muted/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all"
            />
          </div>

          {/* Password input */}
          <div>
            <label htmlFor="signup-password" className="flex items-center gap-2 text-sm text-accent mb-2">
              <Lock className="w-4 h-4" weight="duotone" aria-hidden="true" />
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full bg-surface border border-primary/40 rounded-xl px-4 py-3 text-base text-main placeholder-muted/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all"
            />
            <p className="text-xs text-muted mt-1">At least 8 characters</p>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || authLoading}
            className="w-full flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-accent text-surface font-semibold text-base transition hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            {isSubmitting ? (
              <>
                <CircleNotch className="w-5 h-5 animate-spin" aria-hidden="true" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-5 h-5" weight="bold" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Navigation */}
      <div className={`flex flex-col gap-3 pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-1 min-h-[48px] px-4 py-3 rounded-xl border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Back</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 min-h-[48px] px-4 py-3 text-muted hover:text-main text-sm transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            Skip
          </button>
        </div>
        <p className="text-xs text-muted text-center">
          You can always create an account later from Settings
        </p>
      </div>
    </div>
  );
}
