import { useState, useCallback, useRef, useEffect } from 'react';
import { captureSummarySource, getSummaryCandidates, summarySourceMatches } from '../lib/journalSummarySource.js';

const COOLDOWN_MS = 5000;
const emptyState = (ownerKey, notice = null) => ({ ownerKey, request: null, result: null, isLoading: false, error: null, notice });

/**
 * Owned by the journal page, above responsive layouts and summary disclosures.
 * Results live only for this page session and the account/source that made them.
 */
export function useJournalSummary({ userId, entries = [], enabled = false } = {}) {
  const ownerKey = enabled && userId != null ? String(userId) : null;
  const [state, setState] = useState(() => emptyState(ownerKey));
  const [cooldown, setCooldown] = useState(null);
  const cooldownRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const activeRequestRef = useRef(null);

  // Adjust before rendering: neither an old account's result nor a result for
  // edited/deleted source entries may flash while an effect catches up.
  if (state.ownerKey !== ownerKey) {
    setState(emptyState(ownerKey));
  } else if (state.request && !summarySourceMatches(state.request.source, entries)) {
    setState(emptyState(ownerKey, 'Your journal changed. Generate a new summary to include your latest entries.'));
  }

  useEffect(() => {
    const request = state.request;
    return () => request?.controller.abort();
  }, [state.request]);

  useEffect(() => () => {
    clearTimeout(cooldownTimerRef.current);
    activeRequestRef.current?.controller.abort();
  }, []);

  const generate = useCallback(async ({ entryIds, limit = 10, context } = {}) => {
    if (!ownerKey) return null;
    const active = activeRequestRef.current;
    if (active?.ownerKey === ownerKey && !active.controller.signal.aborted) return null;
    if (cooldownRef.current?.ownerKey === ownerKey && cooldownRef.current.until > Date.now()) return null;

    const ids = Array.isArray(entryIds) ? new Set(entryIds.map(String)) : null;
    const selected = getSummaryCandidates(entries)
      .filter((entry) => !ids || ids.has(String(entry.id)))
      .slice(0, Math.min(10, Math.max(1, Number(limit) || 10)));
    if (!selected.length) {
      setState({ ...emptyState(ownerKey), error: 'No cloud entries are available in this scope.' });
      return null;
    }

    active?.controller.abort();
    const request = { ownerKey, source: captureSummarySource(selected), controller: new AbortController(), context };
    activeRequestRef.current = request;
    setState({ ...emptyState(ownerKey), request, isLoading: true });
    const nextCooldown = { ownerKey, until: Date.now() + COOLDOWN_MS };
    cooldownRef.current = nextCooldown;
    setCooldown(nextCooldown);
    clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => setCooldown(null), COOLDOWN_MS);

    // Every completion also checks ownership. Abort alone is insufficient when
    // a response has already arrived or a transport ignores cancellation.
    const updateRequest = (update) => setState((previous) => (
      previous.request === request ? { ...previous, ...update } : previous
    ));

    try {
      const response = await fetch('/api/journal-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: request.controller.signal,
        body: JSON.stringify({ entryIds: selected.map((entry) => entry.id), limit: selected.length }),
      });
      const data = await response.json();
      if (request.controller.signal.aborted) return null;
      if (!response.ok) {
        if (response.status === 403 && data.tierLimited) throw new Error('Journal summaries require an active Plus or Pro subscription.');
        if (response.status === 401) throw new Error('Please sign in to generate summaries.');
        throw new Error(data.error || 'Unable to generate a summary. Please try again.');
      }
      const result = { summary: data.summary, meta: data.meta, context, entryIds: selected.map((entry) => entry.id) };
      updateRequest({ result, isLoading: false });
      return result;
    } catch (error) {
      if (!request.controller.signal.aborted) {
        updateRequest({ error: error.message || 'Unable to generate a summary. Please try again.', isLoading: false });
      }
      return null;
    } finally {
      if (activeRequestRef.current === request) activeRequestRef.current = null;
    }
  }, [ownerKey, entries]);

  const clear = useCallback(() => setState(emptyState(ownerKey)), [ownerKey]);

  return {
    result: state.result,
    isLoading: state.isLoading,
    error: state.error,
    notice: state.notice,
    pendingContext: state.request?.context,
    canGenerate: Boolean(ownerKey) && !state.isLoading && cooldown?.ownerKey !== ownerKey,
    generate,
    clear,
  };
}

export default useJournalSummary;
