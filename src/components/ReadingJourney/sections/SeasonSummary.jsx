/**
 * SeasonSummary - Hero section with narrative and coach suggestion.
 */

import { memo } from 'react';
import { ArrowRight, Fire } from '@phosphor-icons/react';

function SeasonSummary({
  narrative,
  topCard,
  currentStreak,
  topContext,
  coachSuggestion,
  onStartReading,
  seasonWindow,
  locale = 'default',
  timezone,
}) {
  // Format the season window for display
  const formatSeasonLabel = () => {
    if (!seasonWindow?.start) return '';
    const start = seasonWindow.start;
    const end = seasonWindow.end;

    const formatOpts = { month: 'long', ...(timezone && { timeZone: timezone }) };
    const yearOpts = { year: 'numeric', ...(timezone && { timeZone: timezone }) };

    const startMonth = start.toLocaleString(locale, formatOpts);
    const endMonth = end.toLocaleString(locale, formatOpts);
    const startYear = start.toLocaleString(locale, yearOpts);
    const endYear = end.toLocaleString(locale, yearOpts);

    // Same month and year
    if (startMonth === endMonth && startYear === endYear) {
      return `${startMonth} ${startYear}`;
    }
    // Same year, different months
    if (startYear === endYear) {
      return `${startMonth}–${endMonth} ${startYear}`;
    }
    // Different years (e.g., Dec 2024 – Jan 2025)
    return `${startMonth} ${startYear}–${endMonth} ${endYear}`;
  };

  const handleStartReading = () => {
    if (onStartReading && coachSuggestion) {
      onStartReading(coachSuggestion);
    }
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent p-4 border border-amber-300/10">
      {/* Season Label */}
      {seasonWindow && (
        <p className="text-xs text-amber-100/60 mb-2">{formatSeasonLabel()}</p>
      )}

      {/* Narrative */}
      {narrative ? (
        <p className="text-sm text-amber-100/85 leading-relaxed mb-3">
          {narrative}
        </p>
      ) : (
        <p className="text-sm text-amber-100/70 mb-3">
          Start tracking your journey with more readings.
        </p>
      )}

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {topCard && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-2.5 py-1 text-xs text-amber-100">
            <span className="text-amber-200/80">🃏</span>
            {topCard.name}: {topCard.count}×
            {topCard.hasBadge && (
              <Fire className="h-3 w-3 text-orange-400" aria-label="streak badge" />
            )}
          </span>
        )}
        {currentStreak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs text-orange-100">
            <Fire className="h-3 w-3" />
            {currentStreak}-day streak
          </span>
        )}
        {topContext && (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs text-cyan-100">
            {topContext.name.charAt(0).toUpperCase() + topContext.name.slice(1)}
          </span>
        )}
      </div>

      {/* Coach suggestion CTA */}
      {coachSuggestion && onStartReading && (
        <div className="rounded-lg bg-amber-200/5 p-3 border border-amber-300/10">
          <p className="text-xs text-amber-100/70 mb-2">
            💡 {coachSuggestion.text}
          </p>
          <button
            onClick={handleStartReading}
            className="
              inline-flex items-center gap-1.5 text-xs font-medium text-amber-200
              hover:text-amber-100 transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50
            "
          >
            Start Reading
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(SeasonSummary);
