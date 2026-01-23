import { useCallback, useEffect, useRef, useState } from 'react';
import { safeStorage } from '../../../../../lib/safeStorage';
import { REVERSED_PATTERN } from '../../../../../lib/journalInsights';

export const STACK_HINT_STORAGE_KEY = 'cards_drawn_stack_hint_dismissed';
export const COLLAPSED_THUMB_SIZE = { width: 56, height: 84 };
export const EXPANDED_THUMB_SIZE = { width: 52, height: 78 };
export const STACK_OFFSET_X = 6;
export const STACK_OFFSET_Y = 3;
export const EAGER_LOAD_COUNT = 4;

// Arc/fan geometry constants
export const ARC_SPAN_DEGREES = 40; // Total arc span (-20° to +20°)
export const ARC_VERTICAL_RISE = 20; // Max vertical offset at arc edges
export const BASE_OVERLAP_RATIO = 0.42; // Base overlap for small spreads
export const EDGE_SCALE = 0.94; // Scale factor for edge cards

// Dynamic overlap for larger spreads (more cards = more overlap)
function getOverlapRatio(cardCount) {
  if (cardCount <= 5) return BASE_OVERLAP_RATIO;
  if (cardCount <= 7) return 0.52;
  return 0.60; // 10 cards need significant overlap
}

// Dynamic arc span for larger spreads (more cards = wider arc)
function getArcSpan(cardCount) {
  if (cardCount <= 5) return ARC_SPAN_DEGREES;
  if (cardCount <= 7) return 50;
  return 60; // 10 cards get a wider arc
}

const ROTATION_MAP = {
  1: [0],
  2: [-4, 4],
  3: [-2, 0, 2],
  4: [-3, -1, 1, 3],
  5: [-4, -2, 0, 2, 4]
};

/**
 * Calculate arc/fan position for a card
 * @param {number} index - Card index (0-based)
 * @param {number} total - Total number of cards
 * @param {number} containerWidth - Available container width
 * @returns {{ x: number, y: number, rotation: number, scale: number, zIndex: number }}
 */
export function getArcPosition(index, total, containerWidth = 360) {
  if (total === 1) {
    return { x: 0, y: 0, rotation: 0, scale: 1, zIndex: 10 };
  }

  // Normalized position from -1 (leftmost) to +1 (rightmost)
  const normalizedPos = (2 * index / (total - 1)) - 1;

  // Dynamic arc span based on card count
  const arcSpan = getArcSpan(total);
  const halfArc = arcSpan / 2;
  const rotation = normalizedPos * halfArc;

  // Vertical offset: parabolic curve (higher at edges for larger spreads)
  const verticalRise = total > 7 ? ARC_VERTICAL_RISE * 1.2 : ARC_VERTICAL_RISE;
  const y = Math.abs(normalizedPos) * verticalRise;

  // Dynamic overlap based on card count
  const overlapRatio = getOverlapRatio(total);
  const cardWidth = EXPANDED_THUMB_SIZE.width;
  const safeContainerWidth = Math.max(
    Number.isFinite(containerWidth) ? containerWidth : 0,
    cardWidth
  );
  const effectiveCardWidth = cardWidth * (1 - overlapRatio);
  const totalFanWidth = cardWidth + (total - 1) * effectiveCardWidth;

  // Use most of the container width for larger spreads
  const padding = total > 7 ? 8 : 16;
  const availableWidth = Math.max(safeContainerWidth - padding * 2, cardWidth);
  const maxOffset = Math.min(availableWidth / 2, totalFanWidth / 2);
  const x = normalizedPos * maxOffset;

  // Scale: slightly smaller at edges, more reduction for large spreads
  const edgeScale = total > 7 ? 0.90 : EDGE_SCALE;
  const scale = 1 - (Math.abs(normalizedPos) * (1 - edgeScale));

  // Z-index: center cards on top, edges below
  const zIndex = Math.round(10 + (1 - Math.abs(normalizedPos)) * total);

  return { x, y, rotation, scale, zIndex };
}

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

export function getCardAriaLabel(card, orientationLabel) {
  const name = card?.name || 'Unknown card';
  const position = card?.position || 'Position';
  return `${name}, ${position} position, ${orientationLabel}`;
}

export function useCardFan({ cards = [], isCollapsible, reduceMotion, defaultExpanded }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const stackButtonRef = useRef(null);
  const stripRef = useRef(null);
  const cardRefs = useRef([]);
  const wasExpandedRef = useRef(false);
  const showExpanded = !isCollapsible || isExpanded;

  useEffect(() => {
    if (!safeStorage.isAvailable) {
      setShowHint(true);
      return;
    }
    const stored = safeStorage.getItem(STACK_HINT_STORAGE_KEY);
    setShowHint(!stored);
  }, []);

  useEffect(() => {
    if (activeIndex >= cards.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, cards.length]);

  useEffect(() => {
    if (!showExpanded) {
      setActiveIndex(0);
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
    setIsExpanded(false);
    wasExpandedRef.current = false;
    stackButtonRef.current?.focus();
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
    activeIndex,
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
