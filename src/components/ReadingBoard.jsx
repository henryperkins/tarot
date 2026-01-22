import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { X, CaretLeft, CaretRight, MapTrifold } from '@phosphor-icons/react';
import { getSpreadInfo } from '../data/spreads';
import { getCardImage, getOrientationMeaning } from '../lib/cardLookup';
import { getDrawerGradient } from '../lib/suitColors';
import { useModalA11y } from '../hooks/useModalA11y';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { SpreadTable } from './SpreadTable';
import { getNextUnrevealedIndex, getPositionLabel } from './readingBoardUtils';

// Celtic Cross position short labels for map overlay
const CELTIC_POSITION_LABELS = [
  'Present',
  'Challenge',
  'Past',
  'Future',
  'Conscious',
  'Subconscious',
  'Advice',
  'External',
  'Hopes/Fears',
  'Outcome'
];

// Celtic Cross map overlay positions (percentage-based for responsive layout)
const CELTIC_MAP_POSITIONS = [
  { x: 35, y: 50 },        // 1: Present (center)
  { x: 35, y: 50, rotated: true }, // 2: Challenge (crossing)
  { x: 15, y: 50 },        // 3: Past
  { x: 55, y: 50 },        // 4: Future
  { x: 35, y: 20 },        // 5: Conscious
  { x: 35, y: 80 },        // 6: Subconscious
  { x: 80, y: 80 },        // 7: Advice
  { x: 80, y: 60 },        // 8: External
  { x: 80, y: 40 },        // 9: Hopes/Fears
  { x: 80, y: 20 }         // 10: Outcome
];

