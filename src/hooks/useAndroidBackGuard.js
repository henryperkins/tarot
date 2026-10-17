import { useEffect, useRef } from 'react';

/**
 * useAndroidBackGuard - Back closes an open overlay instead of leaving the page
 *
 * Each open overlay owns one history entry (same URL). The Android back
 * button or gesture, and the iOS edge swipe, pop that entry and close the
 * overlay. Closing the overlay any other way (its close button, Escape, the
 * backdrop) removes the entry again, so no "dead" Back presses are left behind.
 * If the overlay stays open after Back (it only closed an inner layer), its
 * entry is restored.
 *
 * One window listener serves every guard; the innermost open overlay handles
 * Back first.
 *
 * @param {boolean} isActive - Whether the overlay is open
 * @param {Object} options
 * @param {Function} options.onBack - Called when Back is pressed (should close the overlay or its inner layer)
 * @param {boolean} options.enabled - Whether to enable the guard (default: true)
 * @param {string} options.guardId - Identifier for this guard (debugging)
 */

const openGuards = [];
// Pops this module started with history.back(); each expires so a lost event
// cannot swallow a later, real Back press.
const selfPops = [];
const SELF_POP_WINDOW_MS = 1500;
let sequence = 0;
let listening = false;

function pushEntry(guard) {
  window.history.pushState({ tableuOverlayGuard: guard.id }, document.title);
  guard.entryLive = true;
}

function handlePopState() {
  const now = Date.now();
  while (selfPops.length && now - selfPops[0] > SELF_POP_WINDOW_MS) selfPops.shift();
  if (selfPops.length) {
    selfPops.shift();
    return;
  }
  const guard = openGuards.pop();
  if (!guard) return;
  guard.entryLive = false;
  guard.onBackRef.current?.();
  // Give React a turn to close the overlay; if it is still open, it only
  // closed an inner layer and needs its entry back.
  setTimeout(() => {
    if (guard.active && !guard.entryLive) {
      pushEntry(guard);
      if (!openGuards.includes(guard)) openGuards.push(guard);
    }
  }, 0);
}

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  listening = true;
}

function releaseEntry(guard) {
  if (!guard.entryLive) return;
  guard.entryLive = false;
  // Only remove the entry while it is the current one; behind a later entry
  // (an inner overlay, a route change) going back would undo that instead.
  if (window.history.state?.tableuOverlayGuard !== guard.id) return;
  selfPops.push(Date.now());
  window.history.back();
}

export function useAndroidBackGuard(isActive, { onBack, enabled = true, guardId = 'overlay' } = {}) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);
  const guardRef = useRef(null);

  useEffect(() => {
    if (!isActive || !enabled) return undefined;
    if (typeof window === 'undefined' || !window.history?.pushState) return undefined;
    ensureListener();

    let guard = guardRef.current;
    if (guard?.pendingRelease) {
      // Reopened before the release ran (StrictMode remount, a quick
      // close/open): keep the existing entry.
      clearTimeout(guard.pendingRelease);
      guard.pendingRelease = null;
    } else {
      sequence += 1;
      guard = { id: `${guardId}-${sequence}`, onBackRef, active: false, entryLive: false, pendingRelease: null };
      guardRef.current = guard;
      pushEntry(guard);
    }
    guard.active = true;
    if (!openGuards.includes(guard)) openGuards.push(guard);

    return () => {
      guard.active = false;
      const index = openGuards.indexOf(guard);
      if (index !== -1) openGuards.splice(index, 1);
      guard.pendingRelease = setTimeout(() => {
        guard.pendingRelease = null;
        if (guardRef.current === guard) guardRef.current = null;
        releaseEntry(guard);
      }, 0);
    };
  }, [isActive, enabled, guardId]);
}
