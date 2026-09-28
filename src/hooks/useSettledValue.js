import { useEffect, useState } from 'react';

/**
 * Returns `value` once it has stopped changing for `delay` ms.
 *
 * Used for screen-reader announcements about text being typed, so feedback
 * is spoken when the person pauses rather than on every keystroke.
 */
export function useSettledValue(value, delay = 900) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timeoutId);
  }, [value, delay]);

  return settled;
}

export default useSettledValue;
