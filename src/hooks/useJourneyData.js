/**
 * useJourneyData - Unified data hook for Reading Journey dashboard.
 *
 * Computes displayed statistics from the complete journal and selected scope.
 * Server analytics supply backfill diagnostics and the tracking preference.
 *
 * CLIENT-ONLY: Uses localStorage, do not call during SSR.
 * Wrap usage in a client boundary or guard with `typeof window !== 'undefined'`.
 *
 * Design spec: docs/unified-journey-design.md
 */

import { useMemo } from 'react';
import { useArchetypeJourney } from './useArchetypeJourney';
import { useLocalCalendarDate } from './useLocalCalendarDate';
import {
  computeJournalStats,
  computePreferenceDrift,
  computeMajorArcanaMapFromEntries,
  computeStreakFromEntries,
  computeBadgesFromEntries,
  generateJourneyStory,
  computeCoachSuggestionWithEmbeddings,
  buildSourceDetailFromSignals,
  formatContextName,
  getCoachSourceLabel,
  COACH_SOURCE_PRIORITY,
} from '../lib/journalInsights';
import { buildThemeQuestion } from '../lib/themeText';
import { filterEntriesToWindow, getAllTimeWindow, getCurrentMonthWindow } from '../lib/journal/utils';

// Empty stats fallback (computeJournalStats returns null for empty entries)
const EMPTY_STATS = {
  totalReadings: 0,
  totalCards: 0,
  reversalRate: 0,
  frequentCards: [],
  contextBreakdown: [],
  monthlyCadence: [],
  recentThemes: [],
  themeSignals: [],
  topTheme: null,
  reversalRateReliable: false,
  reversalRateSample: 0,
  cardFrequencyReliable: false,
  cardFrequencySample: 0,
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
 * @param {number} options.totalReadings - Readings in this scope
 * @param {Object} options.seasonWindow - { start: Date, end: Date }
 * @param {string} options.locale - Locale for date formatting (e.g., 'en-US', 'fr-FR')
 * @param {string} options.timezone - IANA timezone (e.g., 'America/New_York')
 * @returns {string} Narrative text
 */
function generateSeasonNarrative({
  topCard,
  topContext,
  topTheme,
  totalReadings,
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
  const parts = [`In your ${period} readings, ${topCard.name} appeared ${topCard.count}x.`];
  if (topTheme) parts.push(`${totalReadings > 1 ? 'Recurring theme' : 'Theme'}: ${topTheme}.`);
  if (topContext) {
    parts.push(`${formatContextName(topContext.name)} was the focus of ${topContext.count} reading${topContext.count === 1 ? '' : 's'}.`);
  }
  return parts.join(' ');
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
const THEME_SOURCE_LABELS = {
  archetype: 'Archetype',
  suit: 'Suit',
  element: 'Element',
  reversal: 'Reversal',
  context: 'Context',
};

function buildThemeSignalDetail(themeSignal, totalReadings) {
  if (!themeSignal) return '';
  const sourceLabel = THEME_SOURCE_LABELS[themeSignal.type] || 'Theme';
  const count = Number.isFinite(themeSignal.count) ? themeSignal.count : null;
  const readings = Number.isFinite(totalReadings) ? totalReadings : null;
  const ratio = readings && count ? Math.round((count / readings) * 100) : null;
  const confidence = readings && count ? `${count} of ${readings} readings (${ratio}%)` : '';
  return [themeSignal.label, sourceLabel, confidence].filter(Boolean).join(' · ');
}

function computeEnhancedCoachSuggestions({
  topCard,
  topContext,
  topTheme,
  topThemeSignal,
  badges, // Pre-sorted: most recent first
  preferenceDrift,
  currentStreak,
  majorArcanaMap,
  totalReadings,
}) {
  const contextQuestionMap = {
    love: 'What do I need to understand about my relationships right now?',
    relationship: 'What do I need to understand about my relationships right now?',
    relationships: 'What do I need to understand about my relationships right now?',
    career: 'What do I need to understand about my work path right now?',
    self: 'What do I need to understand about myself right now?',
    wellbeing: 'What do I need to understand about my wellbeing right now?',
    spiritual: 'What do I need to understand about my spiritual path right now?',
    decision: 'What do I need to understand about this decision right now?',
  };

  const buildSuggestion = ({ source, text, question, spread, signalsUsed = [], ...rest }) => ({
    source,
    text,
    question,
    spread,
    sourceLabel: getCoachSourceLabel(source),
    sourceDetail: buildSourceDetailFromSignals(signalsUsed),
    signalsUsed,
    priority: COACH_SOURCE_PRIORITY[source] ?? 0,
    ...rest,
  });

  const suggestions = [];

  if (preferenceDrift?.hasDrift && preferenceDrift.driftContexts?.[0]) {
    const drift = preferenceDrift.driftContexts[0];
    const driftContextName = formatContextName(drift.context);
    // Skip low-quality signals like "general" context
    const isLowQualityContext = !drift.context || drift.context === 'general';
    if (!isLowQualityContext) {
      const question = `What's drawing me toward ${driftContextName.toLowerCase()} lately?`;
      const expectedLabels = Array.isArray(preferenceDrift.expectedContextLabels)
        ? preferenceDrift.expectedContextLabels
        : [];
      // Build user-friendly explanation
      const statusMessage = expectedLabels.length > 0
        ? `You set ${expectedLabels.join(' & ').toLowerCase()} as your focus, but you've been reading about ${driftContextName.toLowerCase()} (${drift.count} times). Worth exploring?`
        : `You've been reading about ${driftContextName.toLowerCase()} quite a bit (${drift.count} times). Something on your mind?`;
      suggestions.push(buildSuggestion({
        source: 'drift',
        journalFilter: { type: 'context', value: drift.context, label: driftContextName },
        text: question,
        question,
        spread: 'threeCard',
        statusMessage,
        signalsUsed: [{
          type: 'drift',
          label: getCoachSourceLabel('drift'),
          detail: `${driftContextName}: ${drift.count} readings`,
        }],
      }));
    }
  } else if (preferenceDrift?.hasEmerging && preferenceDrift.emergingContexts?.[0]) {
    const emerging = preferenceDrift.emergingContexts[0];
    const emergingContextName = formatContextName(emerging.context);
    // Skip low-quality signals like "general" context
    const isLowQualityContext = !emerging.context || emerging.context === 'general';
    if (!isLowQualityContext) {
      const question = `Is ${emergingContextName.toLowerCase()} becoming important to me?`;
      const statusMessage = `${emergingContextName} has come up ${emerging.count} time${emerging.count === 1 ? '' : 's'} recently — a pattern starting to form.`;
      suggestions.push(buildSuggestion({
        source: 'emergingDrift',
        journalFilter: { type: 'context', value: emerging.context, label: emergingContextName },
        text: question,
        question,
        spread: 'single',
        statusMessage,
        signalsUsed: [{
          type: 'emergingDrift',
          label: getCoachSourceLabel('emergingDrift'),
          detail: `${emergingContextName}: ${emerging.count} readings`,
        }],
      }));
    }
  }

  const recentBadgeCard = badges?.[0]?.card_name;
  if (recentBadgeCard && topCard?.name === recentBadgeCard) {
    const question = `What is ${topCard.name} trying to teach me?`;
    suggestions.push(buildSuggestion({
      source: 'badge',
      journalFilter: { type: 'card', value: topCard.name, label: topCard.name },
      text: question,
      question,
      spread: 'single',
      signalsUsed: [{
        type: 'badge',
        label: getCoachSourceLabel('badge'),
        detail: `${topCard.name} (${topCard.count}x)`,
      }],
    }));
  }

  if (topCard?.name && topCard.count >= 2) {
    const question = `What is ${topCard.name} asking me to notice?`;
    suggestions.push(buildSuggestion({
      source: 'topCard',
      journalFilter: { type: 'card', value: topCard.name, label: topCard.name },
      text: question,
      question,
      spread: 'single',
      signalsUsed: [{
        type: 'topCard',
        label: getCoachSourceLabel('topCard'),
        detail: `${topCard.name} (${topCard.count}x)`,
      }],
    }));
  }

  if (Array.isArray(majorArcanaMap) && majorArcanaMap.length > 0) {
    const topMajor = [...majorArcanaMap].sort((a, b) => b.count - a.count)[0];
    if (topMajor?.name && topMajor.count >= 2 && topMajor.name !== topCard?.name) {
      const question = `What is ${topMajor.name} asking me to notice?`;
      suggestions.push(buildSuggestion({
        source: 'majorArcana',
        journalFilter: { type: 'card', value: topMajor.name, label: topMajor.name },
        text: question,
        question,
        spread: 'single',
        signalsUsed: [{
          type: 'majorArcana',
          label: getCoachSourceLabel('majorArcana'),
          detail: `${topMajor.name} (${topMajor.count}x)`,
        }],
      }));
    }
  }

  if (topTheme) {
    const themeQuestion = buildThemeQuestion(topTheme);
    if (themeQuestion) {
      suggestions.push(buildSuggestion({
        source: 'theme',
        journalFilter: { type: topThemeSignal?.type === 'context' ? 'context' : 'theme', value: topTheme, label: topTheme },
        text: themeQuestion,
        question: themeQuestion,
        spread: 'threeCard',
        theme: topTheme,
        signalsUsed: [{
          type: 'theme',
          label: getCoachSourceLabel('theme'),
          detail: buildThemeSignalDetail(topThemeSignal, totalReadings) || topTheme,
        }],
      }));
    }
  }

  if (currentStreak >= 2) {
    const question = 'What needs a one-card check-in today?';
    suggestions.push(buildSuggestion({
      source: 'streak',
      text: question,
      question,
      spread: 'single',
      signalsUsed: [{
        type: 'streak',
        label: getCoachSourceLabel('streak'),
        detail: `${currentStreak}-day streak`,
      }],
    }));
  }

  if (topContext) {
    const contextKey = String(topContext.name || '').toLowerCase();
    const question =
      contextQuestionMap[contextKey]
      || `What do I need to understand about my ${contextKey || 'current'} situation right now?`;
    suggestions.push(buildSuggestion({
      source: 'context',
      journalFilter: { type: 'context', value: contextKey, label: formatContextName(contextKey) },
      text: question,
      question,
      spread: 'threeCard',
      signalsUsed: [{
        type: 'context',
        label: getCoachSourceLabel('context'),
        detail: `${formatContextName(contextKey)} (${topContext.count})`,
      }],
    }));
  }

  const question = 'What do I most need to understand right now?';
  suggestions.push(buildSuggestion({
    source: 'default',
    text: question,
    question,
    spread: 'single',
  }));

  return suggestions;
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
  canUseCloudJournal = false,
  userId,
  focusAreas = [],
  seasonWindow,
  scopeEntries,
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

  const calendarDate = useLocalCalendarDate();
  const shouldFetchAnalytics = Boolean(isAuthenticated && canUseCloudJournal && userId);
  const archetypeData = useArchetypeJourney(userId, shouldFetchAnalytics) ?? EMPTY_ARCHETYPE;
  const activeEntries = filtersActive ? filteredEntries : entries;

  // The Journal supplies its resolved scope so counts, summaries and exports
  // share exactly the same readings. Standalone callers can supply a window.
  const scopedEntries = useMemo(() => Array.isArray(scopeEntries)
    ? scopeEntries
    : filterEntriesToWindow(activeEntries, seasonWindow), [scopeEntries, activeEntries, seasonWindow]);

  const effectiveSeasonWindow = useMemo(() => seasonWindow
    || getAllTimeWindow(scopedEntries)
    || getCurrentMonthWindow(calendarDate), [seasonWindow, scopedEntries, calendarDate]);
  const seasonTimezone = timezone;

  // Export entries: for exports, use the full journal when unfiltered to preserve
  // the previous behavior. Users expect "Export Journal" to export everything
  // when no filters are active, not just the current month's stats window.
  const exportEntries = useMemo(() => {
    // When filters are active, export the filtered/scoped entries
    if (filtersActive) {
      return scopedEntries || [];
    }
    // When unfiltered, export the full journal (not just current month scope)
    return entries || [];
  }, [filtersActive, scopedEntries, entries]);

  // Every displayed statistic is derived from the selected journal entries.
  const insightsStats = useMemo(() => {
    const stats = computeJournalStats(scopedEntries, { dateWindow: effectiveSeasonWindow });
    return stats ?? EMPTY_STATS;
  }, [scopedEntries, effectiveSeasonWindow]);

  // Preference drift - computed on SCOPED entries to match the time window
  // Compares user's stated focus areas with actual reading contexts
  const preferenceDrift = useMemo(() => {
    if (!scopedEntries?.length) return null;
    // Pass focusAreas to enable drift detection
    // When focusAreas is empty, computePreferenceDrift returns null
    return computePreferenceDrift(scopedEntries, focusAreas);
  }, [scopedEntries, focusAreas]);

  const sortedBadges = useMemo(() => computeBadgesFromEntries(scopedEntries), [scopedEntries]);
  const majorArcanaMap = useMemo(() => computeMajorArcanaMapFromEntries(scopedEntries), [scopedEntries]);

  // A daily practice streak spans the journal, including yesterday when the
  // selected month has just begun. Scope filters never erase reading history.
  const currentStreak = useMemo(() => computeStreakFromEntries(entries, calendarDate), [entries, calendarDate]);

  const cardFrequency = useMemo(() => (insightsStats.frequentCards || []).map(card => ({
    name: card.name,
    count: card.count,
    reversedCount: card.reversed || 0,
    trend: 'stable',
    hasBadge: sortedBadges.some(badge => badge.card_name === card.name),
  })), [insightsStats.frequentCards, sortedBadges]);
  const cadence = insightsStats.monthlyCadence || [];

  const topContext = useMemo(() => {
    if (!insightsStats.contextBreakdown?.length) return undefined;
    // Clone before sorting to avoid mutating the memoized array
    return [...insightsStats.contextBreakdown].sort((a, b) => b.count - a.count)[0];
  }, [insightsStats.contextBreakdown]);

  // This is a cheap deterministic template. Derive it from current inputs;
  // persistent, date-only caching can outlive saves, edits and account changes.
  const seasonNarrative = useMemo(() => {
    const topCard = cardFrequency[0];
    if (!topCard) return null;
    return generateSeasonNarrative({
      topCard,
      topContext,
      topTheme: insightsStats.topTheme,
      totalReadings: insightsStats.totalReadings,
      seasonWindow: effectiveSeasonWindow,
      locale,
      timezone: seasonTimezone,
    });
  }, [cardFrequency, topContext, insightsStats.topTheme, insightsStats.totalReadings,
    effectiveSeasonWindow, locale, seasonTimezone]);

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
    return computeCoachSuggestionWithEmbeddings(scopedEntries, { maxEntries: 5 });
  }, [scopedEntries]);

  const enhancedCoachSuggestions = useMemo(() => {
    const topCard = cardFrequency[0];
    const topThemeSignal = insightsStats.themeSignals?.[0] || null;
    const topTheme = topThemeSignal?.label || insightsStats.topTheme || insightsStats.recentThemes?.[0];

    return computeEnhancedCoachSuggestions({
      topCard,
      topContext,
      topTheme,
      topThemeSignal,
      badges: sortedBadges,
      preferenceDrift,
      currentStreak,
      majorArcanaMap,
      totalReadings: insightsStats.totalReadings,
    });
  }, [
    cardFrequency,
    topContext,
    insightsStats.themeSignals,
    insightsStats.topTheme,
    insightsStats.recentThemes,
    sortedBadges,
    preferenceDrift,
    currentStreak,
    majorArcanaMap,
    insightsStats.totalReadings,
  ]);

  const coachSuggestions = useMemo(() => {
    const candidates = [nextStepsCoachSuggestion, ...enhancedCoachSuggestions].filter(Boolean);
    if (candidates.length === 0) return [];
    const sorted = [...candidates].sort((a, b) => {
      const aScore = typeof a.priority === 'number' ? a.priority : 0;
      const bScore = typeof b.priority === 'number' ? b.priority : 0;
      if (bScore !== aScore) return bScore - aScore;
      return String(a.source || '').localeCompare(String(b.source || ''));
    });
    const deduped = [];
    const seen = new Set();
    sorted.forEach((candidate) => {
      const key = `${candidate.source || 'unknown'}:${candidate.question || candidate.text || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(candidate);
    });
    return deduped;
  }, [nextStepsCoachSuggestion, enhancedCoachSuggestions]);

  const coachSuggestion = useMemo(() => coachSuggestions[0] || null, [coachSuggestions]);

  // Only an explicit, current server diagnostic can offer a rebuild. Loaded
  // local entries and failed/disabled requests are never evidence of missing data.
  const needsBackfill = shouldFetchAnalytics && !filtersActive
    && !archetypeData.isLoading && !archetypeData.error && !archetypeData.isDisabled
    && archetypeData.stats?.needsBackfill === true;

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
    reversalRateReliable: insightsStats.reversalRateReliable,
    reversalRateSample: insightsStats.reversalRateSample,
    currentStreak,
    cardFrequencyReliable: insightsStats.cardFrequencyReliable,
    cardFrequencySample: insightsStats.cardFrequencySample,

    // Narrative
    seasonNarrative,
    journeyStory, // null when < 3 entries; UI should hide section
    coachSuggestion,
    coachSuggestions,

    // Time window
    seasonWindow: effectiveSeasonWindow,
    seasonTimezone,
    filtersActive,

    // State
    isLoading: false,
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
    _dataSource: 'client',

    // Same scope used for all displayed statistics and current-scope exports
    scopedEntries,

    // Export entries - preserves old behavior: full journal when unfiltered,
    // filtered entries when filters are active. Use this for PDF/CSV/Markdown exports.
    exportEntries,
  };
}

export default useJourneyData;
