/**
 * SSR-safe localStorage abstraction for Reading Journey caching.
 *
 * This module provides a safe wrapper around localStorage that:
 * - Guards against SSR/Worker environments where localStorage doesn't exist
 * - Handles storage errors gracefully (quota exceeded, private browsing)
 * - Provides cache key generation for season narratives
 * - Manages narrative cache with TTL and user isolation
 */

import { djb2Hash } from './utils.js';

const NARRATIVE_CACHE_KEY = 'journey_narrative_cache';
const NARRATIVE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * SSR-safe storage abstraction.
 * Returns null operations when localStorage is unavailable (SSR, Workers, etc.)
 */
export const safeStorage = {
  get isAvailable() {
    try {
      return typeof window !== 'undefined' &&
             typeof localStorage !== 'undefined' &&
             window.localStorage !== null;
    } catch {
      return false;
    }
  },

  getItem(key) {
    if (!this.isAvailable) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      // Handle quota exceeded, private browsing, etc.
      return null;
    }
  },

  setItem(key, value) {
    if (!this.isAvailable) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if storage is unavailable
    }
  },

  removeItem(key) {
    if (!this.isAvailable) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  },
};


/**
 * Compute a filter hash from filtered entries for cache key uniqueness.
 * Uses first 6 chars of hash of sorted entry IDs.
 * @param {Array} filteredEntries - Filtered journal entries
 * @returns {string} 6-character hash
 */
export function computeFilterHash(filteredEntries) {
  if (!Array.isArray(filteredEntries) || filteredEntries.length === 0) {
    return '000000';
  }
  const ids = filteredEntries.map(e => e?.id || '').filter(Boolean).sort().join(',');
  return djb2Hash(ids).toString(16).slice(0, 6).padStart(6, '0');
}

/**
 * Build a cache key for the season narrative.
 *
 * Key format: {userId}:{viewType}:{windowStart}:{windowEnd}:{locale}:{timezone}
 *
 * @param {Object} options
 * @param {string} options.userId - User ID
 * @param {boolean} options.filtersActive - Whether filters are active
 * @param {Array} options.filteredEntries - Filtered entries (for hash when filtered)
 * @param {Object} options.seasonWindow - { start: Date, end: Date }
 * @param {string} options.locale - BCP 47 locale tag
 * @param {string} options.timezone - IANA timezone
 * @returns {string} Cache key
 */
export function buildSeasonKey({
  userId,
  filtersActive,
  filteredEntries,
  seasonWindow,
  locale = 'en-US',
  timezone,
}) {
  const viewType = filtersActive
    ? `filtered:${computeFilterHash(filteredEntries)}`
    : 'default';

  const startDate = seasonWindow?.start?.toISOString?.()?.split('T')[0] || 'unknown';
  const endDate = seasonWindow?.end?.toISOString?.()?.split('T')[0] || 'unknown';
  const tz = timezone || (typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC');

  return `${userId || 'anon'}:${viewType}:${startDate}:${endDate}:${locale}:${tz}`;
}

/**
 * Get cached narrative — ONLY for authenticated users with valid userId.
 * Returns null for guests to prevent cross-user leakage.
 *
 * @param {string} userId - User ID (null for guests)
 * @param {string} seasonKey - Cache key from buildSeasonKey
 * @returns {string|null} Cached narrative or null
 */
export function getCachedNarrative(userId, seasonKey) {
  // SECURITY: Never cache for unauthenticated users
  if (!userId || userId === 'undefined' || userId === 'null') {
    return null;
  }

  if (!safeStorage.isAvailable) return null;

  const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
  if (!raw) return null;

  try {
    const cache = JSON.parse(raw);
    const entry = cache[`${userId}:${seasonKey}`];
    if (!entry) return null;

    // Check TTL (24 hours)
    if (Date.now() - entry.timestamp > NARRATIVE_CACHE_TTL) {
      return null;
    }

    return entry.narrative;
  } catch {
    return null;
  }
}

/**
 * Set cached narrative — ONLY for authenticated users.
 * Silently no-ops for guests and filtered views.
 *
 * @param {string} userId - User ID (null for guests)
 * @param {string} seasonKey - Cache key from buildSeasonKey
 * @param {string} narrative - Narrative text to cache
 */
export function setCachedNarrative(userId, seasonKey, narrative) {
  // SECURITY: Never cache for unauthenticated users
  if (!userId || userId === 'undefined' || userId === 'null') {
    return;
  }

  // Don't cache filtered views
  if (seasonKey.includes('filtered:')) return;

  if (!safeStorage.isAvailable) return;

  try {
    const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};

    cache[`${userId}:${seasonKey}`] = {
      narrative,
      timestamp: Date.now(),
    };

    safeStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail
  }
}

/**
 * Invalidate all cached narratives for a user.
 * Call on entry save/delete, backfill completion, or logout.
 *
 * @param {string} userId - User ID to invalidate (null to clear all)
 */
export function invalidateNarrativeCache(userId) {
  if (!safeStorage.isAvailable) return;

  // If no userId, clear the entire cache (logout scenario)
  if (!userId) {
    safeStorage.removeItem(NARRATIVE_CACHE_KEY);
    return;
  }

  try {
    const raw = safeStorage.getItem(NARRATIVE_CACHE_KEY);
    if (!raw) return;

    const cache = JSON.parse(raw);
    // Remove all entries for this user
    Object.keys(cache).forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        delete cache[key];
      }
    });
    safeStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // If parse fails, clear the whole cache
    safeStorage.removeItem(NARRATIVE_CACHE_KEY);
  }
}

/**
 * Hard invalidate on logout — clear ALL narrative caches.
 * Export this for use in AuthContext logout handler.
 */
export function clearAllNarrativeCaches() {
  if (!safeStorage.isAvailable) return;
  safeStorage.removeItem(NARRATIVE_CACHE_KEY);
}
