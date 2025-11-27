import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpreadInfo } from '../data/spreads';
import { getOrientationMeaning } from '../lib/cardLookup';
import { Card } from './Card';
import { Tooltip } from './Tooltip';
import { CarouselDots } from './CarouselDots';
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
  const [mobileLayoutMode, setMobileLayoutMode] = useState('carousel');
  const isCompactScreen = useSmallScreen();
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const isListView = mobileLayoutMode === 'list';

  // In landscape mobile: use smaller card widths to fit more cards visible
  const landscapeCardWidth = isLandscape ? 'min-w-[45vw]' : 'min-w-[68vw]';

  // Hide swipe hint after 4 seconds or when user interacts
  useEffect(() => {
    if (!reading || reading.length <= 1 || isListView) return undefined;

    const timer = setTimeout(() => {
      setShowSwipeHint(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [reading, isListView]);

  useEffect(() => {
    if (!isCompactScreen && mobileLayoutMode === 'list') {
      setMobileLayoutMode('carousel');
    }
  }, [isCompactScreen, mobileLayoutMode]);

  const enableCarousel = reading?.length > 1 && !isListView;

  // Hide hint when user scrolls
  const hideHintOnInteraction = useCallback(() => {
    setShowSwipeHint(false);
  }, []);

  if (!reading) return null;

  const spreadInfo = getSpreadInfo(selectedSpread);
  const isBatchReveal = reading.length > 1 && revealedCards.size === reading.length;

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

    // Initial calculation
    updateActiveIndex();

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enableCarousel, reading?.length, updateActiveIndex, hideHintOnInteraction]);

  const scrollToIndex = useCallback((index) => {
    if (!enableCarousel) return;
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
  }, [enableCarousel, reading.length, prefersReducedMotion]);

  const handleLayoutToggle = useCallback((mode) => {
    setMobileLayoutMode(mode);
    if (mode === 'list') {
      setShowSwipeHint(false);
    } else if (reading?.length > 1) {
      setShowSwipeHint(true);
    }
  }, [reading?.length]);

  // Memoize tooltip content generator
  const getTooltipContent = useCallback((card, position, isRevealed) => {
    if (!isRevealed) return null;
    return (
      <div className="space-y-1 text-left leading-snug">
        <strong className="block text-accent text-sm">
          {card.name}
          {card.isReversed ? ' (Reversed)' : ''}
        </strong>
        <em className="block text-xs-plus text-muted">{position}</em>
        <p className="text-xs-plus text-main/90">{getOrientationMeaning(card)}</p>
      </div>
    );
  }, []);

  return (
    <>
      {enableCarousel && showSwipeHint && (
        <p className="sm:hidden text-center text-xs text-primary/70 mb-2 animate-pulse">
          Swipe to explore cards &rarr;
        </p>
      )}
      <div
        className={
          selectedSpread === 'celtic'
            ? 'cc-grid animate-fade-in'
            : `animate-fade-in ${reading.length === 1
              ? 'grid grid-cols-1 max-w-md mx-auto'
              : `${isListView ? 'flex flex-col gap-4 pb-4' : `flex overflow-x-auto snap-x snap-mandatory ${isLandscape ? 'gap-2 pb-4' : 'gap-4 pb-6'}`} sm:grid sm:gap-8 sm:overflow-visible sm:snap-none sm:pb-0 ${reading.length <= 4
                ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
                : 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3'}`
            }`
        }
        ref={enableCarousel ? carouselRef : null}
      >
        {reading.map((card, index) => {
          const position = spreadInfo?.positions?.[index] || `Position ${index + 1}`;
          const isRevealed = revealedCards.has(index);
          const tooltipContent = getTooltipContent(card, position, isRevealed);

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
              staggerDelay={isBatchReveal ? index * 0.15 : 0}
            />
          );

          return (
            <div
              key={`${card.name}-${index}`}
              className={`${selectedSpread === 'celtic'
                ? getAreaClass(index, selectedSpread)
                : reading.length > 1 ? (isListView ? 'w-full sm:min-w-0' : `${landscapeCardWidth} snap-center sm:min-w-0`) : ''
                }`}
            >
              <Tooltip
                content={tooltipContent}
                position="top"
                asChild
                enableClick={false}
                triggerClassName="block h-full"
              >
                {cardElement}
              </Tooltip>
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
                  className={`inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface ${isLandscape ? 'px-2 py-1.5 min-w-[40px] min-h-[36px]' : 'px-3 py-2 min-w-[48px] min-h-[44px]'} text-xs font-semibold text-muted disabled:opacity-40 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
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
                  className={`inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface ${isLandscape ? 'px-2 py-1.5 min-w-[40px] min-h-[36px]' : 'px-3 py-2 min-w-[48px] min-h-[44px]'} text-xs font-semibold text-muted disabled:opacity-40 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
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
