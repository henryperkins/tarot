import { memo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { getSuitAccentVar, cn } from '../../EntryCard.primitives';
import { CardThumbnail } from './CardThumbnail';
import {
  EXPANDED_THUMB_SIZE,
  EAGER_LOAD_COUNT,
  getArcPosition,
  getCardStackOffset,
  getOrientationState,
  getCardAriaLabel
} from './useCardFan';

export const CardFan = memo(function CardFan({
  cards,
  cardsId,
  activeIndex,
  onCardKeyDown,
  onCardSelect,
  setCardRef,
  fanRef,
  reduceMotion
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.offsetWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const getStackMotion = useCallback((index) => {
    const stackCount = Math.min(cards.length, 5);
    const stackIndex = Math.min(index, stackCount - 1);
    return getCardStackOffset(stackIndex, stackCount);
  }, [cards.length]);

  const renderCard = (card, index) => {
    const { isReversed, label } = getOrientationState(card);
    const suitColor = getSuitAccentVar(card?.name) || 'var(--brand-primary)';
    const cardLabel = getCardAriaLabel(card, label);
    const tabIndex = cards.length === 1 ? 0 : (index === activeIndex ? 0 : -1);
    const isActive = index === activeIndex;
    const arcPos = getArcPosition(index, cards.length, containerWidth);
    const stackMotion = getStackMotion(index);
    const transformX = Number.isFinite(arcPos?.x) ? arcPos.x : stackMotion.x;
    const transformY = Number.isFinite(arcPos?.y) ? -arcPos.y : stackMotion.y;
    const rotation = Number.isFinite(arcPos?.rotation) ? arcPos.rotation : stackMotion.rotation;
    const scale = Number.isFinite(arcPos?.scale) ? arcPos.scale : 0.96;

    return (
      <div
        key={`${card?.name || 'card'}-${index}`}
        className="absolute left-1/2 bottom-0 hover:!z-50 focus-within:!z-50"
        style={{
          zIndex: isActive ? (arcPos.zIndex || 1) + 20 : (arcPos.zIndex || 1),
          transformOrigin: 'center bottom',
          transform: `translateX(${transformX}px) translateY(${transformY}px) rotate(${rotation}deg) scale(${scale})`,
          opacity: 1,
          transition: reduceMotion
            ? 'none'
            : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease-out'
        }}
      >
        <button
          ref={setCardRef(index)}
          type="button"
          aria-label={cardLabel}
          className={cn(
            'group rounded-lg transition-shadow duration-300 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]',
            'hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]',
            isActive && 'shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]'
          )}
          style={{ transform: 'translateX(-50%)' }}
          tabIndex={tabIndex}
          onKeyDown={(event) => onCardKeyDown(event, index)}
          onClick={() => onCardSelect(index)}
        >
          <CardThumbnail
            card={card}
            size={EXPANDED_THUMB_SIZE}
            suitColor={suitColor}
            isReversed={isReversed}
            loading={index < EAGER_LOAD_COUNT ? 'eager' : 'lazy'}
            showPosition={false}
            showPositionOverlay
            isActive={isActive}
            nameMaxWidth={64}
          />
        </button>
      </div>
    );
  };

  if (cards.length === 1) {
    const singleCard = cards[0];
    const { isReversed, label } = getOrientationState(singleCard);
    const suitColor = getSuitAccentVar(singleCard?.name) || 'var(--brand-primary)';
    const cardLabel = getCardAriaLabel(singleCard, label);

    return (
      <div
        className="pt-2 pb-4"
        style={{ transition: reduceMotion ? 'none' : 'opacity 220ms ease-out' }}
      >
        <div
          id={cardsId}
          ref={fanRef}
          className="flex justify-center"
          style={{
            opacity: 1,
            transform: 'translateY(0px)',
            transition: reduceMotion ? 'none' : 'opacity 220ms ease-out, transform 220ms ease-out'
          }}
        >
          <button
            ref={setCardRef(0)}
            type="button"
            aria-label={cardLabel}
            className={cn(
              'group rounded-lg transition-shadow duration-300 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]',
              'hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]'
            )}
            tabIndex={0}
            onKeyDown={(event) => onCardKeyDown(event, 0)}
            onClick={() => onCardSelect(0)}
          >
            <CardThumbnail
              card={singleCard}
              size={EXPANDED_THUMB_SIZE}
              suitColor={suitColor}
              isReversed={isReversed}
              loading="eager"
              showPosition={false}
              showPositionOverlay
              isActive={activeIndex === 0}
              nameMaxWidth={64}
            />
          </button>
        </div>
      </div>
    );
  }

  const arcRise = cards.length > 7 ? 32 : 24;
  const containerHeight = EXPANDED_THUMB_SIZE.height + arcRise + 10;

  return (
    <div
      className="pt-2 pb-4"
      style={{ transition: reduceMotion ? 'none' : 'opacity 220ms ease-out' }}
    >
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: containerHeight }}
      >
        <div id={cardsId} ref={fanRef} className="absolute inset-0">
          {cards.map((card, index) => renderCard(card, index))}
        </div>
      </div>
    </div>
  );
});

