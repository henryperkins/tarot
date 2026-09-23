/**
 * Shared cross-environment utilities.
 * Used by browser (src/), Workers (functions/), and Node.js scripts (scripts/).
 *
 * These utilities are intentionally environment-agnostic and have no external dependencies.
 */

// =============================================================================
// JSON Utilities
// =============================================================================

/**
 * Safely parse JSON with fallback value.
 * Handles null, undefined, and already-parsed values gracefully.
 *
 * @param {*} value - JSON string or already-parsed value
 * @param {*} fallback - Fallback value if parsing fails
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.silent=true] - If false, log warnings on parse failure
 * @returns {*} Parsed value or fallback
 *
 * @example
 * safeJsonParse('{"a":1}', null) // { a: 1 }
 * safeJsonParse('invalid', [])   // []
 * safeJsonParse(null, {})        // {}
 * safeJsonParse({ a: 1 }, null)  // { a: 1 } (already parsed, returned as-is)
 */
export function safeJsonParse(value, fallback, options = {}) {
  const { silent = true } = options;

  if (value == null) return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    if (!silent) {
      console.warn('JSON parse failed:', error?.message || error);
    }
    return fallback;
  }
}

// =============================================================================
// Count Utilities
// =============================================================================

/**
 * Find the keys sharing the highest positive count in a { key: count } map.
 *
 * @param {Object<string, number>} counts - Count map (e.g. suitCounts, elementCounts)
 * @returns {{ keys: string[], count: number, total: number }} Leading keys in map order;
 *   `keys` is empty when no count is positive
 *
 * @example
 * getLeadingKeys({ Fire: 2, Water: 2, Air: 1 }) // { keys: ['Fire', 'Water'], count: 2, total: 5 }
 */
export function getLeadingKeys(counts) {
  const entries = Object.entries(counts || {})
    .filter(([, count]) => Number.isFinite(count) && count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const count = entries.reduce((max, [, value]) => Math.max(max, value), 0);
  const keys = entries.filter(([, value]) => value === count).map(([key]) => key);
  return { keys, count, total };
}

/**
 * Find the single key with the highest positive count.
 * A tie for the top count has no leader, so callers never report an arbitrary
 * tie-break (usually insertion order) as one key dominating.
 *
 * @param {Object<string, number>} counts - Count map
 * @returns {{ key: string, count: number, total: number, ratio: number } | null}
 *
 * @example
 * getUniqueLeader({ Wands: 1, Cups: 1, Swords: 1, Pentacles: 1 }) // null
 * getUniqueLeader({ Fire: 2, Water: 1 }) // { key: 'Fire', count: 2, total: 3, ratio: 0.666… }
 */
export function getUniqueLeader(counts) {
  const { keys, count, total } = getLeadingKeys(counts);
  if (keys.length !== 1) return null;
  return { key: keys[0], count, total, ratio: count / total };
}

// =============================================================================
// Hash Functions
// =============================================================================

/**
 * FNV-1a hash algorithm for deterministic string hashing.
 * Used for seed computation in deck shuffling.
 *
 * @param {string} s - String to hash
 * @returns {number} Unsigned 32-bit hash value
 */
export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// =============================================================================
// Random Number Generation
// =============================================================================

/**
 * xorshift32 PRNG for deterministic random number generation.
 * Returns a function that generates numbers in [0, 1).
 *
 * @param {number} seed - Initial seed value
 * @returns {function(): number} Generator function returning values in [0, 1)
 */
export function xorshift32(seed) {
  let x = seed >>> 0 || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

/**
 * Fisher-Yates shuffle with seeded PRNG for deterministic shuffling.
 * Same seed always produces the same shuffle order.
 *
 * @param {Array} arr - Array to shuffle
 * @param {number} seed - Seed for deterministic shuffling
 * @returns {Array} New shuffled array (original unchanged)
 */
export function seededShuffle(arr, seed) {
  const copy = arr.slice();
  const rand = xorshift32(seed >>> 0);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// =============================================================================
// Text Utilities
// =============================================================================

/**
 * Ensure a string ends with a question mark.
 *
 * @param {string} text - Input text
 * @returns {string} Text ending with '?'
 */
export function ensureQuestionMark(text) {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.endsWith('?') ? trimmed : `${trimmed}?`;
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 *
 * @param {string} value - Text to truncate
 * @param {number} max - Maximum length
 * @param {Object} [options] - Configuration
 * @param {boolean} [options.accountForEllipsis=true] - If true, max includes ellipsis length
 * @param {string} [options.ellipsis='\u2026'] - Ellipsis character(s), default is Unicode ellipsis
 * @returns {string} Truncated text
 *
 * @example
 * truncateText('Hello World', 8) // 'Hello W…' (7 chars + ellipsis = 8)
 * truncateText('Hello World', 8, { accountForEllipsis: false }) // 'Hello Wo…' (8 chars + ellipsis)
 */
export function truncateText(value, max, options = {}) {
  const { accountForEllipsis = true, ellipsis = '\u2026' } = options;

  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;

  const cutoff = accountForEllipsis ? max - ellipsis.length : max;
  return `${trimmed.slice(0, Math.max(0, cutoff))}${ellipsis}`;
}
