import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { persistJournalInsights, clearJournalInsightsCache } from '../lib/journalInsights';
import { invalidateNarrativeCache } from '../lib/safeStorage';
import { dedupeEntries } from '../../shared/journal/dedupe.js';

const LOCALSTORAGE_KEY = 'tarot_journal';
const CACHE_KEY_PREFIX = 'tarot_journal_cache';

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

/**
 * Journal hook with automatic API/localStorage routing
 *
 * - If user is authenticated: saves to D1 database via API (with local caching)
 * - If user is not authenticated: saves to localStorage
 *
 * This provides backward compatibility while enabling cloud sync for auth users
 */
export function useJournal({ autoLoad = true } = {}) {
  const { isAuthenticated, user } = useAuth();
  const { canUseCloudJournal } = useSubscription();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState(null);

  // Track previous user ID to detect account switches
  const prevUserIdRef = useRef(user?.id);

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
  }, [user?.id]);

  // Load entries on mount or when auth state changes
  useEffect(() => {
    if (!autoLoad && isAuthenticated) {
      return;
    }
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadEntries is stable, avoid infinite loop
  }, [isAuthenticated, canUseCloudJournal, autoLoad, user?.id]);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isAuthenticated && canUseCloudJournal) {
        // Try loading from API first
        try {
          // Use all=true for backward compatibility until frontend supports pagination
          const response = await fetch('/api/journal?all=true', {
            credentials: 'include'
          });

          if (!response.ok) {
            throw new Error('Failed to load journal entries');
          }

          const data = await response.json();
          const apiEntries = dedupeEntries(data.entries || []);
          setEntries(apiEntries);

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
            } else {
              throw apiError;
            }
          } else {
            throw apiError;
          }
        }
      } else {
        // Load from localStorage (anonymous or authenticated without cloud entitlements)
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
            } catch (err) {
              console.error('Failed to parse localStorage journal:', err);
              setEntries([]);
              if (typeof window !== 'undefined') {
                persistInsights([]);
              }
            }
          } else {
            setEntries([]);
            if (typeof window !== 'undefined') {
              persistInsights([]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load journal entries:', err);
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const saveEntry = async (entry) => {
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
          ...entry
        };

        // If server detected a duplicate (same session_seed), skip local state
        // updates to keep client in sync with DB
        if (data.deduplicated) {
          return { success: true, entry: newEntry, deduplicated: true };
        }

        // Add to local state - prepend and dedupe in one pass
        setEntries(prev => {
          const prevEntries = Array.isArray(prev) ? prev : [];
          const next = dedupeEntries([newEntry, ...prevEntries]);

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

        // Track card appearances for archetype journey analytics
        if (Array.isArray(entry.cards) && entry.cards.length > 0) {
          trackCardAppearances(entry.cards, newEntry.ts);
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

        const newEntry = {
          id: crypto.randomUUID?.() || `local_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          ts: Date.now(),
          ...entry
        };

        setEntries(prev => {
          const prevEntries = Array.isArray(prev) ? prev : [];
          let next = dedupeEntries([newEntry, ...prevEntries]);

          // Limit to 100 entries in localStorage
          if (next.length > 100) {
            next = next.slice(0, 100);
          }

          try {
            const localKey = getLocalJournalKey(isAuthenticated ? userId : null);
            localStorage.setItem(localKey, JSON.stringify(next));
          } catch (quotaErr) {
            console.warn('localStorage quota exceeded, unable to persist journal:', quotaErr);
          }

          if (typeof window !== 'undefined') {
            persistInsights(next);
          }
          return next;
        });

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
  const trackCardAppearances = async (cards, timestamp) => {
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
          timestamp
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

        // Remove from local state
        setEntries(prev => {
          const next = prev.filter(e => e.id !== entryId);
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
          const next = prev.filter(e => e.id !== entryId);
          try {
            const localKey = getLocalJournalKey(isAuthenticated ? user?.id : null);
            localStorage.setItem(localKey, JSON.stringify(next));
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
      const existingResponse = await fetch('/api/journal?all=true', {
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
    error,
    saveEntry,
    deleteEntry,
    migrateToCloud,
    reload: loadEntries
  };
}
