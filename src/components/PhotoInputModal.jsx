import { useCallback, useEffect, useRef } from 'react';
import { Camera, Images, X } from '@phosphor-icons/react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export function PhotoInputModal({ onTakePhoto, onChooseFromLibrary, onCancel }) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const previousBodyStylesRef = useRef(null);
  const titleId = 'photo-input-modal-title';

  // Handle escape key
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    // Focus trap
    if (event.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(FOCUSABLE_SELECTORS);
      if (focusable.length === 0) {
        event.preventDefault();
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
  }, [onCancel]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget) {
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    // Store current focus to restore later
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      previousFocusRef.current = activeElement;
    }

    // Lock body scroll and prevent content shift
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    previousBodyStylesRef.current = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Focus the modal
    if (modalRef.current) {
      modalRef.current.focus();
    }

    // Add keyboard listener
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);

      // Restore body styles
      if (previousBodyStylesRef.current) {
        const prev = previousBodyStylesRef.current;
        document.body.style.overflow = prev.overflow;
        document.body.style.position = prev.position;
        document.body.style.top = prev.top;
        document.body.style.width = prev.width;
        document.body.style.paddingRight = prev.paddingRight;
      }

      // Restore scroll position
      window.scrollTo(0, scrollY);

      // Restore focus
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-main/90 backdrop-blur-sm animate-fade-in p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-surface rounded-xl shadow-2xl p-6 w-full max-w-sm animate-pop-in border border-secondary/30 focus:outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="text-lg font-semibold text-main">
            Add a Photo
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 -mr-2 text-muted hover:text-main hover:bg-surface-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onTakePhoto}
            className="w-full flex items-center gap-3 px-4 py-3 text-white bg-secondary hover:bg-secondary/90 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Camera className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Take Photo</span>
          </button>

          <button
            type="button"
            onClick={onChooseFromLibrary}
            className="w-full flex items-center gap-3 px-4 py-3 text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Images className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Choose from Library</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full mt-4 px-4 py-2.5 text-muted hover:text-main border border-secondary/30 hover:border-secondary/50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
