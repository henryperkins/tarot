import { useEffect, useState } from 'react';

/**
 * Hook to detect user's reduced motion preference.
 *
 * SSR-safe: initializes to false to prevent hydration mismatches,
 * then updates on client mount if user prefers reduced motion.
 *
 * Listens for preference changes and updates accordingly.
 *
 * @returns {boolean} True if user prefers reduced motion
 */
export function useReducedMotion() {
  // Initialize to false to avoid hydration mismatch
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value on mount
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy Safari (< 14) fallback
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }

    return undefined;
  }, []);

  return prefersReducedMotion;
}
