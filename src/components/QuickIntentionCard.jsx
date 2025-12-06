import { forwardRef, useCallback } from 'react';
import { Sparkle, GearSix } from '@phosphor-icons/react';
import { DECK_OPTIONS } from './DeckSelector';
import { useAutoGrow } from '../hooks/useAutoGrow';

/**
 * QuickIntentionCard - Mobile quick intention entry
 *
 * Keeps the question visible on mobile without opening the full drawer.
 * Extracted from TarotReading.jsx for reusability and landscape layouts.
 */
export const QuickIntentionCard = forwardRef(function QuickIntentionCard({
  userQuestion,
  onQuestionChange,
  placeholderQuestion,
  inputRef,
  onInputFocus,
  onCoachOpen,
  onMoreOpen,
  deckStyleId,
  selectedSpread,
  onDeckChange
}, ref) {
  const autoGrowRef = useAutoGrow(userQuestion, 1, 4);

  // Merge inputRef (from parent) with autoGrowRef (from hook)
  const mergedRef = useCallback((el) => {
    autoGrowRef.current = el;
    if (typeof inputRef === 'function') {
      inputRef(el);
    } else if (inputRef) {
      inputRef.current = el;
    }
  }, [inputRef, autoGrowRef]);

  // Enter blurs (implicit continue), Shift+Enter inserts newline
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.target.blur();
    }
  };

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-secondary/30 bg-surface/70 px-4 py-3 shadow-lg shadow-main/20 flex flex-col gap-3"
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
          value={userQuestion}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onInputFocus}
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
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-secondary/80">
        <span className="inline-flex items-center gap-1 rounded-full border border-secondary/40 bg-surface px-2.5 py-1 font-semibold text-secondary/90">
          Deck: {DECK_OPTIONS.find(d => d.id === deckStyleId)?.label || 'Selected'}
        </span>
        <button
          type="button"
          onClick={onDeckChange}
          className="text-[12px] font-semibold text-secondary underline underline-offset-4"
        >
          Change
        </button>
      </div>
      {selectedSpread && userQuestion.trim().length > 0 && (
        <p className="text-[12px] text-secondary/80">
          Next: tap <span className="font-semibold text-main">Draw cards</span> below when you&apos;re ready.
        </p>
      )}
    </div>
  );
});

export default QuickIntentionCard;
