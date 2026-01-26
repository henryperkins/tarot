import { useRef, useCallback, useState, useEffect } from 'react';
import { Sparkle, X } from '@phosphor-icons/react';
import { useModalA11y } from '../hooks/useModalA11y';
import { useAndroidBackGuard } from '../hooks/useAndroidBackGuard';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useKeyboardOffset } from '../hooks/useKeyboardOffset';
import { MOBILE_SETTINGS_DIALOG_ID } from './MobileActionBar';

export function MobileSettingsDrawer({ isOpen, onClose, children, footer = null }) {
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const viewportOffset = useKeyboardOffset();
  const effectiveOffset = Math.max(0, viewportOffset);
  const wrapperStyle = effectiveOffset ? { paddingBottom: `${effectiveOffset}px` } : undefined;
  const bodyStyle = footer
    ? undefined
    : { paddingBottom: 'calc(1rem + var(--safe-pad-bottom))' };
  const prefersReducedMotion = useReducedMotion();

  // Shared modal accessibility: scroll lock, escape key, focus trap, focus restoration
  useModalA11y(isOpen, {
    onClose,
    containerRef: drawerRef,
    initialFocusRef: closeButtonRef,
    scrollLockStrategy: 'simple', // Simple strategy for drawers
  });

  // Android back button dismisses drawer (mobile-only component, always enabled)
  useAndroidBackGuard(isOpen, {
    onBack: onClose,
    enabled: true,
    guardId: 'settingsDrawer'
  });

  // Handle swipe-to-dismiss with velocity and visual feedback
  const touchStartY = useRef(null);
  const touchStartTime = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Reset drag state when drawer opens/closes
  // Using refs for previous state to avoid cascading renders
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    // Only reset when isOpen actually changes
    if (prevIsOpenRef.current !== isOpen) {
      prevIsOpenRef.current = isOpen;
      // Reset all drag-related state and refs when drawer state changes
      touchStartY.current = null;
      touchStartTime.current = null;
      // Defer state updates to avoid cascading renders
      queueMicrotask(() => {
        setDragOffset(0);
        setIsDragging(false);
      });
    }
  }, [isOpen]);

  const handleTouchStart = useCallback((event) => {
    // Only track touches that start on the handle area or header
    const target = event.target;
    const isHandleOrHeader = target.closest('.mobile-drawer__handle') ||
      target.closest('.mobile-drawer__header');

    // Allow anywhere if at scroll top, or specifically on handle/header
    const scrollContainer = drawerRef.current?.querySelector('.mobile-drawer__body');
    const isAtScrollTop = !scrollContainer || scrollContainer.scrollTop <= 0;

    if (isHandleOrHeader || isAtScrollTop) {
      touchStartY.current = event.touches[0].clientY;
      touchStartTime.current = Date.now();
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback((event) => {
    if (touchStartY.current === null) return;

    const currentY = event.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only allow dragging downward (positive delta)
    if (deltaY > 0) {
      // Apply resistance as drag increases (feels more natural)
      const resistance = 0.6;
      const dampedDelta = deltaY * resistance;
      setDragOffset(dampedDelta);
    }
  }, []);

  const handleTouchEnd = useCallback((event) => {
    if (touchStartY.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const touchEndY = event.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    const elapsed = Date.now() - (touchStartTime.current || Date.now());

    // Calculate velocity (pixels per millisecond)
    const velocity = deltaY / Math.max(elapsed, 1);

    // Dismiss conditions (increased thresholds to prevent accidental dismissal):
    // 1. Dragged far enough (200px+)
    // 2. Fast swipe (velocity > 0.6 px/ms) with substantial distance (80px+)
    const shouldDismiss = deltaY > 200 || (deltaY > 80 && velocity > 0.6);

    if (shouldDismiss) {
      // Animate out with current momentum
      setDragOffset(window.innerHeight);
      setTimeout(onClose, 150);
    } else {
      // Snap back
      setDragOffset(0);
    }

    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);
  }, [onClose]);

  const handleTouchCancel = useCallback(() => {
    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center pt-[max(16px,var(--safe-pad-top))]"
      style={wrapperStyle}
    >
      <div
        className="mobile-drawer-overlay absolute inset-0 motion-safe:animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        className="mobile-drawer relative w-full flex flex-col motion-safe:animate-slide-up"
        id={MOBILE_SETTINGS_DIALOG_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-drawer-title"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          maxHeight: 'calc(100% - 8px)',
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging || prefersReducedMotion
            ? 'none'
            : 'transform var(--duration-normal) var(--ease-out)'
        }}
      >
        <div className="mobile-drawer__handle" aria-hidden="true" />

        <div className="mobile-drawer__header px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="mobile-drawer__eyebrow">
                <Sparkle className="w-3.5 h-3.5" aria-hidden="true" />
                Guided setup
              </p>
              <h2 id="mobile-drawer-title" className="text-lg font-serif text-accent">Prepare Reading</h2>
              <p className="text-[0.78rem] text-muted/90 leading-snug max-w-[22rem]">
                Align your spread, deck, and ritual steps before you draw cards.
              </p>
            </div>

            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="mobile-drawer__close"
              aria-label="Close settings drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        <div
          className="mobile-drawer__body p-4 space-y-8 overflow-y-auto overscroll-contain flex-1 min-h-0"
          style={bodyStyle}
        >
          {children}
        </div>
        {footer && (
          <div
            className="mobile-drawer__footer"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
