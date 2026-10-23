import { sameJournalReading } from '../../shared/journal/readingIdentity.js';
import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { persistJournalInsights, clearJournalInsightsCache } from '../lib/journalInsights';
import { invalidateNarrativeCache } from '../lib/safeStorage';
import { fetchJournalEntryById } from '../lib/journal/fetchEntryById';
import { readLocalJournalEntries, writeLocalJournalEntries, withLocalJournalStorageLock } from '../lib/journal/localJournalStorage.js';
import { generateId } from '../lib/utils';
import { dedupeEntries } from '../../shared/journal/dedupe.js';
import { readingGesturesEnabled, readingVisualRequestsEnabled } from '../lib/readingGestureSettings.js';
import { isDeletedAccount, subscribeToDeletedAccounts } from '../lib/deletedAccountStorage.js';
import { filterDeletedJournalEntries, isDeletedJournalEntry, isDeletedJournalResult, purgeDeletedJournalEntryStorage,
  subscribeToDeletedJournalEntries, journalNamespaceForKey } from '../lib/deletedJournalEntryStorage.js';
import { visualStorageNamespace, writeVisualResume, patchVisualEntry,
  VISUAL_SNAPSHOT_EVENT, readSavedVisualEntry, projectJournalEntryVisuals,
  mergeCachedJournalVisuals, needsCloudVisualRefresh, requestSavedVisualRetry, adoptEntryVisuals,
  savedVisualSourceKey, publicVisualRetryState } from '../lib/readingVisualStorage.js';

const LOCALSTORAGE_KEY = 'tarot_journal';
const CACHE_KEY_PREFIX = 'tarot_journal_cache';
const PAGE_SIZE = 25;
const EMPTY_ENTRIES = [];
// One explicit retry per owner/entry in this tab; the server claim covers other tabs.
const retryFlights = new Map();

