import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';
import { X, Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import { useSmallScreen } from '../hooks/useSmallScreen';

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const { register, login, requestPasswordReset, resendVerification, error: authError } = useAuth();
  const isSmallScreen = useSmallScreen();
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  // Use modal accessibility hook for scroll lock, escape key, and focus restoration
  // trapFocus: false because FocusTrap library handles focus trapping
  useModalA11y(isOpen, {
    onClose,
    containerRef: modalRef,
    trapFocus: false,
    initialFocusRef: firstInputRef,
  });

  // Sync mode with initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      const validModes = ['login', 'register', 'forgot'];
      setMode(validModes.includes(initialMode) ? initialMode : 'login');
      setError('');
      setSuccess('');
    }
  }, [isOpen, initialMode]);

  // Reset password visibility when mode changes
  useEffect(() => {
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        // Validate registration fields
        if (!email || !username || !password || !confirmPassword) {
          setError('All fields are required');
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }

        const result = await register(email, username, password);

        if (result.success) {
          setSuccess('Account created successfully!');
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError(result.error || 'Registration failed');
        }
      } else if (mode === 'forgot') {
        if (!email) {
          setError('Email is required to send a reset link');
          return;
        }

        const result = await requestPasswordReset(email);
        if (result.success) {
          setSuccess('If this email is registered, you will receive a reset link shortly.');
          setTimeout(() => {
            setMode('login');
            setPassword('');
            setConfirmPassword('');
            setSuccess('');
          }, 1600);
        } else {
          setError(result.error || 'Unable to send reset link');
        }
      } else {
        // Login
        if (!email || !password) {
          setError('Email and password are required');
          return;
        }

        const result = await login(email, password);

        if (result.success) {
          setSuccess('Logged in successfully!');
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setSuccess('');

    if (!email) {
      setError('Enter your email to resend a verification link');
      return;
    }

    setLoading(true);
    try {
      const result = await resendVerification(email);
      if (result.success) {
        setSuccess('If this email is registered, a verification email is on the way.');
      } else {
        setError(result.error || 'Unable to send verification email');
      }
    } catch (err) {
      setError(err.message || 'Unable to send verification email');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    const nextMode = mode === 'register' ? 'login' : 'register';
    setMode(nextMode);
    setError('');
    setSuccess('');
    // Preserve email when switching modes
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const goToForgot = () => {
    setMode('forgot');
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const goToLogin = () => {
    setMode('login');
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const inputBaseClasses = `
    w-full px-4 py-3 min-h-cta
    bg-surface-muted border border-primary/30 rounded-lg
    text-main placeholder-main/40
    focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
    disabled:opacity-60 disabled:cursor-not-allowed
    transition-colors
  `;

  const errorId = error || authError ? 'auth-error' : undefined;
  const overlayClasses = [
    'fixed inset-0 z-[1300] flex justify-center bg-main/90 backdrop-blur-sm animate-fade-in overflow-y-auto px-safe pt-safe pb-safe-bottom',
    isSmallScreen ? 'items-start px-4 py-8' : 'items-center p-4',
  ].join(' ');
  const modalClasses = [
    'relative w-full bg-surface rounded-2xl border border-primary/40 shadow-2xl animate-pop-in overflow-y-auto',
    isSmallScreen ? 'max-w-full mx-auto my-6' : 'max-w-md max-h-[90vh]',
  ].join(' ');

  const content = (
    <div className={overlayClasses} onClick={createBackdropHandler(onClose)}>
      <FocusTrap
        active={isOpen}
        focusTrapOptions={{
          initialFocus: () => firstInputRef.current,
          escapeDeactivates: false,
          clickOutsideDeactivates: false,
          returnFocusOnDeactivate: false,
          allowOutsideClick: true,
        }}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          aria-describedby={errorId}
          className={modalClasses}
        >
          {/* Close button - 44px touch target */}
          <button
            onClick={onClose}
            className="
              absolute top-3 right-3 z-10
              flex items-center justify-center
              w-11 h-11 min-w-touch min-h-touch
              rounded-full
              text-accent hover:text-main hover:bg-accent/10
              active:bg-accent/20 active:scale-95
              transition touch-manipulation
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
            "
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Header */}
          <div className="px-6 sm:px-8 pt-8 pb-5 border-b border-primary/20">
            <h2 id="auth-modal-title" className="text-2xl font-serif text-accent pr-8">
              {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Access'}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {mode === 'login'
                ? 'Sign in to access your journal across devices'
                : mode === 'register'
                  ? 'Register to save your readings to the cloud'
                  : 'We will email you a secure link to set a new password'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-6">
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-accent mb-1.5">
                  Email
                </label>
                <input
                  ref={firstInputRef}
                  type="email"
                  id="auth-email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputBaseClasses}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  aria-invalid={Boolean(error || authError)}
                />
              </div>

              {/* Username (register only) */}
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-username" className="block text-sm font-medium text-accent mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    id="auth-username"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputBaseClasses}
                    placeholder="Choose a username"
                    required
                    disabled={loading}
                    pattern="[a-zA-Z0-9_]{3,30}"
                    title="3-30 characters, letters, numbers, and underscores only"
                    aria-describedby="username-hint"
                  />
                  <p id="username-hint" className="mt-1 text-xs text-muted">
                    3-30 characters, letters, numbers, and underscores
                  </p>
                </div>
              )}

              {/* Password */}
              {mode === 'forgot' && (
                <p className="text-xs text-muted">
                  Enter the email you use for Tableu. If it matches an account, we will send a reset link and a fresh verification email.
                </p>
              )}

              {mode !== 'forgot' && (
                <div>
                  <label htmlFor="auth-password" className="block text-sm font-medium text-accent mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="auth-password"
                      name="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputBaseClasses} pr-12`}
                      placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                      required
                      disabled={loading}
                      minLength={8}
                      aria-invalid={Boolean(error || authError)}
                      aria-describedby={mode === 'register' ? 'password-hint' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="
                        absolute right-1 top-1/2 -translate-y-1/2
                        flex items-center justify-center
                        w-10 h-10 min-w-[40px] min-h-[40px]
                        rounded-lg
                        text-muted hover:text-accent
                        active:bg-accent/10
                        transition touch-manipulation
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                      "
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? (
                        <EyeSlash className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {mode === 'register' && (
                    <p id="password-hint" className="mt-1 text-xs text-muted">
                      Minimum 8 characters
                    </p>
                  )}
                </div>
              )}

              {/* Confirm Password (register only) */}
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-confirm-password" className="block text-sm font-medium text-accent mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="auth-confirm-password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputBaseClasses} pr-12`}
                      placeholder="Confirm your password"
                      required
                      disabled={loading}
                      minLength={8}
                      aria-invalid={Boolean(error && error.includes('match'))}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="
                        absolute right-1 top-1/2 -translate-y-1/2
                        flex items-center justify-center
                        w-10 h-10 min-w-[40px] min-h-[40px]
                        rounded-lg
                        text-muted hover:text-accent
                        active:bg-accent/10
                        transition touch-manipulation
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                      "
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showConfirmPassword}
                    >
                      {showConfirmPassword ? (
                        <EyeSlash className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'login' && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm pt-1">
                  <button
                    type="button"
                    onClick={goToForgot}
                    className="text-accent hover:text-accent/80 underline underline-offset-4"
                    disabled={loading}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="text-accent hover:text-accent/80 underline underline-offset-4 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    Resend verification email
                  </button>
                </div>
              )}
            </div>

            {/* Error message */}
            {(error || authError) && (
              <div
                id="auth-error"
                role="alert"
                className="mt-4 p-3 bg-error/10 border border-error/40 rounded-lg"
              >
                <p className="text-sm text-error">{error || authError}</p>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div role="status" className="mt-4 p-3 bg-secondary/10 border border-secondary/40 rounded-lg">
                <p className="text-sm text-secondary">{success}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="
                mt-6 w-full px-6 py-3 min-h-cta
                bg-primary hover:bg-primary/90 active:bg-primary/80
                text-surface font-medium rounded-lg
                transition touch-manipulation
                disabled:opacity-50 disabled:cursor-not-allowed
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
                focus-visible:ring-offset-2 focus-visible:ring-offset-surface
              "
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-surface"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'login'
                    ? 'Signing in...'
                    : mode === 'register'
                      ? 'Creating account...'
                      : 'Sending link...'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'
              )}
            </button>

            {/* Switch mode */}
            <div className="mt-6 text-center">
              {mode === 'forgot' ? (
                <button
                  type="button"
                  onClick={goToLogin}
                  className="
                    text-sm text-accent hover:text-accent/80
                    underline underline-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    touch-manipulation
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                    rounded px-2 py-1
                  "
                  disabled={loading}
                >
                  Remembered it? Back to sign in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={switchMode}
                  className="
                    text-sm text-accent hover:text-accent/80
                    underline underline-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    touch-manipulation
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                    rounded px-2 py-1
                  "
                  disabled={loading}
                >
                  {mode === 'login'
                    ? "Don't have an account? Register"
                    : 'Already have an account? Sign in'}
                </button>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 sm:px-8 pb-6 pt-4 border-t border-primary/20">
            <p className="text-xs text-muted/60 text-center">
              Your readings are private. We never share your data.
            </p>
          </div>
        </div>
      </FocusTrap>
    </div>
  );

  // Portal the modal to <body> so it can't be constrained by transformed/sticky parents
  // (which can break `position: fixed` on mobile browsers).
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
