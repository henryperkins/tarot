import { forwardRef, useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { Sparkle, GearSix } from '@phosphor-icons/react';
import { DECK_OPTIONS } from './deckOptions';
import { QuestionExamples } from './QuestionExamples';
import { QuestionNudge } from './QuestionNudge';
import { SaveIntentionButton } from './SaveIntentionButton';
import {
  QUESTION_HELPER,
  QUESTION_PLACEHOLDER,
  getQuestionPrompt,
  handleQuestionFieldKeyDown,
  isExampleQuestion
} from './questionField';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAutoGrow } from '../hooks/useAutoGrow';
import { getQuestionNudge } from '../lib/questionQuality';
import { USER_QUESTION_MAX_LENGTH } from '../../shared/contracts/readingSchema.js';

/**
 * QuickIntentionCard - Mobile quick intention entry
 *
 * The one place a question is written on a phone. The full card sits in the
 * page; the compact bar (short landscape screens) opens an inline editor.
 */
export const QuickIntentionCard = forwardRef(function QuickIntentionCard({
  variant = 'full',
  highlight = false,
  userQuestion,
  onQuestionChange,
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
  const editButtonRef = useRef(null);
  const returnFocusRef = useRef(false);
  const helperId = useId();
  const nudgeId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const { personalization } = usePreferences();
  const prompt = getQuestionPrompt(personalization?.displayName);
  const isCompact = variant === 'compact';
  const trimmedQuestion = userQuestion.trim();
  const nudgeKind = getQuestionNudge(userQuestion);
  const describedBy = nudgeKind ? `${helperId} ${nudgeId}` : helperId;

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

  // The compact editor takes focus when it opens (inside the tap, so a phone
  // shows its keyboard) and hands it back to Add/Edit when it closes.
  useLayoutEffect(() => {
    if (!isCompact) return;
    if (isEditing) {
      const field = localInputRef.current;
      if (field) {
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
      }
    } else if (returnFocusRef.current) {
      returnFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [isCompact, isEditing]);

  const finishEditing = () => {
    returnFocusRef.current = true;
    setIsEditing(false);
  };

  if (isCompact) {
    return (
      <div
        ref={ref}
        className={`scroll-mt-[calc(var(--sticky-header-height,0px)+2rem)] rounded-2xl border border-secondary/30 bg-surface/70 px-4 py-2 shadow-lg shadow-main/20 transition selection:bg-accent selection:text-surface ${
          highlight ? 'ring-2 ring-accent/50 shadow-xl shadow-accent/10' : ''
        }`}
      >
        {isEditing ? (
          <div className="space-y-2 py-1">
            <label htmlFor="quick-intention" className="block font-serif text-sm text-main">
              {prompt}
            </label>
            <div className="flex items-start gap-3">
              <textarea
                ref={mergedRef}
                id="quick-intention"
                dir="auto"
                value={userQuestion}
                onChange={(event) => onQuestionChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    finishEditing();
                    return;
                  }
                  handleQuestionFieldKeyDown(event, finishEditing);
                }}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                placeholder={QUESTION_PLACEHOLDER}
                rows={1}
                maxLength={USER_QUESTION_MAX_LENGTH}
                enterKeyHint="done"
                aria-describedby={describedBy}
                className="min-w-0 flex-1 min-h-touch rounded-xl border border-secondary/30 bg-surface px-3 py-2 text-base text-main caret-accent placeholder:italic placeholder:text-secondary focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/50 resize-none"
              />
              <button
                type="button"
                onClick={finishEditing}
                className="shrink-0 min-h-touch min-w-touch rounded-xl border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Done
              </button>
            </div>
            <p id={helperId} className="sr-only">{QUESTION_HELPER}</p>
            <QuestionNudge id={nudgeId} kind={nudgeKind} onOpenCoach={onCoachOpen} />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate">
              {trimmedQuestion ? (
                <bdi className="font-serif text-base text-main">{trimmedQuestion}</bdi>
              ) : (
                <>
                  <span className="text-sm text-secondary">No question yet</span>{' '}
                  <span className="ml-1 text-xs text-muted">Optional</span>
                </>
              )}
            </p>
            <button
              ref={editButtonRef}
              type="button"
              onClick={() => setIsEditing(true)}
              className="shrink-0 min-h-touch min-w-touch rounded-xl border border-secondary/40 px-3 py-2 text-xs font-semibold text-secondary hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={trimmedQuestion ? 'Edit your question' : 'Add a question'}
            >
              {trimmedQuestion ? 'Edit' : 'Add'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const showExamples = !trimmedQuestion || isExampleQuestion(trimmedQuestion);

  return (
    <div
      ref={ref}
      className={`scroll-mt-[calc(var(--sticky-header-height,0px)+2rem)] rounded-2xl border border-secondary/30 bg-surface/70 px-4 py-3 shadow-lg shadow-main/20 flex flex-col gap-3 transition selection:bg-accent selection:text-surface ${
        highlight ? 'ring-2 ring-accent/50 shadow-xl shadow-accent/10' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-44 space-y-1">
          <label htmlFor="quick-intention" className="block font-serif text-lg leading-snug text-main text-balance">
            {prompt}
          </label>
          <p id={helperId} className="text-xs text-muted text-pretty">{QUESTION_HELPER}</p>
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
      <div className="flex flex-wrap items-start gap-2">
        <textarea
          ref={mergedRef}
          id="quick-intention"
          dir="auto"
          value={userQuestion}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={handleQuestionFieldKeyDown}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          placeholder={QUESTION_PLACEHOLDER}
          rows={1}
          // Mirrors the server contract (and the desktop question input) so an
          // over-long paste is trimmed here rather than rejected after the ritual.
          maxLength={USER_QUESTION_MAX_LENGTH}
          enterKeyHint="done"
          aria-describedby={describedBy}
          className="min-w-0 flex-1 basis-44 min-h-touch rounded-xl border border-secondary/30 bg-surface px-3 py-2 text-base text-main caret-accent placeholder:italic placeholder:text-secondary focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/50 resize-none"
        />
      </div>
      <QuestionNudge id={nudgeId} kind={nudgeKind} onOpenCoach={onCoachOpen} />
      {showExamples ? (
        <QuestionExamples value={userQuestion} onChange={onQuestionChange} />
      ) : (
        <SaveIntentionButton question={userQuestion} />
      )}
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
      {selectedSpread && trimmedQuestion.length > 0 && (
        <p className="text-xs text-secondary">
          Next: tap <span className="font-semibold text-main">Shuffle &amp; draw</span> below when you&apos;re ready.
        </p>
      )}
    </div>
  );
});

export default QuickIntentionCard;
