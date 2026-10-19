import { useEffect, useRef } from 'react';
import { useHandsetLayout } from './useHandsetLayout';

/**
 * useAndroidBackGuard - Back closes an open overlay instead of leaving the page
 *
 * Open overlays share one history entry (same URL, same router state). The
 * Android back button or gesture, and the iOS edge swipe, pop that entry and
 * close the innermost overlay; while another stays open the entry comes back,
 * so each Back closes one layer. Closing the last overlay any other way (its
 * close button, Escape, the backdrop) removes the entry again, so no "dead"
 * Back presses are left behind. A route change made from an open overlay (a
 * link or an action inside it) takes the entry over, so Back from the new page
 * returns to the page behind the overlay.
 *
 * One window listener serves every guard; the innermost open overlay handles
 * Back first. useModalA11y installs one for every dialog.
 *
 * @param {boolean} isActive - Whether the overlay is open
 * @param {Object} options
 * @param {Function} options.onBack - Called when Back is pressed (should close the overlay or its inner layer)
 * @param {boolean} [options.enabled] - Whether to enable the guard (default: handset layouts, in either orientation)
 * @param {string} options.guardId - Identifier for this guard (debugging)
 */

const openGuards = [];
// The entry the open overlays share, and its pending removal.
const overlayEntry = { id: null, live: false, release: null };
// Pops this module started with history.back(); each expires so a lost event
// cannot swallow a later, real Back press.
const selfPops = [];
const SELF_POP_WINDOW_MS = 1500;
let sequence = 0;
let installed = false;
let pushState = null;

function entryIsCurrent() {
  return overlayEntry.live && window.history.state?.tableuOverlayGuard === overlayEntry.id;
}

function holdEntry(guardId) {
  clearTimeout(overlayEntry.release);
  overlayEntry.release = null;
  if (entryIsCurrent()) return;
  sequence += 1;
  overlayEntry.id = `${guardId}-${sequence}`;
  overlayEntry.live = true;
  // Keep the router's state, so the page behind keeps its location state and
  // a route change from the overlay gets the right history index.
  pushState.call(window.history, { ...window.history.state, tableuOverlayGuard: overlayEntry.id }, document.title);
}

function releaseEntry() {
  overlayEntry.release = null;
  if (openGuards.length || !overlayEntry.live) return;
  // Only remove the entry while it is the current one; behind a later entry
  // going back would undo that instead.
  const isCurrent = entryIsCurrent();
  overlayEntry.live = false;
  if (!isCurrent) return;
  selfPops.push(Date.now());
  window.history.back();
}

// Give React a turn to close the overlay. One still open (Back closed only an
// inner layer) needs the entry back.
function restoreEntrySoon() {
  setTimeout(() => {
    const innermost = openGuards[openGuards.length - 1];
    if (innermost) holdEntry(innermost.id);
  }, 0);
}

function handlePopState() {
  const now = Date.now();
  while (selfPops.length && now - selfPops[0] > SELF_POP_WINDOW_MS) selfPops.shift();
  if (selfPops.length) {
    selfPops.shift();
    return;
  }
  const innermost = openGuards[openGuards.length - 1];
  if (!innermost) return;
  if (!entryIsCurrent()) overlayEntry.live = false;
  innermost.onBackRef.current?.();
  restoreEntrySoon();
}

// A route change from an open overlay replaces the overlay's entry. Pushed
// above it instead, the entry would be left under the new page as a dead
// Back press. Overlays of the page being left can stay mounted while the new
// route renders; they get no new entry.
function handOverEntry(state, unused, url) {
  if (!entryIsCurrent()) {
    pushState.call(window.history, state, unused, url);
    return;
  }
  overlayEntry.live = false;
  clearTimeout(overlayEntry.release);
  overlayEntry.release = null;
  window.history.replaceState(state, unused, url);
}

function install() {
  if (installed) return;
  installed = true;
  pushState = window.history.pushState;
  window.history.pushState = handOverEntry;
  window.addEventListener('popstate', handlePopState);
}

/**
 * Loads another document (a sign-in provider, a full-page route). Left from an
 * open overlay, the new page takes over the overlay's entry, as a route change
 * does, so Back from it returns to the page behind the overlay.
 *
 * @param {string} url - Where to go
 */
export function leavePage(url) {
  if (window.history.state?.tableuOverlayGuard) window.location.replace(url);
  else window.location.assign(url);
}

export function useAndroidBackGuard(isActive, { onBack, enabled, guardId = 'overlay' } = {}) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);
  // Phones in either orientation and touch-first tablets: a landscape phone is
  // wider than the small-screen breakpoint but still has a Back gesture.
  const isHandset = useHandsetLayout();
  const guardEnabled = enabled ?? isHandset;

  useEffect(() => {
    if (!isActive || !guardEnabled) return undefined;
    if (typeof window === 'undefined' || !window.history?.pushState) return undefined;
    install();

    const guard = { id: guardId, onBackRef };
    openGuards.push(guard);
    holdEntry(guardId);

    return () => {
      const index = openGuards.indexOf(guard);
      if (index !== -1) openGuards.splice(index, 1);
      if (openGuards.length) return;
      // Wait a turn: an overlay that replaces this one in the same render (a
      // loading placeholder by its dialog, a StrictMode remount, a quick
      // close and reopen) keeps the entry.
      clearTimeout(overlayEntry.release);
      overlayEntry.release = setTimeout(releaseEntry, 0);
    };
  }, [isActive, guardEnabled, guardId]);
}
