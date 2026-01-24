/**
 * usePatternsSnapshot - Shared hook for patterns snapshot logic.
 *
 * Computes timeframe labels, date formatting, and determines whether
 * the expanded patterns view should be available.
 */

import { useMemo } from 'react';

export function usePatternsSnapshot({
  scopeLabel,
  seasonWindow,
  locale = 'default',
  timezone,
  seasonTimezone,
  filtersActive,
  analyticsScope,
  contextBreakdown = [],
  themes = [],
}) {
  const timeframeLabel = useMemo(
    () =>
      scopeLabel ||
      (filtersActive && analyticsScope === 'filters' ? 'Filtered view' : 'Current view'),
    [scopeLabel, filtersActive, analyticsScope]
  );

  const dateFormatOptions = useMemo(
    () => ({
      month: 'long',
      year: 'numeric',
      ...((seasonTimezone || timezone) && { timeZone: seasonTimezone || timezone }),
    }),
    [seasonTimezone, timezone]
  );

  const formattedSeasonWindow = useMemo(() => {
    if (!seasonWindow) return null;
    const formatter = new Intl.DateTimeFormat(locale, dateFormatOptions);
    return `${formatter.format(seasonWindow.start)} – ${formatter.format(seasonWindow.end)}`;
  }, [seasonWindow, locale, dateFormatOptions]);

  const hasMoreContexts = contextBreakdown.length > 4;
  const hasMoreThemes = themes.length > 4;
  const hasMorePatterns = hasMoreContexts || hasMoreThemes;

  return {
    timeframeLabel,
    formattedSeasonWindow,
    hasMoreContexts,
    hasMoreThemes,
    hasMorePatterns,
  };
}
