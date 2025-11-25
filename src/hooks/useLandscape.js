import { useEffect, useState } from 'react';

/**
 * useLandscape detects landscape orientation on small viewport devices.
 * Returns true when device is in landscape AND viewport height is constrained.
 * This helps identify cramped mobile landscape situations.
 */
export function useLandscape(maxHeight = 500) {
  const getInitial = () => {
    if (typeof window === 'undefined') {
      return false;
    }
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    const isShortViewport = window.innerHeight <= maxHeight;
    return isLandscape && isShortViewport;
  };

  const [isSmallLandscape, setIsSmallLandscape] = useState(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const checkOrientation = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      const isShortViewport = window.innerHeight <= maxHeight;
      setIsSmallLandscape(isLandscape && isShortViewport);
    };

    // Check on resize and orientation change
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Initial sync
    checkOrientation();

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [maxHeight]);

  return isSmallLandscape;
}