function CardDetailContent({
  focusedCardData,
  reflections,
  setReflections,
  onOpenModal,
  showHeading = true,
  layout = 'panel',
  headingId
}) {
  const [isMeaningExpanded, setIsMeaningExpanded] = useState(false);

  if (!focusedCardData) return null;

  const { card, position, index } = focusedCardData;
  const meaning = getOrientationMeaning(card);
  const cardImage = getCardImage(card);
  const reflectionValue = reflections?.[index] ?? '';
  const charCount = reflectionValue.length;
  const charCountClass = charCount > 480 ? 'text-error' : charCount > 450 ? 'text-warning' : 'text-accent/70';
  const isFocusLayout = layout === 'focus';
  const containerClass = isFocusLayout ? 'space-y-6' : 'space-y-4';
  const headerClass = isFocusLayout ? 'flex flex-col items-center text-center gap-4' : 'flex flex-col sm:flex-row gap-4';
  const imageWrapClass = isFocusLayout
    ? 'w-36 xs:w-40 sm:w-44 max-w-[70%] flex-shrink-0 mx-auto'
    : 'w-24 sm:w-28 flex-shrink-0 mx-auto sm:mx-0';
  const headingWrapClass = isFocusLayout ? 'flex-1 min-w-0 text-center' : 'flex-1 min-w-0';
  const positionClass = isFocusLayout ? 'text-[0.7rem] uppercase tracking-[0.2em] text-muted' : 'text-xs text-muted';
  const headingClass = isFocusLayout ? 'text-xl font-serif text-accent' : 'text-base font-semibold text-accent';
  const meaningClass = isFocusLayout ? 'text-base text-main/90 leading-relaxed mt-3' : 'text-sm text-main/90 mt-2';
  const meaningClampClass = isMeaningExpanded ? '' : isFocusLayout ? 'line-clamp-6' : 'line-clamp-4';
  const imageFrameClass = isFocusLayout
    ? 'aspect-[2/3] rounded-xl border border-primary/30 overflow-hidden shadow-xl'
    : 'aspect-[2/3] rounded-lg border border-primary/30 overflow-hidden';
  const expandButtonClass = isFocusLayout
    ? 'text-xs font-semibold text-accent hover:text-main underline underline-offset-4 mt-2'
    : 'text-xs font-semibold text-accent hover:text-main underline underline-offset-4 mt-1';
  const openButtonClass = isFocusLayout
    ? 'mt-4 inline-flex w-full min-h-[48px] items-center justify-center rounded-full border border-secondary/40 px-4 py-2 text-xs font-semibold text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50'
    : 'mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-secondary/40 px-4 py-2 text-xs font-semibold text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50';
  const reflectionLabelClass = isFocusLayout ? 'text-muted text-sm block mb-1' : 'text-muted text-xs-plus sm:text-sm block mb-1';

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <div className={imageWrapClass}>
          <div className={`${imageFrameClass} ${card.isReversed ? 'rotate-180' : ''}`}>
            <img
              src={cardImage}
              alt={card.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
        <div className={headingWrapClass}>
          {showHeading && (
            <>
              {isFocusLayout ? (
                <>
                  <p className={positionClass}>Selected card</p>
                  <p className="text-xs text-muted">{position}</p>
                </>
              ) : (
                <p className={positionClass}>{position}</p>
              )}
              <h4 id={headingId} className={headingClass}>
                {card.name} {card.isReversed ? '(Reversed)' : ''}
              </h4>
            </>
          )}
          <p className={`${meaningClass} ${meaningClampClass}`}>{meaning}</p>
          {!isMeaningExpanded && meaning && meaning.length > 140 && (
            <button
              type="button"
              onClick={() => setIsMeaningExpanded(true)}
              className={expandButtonClass}
            >
              Expand meaning
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenModal?.(focusedCardData)}
            className={openButtonClass}
          >
            Open full card
          </button>
        </div>
      </div>
      <div>
        <label htmlFor={`reflection-panel-${index}`} className={reflectionLabelClass}>
          What resonates for you?
        </label>
        <textarea
          id={`reflection-panel-${index}`}
          value={reflectionValue}
          onChange={event => {
            if (!setReflections) return;
            setReflections(prev => ({ ...prev, [index]: event.target.value }));
          }}
          rows={isFocusLayout ? 4 : 3}
          maxLength={500}
          className="w-full bg-surface/85 border border-secondary/40 rounded p-2 min-h-[3.5rem] resize-y text-main text-base leading-relaxed focus:outline-none focus:ring-1 focus:ring-secondary/55"
          placeholder="What resonates? (optional)"
          aria-describedby={`reflection-panel-count-${index}`}
        />
        <div
          id={`reflection-panel-count-${index}`}
          className={`mt-1 text-xs text-right ${charCountClass}`}
          aria-live="polite"
        >
          {charCount} / 500
        </div>
      </div>
    </div>
  );
}

function CardDetailPanel({
  focusedCardData,
  hasSelection,
  reflections,
  setReflections,
  onOpenModal
}) {
  // Shared panel styles matching theme swatch mystic drawer gradient
  const panelStyle = {
    background: getDrawerGradient(),
    borderColor: 'var(--border-warm)',
    boxShadow: '0 24px 64px -40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
  };

  if (!hasSelection) {
    return (
      <div
        className="rounded-2xl border p-4 text-center text-sm text-muted relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-surface-muted))',
          borderColor: 'var(--border-warm-light)'
        }}
      >
        Select a revealed card to see details here.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden relative"
      style={panelStyle}
    >
      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E")`,
          mixBlendMode: 'soft-light',
          opacity: 0.28
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 p-4 sm:p-5">
        <CardDetailContent
          focusedCardData={focusedCardData}
          reflections={reflections}
          setReflections={setReflections}
          onOpenModal={onOpenModal}
        />
      </div>
    </div>
  );
}

