/**
 * JourneyContent - Main content component for ReadingJourney.
 *
 * Handles variant switching between sidebar, mobile, and fullpage modes.
 * Uses useJourneyData hook for unified data access.
 */

import { useEffect, useMemo } from 'react';
import { useJourneyData } from '../../hooks/useJourneyData';
import JourneySidebar from './JourneySidebar';
import JourneyMobileSheet from './JourneyMobileSheet';
import { persistCoachStatsSnapshot } from '../../lib/journalInsights';

/**
 * JourneyContent - Renders the appropriate variant based on props.
 */
export default function JourneyContent({
  entries,
  filteredEntries,
  filtersActive,
  filtersApplied,
  isAuthenticated,
  userId,
  focusAreas = [],
  variant = 'sidebar',
  seasonWindow,
  locale = 'en-US',
  timezone,
  onCreateShareLink,
  onStartReading,
  showStartReadingCta = true,
  scopeLabel,
  scopeEntries,
  analyticsScope,
  onScopeSelect,
}) {
  const journeyData = useJourneyData({
    entries,
    filteredEntries,
    filtersActive,
    isAuthenticated,
    userId,
    focusAreas,
    seasonWindow,
    locale,
    timezone,
  });

  const {
    cardFrequency,
    badges,
    majorArcanaMap,
    contextBreakdown,
    themes,
    preferenceDrift,
    cadence,
    totalReadings,
    totalCards,
    reversalRate,
    currentStreak,
    seasonNarrative,
    journeyStory,
    coachSuggestion,
    seasonWindow: journeySeasonWindow,
    filtersActive: journeyFiltersActive,
    isLoading,
    hasBackfilled,
    needsBackfill,
    isEmpty,
    isFilteredEmpty,
    isAnalyticsDisabled,
    isBackfilling,
    backfillResult,
    handleBackfill,
    _dataSource,
    // Use scopedEntries for stats display (matches D1 time window)
    scopedEntries,
  } = journeyData;

  const effectiveScopeEntries = Array.isArray(scopeEntries) ? scopeEntries : scopedEntries;

  // Build stats object for PDF export (matches computeJournalStats shape)
  const exportStats = useMemo(() => ({
    totalReadings,
    totalCards,
    reversalRate,
    frequentCards: cardFrequency,
    contextBreakdown,
    monthlyCadence: cadence,
    recentThemes: themes,
  }), [
    totalReadings,
    totalCards,
    reversalRate,
    cardFrequency,
    contextBreakdown,
    cadence,
    themes,
  ]);

  // Common props for all variants
  const commonProps = useMemo(() => ({
    cardFrequency,
    badges,
    majorArcanaMap,
    contextBreakdown,
    themes,
    preferenceDrift,
    cadence,
    totalReadings,
    totalCards,
    reversalRate,
    currentStreak,
    seasonNarrative,
    journeyStory,
    coachSuggestion,
    seasonWindow: journeySeasonWindow,
    filtersActive: journeyFiltersActive,
    isLoading,
    hasBackfilled,
    needsBackfill,
    isEmpty,
    isFilteredEmpty,
    isAnalyticsDisabled,
    isBackfilling,
    backfillResult,
    handleBackfill,
    _dataSource,
    isAuthenticated,
    userId,
    onCreateShareLink,
    onStartReading,
    showStartReadingCta,
    scopeLabel,
    // For export/share functionality - scope-aware entries
    scopeEntries: effectiveScopeEntries,
    filteredEntries,
    // All entries (unfiltered) for share scope "most recent" option
    allEntries: entries,
    exportStats,
    locale,
    timezone,
    filtersApplied: Boolean(filtersApplied),
    analyticsScope,
    onScopeSelect,
  }), [
    cardFrequency,
    badges,
    majorArcanaMap,
    contextBreakdown,
    themes,
    preferenceDrift,
    cadence,
    totalReadings,
    totalCards,
    reversalRate,
    currentStreak,
    seasonNarrative,
    journeyStory,
    coachSuggestion,
    journeySeasonWindow,
    journeyFiltersActive,
    isLoading,
    hasBackfilled,
    needsBackfill,
    isEmpty,
    isFilteredEmpty,
    isAnalyticsDisabled,
    isBackfilling,
    backfillResult,
    handleBackfill,
    _dataSource,
    isAuthenticated,
    userId,
    onCreateShareLink,
    onStartReading,
    showStartReadingCta,
    scopeLabel,
    effectiveScopeEntries,
    filteredEntries,
    entries,
    exportStats,
    locale,
    timezone,
    filtersApplied,
    analyticsScope,
    onScopeSelect,
  ]);

  // Persist coach snapshot for GuidedIntentionCoach to consume
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const entryCount = scopedEntries?.length ?? 0;
    const totalEntries = Array.isArray(entries) ? entries.length : null;
    persistCoachStatsSnapshot(exportStats, {
      filtersActive: journeyFiltersActive,
      filterLabel: scopeLabel || (journeyFiltersActive ? 'Filtered journal view' : 'Entire journal'),
      entryCount,
      totalEntries,
    }, userId);
  }, [exportStats, journeyFiltersActive, scopedEntries, entries, userId, scopeLabel]);

  // Render appropriate variant
  if (variant === 'mobile') {
    return <JourneyMobileSheet {...commonProps} />;
  }

  // Default to sidebar variant (also used for fullpage)
  return <JourneySidebar {...commonProps} variant={variant} />;
}
