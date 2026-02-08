import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { animate, createLayout, cubicBezier, set } from 'animejs';
import { SPREADS } from '../data/spreads';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAnimeScope } from '../hooks/useAnimeScope';
import { useSounds } from '../hooks/useSounds';
import { getCardImage, FALLBACK_IMAGE } from '../lib/cardLookup';
import { getSuitBorderColor, getRevealedCardGlow, getSuitGlowColor } from '../lib/suitColors';
import { extractShortLabel, getPositionLabel } from './readingBoardUtils';
import { HandTap } from '@phosphor-icons/react';
import { useHaptic } from '../hooks/useHaptic';
import { useTactileLens } from '../hooks/useTactileLens';
import { MICROCOPY } from '../lib/microcopy';
import { TactileLensButton, TactileLensOverlay } from './TactileLensOverlay';
import { SpreadProgressIndicator } from './SpreadProgressIndicator';
import { CardBack } from './CardBack';
import { CardInfoPopover } from './CardInfoPopover';
import { ParticleLayer } from './ParticleLayer';

/**
 * Spread layout definitions (x, y as percentage of container)
 * Each position includes coordinates and optional rotation
 */
const SPREAD_LAYOUTS = {
  single: [
    { x: 50, y: 50, scale: 1.2 }
  ],
  threeCard: [
    { x: 20, y: 50, label: 'Past' },
    { x: 50, y: 50, label: 'Present' },
    { x: 80, y: 50, label: 'Future' }
  ],
  fiveCard: [
    { x: 50, y: 20, label: 'Core' },
    { x: 20, y: 50, label: 'Challenge' },
    { x: 50, y: 50, label: 'Hidden' },
    { x: 80, y: 50, label: 'Support' },
    { x: 50, y: 80, label: 'Direction' }
  ],
  decision: [
    { x: 50, y: 20, label: 'Heart' },
    { x: 25, y: 50, label: 'Path A' },
    { x: 75, y: 50, label: 'Path B' },
    { x: 50, y: 70, label: 'Clarity' },
    { x: 50, y: 80, label: 'Free Will' }
  ],
  relationship: [
    { x: 30, y: 50, label: 'You' },
    { x: 70, y: 50, label: 'Them' },
    { x: 50, y: 75, label: 'Connection' },
    { x: 25, y: 22, label: 'Dynamics' },
    { x: 75, y: 22, label: 'Outcome' }
  ],
  celtic: [
    { x: 35, y: 50, label: 'Present' },
    { x: 35, y: 50, label: 'Challenge', rotate: 90, offsetX: 3 },
    { x: 15, y: 50, label: 'Past' },
    { x: 55, y: 50, label: 'Near Future' },
    { x: 35, y: 20, label: 'Conscious' },
    { x: 35, y: 80, label: 'Subconscious' },
    { x: 80, y: 80, label: 'Self/Advice' },
    { x: 80, y: 60, label: 'External' },
    { x: 80, y: 40, label: 'Hopes/Fears' },
    { x: 80, y: 20, label: 'Outcome' }
  ]
};

const CARD_ASPECT = 2 / 3;
const CELTIC_CHALLENGE_OFFSET = {
  minPx: 18,
  maxPx: 44,
  cardRatio: 0.22
};

const FLIP_EASE = cubicBezier(0.32, 0.72, 0, 1);
const FLIP_TILT = 6;
const FLIP_DURATION = 420;
const FLIP_LOCK_BUFFER = 80;
const CARD_LAYOUT_DURATION = 380;
const CARD_LAYOUT_EXIT_DURATION = 240;
const CARD_LAYOUT_STAGGER = 40;

export function getCenterOutOrder(spreadKey, totalCards) {
  const layout = SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
  const count = Math.max(0, Math.min(totalCards || 0, layout.length));
  if (count <= 1) {
    return count === 1 ? [0] : [];
  }

  const centerX = 50;
  const centerY = 50;
  return Array.from({ length: count }, (_, index) => index)
    .sort((a, b) => {
      const pa = layout[a] || { x: 50, y: 50 };
      const pb = layout[b] || { x: 50, y: 50 };
      const pax = pa.x + (pa.offsetX || 0);
      const pbx = pb.x + (pb.offsetX || 0);
      const da = Math.hypot(pax - centerX, pa.y - centerY);
      const db = Math.hypot(pbx - centerX, pb.y - centerY);
      if (da === db) return a - b;
      return da - db;
    });
}

const getMaxCardWidth = (layout, bounds) => {
  const width = bounds.width;
  const height = bounds.height;
  if (!width || !height) return null;
  let maxWidth = Infinity;

  layout.forEach((pos) => {
    const offsetX = pos.offsetX || 0;
    const x = ((pos.x + offsetX) / 100) * width;
    const y = (pos.y / 100) * height;
    const scale = pos.scale || 1;
    const isRotated = pos.rotate && Math.abs(pos.rotate) % 180 === 90;
    const aspect = isRotated ? 1 / CARD_ASPECT : CARD_ASPECT;
    const xLimit = 2 * Math.min(x, width - x);
    const yLimit = 2 * Math.min(y, height - y);
    const widthLimit = Math.min(xLimit, yLimit * aspect) / scale;

    if (widthLimit < maxWidth) {
      maxWidth = widthLimit;
    }
  });

  if (!Number.isFinite(maxWidth)) return null;
  return Math.max(0, maxWidth);
};

