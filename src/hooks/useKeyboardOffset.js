import { useEffect, useMemo, useSyncExternalStore } from 'react';

const KEYBOARD_OFFSET_THRESHOLD = 120;
const KEYBOARD_OFFSET_CSS_VAR = '--keyboard-offset';

function subscribeToViewport(callback) {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return () => {};
  }
  window.visualViewport.addEventListener('resize', callback);
  window.visualViewport.addEventListener('scroll', callback);
  return () => {
    window.visualViewport.removeEventListener('resize', callback);
    window.visualViewport.removeEventListener('scroll', callback);
  };
}

function getViewportOffset(threshold) {
  if (typeof window === 'undefined' || !window.visualViewport) {
    return 0;
  }
  const offsetTop = window.visualViewport.offsetTop || 0;
  const offset = window.innerHeight - window.visualViewport.height - offsetTop;
  const proportionalThreshold = Math.max(48, Math.round(window.innerHeight * 0.1));
  const effectiveThreshold = Math.min(threshold, proportionalThreshold);
  return offset > effectiveThreshold ? offset : 0;
}

function getServerViewportOffset() {
  return 0;
}

let cssVarUsers = 0;

export function useKeyboardOffset({ threshold = KEYBOARD_OFFSET_THRESHOLD, setCssVar = true } = {}) {
  const getSnapshot = useMemo(() => () => getViewportOffset(threshold), [threshold]);
  const offset = useSyncExternalStore(
    subscribeToViewport,
    getSnapshot,
    getServerViewportOffset
  );

  useEffect(() => {
    if (!setCssVar || typeof document === 'undefined') {
      return undefined;
    }
    cssVarUsers += 1;
    return () => {
      cssVarUsers = Math.max(cssVarUsers - 1, 0);
      if (cssVarUsers === 0) {
        document.documentElement.style.setProperty(KEYBOARD_OFFSET_CSS_VAR, '0px');
      }
    };
  }, [setCssVar]);

  useEffect(() => {
    if (!setCssVar || typeof document === 'undefined') {
      return;
    }
    document.documentElement.style.setProperty(KEYBOARD_OFFSET_CSS_VAR, `${offset}px`);
  }, [offset, setCssVar]);

  return offset;
}

function subscribeToVisibleViewport(callback) {
  window.addEventListener('resize', callback);
  const unsubscribe = subscribeToViewport(callback);
  return () => {
    window.removeEventListener('resize', callback);
    unsubscribe();
  };
}

const subscribeInactive = () => () => {};
const emptyViewport = () => '';
function visibleViewportSnapshot() {
  if (typeof window === 'undefined') return '';
  const viewport = window.visualViewport;
  return `${viewport?.height || window.innerHeight}:${viewport?.offsetTop || 0}`;
}

// A bounded overlay uses the visible height directly. It must not also subtract
// --keyboard-offset: VisualViewport already accounts for that same keyboard.
// Subscribe only while open and leave shared CSS owned by useKeyboardOffset.
export function useVisibleViewport(isActive) {
  const snapshot = useSyncExternalStore(
    isActive ? subscribeToVisibleViewport : subscribeInactive,
    isActive ? visibleViewportSnapshot : emptyViewport,
    emptyViewport
  );
  if (!snapshot) return null;
  const [height, offsetTop] = snapshot.split(':').map(Number);
  return { height, offsetTop };
}
