/**
 * usePatternsSnapshot - Shared hook for patterns snapshot logic.
 *
 * Computes timeframe labels, date formatting, and determines whether
 * the expanded patterns view should be available.
 */

import { useMemo } from 'react';

// Maximum number of items shown in preview before "View full patterns" button appears
const MAX_PREVIEW_ITEMS = 4;

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

  const hasMoreContexts = contextBreakdown.length > MAX_PREVIEW_ITEMS;
  const hasMoreThemes = themes.length > MAX_PREVIEW_ITEMS;
  const hasMorePatterns = hasMoreContexts || hasMoreThemes;

  return {
    timeframeLabel,
    formattedSeasonWindow,
    hasMoreContexts,
    hasMoreThemes,
    hasMorePatterns,
  };
}
