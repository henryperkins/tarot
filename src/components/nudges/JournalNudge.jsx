import { Notebook } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * JournalNudge - Post-reading prompt to save to journal
 *
 * Shown after the first reading's narrative is generated.
 * Introduces the journal feature for tracking patterns over time.
 *
 * @param {function} onSave - Called when user wants to save the reading
 * @param {function} onDismiss - Called when user dismisses the nudge
 */
export function JournalNudge({ onSave, onDismiss }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`rounded-2xl border border-success/30 bg-success/5 p-4 ${
        prefersReducedMotion ? '' : 'animate-fade-in-up'
      }`}
      role="region"
      aria-label="Journal introduction"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
          <Notebook className="w-5 h-5 text-success" weight="duotone" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-main text-sm">Save to your journal?</h4>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Track patterns and revisit insights over time. Your journal helps you see
            how themes evolve across readings.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={onSave}
              className="min-h-cta px-4 py-1.5 rounded-full bg-success text-surface text-xs font-medium transition hover:bg-success/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/60 focus-visible:ring-offset-2"
            >
              Save reading
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="min-h-touch px-4 py-1.5 rounded-full border border-secondary/30 text-muted text-xs font-medium transition hover:border-secondary/50 hover:text-main active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