function SlotPulseWrapper({ active, prefersReducedMotion, className, style, children, ...props }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (!active || prefersReducedMotion) {
      set(node, { scale: 1 });
      return undefined;
    }

    const anim = animate(node, {
      scale: [1, 1.05, 1],
      duration: 1500,
      loop: true,
      ease: 'inOutQuad'
    });

    return () => anim?.pause?.();
  }, [active, prefersReducedMotion]);

  return (
    <div ref={ref} className={className} style={style} {...props}>
      {children}
    </div>
  );
}

function PulseRing({ active, prefersReducedMotion, className }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !active) return undefined;

    if (prefersReducedMotion) {
      set(node, { opacity: 0.8, scale: 1 });
      return undefined;
    }

    const anim = animate(node, {
      opacity: [0.65, 1, 0.65],
      scale: [1, 1.08, 1],
      duration: 1600,
      loop: true,
      ease: 'inOutQuad'
    });

    return () => anim?.pause?.();
  }, [active, prefersReducedMotion]);

  if (!active) return null;

  return <div ref={ref} className={className} />;
}

function OneShotRing({
  active,
  prefersReducedMotion,
  className,
  style,
  duration = 1100,
  opacityKeyframes = [0.8, 0.35, 0],
  scaleKeyframes = [1, 1.03, 1.05],
  reducedOpacity = 0.5,
  ease = 'outQuad',
  ...props
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !active) return undefined;

    if (prefersReducedMotion) {
      set(node, { opacity: reducedOpacity, scale: 1 });
      return undefined;
    }

    set(node, { opacity: opacityKeyframes[0], scale: scaleKeyframes[0] });
    const anim = animate(node, {
      opacity: opacityKeyframes,
      scale: scaleKeyframes,
      duration,
      ease
    });

    return () => anim?.pause?.();
  }, [active, duration, ease, opacityKeyframes, prefersReducedMotion, reducedOpacity, scaleKeyframes]);

  if (!active) return null;

  return <div ref={ref} className={className} style={style} {...props} />;
}

function FlashRing({ active, prefersReducedMotion, className }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !active) return undefined;

    if (prefersReducedMotion) {
      set(node, { opacity: 0.9, scale: 1 });
      return undefined;
    }

    set(node, { opacity: 0.9, scale: 1 });
    const anim = animate(node, {
      opacity: [0.9, 0.5, 0],
      scale: [1, 1.08, 1.12],
      duration: 400,
      ease: 'outQuad'
    });

    return () => anim?.pause?.();
  }, [active, prefersReducedMotion]);

  if (!active) return null;

  return <div ref={ref} className={className} />;
}

