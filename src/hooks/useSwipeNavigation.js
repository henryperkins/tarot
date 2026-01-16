import { useRef, useCallback } from 'react';

/**
 * useSwipeNavigation - Handles horizontal swipe gestures for navigation
 *
 * Detects left/right swipe gestures and triggers callbacks.
 * Used for step-based navigation like onboarding wizards.
 *
 * @param {Object} options
 * @param {Function} options.onSwipeLeft - Callback for left swipe (advance)
 * @param {Function} options.onSwipeRight - Callback for right swipe (go back)
 * @param {number} options.threshold - Minimum swipe distance in pixels (default: 60)
 * @returns {Object} Touch event handlers to spread onto the swipeable element
 */
export function useSwipeNavigation({ onSwipeLeft, onSwipeRight, threshold = 60, verticalThreshold } = {}) {
  const startX = useRef(null);
  const startY = useRef(null);
  const preventedScroll = useRef(false);
  const resolvedVerticalThreshold = Math.max(24, verticalThreshold || threshold * 0.45);

  const handleTouchStart = useCallback((event) => {
    startX.current = event.touches[0].clientX;
    startY.current = event.touches[0].clientY;
    preventedScroll.current = false;
  }, []);

  const handleTouchMove = useCallback((event) => {
    if (startX.current === null || startY.current === null || preventedScroll.current) return;

    const deltaX = event.touches[0].clientX - startX.current;
    const deltaY = event.touches[0].clientY - startY.current;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const hasHorizontalIntent = absX > absY * 1.5 && absY < resolvedVerticalThreshold;

    // Once horizontal intent is clear, prevent native scroll to avoid cancelling the swipe
    if (hasHorizontalIntent && absX >= threshold * 0.5) {
      if (event.cancelable) {
        event.preventDefault();
        preventedScroll.current = true;
      }
    }
  }, [resolvedVerticalThreshold, threshold]);

  const handleTouchEnd = useCallback((event) => {
    if (startX.current === null || startY.current === null) return;

    const deltaX = event.changedTouches[0].clientX - startX.current;
    const deltaY = event.changedTouches[0].clientY - startY.current;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const hasHorizontalIntent = absX > absY * 1.5 && absY < resolvedVerticalThreshold;

    // Only trigger if horizontal movement clearly dominates
    if (hasHorizontalIntent && absX >= threshold) {
      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }

    startX.current = null;
    startY.current = null;
    preventedScroll.current = false;
  }, [onSwipeLeft, onSwipeRight, threshold]);

  const handleTouchCancel = useCallback(() => {
    startX.current = null;
    startY.current = null;
    preventedScroll.current = false;
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel
  };
}
