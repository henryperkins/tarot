import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPREADS } from '../data/spreads';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { getCardImage, FALLBACK_IMAGE } from '../lib/cardLookup';
import { getSuitBorderColor, getRevealedCardGlow } from '../lib/suitColors';
import { extractShortLabel, getPositionLabel } from './readingBoardUtils';
import { HandTap } from '@phosphor-icons/react';
import { useHaptic } from '../hooks/useHaptic';

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
    { x: 50, y: 75, label: 'Connection' }
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
  nextDealIndex = 0,
  compact = false,
  size = 'default',
  recentlyClosedIndex = -1,
  hideLegend = false,
  disableReveal = false
}) {
  const prefersReducedMotion = useReducedMotion();
  const { vibrate } = useHaptic();
  const baseLayout = SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
  const spreadInfo = SPREADS[spreadKey];
  const tableRef = useRef(null);
  const [tableBounds, setTableBounds] = useState({ width: 0, height: 0 });
  const revealHintDismissedRef = useRef(false);
  const prevRevealedRef = useRef(new Set());


  const baseMaxCardWidth = useMemo(
    () => getMaxCardWidth(baseLayout, tableBounds),
    [baseLayout, tableBounds]
  );

  const resolvedLayout = useMemo(() => {
    if (spreadKey !== 'celtic') return baseLayout;
    const width = tableBounds.width;
    if (!width || !baseMaxCardWidth) return baseLayout;

    const targetOffsetPx = Math.min(
      CELTIC_CHALLENGE_OFFSET.maxPx,
      Math.max(CELTIC_CHALLENGE_OFFSET.minPx, baseMaxCardWidth * CELTIC_CHALLENGE_OFFSET.cardRatio)
    );
    const offsetPercent = (targetOffsetPx / width) * 100;

    return baseLayout.map((pos) => {
      if (pos.label !== 'Challenge') return pos;
      const baseOffset = pos.offsetX || 0;
      return { ...pos, offsetX: Math.max(baseOffset, offsetPercent) };
    });
  }, [baseLayout, baseMaxCardWidth, spreadKey, tableBounds]);

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

  const maxCardWidth = useMemo(
    () => getMaxCardWidth(resolvedLayout, tableBounds),
    [resolvedLayout, tableBounds]
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
    return () => window.clearTimeout(timerId);
  }, [revealedIndices, vibrate, prefersReducedMotion]);

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
      ref={tableRef}
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
      {resolvedLayout.map((pos, i) => {
        const card = cards?.[i];
        const isRevealed = revealedIndices?.has?.(i) || false;
        const isNext = i === nextDealIndex && !isRevealed;
        const isRevealDisabled = disableReveal && !isRevealed;
        const positionLabel = getPositionLabel(spreadInfo, i, pos);
        const shortLabel = extractShortLabel(positionLabel, 20) || positionLabel;
        const cardImage = card ? getCardImage(card) : null;
        const shouldHighlightReturn = recentlyClosedIndex === i;
        const showRevealPill = !disableReveal && !isRevealed && (isNext || (!revealHintDismissedRef.current && i === 0));
        const showGlowHint = !disableReveal && !isRevealed && !showRevealPill;
        const numberBadge = (
          <div
            className={`
              absolute -top-2 -left-2 rounded-full border px-2 py-1
              text-[0.65rem] font-semibold tracking-wide shadow-lg
              ${isRevealed ? 'bg-secondary/80 border-secondary/60 text-main' : 'bg-primary/80 border-primary/60 text-main'}
            `}
            aria-hidden="true"
          >
            {i + 1}
          </div>
        );

        return (
          <motion.div
            key={i}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              zIndex: isRevealed ? 10 : card ? 5 : 1,
              marginLeft: pos.offsetX ? `${pos.offsetX}%` : 0
            }}
            data-slot-index={i}
            id={`spread-slot-${i}`}
            initial={false}
            animate={isNext && !prefersReducedMotion ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {!card ? (
              // Empty placeholder - min 44px touch target on mobile
              <div
                className={`
                  ${sizeClass}
                  relative rounded-lg border-2 border-dashed
                  flex items-center justify-center
                  transition-all overflow-visible
                  ${isNext
                    ? 'border-primary/60 bg-primary/10 card-placeholder-next'
                    : 'border-accent/30 bg-surface/30'
                  }
                `}
                style={{
                  ...(cardSizeStyle || {})
                }}
                role="img"
                aria-label={`${positionLabel}: waiting for card`}
              >
                {numberBadge}
                {isNext && (
                  <motion.div
                    className="absolute inset-[-10%] rounded-xl border-2 border-primary/50 pointer-events-none"
                    animate={!prefersReducedMotion ? { scale: [1, 1.08, 1], opacity: [0.65, 1, 0.65] } : {}}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {shouldHighlightReturn && (
                  <motion.div
                    className="absolute inset-[-12%] rounded-xl border-2 border-secondary/60 pointer-events-none"
                    animate={!prefersReducedMotion ? { opacity: [0.9, 0.4, 0] } : { opacity: 0.5 }}
                    transition={{ duration: prefersReducedMotion ? 0.6 : 1.2, repeat: 0 }}
                  />
                )}
                <span className={`${compact ? 'text-[0.55rem] xs:text-[0.6rem]' : 'text-[0.6rem] xs:text-[0.65rem] sm:text-xs'} text-muted text-center px-1 leading-tight`}>
                  {shortLabel}
                </span>
              </div>
            ) : (
              // Card in position (mini representation) - min 44px touch target
              <AnimatePresence mode="wait">
                <motion.button
                  key={card.name}
                  initial={prefersReducedMotion ? { opacity: 1 } : {
                    opacity: 0,
                    filter: 'blur(8px)',
                    scale: 0.9
                  }}
                  animate={{
                    opacity: 1,
                    filter: 'blur(0px)',
                    scale: pos.scale || 1,
                    rotate: pos.rotate || 0
                  }}
                  exit={prefersReducedMotion ? { opacity: 0 } : {
                    opacity: 0,
                    filter: 'blur(8px)',
                    scale: 0.9
                  }}
                  transition={prefersReducedMotion ? { duration: 0.1 } : {
                    duration: 0.4,
                    ease: [0.4, 0, 0.2, 1]
                  }}
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
                        : 'border-primary/35 shadow-[0_0_16px_rgba(244,223,175,0.12)] hover:border-primary/50 active:scale-95'
                    }
                  `}
                  style={{
                    ...(cardSizeStyle || {}),
                    perspective: '900px',
                    WebkitPerspective: '900px',
                    ...(isRevealed
                      ? {
                        borderColor: getSuitBorderColor(card),
                        boxShadow: getRevealedCardGlow(card)
                      }
                      : {})
                  }}
                  onClick={() => {
                    if (isRevealed) {
                      onCardClick?.(card, positionLabel, i);
                      return;
                    }
                    if (disableReveal) return;
                    onCardReveal?.(i);
                  }}
                  disabled={isRevealDisabled}
                  aria-disabled={isRevealDisabled}
                  aria-label={isRevealed
                    ? `${card.name} in ${positionLabel} position. Click to view details.`
                    : disableReveal
                      ? `${positionLabel} position. Draw from the deck to reveal.`
                      : `Card in ${positionLabel} position. Click to reveal.`
                  }
                >
                  {numberBadge}
                  <motion.div
                    className="w-full h-full relative"
                    style={{
                      transformStyle: 'preserve-3d',
                      WebkitTransformStyle: 'preserve-3d',
                      willChange: prefersReducedMotion ? undefined : 'transform'
                    }}
                    animate={{ rotateY: isRevealed ? 0 : 180 }}
                    initial={false}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <div
                      className={`absolute inset-0 bg-surface flex items-center justify-center ${card.isReversed ? 'rotate-180' : ''}`}
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'translateZ(0.1px)'
                      }}
                    >
                      <img
                        src={cardImage}
                        alt={card.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = FALLBACK_IMAGE;
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-main/80 to-transparent p-0.5 xs:p-1 sm:p-1">
                        <span className={`${compact ? 'text-[0.5rem] xs:text-[0.55rem]' : 'text-[0.55rem] xs:text-[0.6rem] sm:text-[0.65rem]'} text-main font-semibold leading-tight block truncate`}>
                          {card.name.replace(/^The /, '')}
                        </span>
                      </div>
                      {shouldHighlightReturn && (
                        <motion.div
                          className="absolute inset-[-8%] rounded-xl border-2 border-secondary/70 pointer-events-none"
                          initial={{ opacity: 0.8 }}
                          animate={{ opacity: [0.8, 0.35, 0], scale: [1, 1.03, 1.05] }}
                          transition={{ duration: prefersReducedMotion ? 0.5 : 1.1 }}
                        />
                      )}
                    </div>
                    <div
                      className="absolute inset-0 bg-surface-muted flex items-center justify-center"
                      style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg) translateZ(0.1px)'
                      }}
                    >
                      <img
                        src="/cardback.png"
                        alt="Card back"
                        className="w-full h-full object-cover opacity-90"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 pointer-events-none flex items-end justify-end p-1.5">
                        {showRevealPill ? (
                          <span className={`${compact ? 'text-[0.55rem] xs:text-[0.6rem]' : 'text-[0.65rem] xs:text-[0.7rem] sm:text-xs-plus'} inline-flex items-center gap-1 rounded-full bg-main/85 text-main font-semibold px-2.5 py-1 shadow-lg border border-primary/30`}>
                            <HandTap className="w-3.5 h-3.5" weight="fill" />
                            Tap to reveal
                          </span>
                        ) : showGlowHint ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-main/70 text-primary/80 text-[0.6rem] sm:text-[0.65rem] font-semibold px-2 py-1 border border-primary/25 shadow-[0_0_12px_rgba(244,223,175,0.22)]">
                            Ready
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                </motion.button>
              </AnimatePresence>
            )}
          </motion.div>
        );
      })}

      {/* Spread name indicator */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
        <span className={`${compact ? 'text-[0.6rem] px-2.5 py-1' : 'text-xs px-3 py-1'} text-muted/70 bg-surface/60 rounded-full border border-accent/10`}>
          {spreadInfo?.tag || spreadKey}
        </span>
      </div>

      {/* Legend for quick position reference */}
      {!compact && !hideLegend && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-[92%] sm:w-[86%]">
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 rounded-full bg-main/65 border border-secondary/30 px-3 py-2 backdrop-blur">
            {resolvedLayout.map((pos, i) => {
              const label = getPositionLabel(spreadInfo, i, pos);
              const short = extractShortLabel(label, 22) || label;
              return (
                <span
                  key={`legend-${i}`}
                  className="inline-flex items-center gap-1.5 text-[0.65rem] sm:text-[0.7rem] text-muted bg-surface/70 border border-secondary/30 rounded-full px-2.5 py-1"
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
    </div>
  );
}

/**
 * Compact horizontal spread preview for mobile
 */
export function SpreadTableCompact({ spreadKey, cards = [], revealedIndices = new Set() }) {
  const layout = SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
  const spreadInfo = SPREADS[spreadKey];

  return (
    <div
      className="flex items-center justify-center gap-2 py-3 px-4 bg-surface/40 rounded-xl border border-accent/15"
      role="region"
      aria-label={`${spreadInfo?.name || 'Spread'} progress`}
    >
      {layout.map((pos, i) => {
        const card = cards?.[i];
        const isRevealed = revealedIndices?.has?.(i) || false;

        return (
          <div
            key={i}
            className={`
              w-7 h-10 xs:w-8 xs:h-11 rounded border
              flex items-center justify-center
              transition-all
              ${card
                ? isRevealed
                  ? 'border-secondary/50 bg-secondary/20'
                  : 'border-primary/40 bg-primary/10'
                : 'border-accent/20 bg-surface/50'
              }
            `}
            title={pos.label || `Position ${i + 1}`}
          >
            {card && isRevealed ? (
              <span className="text-[0.5rem] xs:text-[0.55rem] text-secondary font-bold">
                {card.name.charAt(0)}
              </span>
            ) : card ? (
              <span className="text-[0.5rem] xs:text-[0.55rem] text-primary">?</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