function FlipCard({
  isRevealed,
  prefersReducedMotion,
  forceRevealOnMount = false,
  className,
  style,
  children
}) {
  const ref = useRef(null);
  const shouldForceRevealRef = useRef(forceRevealOnMount);
  const prevRevealedRef = useRef(isRevealed);
  const animRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // Set initial state before paint
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || hasInitializedRef.current) return undefined;

    hasInitializedRef.current = true;
    const shouldForceReveal = shouldForceRevealRef.current && isRevealed;
    const startRevealed = isRevealed && !shouldForceReveal;

    set(node, {
      rotateY: startRevealed ? 0 : 180,
      rotateX: startRevealed ? 0 : FLIP_TILT
    });

    prevRevealedRef.current = startRevealed;
    shouldForceRevealRef.current = false;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount
  }, []);

  // Handle reveal animation when isRevealed changes
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // Skip if this is the initial render (handled by useLayoutEffect)
    if (!hasInitializedRef.current) return undefined;

    // Skip if revealed state hasn't actually changed
    if (prevRevealedRef.current === isRevealed) return undefined;
    prevRevealedRef.current = isRevealed;

    // Clean up any existing animation
    if (animRef.current?.pause) {
      animRef.current.pause();
      animRef.current = null;
    }

    if (prefersReducedMotion) {
      set(node, { rotateY: isRevealed ? 0 : 180, rotateX: isRevealed ? 0 : FLIP_TILT });
      return undefined;
    }

    animRef.current = animate(node, {
      rotateY: isRevealed ? 0 : 180,
      rotateX: isRevealed ? 0 : FLIP_TILT,
      duration: FLIP_DURATION,
      ease: FLIP_EASE
    });

    return () => {
      if (animRef.current?.pause) {
        animRef.current.pause();
        animRef.current = null;
      }
    };
  }, [isRevealed, prefersReducedMotion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animRef.current?.pause) {
        animRef.current.pause();
        animRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

function AnimatedCardButton({
  card,
  isRevealed,
  prefersReducedMotion,
  positionScale,
  positionRotate,
  className,
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  disabled,
  ariaDisabled,
  ariaLabel,
  children
}) {
  const [displayCard, setDisplayCard] = useState(card);
  const [isHidden, setIsHidden] = useState(!card);
  const [isFlipAnimating, setIsFlipAnimating] = useState(false);
  const buttonRef = useRef(null);
  const removeTimerRef = useRef(null);
  const flipLockTimerRef = useRef(null);
  const lastCardRef = useRef(card);
  const displayCardRef = useRef(card);

  const resolvedCard = card || displayCard;
  const [shouldForceReveal, setShouldForceReveal] = useState(false);

  const releaseFlipLock = useCallback(() => {
    if (flipLockTimerRef.current) {
      clearTimeout(flipLockTimerRef.current);
      flipLockTimerRef.current = null;
    }
    setIsFlipAnimating(false);
  }, []);

  const armFlipLock = useCallback(() => {
    if (prefersReducedMotion) return;
    setIsFlipAnimating(true);
    if (flipLockTimerRef.current) {
      clearTimeout(flipLockTimerRef.current);
    }
    flipLockTimerRef.current = setTimeout(() => {
      flipLockTimerRef.current = null;
      setIsFlipAnimating(false);
    }, FLIP_DURATION + FLIP_LOCK_BUFFER);
  }, [prefersReducedMotion]);

  useEffect(() => {
    // Detect when a card appears for the first time and is already revealed
    if (!lastCardRef.current && card && isRevealed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state for animation coordination
      setShouldForceReveal(true);
    } else {
      setShouldForceReveal(false);
    }
    lastCardRef.current = card;
  }, [card, isRevealed]);

  useEffect(() => {
    if (card) {
      displayCardRef.current = card;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state for animation coordination
      setDisplayCard(card);
      setIsHidden(false);
      releaseFlipLock();
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current);
        removeTimerRef.current = null;
      }
      return;
    }

    if (displayCardRef.current) {
      setIsHidden(true);
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current);
      }
      const exitDuration = prefersReducedMotion ? 0 : CARD_LAYOUT_EXIT_DURATION;
      removeTimerRef.current = setTimeout(() => {
        displayCardRef.current = null;
        setDisplayCard(null);
        removeTimerRef.current = null;
      }, exitDuration);
    } else {
      setDisplayCard(null);
      setIsHidden(true);
    }
  }, [card, prefersReducedMotion, releaseFlipLock]);

  useEffect(() => () => {
    if (removeTimerRef.current) {
      clearTimeout(removeTimerRef.current);
      removeTimerRef.current = null;
    }
    if (flipLockTimerRef.current) {
      clearTimeout(flipLockTimerRef.current);
      flipLockTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRevealed || prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lock state must sync with reveal/reset transitions
      releaseFlipLock();
    }
  }, [isRevealed, prefersReducedMotion, releaseFlipLock]);

  const handleButtonClick = useCallback((event) => {
    if (isFlipAnimating) {
      event.preventDefault();
      return;
    }
    if (!isRevealed && !prefersReducedMotion) {
      armFlipLock();
    }
    onClick?.(event);
  }, [armFlipLock, isFlipAnimating, isRevealed, onClick, prefersReducedMotion]);

  if (!resolvedCard) return null;

  const resolvedChildren = typeof children === 'function'
    ? children(resolvedCard, shouldForceReveal)
    : children;

  return (
    <button
      ref={buttonRef}
      data-layout-card
      onClick={handleButtonClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      disabled={disabled || isFlipAnimating}
      aria-disabled={ariaDisabled || isFlipAnimating}
      aria-label={ariaLabel}
      className={className}
      style={{
        ...style,
        display: isHidden ? 'none' : undefined,
        scale: positionScale || 1,
        rotate: positionRotate ? `${positionRotate}deg` : undefined
      }}
    >
      {resolvedChildren}
    </button>
  );
}

/**
 * SpreadTable - Visual spread layout showing where cards will land
 * Displays placeholders for undealt positions and mini cards for dealt positions
 */
