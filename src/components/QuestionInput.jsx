import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowsClockwise, ChartLine, Sparkle } from '@phosphor-icons/react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';
import { recordCoachQuestion } from '../lib/coachStorage';
import { getQualityLevel, scoreQuestion } from '../lib/questionQuality';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
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
  const { user } = useAuth();
  const userId = user?.id || null;
  const textareaRef = useAutoGrow(userQuestion, 1, 4);
  const isExperienced = personalization?.tarotExperience === 'experienced';
  const isNewbie = personalization?.tarotExperience === 'newbie';
  const displayName = personalization?.displayName?.trim();
  const trimmedQuestion = userQuestion.trim();
  const wordCount = trimmedQuestion ? trimmedQuestion.split(/\s+/).length : 0;
  const wordLabel = wordCount === 1 ? 'word' : 'words';
  const showQualityIndicator = wordCount >= 5;
  const quality = useMemo(() => scoreQuestion(userQuestion), [userQuestion]);
  const qualityLevel = useMemo(() => getQualityLevel(quality.score), [quality.score]);
  const qualityHelperText = useMemo(() => {
    if (quality.score >= 85) return 'Excellent - ready to pull.';
    if (quality.feedback.length > 0) return quality.feedback[0];
    if (quality.score >= 65) return 'Add one more detail for extra clarity.';
    if (quality.score >= 40) return 'Sharpen the focus to strengthen it.';
    return 'Try reframing it from a curious, open-ended angle.';
  }, [quality.feedback, quality.score]);

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
    const result = recordCoachQuestion(trimmed, undefined, userId);
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
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1.5 min-h-touch text-xs text-main transition hover:bg-primary/10 active:bg-primary/15 touch-manipulation self-start xs:self-auto"
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
          Unsure what to ask? Tap Guided coach or try a quick starter below.
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
          className="w-full bg-surface border border-primary/40 rounded-lg px-3 xs:px-4 py-3 pr-12 text-base text-main placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all resize-none"
          // text-base (16px) prevents iOS zoom on focus
          onFocus={onFocus}
          onBlur={onBlur}
          aria-describedby={optionalId}
        />
        <button
          type="button"
          onClick={handleRefreshExamples}
          className="absolute top-1 right-1 flex items-center justify-center min-w-touch min-h-touch text-muted hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-full touch-manipulation"
          aria-label="Cycle example intention prompts"
        >
          <ArrowsClockwise className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      {wordCount > 0 && (
        <div className="flex items-center justify-between text-2xs text-muted/90">
          <span>{wordCount} {wordLabel}</span>
          <span>Aim for 8-30 words</span>
        </div>
      )}
      {showQualityIndicator && (
        <div className="rounded-lg border border-secondary/30 bg-surface/60 p-2">
          <div className="flex items-center justify-between text-xs text-secondary">
            <span className="inline-flex items-center gap-1">
              <ChartLine className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              Clarity check
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary">
              <span aria-hidden="true">{qualityLevel.emoji}</span>
              <span>{qualityLevel.label}</span>
            </span>
          </div>
          <p className="text-2xs text-secondary/80 mt-1">{qualityHelperText}</p>
        </div>
      )}
      {!trimmedQuestion && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Quick starters</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.slice(0, 3).map(example => (
              <button
                key={example}
                type="button"
                onClick={() => setUserQuestion(example)}
                className="min-h-touch rounded-full border border-secondary/30 bg-surface/40 px-3 py-1.5 text-2xs text-secondary transition hover:border-accent/50 hover:text-main"
              >
                {example.length > 40 ? `${example.slice(0, 40)}...` : example}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 xs:gap-3">
        <button
          type="button"
          className="px-3 py-1.5 min-h-touch rounded-lg border border-primary/40 text-xs text-main hover:bg-primary/10 active:bg-primary/15 transition disabled:opacity-50 touch-manipulation"
          onClick={handleSaveIntention}
          disabled={!trimmedQuestion}
        >
          Save intention
        </button>
        <span role="status" aria-live="polite" className="text-xs min-h-[1.25rem]">
          {savedNotice && <span className="text-primary">Saved to intentions ✓</span>}
          {saveError && <span className="text-error">{saveError}</span>}
        </span>
      </div>
    </div>
  );
}
