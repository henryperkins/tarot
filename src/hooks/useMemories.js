import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { parseMemoryList, requestMemoryJson } from '../lib/memoryApi';

const CATEGORIES = ['theme', 'card_affinity', 'communication', 'life_context', 'general'];
const CATEGORY_LABELS = {
  theme: 'Recurring Themes',
  card_affinity: 'Card Affinities',
  communication: 'Communication Style',
  life_context: 'Life Context',
  general: 'Other Insights'
};

/** Manage memory requests without letting an older read overwrite a newer change. */
export function useMemories() {
  const { isAuthenticated } = useAuth();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(isAuthenticated);
  const [error, setError] = useState(null);
  const [mutating, setMutating] = useState(null);
  const readRef = useRef(null);
  const mutationRef = useRef(null);

  const fetchMemories = useCallback(async (options = {}) => {
    if (!isAuthenticated) return [];
    readRef.current?.abort();
    const controller = new AbortController();
    readRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.scope) params.set('scope', options.scope);
      if (options.category) params.set('category', options.category);
      if (options.limit) params.set('limit', String(options.limit));
      const query = params.toString();
      const data = await requestMemoryJson(`/api/memories${query ? `?${query}` : ''}`, { signal: controller.signal });
      const nextMemories = parseMemoryList(data);
      if (!controller.signal.aborted) setMemories(nextMemories);
      return nextMemories;
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
      return [];
    } finally {
      if (readRef.current === controller) {
        readRef.current = null;
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  const mutate = useCallback(async (kind, url, options, action, applyResult) => {
    if (!isAuthenticated) return { success: false, error: 'Sign in to manage your memories.' };
    if (mutationRef.current) return { success: false, busy: true };

    readRef.current?.abort();
    readRef.current = null;
    setLoading(false);
    const controller = new AbortController();
    mutationRef.current = controller;
    setMutating(kind);

    try {
      const data = await requestMemoryJson(url, { ...options, signal: controller.signal }, action);
      if (controller.signal.aborted) return { success: false, cancelled: true };
      setError(null);
      applyResult?.();
      if (kind === 'create') await fetchMemories();
      return { ...data, success: true };
    } catch (err) {
      return controller.signal.aborted
        ? { success: false, cancelled: true }
        : { success: false, error: err.message };
    } finally {
      if (mutationRef.current === controller) {
        mutationRef.current = null;
        setMutating(null);
      }
    }
  }, [isAuthenticated, fetchMemories]);

  const createMemory = useCallback(({ text, keywords = [], category }) => mutate(
    'create', '/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, keywords, category })
    }, 'save your memory'
  ), [mutate]);

  const deleteMemory = useCallback(memoryId => mutate(
    'delete', `/api/memories?id=${encodeURIComponent(memoryId)}`, { method: 'DELETE' },
    'delete this memory', () => setMemories(previous => previous.filter(memory => memory.id !== memoryId))
  ), [mutate]);

  const clearAll = useCallback(() => mutate(
    'clear', '/api/memories?all=true', { method: 'DELETE' },
    'delete your memories', () => setMemories([])
  ), [mutate]);

  useEffect(() => {
    // Start after the effect is installed so cleanup also covers an immediate navigation.
    let active = true;
    queueMicrotask(() => {
      if (active) void fetchMemories();
    });
    return () => {
      active = false;
      readRef.current?.abort();
      mutationRef.current?.abort();
    };
  }, [fetchMemories]);

  return {
    memories: isAuthenticated ? memories : [],
    loading, error, mutating,
    categories: CATEGORIES,
    categoryLabels: CATEGORY_LABELS,
    fetchMemories, createMemory, deleteMemory, clearAll,
    refresh: fetchMemories
  };
}
