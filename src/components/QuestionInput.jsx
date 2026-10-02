import { useId, useMemo } from 'react';
import { ChartLine, Sparkle } from '@phosphor-icons/react';
import { getQualityLevel, getQuestionNudge, isAssessableQuestion, scoreQuestion } from '../lib/questionQuality';
import { QualityLevelIcon } from './QualityLevelIcon';
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
import { useSettledValue } from '../hooks/useSettledValue';
import { USER_QUESTION_MAX_LENGTH } from '../../shared/contracts/readingRequestLimits.js';
import { FOCUS_RING_DEFAULT } from '../styles/focusClasses';

export function QuestionInput({
  userQuestion,
  setUserQuestion,
  onFocus,
  onBlur,
  onLaunchCoach
}) {
  const helperId = useId();
  const nudgeId = useId();
  const clarityId = useId();
  const { personalization } = usePreferences();
  const textareaRef = useAutoGrow(userQuestion, 1, 4);
  const isExperienced = personalization?.tarotExperience === 'experienced';
  const isNewbie = personalization?.tarotExperience === 'newbie';
  const displayName = personalization?.displayName?.trim();
  const canLaunchCoach = typeof onLaunchCoach === 'function';
  const trimmedQuestion = userQuestion.trim();
  const wordCount = trimmedQuestion ? trimmedQuestion.split(/\s+/).length : 0;
  const wordLabel = wordCount === 1 ? 'word' : 'words';
  const nudgeKind = getQuestionNudge(userQuestion);
  // The word count and clarity grade are English heuristics; see
  // isAssessableQuestion.
  const isAssessable = isAssessableQuestion(trimmedQuestion);
  // One message at a time: a phrasing nudge stands in for the clarity grade.
  const showQualityIndicator = wordCount >= 5 && !nudgeKind && isAssessable;
  const quality = useMemo(() => scoreQuestion(userQuestion), [userQuestion]);
  const qualityLevel = useMemo(() => getQualityLevel(quality.score), [quality.score]);
  const qualityHelperText = useMemo(() => {
    if (quality.score >= 85) return 'Excellent - ready to pull.';
    if (quality.feedback.length > 0) return quality.feedback[0];
    if (quality.score >= 65) return 'Add one more detail for extra clarity.';
    if (quality.score >= 40) return 'Sharpen the focus to strengthen it.';
    return 'Try reframing it from a curious, open-ended angle.';
  }, [quality.feedback, quality.score]);
  // Spoken when typing pauses, so a screen reader hears the check without a
  // running commentary on every keystroke.
  const clarityAnnouncement = useSettledValue(
    showQualityIndicator ? `Clarity check: ${qualityLevel.label}. ${qualityHelperText}` : ''
  );
  const describedBy = [
    helperId,
    nudgeKind ? nudgeId : null,
    showQualityIndicator ? clarityId : null
  ].filter(Boolean).join(' ');

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 xs:flex-row xs:items-start xs:justify-between">
        <div className="min-w-0 space-y-1">
          <label htmlFor="question-input" className="block font-serif text-base sm:text-lg leading-snug text-main text-balance">
            {getQuestionPrompt(displayName)}
          </label>
          <p id={helperId} className="text-xs text-muted text-pretty">{QUESTION_HELPER}</p>
        </div>
        {canLaunchCoach && (
          <button
            type="button"
            onClick={onLaunchCoach}
            className={`inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-3 py-1.5 min-h-touch text-xs text-main transition hover:bg-primary/10 active:bg-primary/15 touch-manipulation self-start xs:self-auto ${FOCUS_RING_DEFAULT}`}
            title="Shortcut: Shift+G"
            aria-label="Open guided coach (Shift+G)"
          >
            <Sparkle className="h-3.5 w-3.5" aria-hidden="true" />
            {isExperienced ? 'Coach' : 'Guided coach'}
          </button>
        )}
      </div>
      <textarea
        ref={textareaRef}
        id="question-input"
        dir="auto"
        value={userQuestion}
        onChange={event => setUserQuestion(event.target.value)}
        onKeyDown={handleQuestionFieldKeyDown}
        placeholder={QUESTION_PLACEHOLDER}
        rows={1}
        // Mirrors the server contract so an over-long paste is trimmed here
        // rather than rejected with a 400 after the ritual.
        maxLength={USER_QUESTION_MAX_LENGTH}
        className="block w-full min-h-touch bg-surface border border-primary/40 rounded-xl px-3 xs:px-4 py-3 text-base text-main caret-accent placeholder:italic placeholder:text-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-colors resize-none"
        // text-base (16px) prevents iOS zoom on focus
        onFocus={onFocus}
        onBlur={onBlur}
        enterKeyHint="done"
        aria-describedby={describedBy}
      />
      <QuestionNudge id={nudgeId} kind={nudgeKind} onOpenCoach={canLaunchCoach ? onLaunchCoach : undefined} />
      {(!trimmedQuestion || isExampleQuestion(trimmedQuestion)) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <QuestionExamples value={userQuestion} onChange={setUserQuestion} />
          {isNewbie && !trimmedQuestion && canLaunchCoach && (
            <p className="text-xs text-muted">Or let the guided coach shape one with you.</p>
          )}
        </div>
      )}
      {wordCount > 0 && isAssessable && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{wordCount} {wordLabel}</span>
          <span>Aim for 8-30 words</span>
        </div>
      )}
      {showQualityIndicator && (
        <div id={clarityId} className="rounded-lg border border-secondary/30 bg-surface/60 p-3">
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
          <p className="text-xs text-secondary mt-1">{qualityHelperText}</p>
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {clarityAnnouncement}
      </span>
      <SaveIntentionButton question={userQuestion} />
    </div>
  );
}
