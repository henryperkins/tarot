/**
 * useActionMenu.js
 * Custom hook for managing action menu portal positioning and state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const MENU_WIDTH = 288; // Tailwind w-72
const MENU_PADDING = 8;
const MENU_FALLBACK_HEIGHT = 260;

/**
 * Hook to manage action menu open/close state and portal positioning
 */
export function useActionMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined';

  const updatePlacement = useCallback(() => {
    if (!canUseDom) return;

    const btn = buttonRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth || MENU_WIDTH;
    const menuHeight = menuEl?.offsetHeight || MENU_FALLBACK_HEIGHT;

    // Horizontal positioning
    const maxLeft = Math.max(MENU_PADDING, window.innerWidth - MENU_PADDING - menuWidth);
    const left = Math.min(Math.max(rect.right - menuWidth, MENU_PADDING), maxLeft);

    // Vertical positioning - prefer below, flip above if needed
    const availableBelow = window.innerHeight - rect.bottom - MENU_PADDING;
    const availableAbove = rect.top - MENU_PADDING;
    const shouldOpenUp = availableBelow < menuHeight && availableAbove > availableBelow;
    const preferredTop = shouldOpenUp
      ? rect.top - MENU_PADDING - menuHeight
      : rect.bottom + MENU_PADDING;
    const maxTop = Math.max(MENU_PADDING, window.innerHeight - MENU_PADDING - menuHeight);
    const top = Math.min(Math.max(preferredTop, MENU_PADDING), maxTop);

    setPlacement({ left, top });
  }, [canUseDom]);

  // Update placement when menu opens
  useEffect(() => {
    if (!isOpen) return;
    updatePlacement();
  }, [isOpen, updatePlacement]);

  // Focus first menu item when opened
  useEffect(() => {
    if (!isOpen || !canUseDom) return;

    const menuEl = menuRef.current;
    if (!menuEl) return;

    const focusFirstItem = () => {
      const firstItem = menuEl.querySelector('button[role="menuitem"]:not([disabled])');
      if (firstItem) firstItem.focus();
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(focusFirstItem);
    } else {
      setTimeout(focusFirstItem, 0);
    }
  }, [isOpen, canUseDom]);

  // Handle resize and scroll events
  useEffect(() => {
    if (!isOpen || !canUseDom) return undefined;

    const handle = () => updatePlacement();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);

    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [isOpen, canUseDom, updatePlacement]);

  // Handle outside clicks and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      const menuEl = menuRef.current;
      const buttonEl = buttonRef.current;
      if (!menuEl || menuEl.contains(event.target)) return;
      if (buttonEl && buttonEl.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        // Defer placement calc to next frame for stable layout
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => updatePlacement());
        } else {
          updatePlacement();
        }
      }
      return next;
    });
  }, [updatePlacement]);

  const close = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    toggle,
    close,
    placement,
    menuRef,
    buttonRef,
    canUseDom
  };
}
