import { useEffect, useLayoutEffect, useRef } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const FOCUSABLE_SELECTORS = [
  'a[href]', 'button', 'textarea', 'input', 'select', '[tabindex]',
  '[contenteditable="true"]', 'audio[controls]', 'video[controls]'
].join(', ');

// Only the top open modal owns Escape/Tab, including nested confirmations.
const activeModals = [];
const isolatedElements = new Map();
let modalRevision = 0;

function modalLayer(container) {
  let layer = 0;
  for (let node = container; node && node !== document.body; node = node.parentElement) {
    layer = Math.max(layer, Number.parseInt(getComputedStyle(node).zIndex, 10) || 0);
  }
  return layer;
}

function topModal() {
  return activeModals.reduce((top, entry) => (
    !top || entry.layer >= top.layer ? entry : top
  ), null);
}

function restoreBackground() {
  for (const [element, previous] of isolatedElements) {
    element.inert = previous.inert;
    if (previous.ariaHidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', previous.ariaHidden);
  }
  isolatedElements.clear();
}

function isolateBackground() {
  if (!activeModals.some(entry => entry.isolateBackground)) return;
  // Isolate siblings along the active dialog's ancestor path, never its ancestor.
  for (let node = topModal()?.container; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children || []) {
      if (sibling === node || !(sibling instanceof HTMLElement)
        || ['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue;
      isolatedElements.set(sibling, {
        inert: sibling.inert,
        ariaHidden: sibling.getAttribute('aria-hidden')
      });
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
    }
  }
}

function isAvailable(element) {
  return element instanceof HTMLElement && element.isConnected
    && !element.matches(':disabled') && !element.closest('[inert], [hidden], [aria-hidden="true"]')
    && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
}

function focusableElements(container) {
  const candidates = [...container.querySelectorAll(FOCUSABLE_SELECTORS)]
    .filter(element => element.tabIndex >= 0 && isAvailable(element));
  return candidates.filter(element => {
    if (!element.matches('input[type="radio"]') || !element.name) return true;
    const group = candidates.filter(other => other.matches('input[type="radio"]')
      && other.name === element.name && other.form === element.form);
    return element === (group.find(other => other.checked) || group[0]);
  });
}

/** Shared focus/scroll ownership; background isolation is opt-in. */
export function useModalA11y(isOpen, {
  onClose,
  containerRef,
  scrollLockStrategy = 'fixed',
  trapFocus = true,
  closeOnEscape = true,
  restoreFocus = true,
  initialFocusRef = null,
  returnFocusRef = null,
  initialFocusSelector = null,
  fallbackFocusSelector = null,
  isolateBackground: shouldIsolateBackground = false
} = {}) {
  const previousFocusRef = useRef(null);
  const optionsRef = useRef({});
  const restoreTimerRef = useRef(null);

  useBodyScrollLock(isOpen, { strategy: scrollLockStrategy });

  useClientLayoutEffect(() => {
    optionsRef.current = { onClose, trapFocus, closeOnEscape, initialFocusSelector, fallbackFocusSelector };
  });

  useClientLayoutEffect(() => {
    const container = containerRef?.current;
    if (!isOpen || !container) return undefined;
    clearTimeout(restoreTimerRef.current);
    modalRevision += 1;

    // Keep the activation layer: React may detach a conditional dialog before
    // effect cleanup, when walking its former ancestors would return layer 0.
    const entry = { container, layer: modalLayer(container), isolateBackground: shouldIsolateBackground };
    previousFocusRef.current = returnFocusRef?.current
      || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    activeModals.push(entry);
    restoreBackground();

    // One owner and no timer that can steal focus after close. Focus the dialog
    // before hiding the background so its opener is not left in aria-hidden DOM.
    if (topModal() === entry) {
      const selected = optionsRef.current.initialFocusSelector
        ? container.querySelector(optionsRef.current.initialFocusSelector) : initialFocusRef?.current;
      const hasRequestedFocus = optionsRef.current.initialFocusSelector || initialFocusRef;
      const target = isAvailable(selected) ? selected
        : hasRequestedFocus ? focusableElements(container)[0] || container : container;
      target.focus({ preventScroll: true });
    }
    isolateBackground();

    const handleKeyDown = event => {
      if (topModal() !== entry || event.defaultPrevented) return;
      const options = optionsRef.current;
      if (event.key === 'Escape' && options.closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        options.onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !options.trapFocus) return;
      const focusable = focusableElements(container);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        container.focus({ preventScroll: true });
      } else if (!container.contains(document.activeElement) || document.activeElement === container
        || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };

    const handleFocusIn = event => {
      if (topModal() !== entry || !optionsRef.current.trapFocus || container.contains(event.target)) return;
      (focusableElements(container)[0] || container).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn);
      const wasTop = topModal() === entry;
      const index = activeModals.indexOf(entry);
      if (index >= 0) activeModals.splice(index, 1);
      const closeRevision = ++modalRevision;
      // Restore interactivity first, then return focus, then resume any parent.
      restoreBackground();
      if (restoreFocus && wasTop) {
        const opener = previousFocusRef.current;
        // Parent consumers may clear aria-hidden in an effect after a nested
        // dialog closes. Wait one task for that commit; a newer overlay/open
        // invalidates this restoration, so it cannot steal its focus.
        restoreTimerRef.current = setTimeout(() => {
          if (modalRevision !== closeRevision) return;
          const fallback = optionsRef.current.fallbackFocusSelector
            ? document.querySelector(optionsRef.current.fallbackFocusSelector) : null;
          const target = isAvailable(opener) ? opener : isAvailable(fallback) ? fallback : topModal()?.container;
          target?.focus({ preventScroll: true });
        }, 0);
      }
      previousFocusRef.current = null;
      isolateBackground();
    };
  }, [isOpen, containerRef, initialFocusRef, returnFocusRef, restoreFocus, shouldIsolateBackground]);

  return { previousFocusRef };
}

export function createBackdropHandler(onClose) {
  return event => {
    if (event.target === event.currentTarget) onClose?.();
  };
}
