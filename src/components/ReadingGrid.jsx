import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowsLeftRight } from '@phosphor-icons/react';
import { getSpreadInfo } from '../data/spreads';
import { getOrientationMeaning } from '../lib/cardLookup';
import { Card } from './Card';
import { Tooltip } from './Tooltip';
import { CarouselDots } from './CarouselDots';
import { SpreadTableCompact } from './SpreadTable';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';

/**
 * Celtic Cross position short labels for mobile context.
 * These are abbreviated versions of the full position names from spreads.js,
 * optimized for display in constrained mobile UI elements.
 */
// Celtic Cross position short labels for mobile context
const CELTIC_POSITION_LABELS = [
  'Present',
  'Challenge',
  'Past',
  'Future',
  'Above',
  'Below',
  'Advice',
  'External',
  'Hopes/Fears',
  'Outcome'
];

// Celtic Cross area class mapping by index (more reliable than string matching)
const CELTIC_AREA_CLASSES = [
  'cc-present',
  'cc-challenge',
  'cc-past',
  'cc-future',
  'cc-above',
  'cc-below',
  'cc-advice',
  'cc-external',
  'cc-hopesfears',
  'cc-outcome'
];

// Mini-map grid positions for Celtic Cross visualization
const CELTIC_MINIMAP_POSITIONS = [
  { x: 1, y: 1, label: '1' },   // Present (center)
  { x: 1, y: 1, label: '2', overlay: true }, // Challenge (crossing)
  { x: 0, y: 1, label: '3' },   // Past (left)
  { x: 2, y: 1, label: '4' },   // Future (right)
  { x: 1, y: 0, label: '5' },   // Above
  { x: 1, y: 2, label: '6' },   // Below
  { x: 3, y: 2, label: '7' },   // Advice (staff bottom)
  { x: 3, y: 1.5, label: '8' }, // External
  { x: 3, y: 1, label: '9' },   // Hopes/Fears
  { x: 3, y: 0.5, label: '10' } // Outcome (staff top)
];

// Grid dimensions for mini-map positioning
const MINIMAP_GRID_WIDTH = 3.5;
const MINIMAP_GRID_HEIGHT = 2.5;

// Mini-map showing Celtic Cross layout with current position highlighted
function CelticCrossMiniMap({ activeIndex, totalCards }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface/80 backdrop-blur rounded-xl border border-secondary/30">
      {/* Mini grid visualization */}
      <div className="relative w-16 h-12 flex-shrink-0" aria-hidden="true">
        {CELTIC_MINIMAP_POSITIONS.slice(0, totalCards).map((pos, idx) => {
          // Build transform string - avoid compounding from className
          const transforms = ['translate(-50%, -50%)'];
          if (pos.overlay) {
            transforms.push('rotate(90deg)', 'scale(0.75)');
          } else if (idx === activeIndex) {
            transforms.push('scale(1.25)');
          }

          return (
            <div
              key={`minimap-pos-${idx}`}
              className={`absolute w-2.5 h-3.5 rounded-sm transition-all duration-200 ${
                idx === activeIndex
                  ? 'bg-primary shadow-md shadow-primary/50'
                  : 'bg-secondary/40'
              }`}
              style={{
                left: `${(pos.x / MINIMAP_GRID_WIDTH) * 100}%`,
                top: `${(pos.y / MINIMAP_GRID_HEIGHT) * 100}%`,
                transform: transforms.join(' ')
              }}
            />
          );
        })}
      </div>

      {/* Current position label */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted truncate">Position {activeIndex + 1} of {totalCards}</p>
        <p className="text-sm font-semibold text-accent truncate">
          {CELTIC_POSITION_LABELS[activeIndex] || `Card ${activeIndex + 1}`}
        </p>
      </div>
    </div>
  );
}

// Position dots wrapper that provides Celtic Cross position labels
function PositionDotsWrapper({ activeIndex, totalCards, spreadKey, onSelectPosition }) {
  const isCeltic = spreadKey === 'celtic';
  const labels = isCeltic
    ? CELTIC_POSITION_LABELS.slice(0, totalCards)
    : Array.from({ length: totalCards }, (_, i) => `Position ${i + 1}`);

  return (
    <CarouselDots
      activeIndex={activeIndex}
      totalItems={totalCards}
      onSelectItem={onSelectPosition}
      labels={labels}
      ariaLabel="Card positions"
    />
  );
}

function getAreaClass(index, selectedSpread) {
  if (selectedSpread !== 'celtic') return '';
  return CELTIC_AREA_CLASSES[index] || 'cc-present';
}

