import { useCallback, useRef, useEffect } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * Typed haptic patterns for semantic feedback.
 * These patterns are designed to convey meaning through touch:
 * - tap: Brief confirmation (10ms)
 * - error: Low-frequency thud for blocked/invalid actions (longer duration)
 * - success: Ascending pattern for positive completion
 * - reveal: Quick tick for card reveals
 * - hold: Initial pulse for press-and-hold interactions
 */
export const HAPTIC_PATTERNS = {
  tap: 10,
  error: [50, 30, 80],
  success: [15, 40, 25, 40, 35],
  reveal: 12,
  hold: 20,
  completion: [20, 50, 30, 50, 40, 50, 50]
};

/**
 * useHaptic
 * Centralizes vibration handling with graceful fallbacks.
 * Respects prefers-reduced-motion and no-SSR safety.
 *
 * @param {Object} options
 * @param {boolean} options.disabled - Force-disable haptics (default: false)
 * @returns {{
 *   vibrate: (pattern?: number | number[]) => void,
 *   vibrateType: (type: keyof HAPTIC_PATTERNS) => void,
 *   startContinuous: (intervalMs?: number, patternMs?: number) => void,
 *   stopContinuous: () => void,
 *   enabled: boolean
 * }}
 */
export function useHaptic({ disabled = false } = {}) {
  const prefersReducedMotion = useReducedMotion();
  const continuousIntervalRef = useRef(null);

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
        console.debug('Haptic vibration blocked or unavailable:', error);
      }
    },
    [enabled]
  );

  const vibrateType = useCallback(
    (type) => {
      const pattern = HAPTIC_PATTERNS[type] ?? HAPTIC_PATTERNS.tap;
      vibrate(pattern);
    },
    [vibrate]
  );

  const stopContinuous = useCallback(() => {
    if (continuousIntervalRef.current) {
      clearInterval(continuousIntervalRef.current);
      continuousIntervalRef.current = null;
    }
    if (enabled) {
      try {
        navigator.vibrate(0);
      } catch (_) {
        // Ignore
      }
    }
  }, [enabled]);

  const startContinuous = useCallback(
    (intervalMs = 300, patternMs = 15) => {
      if (!enabled) return;
      stopContinuous();
      vibrate(patternMs);
      continuousIntervalRef.current = setInterval(() => {
        vibrate(patternMs);
      }, intervalMs);
    },
    [enabled, stopContinuous, vibrate]
  );

  useEffect(() => {
    return () => {
      if (continuousIntervalRef.current) {
        clearInterval(continuousIntervalRef.current);
      }
    };
  }, []);

  return { vibrate, vibrateType, startContinuous, stopContinuous, enabled };
}
