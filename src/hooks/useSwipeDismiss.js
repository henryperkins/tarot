import { useState, useRef, useCallback } from 'react';

/**
 * useSwipeDismiss - Handles vertical swipe-to-dismiss gestures for modals
 *
 * Provides smooth drag tracking with resistance and velocity-based dismissal.
 * Used for bottom sheet modals and drawers on mobile.
 *
 * @param {Object} options
 * @param {Function} options.onDismiss - Callback when modal should close
 * @param {number} options.threshold - Distance threshold for dismiss (default: 150px)
 * @param {number} options.velocityThreshold - Velocity threshold for quick flick (default: 0.5)
 * @param {number} options.resistance - Drag resistance factor 0-1 (default: 0.6)
 * @returns {Object} { dragOffset, isDragging, handlers, style }
 */
export function useSwipeDismiss({
  onDismiss,
  threshold = 150,
  velocityThreshold = 0.5,
  resistance = 0.6
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(null);
  const touchStartTime = useRef(null);

  const reset = useCallback(() => {
    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  const handleTouchStart = useCallback((e) => {
    // Only handle touches on the modal itself or swipe handle
    const target = e.target;
    const isScrollable = target.scrollHeight > target.clientHeight;
    const isAtTop = target.scrollTop === 0;

    // Don't intercept if user is scrolling within content
    if (isScrollable && !isAtTop) return;

    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === null) return;

    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only allow downward dragging (positive deltaY)
    if (deltaY > 0) {
      // Apply resistance to make it feel natural
      setDragOffset(deltaY * resistance);
    }
  }, [resistance]);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) {
      reset();
      return;
    }

    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const elapsed = Date.now() - (touchStartTime.current || Date.now());
    const velocity = deltaY / Math.max(elapsed, 1);

    // Dismiss if dragged past threshold OR quick flick with enough distance
    const shouldDismiss = deltaY > threshold || (deltaY > 80 && velocity > velocityThreshold);

    if (shouldDismiss) {
      // Animate out before dismissing
      setDragOffset(window.innerHeight);
      setTimeout(onDismiss, 150);
    } else {
      // Snap back
      reset();
    }
  }, [onDismiss, threshold, velocityThreshold, reset]);

  return {
    dragOffset,
    isDragging,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: reset
    },
    style: {
      transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
      transition: isDragging ? 'none' : 'transform 0.2s ease-out'
    }
  };
}
