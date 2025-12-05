import { ShieldCheck } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * AccountNudge - Deferred registration prompt
 *
 * Shown after the 3rd journal save if user is not authenticated.
 * Encourages account creation for cross-device sync and backup.
 *
 * @param {function} onCreateAccount - Called when user wants to create account
 * @param {function} onDismiss - Called when user dismisses the nudge
 */
export function AccountNudge({ onCreateAccount, onDismiss }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`rounded-2xl border border-primary/30 bg-primary/5 p-4 ${
        prefersReducedMotion ? '' : 'animate-fade-in-up'
      }`}
      role="region"
      aria-label="Account creation suggestion"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" weight="duotone" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-main text-sm">Protect your readings</h4>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Create a free account to sync your journal across devices and never lose
            your insights. Your readings stay private and secure.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={onCreateAccount}
              className="min-h-[36px] px-4 py-1.5 rounded-full bg-primary text-surface text-xs font-medium transition hover:bg-primary/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Create account
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-[36px] px-4 py-1.5 rounded-full border border-secondary/30 text-muted text-xs font-medium transition hover:border-secondary/50 hover:text-main active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
