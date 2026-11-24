import { useSyncExternalStore } from 'react';

const MAX_LANDSCAPE_WIDTH = 1024;
const stores = new Map();
const noLandscape = () => false;
const inactiveStore = { subscribe: () => () => {}, getSnapshot: noLandscape };

function getLandscapeStore(maxHeight) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return inactiveStore;
  if (stores.has(maxHeight)) return stores.get(maxHeight);

  // Use one query for the viewport and pointer criteria. Requiring a coarse
  // pointer somewhere excludes short desktop windows.
  const viewport = `(orientation: landscape) and (max-height: ${maxHeight}px) and (max-width: ${MAX_LANDSCAPE_WIDTH}px) and (any-pointer: coarse)`;
  const media = window.matchMedia(`${viewport} and (pointer: coarse), ${viewport} and (hover: none)`);
  const listeners = new Set();
  const notify = () => listeners.forEach(listener => listener());
  const store = {
    getSnapshot: () => media.matches,
    subscribe(listener) {
      if (!listeners.size) {
        if (media.addEventListener) media.addEventListener('change', notify);
        else media.addListener?.(notify);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        if (media.removeEventListener) media.removeEventListener('change', notify);
        else media.removeListener?.(notify);
      };
    }
  };
  stores.set(maxHeight, store);
  return store;
}

/** Detect short, touch-first landscape viewports. */
export function useLandscape(maxHeight = 500) {
  const store = getLandscapeStore(maxHeight);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, noLandscape);
}
