/**
 * useJourneyData - Unified data hook for Reading Journey dashboard.
 *
 * Merges data from:
 * - Server: D1 card_appearances via useArchetypeJourney (unfiltered views)
 * - Client: computeJournalStats from entries (filtered views)
 *
 * CLIENT-ONLY: Uses localStorage, do not call during SSR.
 * Wrap usage in a client boundary or guard with `typeof window !== 'undefined'`.
 *
 * Design spec: docs/unified-journey-design.md
 */

import { useMemo, useCallback } from 'react';
import { useArchetypeJourney } from './useArchetypeJourney';
import {
  computeJournalStats,
  computePreferenceDrift,
  computeMajorArcanaMapFromEntries,
  computeStreakFromEntries,
  computeBadgesFromEntries,
  generateJourneyStory,
  computeCoachSuggestionWithEmbeddings,
} from '../lib/journalInsights';
import {
  buildSeasonKey,
  getCachedNarrative,
  setCachedNarrative,
} from '../lib/safeStorage';

// Empty stats fallback (computeJournalStats returns null for empty entries)
const EMPTY_STATS = {
  totalReadings: 0,
  totalCards: 0,
  reversalRate: 0,
  frequentCards: [],
  contextBreakdown: [],
  monthlyCadence: [],
  recentThemes: [],
};

// Empty Archetype data fallback
const EMPTY_ARCHETYPE = {
  topCards: [],
  badges: [],
  majorArcanaFrequency: {},
  trends: [],
  currentStreak: 0,
  isLoading: false,
  hasBackfilled: false,
  cadenceData: [],
};

/**
 * Generate narrative text for the season summary.
 * Uses the effective season window, not current date.
 *
 * @param {Object} options
 * @param {Object} options.topCard - Top card { name, count }
 * @param {Object} options.topContext - Top context { name, count }
 * @param {string} options.topTheme - Top theme string
 * @param {Array} options.badges - Badges array
 * @param {Object} options.seasonWindow - { start: Date, end: Date }
 * @param {string} options.locale - Locale for date formatting (e.g., 'en-US', 'fr-FR')
 * @param {string} options.timezone - IANA timezone (e.g., 'America/New_York')
 * @returns {string} Narrative text
 */
function generateSeasonNarrative({
  topCard,
  topContext,
  topTheme,
  badges,
  seasonWindow,
  locale = 'en-US',
  timezone,
}) {
  // Format the time period from the data window with explicit locale/timezone
  const formatPeriod = (window) => {
    const formatOptions = {
      month: 'long',
      ...(timezone && { timeZone: timezone }),
    };

    const start = window.start;
    const end = window.end;

    // Use explicit locale to avoid inconsistent formatting across environments
    const startMonth = start.toLocaleString(locale, formatOptions);
    const endMonth = end.toLocaleString(locale, formatOptions);
    const startYear = start.toLocaleString(locale, {
      year: 'numeric',
      ...(timezone && { timeZone: timezone }),
    });
    const endYear = end.toLocaleString(locale, {
      year: 'numeric',
      ...(timezone && { timeZone: timezone }),
    });

    // Same month (compare formatted strings to handle timezone edge cases)
    if (startMonth === endMonth && startYear === endYear) {
      return startMonth;
    }
    // Same year, different months
    if (startYear === endYear) {
      return `${startMonth}–${endMonth}`;
    }
    // Different years
    return `${startMonth} ${startYear}–${endMonth} ${endYear}`;
  };

  const period = formatPeriod(seasonWindow);
  const hasBadge = badges?.some(b => b.card_name === topCard?.name);

  let narrative = `Your ${period} `;

  if (topTheme) {
    narrative += `has been shaped by themes of ${topTheme.toLowerCase()}. `;
  }

  if (topCard) {
    narrative += `${topCard.name} appeared ${topCard.count}× — your most persistent messenger`;
    if (hasBadge) {
      narrative += `, earning you a streak badge`;
    }
    narrative += `. `;
  }

  if (topContext) {
    narrative += `${topContext.name} readings dominated, signaling where your energy flows.`;
  }

  return narrative;
}

