import { forwardRef } from 'react';
import { Sparkle, GearSix } from '@phosphor-icons/react';
import { DECK_OPTIONS } from './deckOptions';
import { QuestionInput } from './QuestionInput';

/**
 * QuickIntentionCard - Mobile quick intention entry
 *
 * Keeps the question visible on mobile without opening the full drawer.
 * Extracted from TarotReading.jsx for reusability and landscape layouts.
 */
export const QuickIntentionCard = forwardRef(function QuickIntentionCard({
  variant = 'full',
  highlight = false,
  userQuestion,
  onQuestionChange,
  placeholderQuestion,
  onPlaceholderRefresh,
  inputRef,
  onInputFocus,
  onInputBlur,
  onCoachOpen,
  onMoreOpen,
  deckStyleId,
  selectedSpread,
  onDeckChange
}, ref) {
  const isCompact = variant === 'compact';

  if (isCompact) {
    const trimmedQuestion = userQuestion.trim();
    return (
      <div
        ref={ref}
        className={`scroll-mt-[calc(var(--sticky-header-height,0px)+1rem)] rounded-2xl border border-secondary/30 bg-surface/70 px-4 py-2 shadow-lg shadow-main/20 transition selection:bg-accent selection:text-surface ${
          highlight ? 'ring-2 ring-accent/50 shadow-xl shadow-accent/10' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-serif text-base text-accent">Your intention</p>
            <p className={`text-xs ${trimmedQuestion ? 'text-secondary' : 'text-muted'} truncate`}>
              {trimmedQuestion || 'Add an optional question.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onMoreOpen}
            aria-haspopup="dialog"
            className="min-h-touch min-w-touch rounded-xl border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Edit your intention"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`scroll-mt-[calc(var(--sticky-header-height,0px)+1rem)] rounded-2xl border border-secondary/30 bg-surface/70 px-4 py-3 shadow-lg shadow-main/20 flex flex-col gap-3 transition selection:bg-accent selection:text-surface ${
        highlight ? 'ring-2 ring-accent/50 shadow-xl shadow-accent/10' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 basis-44">
          <label htmlFor="quick-intention" className="font-serif text-base text-accent">Your intention</label>
          <p className="mt-1 text-xs text-muted">Optional. Add a question, or leave it open.</p>
        </div>
        <button
          type="button"
          onClick={onCoachOpen}
          aria-haspopup="dialog"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-secondary/40 min-h-touch min-w-touch px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-label="Open guided intention coach"
        >
          <Sparkle className="w-4 h-4" weight="duotone" aria-hidden="true" />
          Coach
        </button>
      </div>
      <QuestionInput
        variant="compact"
        id="quick-intention"
        inputRef={inputRef}
        userQuestion={userQuestion}
        setUserQuestion={onQuestionChange}
        onFocus={onInputFocus}
        onBlur={onInputBlur}
        placeholderQuestion={placeholderQuestion}
        onPlaceholderRefresh={onPlaceholderRefresh}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
        <span className="min-w-0 break-words font-semibold">
          {DECK_OPTIONS.find(d => d.id === deckStyleId)?.label || 'Selected deck'}
        </span>
        <button
          type="button"
          onClick={onDeckChange}
          aria-haspopup="dialog"
          aria-label="Change deck"
          className="min-h-touch min-w-touch px-3 py-2 text-xs font-semibold text-secondary underline underline-offset-4 rounded-lg hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Change
        </button>
        <button
          type="button"
          onClick={onMoreOpen}
          aria-haspopup="dialog"
          className="shrink-0 min-h-touch min-w-touch rounded-xl border border-secondary/40 px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="More reading settings"
        >
          <span className="flex items-center gap-1">
            <GearSix className="w-4 h-4" weight="duotone" aria-hidden="true" />
            <span className="hidden xxs:inline">More</span>
          </span>
        </button>
      </div>
      {selectedSpread && userQuestion.trim().length > 0 && (
        <p className="text-xs text-secondary">
          Next: tap <span className="font-semibold text-main">Shuffle &amp; draw</span> below when you&apos;re ready.
        </p>
      )}
    </div>
  );
});

export default QuickIntentionCard;
