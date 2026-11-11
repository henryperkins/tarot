import { getTimestamp } from '../../../shared/journal/utils.js';

/** Sorting is a presentation choice, not a journal filter or storage order. */
export function normalizeJournalSortOrder(value) {
  return value === 'oldest' ? 'oldest' : 'newest';
}

/**
 * Return an ordered copy of the current matches without changing their entries.
 * Unknown dates stay at the end in either direction, as one Undated group.
 * Equal dates retain their source order so changing direction does not shuffle ties.
 */
export function sortJournalEntries(entries, order = 'newest') {
  if (!Array.isArray(entries)) return [];
  const direction = normalizeJournalSortOrder(order) === 'oldest' ? 1 : -1;

  return entries
    .map((entry, index) => {
      const timestamp = getTimestamp(entry);
      const dated = timestamp !== null && Number.isFinite(new Date(timestamp).getTime());
      return { entry, index, timestamp: dated ? timestamp : null };
    })
    .sort((a, b) => {
      if (a.timestamp === null) return b.timestamp === null ? a.index - b.index : 1;
      if (b.timestamp === null) return -1;
      return direction * (a.timestamp - b.timestamp) || a.index - b.index;
    })
    .map(({ entry }) => entry);
}
