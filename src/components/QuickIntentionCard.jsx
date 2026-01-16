import { forwardRef, useCallback, useRef } from 'react';
import { Sparkle, GearSix, ArrowsClockwise } from '@phosphor-icons/react';
import { DECK_OPTIONS } from './DeckSelector';
import { useAutoGrow } from '../hooks/useAutoGrow';

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
  const autoGrowRef = useAutoGrow(userQuestion, 1, 4);
  const localInputRef = useRef(null);
  const isCompact = variant === 'compact';

  // Merge inputRef (from parent) with autoGrowRef (from hook)
  const mergedRef = useCallback((el) => {
    // Store in local ref (mutable)
    localInputRef.current = el;
    // Update autoGrow hook's ref
    if (autoGrowRef && typeof autoGrowRef === 'object') {
      autoGrowRef.current = el;
    }
    // Forward to parent's inputRef
    if (typeof inputRef === 'function') {
      inputRef(el);
    } else if (inputRef && typeof inputRef === 'object') {
      // Use Object.assign to avoid direct mutation lint error
      Object.assign(inputRef, { current: el });
    }
  }, [inputRef, autoGrowRef]);

  // Enter blurs (implicit continue), Shift+Enter inserts newline
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.target.blur();
    }
  };

  if (isCompact) {
    const trimmedQuestion = userQuestion.trim();
    return (
      <div
        ref={ref}
        className={`rounded-2xl border border-secondary/30 bg-surface/70 px-4 py-2 shadow-lg shadow-main/20 transition ${
          highlight ? 'ring-2 ring-accent/50 shadow-xl shadow-accent/10' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-secondary/80">Quick intention</p>
            <p className={`text-xs ${trimmedQuestion ? 'text-secondary/80' : 'text-muted'} truncate`}>
              {trimmedQuestion || 'Add a question before you draw.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onMoreOpen}
            className="min-h-[40px] min-w-[40px] rounded-xl border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
      className={`rounded-2xl border border-secondary/30 bg-surface/70 px-4 py-3 shadow-lg shadow-main/20 flex flex-col gap-3 transition ${
        highlight ? 'ring-2 ring-accent/50 shadow-xl shadow-accent/10' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-secondary/80">Step 2 · Quick intention</p>
          <p className="text-xs text-secondary/70">Add or edit your question before drawing.</p>
        </div>
        <button
          type="button"
          onClick={onCoachOpen}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-secondary/40 min-h-[44px] min-w-[44px] px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-label="Open guided intention coach"
        >
          <Sparkle className="w-4 h-4" weight="duotone" aria-hidden="true" />
          Coach
        </button>
      </div>
      <div className="flex items-start gap-2">
        <textarea
          ref={mergedRef}
          id="quick-intention"
          aria-label="Your question or intention (optional)"
          value={userQuestion}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          placeholder={placeholderQuestion}
          rows={1}
          className="flex-1 min-h-[44px] rounded-xl border border-secondary/30 bg-surface px-3 py-2 text-base text-main placeholder:text-secondary/50 focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/50 resize-none"
        />
        <button
          type="button"
          onClick={onMoreOpen}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-secondary/40 px-4 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Open reading settings"
        >
          <span className="flex items-center gap-1">
            <GearSix className="w-4 h-4" weight="duotone" aria-hidden="true" />
            <span className="hidden xxs:inline">More</span>
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => onPlaceholderRefresh?.()}
        className="inline-flex items-center gap-2 self-start rounded-full border border-secondary/35 px-3 py-1.5 text-xs font-semibold text-secondary hover:text-main hover:border-secondary/50 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Inspire me with a new example intention"
      >
        <ArrowsClockwise className="w-3.5 h-3.5" aria-hidden="true" />
        Inspire me
      </button>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-secondary/80">
        <span className="inline-flex items-center gap-1 rounded-full border border-secondary/40 bg-surface px-2.5 py-1 font-semibold text-secondary/90">
          Deck: {DECK_OPTIONS.find(d => d.id === deckStyleId)?.label || 'Selected'}
        </span>
        <button
          type="button"
          onClick={onDeckChange}
          className="min-h-[44px] min-w-[44px] px-3 py-2 text-[12px] font-semibold text-secondary underline underline-offset-4 rounded-lg hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Change
        </button>
      </div>
      {selectedSpread && userQuestion.trim().length > 0 && (
        <p className="text-[12px] text-secondary/80">
          Next: tap <span className="font-semibold text-main">Shuffle &amp; draw</span> below when you&apos;re ready.
        </p>
      )}
    </div>
  );
});

export default QuickIntentionCard;
