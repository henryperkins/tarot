import { useState, useEffect, useMemo } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';

/**
 * Generation phase messages that rotate during loading.
 * Phases progress from initial to extended wait states.
 */
const PHASE_MESSAGES = {
  initial: [
    'Weaving your personalized narrative...',
    'Drawing connections between the cards...',
    'Interpreting the spread positions...',
  ],
  extended: [
    'Taking a bit longer than usual...',
    'Crafting a thoughtful interpretation...',
    'Almost there, adding final touches...',
  ],
};

/** Thresholds for phase transitions (in milliseconds) */
const PHASE_TIMING = {
  messageRotation: 3500,  // Rotate messages every 3.5s
  extendedWait: 12000,    // Show extended messages after 12s
};

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
 * Narrative generation step labels for visual progress.
 */
const STEP_LABELS = [
  'Reading the spread',
  'Finding the connections',
  'Weaving the narrative',
];

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
 * @param {string} [props.narrativePhase] - Current narrative generation phase ('analyzing'|'drafting'|'polishing')
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
  narrativePhase = '',
  atmosphereClassName = '',
}) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  // Track elapsed time for phase transitions and message rotation
  const [elapsedMs, setElapsedMs] = useState(0);

  // Single interval for elapsed time - message rotation derived from this
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs(prev => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Derive message index from elapsed time (changes every messageRotation ms)
  const messageIndex = prefersReducedMotion
    ? 0
    : Math.floor(elapsedMs / PHASE_TIMING.messageRotation);

  // Determine current phase and message
  const isExtendedWait = elapsedMs >= PHASE_TIMING.extendedWait;
  const messages = isExtendedWait ? PHASE_MESSAGES.extended : PHASE_MESSAGES.initial;
  const currentMessage = messages[messageIndex % messages.length];

  // Determine step index from narrative phase (SSE-driven) with time-based fallback
  const stepIndex = useMemo(() => {
    // Use actual narrative phase when available
    if (narrativePhase === 'polishing') return 2;
    if (narrativePhase === 'drafting') return 1;
    if (narrativePhase === 'analyzing') return 0;
    // Fallback to time-based progression if phase not provided
    if (elapsedMs >= 9000) return 2;
    if (elapsedMs >= 4500) return 1;
    return 0;
  }, [narrativePhase, elapsedMs]);

  // Build personalized status message
  const statusMessage = useMemo(() => {
    if (displayName && spreadName) {
      return `${displayName}, your ${spreadName} reading is being crafted...`;
    }
    if (displayName) {
      return `${displayName}, ${currentMessage.charAt(0).toLowerCase()}${currentMessage.slice(1)}`;
    }
    if (spreadName) {
      return `Interpreting your ${spreadName}...`;
    }
    return currentMessage;
  }, [displayName, spreadName, currentMessage]);

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

  // Screen reader message adapts to wait time
  const srMessage = isExtendedWait
    ? `Still generating your personalized tarot reading. This is taking longer than usual but should complete soon.`
    : `Please wait while we generate your personalized tarot reading. This typically takes a few seconds.`;

  const arcPreview = useMemo(() => {
    if (!reasoning?.narrativeArc) return null;
    return {
      name: reasoning.narrativeArc?.name || '',
      description: reasoning.narrativeArc?.description || ''
    };
  }, [reasoning?.narrativeArc]);

  return (
    <div
      className={`narrative-skeleton ${className}`}
      role="status"
      aria-label="Generating your personalized narrative"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-secondary/30 ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDelay: '0ms' }}
          aria-hidden="true"
        />
        <div
          className={`h-6 sm:h-7 w-48 sm:w-64 rounded-lg bg-secondary/20 ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDelay: '100ms' }}
          aria-hidden="true"
        />
      </div>

      {/* Ritual stage */}
      <div className={`narrative-skeleton__ritual narrative-atmosphere ${atmosphereClassName}`}>
        <div className="narrative-skeleton__cards" aria-hidden="true">
          {cardSlots.map((slot) => (
            <div key={slot} className="narrative-skeleton__card" />
          ))}
        </div>
        <div className="narrative-skeleton__steps" role="list" aria-label="Narrative generation progress">
          {STEP_LABELS.map((label, index) => {
            const isCurrent = index === stepIndex;
            const isActive = index <= stepIndex;
            return (
              <div
                key={label}
                role="listitem"
                className={`narrative-skeleton__step ${isActive ? 'is-active' : ''} ${isCurrent ? 'is-current' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="narrative-skeleton__step-dot" aria-hidden="true" />
                <span className="narrative-skeleton__step-label">{label}</span>
              </div>
            );
          })}
        </div>
        {arcPreview && (arcPreview.name || arcPreview.description) && (
          <div className="narrative-skeleton__arc mt-4 px-4 py-3 rounded-xl border border-secondary/30 bg-surface/70">
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
          Let your attention rest on the card that feels loudest.
        </p>

        {/* AI Reasoning Summary - shown while generating */}
        {reasoningSummary && (
          <div 
            className="narrative-skeleton__reasoning mt-5 px-4 py-3 rounded-xl bg-surface/80 border border-secondary/40 shadow-lg backdrop-blur-sm"
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
          className={`h-12 sm:h-14 rounded-lg bg-surface/60 border border-secondary/30 mb-4 ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDelay: '150ms' }}
          aria-hidden="true"
        />
      )}

      {/* Narrative text skeleton */}
      <div className={`narrative-skeleton__panel narrative-atmosphere ${atmosphereClassName} rounded-2xl bg-surface/70 border border-secondary/30 shadow-md px-3 xxs:px-4 sm:px-6 py-5 sm:py-6 min-h-[6rem] xxs:min-h-[7.5rem] md:min-h-[10rem]`}>
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

        {/* Weaving indicator */}
        <div className="mt-6 pt-4 border-t border-secondary/20 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    isExtendedWait ? 'bg-primary/60' : 'bg-accent/60'
                  } ${prefersReducedMotion ? '' : 'animate-bounce'}`}
                  style={{
                    animationDelay: prefersReducedMotion ? '0ms' : `${i * 150}ms`,
                    animationDuration: '1s',
                  }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span
              className={`text-sm transition-colors duration-300 ${
                isExtendedWait ? 'text-primary/80' : 'text-muted'
              }`}
              aria-hidden="true"
            >
              {statusMessage}
            </span>
          </div>

          {/* Extended wait reassurance */}
          {isExtendedWait && (
            <p className="text-xs text-muted/70 text-center max-w-xs animate-fade-in">
              Complex spreads take a moment to interpret thoughtfully.
            </p>
          )}
        </div>
      </div>

      {/* Screen reader announcement */}
      <span className="sr-only">{srMessage}</span>
    </div>
  );
}
