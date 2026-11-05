import { useEffect, useState } from 'react';
import { parseMemoryList, requestMemoryJson } from '../lib/memoryApi';

/**
 * Whether a signed-in reader has any saved memories, so the setup offers the
 * "use saved memories" choice only when it changes something.
 *
 * @returns {'loading' | 'some' | 'none' | 'error'} 'error' when the check could
 *   not be made; callers keep the choice visible then, as before this check.
 */
export function useSavedMemoryPresence(userId) {
  const [result, setResult] = useState({ userId: null, presence: 'loading' });

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    requestMemoryJson('/api/memories?limit=1', { signal: controller.signal })
      .then((data) => {
        const presence = parseMemoryList(data).length > 0 ? 'some' : 'none';
        if (!controller.signal.aborted) setResult({ userId, presence });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ userId, presence: 'error' });
      });
    return () => controller.abort();
  }, [userId]);

  if (!userId) return 'none';
  return result.userId === userId ? result.presence : 'loading';
}
