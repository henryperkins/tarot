import { useState, useEffect, useMemo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';

const EXTENDED_WAIT_MS = 12000;

/**
 * Line configurations for different spread complexities.
 * More cards = more narrative = more skeleton lines.
 */
const LINE_CONFIGS = {
  compact: [
    { width: '92%', delay: 0 },
    { width: '100%', delay: 75 },
    { width: '88%', delay: 150 },
    { width: '70%', delay: 225 },
  ],
  standard: [
    { width: '92%', delay: 0 },
    { width: '100%', delay: 75 },
    { width: '88%', delay: 150 },
    { width: '95%', delay: 225 },
    { width: '78%', delay: 300 },
    { width: '0%', delay: 0, isBreak: true },
    { width: '100%', delay: 400 },
    { width: '90%', delay: 475 },
    { width: '96%', delay: 550 },
    { width: '84%', delay: 625 },
    { width: '70%', delay: 700 },
  ],
  extended: [
    { width: '92%', delay: 0 },
    { width: '100%', delay: 60 },
    { width: '88%', delay: 120 },
    { width: '95%', delay: 180 },
    { width: '78%', delay: 240 },
    { width: '0%', delay: 0, isBreak: true },
    { width: '100%', delay: 320 },
    { width: '90%', delay: 380 },
    { width: '96%', delay: 440 },
    { width: '84%', delay: 500 },
    { width: '92%', delay: 560 },
    { width: '0%', delay: 0, isBreak: true },
    { width: '100%', delay: 640 },
    { width: '88%', delay: 700 },
    { width: '72%', delay: 760 },
  ],
};

/**
 * Select line configuration based on card count.
 * @param {number} cardCount - Number of cards in the spread
 * @param {boolean} isLandscape - Whether in landscape orientation
 * @returns {Array} Line configuration array
 */
function getLineConfig(cardCount, isLandscape) {
  // Landscape always uses compact for screen real estate
  if (isLandscape) {
    return LINE_CONFIGS.compact;
  }

  if (cardCount <= 1) {
    return LINE_CONFIGS.compact;
  }
  if (cardCount <= 5) {
    return LINE_CONFIGS.standard;
  }
  // Celtic Cross (10 cards) and large spreads
  return LINE_CONFIGS.extended;
}

/**
 * NarrativeSkeleton - Loading placeholder for narrative generation
 *
 * Displays animated skeleton lines that mimic the structure of a narrative,
 * providing visual feedback while the AI generates the personalized reading.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.hasQuestion=true] - Whether user provided a question
 * @param {string} [props.displayName] - User's display name for personalized messaging
 * @param {string} [props.spreadName] - Name of the spread being interpreted
 * @param {number} [props.cardCount=3] - Number of cards in the spread
 * @param {string} [props.reasoningSummary] - AI reasoning summary to display during generation
 * @param {Object} [props.reasoning] - Reasoning metadata (narrative arc preview)
 * @param {string} [props.atmosphereClassName] - Atmosphere modifier classes
 */
export function NarrativeSkeleton({
  className = '',
  hasQuestion = true,
  displayName = '',
  spreadName = '',
  cardCount = 3,
  reasoningSummary = '',
  reasoning = null,
  atmosphereClassName = '',
}) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  const [isExtendedWait, setIsExtendedWait] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setIsExtendedWait(true), EXTENDED_WAIT_MS);
    return () => clearTimeout(timeout);
  }, []);

  const statusMessage = isExtendedWait
    ? 'This is taking longer than usual. Your reading is still being prepared.'
    : `${displayName ? `${displayName}, your` : 'Your'} ${spreadName || 'personalized'} reading is being prepared.`;

  const cardSlots = useMemo(() => {
    if (isLandscape) return Array.from({ length: 3 }, (_, index) => index);
    if (cardCount <= 3) return Array.from({ length: 3 }, (_, index) => index);
    if (cardCount <= 6) return Array.from({ length: 4 }, (_, index) => index);
    return Array.from({ length: 5 }, (_, index) => index);
  }, [cardCount, isLandscape]);

  // Get appropriate line configuration
  const displayLines = useMemo(
    () => getLineConfig(cardCount, isLandscape),
    [cardCount, isLandscape]
  );

  const arcPreview = reasoning?.narrativeArc || null;

  return (
    <div
      className={`narrative-skeleton ${className}`}
      role="region"
      aria-label="Generating your personalized narrative"
    >
      <h3 tabIndex={-1} data-reading-focus-target className="text-lg sm:text-2xl font-serif text-accent">
        Preparing your reading
      </h3>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 mb-4 text-sm text-muted [overflow-wrap:anywhere]">
        {statusMessage}
      </p>

      {/* Ritual stage */}
      <div className={`narrative-skeleton__ritual narrative-atmosphere ${atmosphereClassName}`}>
        <div className="narrative-skeleton__cards" aria-hidden="true">
          {cardSlots.map((slot) => (
            <div key={slot} className="narrative-skeleton__card" />
          ))}
        </div>
        {arcPreview && (arcPreview.name || arcPreview.description) && (
          <div className="narrative-skeleton__arc mt-4 px-4 py-3 rounded-xl bg-surface/70">
            {arcPreview.name && (
              <span className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                Narrative arc
              </span>
            )}
            {arcPreview.name && (
              <p className="text-sm text-main font-semibold">
                {arcPreview.name}
              </p>
            )}
            {arcPreview.description && (
              <p className="text-xs text-muted mt-1">
                {arcPreview.description}
              </p>
            )}
          </div>
        )}
        <p className="narrative-skeleton__hint text-xs text-muted text-center mt-2">
          Take a quiet moment to reflect on your question.
        </p>

        {/* AI Reasoning Summary - shown while generating */}
        {reasoningSummary && (
          <div 
            className="narrative-skeleton__reasoning mt-5 px-4 py-3 rounded-xl bg-surface/80 shadow-lg backdrop-blur-sm"
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5 text-accent" aria-hidden="true">✦</span>
              <div className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                  Considering
                </span>
                <p className="text-sm text-main leading-relaxed">
                  {reasoningSummary.length > 280 ? `${reasoningSummary.slice(0, 280)}…` : reasoningSummary}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Question anchor skeleton - only if question was provided */}
      {hasQuestion && (
        <div
          className={`h-12 sm:h-14 rounded-lg bg-surface/60 mb-4 ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDelay: '150ms' }}
          aria-hidden="true"
        />
      )}

      {/* Narrative text skeleton */}
      <div className={`narrative-skeleton__panel narrative-atmosphere ${atmosphereClassName} rounded-2xl bg-surface/70 shadow-md px-3 xxs:px-4 sm:px-6 py-5 sm:py-6 min-h-[6rem] xxs:min-h-[7.5rem] md:min-h-[10rem]`}>
        <div className="max-w-[68ch] mx-auto space-y-3">
          {displayLines.map((line, index) => {
            if (line.isBreak) {
              return <div key={index} className="h-4" aria-hidden="true" />;
            }

            return (
              <div
                key={index}
                className={`h-4 sm:h-5 rounded-md bg-gradient-to-r from-secondary/25 via-secondary/15 to-secondary/25 ${
                  prefersReducedMotion ? '' : 'animate-pulse'
                }`}
                style={{
                  width: line.width,
                  animationDelay: prefersReducedMotion ? '0ms' : `${line.delay}ms`,
                  animationDuration: '1.5s',
                }}
                aria-hidden="true"
              />
            );
          })}
        </div>

      </div>

    </div>
  );
}
