import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { persistJournalInsights } from '../lib/journalInsights';

const LOCALSTORAGE_KEY = 'tarot_journal';

/**
 * Journal hook with automatic API/localStorage routing
 *
 * - If user is authenticated: saves to D1 database via API
 * - If user is not authenticated: saves to localStorage
 *
 * This provides backward compatibility while enabling cloud sync for auth users
 */
export function useJournal() {
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load entries on mount or when auth state changes
  useEffect(() => {
    loadEntries();
  }, [isAuthenticated]);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isAuthenticated) {
        // Load from API
        const response = await fetch('/api/journal', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to load journal entries');
        }

        const data = await response.json();
        const apiEntries = data.entries || [];
        setEntries(apiEntries);
        if (typeof window !== 'undefined') {
          persistJournalInsights(apiEntries);
        }
      } else {
        // Load from localStorage
        if (typeof localStorage === 'undefined') {
          setEntries([]);
          if (typeof window !== 'undefined') {
            persistJournalInsights([]);
          }
        } else {
          const stored = localStorage.getItem(LOCALSTORAGE_KEY);
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              const safeEntries = Array.isArray(parsed) ? parsed : [];
              setEntries(safeEntries);
              if (typeof window !== 'undefined') {
                persistJournalInsights(safeEntries);
              }
            } catch (err) {
              console.error('Failed to parse localStorage journal:', err);
              setEntries([]);
              if (typeof window !== 'undefined') {
                persistJournalInsights([]);
              }
            }
          } else {
            setEntries([]);
            if (typeof window !== 'undefined') {
              persistJournalInsights([]);
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

    try {
      if (isAuthenticated) {
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

        // Add to local state
        const newEntry = {
          id: data.entry.id,
          ts: data.entry.ts,
          ...entry
        };
        setEntries(prev => {
          const next = [newEntry, ...prev];
          if (typeof window !== 'undefined') {
            persistJournalInsights(next);
          }
          return next;
        });

        return { success: true, entry: newEntry };
      } else {
        // Save to localStorage
        if (typeof localStorage === 'undefined') {
          return { success: false, error: 'localStorage not available' };
        }

        const newEntry = {
          id: crypto.randomUUID?.() || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ts: Date.now(),
          ...entry
        };

        const updated = [newEntry, ...entries];

        // Limit to 100 entries in localStorage
        if (updated.length > 100) {
          updated.length = 100;
        }

        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(updated));
        setEntries(updated);
        if (typeof window !== 'undefined') {
          persistJournalInsights(updated);
        }

        return { success: true, entry: newEntry };
      }
    } catch (err) {
      console.error('Failed to save journal entry:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const deleteEntry = async (entryId) => {
    setError(null);

    try {
      if (isAuthenticated) {
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
            persistJournalInsights(next);
          }
          return next;
        });

        return { success: true };
      } else {
        // Delete from localStorage
        if (typeof localStorage === 'undefined') {
          return { success: false, error: 'localStorage not available' };
        }

        const updated = entries.filter(e => e.id !== entryId);
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(updated));
        setEntries(updated);
        if (typeof window !== 'undefined') {
          persistJournalInsights(updated);
        }

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
      return { success: false, error: 'Not authenticated' };
    }

    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'localStorage not available' };
    }

    try {
      // Get localStorage entries
      const stored = localStorage.getItem(LOCALSTORAGE_KEY);
      if (!stored) {
        return { success: true, migrated: 0 };
      }

      const localEntries = JSON.parse(stored);
      if (!Array.isArray(localEntries) || localEntries.length === 0) {
        return { success: true, migrated: 0 };
      }

      // Fetch existing cloud entries to check for duplicates
      const existingResponse = await fetch('/api/journal', {
        credentials: 'include'
      });

      const existingSeeds = new Set();
      if (existingResponse.ok) {
        const { entries: cloudEntries } = await existingResponse.json();
        // Build set of existing session_seeds for deduplication
        cloudEntries.forEach(entry => {
          if (entry.sessionSeed) {
            existingSeeds.add(entry.sessionSeed);
          }
        });
      }

      // Upload each entry to the API, skipping duplicates
      let migrated = 0;
      let skipped = 0;
      for (const entry of localEntries) {
        try {
          // Skip if this entry already exists (check by session_seed)
          if (entry.sessionSeed && existingSeeds.has(entry.sessionSeed)) {
            skipped++;
            continue;
          }

          const response = await fetch('/api/journal', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(entry)
          });

          if (response.ok) {
            migrated++;
            // Add to set to prevent duplicate uploads in this batch
            if (entry.sessionSeed) {
              existingSeeds.add(entry.sessionSeed);
            }
          }
        } catch (err) {
          console.error('Failed to migrate entry:', err);
        }
      }

      // Clear localStorage after successful migration
      if (migrated > 0) {
        localStorage.removeItem(LOCALSTORAGE_KEY);
      }

      // Reload entries from API
      await loadEntries();

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
