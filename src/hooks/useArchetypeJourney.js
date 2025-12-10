/**
 * useArchetypeJourney Hook
 *
 * Extracts archetype journey data fetching from ArchetypeJourneySection
 * to enable reuse in the unified ReadingJourney component.
 *
 * Fetches from:
 * - GET /api/archetype-journey - Load analytics data
 * - POST /api/archetype-journey-backfill - Backfill from journal entries
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeAnalyticsShape, getCardTrends, computeMonthlyTotals } from '../lib/archetypeJourney';
import { safeStorage, invalidateNarrativeCache } from '../lib/safeStorage';

export { getCardTrends, computeMonthlyTotals };

const RUN_META_KEY_PREFIX = 'archetype_run_meta';

/**
 * Get user-scoped localStorage key for run metadata.
 * Falls back to null if userId is not provided.
 */
function getRunMetaKey(userId) {
  return userId ? `${RUN_META_KEY_PREFIX}_${userId}` : null;
}

/**
 * Parse a timestamp into milliseconds.
 * Handles both seconds and milliseconds timestamps.
 */
function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * Format a timestamp for display.
 */
export function formatTimestampLabel(value) {
  const ms = parseTimestamp(value);
  if (!ms) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * useArchetypeJourney - Hook for fetching archetype journey analytics.
 *
 * @param {string} userId - User ID for user-scoped storage
 * @param {boolean} enabled - Whether to fetch data (default: true)
 * @returns {Object} Archetype journey data and state
 */
export function useArchetypeJourney(userId, enabled = true) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [runMeta, setRunMeta] = useState({ lastAnalyzedAt: null, entriesProcessed: null });
  const reloadControllerRef = useRef(null);
  const fetchControllerRef = useRef(null);

  // Load run metadata from user-scoped localStorage when userId changes
  useEffect(() => {
    if (!safeStorage.isAvailable) return;

    // Clear metadata when no userId
    if (!userId) {
      setRunMeta({ lastAnalyzedAt: null, entriesProcessed: null });
      return;
    }

    const key = getRunMetaKey(userId);
    if (!key) return;

    try {
      const stored = JSON.parse(safeStorage.getItem(key) || 'null');
      if (stored && typeof stored === 'object') {
        setRunMeta({
          lastAnalyzedAt: stored.lastAnalyzedAt ?? null,
          entriesProcessed: stored.entriesProcessed ?? null
        });
      } else {
        setRunMeta({ lastAnalyzedAt: null, entriesProcessed: null });
      }
    } catch (err) {
      console.warn('Failed to parse stored run metadata', err);
      setRunMeta({ lastAnalyzedAt: null, entriesProcessed: null });
    }
  }, [userId]);

  const updateRunMeta = useCallback((incoming) => {
    // If incoming is null/undefined, reset the metadata
    const shouldReset = incoming === null || incoming === undefined;

    setRunMeta((prev) => {
      const next = shouldReset
        ? { lastAnalyzedAt: null, entriesProcessed: null }
        : {
            lastAnalyzedAt: incoming.lastAnalyzedAt ?? prev.lastAnalyzedAt ?? null,
            entriesProcessed: incoming.entriesProcessed ?? prev.entriesProcessed ?? null
          };

      // Only persist if we have a valid user-scoped key
      if (safeStorage.isAvailable && userId) {
        const key = getRunMetaKey(userId);
        if (key) {
          try {
            if (shouldReset) {
              safeStorage.removeItem(key);
            } else {
              safeStorage.setItem(key, JSON.stringify(next));
            }
          } catch (err) {
            console.warn('Failed to persist run metadata', err);
          }
        }
      }
      return next;
    });
  }, [userId]);

  const loadAnalytics = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    setIsDisabled(false);

    try {
      const response = await fetch('/api/archetype-journey', {
        credentials: 'include',
        signal
      });

      if (!response.ok) {
        if (response.status === 403) {
          // Analytics disabled by user preference
          // Clear any previously loaded data to prevent stale analytics from being served
          setAnalytics(null);
          setIsDisabled(true);
          setLoading(false);
          return;
        }
        throw new Error('Failed to load analytics');
      }

      const data = await response.json();
      // Normalize to ensure all arrays exist
      const normalized = normalizeAnalyticsShape(data.analytics);
      setAnalytics(normalized);
      updateRunMeta({
        lastAnalyzedAt: normalized?.stats?.lastAnalyzedAt ?? data.analytics?.lastRunAt ?? null,
        entriesProcessed: normalized?.stats?.entriesProcessed ?? null
      });
    } catch (err) {
      // Don't set error state for abort
      if (err.name === 'AbortError') return;
      console.error('Failed to load archetype journey:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [updateRunMeta]);

  const handleBackfill = useCallback(async (signal) => {
    setIsBackfilling(true);
    setBackfillResult(null);

    try {
      const response = await fetch('/api/archetype-journey-backfill', {
        method: 'POST',
        credentials: 'include',
        signal
      });

      const data = await response.json();

      if (!response.ok) {
        setBackfillResult({ success: false, message: data.error || 'Backfill failed' });
        return;
      }

      setBackfillResult({ success: true, stats: data.stats });
      updateRunMeta({
        lastAnalyzedAt: Date.now(),
        entriesProcessed: data.stats?.entriesProcessed ?? data.stats?.cardsTracked ?? null
      });

      // Invalidate narrative cache since analytics data has changed
      invalidateNarrativeCache(userId);

      // Reload analytics after successful backfill
      if (data.stats?.cardsTracked > 0) {
        // Reload with slight delay to let DB settle
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!signal?.aborted) {
          if (reloadControllerRef.current) {
            reloadControllerRef.current.abort();
          }
          const reloadController = new AbortController();
          reloadControllerRef.current = reloadController;
          try {
            await loadAnalytics(reloadController.signal);
          } finally {
            if (reloadControllerRef.current === reloadController) {
              reloadControllerRef.current = null;
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Backfill failed:', err);
      setBackfillResult({ success: false, message: err.message });
    } finally {
      setIsBackfilling(false);
    }
  }, [loadAnalytics, updateRunMeta, userId]);

  // Fetch analytics on mount when enabled
  useEffect(() => {
    // Don't fetch if not enabled
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Abort any previous fetch
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }

    const controller = new AbortController();
    fetchControllerRef.current = controller;
    loadAnalytics(controller.signal);

    return () => {
      controller.abort();
      fetchControllerRef.current = null;
    };
  }, [enabled, loadAnalytics]);

  // Cleanup reload controller on unmount
  useEffect(() => {
    return () => {
      if (reloadControllerRef.current) {
        reloadControllerRef.current.abort();
      }
    };
  }, []);

  // Compute derived data
  const topCards = analytics?.topCards || [];
  const streaks = analytics?.streaks || [];
  const badges = analytics?.badges || [];
  const majorArcanaFrequency = analytics?.majorArcanaFrequency || {};
  const trends = analytics?.trends || [];
  const stats = analytics?.stats || {};
  const currentMonth = analytics?.currentMonth || '';

  // Compute six-month cadence data
  const monthlyTotals = computeMonthlyTotals(trends).slice(-6);
  const cadenceData = monthlyTotals.map(m => {
    const [year, month] = m.year_month.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return {
      label: date.toLocaleDateString('default', { month: 'short', year: 'numeric' }),
      count: m.total
    };
  });

  // Compute current streak from analytics
  const currentStreak = analytics?.stats?.currentStreak || 0;

  // Check if analytics has backfilled data
  const hasBackfilled = !!(analytics && topCards.length > 0);

  // Run caption for display
  const topCardWithLastSeen = topCards.find((card) => card.last_seen);
  const lastAnalyzedLabel = formatTimestampLabel(
    runMeta.lastAnalyzedAt || stats?.lastAnalyzedAt || topCardWithLastSeen?.last_seen
  );
  const processedCaptionCount = runMeta.entriesProcessed ?? stats?.entriesProcessed ?? stats?.totalReadings ?? null;

  return {
    // Raw analytics data
    analytics,

    // Normalized data arrays
    topCards,
    streaks,
    badges,
    majorArcanaFrequency,
    trends,
    stats,
    currentMonth,
    cadenceData,
    currentStreak,

    // State
    isLoading: loading,
    error,
    isDisabled,
    isBackfilling,
    backfillResult,
    hasBackfilled,

    // Run metadata
    runMeta,
    lastAnalyzedLabel,
    processedCaptionCount,

    // Actions
    loadAnalytics,
    handleBackfill,
    updateRunMeta,

    // Helper functions
    getCardTrends: (cardName) => getCardTrends(trends, cardName),
  };
}

export default useArchetypeJourney;
