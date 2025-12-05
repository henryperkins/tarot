import { Hand } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * RitualNudge - Contextual education about the ritual feature
 *
 * Shown during first reading, after spread is confirmed but before shuffle.
 * Introduces the knock-and-cut ritual as an optional way to personalize the shuffle.
 *
 * @param {function} onEnableRitual - Called when user wants to try the ritual
 * @param {function} onSkip - Called when user wants to skip
 */
export function RitualNudge({ onEnableRitual, onSkip }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`rounded-2xl border border-accent/30 bg-accent/5 p-4 ${
        prefersReducedMotion ? '' : 'animate-fade-in-up'
      }`}
      role="region"
      aria-label="Ritual introduction"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <Hand className="w-5 h-5 text-accent" weight="duotone" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-main text-sm">Optional: Add a ritual</h4>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Knock three times and cut the deck to infuse your energy into the shuffle.
            Many readers find this helps focus their intention.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={onEnableRitual}
              className="min-h-[36px] px-4 py-1.5 rounded-full bg-accent text-surface text-xs font-medium transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Try it
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="min-h-[36px] px-4 py-1.5 rounded-full border border-secondary/30 text-muted text-xs font-medium transition hover:border-secondary/50 hover:text-main active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
