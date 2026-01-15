/**
 * useJournalAnalytics - Manages scope selection, stats computation, and summary data
 */

import { useCallback, useMemo, useState } from 'react';
import { getTimestamp } from '../../shared/journal/utils.js';
import { computeJournalStats, formatContextName } from '../lib/journalInsights';
import { getCardImage } from '../lib/cardLookup';
import {
  EMPTY_STATS,
  CARD_NODE_POSITIONS,
  CARD_NODE_FALLBACK
} from '../lib/journal/constants';
import {
  getTopContext,
  getCurrentMonthWindow,
  parseDateInput,
  getTimeframeWindow,
  filterEntriesToWindow,
  formatWindowLabel,
  getAllTimeWindow,
  getLatestEntryTimestamp,
  formatSummaryDate
} from '../lib/journal/utils';

export function useJournalAnalytics(entries, filteredEntries, filters, { isSmallSummary = false } = {}) {
  // Scope selection state
  const [analyticsScope, setAnalyticsScope] = useState('month');
  const [customScope, setCustomScope] = useState({ start: '', end: '' });
  const [hasUserSelectedScope, setHasUserSelectedScope] = useState(false);
  const [scopeError, setScopeError] = useState('');
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);

  const filtersActive = Boolean(filters.query?.trim()) ||
    (filters.contexts?.length > 0) ||
    (filters.spreads?.length > 0) ||
    (filters.decks?.length > 0) ||
    filters.timeframe !== 'all' ||
    filters.onlyReversals;

  // Scope change handlers
  const handleScopeSelect = useCallback((value) => {
    setHasUserSelectedScope(true);
    setAnalyticsScope(value);
  }, []);

  const handleCustomScopeChange = useCallback((key, value) => {
    setHasUserSelectedScope(true);
    setCustomScope((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Track previous filtersActive state for render-time updates
  const [prevFiltersActive, setPrevFiltersActive] = useState(filtersActive);

  // Auto-switch to filters scope when filters become active (render-time pattern)
  if (!hasUserSelectedScope && prevFiltersActive !== filtersActive) {
    setPrevFiltersActive(filtersActive);
    if (filtersActive && analyticsScope !== 'filters') {
      setAnalyticsScope('filters');
    }
    if (!filtersActive && analyticsScope === 'filters') {
      setAnalyticsScope('month');
    }
  }

  // Compute date windows
  const monthWindow = useMemo(() => getCurrentMonthWindow(), []);
  const timeframeWindow = useMemo(
    () => (filters.timeframe !== 'all' ? getTimeframeWindow(filters.timeframe) : null),
    [filters.timeframe]
  );
  const allTimeWindow = useMemo(() => getAllTimeWindow(entries), [entries]);
  const customWindow = useMemo(() => {
    if (analyticsScope !== 'custom') return null;
    const start = parseDateInput(customScope.start);
    const end = parseDateInput(customScope.end);
    if (!start || !end) return null;
    const normalizedEnd = end.getTime() < start.getTime() ? start : end;
    return { start, end: normalizedEnd };
  }, [analyticsScope, customScope]);

  // Compute scope error as derived state (avoids setState in useEffect)
  const computedScopeError = useMemo(() => {
    if (analyticsScope !== 'custom') {
      return '';
    }
    const start = parseDateInput(customScope.start);
    const end = parseDateInput(customScope.end);
    if (start && end) {
      return '';
    } else if (customScope.start || customScope.end) {
      return 'Select a valid start and end date for custom scope.';
    }
    return '';
  }, [analyticsScope, customScope]);

  // Update scopeError state when computed value changes (render-time pattern)
  if (scopeError !== computedScopeError) {
    setScopeError(computedScopeError);
  }

  // Determine active scope window
  const scopeWindow = useMemo(() => {
    switch (analyticsScope) {
      case 'month':
        return monthWindow;
      case 'filters':
        return timeframeWindow;
      case 'custom':
        return customWindow;
      case 'all':
        return allTimeWindow;
      default:
        return null;
    }
  }, [analyticsScope, monthWindow, timeframeWindow, customWindow, allTimeWindow]);

  // Compute scoped entries for stats
  const scopedStatsEntries = useMemo(() => {
    if (analyticsScope === 'filters' && filtersActive) {
      return filteredEntries;
    }
    return filterEntriesToWindow(entries, scopeWindow);
  }, [analyticsScope, filtersActive, filteredEntries, entries, scopeWindow]);

  // Compute stats
  const scopeStats = useMemo(
    () => computeJournalStats(scopedStatsEntries) ?? EMPTY_STATS,
    [scopedStatsEntries]
  );
  const baselineStats = useMemo(
    () => computeJournalStats(entries) ?? EMPTY_STATS,
    [entries]
  );

  // Derived values
  const topContextScope = useMemo(() => getTopContext(scopeStats), [scopeStats]);
  const latestScopeEntryTs = useMemo(
    () => getLatestEntryTimestamp(scopedStatsEntries),
    [scopedStatsEntries]
  );
  const latestAllEntryTs = useMemo(
    () => getLatestEntryTimestamp(entries),
    [entries]
  );

  // Scope label for display
  const scopeLabel = useMemo(() => {
    if (analyticsScope === 'custom') {
      return customWindow ? `Custom · ${formatWindowLabel(customWindow)}` : 'Custom range';
    }
    if (analyticsScope === 'filters') {
      return filtersActive ? 'Current filters' : 'All entries';
    }
    if (analyticsScope === 'month') return 'This month';
    if (analyticsScope === 'all') return 'All time';
    return 'All time';
  }, [analyticsScope, customWindow, filtersActive]);

  // Hero entry - latest entry matching current scope
  const heroEntry = useMemo(() => {
    if (!Array.isArray(scopedStatsEntries) || scopedStatsEntries.length === 0) return null;
    const sorted = [...scopedStatsEntries].sort((a, b) => {
      const aTs = getTimestamp(a) || 0;
      const bTs = getTimestamp(b) || 0;
      return bTs - aTs;
    });
    return sorted[0] || null;
  }, [scopedStatsEntries]);

  // Track previous hero entry for render-time reset
  const [prevHeroKey, setPrevHeroKey] = useState(() =>
    heroEntry ? `${heroEntry.id}-${heroEntry.sessionSeed}` : null
  );
  const currentHeroKey = heroEntry ? `${heroEntry.id}-${heroEntry.sessionSeed}` : null;

  // Reset expanded card when hero entry changes (render-time pattern)
  if (prevHeroKey !== currentHeroKey) {
    setPrevHeroKey(currentHeroKey);
    setExpandedCardIndex(null);
  }

  // Hero cards for display
  const heroCardLimit = isSmallSummary ? 1 : 3;
  const heroCards = useMemo(() => {
    if (!heroEntry || !Array.isArray(heroEntry.cards)) return [];
    return heroEntry.cards.slice(0, heroCardLimit).map((card, index) => ({
      id: `${card.name || 'card'}-${index}`,
      name: card.name || 'Card',
      position: card.position || `Card ${index + 1}`,
      orientation: card.orientation || (card.isReversed ? 'Reversed' : 'Upright'),
      image: getCardImage(card)
    }));
  }, [heroEntry, heroCardLimit]);

  const heroDateLabel = heroEntry ? formatSummaryDate(getTimestamp(heroEntry)) : null;

  // Summary statistics
  const scopeEntryCount = scopedStatsEntries.length;
  const overallTotalEntries = entries.length;
  const isFilteredEmpty = filtersActive && filteredEntries.length === 0;

  const entrySecondaryLabel = `${scopeLabel}${scopeEntryCount !== overallTotalEntries ? ` · ${overallTotalEntries} total` : ''}`;
  const primaryReversalRate = scopeStats?.reversalRate ?? 0;
  const reversalSecondary = baselineStats?.totalCards
    ? `Journal avg ${baselineStats?.reversalRate ?? 0}%`
    : 'Log cards to see insights';

  const topContextLabel = topContextScope
    ? formatContextName(topContextScope.name)
    : scopeEntryCount > 0
      ? 'No context yet'
      : filtersActive
        ? 'No match'
        : 'No entries';
  const topContextSecondary = topContextScope
    ? scopeLabel
    : entries.length > 0
      ? `${overallTotalEntries} entries`
      : 'Log a reading';

  const summaryLastEntryLabel = isFilteredEmpty
    ? 'No matches'
    : formatSummaryDate(latestScopeEntryTs || latestAllEntryTs);
  const summaryLastEntrySecondary = scopeLabel;

  // Summary card data for constellation display
  const summaryCardData = useMemo(() => [
    {
      id: 'entries',
      label: 'Entries logged',
      value: scopeEntryCount,
      hint: entrySecondaryLabel
    },
    {
      id: 'reversal',
      label: 'Reversal rate',
      value: `${primaryReversalRate}%`,
      hint: reversalSecondary
    },
    {
      id: 'context',
      label: 'Top context',
      value: topContextLabel,
      hint: topContextSecondary
    },
    {
      id: 'last-entry',
      label: 'Last entry',
      value: summaryLastEntryLabel,
      hint: summaryLastEntrySecondary
    }
  ], [scopeEntryCount, entrySecondaryLabel, primaryReversalRate, reversalSecondary, topContextLabel, topContextSecondary, summaryLastEntryLabel, summaryLastEntrySecondary]);

  // Stat nodes with positions for constellation
  const statNodes = useMemo(() => {
    let fallbackIndex = 0;
    return summaryCardData.map((card) => {
      const fallback = CARD_NODE_FALLBACK[fallbackIndex] || { x: 50, y: 50 + fallbackIndex * 8 };
      const pos = CARD_NODE_POSITIONS[card.id] || fallback;
      fallbackIndex += CARD_NODE_POSITIONS[card.id] ? 0 : 1;
      return {
        ...card,
        x: pos.x,
        y: pos.y,
        isHero: card.id === 'entries'
      };
    });
  }, [summaryCardData]);

  const statNodeMap = useMemo(
    () => Object.fromEntries(statNodes.map((node) => [node.id, node])),
    [statNodes]
  );

  return {
    // Scope state
    analyticsScope,
    setAnalyticsScope: handleScopeSelect,
    customScope,
    setCustomScope: handleCustomScopeChange,
    hasUserSelectedScope,
    scopeError,

    // Windows
    scopeWindow,
    monthWindow,

    // Entries
    scopedStatsEntries,

    // Stats
    scopeStats,
    baselineStats,
    topContextScope,

    // Timestamps
    latestScopeEntryTs,
    latestAllEntryTs,

    // Labels
    scopeLabel,
    scopeEntryCount,
    overallTotalEntries,

    // Hero entry
    heroEntry,
    heroCards,
    heroDateLabel,
    expandedCardIndex,
    setExpandedCardIndex,

    // Summary data
    summaryCardData,
    statNodes,
    statNodeMap,

    // Flags
    isFilteredEmpty,
    journeyFiltersActive: analyticsScope === 'filters' && filtersActive
  };
}

export default useJournalAnalytics;
