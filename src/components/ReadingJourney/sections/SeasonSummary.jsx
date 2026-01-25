/**
 * SeasonSummary - Hero section with narrative and coach suggestion.
 */

import { memo } from 'react';
import { Fire } from '@phosphor-icons/react';
import { CoachSuggestion } from '../../CoachSuggestion';

function SeasonSummary({
  narrative,
  topCard,
  currentStreak,
  totalReadings,
  topContext,
  contextBreakdown,
  preferenceDrift,
  coachSuggestion,
  onStartReading,
  onSaveIntention,
  onOpenJournal,
  onSetFocusAreas,
  saveNotice,
  saveError,
  showStartReadingCta = true,
  seasonWindow,
  locale = 'default',
  timezone,
  filtersActive,
  scopeLabel,
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

  const themeHint = coachSuggestion?.source === 'theme' && typeof totalReadings === 'number' && totalReadings > 0
    ? `Theme from ${totalReadings} reading${totalReadings === 1 ? '' : 's'}`
    : '';
  const themeContextHint = coachSuggestion?.source === 'theme' && topContext?.name
    ? `Top context: ${topContext.name.charAt(0).toUpperCase() + topContext.name.slice(1)}`
    : '';
  const showFocusAreasCta = !preferenceDrift
    && Array.isArray(contextBreakdown)
    && contextBreakdown.length > 0;

  const handleStartReading = () => {
    if (onStartReading && coachSuggestion) {
      onStartReading(coachSuggestion);
    }
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent p-4 border border-amber-300/10">
      {/* Season Label */}
      {seasonWindow && (
        <p className="text-sm sm:text-xs text-amber-100/60 mb-2">{formatSeasonLabel()}</p>
      )}

      {/* Narrative */}
      {narrative ? (
        <p className="text-base sm:text-sm text-amber-100/85 leading-relaxed mb-3">
          {narrative}
        </p>
      ) : (
        <p className="text-base sm:text-sm text-amber-100/70 mb-3">
          Start tracking your journey with more readings.
        </p>
      )}

      {/* Stat chips */}
      <div className="mb-3 space-y-1">
        <div className="flex flex-wrap gap-2">
          {topCard && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-2.5 py-1 text-xs text-amber-100">
              <span className="text-amber-200/80">🃏</span>
              {topCard.name}: {topCard.count}x
              {topCard.hasBadge && (
                <Fire className="h-3 w-3 text-orange-400" aria-label="streak badge" />
              )}
            </span>
          )}
          {currentStreak > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs text-orange-100"
              title="Counts from yesterday if no reading today (grace period)."
            >
              <Fire className="h-3 w-3" />
              {currentStreak}-day streak
            </span>
          )}
          {topContext?.name && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs text-cyan-100">
              {topContext.name.charAt(0).toUpperCase() + topContext.name.slice(1)}
            </span>
          )}
        </div>
        {currentStreak > 0 && (
          <p className="text-[10px] text-amber-100/50">
            Counts from yesterday if no reading today (grace period).
          </p>
        )}
	      </div>

      {/* Coach suggestion CTA */}
      {coachSuggestion && (
        <CoachSuggestion
          recommendation={coachSuggestion}
          variant="journey"
          tone="amber"
          onApply={onStartReading ? handleStartReading : null}
          onSaveIntention={onSaveIntention}
          onOpenJournal={onOpenJournal}
          onSetFocusAreas={onSetFocusAreas}
          showFocusAreasCta={showFocusAreasCta}
          focusAreasCtaPlacement="before-actions"
          filtersActive={filtersActive}
          scopeLabel={scopeLabel}
          saveNotice={saveNotice}
          saveError={saveError}
          showStartReadingCta={showStartReadingCta}
          showStartArrow
          themeHint={themeHint}
          themeContextHint={themeContextHint}
        />
      )}
    </div>
  );
}

export default memo(SeasonSummary);
