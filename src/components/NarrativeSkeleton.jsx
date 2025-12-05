import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';

/**
 * NarrativeSkeleton - Loading placeholder for narrative generation
 *
 * Displays animated skeleton lines that mimic the structure of a narrative,
 * providing visual feedback while the AI generates the personalized reading.
 */
export function NarrativeSkeleton({ className = '', hasQuestion = true }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  // Varying line widths to simulate natural paragraph text
  const lines = [
    { width: '92%', delay: 0 },
    { width: '100%', delay: 75 },
    { width: '88%', delay: 150 },
    { width: '95%', delay: 225 },
    { width: '78%', delay: 300 },
    // Paragraph break simulation
    { width: '0%', delay: 0, isBreak: true },
    { width: '100%', delay: 400 },
    { width: '90%', delay: 475 },
    { width: '96%', delay: 550 },
    { width: '84%', delay: 625 },
    { width: '70%', delay: 700 },
  ];

  // Fewer lines in landscape mode for compact display
  const displayLines = isLandscape ? lines.slice(0, 6) : lines;

  return (
    <div
      className={`narrative-skeleton ${className}`}
      role="status"
      aria-label="Generating your personalized narrative"
      aria-live="polite"
    >
      {/* Header skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-secondary/30 ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDelay: '0ms' }}
        />
        <div
          className={`h-6 sm:h-7 w-48 sm:w-64 rounded-lg bg-secondary/20 ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDelay: '100ms' }}
        />
      </div>

      {/* Question anchor skeleton - only if question was provided */}
      {hasQuestion && (
        <div
          className={`h-12 sm:h-14 rounded-lg bg-surface/60 border border-secondary/30 mb-4 ${
            prefersReducedMotion ? '' : 'animate-pulse'
          }`}
          style={{ animationDelay: '150ms' }}
        />
      )}

      {/* Narrative text skeleton */}
      <div className="rounded-2xl bg-surface/70 border border-secondary/30 shadow-md px-4 py-5 sm:px-6 sm:py-6">
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
        <div className="mt-6 pt-4 border-t border-secondary/20 flex items-center justify-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full bg-accent/60 ${
                  prefersReducedMotion ? '' : 'animate-bounce'
                }`}
                style={{
                  animationDelay: prefersReducedMotion ? '0ms' : `${i * 150}ms`,
                  animationDuration: '1s',
                }}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="text-sm text-muted">
            Weaving your personalized narrative...
          </span>
        </div>
      </div>

      {/* Screen reader announcement */}
      <span className="sr-only">
        Please wait while we generate your personalized tarot reading. This typically takes a few seconds.
      </span>
    </div>
  );
}
