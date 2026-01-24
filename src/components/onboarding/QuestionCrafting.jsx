import { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Sparkle, Lightning, Check, X, Info } from '@phosphor-icons/react';
import { EXAMPLE_QUESTIONS } from '../../data/exampleQuestions';
import { scoreQuestion, getQualityLevel } from '../../lib/questionQuality';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { usePreferences } from '../../contexts/PreferencesContext';
import { Tooltip } from '../Tooltip';

// Additional example questions for onboarding
const ONBOARDING_EXAMPLES = [
  'What should I focus on this week for personal growth?',
  'How can I navigate this career transition with clarity?',
  'What energy do I need to cultivate in my relationships?',
  'What lesson am I meant to learn from this challenge?',
  'How can I find balance between work and personal life?',
];

// Number of additional onboarding examples to show (adds variety without overwhelming)
const MAX_ADDITIONAL_EXAMPLES = 2;

const READING_TONE_OPTIONS = [
  { value: 'gentle', label: 'Gentle', sublabel: 'Softer phrasing' },
  { value: 'balanced', label: 'Balanced', sublabel: 'Clear and kind' },
  { value: 'blunt', label: 'Blunt', sublabel: 'Direct wording' },
];

const SPIRITUAL_FRAME_OPTIONS = [
  { value: 'psychological', label: 'Psychological', sublabel: 'Self-reflection' },
  { value: 'spiritual', label: 'Spiritual', sublabel: 'Intuitive' },
  { value: 'mixed', label: 'Both lenses', sublabel: 'Psych + spiritual' },
  { value: 'playful', label: 'Playful', sublabel: 'Just for fun' },
];

const TONE_PREVIEWS = {
  gentle: 'Preview: "What might help me soften around this?"',
  balanced: 'Preview: "What is a steady next step here?"',
  blunt: 'Preview: "What needs to change now?"',
};

const FRAME_PREVIEWS = {
  psychological: 'Preview: "What pattern is asking to be seen?"',
  spiritual: 'Preview: "What is spirit inviting me to trust?"',
  mixed: 'Preview: "What inner pattern and spiritual lesson meet here?"',
  playful: 'Preview: "What is the playful twist in this?"',
};

/**
 * QuestionCrafting - Step 4 of onboarding
 *
 * Teaches users how to craft effective tarot questions
 * with real-time quality feedback.
 * Also collects reading tone and spiritual framing preferences.
 */
