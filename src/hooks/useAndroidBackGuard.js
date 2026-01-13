import { useEffect, useRef, useCallback } from 'react';

/**
 * useAndroidBackGuard - Intercept Android back button to dismiss overlays
 *
 * On Android, the hardware/gesture back button fires a popstate event.
 * This hook pushes a guard state to history and intercepts popstate,
 * calling onBack instead of allowing navigation.
 *
 * Pattern adapted from OnboardingWizard.jsx which already handles this correctly.
 *
 * @param {boolean} isActive - Whether the overlay is open
 * @param {Object} options
 * @param {Function} options.onBack - Called when back is pressed (should close overlay)
 * @param {boolean} options.enabled - Whether to enable the guard (default: true)
 * @param {string} options.guardId - Unique identifier for this guard (for debugging)
 */
export function useAndroidBackGuard(isActive, { onBack, enabled = true, guardId = 'overlay' } = {}) {
  const guardStateRef = useRef(null);

  // Stable callback reference
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  const handlePopState = useCallback(() => {
    // Re-push the guard to prevent navigation and call onBack
    if (guardStateRef.current) {
      window.history.pushState(guardStateRef.current, document.title);
    }
    onBackRef.current?.();
  }, []);

  useEffect(() => {
    // Skip if not active, not enabled, or SSR
    if (!isActive || !enabled) return undefined;
    if (typeof window === 'undefined' || !window.history?.pushState) return undefined;

    // Create unique guard state
    const guardState = { [`${guardId}Guard`]: true, ts: Date.now() };
    guardStateRef.current = guardState;

    // Push guard state to history
    window.history.pushState(guardState, document.title);

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      guardStateRef.current = null;
      // Note: We don't pop the guard state on cleanup because:
      // 1. The overlay is closing (user intended to navigate or dismiss)
      // 2. Calling history.back() here would cause unwanted navigation
    };
  }, [isActive, enabled, guardId, handlePopState]);
}
