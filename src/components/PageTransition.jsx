import { useLayoutEffect } from 'react';
import { animate, set } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAnimeScope } from '../hooks/useAnimeScope';

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
  const [rootRef, scopeRef] = useAnimeScope();

  useLayoutEffect(() => {
    const node = rootRef.current;
    const scope = scopeRef.current;
    if (!node || !scope) return undefined;

    if (prefersReducedMotion) {
      set(node, { opacity: 1 });
      return undefined;
    }

    set(node, { opacity: 0 });
    scope.add(() => {
      animate(node, {
        opacity: [0, 1],
        duration: 280,
        ease: 'inOutQuad'
      });
    });

    return undefined;
  }, [prefersReducedMotion, rootRef, scopeRef]);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
