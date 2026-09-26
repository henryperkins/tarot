import { useState, useRef, useCallback, useEffect } from 'react';

// Matches the snap/exit transition so the sheet finishes sliding out before its
// owner unmounts it.
const EXIT_DURATION_MS = 200;
// A drag that starts in a text field is caret placement or text selection, not
// a request to close the sheet.
const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

function isScrollableAncestorActive(node) {
  const docBody = typeof document !== 'undefined' ? document.body : null;
  let current = node;
  while (current && current !== docBody) {
    if (current.scrollHeight > current.clientHeight) {
      if (current.scrollTop > 0) return true;
      // If scrollable but at top, allow dismiss
    }
    current = current.parentElement;
  }
  return false;
}

function findTouch(touchList, identifier) {
  if (!touchList || identifier === null) return null;
  for (let index = 0; index < touchList.length; index += 1) {
    if (touchList[index].identifier === identifier) return touchList[index];
  }
  return null;
}

/**
 * useSwipeDismiss - Handles vertical swipe-to-dismiss gestures for modals
 *
 * Provides smooth drag tracking with resistance and velocity-based dismissal.
 * Used for bottom sheet modals and drawers on mobile.
 *
 * Interrupted gestures always leave the sheet usable: a second finger, a
 * touchcancel, or the window losing focus mid-drag snaps it back, and only the
 * finger that started the drag can finish it.
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
  const touchId = useRef(null);
  const exitTimerRef = useRef(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => () => clearTimeout(exitTimerRef.current), []);

  const reset = useCallback(() => {
    touchStartY.current = null;
    touchStartTime.current = null;
    touchId.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  // Switching apps or windows mid-drag never delivers touchend.
  useEffect(() => {
    if (!isDragging || typeof window === 'undefined') return undefined;
    window.addEventListener('blur', reset);
    return () => window.removeEventListener('blur', reset);
  }, [isDragging, reset]);

  const handleTouchStart = useCallback((e) => {
    // A second finger means a pinch or two-finger scroll, not a dismissal.
    if (e.touches.length > 1) {
      reset();
      return;
    }

    const target = e.target;
    if (typeof target?.closest === 'function' && target.closest(TEXT_ENTRY_SELECTOR)) return;

    // Skip if nested scrollable content is currently scrolled
    if (isScrollableAncestorActive(target)) return;

    const touch = e.touches[0];
    touchId.current = touch.identifier;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
  }, [reset]);

  const handleTouchMove = useCallback((e) => {
    if (touchStartY.current === null) return;
    if (e.touches.length > 1) {
      reset();
      return;
    }

    const touch = findTouch(e.touches, touchId.current);
    if (!touch) return;

    const deltaY = touch.clientY - touchStartY.current;

    // Only allow downward dragging (positive deltaY)
    if (deltaY > 0) {
      // Apply resistance to make it feel natural
      setDragOffset(deltaY * resistance);
    }
  }, [resistance, reset]);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartY.current === null) {
      reset();
      return;
    }

    const touch = findTouch(e.changedTouches, touchId.current);
    if (!touch) return;

    const deltaY = touch.clientY - touchStartY.current;
    const elapsed = Date.now() - (touchStartTime.current || Date.now());
    const velocity = deltaY / Math.max(elapsed, 1);

    // Dismiss if dragged past threshold OR quick flick with enough distance
    const shouldDismiss = deltaY > threshold || (deltaY > 80 && velocity > velocityThreshold);

    if (shouldDismiss) {
      const viewportHeight = typeof window !== 'undefined' && typeof window.innerHeight === 'number'
        ? window.innerHeight
        : 1000;
      touchStartY.current = null;
      touchStartTime.current = null;
      touchId.current = null;
      // Leaving the drag state re-enables the transition, so the sheet slides
      // out instead of jumping off screen.
      setIsDragging(false);
      setDragOffset(viewportHeight);
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        onDismissRef.current?.();
        // Batched with the owner's close; if the owner keeps the sheet open,
        // it returns to rest instead of staying off screen.
        reset();
      }, EXIT_DURATION_MS);
    } else {
      // Snap back
      reset();
    }
  }, [threshold, velocityThreshold, reset]);

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
