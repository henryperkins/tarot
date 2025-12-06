import { useEffect, useId, useRef, useState } from 'react';
import { ArrowsClockwise, Sparkle } from '@phosphor-icons/react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';
import { recordCoachQuestion } from '../lib/coachStorage';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAutoGrow } from '../hooks/useAutoGrow';

export function QuestionInput({
  userQuestion,
  setUserQuestion,
  placeholderIndex,
  onFocus,
  onBlur,
  onPlaceholderRefresh,
  onLaunchCoach
}) {
  const optionalId = useId();
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState('');
  const timeoutRefs = useRef([]);
  const { personalization } = usePreferences();
  const textareaRef = useAutoGrow(userQuestion, 1, 4);
  const isExperienced = personalization?.tarotExperience === 'experienced';
  const isNewbie = personalization?.tarotExperience === 'newbie';
  const displayName = personalization?.displayName?.trim();

  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current = [];
  };

  const registerTimeout = (callback, delay) => {
    const id = setTimeout(() => {
      callback();
      timeoutRefs.current = timeoutRefs.current.filter(timeoutId => timeoutId !== id);
    }, delay);
    timeoutRefs.current = [...timeoutRefs.current, id];
    return id;
  };

  useEffect(() => clearAllTimeouts, []);

  const handleRefreshExamples = () => {
    onPlaceholderRefresh?.();
  };

  const handleSaveIntention = () => {
    const trimmed = userQuestion.trim();
    if (!trimmed) return;
    const result = recordCoachQuestion(trimmed);
    if (result.success) {
      setSavedNotice(true);
      setSaveError('');
      registerTimeout(() => setSavedNotice(false), 1800);
    } else {
      setSavedNotice(false);
      setSaveError(result.error || 'Unable to save this question. Check browser storage settings.');
      registerTimeout(() => setSaveError(''), 3000);
    }
  };

  const handleLaunchCoach = () => {
    if (typeof onLaunchCoach === 'function') {
      onLaunchCoach();
    }
  };

  // Enter blurs (implicit continue), Shift+Enter inserts newline
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.target.blur();
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex flex-col gap-2 xs:flex-row xs:items-center xs:justify-between">
        <div className="text-accent font-serif text-sm sm:text-base">
          <label htmlFor="question-input">
            Step 2 · {displayName ? `${displayName}'s intention` : 'Your question or intention'}
          </label>
        </div>
        {typeof onLaunchCoach === 'function' && (
          <button
            type="button"
            onClick={handleLaunchCoach}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1.5 min-h-[44px] text-xs text-main transition hover:bg-primary/10 active:bg-primary/15 touch-manipulation self-start xs:self-auto"
            title="Shortcut: Shift+G"
            aria-label="Open guided coach (Shift+G)"
          >
            <Sparkle className="h-3.5 w-3.5" aria-hidden="true" />
            {isExperienced ? 'Coach' : 'Guided coach'}
          </button>
        )}
        <span id={optionalId} className="sr-only">
          Optional field
        </span>
      </div>
      {isNewbie && (
        <p className="text-xs text-muted mt-1">
          Unsure what to ask? Tap Guided coach or cycle the example prompt to get inspired.
        </p>
      )}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="question-input"
          value={userQuestion}
          onChange={event => setUserQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={EXAMPLE_QUESTIONS[placeholderIndex]}
          rows={1}
          className="w-full bg-surface border border-primary/40 rounded-lg px-3 xs:px-4 py-3 pr-12 text-base text-main placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all resize-none"
          // text-base (16px) prevents iOS zoom on focus
          onFocus={onFocus}
          onBlur={onBlur}
          aria-describedby={optionalId}
        />
        <button
          type="button"
          onClick={handleRefreshExamples}
          className="absolute top-1 right-1 flex items-center justify-center min-w-[44px] min-h-[44px] text-muted hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-full touch-manipulation"
          aria-label="Cycle example intention prompts"
        >
          <ArrowsClockwise className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 xs:gap-3">
        <button
          type="button"
          className="px-3 py-1.5 min-h-[36px] rounded-lg border border-primary/40 text-xs text-main hover:bg-primary/10 active:bg-primary/15 transition disabled:opacity-50 touch-manipulation"
          onClick={handleSaveIntention}
          disabled={!userQuestion.trim()}
        >
          Save intention
        </button>
        <span role="status" aria-live="polite" className="text-xs min-h-[1.25rem]">
          {savedNotice && <span className="text-primary">Saved ✓</span>}
          {saveError && <span className="text-error">{saveError}</span>}
        </span>
      </div>
    </div>
  );
}
