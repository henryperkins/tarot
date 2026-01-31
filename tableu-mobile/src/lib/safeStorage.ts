import { djb2Hash } from './utils';
import { storage } from './storage';

const NARRATIVE_CACHE_KEY = 'journey_narrative_cache';
const NARRATIVE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const safeStorage = {
  isAvailable: storage.isAvailable,
  async getItem(key: string) {
    return storage.getItem(key);
  },
  async setItem(key: string, value: string) {
    await storage.setItem(key, value);
  },
  async removeItem(key: string) {
    await storage.removeItem(key);
  },
};

export function computeFilterHash(filteredEntries: Array<{ id?: string }> = []) {
  if (!Array.isArray(filteredEntries) || filteredEntries.length === 0) {
    return '000000';
  }
  const ids = filteredEntries.map(entry => entry?.id || '').filter(Boolean).sort().join(',');
  return djb2Hash(ids).toString(16).slice(0, 6).padStart(6, '0');
}

export function buildSeasonKey({
  userId,
  filtersActive,
  filteredEntries,
  seasonWindow,
  locale = 'en-US',
  timezone,
}: {
  userId?: string | null;
  filtersActive?: boolean;
  filteredEntries?: Array<{ id?: string }>;
  seasonWindow?: { start?: Date; end?: Date } | null;
  locale?: string;
  timezone?: string;
}) {
  const viewType = filtersActive
    ? `filtered:${computeFilterHash(filteredEntries || [])}`
    : 'default';

  const startDate = seasonWindow?.start?.toISOString?.()?.split('T')[0] || 'unknown';
  const endDate = seasonWindow?.end?.toISOString?.()?.split('T')[0] || 'unknown';
  const tz = timezone || (typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC');

  return `${userId || 'anon'}:${viewType}:${startDate}:${endDate}:${locale}:${tz}`;
}

export async function getCachedNarrative(userId: string | null | undefined, seasonKey: string) {
  if (!userId || userId === 'undefined' || userId === 'null') {
    return null;
  }

  if (!safeStorage.isAvailable) return null;

  const raw = await safeStorage.getItem(NARRATIVE_CACHE_KEY);
  if (!raw) return null;

  try {
    const cache = JSON.parse(raw);
    const entry = cache[`${userId}:${seasonKey}`];
    if (!entry) return null;

    if (Date.now() - entry.timestamp > NARRATIVE_CACHE_TTL) {
      return null;
    }

    return entry.narrative as string;
  } catch {
    return null;
  }
}

export async function setCachedNarrative(
  userId: string | null | undefined,
  seasonKey: string,
  narrative: string,
) {
  if (!userId || userId === 'undefined' || userId === 'null') {
    return;
  }

  if (seasonKey.includes('filtered:')) return;

  if (!safeStorage.isAvailable) return;

  try {
    const raw = await safeStorage.getItem(NARRATIVE_CACHE_KEY);
    const cache = raw ? JSON.parse(raw) : {};

    cache[`${userId}:${seasonKey}`] = {
      narrative,
      timestamp: Date.now(),
    };

    await safeStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently fail
  }
}

export async function invalidateNarrativeCache(userId?: string | null) {
  if (!safeStorage.isAvailable) return;

  if (!userId) {
    await safeStorage.removeItem(NARRATIVE_CACHE_KEY);
    return;
  }

  try {
    const raw = await safeStorage.getItem(NARRATIVE_CACHE_KEY);
    if (!raw) return;

    const cache = JSON.parse(raw);
    Object.keys(cache).forEach(key => {
      if (key.startsWith(`${userId}:`)) {
        delete cache[key];
      }
    });
    await safeStorage.setItem(NARRATIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    await safeStorage.removeItem(NARRATIVE_CACHE_KEY);
  }
}

export async function clearAllNarrativeCaches() {
  if (!safeStorage.isAvailable) return;
  await safeStorage.removeItem(NARRATIVE_CACHE_KEY);
}
