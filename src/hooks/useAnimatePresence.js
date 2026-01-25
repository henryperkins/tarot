import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export function useAnimatePresence(isPresent, { onExitComplete } = {}) {
  const [shouldRender, setShouldRender] = useState(isPresent);
  const exitInProgressRef = useRef(false);

  // useLayoutEffect for synchronous state updates tied to presence
  useLayoutEffect(() => {
    if (isPresent) {
      exitInProgressRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync render state for animation coordination
      setShouldRender(true);
      return;
    }

    if (!exitInProgressRef.current) {
      exitInProgressRef.current = true;
    }
  }, [isPresent]);

  const safeToRemove = useCallback(() => {
    if (!exitInProgressRef.current) return;
    exitInProgressRef.current = false;
    setShouldRender(false);
    onExitComplete?.();
  }, [onExitComplete]);

  return { shouldRender, safeToRemove };
}