export function SpreadTable({
  spreadKey,
  cards = [],
  revealedIndices = new Set(),
  onCardClick,
  onCardReveal,
  onSlotDeal,
  nextDealIndex = 0,
  compact = false,
  size = 'default',
  recentlyClosedIndex = -1,
  hideLegend = false,
  disableReveal = false,
  flashNextSlot = false,
  mentionPulse = null,
  showProgress = true,
  showTactileLens = true
}) {
  const prefersReducedMotion = useReducedMotion();
  const { vibrate, vibrateType } = useHaptic();
  const sounds = useSounds();
  const tactileLens = useTactileLens({ disabled: !showTactileLens || compact });
  const [scopeRootRef, scopeRef] = useAnimeScope();
  const baseLayout = SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
  const spreadInfo = SPREADS[spreadKey];
  const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
  const drawCount = typeof spreadInfo?.drawCount === 'number'
    ? spreadInfo.drawCount
    : (typeof spreadInfo?.count === 'number' ? spreadInfo.count : null);
  const layoutLimit = Number.isFinite(drawCount)
    ? Math.max(drawCount, cards?.length ?? 0)
    : (cards?.length ?? baseLayout.length);
  const cappedLimit = maxCards ? Math.min(layoutLimit, maxCards) : layoutLimit;
  const limitedLayout = useMemo(() => {
    return baseLayout.slice(0, Math.min(cappedLimit, baseLayout.length));
  }, [baseLayout, cappedLimit]);
  const tableRef = useRef(null);
  const layoutRef = useRef(null);
  const [tableBounds, setTableBounds] = useState({ width: 0, height: 0 });
  const revealHintDismissedRef = useRef(false);
  const prevRevealedRef = useRef(new Set());
  const hoverCloseTimerRef = useRef(null);
  const holdTimerRef = useRef(null);
  const [cardInfoPopover, setCardInfoPopover] = useState({
    open: false,
    card: null,
    positionLabel: '',
    anchorRect: null
  });
  const [revealBursts, setRevealBursts] = useState([]);
  const revealBurstIdRef = useRef(0);
  const revealBurstTimersRef = useRef([]);
  const centerOutOrder = useMemo(
    () => getCenterOutOrder(spreadKey, limitedLayout.length),
    [spreadKey, limitedLayout.length]
  );
  const centerOutDelayByIndex = useMemo(() => {
    const delayMap = new Map();
    centerOutOrder.forEach((slotIndex, sequenceIndex) => {
      delayMap.set(slotIndex, sequenceIndex * CARD_LAYOUT_STAGGER);
    });
    return delayMap;
  }, [centerOutOrder]);
  const layoutStagger = useCallback(
    (_el, index) => centerOutDelayByIndex.get(index) || 0,
    [centerOutDelayByIndex]
  );

  const closeCardInfoPopover = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    setCardInfoPopover((prev) => ({
      ...prev,
      open: false
    }));
  }, []);

  const openCardInfoPopover = useCallback((card, positionLabel, anchorNode) => {
    if (!card || !anchorNode?.getBoundingClientRect) return;
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    const rect = anchorNode.getBoundingClientRect();
    setCardInfoPopover({
      open: true,
      card,
      positionLabel,
      anchorRect: rect
    });
  }, []);

  const scheduleCloseCardInfoPopover = useCallback(() => {
    if (hoverCloseTimerRef.current) {
      window.clearTimeout(hoverCloseTimerRef.current);
    }
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setCardInfoPopover((prev) => ({ ...prev, open: false }));
    }, 80);
  }, []);

  // Dual-trigger: handle slot tap to deal (when no card in slot yet)
  const handleSlotDeal = useCallback((slotIndex) => {
    if (!onSlotDeal) return;
    // Only allow dealing to the next expected slot
    if (slotIndex !== nextDealIndex) {
      // Locked slot - provide error feedback
      vibrateType('error');
      return;
    }
    onSlotDeal(slotIndex);
  }, [onSlotDeal, nextDealIndex, vibrateType]);

  // Get full position descriptions for tactile lens
  const fullPositions = useMemo(() => {
    if (!spreadInfo?.positions) return [];
    return spreadInfo.positions;
  }, [spreadInfo]);

  // Merge refs for the table container to get both layout and animation scope
  const setTableRefs = useMemo(() => {
    return (node) => {
      tableRef.current = node;
      scopeRootRef.current = node;
    };
  }, [scopeRootRef]);


  const baseMaxCardWidth = useMemo(
    () => getMaxCardWidth(limitedLayout, tableBounds),
    [limitedLayout, tableBounds]
  );

  const resolvedLayout = useMemo(() => {
    if (spreadKey !== 'celtic') return limitedLayout;
    const width = tableBounds.width;
    if (!width || !baseMaxCardWidth) return limitedLayout;

    const targetOffsetPx = Math.min(
      CELTIC_CHALLENGE_OFFSET.maxPx,
      Math.max(CELTIC_CHALLENGE_OFFSET.minPx, baseMaxCardWidth * CELTIC_CHALLENGE_OFFSET.cardRatio)
    );
    const offsetPercent = (targetOffsetPx / width) * 100;

    return limitedLayout.map((pos) => {
      if (pos.label !== 'Challenge') return pos;
      const baseOffset = pos.offsetX || 0;
      return { ...pos, offsetX: Math.max(baseOffset, offsetPercent) };
    });
  }, [baseMaxCardWidth, limitedLayout, spreadKey, tableBounds]);

  const visibleLayout = resolvedLayout;

  useEffect(() => {
    const element = tableRef.current;
    if (!element || typeof window === 'undefined') return undefined;

    const updateBounds = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      setTableBounds(prev => (
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      ));
    };

    updateBounds();

    const Observer = window.ResizeObserver;
    if (!Observer) {
      window.addEventListener('resize', updateBounds);
      return () => window.removeEventListener('resize', updateBounds);
    }

    const observer = new Observer(updateBounds);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion) {
      if (layoutRef.current) {
        layoutRef.current.revert();
        layoutRef.current = null;
      }
      return undefined;
    }
    const node = tableRef.current;
    if (!node) return undefined;
    const layout = createLayout(node, {
      children: '[data-layout-card]',
      duration: CARD_LAYOUT_DURATION,
      ease: 'outQuad'
    });
    layoutRef.current = layout;
    return () => {
      layout.revert();
      layoutRef.current = null;
    };
  }, [prefersReducedMotion]);

  useLayoutEffect(() => {
    if (prefersReducedMotion) return undefined;
    const layout = layoutRef.current;
    if (!layout) return undefined;

    const timeline = layout.animate({
      duration: CARD_LAYOUT_DURATION,
      ease: 'outQuad',
      enterFrom: {
        opacity: 0,
        filter: 'blur(8px)',
        scale: 0.9,
        delay: (el, index, total) => layoutStagger(el, index, total)
      },
      leaveTo: {
        opacity: 0,
        filter: 'blur(8px)',
        scale: 0.9,
        duration: CARD_LAYOUT_EXIT_DURATION,
        ease: 'inQuad',
        delay: 0
      }
    });

    return () => {
      timeline?.pause?.();
      layout.record();
    };
  }, [cards, visibleLayout, tableBounds.width, tableBounds.height, prefersReducedMotion, layoutStagger]);

  const maxCardWidth = useMemo(
    () => getMaxCardWidth(visibleLayout, tableBounds),
    [visibleLayout, tableBounds]
  );

  const cardSizeStyle = useMemo(() => {
    if (!maxCardWidth || maxCardWidth <= 0) return null;
    return {
      maxWidth: `${maxCardWidth}px`,
      maxHeight: `${maxCardWidth / CARD_ASPECT}px`
    };
  }, [maxCardWidth]);

  // Aspect ratio based on spread type
  const aspectRatio = spreadKey === 'celtic' ? '4/3' : '3/2';

  const sizeClass = compact
    ? 'w-11 h-[60px] xs:w-12 xs:h-16 sm:w-14 sm:h-[76px]'
    : size === 'large'
      ? 'w-20 h-[120px] xs:w-24 xs:h-[140px] sm:w-28 sm:h-[160px] md:w-32 md:h-[180px]'
      : 'w-14 h-[76px] xs:w-16 xs:h-[88px] sm:w-[72px] sm:h-24 md:w-20 md:h-28';

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const preloadImages = cards
      ?.slice?.(0, visibleLayout.length)
      ?.map?.((card) => getCardImage(card))
      ?.filter?.((src) => typeof src === 'string' && src.length > 0) || [];
    if (!preloadImages.length) return undefined;

    const head = document.head;
    const created = [];
    preloadImages.forEach((src) => {
      const existing = head.querySelector(`link[rel="preload"][as="image"][href="${src}"]`);
      if (existing) return;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      link.setAttribute('data-spread-preload', 'true');
      head.appendChild(link);
      created.push(link);
    });

    return () => {
      created.forEach((node) => {
        if (node?.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
    };
  }, [cards, visibleLayout.length]);

  useEffect(() => {
    if (!revealedIndices || !(revealedIndices instanceof Set)) return;
    if (revealedIndices.size === 0) {
      revealHintDismissedRef.current = false;
      prevRevealedRef.current = new Set();
    }
    if (revealedIndices.size > 0) {
      revealHintDismissedRef.current = true;
    }
    const newlyRevealed = [];
    revealedIndices.forEach((index) => {
      if (!prevRevealedRef.current.has(index)) {
        newlyRevealed.push(index);
      }
    });
    prevRevealedRef.current = new Set(revealedIndices);

    if (!newlyRevealed.length) return;
    const timerId = window.setTimeout(() => vibrate(12), prefersReducedMotion ? 0 : 180);
    const soundTimers = newlyRevealed.map((_, sequenceIndex) => {
      const soundDelay = prefersReducedMotion ? 0 : sequenceIndex * 90;
      return window.setTimeout(() => {
        void sounds.play('deal', { essential: true });
      }, soundDelay);
    });
    const burstTimers = newlyRevealed.map((slotIndex, sequenceIndex) => {
      const burstDelay = prefersReducedMotion ? 0 : sequenceIndex * 90;
      return window.setTimeout(() => {
        revealBurstIdRef.current += 1;
        const burstId = `burst-${slotIndex}-${revealBurstIdRef.current}`;
        const burstSuit = cards?.[slotIndex]?.suit || null;
        setRevealBursts((prev) => [...prev, { id: burstId, slotIndex, suit: burstSuit }]);
        const removeTimer = window.setTimeout(() => {
          setRevealBursts((prev) => prev.filter((burst) => burst.id !== burstId));
          revealBurstTimersRef.current = revealBurstTimersRef.current.filter((timer) => timer !== removeTimer);
        }, prefersReducedMotion ? 320 : 760);
        revealBurstTimersRef.current.push(removeTimer);
      }, burstDelay);
    });
    revealBurstTimersRef.current.push(...burstTimers);
    return () => {
      window.clearTimeout(timerId);
      soundTimers.forEach((id) => window.clearTimeout(id));
      burstTimers.forEach((id) => window.clearTimeout(id));
      revealBurstTimersRef.current = revealBurstTimersRef.current.filter(
        (timer) => !burstTimers.includes(timer)
      );
    };
  }, [cards, revealedIndices, vibrate, prefersReducedMotion, sounds]);

  // Clean up all scoped animations when spread changes
  useEffect(() => {
    setRevealBursts([]);
    const scope = scopeRef.current;
    return () => {
      if (scope?.revert) {
        scope.revert();
      }
      if (hoverCloseTimerRef.current) {
        window.clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
      }
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      revealBurstTimersRef.current.forEach((id) => window.clearTimeout(id));
      revealBurstTimersRef.current = [];
    };
  }, [spreadKey, scopeRef]);

  // Keep next slot in view on mobile after deal/reveal
  useEffect(() => {
    if (nextDealIndex == null || nextDealIndex < 0) return;
    const el = tableRef.current?.querySelector?.(`[data-slot-index="${nextDealIndex}"]`);
    if (!el || typeof el.scrollIntoView !== 'function') return;
    const rect = el.getBoundingClientRect();
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const isVisible = rect &&
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= viewportHeight &&
      rect.right <= viewportWidth;

    if (!isVisible) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'center' });
    }
  }, [nextDealIndex, prefersReducedMotion]);

  return (
    <div
      ref={setTableRefs}
      className={`spread-table panel-mystic relative w-full rounded-2xl sm:rounded-3xl border overflow-hidden ${
        compact ? 'p-3' : 'p-4 sm:p-6'
      }`}
      style={{
        aspectRatio,
        background: `
          radial-gradient(circle at 0% 18%, var(--glow-gold), transparent 40%),
          radial-gradient(circle at 100% 0%, var(--glow-blue), transparent 38%),
          radial-gradient(circle at 52% 115%, var(--glow-pink), transparent 46%),
          linear-gradient(135deg, var(--panel-dark-1), var(--panel-dark-2) 55%, var(--panel-dark-3))
        `,
        borderColor: 'var(--border-warm)',
        boxShadow: '0 24px 64px -40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
      }}
      role="region"
      aria-label={`${spreadInfo?.name || 'Spread'} layout`}
    >
      {/* Noise texture provided by .panel-mystic::after */}

      {/* Position placeholders */}
      {visibleLayout.map((pos, i) => {
        const card = cards?.[i];
        const isRevealed = revealedIndices?.has?.(i) || false;
        const isNext = i === nextDealIndex && !isRevealed;
        const isRevealDisabled = disableReveal && !isRevealed;
        const positionLabel = getPositionLabel(spreadInfo, i, pos);
        const shortLabel = extractShortLabel(positionLabel, 20) || positionLabel;
        const shouldHighlightReturn = recentlyClosedIndex === i;
        const shouldMentionPulse = Boolean(mentionPulse && mentionPulse.index === i && isRevealed);
        const mentionPulseId = mentionPulse?.id ?? 0;
        const showRevealPill = !disableReveal && !isRevealed && (isNext || (!revealHintDismissedRef.current && i === 0));
        const showGlowHint = !disableReveal && !isRevealed && !showRevealPill;
        const canDeal = Boolean(onSlotDeal) && isNext;
        const enableInfoPopover = Boolean(card && isRevealed);
        const numberBadge = (
          <div
            className={`
              absolute -top-2 -left-2 rounded-full border px-2 py-1
              text-2xs font-semibold tracking-wide shadow-lg
              ${isRevealed ? 'bg-secondary/80 border-secondary/60 text-main' : 'bg-primary/80 border-primary/60 text-main'}
            `}
            aria-hidden="true"
          >
            {i + 1}
          </div>
        );

        return (
          <SlotPulseWrapper
            key={i}
            active={isNext}
            prefersReducedMotion={prefersReducedMotion}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              zIndex: isRevealed ? 10 : card ? 5 : 1,
              marginLeft: pos.offsetX ? `${pos.offsetX}%` : 0
            }}
            data-slot-index={i}
            id={`spread-slot-${i}`}
          >
            {!card && (
              // Empty placeholder - dual-trigger: tappable to deal card here
              <button
                type="button"
                onClick={() => handleSlotDeal(i)}
                disabled={!canDeal}
                aria-disabled={!canDeal}
                className={`
                  ${sizeClass}
                  relative rounded-lg border-2 border-dashed
                  flex items-center justify-center
                  transition-all overflow-visible touch-manipulation
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70
                  ${canDeal
                    ? 'border-primary/60 bg-primary/10 card-placeholder-next cursor-pointer hover:bg-primary/20 active:scale-95'
                    : 'border-accent/30 bg-surface/30 cursor-not-allowed opacity-70'
                  }
                `}
                style={{
                  ...(cardSizeStyle || {})
                }}
                aria-label={
                  isNext
                    ? MICROCOPY.revealPosition(shortLabel)
                    : i < nextDealIndex
                      ? `${positionLabel}: waiting for card`
                      : MICROCOPY.awaitingPrevious(getPositionLabel(spreadInfo, nextDealIndex, visibleLayout[nextDealIndex]))
                }
              >
                {numberBadge}
                <PulseRing
                  active={isNext}
                  prefersReducedMotion={prefersReducedMotion}
                  className="absolute inset-[-10%] rounded-xl border-2 border-primary/50 pointer-events-none"
                />
                <OneShotRing
                  active={shouldHighlightReturn}
                  prefersReducedMotion={prefersReducedMotion}
                  className="absolute inset-[-12%] rounded-xl border-2 border-secondary/60 pointer-events-none"
                  duration={prefersReducedMotion ? 600 : 1200}
                  opacityKeyframes={[0.9, 0.4, 0]}
                  scaleKeyframes={[1, 1, 1]}
                  reducedOpacity={0.5}
                />
                <span className={`${compact ? 'text-2xs xs:text-2xs' : 'text-2xs xs:text-2xs sm:text-xs'} text-muted text-center px-1 leading-tight`}>
                  {isNext ? MICROCOPY.revealPosition(shortLabel) : shortLabel}
                </span>
              </button>
            )}
            <AnimatedCardButton
              card={card}
              isRevealed={isRevealed}
              prefersReducedMotion={prefersReducedMotion}
              positionScale={pos.scale}
              positionRotate={pos.rotate}
              className={`
                ${sizeClass}
                relative rounded-lg border-2 cursor-pointer overflow-hidden
                transition-all touch-manipulation
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main
                disabled:opacity-60 disabled:cursor-not-allowed
                ${isRevealed
                  ? 'shadow-lg'
                  : showRevealPill
                    ? 'border-primary/70 ring-2 ring-primary/30 shadow-md shadow-primary/20 hover:border-primary/80 active:scale-95'
                    : 'border-primary/35 shadow-[0_0_16px_var(--primary-20)] hover:border-primary/50 active:scale-95'
                }
              `}
              style={{
                ...(cardSizeStyle || {}),
                perspective: '900px',
                WebkitPerspective: '900px',
                ...(isRevealed && card
                  ? {
                    borderColor: getSuitBorderColor(card),
                    boxShadow: getRevealedCardGlow(card)
                  }
                  : {})
              }}
              onClick={() => {
                if (!card) return;
                if (isRevealed) {
                  onCardClick?.(card, positionLabel, i);
                  return;
                }
                if (disableReveal) return;
                onCardReveal?.(i);
              }}
              onMouseEnter={(event) => {
                if (!enableInfoPopover) return;
                openCardInfoPopover(card, positionLabel, event.currentTarget);
              }}
              onMouseLeave={() => {
                if (!enableInfoPopover) return;
                scheduleCloseCardInfoPopover();
              }}
              onTouchStart={(event) => {
                if (!enableInfoPopover) return;
                if (holdTimerRef.current) {
                  window.clearTimeout(holdTimerRef.current);
                }
                const target = event.currentTarget;
                holdTimerRef.current = window.setTimeout(() => {
                  holdTimerRef.current = null;
                  openCardInfoPopover(card, positionLabel, target);
                }, 420);
              }}
              onTouchEnd={() => {
                if (holdTimerRef.current) {
                  window.clearTimeout(holdTimerRef.current);
                  holdTimerRef.current = null;
                }
              }}
              onTouchCancel={() => {
                if (holdTimerRef.current) {
                  window.clearTimeout(holdTimerRef.current);
                  holdTimerRef.current = null;
                }
              }}
              disabled={isRevealDisabled}
              ariaDisabled={isRevealDisabled}
              ariaLabel={card
                ? isRevealed
                  ? `${card.name} in ${positionLabel} position. Click to view details.`
                  : disableReveal
                    ? `${positionLabel} position. Draw from the deck to reveal.`
                    : `Card in ${positionLabel} position. Click to reveal.`
                : undefined
              }
            >
              {(displayCard, forceRevealOnMount) => {
                const displayImage = getCardImage(displayCard);
                return (
                  <>
                    {numberBadge}
                    <FlashRing
                      active={flashNextSlot && isNext}
                      prefersReducedMotion={prefersReducedMotion}
                      className="absolute inset-[-12%] rounded-xl border-2 border-secondary/70 pointer-events-none"
                    />
                    <FlipCard
                      key={displayCard?.name || displayCard?.id || i}
                      isRevealed={isRevealed}
                      prefersReducedMotion={prefersReducedMotion}
                      forceRevealOnMount={forceRevealOnMount}
                      className="w-full h-full relative"
                      style={{
                        transformStyle: 'preserve-3d',
                        WebkitTransformStyle: 'preserve-3d',
                        willChange: prefersReducedMotion ? undefined : 'transform'
                      }}
                    >
                      <div
                        className="absolute inset-0 bg-surface flex items-center justify-center"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: displayCard.isReversed
                            ? 'rotateZ(180deg) translateZ(0.1px)'
                            : 'translateZ(0.1px)'
                        }}
                      >
                        <img
                          src={displayImage}
                          alt={displayCard.name}
                          className="w-full h-full object-cover"
                          loading={isNext ? 'eager' : 'lazy'}
                          decoding="async"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = FALLBACK_IMAGE;
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-main/80 to-transparent p-0.5 xs:p-1 sm:p-1">
                          <span className={`${compact ? 'text-2xs xs:text-2xs' : 'text-2xs xs:text-2xs sm:text-2xs'} text-main font-semibold leading-tight block truncate`}>
                            {displayCard.name.replace(/^The /, '')}
                          </span>
                        </div>
                        <OneShotRing
                          active={shouldHighlightReturn}
                          prefersReducedMotion={prefersReducedMotion}
                          className="absolute inset-[-8%] rounded-xl border-2 border-secondary/70 pointer-events-none"
                          duration={prefersReducedMotion ? 500 : 1100}
                          opacityKeyframes={[0.8, 0.35, 0]}
                          scaleKeyframes={[1, 1.03, 1.05]}
                          reducedOpacity={0.5}
                        />
                        <OneShotRing
                          key={`mention-${mentionPulseId}-${i}`}
                          active={shouldMentionPulse}
                          prefersReducedMotion={prefersReducedMotion}
                          className="absolute inset-[-10%] rounded-xl border-2 pointer-events-none"
                          duration={prefersReducedMotion ? 500 : 950}
                          opacityKeyframes={[0.75, 0.45, 0]}
                          scaleKeyframes={[1, 1.04, 1.08]}
                          reducedOpacity={0.55}
                          style={{
                            borderColor: getSuitBorderColor(displayCard),
                            boxShadow: `0 0 18px ${getSuitGlowColor(displayCard, 0.5)}`
                          }}
                        />
                      </div>
                      <div
                        className="absolute inset-0 bg-surface-muted flex items-center justify-center"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg) translateZ(0.1px)'
                        }}
                      >
                        <CardBack className="w-full h-full tarot-card-back--muted" />
                        <div className="absolute inset-0 pointer-events-none flex items-end justify-end p-1.5">
                          {showRevealPill ? (
                            <span className={`${compact ? 'text-2xs xs:text-2xs' : 'text-2xs xs:text-2xs sm:text-xs-plus'} inline-flex items-center gap-1 rounded-full bg-main/85 text-main font-semibold px-2.5 py-1 shadow-lg border border-primary/30`}>
                              <HandTap className="w-3.5 h-3.5" weight="fill" />
                              {MICROCOPY.tapToReveal}
                            </span>
                          ) : showGlowHint ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-main/70 text-primary/80 text-2xs sm:text-2xs font-semibold px-2 py-1 border border-primary/25 shadow-[0_0_12px_var(--primary-30)]">
                              {MICROCOPY.cardReady}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </FlipCard>
                  </>
                );
              }}
            </AnimatedCardButton>
            {revealBursts
              .filter((burst) => burst.slotIndex === i)
              .map((burst) => (
                <div key={burst.id} className="pointer-events-none absolute inset-[-22%] z-[15]">
                  <ParticleLayer
                    id={`slot-reveal-burst-${spreadKey}-${i}-${burst.id}`}
                    preset="reveal-burst"
                    suit={burst.suit || card?.suit || null}
                    intensity={prefersReducedMotion ? 0.25 : 0.62}
                    zIndex={1}
                  />
                </div>
              ))}
          </SlotPulseWrapper>
        );
      })}

      {/* Spread name indicator */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
        <span className={`${compact ? 'text-2xs px-2.5 py-1' : 'text-xs px-3 py-1'} text-muted/70 bg-surface/60 rounded-full border border-accent/10`}>
          {spreadInfo?.tag || spreadKey}
        </span>
      </div>

      {/* Legend for quick position reference */}
      {!compact && !hideLegend && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-[92%] sm:w-[86%]">
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 rounded-full bg-main/65 border border-secondary/30 px-3 py-2 backdrop-blur">
            {visibleLayout.map((pos, i) => {
              const label = getPositionLabel(spreadInfo, i, pos);
              const short = extractShortLabel(label, 22) || label;
              return (
                <span
                  key={`legend-${i}`}
                  className="inline-flex items-center gap-1.5 text-2xs sm:text-2xs text-muted bg-surface/70 border border-secondary/30 rounded-full px-2.5 py-1"
                >
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center border border-primary/40">
                    {i + 1}
                  </span>
                  <span className="max-w-[12ch] sm:max-w-[16ch] truncate">{short}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress indicator - shows revealed/total cards */}
      {!compact && showProgress && cards.length > 1 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <SpreadProgressIndicator
            total={visibleLayout.length}
            revealed={revealedIndices?.size || 0}
            variant="dots"
          />
        </div>
      )}

      {/* Tactile Lens button - press-hold to view position meanings */}
      {!compact && showTactileLens && (
        <div className="absolute bottom-3 left-3 z-20">
          <TactileLensButton
            disabled={cards.length === 0}
            isActive={tactileLens.isActive}
            showTutorial={tactileLens.showTutorial}
            onPointerDown={tactileLens.handlePointerDown}
            onPointerUp={tactileLens.handlePointerUp}
            onPointerLeave={tactileLens.handlePointerLeave}
            onDismissTutorial={tactileLens.dismissTutorial}
          />
        </div>
      )}

      {/* Tactile Lens overlay - shows position meanings when active */}
      <TactileLensOverlay
        isActive={tactileLens.isActive}
        positions={fullPositions}
        spreadLayout={visibleLayout}
        prefersReducedMotion={prefersReducedMotion}
      />

      <CardInfoPopover
        open={cardInfoPopover.open}
        card={cardInfoPopover.card}
        positionLabel={cardInfoPopover.positionLabel}
        anchorRect={cardInfoPopover.anchorRect}
        onClose={closeCardInfoPopover}
      />
    </div>
  );
}

/**
 * Compact horizontal spread preview for mobile.
 * Optionally interactive when onSlotClick is provided.
 */
export function SpreadTableCompact({
  spreadKey,
  cards = [],
  revealedIndices = new Set(),
  onSlotClick,
  activeSlot
}) {
  const layout = SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
  const spreadInfo = SPREADS[spreadKey];
  const maxCards = typeof spreadInfo?.maxCards === 'number' ? spreadInfo.maxCards : null;
  const drawCount = typeof spreadInfo?.drawCount === 'number'
    ? spreadInfo.drawCount
    : (typeof spreadInfo?.count === 'number' ? spreadInfo.count : null);
  const layoutLimit = Number.isFinite(drawCount)
    ? Math.max(drawCount, cards?.length ?? 0)
    : (cards?.length ?? layout.length);
  const cappedLimit = maxCards ? Math.min(layoutLimit, maxCards) : layoutLimit;
  const visibleLayout = layout.slice(0, Math.min(cappedLimit, layout.length));
  const isInteractive = typeof onSlotClick === 'function';

  return (
    <div
      className="flex items-center justify-center gap-2 py-3 px-4 bg-surface/40 rounded-xl border border-accent/15"
      role={isInteractive ? 'listbox' : 'region'}
      aria-label={`${spreadInfo?.name || 'Spread'} ${isInteractive ? 'card selector' : 'progress'}`}
    >
      {visibleLayout.map((pos, i) => {
        const card = cards?.[i];
        const isRevealed = revealedIndices?.has?.(i) || false;
        const isActive = activeSlot === i;

        const slotClasses = `
          w-7 h-10 xs:w-8 xs:h-11 rounded border
          flex items-center justify-center
          transition-all
          ${isActive
            ? 'ring-2 ring-primary/60 border-primary/80 bg-primary/20'
            : card
              ? isRevealed
                ? 'border-secondary/50 bg-secondary/20'
                : 'border-primary/40 bg-primary/10'
              : 'border-accent/20 bg-surface/50'
          }
          ${isInteractive ? 'cursor-pointer hover:border-primary/60 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''}
        `;

        const content = (
          <>
            {card && isRevealed ? (
              <span className="text-2xs xs:text-2xs text-secondary font-bold">
                {card.name.charAt(0)}
              </span>
            ) : card ? (
              <span className="text-2xs xs:text-2xs text-primary">?</span>
            ) : null}
          </>
        );

        if (isInteractive) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSlotClick(i)}
              role="option"
              aria-selected={isActive}
              aria-label={`${pos.label || `Position ${i + 1}`}${card ? `: ${card.name}` : ''}`}
              className={slotClasses}
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={i}
            className={slotClasses}
            title={pos.label || `Position ${i + 1}`}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
