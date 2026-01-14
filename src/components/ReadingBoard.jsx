import { useMemo, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { getSpreadInfo } from '../data/spreads';
import { getCardImage, getOrientationMeaning } from '../lib/cardLookup';
import { getDrawerGradient } from '../lib/suitColors';
import { useModalA11y } from '../hooks/useModalA11y';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { SpreadTable } from './SpreadTable';
import { getNextUnrevealedIndex, getPositionLabel } from './readingBoardUtils';

function CardDetailContent({ focusedCardData, reflections, setReflections, onOpenModal, showHeading = true }) {
  if (!focusedCardData) return null;

  const { card, position, index } = focusedCardData;
  const meaning = getOrientationMeaning(card);
  const cardImage = getCardImage(card);
  const reflectionValue = reflections?.[index] ?? '';
  const charCount = reflectionValue.length;
  const charCountClass = charCount > 480 ? 'text-error' : charCount > 450 ? 'text-warning' : 'text-accent/70';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-24 sm:w-28 flex-shrink-0 mx-auto sm:mx-0">
          <div className={`aspect-[2/3] rounded-lg border border-primary/30 overflow-hidden ${card.isReversed ? 'rotate-180' : ''}`}>
            <img
              src={cardImage}
              alt={card.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          {showHeading && (
            <>
              <p className="text-xs text-muted">{position}</p>
              <h4 className="text-base font-semibold text-accent">
                {card.name} {card.isReversed ? '(Reversed)' : ''}
              </h4>
            </>
          )}
          <p className="text-sm text-main/90 mt-2 line-clamp-4">{meaning}</p>
          <button
            type="button"
            onClick={() => onOpenModal?.(focusedCardData)}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-secondary/40 px-4 py-2 text-xs font-semibold text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
          >
            Open full card
          </button>
        </div>
      </div>
      <div>
        <label htmlFor={`reflection-panel-${index}`} className="text-muted text-xs-plus sm:text-sm block mb-1">
          What resonates for you?
        </label>
        <textarea
          id={`reflection-panel-${index}`}
          value={reflectionValue}
          onChange={event => {
            if (!setReflections) return;
            setReflections(prev => ({ ...prev, [index]: event.target.value }));
          }}
          rows={3}
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

function CardDetailSheet({
  isOpen,
  onClose,
  focusedCardData,
  reflections,
  setReflections,
  onOpenModal
}) {
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = `card-detail-sheet-title-${focusedCardData?.index ?? 'unknown'}`;

  useModalA11y(isOpen, {
    onClose,
    containerRef: sheetRef,
    initialFocusRef: closeButtonRef,
    scrollLockStrategy: 'simple'
  });

  if (!isOpen || !focusedCardData) return null;

  const { card, position } = focusedCardData;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))' }}
    >
      <div
        className="mobile-drawer-overlay absolute inset-0 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className="mobile-drawer relative w-full flex flex-col animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        style={{ maxHeight: 'calc(100% - 8px)' }}
      >
        <div className="mobile-drawer__handle" aria-hidden="true" />
        <div className="mobile-drawer__header px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted">Selected card</p>
              <p className="text-xs text-muted">{position}</p>
              <h2 id={titleId} className="text-lg font-serif text-accent">
                {card.name} {card.isReversed ? '(Reversed)' : ''}
              </h2>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="mobile-drawer__close"
              aria-label="Close card details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="mobile-drawer__body p-4 space-y-6 overflow-y-auto overscroll-contain">
          <CardDetailContent
            focusedCardData={focusedCardData}
            reflections={reflections}
            setReflections={setReflections}
            onOpenModal={onOpenModal}
            showHeading={false}
          />
        </div>
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
  onOpenModal
}) {
  const isHandsetLayout = useHandsetLayout();
  const spreadInfo = useMemo(() => getSpreadInfo(spreadKey), [spreadKey]);
  const nextIndex = getNextUnrevealedIndex(reading, revealedCards);
  const nextLabel = nextIndex >= 0 ? getPositionLabel(spreadInfo, nextIndex) : null;
  // Handset: keep card sizes a bit smaller to reduce overlap (especially Celtic Cross).
  const tableSize = isHandsetLayout ? 'default' : 'large';
  const hasSelection = Boolean(
    focusedCardData &&
    revealedCards?.has(focusedCardData.index)
  );
  if (!reading) return null;

  return (
    <div className="space-y-3">
      <p className="px-4 text-center text-xs-plus text-muted" aria-live="polite">
        Tap positions to reveal. {nextLabel ? `Next: ${nextLabel}.` : 'All cards revealed.'}
      </p>
      <div className="max-w-5xl mx-auto px-3 xs:px-4 sm:px-0">
        <SpreadTable
          spreadKey={spreadKey}
          cards={reading}
          revealedIndices={revealedCards}
          onCardClick={onCardClick}
          onCardReveal={revealCard}
          nextDealIndex={nextIndex}
          recentlyClosedIndex={recentlyClosedIndex}
          hideLegend={isHandsetLayout && spreadKey === 'celtic'}
          size={tableSize}
        />
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
        <CardDetailSheet
          isOpen={hasSelection}
          onClose={onCloseDetail}
          focusedCardData={focusedCardData}
          reflections={reflections}
          setReflections={setReflections}
          onOpenModal={onOpenModal}
        />
      )}
    </div>
  );
}
