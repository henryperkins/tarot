import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowsClockwise, ChartLine, Sparkle } from '@phosphor-icons/react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';
import { recordCoachQuestion } from '../lib/coachStorage';
import { getQualityLevel, scoreQuestion } from '../lib/questionQuality';
import { QualityLevelIcon } from './QualityLevelIcon';
import { usePreferences } from '../contexts/PreferencesContext';
import { useAuth } from '../contexts/AuthContext';
import { useAutoGrow } from '../hooks/useAutoGrow';
import { USER_QUESTION_MAX_LENGTH } from '../../shared/contracts/readingSchema.js';
import { FOCUS_RING_DEFAULT } from '../styles/focusClasses';

export function QuestionInput({
  userQuestion,
  setUserQuestion,
  placeholderIndex,
  onFocus,
  onBlur,
  onPlaceholderRefresh,
  onLaunchCoach,
  variant = 'full',
  id = 'question-input',
  inputRef,
  placeholderQuestion
}) {
  const optionalId = useId();
  const qualityId = useId();
  const isCompact = variant === 'compact';
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [hasRequestedExample, setHasRequestedExample] = useState(false);
  const timeoutRefs = useRef([]);
  const { personalization } = usePreferences();
  const { user } = useAuth();
  const userId = user?.id || null;
  const textareaRef = useAutoGrow(userQuestion, 1, 4);
  const mergedRef = useCallback(element => {
    textareaRef.current = element;
    if (typeof inputRef === 'function') inputRef(element);
    else if (inputRef) Object.assign(inputRef, { current: element });
  }, [inputRef, textareaRef]);
  const isExperienced = personalization?.tarotExperience === 'experienced';
  const isNewbie = personalization?.tarotExperience === 'newbie';
  const displayName = personalization?.displayName?.trim();
  const trimmedQuestion = userQuestion.trim();
  const wordCount = trimmedQuestion ? trimmedQuestion.split(/\s+/).length : 0;
  const wordLabel = wordCount === 1 ? 'word' : 'words';
  const quality = scoreQuestion(userQuestion);
  const showQualityIndicator = wordCount >= 5
    || (trimmedQuestion.endsWith('?') && (!quality.openEnded || quality.deterministicLanguage));
  const qualityLevel = getQualityLevel(quality.score);
  const exampleQuestion = placeholderQuestion || EXAMPLE_QUESTIONS[placeholderIndex] || EXAMPLE_QUESTIONS[0];
  const examples = isCompact
    ? [exampleQuestion]
    : [exampleQuestion, ...EXAMPLE_QUESTIONS.filter(example => example !== exampleQuestion)].slice(0, 3);
  const qualityHelperText = quality.score >= 85
    ? 'Excellent - ready to pull.'
    : quality.feedback[0] || 'Try reframing it from a curious, open-ended angle.';

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
    setHasRequestedExample(true);
    onPlaceholderRefresh?.();
  };

  const handleUseExample = example => {
    setUserQuestion(example);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    });
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

  // Enter finishes editing; Shift+Enter inserts a newline.
  const handleKeyDown = (event) => {
    if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.target.blur();
    }
  };

  return (
    <div className="space-y-3">
      {!isCompact && (
        <div className="flex flex-col gap-2 xs:flex-row xs:items-center xs:justify-between">
          <div className="text-accent font-serif text-sm sm:text-base">
            <label htmlFor={id}>
              {displayName ? `${displayName}'s intention` : 'Your question or intention'}
            </label>
          </div>
          {typeof onLaunchCoach === 'function' && (
            <button
              type="button"
              onClick={handleLaunchCoach}
              className={`inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1.5 min-h-touch text-xs text-main transition hover:bg-primary/10 active:bg-primary/15 touch-manipulation self-start xs:self-auto ${FOCUS_RING_DEFAULT}`}
              title="Shortcut: Shift+G"
              aria-label="Open guided coach (Shift+G)"
            >
              <Sparkle className="h-3.5 w-3.5" aria-hidden="true" />
              {isExperienced ? 'Coach' : 'Guided coach'}
            </button>
          )}
        </div>
      )}
      <span id={optionalId} className="sr-only">Optional. Add a question, or leave it open.</span>
      {!isCompact && isNewbie && !trimmedQuestion && (
        <p className="text-xs text-muted mt-1">
          Unsure what to ask? Use the guided coach or choose an example below.
        </p>
      )}
      <textarea
        ref={mergedRef}
        id={id}
        aria-label={isCompact ? 'Your question or intention (optional)' : undefined}
        dir="auto"
        value={userQuestion}
        onChange={event => setUserQuestion(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about something you want to understand…"
        rows={1}
        // Mirrors the server contract so an over-long paste is trimmed here
        // rather than rejected with a 400 after the ritual.
        maxLength={USER_QUESTION_MAX_LENGTH}
        className="block w-full min-h-touch bg-surface border border-primary/40 rounded-xl px-3 xs:px-4 py-3 text-base text-main caret-accent placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-colors resize-none"
        // text-base (16px) prevents iOS zoom on focus
        onFocus={onFocus}
        onBlur={onBlur}
        enterKeyHint="done"
        aria-describedby={`${optionalId}${showQualityIndicator ? ` ${qualityId}` : ''}`}
      />
      {!isCompact && wordCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{wordCount} {wordLabel}</span>
          <span>Aim for 8-30 words</span>
        </div>
      )}
      <div id={qualityId} aria-live="polite" className={showQualityIndicator ? (isCompact ? '' : 'rounded-lg border border-secondary/30 bg-surface/60 p-3') : 'sr-only'}>
        {showQualityIndicator && <>
          {!isCompact && (
          <div className="flex items-center justify-between text-xs text-secondary">
            <span className="inline-flex items-center gap-1">
              <ChartLine className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              Clarity check
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary">
              <QualityLevelIcon level={qualityLevel} />
              <span>{qualityLevel.label}</span>
            </span>
          </div>
          )}
          <p className={`text-xs leading-relaxed text-muted ${isCompact ? '' : 'mt-1'}`}>{qualityHelperText}</p>
        </>}
      </div>
      <span className="sr-only" role="status">
        {hasRequestedExample && !trimmedQuestion ? `Example: ${exampleQuestion}` : ''}
      </span>
      {!trimmedQuestion && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Try an example</p>
            <button
              type="button"
              onClick={handleRefreshExamples}
              className={`inline-flex min-h-touch items-center gap-1.5 rounded-full px-2 text-xs text-secondary hover:text-main touch-manipulation ${FOCUS_RING_DEFAULT}`}
              aria-label="Show another example intention"
            >
              <ArrowsClockwise className="h-3.5 w-3.5" aria-hidden="true" />
              Another example
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {examples.map(example => (
              <button
                key={example}
                type="button"
                onClick={() => handleUseExample(example)}
                className={`min-h-touch max-w-full rounded-xl border border-secondary/30 bg-surface/40 px-3 py-2 text-left text-xs leading-relaxed text-secondary transition-colors hover:border-accent/50 hover:text-main ${FOCUS_RING_DEFAULT}`}
              >
                <span className="sr-only">Use example: </span>{example}
              </button>
            ))}
          </div>
        </div>
      )}
      {!isCompact && <div className="flex flex-wrap items-center gap-2 xs:gap-3">
        <button
          type="button"
          className={`px-3 py-1.5 min-h-touch rounded-lg border border-primary/40 text-xs text-main hover:bg-primary/10 active:bg-primary/15 transition disabled:opacity-50 touch-manipulation ${FOCUS_RING_DEFAULT}`}
          onClick={handleSaveIntention}
          disabled={!trimmedQuestion}
        >
          Save intention
        </button>
        <span role="status" aria-live="polite" className="text-xs min-h-[1.25rem]">
          {savedNotice && <span className="text-primary">Saved to intentions</span>}
          {saveError && <span className="text-error">{saveError}</span>}
        </span>
      </div>}
    </div>
  );
}
