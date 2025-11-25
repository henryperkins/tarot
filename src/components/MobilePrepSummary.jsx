import { TextAlignLeft, Sparkle, Gear } from '@phosphor-icons/react';

/**
 * Mobile-only condensed prep summary shown inline above the deck.
 * Displays current intention and ritual status with tap-to-edit affordance.
 * Addresses UX findings for mobile visibility and onboarding.
 */
export function MobilePrepSummary({
  userQuestion,
  knockCount,
  hasCut,
  cutIndex,
  onOpenSettings
}) {
  const hasQuestion = userQuestion && userQuestion.trim().length > 0;
  const knocksComplete = knockCount >= 3;
  const hasRitualProgress = knockCount > 0 || hasCut;

  // Truncate question for mobile display
  const displayQuestion = hasQuestion
    ? userQuestion.trim().length > 50
      ? `${userQuestion.trim().slice(0, 47)}…`
      : userQuestion.trim()
    : null;

  return (
    <div className="sm:hidden mb-4">
      <button
        type="button"
        onClick={onOpenSettings}
        className="w-full rounded-xl border border-secondary/30 bg-surface/60 backdrop-blur-sm p-3 text-left transition active:bg-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 touch-manipulation"
        aria-label="Open reading preparation settings"
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[0.65rem] uppercase tracking-wider text-accent font-semibold">
            Prepare Your Reading
          </span>
          <Gear className="w-4 h-4 text-accent" aria-hidden="true" />
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {/* Intention status */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
            hasQuestion
              ? 'bg-secondary/20 border border-secondary/40 text-secondary'
              : 'bg-surface-muted/60 border border-accent/20 text-muted'
          }`}>
            <TextAlignLeft className="w-3 h-3" aria-hidden="true" />
            <span className="truncate max-w-[10rem]">
              {displayQuestion || 'Set intention'}
            </span>
          </div>

          {/* Ritual status */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
            hasRitualProgress
              ? 'bg-secondary/20 border border-secondary/40 text-secondary'
              : 'bg-surface-muted/60 border border-accent/20 text-muted'
          }`}>
            <Sparkle className="w-3 h-3" weight={hasRitualProgress ? 'fill' : 'regular'} aria-hidden="true" />
            <span>
              {hasRitualProgress
                ? `${knocksComplete ? '✓ Cleared' : `${knockCount}/3`}${hasCut ? ` · Cut ${cutIndex}` : ''}`
                : 'Ritual (optional)'
              }
            </span>
          </div>
        </div>

        {/* Hint text */}
        {!hasQuestion && !hasRitualProgress && (
          <p className="mt-2 text-[0.68rem] text-muted leading-snug">
            Tap to set an intention and prepare your deck before drawing.
          </p>
        )}
      </button>
    </div>
  );
}
