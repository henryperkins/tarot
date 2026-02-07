import { useEffect, useState } from 'react';

export const SMALL_SCREEN_MAX = 640;
export const COMPACT_SCREEN_MAX = 375;
export const VERY_COMPACT_SCREEN_MAX = 374;
export const TABLET_SCREEN_MAX = 768;

/**
 * useSmallScreen detects when the viewport width is below a breakpoint.
 * Defaults defer until mounted to avoid hydration mismatch.
 */
export function useSmallScreen(maxWidth = SMALL_SCREEN_MAX) {
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

    // Modern browsers
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy Safari (<14) fallback
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }

    return undefined;
  }, [maxWidth]);

  return isSmall;
}
