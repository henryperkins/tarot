/**
 * useJournalFilters - Manages filter state, filtered entries, and active filter chips
 */

import { useDeferredValue, useCallback, useMemo, useState } from 'react';
import { formatContextName } from '../lib/journalInsights';
import {
  CONTEXT_FILTERS,
  SPREAD_FILTERS,
  DECK_FILTERS,
  DEFAULT_FILTERS,
  TIMEFRAME_LABELS
} from '../lib/journal/constants';

export function useJournalFilters(entries) {
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const deferredQuery = useDeferredValue(filters.query);

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
        onlyReversals: filters.onlyReversals
      }),
    [filters]
  );

  // Compute filtered entries
  const filteredEntries = useMemo(() => {
    if (!entries || entries.length === 0) {
      return [];
    }
    const query = deferredQuery.trim().toLowerCase();
    const contextSet = new Set(filters.contexts);
    const spreadSet = new Set(filters.spreads);
    const deckSet = new Set(filters.decks);
    const timeframeCutoff = (() => {
      const now = Date.now();
      switch (filters.timeframe) {
        case '30d':
          return now - 30 * 24 * 60 * 60 * 1000;
        case '90d':
          return now - 90 * 24 * 60 * 60 * 1000;
        case 'ytd': {
          const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
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
  }, [entries, deferredQuery, filters.contexts, filters.spreads, filters.decks, filters.timeframe, filters.onlyReversals]);

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
  }, []);

  return {
    filters,
    setFilters,
    filterSignature,
    filteredEntries,
    filtersActive,
    activeFilterChips,
    handleResetFilters
  };
}

export default useJournalFilters;
