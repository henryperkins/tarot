import { useEffect, useState } from 'react';

const MAX_LANDSCAPE_WIDTH = 1024;

function isTouchFirstViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  // Require touch capability plus either coarse primary pointer or no-hover primary pointer.
  // This avoids classifying short desktop windows as "mobile landscape."
  const hasAnyTouchPointer = window.matchMedia('(any-pointer: coarse)').matches;
  const primaryPointerIsCoarse = window.matchMedia('(pointer: coarse)').matches;
  const primaryPointerHasNoHover = window.matchMedia('(hover: none)').matches;

  return hasAnyTouchPointer && (primaryPointerIsCoarse || primaryPointerHasNoHover);
}

function getLandscapeState(maxHeight) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  const isLandscape = window.matchMedia('(orientation: landscape)').matches;
  const isShortViewport = window.innerHeight <= maxHeight;
  const isConstrainedWidth = window.innerWidth <= MAX_LANDSCAPE_WIDTH;

  return isLandscape && isShortViewport && isConstrainedWidth && isTouchFirstViewport();
}

/**
 * useLandscape detects landscape orientation on small viewport devices.
 * Returns true when viewport is:
 * - landscape
 * - short (height constrained)
 * - touch-first
 * - not wider than tablet-ish widths
 * This helps identify cramped mobile landscape situations.
 */
export function useLandscape(maxHeight = 500) {
  const getInitial = () => {
    return getLandscapeState(maxHeight);
  };

  const [isSmallLandscape, setIsSmallLandscape] = useState(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const checkOrientation = () => {
      setIsSmallLandscape(getLandscapeState(maxHeight));
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
