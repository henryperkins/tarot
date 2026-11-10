import { useEffect, useMemo, useState } from 'react';
import { parseMemoryList, requestMemoryJson } from '../lib/memoryApi';

/**
 * Refresh when setup is revisited or the reader returns from another tab.
 * An old empty result must not hide the opt-out while the new check is pending.
 *
 * @returns {'loading' | 'some' | 'none' | 'error'} 'error' when the check could
 *   not be made; callers keep the choice visible then, as before this check.
 */
export function useSavedMemoryPresence(userId, setupVisible = true) {
  // A new setup visit has a different scope even for the same account, so its
  // first render cannot reuse the previous visit's empty result.
  const scope = useMemo(() => ({ userId, setupVisible }), [userId, setupVisible]);
  const [result, setResult] = useState({ scope: null, presence: 'loading' });

  useEffect(() => {
    if (!scope.userId || !scope.setupVisible) return undefined;
    let active = true;
    let controller;
    const refresh = () => {
      if (!active) return;
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      setResult({ scope, presence: 'loading' });
      requestMemoryJson('/api/memories?limit=1', { signal: requestController.signal })
        .then((data) => {
          const presence = parseMemoryList(data).length > 0 ? 'some' : 'none';
          if (!requestController.signal.aborted) setResult({ scope, presence });
        })
        .catch(() => {
          if (!requestController.signal.aborted) setResult({ scope, presence: 'error' });
        });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    queueMicrotask(refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [scope]);

  if (!userId) return 'none';
  return result.scope === scope ? result.presence : 'loading';
}
