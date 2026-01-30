/**
 * JourneyContent - Main content component for ReadingJourney.
 *
 * Handles variant switching between sidebar, mobile, and fullpage modes.
 * Uses useJourneyData hook for unified data access.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useJourneyData } from '../../hooks/useJourneyData';
import JourneySidebar from './JourneySidebar';
import JourneyMobileSheet from './JourneyMobileSheet';
import { loadCoachStatsSnapshot, persistCoachStatsSnapshot } from '../../lib/journalInsights';

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
    reversalRateReliable,
    reversalRateSample,
    currentStreak,
    cardFrequencyReliable,
    cardFrequencySample,
    seasonNarrative,
    journeyStory,
    coachSuggestion,
    coachSuggestions,
    seasonWindow: journeySeasonWindow,
    seasonTimezone,
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

  const getCoachSuggestionKey = useCallback((suggestion) => {
    if (!suggestion) return '';
    const source = suggestion.source || 'unknown';
    const text = suggestion.question || suggestion.text || '';
    return `${source}:${String(text).trim()}`;
  }, []);

  // Lazy initializer: load saved selection from localStorage once on mount
  const [savedCoachSelection, setSavedCoachSelection] = useState(() => {
    if (typeof window === 'undefined') return null;
    const snapshot = loadCoachStatsSnapshot(userId);
    const savedIndex = snapshot?.meta?.coachSuggestionIndex;
    const savedKey = snapshot?.meta?.coachSuggestionKey;
    if (!Number.isFinite(savedIndex) && typeof savedKey !== 'string') return null;
    return {
      index: Number.isFinite(savedIndex) ? savedIndex : null,
      key: typeof savedKey === 'string' ? savedKey : null,
    };
  });

  // Compute the resolved index from savedCoachSelection and coachSuggestions
  const resolvedIndexFromSaved = useMemo(() => {
    if (!savedCoachSelection) return null;
    if (!Array.isArray(coachSuggestions) || coachSuggestions.length === 0) return null;
    const { key, index } = savedCoachSelection;
    if (key) {
      const matchIndex = coachSuggestions.findIndex(
        (suggestion) => getCoachSuggestionKey(suggestion) === key
      );
      if (matchIndex >= 0) return matchIndex;
    }
    if (Number.isFinite(index)) {
      return Math.min(index, coachSuggestions.length - 1);
    }
    return null;
  }, [coachSuggestions, savedCoachSelection, getCoachSuggestionKey]);

  // Initialize activeCoachIndex from resolvedIndexFromSaved, default to 0
  const [activeCoachIndex, setActiveCoachIndex] = useState(() => {
    return resolvedIndexFromSaved ?? 0;
  });

  // Clear savedCoachSelection once it has been consumed
  useEffect(() => {
    if (savedCoachSelection && resolvedIndexFromSaved !== null) {
      // Use a microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setActiveCoachIndex(resolvedIndexFromSaved);
        setSavedCoachSelection(null);
      });
    }
  }, [savedCoachSelection, resolvedIndexFromSaved]);

  // Clamp activeCoachIndex when coachSuggestions changes
  const clampedActiveIndex = useMemo(() => {
    if (!Array.isArray(coachSuggestions) || coachSuggestions.length === 0) return 0;
    if (activeCoachIndex > coachSuggestions.length - 1) return 0;
    return activeCoachIndex;
  }, [coachSuggestions, activeCoachIndex]);

  const activeCoachSuggestion = useMemo(() => {
    if (Array.isArray(coachSuggestions) && coachSuggestions.length > 0) {
      return coachSuggestions[clampedActiveIndex];
    }
    return coachSuggestion;
  }, [coachSuggestions, clampedActiveIndex, coachSuggestion]);

  const coachSuggestionIndex = useMemo(() => {
    if (!Array.isArray(coachSuggestions) || coachSuggestions.length === 0) return null;
    return clampedActiveIndex;
  }, [coachSuggestions, clampedActiveIndex]);

  const coachSuggestionKey = useMemo(
    () => getCoachSuggestionKey(activeCoachSuggestion),
    [activeCoachSuggestion, getCoachSuggestionKey]
  );
  const handleCoachSelect = useCallback((index) => {
    const nextIndex = Number(index);
    if (!Number.isFinite(nextIndex)) return;
    setActiveCoachIndex(nextIndex);
  }, []);

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

  const coachSuggestionSnapshot = useMemo(() => {
    if (!activeCoachSuggestion) return null;
    return {
      source: activeCoachSuggestion.source || null,
      sourceLabel: activeCoachSuggestion.sourceLabel || null,
      sourceDetail: activeCoachSuggestion.sourceDetail || null,
      text: activeCoachSuggestion.text || null,
      question: activeCoachSuggestion.question || null,
      spread: activeCoachSuggestion.spread || null,
      signalsUsed: Array.isArray(activeCoachSuggestion.signalsUsed)
        ? activeCoachSuggestion.signalsUsed
        : null,
    };
  }, [activeCoachSuggestion]);

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
    reversalRateReliable,
    reversalRateSample,
    currentStreak,
    cardFrequencyReliable,
    cardFrequencySample,
    seasonNarrative,
    journeyStory,
    coachSuggestion,
    coachSuggestions,
    activeCoachIndex: coachSuggestionIndex ?? 0,
    onCoachSelect: handleCoachSelect,
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
    seasonTimezone,
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
    reversalRateReliable,
    reversalRateSample,
    currentStreak,
    cardFrequencyReliable,
    cardFrequencySample,
    seasonNarrative,
    journeyStory,
    coachSuggestion,
    coachSuggestions,
    coachSuggestionIndex,
    handleCoachSelect,
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
    seasonTimezone,
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
      signalsUsed: coachSuggestionSnapshot?.signalsUsed || null,
      coachSuggestion: coachSuggestionSnapshot,
      coachSuggestionIndex,
      coachSuggestionKey: coachSuggestionKey || null,
    }, userId);
  }, [
    exportStats,
    journeyFiltersActive,
    scopedEntries,
    entries,
    userId,
    scopeLabel,
    coachSuggestionSnapshot,
    coachSuggestionIndex,
    coachSuggestionKey,
  ]);

  // Render appropriate variant
  if (variant === 'mobile') {
    return <JourneyMobileSheet {...commonProps} />;
  }

  // Default to sidebar variant (also used for fullpage)
  return <JourneySidebar {...commonProps} variant={variant} />;
}
