import { useEffect, useState } from 'react';

/**
 * useSmallScreen detects when the viewport width is below a breakpoint.
 * Defaults defer until mounted to avoid hydration mismatch.
 */
export function useSmallScreen(maxWidth = 640) {
  const getInitial = () => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  };

  const [isSmall, setIsSmall] = useState(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${maxWidth}px)`);

    const handleChange = (event) => {
      setIsSmall(event.matches);
    };

    // Sync immediately in case layout changed before effect ran
    handleChange(mediaQuery);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [maxWidth]);

  return isSmall;
}
