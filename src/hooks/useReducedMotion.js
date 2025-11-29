import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Subscribe to reduced motion media query changes.
 * Handles both modern and legacy Safari APIs.
 */
function subscribe(callback) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  // Modern browsers
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', callback);
    return () => mediaQuery.removeEventListener('change', callback);
  }

  // Legacy Safari (< 14) fallback
  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(callback);
    return () => mediaQuery.removeListener(callback);
  }

  return () => {};
}

/**
 * Get current reduced motion preference from browser.
 */
function getSnapshot() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Server snapshot - always returns false to prevent hydration mismatches.
 */
function getServerSnapshot() {
  return false;
}

/**
 * Hook to detect user's reduced motion preference.
 *
 * Uses useSyncExternalStore for proper React integration with browser media queries.
 * SSR-safe: returns false on server to prevent hydration mismatches.
 *
 * Listens for preference changes and updates accordingly.
 *
 * @returns {boolean} True if user prefers reduced motion
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
