import { useCallback } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * useHaptic
 * Centralizes vibration handling with graceful fallbacks.
 * Respects prefers-reduced-motion and no-SSR safety.
 *
 * @param {Object} options
 * @param {boolean} options.disabled - Force-disable haptics (default: false)
 * @returns {{ vibrate: (pattern?: number | number[]) => void, enabled: boolean }}
 */
export function useHaptic({ disabled = false } = {}) {
  const prefersReducedMotion = useReducedMotion();

  const enabled =
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    !prefersReducedMotion &&
    !disabled;

  const vibrate = useCallback(
    (pattern = 10) => {
      if (!enabled) return;
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        // Ignore vibration errors (e.g., permission issues)
        console.debug('Haptic vibration blocked or unavailable:', error);
      }
    },
    [enabled]
  );

  return { vibrate, enabled };
}
