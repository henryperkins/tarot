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
      className="relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5 shadow-[0_24px_68px_-30px_rgba(0,0,0,0.9)]"
      aria-labelledby="reading-journey-empty-heading"
    >
      {/* Decorative background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 18%, rgba(251,191,36,0.08), transparent 32%), radial-gradient(circle at 82% 26%, rgba(56,189,248,0.08), transparent 30%), radial-gradient(circle at 52% 76%, rgba(167,139,250,0.08), transparent 32%)',
        }}
      />
      <div
        className="pointer-events-none absolute -left-16 top-10 h-48 w-48 rounded-full bg-amber-500/12 blur-[90px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[-96px] top-1/3 h-60 w-60 rounded-full bg-cyan-400/10 blur-[90px]"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <h3
          id="reading-journey-empty-heading"
          className="mb-4 flex items-center gap-2 journal-eyebrow text-amber-100/70"
        >
          <Sparkle className="h-3 w-3" aria-hidden="true" />
          Your Reading Journey
        </h3>

        {backfillResult ? (
          <div className="text-sm text-amber-100/80">
            <p className="mb-2 text-amber-50">
              {backfillResult.success ? 'Analysis complete!' : 'Analysis failed'}
            </p>
            {backfillResult.success && backfillResult.stats && (
              <ul className="space-y-1 text-xs text-amber-100/70">
                <li>{backfillResult.stats.entriesProcessed} entries processed</li>
                <li>{backfillResult.stats.cardsTracked} cards tracked</li>
                {backfillResult.stats.badgesAwarded > 0 && (
                  <li>{backfillResult.stats.badgesAwarded} badges awarded</li>
                )}
              </ul>
            )}
            {!backfillResult.success && (
              <p className="text-xs text-red-300/80">
                {backfillResult.message || 'Please try again'}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <ArchetypeEmptyIllustration className="mb-4 w-32 opacity-90" />

            {!hasEntries ? (
              <>
                <p className="mb-4 text-sm text-amber-100/70 leading-relaxed">
                  Your reading journey will appear here once you complete your first reading.
                </p>
                <p className="text-xs text-amber-100/50">
                  Start a reading to begin tracking your card patterns and insights.
                </p>
              </>
            ) : isAuthenticated ? (
              <>
                <p className="mb-4 text-sm text-amber-100/70 leading-relaxed">
                  Track which cards appear most often in your readings to discover
                  recurring archetypal themes in your journey.
                </p>

                <button
                  onClick={onBackfill}
                  disabled={isBackfilling}
                  aria-label="Analyze journal for reading journey"
                  className={`
                    flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full text-sm sm:text-xs font-medium
                    border border-amber-300/40 text-amber-50 bg-amber-300/10
                    shadow-[0_16px_36px_-22px_rgba(251,191,36,0.65)]
                    hover:-translate-y-0.5 hover:border-amber-300/60
                    active:bg-amber-300/20
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50
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

                <p className="mt-3 text-xs sm:text-[11px] text-amber-100/55">
                  This will scan your journal entries and build your card frequency data.
                </p>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-amber-100/70 leading-relaxed">
                  Sign in to track your reading patterns and discover which cards
                  keep appearing in your journey.
                </p>
                <p className="text-xs text-amber-100/50">
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
