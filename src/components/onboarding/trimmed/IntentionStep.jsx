import { useMemo, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Sparkle } from '@phosphor-icons/react';
import { scoreQuestion, getQualityLevel } from '../../../lib/questionQuality';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useLandscape } from '../../../hooks/useLandscape';

const QUICK_STARTERS = [
  "What should I focus on this week?",
  "What energy do I need right now?",
  "What's blocking my progress?"
];

/**
 * IntentionStep - Focused question entry with quality feedback
 *
 * Provides a streamlined question input with real-time quality
 * scoring and quick starter suggestions for empty state.
 * Target completion: 10-20 seconds.
 */
export function IntentionStep({ question, onQuestionChange, onNext, onBack }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  const quality = useMemo(() => scoreQuestion(question), [question]);
  const qualityLevel = useMemo(() => getQualityLevel(quality.score), [quality.score]);

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

  const hasQuestion = question.trim().length > 0;
  const showQualityIndicator = question.trim().length > 5;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`text-center ${isLandscape ? 'mb-3' : 'mb-4'} ${
          prefersReducedMotion ? '' : 'animate-fade-in-up'
        }`}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl'}`}>
          Set Your Intention
        </h2>
        <p className="text-muted mt-1 text-sm">What would you like guidance on?</p>
      </div>

      {/* Content */}
      <div className={`flex-1 ${isLandscape ? 'space-y-3' : 'space-y-4'}`}>
        {/* Question textarea */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.1s' }}
        >
          <textarea
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder="e.g., What should I focus on this week?"
            rows={isLandscape ? 2 : 3}
            className="w-full rounded-xl border border-secondary/30 bg-surface px-4 py-3 text-base text-main placeholder:text-muted/70 resize-none transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
            autoFocus
            aria-label="Your question or intention"
          />
        </div>

        {/* Quality indicator - only show when typing */}
        {showQualityIndicator && (
          <div
            className="flex items-center gap-2 text-sm"
            role="status"
            aria-live="polite"
          >
            <span className="relative inline-flex items-center" aria-hidden="true">
              <span>{qualityLevel.emoji}</span>
              {showExcellentBurst && (
                <Sparkle
                  className="absolute -top-2 -right-2 h-3.5 w-3.5 text-accent motion-safe:animate-ping"
                  weight="fill"
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="text-muted">{qualityLevel.label}</span>
            {quality.feedback.length > 0 && (
              <span className="text-muted/70 text-xs hidden xs:inline">
                — {quality.feedback[0]}
              </span>
            )}
          </div>
        )}

        {/* Quick starters - only show when empty */}
        {!hasQuestion && (
          <div
            className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
            style={{ animationDelay: '0.2s' }}
          >
            <p className="text-xs text-muted mb-2">Try one of these:</p>
            <div className="space-y-2">
              {QUICK_STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => onQuestionChange(starter)}
                  className="block w-full text-left min-h-[44px] px-3 py-2 rounded-lg border border-secondary/20 text-sm text-muted transition touch-manipulation hover:border-accent/50 hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className={`flex gap-3 ${isLandscape ? 'pt-3' : 'pt-4'} pb-safe-bottom`}>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] px-4 py-3 text-muted flex items-center gap-1 transition hover:text-main touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" weight="bold" aria-hidden="true" />
          <span className="hidden xxs:inline">Back</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 min-h-[52px] rounded-xl bg-accent text-surface font-semibold transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          {hasQuestion ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}
