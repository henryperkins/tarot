/**
 * ReadingJourney - Unified component for journal analytics.
 *
 * Merges JournalInsightsPanel and ArchetypeJourneySection into a single,
 * cohesive experience with responsive variants for mobile and desktop.
 *
 * SSR-safe: Uses lazy loading to defer localStorage access to client.
 */

import { lazy, Suspense } from 'react';

// Lazy load the content to defer localStorage access
const JourneyContent = lazy(() => import('./JourneyContent'));

/**
 * Loading fallback skeleton.
 */
function JourneyFallback() {
  return (
    <div className="animate-pulse rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5">
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-amber-200/25" />
          <div className="h-3 w-28 rounded bg-amber-200/25" />
        </div>
        {/* Narrative skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-amber-200/15" />
          <div className="h-4 w-3/4 rounded bg-amber-200/15" />
        </div>
        {/* Stats skeleton */}
        <div className="flex gap-4 mt-4">
          <div className="h-12 w-20 rounded-lg bg-amber-200/10" />
          <div className="h-12 w-20 rounded-lg bg-amber-200/10" />
          <div className="h-12 w-20 rounded-lg bg-amber-200/10" />
        </div>
        {/* Cards skeleton */}
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-amber-200/15" />
                <div className="h-4 w-24 rounded bg-amber-200/15" />
              </div>
              <div className="h-4 w-8 rounded bg-amber-200/15" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * ReadingJourney - Main entry point with SSR guard.
 *
 * @param {Object} props
 * @param {Array} props.entries - All journal entries (unfiltered)
 * @param {Array} props.filteredEntries - Filtered entries (when filters active)
 * @param {boolean} props.filtersActive - True when any filter is applied
 * @param {boolean} props.isAuthenticated - User auth state
 * @param {string} props.userId - User ID for Archetype data
 * @param {Array} props.focusAreas - User's stated focus areas from personalization (for drift detection)
 * @param {'sidebar'|'mobile'|'fullpage'} props.variant - Layout variant
 * @param {Object} props.seasonWindow - Optional explicit date range { start: Date; end: Date }
 * @param {string} props.locale - User locale for date formatting
 * @param {string} props.timezone - User timezone
 * @param {Function} props.onCreateShareLink - Callback for creating share links
 * @param {Function} props.onStartReading - Callback for starting a new reading
 */
export function ReadingJourney(props) {
  // SSR guard: render skeleton on server, lazy load on client
  if (typeof window === 'undefined') {
    return <JourneyFallback />;
  }

  return (
    <Suspense fallback={<JourneyFallback />}>
      <JourneyContent {...props} />
    </Suspense>
  );
}

export default ReadingJourney;