function CardFocusOverlay({
  isOpen,
  onClose,
  focusedCardData,
  reflections,
  setReflections,
  onOpenModal,
  // Navigation props
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
  positionLabel
}) {
  const prefersReducedMotion = useReducedMotion();
  const overlayRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = `card-focus-title-${focusedCardData?.index ?? 'unknown'}`;

  // Swipe gesture tracking
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const touchStartTime = useRef(null);

  useModalA11y(isOpen, {
    onClose,
    containerRef: overlayRef,
    initialFocusRef: closeButtonRef,
    scrollLockStrategy: 'fixed'
  });

  const handleTouchStart = useCallback((event) => {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((event) => {
    if (touchStartX.current === null || touchStartY.current === null || touchStartTime.current === null) return;

    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;

    // Reset refs
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTime.current = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const hasHorizontalIntent = absX > absY * 1.5 && absY < 32;

    // Check if swipe is valid: dominant horizontal, short duration
    if (hasHorizontalIntent && absX > 50 && elapsed < 300) {
      if (deltaX > 0 && canNavigatePrev) {
        onNavigate?.('prev');
      } else if (deltaX < 0 && canNavigateNext) {
        onNavigate?.('next');
      }
    }
  }, [canNavigatePrev, canNavigateNext, onNavigate]);

  if (!isOpen || !focusedCardData) return null;

  const hasNavigation = canNavigatePrev || canNavigateNext;

  return (
    <div
      className={`fixed inset-0 z-[85] ${prefersReducedMotion ? '' : 'animate-fade-in'}`}
      style={{ background: getDrawerGradient() }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.22'/%3E%3C/svg%3E")`,
          mixBlendMode: 'soft-light',
          opacity: 0.28
        }}
        aria-hidden="true"
      />
      <div
        ref={overlayRef}
        className="relative z-10 flex h-full flex-col focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        tabIndex={-1}
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))'
        }}
      >
        <div className="sticky top-0 z-20 border-b border-secondary/20 bg-main/70 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 min-h-[44px] rounded-full border border-secondary/30 bg-surface/40 px-3 text-xs font-semibold text-muted hover:text-main hover:border-secondary/50 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
              aria-label="Back to spread"
            >
              <X className="w-4 h-4" />
              <span>Back to spread</span>
            </button>
          </div>
          {hasNavigation && (
            <div className="flex items-center justify-between px-4 pb-2">
              <button
                type="button"
                onClick={() => onNavigate?.('prev')}
                disabled={!canNavigatePrev}
                className="flex items-center gap-1 text-xs text-muted hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition touch-manipulation min-h-[44px] px-2"
                aria-label="Previous card"
              >
                <CaretLeft className="w-5 h-5" />
                <span className="sr-only xs:not-sr-only">Prev</span>
              </button>
              <span className="text-xs text-muted font-medium">{positionLabel}</span>
              <button
                type="button"
                onClick={() => onNavigate?.('next')}
                disabled={!canNavigateNext}
                className="flex items-center gap-1 text-xs text-muted hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition touch-manipulation min-h-[44px] px-2"
                aria-label="Next card"
              >
                <span className="sr-only xs:not-sr-only">Next</span>
                <CaretRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-5">
          <CardDetailContent
            focusedCardData={focusedCardData}
            reflections={reflections}
            setReflections={setReflections}
            onOpenModal={onOpenModal}
            layout="focus"
            headingId={titleId}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Celtic Cross map overlay - shows numbered position layout
 * Helps users understand the complex Celtic Cross layout on mobile
 */
function CelticCrossMapOverlay({ onClose }) {
  return (
    <div
      className="absolute inset-0 z-20 rounded-2xl sm:rounded-3xl overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Celtic Cross position map"
    >
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-main/90 backdrop-blur-sm" />

      {/* Position markers */}
      <div className="relative w-full h-full">
        {CELTIC_MAP_POSITIONS.map((pos, i) => (
          <div
            key={`map-pos-${i}`}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              // Offset Challenge card slightly to show it's crossing
              marginLeft: pos.rotated ? '8px' : 0
            }}
          >
            <span
              className={`w-7 h-7 rounded-full bg-primary/90 text-surface font-bold text-sm flex items-center justify-center shadow-lg ${
                pos.rotated ? 'ring-2 ring-accent/60' : ''
              }`}
            >
              {i + 1}
            </span>
            <span className="text-[0.6rem] text-main font-medium bg-surface/80 px-1.5 py-0.5 rounded whitespace-nowrap">
              {CELTIC_POSITION_LABELS[i]}
            </span>
          </div>
        ))}
      </div>

      {/* Tap to close instruction */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <span className="text-xs text-muted bg-surface/60 px-3 py-1.5 rounded-full">
          Tap anywhere to close
        </span>
      </div>
    </div>
  );
}


export function ReadingBoard({
  spreadKey,
  reading,
  revealedCards,
  revealCard,
  onCardClick,
  focusedCardData,
  onCloseDetail,
  recentlyClosedIndex = -1,
  reflections,
  setReflections,
  onOpenModal,
  // Navigation props for CardFocusOverlay
  onNavigateCard,
  canNavigatePrev,
  canNavigateNext,
  navigationLabel,
  revealStage = 'action'
}) {
  const isHandsetLayout = useHandsetLayout();
  const prefersReducedMotion = useReducedMotion();
  const spreadInfo = useMemo(() => getSpreadInfo(spreadKey), [spreadKey]);
  const nextIndex = getNextUnrevealedIndex(reading, revealedCards);
  const nextLabel = nextIndex >= 0 ? getPositionLabel(spreadInfo, nextIndex) : null;
  const allowBoardReveal = revealStage !== 'deck';
  const [flashNextSlot, setFlashNextSlot] = useState(false);
  const flashTimerRef = useRef(null);
  const prevRevealStageRef = useRef(revealStage);


  // Celtic Cross map overlay state
  const [showCelticMap, setShowCelticMap] = useState(false);
  const isCelticCross = spreadKey === 'celtic';
  const showMapToggle = isCelticCross && isHandsetLayout;

  // Handset: keep card sizes a bit smaller to reduce overlap (especially Celtic Cross).
  const tableSize = isHandsetLayout ? 'default' : 'large';
  const hasSelection = Boolean(
    focusedCardData &&
    revealedCards?.has(focusedCardData.index)
  );
  useEffect(() => {
    const prevStage = prevRevealStageRef.current;
    prevRevealStageRef.current = revealStage;
    if (prefersReducedMotion) return;
    if (prevStage !== 'deck' || revealStage !== 'spread') return;
    if (nextIndex < 0) return;
    queueMicrotask(() => {
      setFlashNextSlot(true);
    });
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => {
      setFlashNextSlot(false);
      flashTimerRef.current = null;
    }, 400);
  }, [revealStage, nextIndex, prefersReducedMotion]);

  useEffect(() => () => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
  }, []);
  if (!reading) return null;

  return (
    <div className="space-y-3">
      <div className="px-4 flex items-center justify-center gap-3">
        <p className="text-xs-plus text-muted" aria-live="polite">
          {allowBoardReveal
            ? `Tap positions to reveal. ${nextLabel ? `Next: ${nextLabel}.` : 'All cards revealed.'}`
            : `Draw from the deck to place your first card.${nextLabel ? ` Next: ${nextLabel}.` : ''}`}
          {isHandsetLayout && allowBoardReveal ? ' Tap a revealed card to focus.' : ''}
        </p>
        {showMapToggle && (
          <button
            type="button"
            onClick={() => setShowCelticMap(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface/60 border border-secondary/30 text-xs text-muted hover:text-main hover:border-secondary/50 transition touch-manipulation"
            aria-label="Show Celtic Cross position map"
          >
            <MapTrifold className="w-4 h-4" />
            <span>Map</span>
          </button>
        )}
      </div>
      <div className="max-w-5xl mx-auto px-3 xs:px-4 sm:px-0 relative">
        <SpreadTable
          spreadKey={spreadKey}
          cards={reading}
          revealedIndices={revealedCards}
          onCardClick={onCardClick}
          onCardReveal={revealCard}
          nextDealIndex={nextIndex}
          recentlyClosedIndex={recentlyClosedIndex}
          disableReveal={!allowBoardReveal}
          hideLegend={true}
          size={tableSize}
          flashNextSlot={flashNextSlot}
        />
        {/* Celtic Cross map overlay */}
        {showCelticMap && isCelticCross && (
          <CelticCrossMapOverlay onClose={() => setShowCelticMap(false)} />
        )}
      </div>
      {!isHandsetLayout && (
        <CardDetailPanel
          focusedCardData={focusedCardData}
          hasSelection={hasSelection}
          reflections={reflections}
          setReflections={setReflections}
          onOpenModal={onOpenModal}
        />
      )}
      {isHandsetLayout && (
        <CardFocusOverlay
          isOpen={hasSelection}
          onClose={onCloseDetail}
          focusedCardData={focusedCardData}
          reflections={reflections}
          setReflections={setReflections}
          onOpenModal={onOpenModal}
          onNavigate={onNavigateCard}
          canNavigatePrev={canNavigatePrev}
          canNavigateNext={canNavigateNext}
          positionLabel={navigationLabel}
        />
      )}
    </div>
  );
}
