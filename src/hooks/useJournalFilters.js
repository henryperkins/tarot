/**
 * useJournalFilters - Manages filter state, filtered entries, and active filter chips
 */

import { useDeferredValue, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { formatContextName } from '../lib/journalInsights';
import {
  CONTEXT_FILTERS,
  SPREAD_FILTERS,
  DECK_FILTERS,
  DEFAULT_FILTERS,
  TIMEFRAME_LABELS
} from '../lib/journal/constants';

export function useJournalFilters(entries, options = {}) {
  const { isAuthenticated = false, canUseCloudJournal = false } = options;
  const SERVER_SEARCH_THRESHOLD = 200;
  const SERVER_SEARCH_LIMIT = 25;
  const SERVER_SEARCH_MIN_QUERY = 3;

  const [filters, setFiltersInternal] = useState(() => ({ ...DEFAULT_FILTERS }));
  const deferredQuery = useDeferredValue(filters.query);
  const [serverSearch, setServerSearch] = useState({
    status: 'idle',
    results: [],
    error: null,
    query: '',
    mode: 'exact'
  });
  const [serverSearchNonce, setServerSearchNonce] = useState(0);
  const lastServerSearchRef = useRef({ query: '', nonce: 0, filters: '' });
  const refreshServerSearch = useCallback(() => {
    setServerSearchNonce((prev) => prev + 1);
  }, []);

  // Capture timestamp when filters change (in event handler context, not during render)
  const filterTimestampRef = useRef(0);
  const setFilters = useCallback((update) => {
    filterTimestampRef.current = Date.now();
    setFiltersInternal(update);
  }, []);

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
        query: filters.query.trim().toLowerCase(),
        contexts: [...filters.contexts].sort(),
        spreads: [...filters.spreads].sort(),
        decks: [...filters.decks].sort(),
        timeframe: filters.timeframe,
        onlyReversals: filters.onlyReversals,
        serverSearchEnabled: isAuthenticated && canUseCloudJournal && entries?.length >= SERVER_SEARCH_THRESHOLD
      }),
    [filters, isAuthenticated, canUseCloudJournal, entries?.length]
  );

  const serverFilterSignature = useMemo(
    () =>
      JSON.stringify({
        contexts: [...filters.contexts].sort(),
        spreads: [...filters.spreads].sort(),
        decks: [...filters.decks].sort(),
        timeframe: filters.timeframe,
        onlyReversals: filters.onlyReversals
      }),
    [filters.contexts, filters.spreads, filters.decks, filters.timeframe, filters.onlyReversals]
  );

  // filterTimestamp provides a stable reference for timeframe filtering
  // The ref is updated via setFilters callback; initial value uses Date.now() which is
  // acceptable for initial render as it provides correct filtering behavior
  // eslint-disable-next-line react-hooks/purity -- Initial timestamp needed for first render
  const filterTimestamp = filterTimestampRef.current || Date.now();

  const trimmedDeferredQuery = deferredQuery.trim();
  const shouldUseServerSearch = isAuthenticated
    && canUseCloudJournal
    && trimmedDeferredQuery.length >= SERVER_SEARCH_MIN_QUERY
    && entries?.length >= SERVER_SEARCH_THRESHOLD;

  useEffect(() => {
    if (!shouldUseServerSearch) {
      if (serverSearch.status !== 'idle') {
        setServerSearch({ status: 'idle', results: [], error: null, query: '', mode: 'exact' });
      }
      lastServerSearchRef.current = { query: '', nonce: 0, filters: '' };
      return;
    }

    const query = trimmedDeferredQuery;
    if (!query) return;

    const last = lastServerSearchRef.current;
    if (last.query === query && last.nonce === serverSearchNonce && last.filters === serverFilterSignature) {
      return;
    }

    lastServerSearchRef.current = { query, nonce: serverSearchNonce, filters: serverFilterSignature };
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    setServerSearch((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
      results: [],
      query
    }));

    // Build URL with query and filters
    const urlParams = new URLSearchParams();
    urlParams.append('q', query);
    urlParams.append('limit', String(SERVER_SEARCH_LIMIT));

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
        const normalizedResults = Array.isArray(data?.entries) ? data.entries : [];
        normalizedResults.sort((a, b) => (b?.ts || 0) - (a?.ts || 0));
        setServerSearch({
          status: 'success',
          results: normalizedResults,
          error: null,
          query,
          mode: data?.mode || 'exact'
        });
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setServerSearch({
          status: 'error',
          results: [],
          error: error?.message || 'Unable to search your full history.',
          query,
          mode: 'exact'
        });
      });

    return () => {
      if (controller) {
        controller.abort();
      }
    };
  }, [filters.contexts, filters.spreads, filters.decks, filters.timeframe, filters.onlyReversals, serverFilterSignature, serverSearch.status, serverSearchNonce, shouldUseServerSearch, trimmedDeferredQuery]);

  const filteredEntries = useMemo(() => {
    if (shouldUseServerSearch) {
      if (serverSearch.status === 'success') {
        return serverSearch.results;
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
    const timeframeCutoff = (() => {
      const now = filterTimestamp;
      switch (filters.timeframe) {
        case '30d':
          return now - 30 * 24 * 60 * 60 * 1000;
        case '90d':
          return now - 90 * 24 * 60 * 60 * 1000;
        case 'ytd': {
          const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
          return yearStart;
        }
        default:
          return null;
      }
    })();

    return entries.filter((entry) => {
      if (contextSet.size > 0 && !contextSet.has(entry?.context)) {
        return false;
      }
      if (spreadSet.size > 0 && !spreadSet.has(entry?.spreadKey)) {
        return false;
      }
      if (deckSet.size > 0 && !deckSet.has(entry?.deckId)) {
        return false;
      }
      const entryTs = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
      if (timeframeCutoff && entryTs && entryTs < timeframeCutoff) {
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
  }, [entries, filters.contexts, filters.spreads, filters.decks, filters.timeframe, filters.onlyReversals, filterTimestamp, serverSearch.results, serverSearch.status, shouldUseServerSearch, trimmedDeferredQuery]);

  // Check if any filters are active
  const filtersActive = Boolean(filters.query.trim()) ||
    filters.contexts.length > 0 ||
    filters.spreads.length > 0 ||
    filters.decks.length > 0 ||
    filters.timeframe !== 'all' ||
    filters.onlyReversals;

  // Build active filter chips for display
  const activeFilterChips = useMemo(() => {
    const chips = [];
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
      query: serverSearch.query
    },
    refreshServerSearch
  };
}

export default useJournalFilters;
