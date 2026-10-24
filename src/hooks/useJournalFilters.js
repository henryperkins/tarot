/**
 * useJournalFilters - Manages filter state, filtered entries, and active filter chips
 */

import { useDeferredValue, useCallback, useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { isDeletedAccount, subscribeToDeletedAccounts } from '../lib/deletedAccountStorage.js';
import { filterDeletedJournalEntries, subscribeToDeletedJournalEntries } from '../lib/deletedJournalEntryStorage.js';
import { matchesJourneyFilter } from '../lib/coachSuggestionUtils';
import { formatContextName } from '../lib/journalInsights';
import { getTimestamp } from '../../shared/journal/utils.js';
import { filterEntriesToWindow, getTimeframeWindow } from '../lib/journal/utils';
import {
  CONTEXT_FILTERS,
  SPREAD_FILTERS,
  DECK_FILTERS,
  DEFAULT_FILTERS,
  TIMEFRAME_LABELS
} from '../lib/journal/constants';

// One stable idle value keeps filteredEntries memoized while server search is off.
const IDLE_SERVER_SEARCH = Object.freeze({
  searchKey: null, status: 'idle', results: [], error: null, query: '', mode: 'exact'
});

export function useJournalFilters(sourceEntries, options = {}) {
  const { isAuthenticated = false, canUseCloudJournal = false, userId = null, completeHistory = false } = options;
  const namespace = isAuthenticated && userId ? `user:${encodeURIComponent(userId)}` : 'anon';
  const namespaceRef = useRef(namespace);
  const entries = filterDeletedJournalEntries(namespace, sourceEntries);
  const SERVER_SEARCH_THRESHOLD = 200;
  const SERVER_SEARCH_LIMIT = 25;
  const SERVER_SEARCH_MIN_QUERY = 3;

  const [filterState, setFilterState] = useState(() => ({ namespace, filters: { ...DEFAULT_FILTERS } }));
  if (filterState.namespace !== namespace) setFilterState({ namespace, filters: { ...DEFAULT_FILTERS } });
  const filters = filterState.namespace === namespace ? filterState.filters : DEFAULT_FILTERS;
  const setFiltersInternal = useCallback(update => setFilterState(previous => {
    if (namespaceRef.current !== namespace) return previous;
    const current = previous.namespace === namespace ? previous.filters : { ...DEFAULT_FILTERS };
    return { namespace, filters: typeof update === 'function' ? update(current) : update };
  }), [namespace]);
  const querySnapshot = useMemo(() => ({ namespace, query: filters.query }), [namespace, filters.query]);
  const deferredSnapshot = useDeferredValue(querySnapshot);
  const deferredQuery = deferredSnapshot.namespace === namespace ? deferredSnapshot.query : '';
  const [serverSearchResult, setServerSearchResult] = useState(IDLE_SERVER_SEARCH);
  const setServerSearch = useCallback(update => setServerSearchResult(previous => {
    if (namespaceRef.current !== namespace || isDeletedAccount(userId)) return previous;
    const next = typeof update === 'function' ? update(previous) : update;
    return { ...next, results: filterDeletedJournalEntries(namespace, next.results) };
  }), [namespace, userId]);
  useLayoutEffect(() => {
    namespaceRef.current = isDeletedAccount(userId) ? null : namespace;
    const unsubscribeEntries = subscribeToDeletedJournalEntries(owner => {
      if (owner === namespaceRef.current) setServerSearch(previous => ({ ...previous, results: filterDeletedJournalEntries(owner, previous.results) }));
    });
    const unsubscribeAccount = subscribeToDeletedAccounts(owner => {
      if (owner !== userId) return;
      namespaceRef.current = null;
      setServerSearchResult(IDLE_SERVER_SEARCH);
    });
    return () => { unsubscribeEntries(); unsubscribeAccount(); };
  }, [namespace, userId, setServerSearch]);
  const [serverSearchNonce, setServerSearchNonce] = useState(0);
  const refreshServerSearch = useCallback(() => {
    setServerSearchNonce((prev) => prev + 1);
  }, []);

  // Search by meaning runs only on request, for the exact query it was asked
  // for; editing the query returns to literal matches.
  const [semanticRequest, setSemanticRequest] = useState(() => ({ namespace, query: null }));
  const semanticQuery = semanticRequest.namespace === namespace ? semanticRequest.query : null;
  if (semanticQuery && filters.query.trim() !== semanticQuery) setSemanticRequest({ namespace, query: null });

  // This clock owns both the filtered readings and the window used by analytics.
  const [filterTimestamp, setFilterTimestamp] = useState(Date.now);
  const setFilters = useCallback((update) => {
    setFilterTimestamp(Date.now());
    setFiltersInternal(update);
  }, [setFiltersInternal]);
  const timeframeWindow = useMemo(
    () => getTimeframeWindow(filters.timeframe, new Date(filterTimestamp)),
    [filters.timeframe, filterTimestamp]
  );

  // Label maps for display
  const contextLabelMap = useMemo(
    () => Object.fromEntries(CONTEXT_FILTERS.map((context) => [context.value, context.label])),
    []
  );
  const spreadLabelMap = useMemo(
    () => Object.fromEntries(SPREAD_FILTERS.map((spread) => [spread.value, spread.label])),
    []
  );
  const deckLabelMap = useMemo(
    () => Object.fromEntries(DECK_FILTERS.map((deck) => [deck.value, deck.label])),
    []
  );

  // Filter signature for effect dependencies
  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        namespace,
        query: filters.query.trim().toLowerCase(),
        contexts: [...filters.contexts].sort(),
        spreads: [...filters.spreads].sort(),
        decks: [...filters.decks].sort(),
        timeframe: filters.timeframe,
        onlyReversals: filters.onlyReversals,
        journeyFilter: filters.journeyFilter,
        serverSearchEnabled: isAuthenticated && canUseCloudJournal && !completeHistory && entries?.length >= SERVER_SEARCH_THRESHOLD,
        semanticQuery
      }),
    [filters, namespace, isAuthenticated, canUseCloudJournal, completeHistory, entries, semanticQuery]
  );

  const serverFilterSignature = useMemo(
    () =>
      JSON.stringify({
        contexts: [...filters.contexts].sort(),
        spreads: [...filters.spreads].sort(),
        decks: [...filters.decks].sort(),
        timeframe: filters.timeframe,
        windowStart: timeframeWindow?.start.getTime(),
        windowEnd: timeframeWindow?.end.getTime(),
        onlyReversals: filters.onlyReversals
      }),
    [filters.contexts, filters.spreads, filters.decks, filters.timeframe, timeframeWindow, filters.onlyReversals]
  );

  const trimmedDeferredQuery = deferredQuery.trim();
  const canSearchServer = isAuthenticated
    && Boolean(userId) && !isDeletedAccount(userId)
    && canUseCloudJournal
    && !filters.journeyFilter;
  const semanticAvailable = canSearchServer && filters.query.trim().length >= SERVER_SEARCH_MIN_QUERY;
  const semanticActive = canSearchServer && Boolean(semanticQuery) && trimmedDeferredQuery === semanticQuery;
  const shouldUseServerSearch = semanticActive || (canSearchServer
    // Complete history can be filtered locally without truncating matches to
    // the server search page size. Paginated callers retain server search.
    && !completeHistory
    && trimmedDeferredQuery.length >= SERVER_SEARCH_MIN_QUERY
    && entries?.length >= SERVER_SEARCH_THRESHOLD);
  const requestedSearchMode = semanticActive ? 'semantic' : 'exact';

  const searchKey = shouldUseServerSearch
    ? JSON.stringify([namespace, trimmedDeferredQuery, requestedSearchMode, serverFilterSignature, serverSearchNonce]) : null;
  const serverSearch = !shouldUseServerSearch
    ? IDLE_SERVER_SEARCH
    : serverSearchResult.searchKey === searchKey
      ? { ...serverSearchResult, results: filterDeletedJournalEntries(namespace, serverSearchResult.results) }
      : { searchKey, status: 'loading', results: [], error: null, query: trimmedDeferredQuery, mode: requestedSearchMode };

  const requestSemanticSearch = useCallback(() => {
    const query = filters.query.trim();
    if (query.length < SERVER_SEARCH_MIN_QUERY) return;
    setSemanticRequest({ namespace, query });
  }, [filters.query, namespace]);
  const clearSemanticSearch = useCallback(() => setSemanticRequest({ namespace, query: null }), [namespace]);

  // Returning to a previous query starts fresh, including after a cleared search.
  // Render resets must settle before the new owner's layout effect can run.
  // Keep the namespace guard on asynchronous responses, not this local reset.
  if (serverSearchResult.searchKey !== searchKey) setServerSearchResult(serverSearch);

  // Wake when a reading enters/exits the window or either calendar endpoint
  // changes day. This also catches midnight/year rollover without polling.
  const nextTimeframeRefresh = useMemo(() => {
    if (!timeframeWindow) return null;
    const now = timeframeWindow.end;
    let next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const rolling = filters.timeframe === '30d' || filters.timeframe === '90d';
    const duration = rolling ? filterTimestamp - timeframeWindow.start.getTime() : null;
    if (rolling) {
      const start = timeframeWindow.start;
      const nextStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime();
      next = Math.min(next, nextStartDay + duration);
    }
    for (const entry of [...entries, ...serverSearch.results]) {
      const ts = getTimestamp(entry);
      if (ts === null) continue;
      if (ts > filterTimestamp) next = Math.min(next, ts);
      // The lower endpoint is inclusive, so expiry is one millisecond later.
      if (rolling && ts + duration + 1 > filterTimestamp) {
        next = Math.min(next, ts + duration + 1);
      }
    }
    return next;
  }, [entries, serverSearch.results, timeframeWindow, filters.timeframe, filterTimestamp]);

  useEffect(() => {
    if (nextTimeframeRefresh === null) return;
    const refresh = () => setFilterTimestamp(Date.now());
    const timer = setTimeout(refresh, Math.max(0, nextTimeframeRefresh - Date.now()));
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [nextTimeframeRefresh, filterTimestamp]);

  useEffect(() => {
    if (!shouldUseServerSearch) return;

    const query = trimmedDeferredQuery;
    if (!query) return;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let cancelled = false;

    // Build URL with query and filters
    const urlParams = new URLSearchParams();
    urlParams.append('q', query);
    urlParams.append('limit', String(SERVER_SEARCH_LIMIT));
    if (requestedSearchMode === 'semantic') urlParams.append('mode', 'semantic');

    // Add active filters to the search request
    if (filters.contexts.length > 0) {
      filters.contexts.forEach(context => urlParams.append('contexts', context));
    }
    if (filters.spreads.length > 0) {
      filters.spreads.forEach(spread => urlParams.append('spreads', spread));
    }
    if (filters.decks.length > 0) {
      filters.decks.forEach(deck => urlParams.append('decks', deck));
    }
    if (filters.timeframe !== 'all') {
      urlParams.append('timeframe', filters.timeframe);
    }
    if (filters.onlyReversals) {
      urlParams.append('onlyReversals', 'true');
    }

    const url = `/api/journal/search?${urlParams.toString()}`;
    fetch(url, {
      credentials: 'include',
      signal: controller?.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = payload?.error || 'Unable to search your full history.';
          throw new Error(message);
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled || namespaceRef.current !== namespace || isDeletedAccount(userId)) return;
        const normalizedResults = filterDeletedJournalEntries(namespace, data?.entries).slice();
        normalizedResults.sort((a, b) => (b?.ts || 0) - (a?.ts || 0));
        setServerSearch({
          searchKey,
          status: 'success',
          results: normalizedResults,
          error: null,
          query,
          mode: data?.mode || requestedSearchMode
        });
      })
      .catch((error) => {
        if (cancelled || namespaceRef.current !== namespace || isDeletedAccount(userId) || error?.name === 'AbortError') return;
        setServerSearch({
          searchKey,
          status: 'error',
          results: [],
          error: error?.message || 'Unable to search your full history.',
          query,
          mode: requestedSearchMode
        });
      });

    return () => {
      cancelled = true;
      if (controller) {
        controller.abort();
      }
    };
  }, [filters.contexts, filters.spreads, filters.decks, filters.timeframe, filters.onlyReversals, searchKey, shouldUseServerSearch, trimmedDeferredQuery, requestedSearchMode, namespace, userId, setServerSearch]);

  const filteredEntries = useMemo(() => {
    if (shouldUseServerSearch) {
      if (serverSearch.status === 'success') {
        return filterEntriesToWindow(serverSearch.results, timeframeWindow);
      }
      if (serverSearch.status === 'loading') {
        return [];
      }
    }
    if (!entries || entries.length === 0) {
      return [];
    }
    const query = trimmedDeferredQuery.toLowerCase();
    const contextSet = new Set(filters.contexts);
    const spreadSet = new Set(filters.spreads);
    const deckSet = new Set(filters.decks);
    return filterEntriesToWindow(entries, timeframeWindow).filter((entry) => {
      if (!matchesJourneyFilter(entry, filters.journeyFilter)) return false;
      if (contextSet.size > 0 && !contextSet.has(entry?.context)) {
        return false;
      }
      if (spreadSet.size > 0 && !spreadSet.has(entry?.spreadKey)) {
        return false;
      }
      if (deckSet.size > 0 && !deckSet.has(entry?.deckId)) {
        return false;
      }
      if (filters.onlyReversals) {
        const hasReversal = (entry?.cards || []).some((card) => (card?.orientation || '').toLowerCase().includes('reversed'));
        if (!hasReversal) {
          return false;
        }
      }
      if (query) {
        const reflections = entry?.reflections ? Object.values(entry.reflections).join(' ') : '';
        const cards = (entry?.cards || [])
          .map((card) => `${card.position || ''} ${card.name} ${card.orientation || ''}`)
          .join(' ');
        const haystack = [
          entry?.question,
          entry?.spread,
          entry?.context,
          entry?.personalReading,
          reflections,
          cards
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [entries, filters.journeyFilter, filters.contexts, filters.spreads, filters.decks, filters.onlyReversals, timeframeWindow, serverSearch.results, serverSearch.status, shouldUseServerSearch, trimmedDeferredQuery]);

  // Check if any filters are active
  const filtersActive = Boolean(filters.query.trim()) ||
    filters.contexts.length > 0 ||
    filters.spreads.length > 0 ||
    filters.decks.length > 0 ||
    filters.timeframe !== 'all' ||
    filters.onlyReversals || Boolean(filters.journeyFilter);

  // Build active filter chips for display
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.journeyFilter) {
      chips.push({ key: 'journey', label: filters.journeyFilter.label || 'Journey readings' });
    }
    const trimmedQuery = filters.query.trim();
    if (trimmedQuery) {
      chips.push({ key: 'query', label: `"${trimmedQuery}"` });
    }
    if (filters.contexts.length > 0) {
      const labels = filters.contexts.map((context) => contextLabelMap[context] || formatContextName(context));
      chips.push({ key: 'contexts', label: labels.length === 1 ? labels[0] : `${labels.length} contexts` });
    }
    if (filters.spreads.length > 0) {
      const labels = filters.spreads.map((spread) => spreadLabelMap[spread] || spread);
      chips.push({ key: 'spreads', label: labels.length === 1 ? labels[0] : `${labels.length} spreads` });
    }
    if (filters.decks.length > 0) {
      const labels = filters.decks.map((deck) => deckLabelMap[deck] || deck);
      chips.push({ key: 'decks', label: labels.length === 1 ? labels[0] : `${labels.length} decks` });
    }
    if (filters.timeframe !== 'all') {
      chips.push({ key: 'timeframe', label: TIMEFRAME_LABELS[filters.timeframe] || filters.timeframe });
    }
    if (filters.onlyReversals) {
      chips.push({ key: 'reversals', label: 'Reversals on' });
    }
    return chips;
  }, [filters, contextLabelMap, spreadLabelMap, deckLabelMap]);

  // Reset filters to defaults
  const handleResetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, [setFilters]);

  const handleRemoveFilter = useCallback((chipKey) => {
    setFilters((prev) => {
      switch (chipKey) {
        case 'journey':
          return { ...prev, journeyFilter: null };
        case 'query':
          return { ...prev, query: '' };
        case 'contexts':
          return { ...prev, contexts: [] };
        case 'spreads':
          return { ...prev, spreads: [] };
        case 'decks':
          return { ...prev, decks: [] };
        case 'timeframe':
          return { ...prev, timeframe: 'all' };
        case 'reversals':
          return { ...prev, onlyReversals: false };
        default:
          return prev;
      }
    });
  }, [setFilters]);

  return {
    filters,
    setFilters,
    filterSignature,
    filteredEntries,
    timeframeWindow,
    filtersActive,
    activeFilterChips,
    handleResetFilters,
    handleRemoveFilter,
    serverSearchState: {
      enabled: shouldUseServerSearch,
      status: serverSearch.status,
      error: serverSearch.error,
      mode: serverSearch.mode,
      resultsCount: serverSearch.results.length,
      query: serverSearch.query,
      // An explicit search by meaning: offered for any cloud journal query.
      semanticAvailable: semanticAvailable && !semanticActive,
      semanticActive
    },
    refreshServerSearch,
    requestSemanticSearch,
    clearSemanticSearch
  };
}

export default useJournalFilters;
