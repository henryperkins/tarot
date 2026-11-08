/**
 * Journey statistics name a "top" card or focus only when the data shows one.
 * A single appearance is not a pattern, and a tie is reported whole: no stat
 * picks one of several equal cards or contexts as if it led alone.
 */

/** Appearances needed before a card or context counts as recurring. */
export const MIN_REPEAT_COUNT = 2;

const countOf = (item) => {
  const count = Number(item?.count);
  return Number.isFinite(count) ? count : 0;
};

/**
 * Every item tied for the highest count, when that count is a repeat.
 * Returns [] when nothing repeats.
 */
export function findLeaders(items, { min = MIN_REPEAT_COUNT } = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const top = Math.max(...items.map(countOf));
  if (top < min) return [];
  return items.filter((item) => countOf(item) === top);
}

/** The one item that leads on its own, or null when nothing repeats or items tie. */
export function findSoleLeader(items, options) {
  const leaders = findLeaders(items, options);
  return leaders.length === 1 ? leaders[0] : null;
}

/** Items that appeared at least twice, in their given order. */
export function filterRepeated(items, { min = MIN_REPEAT_COUNT } = {}) {
  return Array.isArray(items) ? items.filter((item) => countOf(item) >= min) : [];
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names) {
  const list = (Array.isArray(names) ? names : []).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
