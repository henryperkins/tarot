import { useEffect, useRef } from 'react';

// Pinned chrome may use up to this share of the visible height. Short views
// (landscape phones, an open on-screen keyboard) get a smaller share.
const PIN_RATIO = 0.4;
const SHORT_VIEW_PIN_RATIO = 0.25;
const SHORT_VIEW_HEIGHT = 500;

/**
 * Visible height in CSS px. The on-screen keyboard shrinks the visual
 * viewport but not `innerHeight` on iOS Safari or on Chrome for Android's
 * default (resizes-visual) mode, so measuring `innerHeight` kept a tall header
 * pinned over a few pixels of room above the keyboard.
 */
export function getVisibleHeight() {
  if (typeof window === 'undefined') return 0;
  return window.visualViewport?.height || window.innerHeight;
}

export function shouldPin(height, visibleHeight) {
  const ratio = visibleHeight < SHORT_VIEW_HEIGHT ? SHORT_VIEW_PIN_RATIO : PIN_RATIO;
  return height <= visibleHeight * ratio;
}

// Oversized navigation should scroll with the page, leaving room for its content.
// `rootVar` also publishes the pinned height on the document root, where root
// scroll-padding can keep focused controls clear of it.
export function useResponsiveSticky(enabled = true, { rootVar = null } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) return undefined;
    const root = document.documentElement;

    const measure = () => {
      const height = element.getBoundingClientRect().height;
      const sticky = shouldPin(height, getVisibleHeight());
      element.style.position = sticky ? 'sticky' : 'relative';
      parent.style.setProperty('--sticky-header-height', `${sticky ? height : 0}px`);
      if (rootVar) root.style.setProperty(rootVar, `${sticky ? height : 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      element.style.removeProperty('position');
      parent.style.removeProperty('--sticky-header-height');
      if (rootVar) root.style.removeProperty(rootVar);
    };
  }, [enabled, rootVar]);

  return ref;
}
