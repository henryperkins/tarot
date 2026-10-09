import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { persistJournalInsights, clearJournalInsightsCache } from '../lib/journalInsights';
import { invalidateNarrativeCache } from '../lib/safeStorage';
import { fetchJournalEntryById } from '../lib/journal/fetchEntryById';
import { generateId } from '../lib/utils';
import { dedupeEntries } from '../../shared/journal/dedupe.js';
import { normalizeTimestamp } from '../../shared/journal/utils.js';
import { readingGesturesEnabled } from '../lib/readingGestureSettings.js';
import { visualStorageNamespace, writeVisualResume, removeVisualResume, patchVisualEntry,
  persistJournalWithVisualFallback, VISUAL_SNAPSHOT_EVENT } from '../lib/readingVisualStorage.js';

const LOCALSTORAGE_KEY = 'tarot_journal';
const CACHE_KEY_PREFIX = 'tarot_journal_cache';
const PAGE_SIZE = 25;
const EMPTY_ENTRIES = [];

/**
 * Get user-scoped cache key to prevent data leakage across accounts
 * @param {string|null} userId - User ID or null for anonymous
 * @returns {string} Scoped cache key
 */
function getCacheKey(userId) {
  if (!userId) return `${CACHE_KEY_PREFIX}_anon`;
  return `${CACHE_KEY_PREFIX}_${userId}`;
}

function getLocalJournalKey(userId) {
  if (!userId) return LOCALSTORAGE_KEY;
  return `${LOCALSTORAGE_KEY}_${userId}`;
}

function sortEntriesNewestFirst(entries) {
  return (Array.isArray(entries) ? entries : []).slice().sort((a, b) => {
    const aTs = normalizeTimestamp(a?.ts) ?? 0;
    const bTs = normalizeTimestamp(b?.ts) ?? 0;
    return bTs - aTs;
  });
}

function readLocalJournalArray(key) {
  if (!key) return [];
  try {
    if (typeof localStorage === 'undefined') return [];
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse localStorage journal key:', key, error);
    return [];
  }
}

/**
 * Journal hook with automatic API/localStorage routing
 *
 * - If user is authenticated: saves to D1 database via API (with local caching)
 * - If user is not authenticated: saves to localStorage
 *
 * This provides backward compatibility while enabling cloud sync for auth users
 */
