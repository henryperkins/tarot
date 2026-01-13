import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for managing user memories
 *
 * Provides CRUD operations for the memories API with local caching
 */
export function useMemories() {
  const { isAuthenticated } = useAuth();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories] = useState([
    'theme',
    'card_affinity',
    'communication',
    'life_context',
    'general'
  ]);

  // Category display labels
  const categoryLabels = {
    theme: 'Recurring Themes',
    card_affinity: 'Card Affinities',
    communication: 'Communication Style',
    life_context: 'Life Context',
    general: 'Other Insights'
  };

  /**
   * Fetch memories from API
   */
  const fetchMemories = useCallback(async (options = {}) => {
    if (!isAuthenticated) {
      setMemories([]);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.scope) params.set('scope', options.scope);
      if (options.category) params.set('category', options.category);
      if (options.limit) params.set('limit', String(options.limit));

      const queryString = params.toString();
      const url = `/api/memories${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          setMemories([]);
          return [];
        }
        throw new Error('Failed to fetch memories');
      }

      const data = await response.json();
      setMemories(data.memories || []);
      return data.memories || [];
    } catch (err) {
      console.error('[useMemories] Fetch error:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Create a new memory
   */
  const createMemory = useCallback(async ({ text, keywords = [], category }) => {
    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    setError(null);

    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, keywords, category })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create memory');
      }

      // Refresh memories list
      await fetchMemories();

      return { success: true, id: data.id, deduplicated: data.deduplicated };
    } catch (err) {
      console.error('[useMemories] Create error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [isAuthenticated, fetchMemories]);

  /**
   * Delete a specific memory
   */
  const deleteMemoryById = useCallback(async (memoryId) => {
    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    setError(null);

    try {
      const response = await fetch(`/api/memories?id=${encodeURIComponent(memoryId)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete memory');
      }

      // Remove from local state
      setMemories(prev => prev.filter(m => m.id !== memoryId));

      return { success: true };
    } catch (err) {
      console.error('[useMemories] Delete error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [isAuthenticated]);

  /**
   * Clear all memories
   */
  const clearAll = useCallback(async () => {
    if (!isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }

    setError(null);

    try {
      const response = await fetch('/api/memories?all=true', {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear memories');
      }

      setMemories([]);

      return { success: true, deleted: data.deleted };
    } catch (err) {
      console.error('[useMemories] Clear error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [isAuthenticated]);

  // Fetch memories on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchMemories();
    }
  }, [isAuthenticated, fetchMemories]);

  return {
    memories,
    loading,
    error,
    categories,
    categoryLabels,
    fetchMemories,
    createMemory,
    deleteMemory: deleteMemoryById,
    clearAll,
    refresh: fetchMemories
  };
}
