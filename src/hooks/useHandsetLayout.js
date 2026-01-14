import { useEffect, useState } from 'react';

// Treat as "handset layout" when either:
// - viewport is truly small (normal mobile), OR
// - Safari/iOS is requesting a desktop site but the device is still touch-first
//   and height-constrained (common on iPhones, where width may report ~980px).
const DEFAULT_QUERY = '(max-width: 768px), ((hover: none) and (pointer: coarse) and (max-height: 960px))';

/**
 * useHandsetLayout
 *
 * A more robust handset detector than width-only checks.
 *
 * @param {string} [query] - Optional custom media query.
 * @returns {boolean}
 */
export function useHandsetLayout(query = DEFAULT_QUERY) {
    const getInitial = () => {
        if (typeof window === 'undefined') return false;
        if (typeof window.matchMedia !== 'function') return false;
        return window.matchMedia(query).matches;
    };

    const [matches, setMatches] = useState(getInitial);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(query);
        const handleChange = (event) => {
            setMatches(Boolean(event?.matches));
        };

        // Sync immediately in case layout changed before effect ran
        handleChange(mediaQuery);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(handleChange);
            return () => mediaQuery.removeListener(handleChange);
        }

        return undefined;
    }, [query]);

    return matches;
}