/**
 * Compute coach suggestion with priority ordering.
 *
 * Badge ordering: badges array is expected to be pre-sorted by earned_at DESC
 * (most recent first). The hook sorts badges before passing to this function.
 *
 * Priority order (after considering recent "Gentle Next Steps"):
 * 1. Preference drift (user exploring new contexts)
 * 2. Most recent badge card (if matches top card)
 * 3. Top theme from recent readings
 * 4. Top context from readings
 * 5. Default generic prompt
 */
function computeEnhancedCoachSuggestion({
  topCard,
  topContext,
  topTheme,
  badges, // Pre-sorted: most recent first
  preferenceDrift,
}) {
  const contextQuestionMap = {
    love: 'What do I need to understand about my relationships right now?',
    career: 'What do I need to understand about my work path right now?',
    self: 'What do I need to understand about myself right now?',
    wellbeing: 'What do I need to understand about my wellbeing right now?',
    spiritual: 'What do I need to understand about my spiritual path right now?',
    decision: 'What do I need to understand about this decision right now?',
  };

  // Priority 1: Drift detection (user exploring unexpected contexts)
  if (preferenceDrift?.hasDrift && preferenceDrift.driftContexts?.[0]) {
    const drift = preferenceDrift.driftContexts[0];
    const question = `What draws me toward ${drift.context} right now?`;
    return {
      source: 'drift',
      text: question,
      question,
      spread: 'threeCard',
    };
  }

  // Priority 2: Most recent badge card (badges[0] is most recent due to pre-sort)
  const recentBadgeCard = badges?.[0]?.card_name;
  if (recentBadgeCard && topCard?.name === recentBadgeCard) {
    const question = `What is ${topCard.name} trying to teach me?`;
    return {
      source: 'badge',
      text: question,
      question,
      spread: 'single',
    };
  }

  // Priority 3: Top theme
  if (topTheme) {
    const question = `How can I explore the theme of ${topTheme.toLowerCase()} more deeply?`;
    return {
      source: 'theme',
      text: question,
      question,
      spread: 'threeCard',
    };
  }

  // Priority 4: Top context
  if (topContext) {
    const contextKey = String(topContext.name || '').toLowerCase();
    const question =
      contextQuestionMap[contextKey]
      || `What do I need to understand about my ${contextKey || 'current'} situation right now?`;
    return {
      source: 'context',
      text: question,
      question,
      spread: 'threeCard',
    };
  }

  const question = 'What do I most need to understand right now?';
  return {
    source: 'default',
    text: question,
    question,
    spread: 'single',
  };
}

/**
 * Unified data hook for Reading Journey dashboard.
 *
 * @param {Object} options
 * @param {Array} options.entries - All journal entries (unfiltered)
 * @param {Array} options.filteredEntries - Filtered entries (when filters active)
 * @param {boolean} options.filtersActive - REQUIRED: Explicit flag: true when any filter is applied
 * @param {boolean} options.isAuthenticated - User auth state
 * @param {string} options.userId - User ID for Archetype data
 * @param {Array} options.focusAreas - User's stated focus areas from personalization/onboarding
 * @param {Object} options.seasonWindow - Optional explicit date range { start: Date; end: Date }
 * @param {string} options.locale - User locale for date formatting (default: 'en-US')
 * @param {string} options.timezone - User timezone (default: browser timezone)
 * @returns {Object} Unified journey data
 */
