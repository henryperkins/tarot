/**
 * useJournalSummary - Hook for generating journal summaries via API.
 *
 * Handles loading, error, and success states for the /api/journal-summary endpoint.
 * Includes debouncing to prevent rapid re-generation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const COOLDOWN_MS = 5000; // 5 second cooldown between requests

/**
 * @typedef {Object} SummaryMeta
 * @property {'azure-responses'|'heuristic'} provider - Summary generation provider
 * @property {number} totalEntries - Number of entries summarized
 * @property {string|null} model - Model used (for AI summaries)
 */

/**
 * @typedef {Object} SummaryResult
 * @property {string} summary - The generated summary text
 * @property {SummaryMeta} meta - Metadata about the summary
 */

/**
 * @typedef {Object} UseJournalSummaryReturn
 * @property {SummaryResult|null} result - The summary result
 * @property {boolean} isLoading - Whether a summary is being generated
 * @property {string|null} error - Error message if generation failed
 * @property {boolean} canGenerate - Whether generation is allowed (cooldown check)
 * @property {Function} generate - Function to generate a summary
 * @property {Function} clear - Function to clear the current summary
 */

/**
 * Hook for generating journal summaries.
 *
 * @returns {UseJournalSummaryReturn}
 */
export function useJournalSummary() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const canGenerate = !cooldownActive;

  /**
   * Generate a journal summary.
   *
   * @param {Object} options
   * @param {(string|number)[]} [options.entryIds] - Specific entry IDs to summarize
   * @param {number} [options.limit=10] - Max entries to summarize (1-10)
   * @returns {Promise<SummaryResult|null>}
   */
  const generate = useCallback(async ({ entryIds, limit = 10 } = {}) => {
    // Cooldown check
    if (cooldownActive) {
      setError('Please wait a moment before generating another summary.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    // Start cooldown with timer that triggers re-render when it expires
    setCooldownActive(true);
    cooldownTimerRef.current = setTimeout(() => {
      setCooldownActive(false);
    }, COOLDOWN_MS);

    try {
      const body = {};
      if (Array.isArray(entryIds) && entryIds.length > 0) {
        body.entryIds = entryIds;
      }
      if (typeof limit === 'number' && limit >= 1 && limit <= 10) {
        body.limit = limit;
      }

      const response = await fetch('/api/journal-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle tier-limited response
        if (response.status === 403 && data.tierLimited) {
          setError('Journal summaries require a Plus subscription.');
          return null;
        }
        // Handle auth error
        if (response.status === 401) {
          setError('Please sign in to generate summaries.');
          return null;
        }
        // Handle no entries
        if (response.status === 400) {
          setError(data.error || 'No entries available to summarize.');
          return null;
        }
        // Generic error
        throw new Error(data.error || 'Failed to generate summary');
      }

      const summaryResult = {
        summary: data.summary,
        meta: data.meta,
      };

      setResult(summaryResult);
      return summaryResult;
    } catch (err) {
      console.error('[useJournalSummary] Generation failed:', err);
      setError(err.message || 'Unable to generate summary. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [cooldownActive]);

  /**
   * Clear the current summary and error state.
   */
  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    result,
    isLoading,
    error,
    canGenerate,
    generate,
    clear,
  };
}

export default useJournalSummary;
