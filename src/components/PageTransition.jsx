import { useLayoutEffect, useRef } from 'react';
import { animate, set } from '../lib/motionAdapter';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * PageTransition - Wraps page content with smooth enter/exit animations
 * Respects prefers-reduced-motion by using simpler fade transitions
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @param {string} props.className - Optional className for the wrapper
 */
export function PageTransition({ children, className = '' }) {
  const prefersReducedMotion = useReducedMotion();
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;

    if (prefersReducedMotion) {
      set(node, { opacity: 1 });
      return undefined;
    }

    set(node, { opacity: 0 });
    const anim = animate(node, {
      opacity: [0, 1],
      duration: 280,
      ease: 'inOutQuad'
    });

    return () => anim?.pause?.();
  }, [prefersReducedMotion]);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
