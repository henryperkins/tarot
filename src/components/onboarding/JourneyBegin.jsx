import { Star, Sparkle, ArrowLeft, Play, Lightbulb } from '@phosphor-icons/react';
import { SPREADS } from '../../data/spreads';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';

/**
 * JourneyBegin - Step 5 of onboarding
 *
 * Final celebration step that summarizes selections
 * and launches the user into their first reading.
 */
export function JourneyBegin({ selectedSpread, question, onBegin, onBack }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  const spread = SPREADS[selectedSpread];
  const hasQuestion = question && question.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Hero celebration */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Animated stars/sparkles */}
        <div
          className={`relative mb-6 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="relative">
            <Star
              className="w-20 h-20 sm:w-24 sm:h-24 text-gold"
              weight="duotone"
              aria-hidden="true"
            />
            <Sparkle
              className="absolute -top-2 -right-1 w-6 h-6 text-accent"
              weight="fill"
              aria-hidden="true"
            />
            <Sparkle
              className="absolute bottom-0 -left-3 w-5 h-5 text-primary"
              weight="fill"
              aria-hidden="true"
            />
            <Sparkle
              className="absolute top-4 -left-4 w-4 h-4 text-gold-soft"
              weight="fill"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Encouraging message */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.2s' }}
        >
          <h2
            className={`font-serif text-main mb-3 ${
              isLandscape ? 'text-2xl' : 'text-3xl sm:text-4xl'
            }`}
          >
            You&apos;re Ready
          </h2>
          <p
            className={`text-muted max-w-md mx-auto leading-relaxed ${
              isLandscape ? 'text-sm' : 'text-base sm:text-lg'
            }`}
          >
            Trust your intuition. The cards will meet you where you are.
          </p>
        </div>

        {/* Summary card */}
        <div
          className={`mt-6 sm:mt-8 w-full max-w-md ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          } ${isLandscape ? 'mt-4' : ''}`}
          style={{ animationDelay: '0.3s' }}
        >
          <div className="rounded-2xl border border-accent/30 bg-surface/60 backdrop-blur-sm p-5 sm:p-6 text-left">
            <h3 className="text-xs uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
              <Sparkle className="w-3.5 h-3.5" weight="fill" />
              Your Reading Setup
            </h3>

            {/* Spread selection */}
            <div className="flex items-center justify-between py-3 border-b border-secondary/20">
              <span className="text-sm text-muted">Spread</span>
              <span className="text-sm text-main font-medium">
                {spread?.name || 'One-Card Insight'}
              </span>
            </div>

            {/* Card count */}
            <div className="flex items-center justify-between py-3 border-b border-secondary/20">
              <span className="text-sm text-muted">Cards</span>
              <span className="text-sm text-main font-medium">
                {spread?.count || 1} {spread?.count === 1 ? 'card' : 'cards'}
              </span>
            </div>

            {/* Question */}
            <div className="pt-3">
              <span className="text-sm text-muted block mb-1">
                {hasQuestion ? 'Your question' : 'No specific question'}
              </span>
              {hasQuestion ? (
                <p className="text-sm text-main italic leading-relaxed">
                  &quot;{question}&quot;
                </p>
              ) : (
                <p className="text-xs text-muted italic">
                  Open reading — let the cards guide you
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tip */}
        {!isLandscape && (
          <p
            className={`mt-6 text-xs text-muted max-w-sm mx-auto flex items-start gap-1.5 ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.4s' }}
          >
            <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="fill" />
            <span>
              <strong className="text-main">Tip:</strong> Take a breath before you draw. Let your
              mind settle on your question or simply be open to what appears.
            </span>
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className={`flex gap-3 pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1 min-h-[48px] px-4 py-3 rounded-xl border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Back</span>
        </button>
        <button
          type="button"
          onClick={onBegin}
          className="flex-1 flex items-center justify-center gap-2 min-h-[52px] px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-gold text-surface font-bold text-lg shadow-lg shadow-accent/25 transition hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          <Play className="w-5 h-5" weight="fill" />
          Begin Your Reading
        </button>
      </div>
    </div>
  );
}