export function useJournal({ autoLoad = true } = {}) {
  const gestureStudyEnabled = readingGesturesEnabled();
  const { isAuthenticated, user } = useAuth();
  const { canUseCloudJournal } = useSubscription();
  const accountUserId = user?.id;
  const [entryState, setEntryState] = useState({ namespace: visualStorageNamespace(isAuthenticated ? user?.id : null), entries: [] });
  const entries = entryState.namespace === visualStorageNamespace(isAuthenticated ? user?.id : null) ? entryState.entries : EMPTY_ENTRIES;
  const setEntries = useCallback(update => setEntryState(previous => {
    const owner = visualStorageNamespace(isAuthenticated ? user?.id : null);
    const current = previous.namespace === owner ? previous.entries : [];
    return { namespace: owner, entries: typeof update === 'function' ? update(current) : update };
  }), [isAuthenticated, user?.id]);
  const [loading, setLoading] = useState(autoLoad);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    hasMore: false,
    nextCursor: null,
    total: null
  });
  // Track sync state for UX feedback
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastLocalSaveAt, setLastLocalSaveAt] = useState(null);
  const [syncSource, setSyncSource] = useState(null); // 'api' | 'cache' | 'local'
  const hasMoreEntries = pagination.hasMore;
  const prefetchedOnceRef = useRef(false);

  // Track previous user ID to detect account switches
  const prevUserIdRef = useRef(user?.id);
  const namespace = visualStorageNamespace(isAuthenticated ? user?.id : null);
  const namespaceRef = useRef(namespace);
  useLayoutEffect(() => { namespaceRef.current = namespace; }, [namespace]);

  useEffect(() => {
    if (!gestureStudyEnabled) return undefined;
    const receive = event => {
      if (event.detail?.namespace !== namespace) return;
      setEntries(previous => previous.map(entry => patchVisualEntry(entry, event.detail)));
    };
    window.addEventListener(VISUAL_SNAPSHOT_EVENT, receive);
    return () => window.removeEventListener(VISUAL_SNAPSHOT_EVENT, receive);
  }, [gestureStudyEnabled, namespace, setEntries]);

  // Cloud entries may be saved before annotation completes. Their owned journal
  // endpoint supplies the latest durable snapshot, without a private capability.
  useEffect(() => {
    if (!gestureStudyEnabled || !autoLoad || !isAuthenticated || !canUseCloudJournal) return undefined;
    const pending = entries.filter(entry => entry.visual && !['complete', 'failed', 'error', 'expired', 'cancelled'].includes(entry.visual.status));
    if (!pending.length) return undefined;
    const controller = new AbortController();
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      for (const entry of pending) {
        try {
          const response = await fetch(`/api/journal/${encodeURIComponent(entry.id)}?includeFollowups=true`, {
            credentials: 'include', signal: controller.signal
          });
          if (!response.ok) continue;
          const data = await response.json();
          if (controller.signal.aborted || namespaceRef.current !== namespace || !data.entry) return;
          setEntries(previous => {
            const next = previous.map(existing => existing.id === entry.id
              && existing.personalReading === data.entry.personalReading ? data.entry : existing);
            try { localStorage.setItem(getCacheKey(user?.id), JSON.stringify(next)); } catch { /* Optional cache. */ }
            return next;
          });
        } catch { /* Offline: retain the cached prose and retry on the next load. */ }
      }
      polling = false;
    }, 3000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [gestureStudyEnabled, autoLoad, entries, isAuthenticated, canUseCloudJournal, namespace, user?.id, setEntries]);

  const persistInsights = useCallback((entriesToPersist) => {
    const result = persistJournalInsights(entriesToPersist, user?.id);
    if (result?.error) {
      console.warn('Unable to persist journal insights cache:', result.error);
    }
    return result;
  }, [user?.id]);

  // Clear stale cache when user changes (login/logout/switch accounts)
  useEffect(() => {
    const currentUserId = user?.id;
    const prevUserId = prevUserIdRef.current;

    if (prevUserId !== currentUserId) {
      // Clear in-memory entries immediately to avoid showing prior account data.
      setEntries([]);
      setError(null);

      // User changed - clear old user's cache to prevent leakage
      if (prevUserId && typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(getCacheKey(prevUserId));
          clearJournalInsightsCache(prevUserId);
        } catch (e) {
          console.warn('Failed to clear previous user cache:', e);
        }
      }
      prevUserIdRef.current = currentUserId;
    }
  }, [user?.id, setEntries]);

  // Load entries on mount or when auth state changes
  useEffect(() => {
    if (!autoLoad && isAuthenticated) {
      return;
    }
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadEntries is stable, avoid infinite loop
  }, [isAuthenticated, canUseCloudJournal, autoLoad, user?.id]);

  const buildApiUrl = useCallback((cursor) => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('includeFollowups', 'true');
    if (cursor) {
      params.set('cursor', String(cursor));
    }
    return `/api/journal?${params.toString()}`;
  }, []);

  async function loadEntries() {
    prefetchedOnceRef.current = false;
    setLoading(true);
    setError(null);
    setPagination({
      hasMore: false,
      nextCursor: null,
      total: null
    });

    try {
      if (isAuthenticated && canUseCloudJournal) {
        // Try loading from API first
        try {
          const response = await fetch(buildApiUrl(), {
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error('Failed to load journal entries');
          }

          const data = await response.json();
          if (namespaceRef.current !== namespace) return;
          const apiEntries = dedupeEntries(data.entries || []);
          setEntries(apiEntries);
          setPagination({
            hasMore: Boolean(data?.pagination?.hasMore),
            nextCursor: data?.pagination?.nextCursor || null,
            total: data?.pagination?.total ?? apiEntries.length
          });

          // Track successful API sync
          setLastSyncAt(Date.now());
          setSyncSource('api');

          // Update user-scoped cache
          if (typeof localStorage !== 'undefined') {
            const cacheKey = getCacheKey(user?.id);
            try {
              localStorage.setItem(cacheKey, JSON.stringify(apiEntries));
            } catch (quotaErr) {
              console.warn('localStorage quota exceeded, skipping cache:', quotaErr);
            }
            persistInsights(apiEntries);
          }
        } catch (apiError) {
          if (namespaceRef.current !== namespace) return;
          console.warn('API load failed, falling back to cache:', apiError);
          // Fallback to user-scoped cache
          if (typeof localStorage !== 'undefined') {
            const cacheKey = getCacheKey(user?.id);
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsedCache = dedupeEntries(JSON.parse(cached));
              setEntries(parsedCache);
              persistInsights(parsedCache);
              // Don't set error if we have cache, just warn
              setPagination({
                hasMore: false,
                nextCursor: null,
                total: parsedCache.length
              });
              // Mark as cache fallback (stale data)
              setSyncSource('cache');
            } else {
              throw apiError;
            }
          } else {
            throw apiError;
          }
        }
      } else {
        // Load from localStorage (anonymous or authenticated without cloud entitlements)
        setSyncSource('local');
        if (typeof localStorage === 'undefined') {
          setEntries([]);
          if (typeof window !== 'undefined') {
            persistInsights([]);
          }
        } else {
          const localKey = getLocalJournalKey(isAuthenticated ? user?.id : null);
          const stored = localStorage.getItem(localKey);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const safeEntries = dedupeEntries(Array.isArray(parsed) ? parsed : []);
              setEntries(safeEntries);
              if (typeof window !== 'undefined') {
                persistInsights(safeEntries);
              }
              setPagination({
                hasMore: false,
                nextCursor: null,
                total: safeEntries.length
              });
            } catch (err) {
      if (namespaceRef.current !== namespace) return;
              console.error('Failed to parse localStorage journal:', err);
              setEntries([]);
              if (typeof window !== 'undefined') {
                persistInsights([]);
              }
              setPagination({
                hasMore: false,
                nextCursor: null,
                total: 0
              });
            }
          } else {
            setEntries([]);
            if (typeof window !== 'undefined') {
              persistInsights([]);
            }
            setPagination({
              hasMore: false,
              nextCursor: null,
              total: 0
            });
          }
        }
      }
    } catch (err) {
      if (namespaceRef.current !== namespace) return;
      console.error('Failed to load journal entries:', err);
      setError(err.message);
      setEntries([]);
      setPagination({
        hasMore: false,
        nextCursor: null,
        total: 0
      });
    } finally {
      if (namespaceRef.current === namespace) setLoading(false);
    }
  };

  const loadMoreEntries = useCallback(async ({ prefetch = false } = {}) => {
    if (!isAuthenticated || !canUseCloudJournal) return { success: false, appended: 0 };
    if (!pagination.hasMore || !pagination.nextCursor) return { success: true, appended: 0 };
    if (loadingMore) return { success: true, appended: 0 };

    if (!prefetch) {
      prefetchedOnceRef.current = false;
    }

    setLoadingMore(true);
    try {
      const response = await fetch(buildApiUrl(pagination.nextCursor), { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to load more entries');
      }
      const data = await response.json();
      if (namespaceRef.current !== namespace) return { success: false, appended: 0 };
      const newEntries = Array.isArray(data?.entries) ? data.entries : [];
      setEntries((prev) => {
        const next = dedupeEntries([...(Array.isArray(prev) ? prev : []), ...newEntries]);
        if (typeof window !== 'undefined') {
          persistInsights(next);
          if (accountUserId) {
            try {
              localStorage.setItem(getCacheKey(accountUserId), JSON.stringify(next));
            } catch (quotaErr) {
              console.warn('localStorage quota exceeded, skipping cache update:', quotaErr);
            }
          }
        }
        return next;
      });
      setPagination({
        hasMore: Boolean(data?.pagination?.hasMore),
        nextCursor: data?.pagination?.nextCursor || null,
        total: data?.pagination?.total ?? pagination.total
      });
      return { success: true, appended: newEntries.length };
    } catch (err) {
      if (namespaceRef.current !== namespace) return { success: false, appended: 0 };
      if (!prefetch) {
        console.error('Failed to load more journal entries:', err);
        setError(err.message || 'Unable to load more entries');
      }
      return { success: false, appended: 0, error: err?.message || 'Unable to load more entries' };
    } finally {
      if (namespaceRef.current === namespace) setLoadingMore(false);
    }
  }, [buildApiUrl, canUseCloudJournal, isAuthenticated, loadingMore, pagination.hasMore, pagination.nextCursor, pagination.total, persistInsights, accountUserId, namespace, setEntries]);

  const fetchEntryById = useCallback(async (entryId, { includeFollowups = true } = {}) => {
    const userId = user?.id;
    const result = await fetchJournalEntryById(entryId, {
      includeFollowups,
      isAuthenticated,
      canUseCloudJournal
    });

    if (namespaceRef.current !== namespace) return { entry: null, status: 'skipped' };
    if (result.status !== 'found') {
      if (result.status === 'error') {
        console.error('Failed to fetch journal entry:', result?.message);
        setError(result.message || 'Unable to load journal entry');
      }
      return result;
    }

    const entry = result.entry;
    setEntries((prev) => {
      const prevEntries = Array.isArray(prev) ? prev : [];
      const next = dedupeEntries([entry, ...prevEntries]);

      setPagination((prevPag) => ({
        ...prevPag,
        total: typeof prevPag?.total === 'number'
          ? Math.max(prevPag.total, next.length)
          : next.length
      }));

      if (typeof window !== 'undefined') {
        persistInsights(next);
        if (userId) {
          try {
            localStorage.setItem(getCacheKey(userId), JSON.stringify(next));
          } catch (quotaErr) {
            console.warn('localStorage quota exceeded, skipping cache update:', quotaErr);
          }
        }
      }

      return next;
    });

    return result;
  }, [canUseCloudJournal, isAuthenticated, persistInsights, user?.id, namespace, setEntries]);

  // Prefetch the next page on idle to reduce perceived latency on long histories
  useEffect(() => {
    if (prefetchedOnceRef.current) return;
    if (!pagination.hasMore || loading || loadingMore) return;
    if (!isAuthenticated || !canUseCloudJournal) return;

    const schedule = () => {
      prefetchedOnceRef.current = true;
      void loadMoreEntries({ prefetch: true });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(schedule, { timeout: 800 });
      return () => {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    const timer = setTimeout(schedule, 500);
    return () => clearTimeout(timer);
  }, [canUseCloudJournal, isAuthenticated, loadMoreEntries, loading, loadingMore, pagination.hasMore]);

  const saveEntry = async (entry, { visualResume = null } = {}) => {
    setError(null);

    // Capture userId before async operations to avoid stale closure issues
    const userId = user?.id;

    try {
      if (isAuthenticated && canUseCloudJournal) {
        // Save to API
        const response = await fetch('/api/journal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(entry)
        });

        if (!response.ok) {
          throw new Error('Failed to save journal entry');
        }

        const data = await response.json();

        // Build entry object from server response
        const newEntry = {
          id: data.entry.id,
          ts: data.entry.ts,
          ...entry,
          ...data.entry,
          ...(data.visual ? { visual: data.visual } : {})
        };
        if (namespaceRef.current !== namespace) return { success: true, entry: newEntry };

        // If server detected a duplicate (same session_seed), skip local state
        // updates to keep client in sync with DB
        if (data.deduplicated) {
          const stored = await fetchJournalEntryById(data.entry.id, { isAuthenticated: true, canUseCloudJournal: true });
          return { success: true, entry: stored.entry || { id: data.entry.id, ts: data.entry.ts }, deduplicated: true };
        }

        // Add to local state - prepend and dedupe in one pass
        setEntries(prev => {
          const prevEntries = Array.isArray(prev) ? prev : [];
          const next = dedupeEntries([newEntry, ...prevEntries]);

          setPagination((prevPag) => ({
            ...prevPag,
            total: typeof prevPag?.total === 'number' ? prevPag.total + 1 : next.length
          }));

          // Update cache
          if (typeof window !== 'undefined') {
            persistInsights(next);
            if (userId) {
              try {
                localStorage.setItem(getCacheKey(userId), JSON.stringify(next));
              } catch (quotaErr) {
                console.warn('localStorage quota exceeded, skipping cache update:', quotaErr);
              }
            }
          }
          return next;
        });

        // Track card appearances for archetype journey analytics.
        // Include entryId + minimal themes payload so server can track knowledge-graph patterns.
        if (Array.isArray(entry.cards) && entry.cards.length > 0) {
          const graphKeys = entry?.themes?.knowledgeGraph?.graphKeys;
          const themesForTracking = graphKeys
            ? { knowledgeGraph: { graphKeys } }
            : null;
          trackCardAppearances(entry.cards, newEntry.ts, newEntry.id, themesForTracking);
        }

        // Invalidate narrative cache since entry data has changed
        if (userId) {
          invalidateNarrativeCache(userId);
        }

        return { success: true, entry: newEntry };
      } else {
        // Save to localStorage (anonymous or authenticated without cloud entitlements)
        if (typeof localStorage === 'undefined') {
          return { success: false, error: 'localStorage not available' };
        }

        const savedAt = Date.now();
        const newEntry = {
          id: generateId('local'),
          ts: savedAt,
          ...entry
        };

        // Persist synchronously before reporting success; another hook instance's
        // entries may be stale, so merge with the actual scoped storage bucket.
        const localKey = getLocalJournalKey(isAuthenticated ? userId : null);
        const existing = readLocalJournalArray(localKey);
        const duplicate = entry.sessionSeed && existing.find(item => item.sessionSeed === entry.sessionSeed);
        if (duplicate) return { success: true, entry: duplicate, deduplicated: true };
        const next = dedupeEntries([newEntry, ...existing]).slice(0, 100);
        const persisted = persistJournalWithVisualFallback({ key: localKey, entries: next });
        if (!persisted.ok) return { success: false, error: 'Your browser could not save this reading. Free some storage and try again.' };
        if (gestureStudyEnabled && visualResume && entry.visualBinding) writeVisualResume({ namespace, binding: entry.visualBinding,
          resumeHandle: visualResume, expiresAt: visualResume.expiresAt });
        setEntries(persisted.entries);
        setPagination({ hasMore: false, nextCursor: null, total: persisted.entries.length });
        setLastLocalSaveAt(savedAt);
        persistInsights(persisted.entries);

        return { success: true, entry: newEntry };
      }
    } catch (err) {
      console.error('Failed to save journal entry:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Track card appearances for archetype journey analytics
   */
  const trackCardAppearances = async (cards, timestamp, entryId, themes) => {
    if (!isAuthenticated) {
      return; // Only track for authenticated users
    }

    try {
      await fetch('/api/archetype-journey/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          cards,
          timestamp,
          entryId,
          themes
        })
      });
      // Silent failure - don't block reading save if tracking fails
    } catch (err) {
      console.warn('Failed to track card appearances:', err);
    }
  };

  const deleteEntry = async (entryId) => {
    setError(null);

    try {
      if (isAuthenticated && canUseCloudJournal) {
        // Delete from API
        const response = await fetch(`/api/journal/${entryId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to delete journal entry');
        }

        if (namespaceRef.current !== namespace) return { success: true };
        // Remove from local state
        setEntries(prev => {
          const removed = prev.find(entry => entry.id === entryId);
          const next = prev.filter(e => e.id !== entryId);
          if (removed?.readingResultId && !next.some(entry => entry.readingResultId === removed.readingResultId)) {
            removeVisualResume({ namespace, readingResultId: removed.readingResultId });
          }
          setPagination((prevPag) => ({
            ...prevPag,
            total: typeof prevPag?.total === 'number' && prevPag.total > 0 ? prevPag.total - 1 : Math.max(0, next.length)
          }));
          if (typeof window !== 'undefined') {
            persistInsights(next);
            const cacheKey = getCacheKey(user?.id);
            try {
              localStorage.setItem(cacheKey, JSON.stringify(next));
            } catch (quotaErr) {
              console.warn('localStorage quota exceeded, skipping cache update:', quotaErr);
            }
          }
          return next;
        });

        // Invalidate narrative cache since entry data has changed
        // Guard: only invalidate if we have a valid userId to avoid clearing all caches
        if (user?.id) {
          invalidateNarrativeCache(user.id);
        }

        return { success: true };
      } else {
        // Delete from localStorage (anonymous or authenticated without cloud entitlements)
        if (typeof localStorage === 'undefined') {
          return { success: false, error: 'localStorage not available' };
        }

        setEntries(prev => {
          const removed = prev.find(entry => entry.id === entryId);
          const next = prev.filter(e => e.id !== entryId);
          if (removed?.readingResultId && !next.some(entry => entry.readingResultId === removed.readingResultId)) {
            removeVisualResume({ namespace, readingResultId: removed.readingResultId });
          }
          setPagination((prevPag) => ({
            ...prevPag,
            total: typeof prevPag?.total === 'number' && prevPag.total > 0 ? prevPag.total - 1 : Math.max(0, next.length)
          }));
          try {
            const localKey = getLocalJournalKey(isAuthenticated ? user?.id : null);
            localStorage.setItem(localKey, JSON.stringify(next));
            setLastLocalSaveAt(Date.now());
          } catch (quotaErr) {
            console.warn('localStorage quota exceeded, skipping storage update:', quotaErr);
          }
          if (typeof window !== 'undefined') {
            persistInsights(next);
          }
          return next;
        });

        return { success: true };
      }
    } catch (err) {
      console.error('Failed to delete journal entry:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  /**
   * Import legacy unscoped localStorage entries into the authenticated user's
   * scoped localStorage bucket.
   *
   * This is intentionally NOT automatic to avoid cross-account leakage on
   * shared devices. The user must explicitly trigger this import.
   */
  const importLegacyLocalEntries = async ({ removeLegacy = true } = {}) => {
    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated', imported: 0, skipped: 0 };
    }

    // If the user has cloud journal, the correct path is migrateToCloud().
    if (canUseCloudJournal) {
      return { success: false, error: 'Cloud journal enabled; use migration to cloud', imported: 0, skipped: 0 };
    }

    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'localStorage not available', imported: 0, skipped: 0 };
    }

    const userId = user?.id;
    if (!userId) {
      return { success: false, error: 'Missing user id', imported: 0, skipped: 0 };
    }

    const legacyEntriesRaw = readLocalJournalArray(LOCALSTORAGE_KEY);
    const legacyEntries = dedupeEntries(legacyEntriesRaw);
    if (!legacyEntries.length) {
      return { success: true, imported: 0, skipped: 0 };
    }

    const scopedKey = getLocalJournalKey(userId);
    const scopedExistingRaw = readLocalJournalArray(scopedKey);
    const scopedExisting = dedupeEntries(scopedExistingRaw);

    const merged = dedupeEntries([...legacyEntries, ...scopedExisting]);
    const ordered = sortEntriesNewestFirst(merged);

    // Keep local journal bounded to avoid quota issues.
    const next = ordered.slice(0, 100);

    try {
      localStorage.setItem(scopedKey, JSON.stringify(next));
      setLastLocalSaveAt(Date.now());
      if (removeLegacy) {
        localStorage.removeItem(LOCALSTORAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to import legacy local journal entries:', error);
      return { success: false, error: 'Unable to write localStorage', imported: 0, skipped: 0 };
    }

    setEntries(next);
    if (typeof window !== 'undefined') {
      persistInsights(next);
    }

    const imported = Math.max(0, next.length - scopedExisting.length);
    const skipped = Math.max(0, legacyEntries.length - imported);

    return { success: true, imported, skipped };
  };

  const migrateToCloud = async () => {
    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated', skipped: 0 };
    }

    if (!canUseCloudJournal) {
      return { success: false, error: 'Cloud journal sync requires Plus or Pro', skipped: 0 };
    }

    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'localStorage not available', skipped: 0 };
    }

    try {
      const candidateKeys = [
        LOCALSTORAGE_KEY,
        getLocalJournalKey(user?.id || null)
      ].filter(Boolean);

      const localEntries = candidateKeys.flatMap((key) => {
        try {
          const stored = localStorage.getItem(key);
          if (!stored) return [];
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.warn('Failed to parse local journal storage during migration:', error);
          return [];
        }
      });

      const dedupedLocalEntries = dedupeEntries(localEntries);
      if (!dedupedLocalEntries.length) {
        return { success: true, migrated: 0, skipped: 0 };
      }

      // Fetch existing cloud entries to check for duplicates
      const existingResponse = await fetch('/api/journal?all=true&includeFollowups=true', {
        credentials: 'include'
      });

      const existingSeeds = new Set();
      const existingCompositeKeys = new Set();
      if (existingResponse.ok) {
        const { entries: cloudEntries } = await existingResponse.json();
        // Build sets for deduplication
        cloudEntries.forEach(entry => {
          // Primary: track by session_seed
          if (entry.sessionSeed) {
            existingSeeds.add(entry.sessionSeed);
          }
          // Fallback: track by composite key for entries without sessionSeed
          const timestamp = entry.ts || entry.created_at * 1000 || entry.updated_at * 1000;
          if (timestamp) {
            const cardsFingerprint = (Array.isArray(entry?.cards) ? entry.cards : [])
              .map((card) => `${card?.name || 'card'}:${card?.orientation || (card?.isReversed ? 'reversed' : 'upright')}`)
              .join(',');
            const compositeKey = `${timestamp}_${entry.question || ''}_${entry.spreadKey || ''}_${cardsFingerprint}`;
            existingCompositeKeys.add(compositeKey);
          }
        });
      }

      // Upload each entry to the API, skipping duplicates
      let migrated = 0;
      let skipped = 0;
      for (const entry of dedupedLocalEntries) {
        try {
          let isDuplicate = false;

          // Primary: Check by session_seed
          if (entry.sessionSeed && existingSeeds.has(entry.sessionSeed)) {
            isDuplicate = true;
          }

          // Fallback: Check by composite key (timestamp + question + spread + cards)
          if (!isDuplicate && !entry.sessionSeed && entry.ts) {
            const cardsFingerprint = (Array.isArray(entry?.cards) ? entry.cards : [])
              .map((card) => `${card?.name || 'card'}:${card?.orientation || (card?.isReversed ? 'reversed' : 'upright')}`)
              .join(',');
            const compositeKey = `${entry.ts}_${entry.question || ''}_${entry.spreadKey || ''}_${cardsFingerprint}`;
            if (existingCompositeKeys.has(compositeKey)) {
              isDuplicate = true;
            }
          }

          if (isDuplicate) {
            skipped++;
            continue;
          }

          const response = await fetch('/api/journal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              // Preserve the original local timestamp when migrating so the
              // server can store an accurate created_at for historical entries.
              ...entry,
              timestampMs: typeof entry.ts === 'number' ? entry.ts : undefined
            })
          });

          if (response.ok) {
            migrated++;
            // Add to sets to prevent duplicate uploads in this batch
            if (entry.sessionSeed) {
              existingSeeds.add(entry.sessionSeed);
            }
            if (entry.ts) {
              const cardsFingerprint = (Array.isArray(entry?.cards) ? entry.cards : [])
                .map((card) => `${card?.name || 'card'}:${card?.orientation || (card?.isReversed ? 'reversed' : 'upright')}`)
                .join(',');
              const compositeKey = `${entry.ts}_${entry.question || ''}_${entry.spreadKey || ''}_${cardsFingerprint}`;
              existingCompositeKeys.add(compositeKey);
            }
          }
        } catch (err) {
          console.error('Failed to migrate entry:', err);
        }
      }

      // Only clear localStorage when we've either migrated or explicitly
      // skipped every entry in this batch. If some entries failed to upload
      // (e.g. due to a flaky network), keep the local copy so the user can
      // retry the migration later without losing data.
      const totalLocal = dedupedLocalEntries.length;
      if (totalLocal > 0 && migrated + skipped === totalLocal) {
        candidateKeys.forEach((key) => {
          if (key) localStorage.removeItem(key);
        });
      }

      // Reload entries from API
      await loadEntries();

      // Invalidate narrative cache since entry data has changed
      // Guard: only invalidate if we have a valid userId to avoid clearing all caches
      if (migrated > 0 && user?.id) {
        invalidateNarrativeCache(user.id);
      }

      return {
        success: true,
        migrated,
        skipped
      };
    } catch (err) {
      console.error('Migration failed:', err);
      return { success: false, error: err.message };
    }
  };

  return {
    entries,
    loading,
    loadingMore,
    error,
    pageSize: PAGE_SIZE,
    hasMoreEntries,
    totalEntries: pagination.total ?? entries.length,
    hasTotalEntries: typeof pagination.total === 'number',
    // Sync state for UX feedback
    lastSyncAt,
    lastLocalSaveAt,
    syncSource,
    saveEntry,
    deleteEntry,
    migrateToCloud,
    importLegacyLocalEntries,
    reload: loadEntries,
    loadEntries,
    loadMoreEntries,
    fetchEntryById
  };
}
