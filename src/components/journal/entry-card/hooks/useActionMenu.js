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

  const close = useCallback(() => {
    if (isOpen) buttonRef.current?.focus({ preventScroll: true });
    setIsOpen(false);
  }, [isOpen]);

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
      const frame = requestAnimationFrame(focusFirstItem);
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(focusFirstItem, 0);
    return () => clearTimeout(timer);
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

  // Arrow keys move within the menu; Tab resumes the trigger's normal tab order.
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
        event.preventDefault();
        close();
        return;
      }
      const menuEl = menuRef.current;
      if (!menuEl?.contains(document.activeElement)) return;
      if (event.key === 'Tab') {
        // Keep the browser's native Tab/Shift+Tab behavior after restoring its starting point.
        close();
        return;
      }
      const items = [...menuEl.querySelectorAll('button[role="menuitem"]:not([disabled])')];
      if (!items.length || !items.includes(document.activeElement)) return;
      const index = items.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % items.length;
      else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      else return;
      event.preventDefault();
      items[next].focus();
    };

    const handleFocusIn = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen, close]);

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
