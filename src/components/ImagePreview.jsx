import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export function ImagePreview({ image, onConfirm, onRetake }) {
  const previousTriggerRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Compute imageUrl synchronously via useMemo to avoid setState in effect
  const imageUrl = useMemo(() => {
    if (image instanceof File) {
      return URL.createObjectURL(image);
    }
    return image || null;
  }, [image]);

  // Cleanup object URLs to prevent memory leaks (no setState, only cleanup side effect)
  useEffect(() => {
    if (image instanceof File && imageUrl) {
      return () => URL.revokeObjectURL(imageUrl);
    }
  }, [image, imageUrl]);

  // Store reference to previously focused element for focus restoration
  useEffect(() => {
    if (imageUrl) {
      previousTriggerRef.current = document.activeElement;
      // Focus the confirm button when modal opens
      requestAnimationFrame(() => {
        confirmButtonRef.current?.focus();
      });
    }
    return () => {
      // Restore focus when modal closes
      if (previousTriggerRef.current && typeof previousTriggerRef.current.focus === 'function') {
        previousTriggerRef.current.focus();
      }
    };
  }, [imageUrl]);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onRetake?.();
    }
    // Trap focus within the modal
    if (event.key === 'Tab') {
      const focusableElements = event.currentTarget.querySelectorAll(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onRetake]);

  // Lock body scroll when modal is open
  useBodyScrollLock(!!imageUrl, { strategy: 'simple' });

  if (!imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex flex-col bg-main animate-fade-in"
      onKeyDown={handleKeyDown}
    >
      {/* Image container */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        <img
          src={imageUrl}
          alt="Preview of your captured photo for the tarot reading"
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Action buttons with safe area padding for notched devices */}
      <div className="bg-main/80 backdrop-blur-sm p-4 pb-[max(1rem,var(--safe-pad-bottom))] flex justify-center gap-6">
        <button
          type="button"
          onClick={onRetake}
          className="min-h-cta min-w-[100px] px-6 py-3 text-lg text-main font-semibold rounded-lg border border-secondary/40 hover:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-main transition-colors touch-manipulation"
        >
          Retake
        </button>
        <button
          ref={confirmButtonRef}
          type="button"
          onClick={onConfirm}
          className="min-h-cta min-w-[120px] px-6 py-3 text-lg text-surface font-semibold bg-secondary hover:bg-secondary/90 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-main transition-colors touch-manipulation"
        >
          Use Photo
        </button>
      </div>
    </div>
  );
}
