/**
 * Shared Utility Functions
 *
 * Consolidates common utilities used across multiple lib modules:
 * - Hash functions for cache keys
 * - ID generation for unique identifiers
 * - JSON parsing with safety
 */

/**
 * djb2 hash algorithm - fast string hashing for cache keys.
 * Used for TTS cache, narrative cache, and filter hashes.
 *
 * @param {string} str - String to hash
 * @returns {number} 32-bit hash as positive integer
 */
export function djb2Hash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a unique ID with optional prefix.
 * Uses crypto.randomUUID when available, falls back to timestamp + random.
 *
 * @param {string} [prefix='id'] - Prefix for the generated ID
 * @returns {string} Unique identifier
 */
export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Safely parse JSON with fallback value.
 * Prevents crashes from malformed JSON in localStorage.
 *
 * @param {string|null} value - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed value or fallback
 */
export function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return fallback;
  }
}
