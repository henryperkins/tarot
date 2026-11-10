import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_STATUS = { tone: 'info', message: '', action: null };

// Errors and warnings stay until the next action replaces or clears them: a
// reader may need time to act on one (a warning can carry a link to copy).
const PERSISTENT_TONES = new Set(['error', 'warning']);

export function useInlineStatus(timeoutMs = 3200) {
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const timerRef = useRef(null);

  const clearStatus = useCallback(() => {
    setStatus(DEFAULT_STATUS);
  }, []);

  const showStatus = useCallback((next) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!next?.message) {
      setStatus(DEFAULT_STATUS);
      return;
    }

    const merged = {
      ...DEFAULT_STATUS,
      ...next
    };

    setStatus(merged);

    if (timeoutMs > 0 && !PERSISTENT_TONES.has(merged.tone)) {
      timerRef.current = setTimeout(() => {
        setStatus(DEFAULT_STATUS);
        timerRef.current = null;
      }, timeoutMs);
    }
  }, [timeoutMs]);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return {
    status,
    showStatus,
    clearStatus,
    isActive: Boolean(status.message)
  };
}
