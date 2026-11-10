import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { safeStorage } from '../../../../../lib/safeStorage';
import { REVERSED_PATTERN } from '../../../../../lib/journalInsights';
import { extractShortLabel } from '../../../../readingBoardUtils';

export const STACK_HINT_STORAGE_KEY = 'cards_drawn_stack_hint_dismissed';
export const COLLAPSED_THUMB_SIZE = { width: 56, height: 84 };
export const STACK_OFFSET_X = 6;
export const STACK_OFFSET_Y = 3;
export const EAGER_LOAD_COUNT = 4;

const ROTATION_MAP = {
  1: [0],
  2: [-4, 4],
  3: [-2, 0, 2],
  4: [-3, -1, 1, 3],
  5: [-4, -2, 0, 2, 4]
};

export function getCardStackOffset(index, count) {
  const safeCount = Math.max(1, Math.min(count, 5));
  const center = (safeCount - 1) / 2;
  const offset = index - center;
  const rotationSequence = ROTATION_MAP[safeCount] || ROTATION_MAP[5];
  const rotation = rotationSequence[index] ?? 0;

  return {
    x: offset * STACK_OFFSET_X,
    y: Math.abs(offset) * STACK_OFFSET_Y,
    rotation,
    zIndex: Math.round(10 + (safeCount - Math.abs(offset)))
  };
}

export function getOrientationState(card) {
  const isReversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
  return {
    isReversed,
    label: isReversed ? 'Reversed' : 'Upright'
  };
}

/** "Past" from "Past — influences that led here"; long titles stay whole. */
export function getShortPosition(position) {
  if (typeof position !== 'string' || !position.trim()) return 'Position';
  return extractShortLabel(position, Infinity) || position.trim();
}

export function getCardAriaLabel(card, orientationLabel) {
  const name = card?.displayName || card?.name || 'Unknown card';
  const position = card?.position || 'Position';
  return `${name}, ${position} position, ${orientationLabel}`;
}

export function useCardFan({ cards = [], isCollapsible, reduceMotion, defaultExpanded }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHint, setShowHint] = useState(() => {
    if (!safeStorage.isAvailable) {
      return true;
    }
    const stored = safeStorage.getItem(STACK_HINT_STORAGE_KEY);
    return !stored;
  });
  const stackButtonRef = useRef(null);
  const stripRef = useRef(null);
  const cardRefs = useRef([]);
  const wasExpandedRef = useRef(false);
  const restoreStackFocusRef = useRef(false);
  const showExpanded = !isCollapsible || isExpanded;

  useLayoutEffect(() => {
    if (!showExpanded && restoreStackFocusRef.current) {
      restoreStackFocusRef.current = false;
      stackButtonRef.current?.focus({ preventScroll: true });
    }
  }, [showExpanded]);

  const maxIndex = Math.max(0, cards.length - 1);
  const constrainedActiveIndex = Math.min(activeIndex, maxIndex);
  const safeActiveIndex = showExpanded ? constrainedActiveIndex : 0;
  if (safeActiveIndex !== activeIndex) {
    setActiveIndex(safeActiveIndex);
  }

  useEffect(() => {
    if (!showExpanded) {
      wasExpandedRef.current = false;
      if (stripRef.current) {
        stripRef.current.scrollLeft = 0;
      }
      return;
    }

    if (isCollapsible && !wasExpandedRef.current) {
      wasExpandedRef.current = true;
      const focusTimer = requestAnimationFrame(() => {
        const target = cardRefs.current[0];
        if (target?.focus) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      });

      return () => cancelAnimationFrame(focusTimer);
    }

    wasExpandedRef.current = true;
    return undefined;
  }, [showExpanded, isCollapsible, reduceMotion]);

  const dismissHint = useCallback(() => {
    if (!showHint) return;
    safeStorage.setItem(STACK_HINT_STORAGE_KEY, '1');
    setShowHint(false);
  }, [showHint]);

  const handleCollapse = useCallback(() => {
    if (!isCollapsible) return;
    restoreStackFocusRef.current = true;
    setIsExpanded(false);
    wasExpandedRef.current = false;
  }, [isCollapsible]);

  const handleExpand = useCallback(() => {
    if (!isCollapsible) return;
    setIsExpanded(true);
  }, [isCollapsible]);

  const handleToggle = useCallback(() => {
    dismissHint();
    if (!isCollapsible) return;
    setIsExpanded((prev) => !prev);
  }, [dismissHint, isCollapsible]);

  const handleCardKeyDown = useCallback((event, index) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(cards.length - 1, index + direction));
      setActiveIndex(nextIndex);
      const target = cardRefs.current[nextIndex];
      if (target?.focus) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
      return;
    }

    if (event.key === 'Escape' && showExpanded && isCollapsible) {
      event.preventDefault();
      handleCollapse();
    }
  }, [cards.length, handleCollapse, isCollapsible, reduceMotion, showExpanded]);

  const handleCardSelect = useCallback((index) => {
    setActiveIndex(index);
  }, []);

  const setCardRef = useCallback((index) => (node) => {
    cardRefs.current[index] = node;
  }, []);

  return {
    activeIndex: safeActiveIndex,
    showExpanded,
    showHint,
    stackButtonRef,
    stripRef,
    dismissHint,
    handleCollapse,
    handleExpand,
    handleToggle,
    handleCardKeyDown,
    handleCardSelect,
    setCardRef
  };
}