export function QuestionCrafting({ question, onQuestionChange, onNext, onBack }) {
  const [showTips, setShowTips] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const { personalization, setReadingTone, setSpiritualFrame } = usePreferences();
  const infoButtonClass =
    'inline-flex min-w-touch min-h-touch items-center justify-center rounded-full text-muted/60 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 touch-manipulation -ml-2 -mr-3';

  const quality = useMemo(() => scoreQuestion(question), [question]);
  const qualityLevel = useMemo(() => getQualityLevel(quality.score), [quality.score]);
  const tonePreview = TONE_PREVIEWS[personalization.readingTone] || TONE_PREVIEWS.balanced;
  const framePreview = FRAME_PREVIEWS[personalization.spiritualFrame] || FRAME_PREVIEWS.mixed;

  // Celebrate when user reaches "Excellent" question quality.
  const [showExcellentBurst, setShowExcellentBurst] = useState(false);
  const prevScoreRef = useRef(quality.score);

  useEffect(() => {
    const prev = prevScoreRef.current;
    prevScoreRef.current = quality.score;

    if (prefersReducedMotion) return;
    if (prev < 85 && quality.score >= 85) {
      // Defer setState to avoid synchronous call in effect (satisfies react-hooks/set-state-in-effect)
      const showTimeout = setTimeout(() => setShowExcellentBurst(true), 0);
      const hideTimeout = setTimeout(() => setShowExcellentBurst(false), 650);
      return () => {
        clearTimeout(showTimeout);
        clearTimeout(hideTimeout);
      };
    }
  }, [quality.score, prefersReducedMotion]);

  const handleExampleClick = (example) => {
    onQuestionChange(example);
  };

  const allExamples = [...EXAMPLE_QUESTIONS, ...ONBOARDING_EXAMPLES.slice(0, MAX_ADDITIONAL_EXAMPLES)];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`text-center mb-4 sm:mb-6 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
          Craft a clear question
        </h2>
        <p className={`text-muted mt-2 max-w-md mx-auto ${isLandscape ? 'text-sm' : ''}`}>
          Open-ended, specific questions get clearer readings.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
        {/* Question input */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.1s' }}
        >
          <label htmlFor="question-input" className="block text-sm text-accent mb-2">
            Your question or intention
          </label>
          <textarea
            id="question-input"
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="e.g., What energy should I focus on this week?"
            rows={isLandscape ? 2 : 4}
            className={`w-full bg-surface border border-primary/40 rounded-xl px-3 xxs:px-4 py-3 text-base text-main placeholder:text-muted resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all ${isLandscape ? 'min-h-[4rem] max-h-[30vh]' : 'min-h-[6rem] xs:min-h-[7rem] sm:min-h-[8rem]'}`}
          />
        </div>

        {/* Quality indicator */}
        {question.trim().length > 0 && (
          <div
            className={`rounded-xl border border-secondary/20 bg-surface/50 p-4 ${
              prefersReducedMotion ? '' : 'animate-fade-in'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted">Clarity check</span>
                <Tooltip
                  content="Checks for open-ended wording, specificity, and timeframe."
                  position="top"
                  triggerClassName={infoButtonClass}
                  ariaLabel="About clarity check"
                >
                  <Info className="h-3.5 w-3.5" />
                </Tooltip>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium">
                <span className="relative inline-flex items-center">
                  <span>{qualityLevel.emoji}</span>
                  {showExcellentBurst && (
                    <Sparkle
                      className="absolute -top-2 -right-2 w-3.5 h-3.5 text-accent motion-safe:animate-ping"
                      weight="fill"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-main">{qualityLevel.label}</span>
              </span>
            </div>
            <p className="text-xs text-muted">
              We look for open-ended, specific, time-bound wording.
            </p>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-surface-muted/80 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  quality.score >= 85
                    ? 'bg-success'
                    : quality.score >= 65
                    ? 'bg-accent'
                    : quality.score >= 40
                    ? 'bg-gold'
                    : 'bg-secondary'
                }`}
                style={{ width: `${Math.min(100, quality.score)}%` }}
              />
            </div>

            {/* Feedback chips */}
            {quality.feedback.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quality.feedback.slice(0, 2).map((tip, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-xs text-accent"
                  >
                    <Lightning className="w-3 h-3" weight="fill" />
                    {tip}
                  </span>
                ))}
              </div>
            )}

            {/* Success indicators */}
            {quality.score >= 65 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {quality.openEnded && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-xs text-success">
                    <Check className="w-3 h-3" weight="bold" />
                    Open-ended
                  </span>
                )}
                {quality.specific && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-xs text-success">
                    <Check className="w-3 h-3" weight="bold" />
                    Specific
                  </span>
                )}
                {quality.actionable && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-xs text-success">
                    <Check className="w-3 h-3" weight="bold" />
                    Actionable
                  </span>
                )}
              </div>
            )}

            <p className="mt-3 text-xs text-muted">
              <span className="text-main font-medium">Good:</span> &quot;Why am I stuck?&quot;{' '}
              <span className="text-main font-medium">Better:</span> &quot;What is one step I can
              take this week at work?&quot;
            </p>
          </div>
        )}

        {/* Tips section - collapsible on mobile */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.2s' }}
        >
          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className="flex items-center justify-between w-full text-left py-2 text-sm text-accent hover:text-main transition sm:cursor-default"
            aria-expanded={showTips}
          >
            <span className="flex items-center gap-2">
              <Sparkle className="w-4 h-4" weight="fill" />
              Tips for great questions
            </span>
            <span className="sm:hidden text-xs text-muted">
              {showTips ? 'Hide' : 'Show'}
            </span>
          </button>

          <div
            className={`space-y-2 mt-2 ${
              showTips || !isLandscape ? 'block' : 'hidden sm:block'
            }`}
          >
            <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/30">
              <span className="w-6 h-6 shrink-0 rounded-full bg-success/10 text-success flex items-center justify-center">
                <Check className="w-3.5 h-3.5" weight="bold" />
              </span>
              <div>
                <p className="text-sm text-main">Use &quot;How&quot; or &quot;What&quot;</p>
                <p className="text-xs text-muted">Open-ended questions invite deeper exploration</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/30">
              <span className="w-6 h-6 shrink-0 rounded-full bg-success/10 text-success flex items-center justify-center">
                <Check className="w-3.5 h-3.5" weight="bold" />
              </span>
              <div>
                <p className="text-sm text-main">Be specific about timing</p>
                <p className="text-xs text-muted">&quot;This week&quot; or &quot;this month&quot; adds focus</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-surface/30">
              <span className="w-6 h-6 shrink-0 rounded-full bg-error/10 text-error flex items-center justify-center">
                <X className="w-3.5 h-3.5" weight="bold" />
              </span>
              <div>
                <p className="text-sm text-main">Avoid yes/no questions</p>
                <p className="text-xs text-muted">&quot;Will I...&quot; limits the insight you receive</p>
              </div>
            </div>
          </div>
        </div>

        {/* Example questions */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.3s' }}
        >
          <p className="text-xs text-muted mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {allExamples.slice(0, isLandscape ? 3 : 5).map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleExampleClick(example)}
                className="min-h-touch w-full xxs:w-auto px-3 xs:px-4 py-2 rounded-full border border-secondary/30 bg-surface/50 text-xs xs:text-sm text-muted hover:text-main hover:border-accent/50 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {example.length > 35 ? example.slice(0, 35) + '...' : example}
              </button>
            ))}
          </div>
        </div>

        {/* Personalization: Reading Tone */}
        <div
          className={`mt-6 rounded-2xl border border-accent/20 bg-surface/50 p-5 ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          } ${isLandscape ? 'mt-4 p-4' : ''}`}
          style={{ animationDelay: '0.4s' }}
        >
          <div className="mb-3">
            <p className="text-sm text-accent">Reading tone</p>
            <p className="text-xs text-muted">
              Changes how direct the reading sounds, not the card meanings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {READING_TONE_OPTIONS.map((option) => {
              const isSelected = personalization.readingTone === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setReadingTone(option.value)}
                  className={`min-h-touch px-4 py-2 rounded-2xl border text-left transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
                    isSelected
                      ? 'bg-accent text-surface border-accent'
                      : 'bg-surface/50 text-muted border-secondary/30 hover:border-accent/50 hover:text-main'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span
                    className={`block text-[0.65rem] ${
                      isSelected ? 'text-surface/80' : 'text-muted'
                    }`}
                  >
                    {option.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-2">{tonePreview}</p>
        </div>

        {/* Personalization: Spiritual Framing */}
        <div
          className={`mt-4 rounded-2xl border border-accent/20 bg-surface/50 p-5 ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          } ${isLandscape ? 'p-4' : ''}`}
          style={{ animationDelay: '0.5s' }}
        >
          <div className="mb-3">
            <p className="text-sm text-accent">Interpretation lens</p>
            <p className="text-xs text-muted">
              Choose the lens you&apos;re comfortable with. Switch anytime.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SPIRITUAL_FRAME_OPTIONS.map((option) => {
              const isSelected = personalization.spiritualFrame === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSpiritualFrame(option.value)}
                  className={`min-h-touch px-4 py-2 rounded-2xl border text-left transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
                    isSelected
                      ? 'bg-accent text-surface border-accent'
                      : 'bg-surface/50 text-muted border-secondary/30 hover:border-accent/50 hover:text-main'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span
                    className={`block text-[0.65rem] ${
                      isSelected ? 'text-surface/80' : 'text-muted'
                    }`}
                  >
                    {option.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-2">{framePreview}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className={`pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}>
        <p className="text-xs text-muted text-center mb-2">
          Prefer less motion? Use your device&apos;s Reduce Motion setting.
        </p>
        <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1 min-h-cta px-4 py-3 rounded-xl border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Back</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 min-h-cta px-6 py-3 rounded-xl bg-accent text-surface font-semibold text-base transition hover:bg-accent/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          {question.trim() ? 'Continue' : 'Skip'}
          <ArrowRight className="w-5 h-5" weight="bold" />
        </button>
        </div>
      </div>
    </div>
  );
}
