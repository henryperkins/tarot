/**
 * EmptyState - Empty state with backfill option.
 */

import { Sparkle, ArrowsClockwise } from '@phosphor-icons/react';
import { ArchetypeEmptyIllustration } from '../../illustrations/ArchetypeEmptyIllustration';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export default function EmptyState({
  onBackfill,
  isBackfilling,
  backfillResult,
  isAuthenticated,
  hasEntries,
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[color:var(--border-warm-subtle)] bg-gradient-to-br from-[color:var(--panel-dark-1)] via-[color:var(--panel-dark-2)] to-[color:var(--panel-dark-3)] p-5 shadow-[0_24px_68px_-30px_rgba(0,0,0,0.9)]"
      aria-labelledby="reading-journey-empty-heading"
    >
      {/* Decorative background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 18%, var(--glow-gold), transparent 32%), radial-gradient(circle at 82% 26%, var(--glow-blue), transparent 30%), radial-gradient(circle at 52% 76%, var(--glow-pink), transparent 32%)',
        }}
      />
      <div
        className="pointer-events-none absolute -left-16 top-10 h-48 w-48 rounded-full bg-[color:var(--glow-gold)] blur-[90px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[-96px] top-1/3 h-60 w-60 rounded-full bg-[color:var(--glow-blue)] blur-[90px]"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <h3
          id="reading-journey-empty-heading"
          className="mb-4 flex items-center gap-2 journal-eyebrow text-muted"
        >
          <Sparkle className="h-3 w-3" aria-hidden="true" />
          Your Reading Journey
        </h3>

        {backfillResult ? (
          <div className="text-sm text-muted-high">
            <p className="mb-2 text-main">
              {backfillResult.success ? 'Analysis complete!' : 'Analysis failed'}
            </p>
            {backfillResult.success && backfillResult.stats && (
              <ul className="space-y-1 text-xs text-muted">
                <li>{backfillResult.stats.entriesProcessed} entries processed</li>
                <li>{backfillResult.stats.cardsTracked} cards tracked</li>
                {backfillResult.stats.badgesAwarded > 0 && (
                  <li>{backfillResult.stats.badgesAwarded} badges awarded</li>
                )}
              </ul>
            )}
            {!backfillResult.success && (
              <p className="text-xs text-error">
                {backfillResult.message || 'Please try again'}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <ArchetypeEmptyIllustration className="mb-4 w-32 opacity-90" />

            {!hasEntries ? (
              <>
                <p className="mb-4 text-sm text-muted leading-relaxed">
                  Your reading journey will appear here once you complete your first reading.
                </p>
                <p className="text-xs text-muted">
                  Start a reading to begin tracking your card patterns and insights.
                </p>
              </>
            ) : isAuthenticated ? (
              <>
                <p className="mb-4 text-sm text-muted leading-relaxed">
                  Track which cards appear most often in your readings to discover
                  recurring archetypal themes in your journey.
                </p>

                <button
                  onClick={onBackfill}
                  disabled={isBackfilling}
                  aria-label="Analyze journal for reading journey"
                  className={`
                    flex items-center gap-2 min-h-touch px-4 py-2 rounded-full text-sm sm:text-xs font-medium
                    border border-[color:var(--border-warm-light)] text-main bg-[color:var(--border-warm-subtle)]
                    shadow-[0_16px_36px_-22px_var(--primary-60)]
                    hover:-translate-y-0.5 hover:border-[color:var(--border-warm)]
                    active:bg-[color:var(--accent-25)]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0
                    transition touch-manipulation
                  `}
                >
                  <ArrowsClockwise
                    className={`h-3.5 w-3.5 ${isBackfilling && !prefersReducedMotion ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  {isBackfilling ? 'Analyzing readings...' : 'Analyze past readings'}
                </button>

                <p className="mt-3 text-xs sm:text-[11px] text-muted">
                  One-time analysis for insights; it does not change your entries.
                </p>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted leading-relaxed">
                  Sign in to track your reading patterns and discover which cards
                  keep appearing in your journey.
                </p>
                <p className="text-xs text-muted">
                  Your journey analytics will sync across devices when signed in.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