function mapChanged(entries, map) {
  let changed = false;
  const next = entries.map(entry => {
    const value = map(entry);
    if (value !== entry) changed = true;
    return value;
  });
  return changed ? next : entries;
}


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
export function useJournal({ autoLoad = true, completeHistory = false } = {}) {
  const gestureStudyEnabled = readingGesturesEnabled();
  const visualRequestsEnabled = readingVisualRequestsEnabled();
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const { canUseCloudJournal } = useSubscription();
  const namespace = visualStorageNamespace(isAuthenticated ? user?.id : null);
  const namespaceRef = useRef(namespace);
  // Account exports must include unmigrated device readings on paid tiers too.
  // Read only this signed-in owner's bucket and fail instead of hiding damage.
  const loadDeviceEntries = useCallback(() => {
    if (!isAuthenticated || !userId || isDeletedAccount(userId) || namespaceRef.current !== namespace) {
      throw new Error('This account is no longer available. Please sign in again.');
    }
    try {
      if (typeof localStorage === 'undefined') throw new Error('Storage unavailable.');
      const stored = localStorage.getItem(getLocalJournalKey(userId));
      if (stored === null) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
        throw new Error('Expected a journal entry list.');
      }
      // Backup every saved record. Display deduplication can collapse distinct
      // legacy entries with the same timestamp, spread and cards.
      return filterDeletedJournalEntries(namespace, parsed).map(projectJournalEntryVisuals);
    } catch (error) {
      throw new Error('Unable to read your saved journal.', { cause: error });
    }
  }, [isAuthenticated, userId, namespace]);
  const [entryState, setEntryState] = useState({ namespace: visualStorageNamespace(isAuthenticated ? user?.id : null), entries: [] });
  const entries = !isDeletedAccount(userId) && entryState.namespace === visualStorageNamespace(isAuthenticated ? user?.id : null)
    ? filterDeletedJournalEntries(entryState.namespace, entryState.entries) : EMPTY_ENTRIES;
  const setEntries = useCallback(update => setEntryState(previous => {
    const owner = visualStorageNamespace(isAuthenticated ? user?.id : null);
    // React can execute an already queued updater after the deletion response.
    // Never invoke its cache/insight side effects for the deleted owner.
    if (isDeletedAccount(user?.id)) return { namespace: owner, entries: EMPTY_ENTRIES };
    if (namespaceRef.current !== owner) return previous;
    const current = filterDeletedJournalEntries(owner, previous.namespace === owner ? previous.entries : []);
    return { namespace: owner, entries: filterDeletedJournalEntries(owner, typeof update === 'function' ? update(current) : update) };
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
  useLayoutEffect(() => {
    namespaceRef.current = isDeletedAccount(userId) ? null : namespace;
    return subscribeToDeletedAccounts(owner => {
      if (owner !== userId) return;
      namespaceRef.current = null;
      setEntries([]);
    });
  }, [namespace, userId, setEntries]);

  const entriesRef = useRef(entries);
  useLayoutEffect(() => { entriesRef.current = entries; }, [entries]);
  useLayoutEffect(() => subscribeToDeletedJournalEntries(owner => {
    if (owner !== namespaceRef.current) return;
    entriesRef.current = filterDeletedJournalEntries(owner, entriesRef.current);
    setEntries(previous => filterDeletedJournalEntries(owner, previous));
  }), [setEntries]);
  // A namespace captured by an unmounted instance is stale: late work is discarded.
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Owned journal refresh: server-authoritative public state, never inference.
  // Older public state, changed prose and other owners are never applied.
  const refreshCloudVisual = useCallback(async (entryId, signal) => {
    if (!visualRequestsEnabled) return;
    const response = await fetch(`/api/journal/${encodeURIComponent(entryId)}?includeFollowups=true`, {
      credentials: 'include', signal
    });
    if (!response.ok) return;
    const data = await response.json();
    if (signal?.aborted || isDeletedAccount(userId) || namespaceRef.current !== namespace || !data.entry) return;
    const incoming = projectJournalEntryVisuals(data.entry);
    setEntries(previous => {
      const next = mapChanged(previous, existing => {
        if (existing.id !== entryId || existing.personalReading !== incoming.personalReading) return existing;
        const before = publicVisualRetryState(existing.visualState)?.stateVersion ?? -1;
        const after = publicVisualRetryState(incoming.visualState)?.stateVersion ?? -1;
        return after < before ? existing : mergeCachedJournalVisuals(incoming, existing);
      });
      if (next !== previous) {
        try { localStorage.setItem(getCacheKey(userId), JSON.stringify(filterDeletedJournalEntries(journalNamespaceForKey(getCacheKey(userId)), next))); } catch { /* Optional cache. */ }
      }
      return next;
    });
  }, [namespace, setEntries, userId, visualRequestsEnabled]);

  useEffect(() => {
    if (!gestureStudyEnabled) return undefined;
    const cloud = autoLoad && isAuthenticated && canUseCloudJournal;
    const receive = event => {
      const detail = event.detail;
      if (detail?.namespace !== namespace) return;
      if (detail.entryId) {
        // Entry-scoped notices carry no data: adopt the committed public copy.
        const stored = readSavedVisualEntry({ namespace, entryId: detail.entryId });
        if (stored) setEntries(previous => mapChanged(previous, entry => entry.id === detail.entryId ? adoptEntryVisuals(entry, stored) : entry));
        if (visualRequestsEnabled && detail.refresh && cloud) refreshCloudVisual(detail.entryId).catch(() => { /* Polling retries. */ });
        return;
      }
      setEntries(previous => mapChanged(previous, entry => patchVisualEntry(entry, detail)));
    };
    window.addEventListener(VISUAL_SNAPSHOT_EVENT, receive);
    return () => window.removeEventListener(VISUAL_SNAPSHOT_EVENT, receive);
  }, [gestureStudyEnabled, namespace, setEntries, autoLoad, isAuthenticated, canUseCloudJournal, refreshCloudVisual, visualRequestsEnabled]);

  // Cloud entries may be saved before annotation completes, or have a pending
  // explicit replay. Their owned journal endpoint supplies the latest durable
  // state and snapshot without a private capability; polling never retries work.
  useEffect(() => {
    if (!visualRequestsEnabled || !autoLoad || !isAuthenticated || !canUseCloudJournal) return undefined;
    const pending = entries.filter(needsCloudVisualRefresh);
    if (!pending.length) return undefined;
    const controller = new AbortController();
    let polling = false;
    const timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try {
        for (const entry of pending) {
          try { await refreshCloudVisual(entry.id, controller.signal); }
          catch { /* Offline: retain the cached prose and retry on the next tick. */ }
          if (controller.signal.aborted || isDeletedAccount(userId) || namespaceRef.current !== namespace) return;
        }
      } finally { polling = false; }
    }, 3000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [visualRequestsEnabled, autoLoad, entries, isAuthenticated, canUseCloudJournal, namespace, userId, refreshCloudVisual]);

  const persistInsights = useCallback((entriesToPersist) => {
    if (isDeletedAccount(user?.id)) return { payload: null, error: null };
    const result = persistJournalInsights(filterDeletedJournalEntries(namespace, entriesToPersist), isAuthenticated ? user?.id : null);
    if (result?.error) {
      console.warn('Unable to persist journal insights cache:', result.error);
    }
    return result;
  }, [user?.id, namespace, isAuthenticated]);

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
          if (!isDeletedAccount(prevUserId)) clearJournalInsightsCache(prevUserId);
        } catch (e) {
          console.warn('Failed to clear previous user cache:', e);
        }
      }
      prevUserIdRef.current = currentUserId;
    }
  }, [user?.id, setEntries]);

  const buildApiUrl = useCallback((cursor) => {
    const params = new URLSearchParams();
    if (completeHistory) params.set('all', 'true');
    else params.set('limit', String(PAGE_SIZE));
    params.set('includeFollowups', 'true');
    if (cursor) {
      params.set('cursor', String(cursor));
    }
    return `/api/journal?${params.toString()}`;
  }, [completeHistory]);

  const loadEntries = useCallback(async () => {
    if (isDeletedAccount(userId)) return { success: false, error: 'This account has been deleted.' };
    prefetchedOnceRef.current = false;
    setLoading(true);
    setError(null);
    setPagination({
      hasMore: false,
      nextCursor: null,
      total: null
    });

    let loadedEntries = [];
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
          if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return;
          // Public projection; a recorded explicit-unavailable outcome or locally
          // validated cache survives only for the same source and server state.
          const cachedById = new Map(readLocalJournalArray(getCacheKey(userId)).map(item => [item?.id, item]));
          const apiEntries = filterDeletedJournalEntries(namespace, dedupeEntries(data.entries || []))
            .map(item => mergeCachedJournalVisuals(projectJournalEntryVisuals(item), cachedById.get(item.id)));
          setEntries(apiEntries);
          loadedEntries = apiEntries;
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
            const cacheKey = getCacheKey(userId);
            try {
              localStorage.setItem(cacheKey, JSON.stringify(filterDeletedJournalEntries(namespace, apiEntries)));
            } catch (quotaErr) {
              console.warn('localStorage quota exceeded, skipping cache:', quotaErr);
            }
            persistInsights(apiEntries);
          }
        } catch (apiError) {
          if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return;
          console.warn('API load failed, falling back to cache:', apiError);
          // Fallback to user-scoped cache
          if (typeof localStorage !== 'undefined') {
            const cacheKey = getCacheKey(userId);
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsedCache = filterDeletedJournalEntries(namespace, dedupeEntries(JSON.parse(cached))).map(projectJournalEntryVisuals);
              setEntries(parsedCache);
              loadedEntries = parsedCache;
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
          const localKey = getLocalJournalKey(isAuthenticated ? userId : null);
          const stored = localStorage.getItem(localKey);
          if (stored !== null) {
            try {
              const parsed = readLocalJournalEntries(localStorage, localKey, stored);
              const safeEntries = filterDeletedJournalEntries(namespace, dedupeEntries(parsed)).map(projectJournalEntryVisuals);
              setEntries(safeEntries);
              loadedEntries = safeEntries;
              if (typeof window !== 'undefined') {
                persistInsights(safeEntries);
              }
              setPagination({
                hasMore: false,
                nextCursor: null,
                total: safeEntries.length
              });
            } catch (err) {
              if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return;
              throw new Error('Unable to read your saved journal.', { cause: err });
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
      if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return { success: false, error: 'Account changed.' };
      return { success: true, entries: loadedEntries };
    } catch (err) {
      if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return;
      console.error('Failed to load journal entries:', err);
      setError(err.message);
      setEntries([]);
      setPagination({
        hasMore: false,
        nextCursor: null,
        total: 0
      });
      return { success: false, error: err.message };
    } finally {
      if (!isDeletedAccount(userId) && namespaceRef.current === namespace) setLoading(false);
    }
  }, [buildApiUrl, canUseCloudJournal, isAuthenticated, persistInsights, userId, namespace, setEntries]);

  // Load only for the committed owner; canceled setup must not start a request.
  useEffect(() => {
    if (!autoLoad && isAuthenticated) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadEntries();
    });
    return () => { cancelled = true; };
  }, [autoLoad, isAuthenticated, loadEntries]);

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
      if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return { success: false, appended: 0 };
      const newEntries = filterDeletedJournalEntries(namespace, data?.entries).map(projectJournalEntryVisuals);
      setEntries((prev) => {
        const next = dedupeEntries([...(Array.isArray(prev) ? prev : []), ...newEntries]);
        if (typeof window !== 'undefined') {
          persistInsights(next);
          if (userId) {
            try {
              localStorage.setItem(getCacheKey(userId), JSON.stringify(filterDeletedJournalEntries(journalNamespaceForKey(getCacheKey(userId)), next)));
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
      if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return { success: false, appended: 0 };
      if (!prefetch) {
        console.error('Failed to load more journal entries:', err);
        setError(err.message || 'Unable to load more entries');
      }
      return { success: false, appended: 0, error: err?.message || 'Unable to load more entries' };
    } finally {
      if (!isDeletedAccount(userId) && namespaceRef.current === namespace) setLoadingMore(false);
    }
  }, [buildApiUrl, canUseCloudJournal, isAuthenticated, loadingMore, pagination.hasMore, pagination.nextCursor, pagination.total, persistInsights, userId, namespace, setEntries]);

  const fetchEntryById = useCallback(async (entryId, { includeFollowups = true } = {}) => {
    const userId = user?.id;
    const result = await fetchJournalEntryById(entryId, {
      includeFollowups,
      isAuthenticated,
      canUseCloudJournal
    });

    if (isDeletedAccount(userId) || namespaceRef.current !== namespace || isDeletedJournalEntry(namespace, entryId)) return { entry: null, status: 'skipped' };
    if (result.status !== 'found') {
      if (result.status === 'error') {
        console.error('Failed to fetch journal entry:', result?.message);
        setError(result.message || 'Unable to load journal entry');
      }
      return result;
    }

    const entry = projectJournalEntryVisuals(result.entry);
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
            localStorage.setItem(getCacheKey(userId), JSON.stringify(filterDeletedJournalEntries(journalNamespaceForKey(getCacheKey(userId)), next)));
          } catch (quotaErr) {
            console.warn('localStorage quota exceeded, skipping cache update:', quotaErr);
          }
        }
      }

      return next;
    });

    return { ...result, entry };
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

  /**
   * Track card appearances for archetype journey analytics
   */
  const trackCardAppearances = useCallback(async (cards, timestamp, entryId, themes) => {
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
  }, [isAuthenticated]);

  const saveEntry = useCallback(async (entry, { visualResume = null } = {}) => {
    if (isDeletedAccount(userId)) return { success: false, error: 'This account has been deleted.' };
    if (isDeletedJournalEntry(namespace, entry?.id) || isDeletedJournalResult(namespace, entry?.readingResultId)) {
      return { success: false, error: 'This reading has been deleted.' };
    }
    setError(null);

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

        // Build entry object from server response. The durable public visual
        // state is authoritative; a submitted local snapshot stays only a
        // locally validated display cache and never implies cloud attachment.
        const newEntry = projectJournalEntryVisuals({
          id: data.entry.id,
          ts: data.entry.ts,
          ...entry,
          ...data.entry,
          ...(data.visual ? { visual: data.visual } : {}),
          ...(data.visualState ? { visualState: data.visualState } : {})
        });
        if (isDeletedAccount(userId) || namespaceRef.current !== namespace || isDeletedJournalEntry(namespace, newEntry.id)
          || isDeletedJournalResult(namespace, newEntry.readingResultId)) return { success: false, error: 'This reading is no longer available.' };

        // If server detected a duplicate (same session_seed), skip local state
        // updates to keep client in sync with DB
        if (data.deduplicated) {
          const stored = await fetchJournalEntryById(data.entry.id, { isAuthenticated: true, canUseCloudJournal: true });
          if (isDeletedAccount(userId) || namespaceRef.current !== namespace || isDeletedJournalEntry(namespace, data.entry.id)) {
            return { success: false, error: 'This reading is no longer available.' };
          }
          return { success: true, entry: stored.entry ? projectJournalEntryVisuals(stored.entry) : { id: data.entry.id, ts: data.entry.ts }, deduplicated: true };
        }

        // Pending original cues resume from the private owner-scoped handle. A
        // response arriving after this instance unmounted (for example after the
        // user left and signed out) writes nothing; cloud pending state is polled.
        if (visualRequestsEnabled && visualResume && entry.visualBinding && mountedRef.current
          && (!visualResume.namespace || visualResume.namespace === namespace)) {
          writeVisualResume({ namespace, entryId: newEntry.id, binding: entry.visualBinding, resumeHandle: visualResume, expiresAt: visualResume.expiresAt });
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
                localStorage.setItem(getCacheKey(userId), JSON.stringify(filterDeletedJournalEntries(journalNamespaceForKey(getCacheKey(userId)), next)));
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

        const localKey = getLocalJournalKey(isAuthenticated ? userId : null);
        return await withLocalJournalStorageLock([localKey], () => {
          if (isDeletedAccount(userId) || namespaceRef.current !== namespace) return { success: false, error: 'Account changed' };
          const savedAt = Date.now();
          const newEntry = {
            id: generateId('local'),
            ts: savedAt,
            ...entry
          };

          // Persist synchronously before reporting success; another hook instance's
          // entries may be stale, so merge with the actual scoped storage bucket.
          const existing = filterDeletedJournalEntries(namespace, readLocalJournalEntries(localStorage, localKey));
          const duplicate = existing.find(item => sameJournalReading(item, entry));
          if (duplicate) return { success: true, entry: duplicate, deduplicated: true };
          const persisted = writeLocalJournalEntries({ storage: localStorage, key: localKey, entries: [newEntry] });
          if (!persisted.ok) return { success: false, error: 'Your browser could not save this reading. Free some storage and try again.' };
          const savedEntry = persisted.entries.find(item => item.id === newEntry.id || sameJournalReading(item, newEntry))
            || persisted.entries.find(item => dedupeEntries([item, newEntry]).length === 1);
          if (!savedEntry) return { success: false, error: 'This reading is no longer available.' };
          if (visualRequestsEnabled && visualResume && entry.visualBinding
            && (!visualResume.namespace || visualResume.namespace === namespace)) writeVisualResume({ namespace, entryId: savedEntry.id, binding: entry.visualBinding,
            resumeHandle: visualResume, expiresAt: visualResume.expiresAt });
          setEntries(persisted.entries);
          setPagination({ hasMore: false, nextCursor: null, total: persisted.entries.length });
          setLastLocalSaveAt(savedAt);
          persistInsights(persisted.entries);

          return { success: true, entry: savedEntry, ...(savedEntry.id !== newEntry.id ? { deduplicated: true } : {}) };
        });
      }
    } catch (err) {
      console.error('Failed to save journal entry:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [canUseCloudJournal, isAuthenticated, persistInsights, trackCardAppearances, userId, visualRequestsEnabled, namespace, setEntries]);

  /**
   * Explicit "Retry card connections" for one saved entry. Only this user
   * action can request saved-visual annotation; mount, polling, reconnect,
   * reload and account changes never call it. The source is the existing saved
   * entry in the current owner's scope (cloud: the server reads its own row).
   * Resolves with the committed PublicVisualRetryState after the claim/status
   * and private handle are durable; rejects with a typed `code` otherwise.
   */
  const retrySavedVisuals = useCallback((entryId) => {
    const owner = namespace;
    const flightKey = `${owner}\u0000${entryId}`;
    if (retryFlights.has(flightKey)) return retryFlights.get(flightKey);
    const cloud = Boolean(isAuthenticated && canUseCloudJournal);
    const isCurrent = () => mountedRef.current && !isDeletedAccount(userId) && namespaceRef.current === owner
      && !isDeletedJournalEntry(owner, entryId);
    const flight = (async () => {
      if (!visualRequestsEnabled) throw Object.assign(new Error('Card connections are unavailable.'), { code: 'ineligible' });
      const entry = cloud ? entriesRef.current.find(item => item.id === entryId) : readSavedVisualEntry({ namespace: owner, entryId });
      // Cloud state is server-authoritative: commit only to the current owner's
      // in-memory entry for the same exact source; never insert or recreate.
      const commit = cloud ? ({ entryId: id, sourceKey, update }) => {
        const current = entriesRef.current.find(item => item.id === id);
        if (!isCurrent()) return { committed: false, reason: 'stale-owner', entry: null };
        if (!current) return { committed: false, reason: 'entry-not-found', entry: null };
        if (savedVisualSourceKey(current) !== sourceKey) return { committed: false, reason: 'source-changed', entry: current };
        const next = update(current);
        return next ? { committed: true, reason: null, entry: next } : { committed: false, reason: 'unchanged', entry: current };
      } : null;
      const result = await requestSavedVisualRetry({ namespace: owner, entry, cloud, isCurrent, commit });
      if (isCurrent()) {
        setEntries(previous => {
          const next = mapChanged(previous, item => item.id === entryId ? adoptEntryVisuals(item, result.entry) : item);
          if (cloud && next !== previous) {
            try { localStorage.setItem(getCacheKey(userId), JSON.stringify(filterDeletedJournalEntries(journalNamespaceForKey(getCacheKey(userId)), next))); } catch { /* Optional cache. */ }
          }
          return next;
        });
      }
      return result.state;
    })().finally(() => retryFlights.delete(flightKey));
    retryFlights.set(flightKey, flight);
    return flight;
  }, [namespace, isAuthenticated, canUseCloudJournal, visualRequestsEnabled, setEntries, userId]);

  const deleteEntry = async (entryId, { readingResultId = null } = {}) => {
    setError(null);
    const cloud = isAuthenticated && canUseCloudJournal;
    let deletionEntries = [...entries, ...(readingResultId ? [{ id: entryId, readingResultId }] : [])];
    let retiredReadingResultIds = null;
    let retirementReceiptValid = !cloud;
    let cloudDeletionConfirmed = false;
    try {
      if (cloud) {
        const response = await fetch(`/api/journal/${encodeURIComponent(entryId)}`, { method: 'DELETE', credentials: 'include' });
        if (!response.ok) throw new Error('Failed to delete journal entry');
        cloudDeletionConfirmed = true;
        const receipt = await response.json().catch(() => null);
        retirementReceiptValid = Array.isArray(receipt?.retiredReadingResultIds)
          && receipt.retiredReadingResultIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 256);
        retiredReadingResultIds = retirementReceiptValid ? receipt.retiredReadingResultIds : [];
      }
      const key = getLocalJournalKey(isAuthenticated ? userId : null);
      const cleanup = await withLocalJournalStorageLock([key], () => {
        if (!cloud) {
          if (isDeletedAccount(userId) || namespaceRef.current !== namespace) throw new Error('Account changed');
          // Local deletion is confirmed only after the actual authoritative bucket
          // is rewritten. A storage failure creates no tombstone and no success.
          if (typeof localStorage === 'undefined') throw new Error('localStorage not available');
          const stored = readLocalJournalEntries(localStorage, key);
          deletionEntries = [...deletionEntries, ...stored];
          const serialized = JSON.stringify(stored.filter(item => item?.id !== entryId));
          localStorage.setItem(key, serialized);
          if (localStorage.getItem(key) !== serialized) throw new Error('Your browser could not remove this reading. Try again.');
        }
        // Erase and fence synchronously before React can run a queued updater.
        // The captured namespace still owns the confirmed response after a switch.
        const erased = purgeDeletedJournalEntryStorage({ namespace, entryId, entries: deletionEntries, retiredReadingResultIds });
        return { ...erased, purged: erased.purged && retirementReceiptValid };
      });
      if (namespaceRef.current === namespace && !isDeletedAccount(userId)) {
        entriesRef.current = filterDeletedJournalEntries(namespace, entriesRef.current);
        setEntries(previous => filterDeletedJournalEntries(namespace, previous));
        setPagination(previous => ({ ...previous,
          total: typeof previous.total === 'number' ? Math.max(0, previous.total - 1) : cleanup.entries.length }));
        if (!cloud) setLastLocalSaveAt(Date.now());
      }
      if (!cleanup.purged) {
        const message = cloud ? 'Reading deleted from your account, but this browser could not finish removing its saved data.'
          : 'The local reading was removed, but this browser could not finish removing its saved data.';
        setError(message);
        return { success: Boolean(cloud), purged: false, error: message };
      }
      return { success: true, purged: true };
    } catch (err) {
      if (cloudDeletionConfirmed) {
        // Fence confirmed server deletion even when this browser cannot lock
        // its cache. Avoid rewriting an unlocked whole-journal snapshot.
        purgeDeletedJournalEntryStorage({ namespace, entryId, entries: deletionEntries, retiredReadingResultIds, rewriteBuckets: false });
        if (namespaceRef.current === namespace && !isDeletedAccount(userId)) {
          setEntries(previous => filterDeletedJournalEntries(namespace, previous));
          setPagination(previous => ({ ...previous, total: typeof previous.total === 'number' ? Math.max(0, previous.total - 1) : null }));
        }
        const message = 'Reading deleted from your account, but this browser could not finish removing its saved data.';
        setError(message);
        return { success: true, purged: false, error: message };
      }
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
    if (isDeletedAccount(userId) || namespaceRef.current !== namespace) {
      return { success: false, error: 'Account changed', imported: 0, skipped: 0 };
    }

    try {
      const scopedKey = getLocalJournalKey(userId);
      let copiedGuestSnapshot = null;
      let guestSourceRemoved = false;
      return await withLocalJournalStorageLock([LOCALSTORAGE_KEY, scopedKey], () => {
        if (isDeletedAccount(userId) || namespaceRef.current !== namespace) {
          return { success: false, error: 'Account changed', imported: 0, skipped: 0 };
        }
        const legacyRaw = localStorage.getItem(LOCALSTORAGE_KEY);
        copiedGuestSnapshot = legacyRaw;
        const legacyEntries = filterDeletedJournalEntries('anon', dedupeEntries(readLocalJournalEntries(localStorage, LOCALSTORAGE_KEY, legacyRaw)));
        if (!legacyEntries.length) return { success: true, imported: 0, skipped: 0 };
        if (isDeletedAccount(userId) || namespaceRef.current !== namespace) {
          return { success: false, error: 'Account changed', imported: 0, skipped: 0 };
        }
        const persisted = writeLocalJournalEntries({ storage: localStorage, key: scopedKey, entries: legacyEntries });
        if (!persisted.ok) return { success: false, error: persisted.error, imported: 0, skipped: 0 };
        setLastLocalSaveAt(Date.now());
        // A second tab may have added guest entries. Never clear a newer source.
        if (removeLegacy && localStorage.getItem(LOCALSTORAGE_KEY) === legacyRaw) {
          localStorage.removeItem(LOCALSTORAGE_KEY);
          guestSourceRemoved = true;
        }
        setEntries(persisted.entries);
        if (typeof window !== 'undefined') persistInsights(persisted.entries);
        const imported = Math.max(0, persisted.entries.length - persisted.previousEntries.length);
        return { success: true, imported, skipped: Math.max(0, legacyEntries.length - imported) };
      }, { onOwnerDeleted: () => {
        // Account deletion must not consume an unowned guest source. Both
        // bucket locks still belong to this import while it is restored.
        if (guestSourceRemoved && copiedGuestSnapshot !== null && localStorage.getItem(LOCALSTORAGE_KEY) === null) {
          localStorage.setItem(LOCALSTORAGE_KEY, copiedGuestSnapshot);
        }
      } });
    } catch (error) {
      console.warn('Failed to import legacy local journal entries:', error);
      return { success: false, error: error.message || 'Unable to write localStorage', imported: 0, skipped: 0 };
    }
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

    const userId = user?.id;
    const isCurrent = () => !isDeletedAccount(userId) && namespaceRef.current === namespace;
    const accountChanged = () => ({ success: false, error: 'Account changed', skipped: 0 });
    if (!userId || !isCurrent()) return accountChanged();

    try {
      const candidateKeys = [
        getLocalJournalKey(user?.id || null),
        LOCALSTORAGE_KEY
      ].filter(Boolean);

      // Symbols survive dedupe's object projection but never enter JSON/API
      // payloads. Retain each bucket's origin across migration awaits.
      const migrationNamespace = Symbol('journal-namespace');
      const sourceSnapshots = new Map();
      const localEntries = candidateKeys.flatMap((key) => {
        const stored = localStorage.getItem(key);
        sourceSnapshots.set(key, stored);
        // Validate every exact source snapshot before sending any requests.
        return filterDeletedJournalEntries(journalNamespaceForKey(key), readLocalJournalEntries(localStorage, key, stored))
          .map(entry => ({ ...entry, [migrationNamespace]: journalNamespaceForKey(key) }));
      });

      const dedupedLocalEntries = dedupeEntries(localEntries);
      if (!dedupedLocalEntries.length) {
        return { success: true, migrated: 0, skipped: 0 };
      }

      // Fetch existing cloud entries to check for duplicates
      const existingResponse = await fetch('/api/journal?all=true&includeFollowups=true', {
        credentials: 'include'
      });
      if (!isCurrent()) return accountChanged();

      const existingResults = new Set();
      const existingSeeds = new Set();
      const existingCompositeKeys = new Set();
      if (existingResponse.ok) {
        const { entries: cloudEntries } = await existingResponse.json();
        if (!isCurrent()) return accountChanged();
        // Build sets for deduplication
        cloudEntries.forEach(entry => {
          // Primary: track by session_seed
          if (entry.readingResultId) existingResults.add(entry.readingResultId);
          if (!entry.readingResultId && entry.sessionSeed) {
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
          if (!isCurrent()) return accountChanged();
          if (isDeletedJournalEntry(namespace, entry.id) || isDeletedJournalEntry(entry[migrationNamespace], entry.id)) continue;
          let isDuplicate = false;

          // Primary: Check by session_seed
          if (entry.readingResultId ? existingResults.has(entry.readingResultId)
            : entry.sessionSeed && existingSeeds.has(entry.sessionSeed)) {
            isDuplicate = true;
          }

          // Fallback: Check by composite key (timestamp + question + spread + cards)
          if (!isDuplicate && !entry.readingResultId && !entry.sessionSeed && entry.ts) {
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
          if (!isCurrent()) return accountChanged();

          if (isDeletedJournalEntry(namespace, entry.id) || isDeletedJournalEntry(entry[migrationNamespace], entry.id)) continue;
          if (response.ok) {
            migrated++;
            // Add to sets to prevent duplicate uploads in this batch
            if (entry.readingResultId) existingResults.add(entry.readingResultId);
            if (!entry.readingResultId && entry.sessionSeed) {
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
      if (!isCurrent()) return accountChanged();
      if (totalLocal > 0 && migrated + skipped === totalLocal) {
        let guestSourceRemoved = false;
        await withLocalJournalStorageLock(candidateKeys, () => {
          if (!isCurrent()) return;
          sourceSnapshots.forEach((snapshot, key) => {
            // Never consume a new reading saved while migration was awaiting HTTP.
            if (snapshot !== null && localStorage.getItem(key) === snapshot) {
              localStorage.removeItem(key);
              if (key === LOCALSTORAGE_KEY) guestSourceRemoved = true;
            }
          });
        }, { onOwnerDeleted: () => {
          const snapshot = sourceSnapshots.get(LOCALSTORAGE_KEY);
          if (guestSourceRemoved && snapshot !== null && localStorage.getItem(LOCALSTORAGE_KEY) === null) {
            localStorage.setItem(LOCALSTORAGE_KEY, snapshot);
          }
        } });
      }
      if (!isCurrent()) return accountChanged();
      const sourceRetained = candidateKeys.some(key => localStorage.getItem(key) !== null);
      const failed = totalLocal - migrated - skipped;

      // Reload entries from API
      await loadEntries();
      if (!isCurrent()) return accountChanged();

      // Invalidate narrative cache since entry data has changed
      // Guard: only invalidate if we have a valid userId to avoid clearing all caches
      if (migrated > 0 && user?.id) {
        invalidateNarrativeCache(user.id);
      }

      return {
        success: failed === 0,
        migrated,
        skipped,
        sourceRetained,
        ...(failed > 0 ? { error: `${failed} local reading${failed === 1 ? '' : 's'} could not be uploaded. Your local copies have been kept; try again.` } : {})
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
    retrySavedVisuals,
    migrateToCloud,
    importLegacyLocalEntries,
    reload: loadEntries,
    loadEntries,
    loadDeviceEntries,
    loadMoreEntries,
    fetchEntryById
  };
}
