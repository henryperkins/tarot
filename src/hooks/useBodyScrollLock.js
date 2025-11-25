import { useEffect, useRef } from 'react';

/**
 * useBodyScrollLock prevents background scroll when overlays are open.
 *
 * Two strategies:
 * - 'simple': Sets overflow: hidden (may cause content shift on scrollbar removal)
 * - 'fixed': Positions body fixed and compensates for scrollbar width (no shift)
 *
 * @param {boolean} isLocked - Whether to lock body scroll
 * @param {Object} options
 * @param {'simple' | 'fixed'} options.strategy - Lock strategy (default: 'fixed')
 * @returns {{ scrollY: number }} - Current scroll position when locked
 */
export function useBodyScrollLock(isLocked, { strategy = 'fixed' } = {}) {
  const scrollYRef = useRef(0);
  const previousStylesRef = useRef(null);

  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }

    // Capture current scroll position
    scrollYRef.current = window.scrollY;

    // Calculate scrollbar width to prevent content shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Store original styles for restoration
    previousStylesRef.current = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
    };

    if (strategy === 'simple') {
      // Simple strategy: just hide overflow
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      // Fixed strategy: prevents iOS bounce and maintains scroll position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = '100%';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    return () => {
      // Restore original styles
      if (previousStylesRef.current) {
        const prev = previousStylesRef.current;
        document.body.style.overflow = prev.overflow;
        document.body.style.position = prev.position;
        document.body.style.top = prev.top;
        document.body.style.width = prev.width;
        document.body.style.paddingRight = prev.paddingRight;
      }
      previousStylesRef.current = null;

      // Restore scroll position (only needed for fixed strategy)
      if (strategy === 'fixed') {
        window.scrollTo(0, scrollYRef.current);
      }
    };
  }, [isLocked, strategy]);

  return { scrollY: scrollYRef.current };
}
