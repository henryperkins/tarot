import { useEffect, useRef, useCallback } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

/**
 * Focusable element selectors for focus trapping
 */
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
  'audio[controls]',
  'video[controls]'
].join(', ');

/**
 * useModalA11y - Shared accessibility hook for modals and drawers
 *
 * Provides:
 * - Body scroll locking (prevents background scroll)
 * - Escape key to close
 * - Focus restoration on close
 * - Optional built-in focus trapping (if not using FocusTrap library)
 *
 * @param {boolean} isOpen - Whether the modal is open
 * @param {Object} options
 * @param {Function} options.onClose - Callback when modal should close
 * @param {React.RefObject} options.containerRef - Ref to the modal container element
 * @param {'simple' | 'fixed'} options.scrollLockStrategy - Scroll lock strategy (default: 'fixed')
 * @param {boolean} options.trapFocus - Whether to trap focus within the modal (default: true)
 * @param {boolean} options.closeOnEscape - Whether to close on Escape key (default: true)
 * @param {boolean} options.restoreFocus - Whether to restore focus on close (default: true)
 * @param {React.RefObject} options.initialFocusRef - Ref to element that should receive initial focus
 *
 * @returns {Object} - { previousFocusRef }
 *
 * @example
 * function MyModal({ isOpen, onClose }) {
 *   const modalRef = useRef(null);
 *   useModalA11y(isOpen, {
 *     onClose,
 *     containerRef: modalRef,
 *   });
 *
 *   if (!isOpen) return null;
 *
 *   return (
 *     <div ref={modalRef} role="dialog" aria-modal="true">
 *       ...
 *     </div>
 *   );
 * }
 */
export function useModalA11y(isOpen, {
  onClose,
  containerRef,
  scrollLockStrategy = 'fixed',
  trapFocus = true,
  closeOnEscape = true,
  restoreFocus = true,
  initialFocusRef = null,
} = {}) {
  const previousFocusRef = useRef(null);

  // Body scroll lock
  useBodyScrollLock(isOpen, { strategy: scrollLockStrategy });

  // Store previous focus when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (restoreFocus && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }
  }, [isOpen, restoreFocus]);

  // Restore focus when modal closes
  useEffect(() => {
    if (isOpen) return;

    if (!restoreFocus || !previousFocusRef.current || typeof previousFocusRef.current.focus !== 'function') {
      return undefined;
    }

    // Use setTimeout to ensure focus restoration happens after animations
    const timer = setTimeout(() => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, restoreFocus]);

  // Set initial focus when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const setInitialFocus = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (containerRef?.current) {
        // Focus the container if no specific element is specified
        containerRef.current.focus({ preventScroll: true });
      }
    };

    // Small delay to allow for animations
    const timer = setTimeout(setInitialFocus, 50);
    return () => clearTimeout(timer);
  }, [isOpen, initialFocusRef, containerRef]);

  // Keyboard handling (Escape + Tab focus trap)
  const handleKeyDown = useCallback((event) => {
    if (!isOpen) return;

    // Escape to close
    if (closeOnEscape && event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
      return;
    }

    // Focus trap on Tab
    if (trapFocus && event.key === 'Tab' && containerRef?.current) {
      const focusable = containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS);

      if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, [isOpen, closeOnEscape, trapFocus, onClose, containerRef]);

  // Attach keyboard listener
  useEffect(() => {
    if (!isOpen) return undefined;

    // Use capture phase to catch events before other handlers
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleKeyDown]);

  return { previousFocusRef };
}

/**
 * Helper to handle backdrop clicks (close when clicking outside modal content)
 *
 * @param {Function} onClose - Close callback
 * @returns {Function} - Click handler for the backdrop element
 *
 * @example
 * <div className="backdrop" onClick={createBackdropHandler(onClose)}>
 *   <div className="modal-content" onClick={e => e.stopPropagation()}>
 *     ...
 *   </div>
 * </div>
 */
export function createBackdropHandler(onClose) {
  return (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };
}
