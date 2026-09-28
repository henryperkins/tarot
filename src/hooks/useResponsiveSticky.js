import { useEffect, useRef } from 'react';

// Oversized navigation should scroll with the page, leaving room for its content.
export function useResponsiveSticky(enabled = true) {
  const ref = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) return undefined;

    const measure = () => {
      const height = element.getBoundingClientRect().height;
      const sticky = height <= window.innerHeight * 0.4;
      element.style.position = sticky ? 'sticky' : 'relative';
      parent.style.setProperty('--sticky-header-height', `${sticky ? height : 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      element.style.removeProperty('position');
      parent.style.removeProperty('--sticky-header-height');
    };
  }, [enabled]);

  return ref;
}
