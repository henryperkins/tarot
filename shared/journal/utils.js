/**
 * Shared utilities for journal entry processing.
 * Used by dedupe.js, summary.js, stats.js, and trends.js.
 */

// Re-export safeJsonParse from canonical location
export { safeJsonParse } from '../utils.js';

/**
 * Normalize a timestamp value to milliseconds.
 * Handles: numbers (seconds or ms), numeric strings, ISO date strings.
 * @param {*} value - Raw timestamp value
 * @returns {number|null} - Timestamp in milliseconds, or null if invalid
 */
export function normalizeTimestamp(value) {
  if (value == null || value === '') return null;

  let parsed;
  if (typeof value === 'string') {
    // Try ISO date string first (e.g., "2024-01-15T10:30:00Z")
    const isoMs = Date.parse(value);
    if (Number.isFinite(isoMs)) {
      parsed = isoMs;
    } else {
      // Try numeric string (e.g., "1704067200")
      parsed = Number(value);
    }
  } else {
    parsed = value;
  }

  if (!Number.isFinite(parsed)) return null;

  // Convert seconds to milliseconds if needed (timestamps < year 2001 in ms)
  return parsed < 1e12 ? parsed * 1000 : parsed;
}

/**
 * Normalize a timestamp value to seconds.
 * Handles: numbers (seconds or ms), numeric strings, ISO date strings.
 * @param {*} value - Raw timestamp value
 * @returns {number|null} - Timestamp in seconds, or null if invalid
 */
export function normalizeTimestampSeconds(value) {
  const ms = normalizeTimestamp(value);
  return ms !== null ? Math.floor(ms / 1000) : null;
}

/**
 * Extract and normalize a timestamp from a journal entry.
 * Checks ts, created_at, and updated_at fields in priority order.
 * @param {Object} entry - Journal entry object
 * @returns {number|null} - Timestamp in milliseconds, or null if none found
 */
export function getTimestamp(entry) {
  if (!entry) return null;

  const candidates = [
    entry.ts,
    entry.timestamp,
    entry.created_at,
    entry.updated_at,
    entry.createdAt,
    entry.updatedAt
  ];
  for (const value of candidates) {
    const normalized = normalizeTimestamp(value);
    if (normalized !== null) return normalized;
  }
  return null;
}

/**
 * Extract and normalize a timestamp from a journal entry, returning seconds.
 * Useful for APIs/storage that expect Unix seconds rather than milliseconds.
 * @param {Object} entry - Journal entry object
 * @returns {number|null} - Timestamp in seconds, or null if none found
 */
export function getTimestampSeconds(entry) {
  const ms = getTimestamp(entry);
  return ms !== null ? Math.floor(ms / 1000) : null;
}