export function ReadingGrid({
  selectedSpread,
  reading,
  revealedCards,
  revealCard,
  reflections,
  setReflections,
  onCardClick
}) {
  const carouselRef = useRef(null);
  const cardsRef = useRef([]);
  const rafIdRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const [layoutPreference, setLayoutPreference] = useState('carousel');
  const [openReflectionIndex, setOpenReflectionIndex] = useState(null);
  const isCompactScreen = useSmallScreen();
  const isVerySmallScreen = useSmallScreen(480);
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const readingLength = reading?.length || 0;
  const manyCards = readingLength > 4;
  const mobileLayoutMode = useMemo(() => {
    if (!isCompactScreen) return 'carousel';
    if ((isVerySmallScreen || manyCards) && layoutPreference === 'carousel') {
      return 'list';
    }
    return layoutPreference;
  }, [isCompactScreen, isVerySmallScreen, manyCards, layoutPreference]);
  const isListView = mobileLayoutMode === 'list';
  const shouldUseGridOnMobile = Boolean(
    isCompactScreen &&
    !isListView &&
    selectedSpread !== 'celtic' &&
    readingLength &&
    readingLength <= 3
  );

  // In landscape mobile: use smaller card widths to fit more cards visible
  const carouselCardWidthClass = isLandscape
    ? 'min-w-[44vw] max-w-[11.5rem]'
    : isVerySmallScreen
      ? 'min-w-[82vw] max-w-[17.5rem]'
      : 'min-w-[72vw] xxs:min-w-[66vw] xs:min-w-[60vw] max-w-[18.5rem]';
  const mobileCarouselPadding = isLandscape ? 'px-2' : 'px-3 xxs:px-4';

  // Hide swipe hint only after user scrolls OR after extended timeout (8s)
  // This ensures users have time to discover the swipe gesture
  useEffect(() => {
    if (!reading || reading.length <= 1 || isListView || hasUserScrolled) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setShowSwipeHint(false);
    }, 8000); // Extended from 4s to 8s for better discoverability

    return () => clearTimeout(timer);
  }, [reading, isListView, hasUserScrolled]);

  // Reset scroll tracking when reading changes
  useEffect(() => {
    setHasUserScrolled(false);
    setShowSwipeHint(true);
  }, [reading]);

  // Keep only one mobile reflection open at a time; default to the first card with notes
  useEffect(() => {
    if (!Array.isArray(reading) || !isCompactScreen) return;

    setOpenReflectionIndex(prev => {
      if (prev !== null && reading[prev]) return prev;
      const firstWithReflection = reading.findIndex((_, idx) => {
        const val = reflections?.[idx];
        return typeof val === 'string' && val.trim().length > 0;
      });
      return firstWithReflection >= 0 ? firstWithReflection : null;
    });
  }, [reading, reflections, isCompactScreen]);

  // Celtic Cross uses a fixed CSS grid layout that doesn't scroll horizontally,
  // so carousel navigation (swipe, dots, prev/next) should be disabled for it
  const enableCarousel = readingLength > 1 && !isListView && selectedSpread !== 'celtic' && !shouldUseGridOnMobile;

  // Track user scroll interaction - only count significant scrolls (>20px)
  const lastScrollLeftRef = useRef(0);
  const hideHintOnInteraction = useCallback(() => {
    const container = carouselRef.current;
    if (!container || hasUserScrolled) return;

    const scrollDelta = Math.abs(container.scrollLeft - lastScrollLeftRef.current);
    if (scrollDelta > 20) {
      setHasUserScrolled(true);
      setShowSwipeHint(false);
    }
    lastScrollLeftRef.current = container.scrollLeft;
  }, [hasUserScrolled]);

  // Optimized scroll handler with RAF throttling and cached elements
  const updateActiveIndex = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;

    const cards = cardsRef.current;
    if (cards.length === 0) return;

    // Find the card whose center is closest to the viewport center
    const viewportCenter = el.scrollLeft + el.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    for (let idx = 0; idx < cards.length; idx++) {
      const card = cards[idx];
      if (!card) continue;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(viewportCenter - cardCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = idx;
      }
    }

    // Only update if index changed to prevent unnecessary re-renders
    setActiveIndex(prev => prev === closestIndex ? prev : closestIndex);
  }, []);

  useEffect(() => {
    if (!enableCarousel) return undefined;
    const el = carouselRef.current;
    if (!el) return undefined;

    // Cache card elements
    cardsRef.current = Array.from(el.children);

    // Initialize scroll position ref to prevent false positive on first scroll
    lastScrollLeftRef.current = el.scrollLeft;

    const handleScroll = () => {
      // Hide swipe hint on first scroll interaction
      hideHintOnInteraction();

      // Throttle with RAF
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        updateActiveIndex();
      });
    };

    // Initial calculation - schedule via RAF to avoid synchronous setState in effect
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      updateActiveIndex();
    });

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enableCarousel, readingLength, updateActiveIndex, hideHintOnInteraction]);

  const scrollToIndex = useCallback((index) => {
    if (!enableCarousel || !reading) return;
    const el = carouselRef.current;
    if (!el) return;

    const clamped = Math.min(reading.length - 1, Math.max(0, index));
    setActiveIndex(clamped);

    // Scroll to center the target card in the viewport
    const cards = cardsRef.current;
    const targetCard = cards[clamped];
    if (targetCard) {
      const cardCenter = targetCard.offsetLeft + targetCard.offsetWidth / 2;
      const scrollTarget = cardCenter - el.clientWidth / 2;
      el.scrollTo({
        left: Math.max(0, scrollTarget),
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    }
  }, [enableCarousel, reading, prefersReducedMotion]);

  const handleLayoutToggle = useCallback((mode) => {
    setLayoutPreference(mode);
    if (mode === 'list') {
      setShowSwipeHint(false);
    } else if (readingLength > 1) {
      setShowSwipeHint(true);
    }
  }, [readingLength]);

  const getCardTakeaway = useCallback((card) => {
    const meaning = getOrientationMeaning(card);
    if (!meaning) return '';
    const firstClause = meaning.split(/[.;]| — | – | - /)[0];
    const text = firstClause.trim();
    if (text.length <= 72) return text;
    return `${text.slice(0, 72).trimEnd()}…`;
  }, []);

  // Memoize tooltip content generator
  const getTooltipContent = useCallback((card, position, isRevealed) => {
    if (!isRevealed) return null;
    const takeaway = getCardTakeaway(card);
    return (
      <div className="space-y-1 text-left leading-snug">
        <strong className="block text-accent text-sm">{position}</strong>
        <p className="text-xs-plus text-muted">
          {card.name}{card.isReversed ? ' (Reversed)' : ''}
        </p>
        <p className="text-xs-plus text-main/90">{takeaway || 'Card revealed'}</p>
      </div>
    );
  }, [getCardTakeaway]);

  // Early return after all hooks to satisfy Rules of Hooks
  if (!reading) return null;

  const spreadInfo = getSpreadInfo(selectedSpread);
  const isBatchReveal = reading.length > 1 && revealedCards.size === reading.length;

  const responsiveGridFallback = reading.length <= 4
    ? 'sm:grid sm:gap-8 sm:overflow-visible sm:snap-none sm:pb-0 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
    : 'sm:grid sm:gap-8 sm:overflow-visible sm:snap-none sm:pb-0 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3';

  const multiCardLayoutClass = isListView
    ? 'flex flex-col gap-4 pb-6 sm:pb-4'
    : `flex overflow-x-auto snap-x snap-mandatory scrollbar-none ${isLandscape ? 'gap-2 pb-5' : 'gap-3 pb-8'} ${mobileCarouselPadding}`;

  const shouldApplyCarouselPadding = enableCarousel && !isListView && selectedSpread !== 'celtic';
  const shouldShowCompactMap = Boolean(isCompactScreen && reading && reading.length > 2);
  const carouselInlineStyles = shouldApplyCarouselPadding
    ? {
        scrollPaddingLeft: 'max(1.25rem, env(safe-area-inset-left, 1rem))',
        scrollPaddingRight: 'max(1.25rem, env(safe-area-inset-right, 1rem))',
        scrollbarGutter: 'stable both-edges'
      }
    : undefined;

  return (
    <>
      {enableCarousel && showSwipeHint && !hasUserScrolled && reading.length > 1 && (
        <div
          className="sm:hidden flex items-center justify-center gap-2 px-4 py-2 mb-2 mx-auto w-fit rounded-full bg-main/80 backdrop-blur-sm border border-secondary/30 shadow-lg animate-pulse"
          role="status"
          aria-live="polite"
        >
          <ArrowsLeftRight className="w-4 h-4 text-accent" weight="bold" aria-hidden="true" />
          <span className="text-xs font-medium text-main">Swipe to see more cards</span>
        </div>
      )}
      <div
        className={
          selectedSpread === 'celtic'
            ? 'cc-grid animate-fade-in'
            : shouldUseGridOnMobile
              ? 'animate-fade-in grid grid-cols-1 xxs:grid-cols-2 gap-3 xs:gap-4'
              : `animate-fade-in ${reading.length === 1
                ? 'grid grid-cols-1 max-w-md mx-auto'
                : `${multiCardLayoutClass} ${responsiveGridFallback}`
              }`
        }
        style={selectedSpread === 'celtic' ? undefined : carouselInlineStyles}
        ref={enableCarousel ? carouselRef : null}
      >
        {reading.map((card, index) => {
          const position = spreadInfo?.positions?.[index] || `Position ${index + 1}`;
          const isRevealed = revealedCards.has(index);
          const tooltipContent = getTooltipContent(card, position, isRevealed);
          const reflectionPreview = (reflections?.[index] || '').trim();

          const cardElement = (
            <Card
              card={card}
              index={index}
              isRevealed={isRevealed}
              onReveal={revealCard}
              position={position}
              reflections={reflections}
              setReflections={setReflections}
              onCardClick={onCardClick}
              openReflectionIndex={openReflectionIndex}
              onRequestOpenReflection={setOpenReflectionIndex}
              staggerDelay={isBatchReveal ? index * 0.15 : 0}
            />
          );

          return (
            <div
              key={`${card.name}-${index}`}
              className={`${selectedSpread === 'celtic'
                ? getAreaClass(index, selectedSpread)
                : reading.length > 1 ? (isListView ? 'w-full sm:min-w-0' : `${carouselCardWidthClass} snap-center sm:min-w-0`) : ''
                }`}
            >
              <Tooltip
                content={tooltipContent}
                position="top"
                asChild
                enableClick={false}
                autoHideMs={null}
                triggerClassName="block h-full"
              >
                {cardElement}
              </Tooltip>
              {isCompactScreen && reflectionPreview && (
                <p className="mt-2 text-[11px] text-secondary/80 truncate">
                  Notes: {reflectionPreview}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {reading.length > 1 && (
        <div className={`sm:hidden ${isLandscape ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}`}>
          {/* Layout toggle - hide in landscape to save space */}
          {!isLandscape && (
            <div className="flex items-center justify-center gap-2" role="group" aria-label="Change mobile layout">
              <button
                type="button"
                aria-pressed={!isListView}
                onClick={() => handleLayoutToggle('carousel')}
                className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${isListView ? 'border-secondary/40 text-muted' : 'border-primary/60 bg-primary/10 text-primary'}`}
              >
                Swipe view
              </button>
              <button
                type="button"
                aria-pressed={isListView}
                onClick={() => handleLayoutToggle('list')}
                className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold ${isListView ? 'border-primary/60 bg-primary/10 text-primary' : 'border-secondary/40 text-muted'}`}
              >
                List view
              </button>
            </div>
          )}

          {shouldShowCompactMap && (
            <SpreadTableCompact
              spreadKey={selectedSpread}
              cards={reading}
              revealedIndices={revealedCards}
            />
          )}

          {enableCarousel && (
            <>
              {/* Celtic Cross mini-map - more compact in landscape */}
              {selectedSpread === 'celtic' && !isLandscape && (
                <CelticCrossMiniMap activeIndex={activeIndex} totalCards={reading.length} />
              )}

              <PositionDotsWrapper
                activeIndex={activeIndex}
                totalCards={reading.length}
                spreadKey={selectedSpread}
                onSelectPosition={scrollToIndex}
              />

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => scrollToIndex(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  className={`inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface ${isLandscape ? 'px-2 py-1 min-w-[44px] min-h-[44px]' : 'px-3 py-2 min-w-[48px] min-h-[44px]'} text-xs font-semibold text-muted disabled:opacity-40 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  aria-label="Show previous card"
                >
                  {isLandscape ? '←' : 'Prev'}
                </button>
                <p className="text-xs text-muted" aria-live="polite">
                  {selectedSpread === 'celtic'
                    ? CELTIC_POSITION_LABELS[activeIndex]
                    : `${activeIndex + 1}/${reading.length}`}
                </p>
                <button
                  type="button"
                  onClick={() => scrollToIndex(activeIndex + 1)}
                  disabled={activeIndex >= reading.length - 1}
                  className={`inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface ${isLandscape ? 'px-2 py-1 min-w-[44px] min-h-[44px]' : 'px-3 py-2 min-w-[48px] min-h-[44px]'} text-xs font-semibold text-muted disabled:opacity-40 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  aria-label="Show next card"
                >
                  {isLandscape ? '→' : 'Next'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