export function useJourneyData({
  entries,
  filteredEntries,
  filtersActive: filtersActiveProp,
  isAuthenticated,
  userId,
  focusAreas = [],
  seasonWindow,
  locale = 'en-US',
  timezone,
}) {
  // FAIL CLOSED: If filtersActive not explicitly provided, assume filters ARE active
  // This ensures we fall back to client-side data (safe) rather than D1 (possibly wrong)
  const filtersActive = useMemo(() => {
    // Explicit prop takes precedence
    if (typeof filtersActiveProp === 'boolean') {
      return filtersActiveProp;
    }

    // WARNING: No explicit prop provided - fail closed to client data
    if (import.meta.env.DEV) {
      console.warn(
        '[useJourneyData] filtersActive prop not provided. ' +
        'Defaulting to true (client-side data). ' +
        'Pass explicit filtersActive from filter state for accurate routing.'
      );
    }

    // Fail closed: assume filters are active when we can't determine
    return true;
  }, [filtersActiveProp]);

  // Determine if we should fetch server data
  // Gate the fetch to avoid wasted network calls and telemetry skew
  const shouldFetchServerData = isAuthenticated && !filtersActive && !seasonWindow;

  // Determine which entries to use for stats
  const activeEntries = filtersActive ? filteredEntries : entries;

  // Server-side data - ONLY fetch when we'll actually use it
  // Pass enabled flag to prevent unnecessary API calls
  const archetypeData = useArchetypeJourney(
    userId,
    shouldFetchServerData // Only fetch when auth'd AND unfiltered
  ) ?? EMPTY_ARCHETYPE;

  // Decide whether to use D1 server data or client-side computation
  // D1 data is only valid for unfiltered "current month" view
  const useServerData = useMemo(() => {
    return isAuthenticated &&
      !filtersActive &&
      !seasonWindow && // No custom window override
      archetypeData.topCards?.length > 0;
  }, [isAuthenticated, filtersActive, seasonWindow, archetypeData.topCards]);

  // Derive season window from data if not explicit
  const effectiveSeasonWindow = useMemo(() => {
    if (seasonWindow) return seasonWindow;

    // If filtered entries exist, derive window from their date range
    if (filtersActive && filteredEntries?.length) {
      const timestamps = filteredEntries
        .map(e => e.ts || (e.created_at ? e.created_at * 1000 : null))
        .filter(Boolean);
      if (timestamps.length) {
        return {
          start: new Date(Math.min(...timestamps)),
          end: new Date(Math.max(...timestamps)),
        };
      }
    }

    // When using server analytics (unfiltered, current month), keep window scoped to month
    if (useServerData) {
      const now = new Date();
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
    }

    // Otherwise derive window from the active entries range to avoid labeling all-time data as current month
    const rangeSource = activeEntries?.length ? activeEntries : entries;
    if (rangeSource?.length) {
      const timestamps = rangeSource
        .map(e => e.ts || (e.created_at ? e.created_at * 1000 : null))
        .filter(Boolean);
      if (timestamps.length) {
        return {
          start: new Date(Math.min(...timestamps)),
          end: new Date(Math.max(...timestamps)),
        };
      }
    }

    // Fallback to current calendar month when no data
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }, [seasonWindow, filtersActive, filteredEntries, useServerData, activeEntries, entries]);

  // Helper to filter entries to a date range
  const filterEntriesToWindow = (entriesToFilter, window) => {
    if (!entriesToFilter?.length || !window) return entriesToFilter;
    const windowStart = window.start.getTime();
    const windowEnd = window.end.getTime() + (24 * 60 * 60 * 1000); // Include end date

    return entriesToFilter.filter(entry => {
      const ts = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
      if (!ts) return false;
      return ts >= windowStart && ts <= windowEnd;
    });
  };

  // When using D1 server data, scope client-side stats to the same time window
  // to avoid mixing current-month D1 data with all-time client stats
  const scopedEntries = useMemo(() => {
    // If custom seasonWindow is provided, filter entries to that window
    // This fixes the bug where seasonWindow was ignored
    if (seasonWindow) {
      return filterEntriesToWindow(activeEntries, seasonWindow);
    }

    // If filters are active, use activeEntries directly (already filtered)
    if (filtersActive) {
      return activeEntries;
    }

    // When using D1 server data, filter entries to current month
    // so context/themes match the D1 card frequency time scope
    if (useServerData && entries?.length) {
      return filterEntriesToWindow(entries, effectiveSeasonWindow);
    }

    return activeEntries;
  }, [filtersActive, seasonWindow, useServerData, entries, activeEntries, effectiveSeasonWindow]);

  // Export entries: for exports, use the full journal when unfiltered to preserve
  // the previous behavior. Users expect "Export Journal" to export everything
  // when no filters are active, not just the current month's stats window.
  const exportEntries = useMemo(() => {
    // Determine base entries (respects filters if active)
    const baseEntries = filtersActive ? filteredEntries : entries;

    // If custom seasonWindow is provided, filter to that window
    // This applies on top of any active filters
    if (seasonWindow) {
      return filterEntriesToWindow(baseEntries, seasonWindow);
    }

    // No custom window: return baseEntries as-is
    // - If filters active: filtered entries
    // - If unfiltered: full journal (not month-scoped like scopedEntries)
    return baseEntries;
  }, [filtersActive, filteredEntries, seasonWindow, entries]);

  // Client-side stats with null guard
  // Uses scopedEntries to match the time window of D1 data when applicable
  const insightsStats = useMemo(() => {
    const stats = computeJournalStats(scopedEntries);
    return stats ?? EMPTY_STATS;
  }, [scopedEntries]);

  // Preference drift - computed on SCOPED entries to match the time window
  // Compares user's stated focus areas with actual reading contexts
  const preferenceDrift = useMemo(() => {
    if (!scopedEntries?.length) return null;
    // Pass focusAreas to enable drift detection
    // When focusAreas is empty, computePreferenceDrift returns null
    return computePreferenceDrift(scopedEntries, focusAreas);
  }, [scopedEntries, focusAreas]);

  // Badges - use server data when unfiltered, otherwise compute from entries
  // Note: Client-side badge computation is a subset (only cards in scoped entries)
  const sortedBadges = useMemo(() => {
    if (useServerData) {
      // Unfiltered: use D1 badges, sorted by earned_at DESC
      const badges = archetypeData.badges || [];
      return [...badges].sort((a, b) => (b.earned_at || 0) - (a.earned_at || 0));
    }

    // Filtered/scoped: compute "virtual" badges from scoped entries
    // These are cards that appear 3+ times in the current view
    // Note: These aren't persisted badges, just indicators of frequency
    return computeBadgesFromEntries(scopedEntries);
  }, [useServerData, archetypeData.badges, scopedEntries]);

  // Major Arcana heatmap - must match the current view (scoped to time window)
  const majorArcanaMap = useMemo(() => {
    if (useServerData) {
      // Unfiltered: use D1 data - convert object to array format
      const freq = archetypeData.majorArcanaFrequency || {};
      return Object.entries(freq).map(([name, count]) => ({
        cardNumber: null, // Would need lookup
        name,
        count: typeof count === 'number' ? count : 0,
      }));
    }

    // Filtered/scoped: compute from scoped entries
    return computeMajorArcanaMapFromEntries(scopedEntries);
  }, [useServerData, archetypeData.majorArcanaFrequency, scopedEntries]);

  // Current streak - must reflect the data view
  const currentStreak = useMemo(() => {
    if (useServerData) {
      // Unfiltered: use D1 streak
      return archetypeData.currentStreak || 0;
    }

    // Filtered/scoped: compute streak from scoped entries (consecutive days with readings)
    return computeStreakFromEntries(scopedEntries);
  }, [useServerData, archetypeData.currentStreak, scopedEntries]);

  // Normalize D1 card data to unified shape
  const normalizeD1Card = useCallback((d1Card, badges) => ({
    name: d1Card.card_name,
    count: d1Card.count,
    reversedCount: 0, // D1 doesn't track reversals
    trend: d1Card.trend || 'stable',
    hasBadge: badges?.some(b => b.card_name === d1Card.card_name) ?? false,
  }), []);

  // Normalize client-side card data to unified shape
  const normalizeClientCard = useCallback((clientCard, badges) => ({
    name: clientCard.name,
    count: clientCard.count,
    reversedCount: clientCard.reversed || 0,
    trend: 'stable', // Client-side doesn't compute trends
    hasBadge: badges?.some(b => b.card_name === clientCard.name) ?? false,
  }), []);

  // Card frequency - respects filter/window selection
  const cardFrequency = useMemo(() => {
    // When filters active or custom window, ALWAYS use client-side data
    // to ensure consistency with the filtered journal view
    if (!useServerData) {
      return (insightsStats.frequentCards || []).map(c =>
        normalizeClientCard(c, sortedBadges)
      );
    }

    // Unfiltered view: use D1 data, enrich with client reversals
    return archetypeData.topCards.map(d1Card => {
      const normalized = normalizeD1Card(d1Card, sortedBadges);

      // Attach trend data for sparklines
      if (archetypeData.getCardTrends) {
        normalized.trendData = archetypeData.getCardTrends(d1Card.card_name);
      }

      // Enrich with client-side reversal data if available
      const clientMatch = insightsStats.frequentCards?.find(
        c => c.name === normalized.name
      );
      if (clientMatch) {
        normalized.reversedCount = clientMatch.reversed || 0;
      }
      return normalized;
    });
  }, [
    useServerData,
    archetypeData,
    sortedBadges,
    insightsStats.frequentCards,
    normalizeD1Card,
    normalizeClientCard,
  ]);

  // Cadence data - respects filter/window selection
  const cadence = useMemo(() => {
    // When filters active, use client-side cadence
    if (!useServerData) {
      return insightsStats.monthlyCadence || [];
    }

    // Unfiltered: prefer server data if richer
    const archetypeCadence = archetypeData.cadenceData || [];
    const insightsCadence = insightsStats.monthlyCadence || [];

    if (archetypeCadence.length >= insightsCadence.length) {
      return archetypeCadence;
    }
    return insightsCadence;
  }, [useServerData, archetypeData.cadenceData, insightsStats.monthlyCadence]);

  // Build cache key for narrative
  const cacheKey = useMemo(() => {
    if (!userId) return null;
    return buildSeasonKey({
      userId,
      filtersActive,
      filteredEntries: activeEntries,
      seasonWindow: effectiveSeasonWindow,
      locale,
      timezone,
    });
  }, [userId, filtersActive, activeEntries, effectiveSeasonWindow, locale, timezone]);

  const topContext = useMemo(() => {
    if (!insightsStats.contextBreakdown?.length) return undefined;
    // Clone before sorting to avoid mutating the memoized array
    return [...insightsStats.contextBreakdown].sort((a, b) => b.count - a.count)[0];
  }, [insightsStats.contextBreakdown]);

  // Generate season narrative using effective window
  const seasonNarrative = useMemo(() => {
    const topCard = cardFrequency[0];
    const topTheme = insightsStats.recentThemes?.[0];

    if (!topCard) return null;

    // Try cache first (only for authenticated, unfiltered views)
    if (cacheKey && !filtersActive) {
      const cached = getCachedNarrative(userId, cacheKey);
      if (cached) return cached;
    }

    const narrative = generateSeasonNarrative({
      topCard,
      topContext,
      topTheme,
      badges: sortedBadges,
      totalReadings: insightsStats.totalReadings,
      seasonWindow: effectiveSeasonWindow,
      locale,
      timezone,
    });

    // Cache for authenticated, unfiltered views
    if (cacheKey && !filtersActive && narrative) {
      setCachedNarrative(userId, cacheKey, narrative);
    }

    return narrative;
  }, [
    cardFrequency,
    topContext,
    insightsStats.recentThemes,
    insightsStats.totalReadings,
    sortedBadges,
    effectiveSeasonWindow,
    locale,
    timezone,
    cacheKey,
    filtersActive,
    userId,
  ]);

  // Journey story prose - returns null when insufficient data
  // Uses scopedEntries to match the time window of other stats
  // UI should hide the "Journey Story" section when this is null
  const journeyStory = useMemo(() => {
    if (!scopedEntries?.length || scopedEntries.length < 3) return null;
    return generateJourneyStory(scopedEntries, { precomputedStats: insightsStats });
  }, [scopedEntries, insightsStats]);

  // Enhanced coach suggestion - uses pre-computed AI embeddings when available,
  // falls back to heuristic text matching for entries without extraction data
  const nextStepsCoachSuggestion = useMemo(() => {
    return computeCoachSuggestionWithEmbeddings(activeEntries, { maxEntries: 5 });
  }, [activeEntries]);

  const coachSuggestion = useMemo(() => {
    if (nextStepsCoachSuggestion) return nextStepsCoachSuggestion;
    const topCard = cardFrequency[0];
    const topTheme = insightsStats.recentThemes?.[0];

    return computeEnhancedCoachSuggestion({
      topCard,
      topContext,
      topTheme,
      badges: sortedBadges,
      preferenceDrift,
    });
  }, [
    nextStepsCoachSuggestion,
    cardFrequency,
    topContext,
    insightsStats.recentThemes,
    sortedBadges,
    preferenceDrift,
  ]);

  // Backfill state with loading guard.
  // Intentionally *not* wrapped in useMemo: React Compiler lint requires manual memoization
  // to be perfectly preservable, and this boolean is cheap to compute.
  const needsBackfill = (() => {
    // Don't show backfill prompt for filtered views - backfill is for D1 server data
    // which isn't used when filters are active. Filtered views use client-side stats.
    if (filtersActive) return false;
    // Don't show backfill prompt while still loading
    if (archetypeData.isLoading) return false;
    // Only authenticated users can backfill
    if (!isAuthenticated) return false;
    // Respect user's analytics opt-out preference (403 from API)
    if (archetypeData.isDisabled) return false;

    // Prefer explicit server diagnostic when available.
    const explicitNeedsBackfill = archetypeData?.stats?.needsBackfill;
    if (typeof explicitNeedsBackfill === 'boolean') {
      return explicitNeedsBackfill;
    }

    // Fallback heuristic: if we have entries but archetype data isn't populated.
    return !archetypeData.hasBackfilled && entries?.length > 0;
  })();

  // Analytics disabled state (user opted out)
  const isAnalyticsDisabled = archetypeData.isDisabled;

  return {
    // Card data - all computed to respect filters
    cardFrequency,
    badges: sortedBadges,
    majorArcanaMap,

    // Pattern data
    contextBreakdown: insightsStats.contextBreakdown || [],
    themes: insightsStats.recentThemes || [],
    preferenceDrift,
    cadence,

    // Stats - all computed to respect filters
    totalReadings: insightsStats.totalReadings,
    totalCards: insightsStats.totalCards,
    reversalRate: insightsStats.reversalRate,
    currentStreak,

    // Narrative
    seasonNarrative,
    journeyStory, // null when < 3 entries; UI should hide section
    coachSuggestion,

    // Time window
    seasonWindow: effectiveSeasonWindow,
    filtersActive,

    // State
    isLoading: archetypeData.isLoading && shouldFetchServerData,
    hasBackfilled: archetypeData.hasBackfilled,
    needsBackfill,
    isAnalyticsDisabled,
    // isEmpty: true when user has NO entries at all (unfiltered)
    isEmpty: !entries?.length,
    // isFilteredEmpty: true when filters are active AND yield zero matches
    // (but user has unfiltered entries)
    isFilteredEmpty: filtersActive && !activeEntries?.length && entries?.length > 0,

    // Backfill actions (from archetype hook)
    isBackfilling: archetypeData.isBackfilling,
    backfillResult: archetypeData.backfillResult,
    handleBackfill: archetypeData.handleBackfill,

    // Data source indicator (for debugging/testing)
    _dataSource: useServerData ? 'server' : 'client',

    // Scoped entries for stats (matches the displayed stats time window)
    // Use this for stats consistency - entries match the D1 card frequency scope
    scopedEntries,

    // Export entries - preserves old behavior: full journal when unfiltered,
    // filtered entries when filters are active. Use this for PDF/CSV/Markdown exports.
    exportEntries,
  };
}

export default useJourneyData;
