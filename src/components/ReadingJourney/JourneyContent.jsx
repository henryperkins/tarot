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
  isAuthenticated,
  userId,
  focusAreas = [],
  variant = 'sidebar',
  seasonWindow,
  locale = 'en-US',
  timezone,
  onCreateShareLink,
  onStartReading,
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
    // Use exportEntries for exports - full journal when unfiltered, filtered when active
    exportEntries,
  } = journeyData;

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
    // For export functionality - use exportEntries to preserve full journal when unfiltered
    activeEntries: exportEntries,
    exportStats,
    locale,
    timezone,
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
    exportEntries,
    exportStats,
    locale,
    timezone,
  ]);

  // Persist coach snapshot for GuidedIntentionCoach to consume
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const entryCount = scopedEntries?.length ?? 0;
    const totalEntries = Array.isArray(entries) ? entries.length : null;
    persistCoachStatsSnapshot(exportStats, {
      filtersActive: journeyFiltersActive,
      filterLabel: journeyFiltersActive ? 'Filtered journal view' : 'Entire journal',
      entryCount,
      totalEntries,
    }, userId);
  }, [exportStats, journeyFiltersActive, scopedEntries, entries, userId]);

  // Render appropriate variant
  if (variant === 'mobile') {
    return <JourneyMobileSheet {...commonProps} />;
  }

  // Default to sidebar variant (also used for fullpage)
  return <JourneySidebar {...commonProps} variant={variant} />;
}
