import { memo, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../EntryCard.primitives';
import { META_LABEL_CLASS } from '../../../../../styles/labelClasses';
import { CardThumbnail } from './CardThumbnail';
import { computeFanLayout, FAN_ACTIVE_LIFT } from './fanGeometry';
import {
  EAGER_LOAD_COUNT,
  getCardAriaLabel,
  getOrientationState,
  getShortPosition
} from './useCardFan';

const FAN_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function cardName(card) {
  return card?.displayName || card?.name || 'Unknown card';
}

/**
 * The drawn cards as a fan. Columns of position and name sit under the cards
 * when the section is wide enough; otherwise the cards overlap and the
 * selected one is raised and named in a caption. Names are never truncated.
 */
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
  const emRef = useRef(null);
  const [frame, setFrame] = useState({ width: 0, rootFontPx: 16 });

  // Layout follows the section width and the reader's text size.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const measure = () => {
      const width = container.clientWidth;
      const rootFontPx = emRef.current?.getBoundingClientRect().width || 16;
      setFrame((previous) => (
        previous.width === width && previous.rootFontPx === rootFontPx ? previous : { width, rootFontPx }
      ));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (emRef.current) observer.observe(emRef.current);
    return () => observer.disconnect();
  }, []);

  const layout = computeFanLayout({ count: cards.length, width: frame.width, rootFontPx: frame.rootFontPx });
  const captioned = layout.mode === 'caption';
  const selected = cards[activeIndex] || cards[0];
  const selectedIsReversed = getOrientationState(selected).isReversed;
  const motion = reduceMotion ? 'none' : `transform 320ms ${FAN_EASE}`;

  return (
    <div className="pt-1 pb-1">
      <div ref={containerRef} className="relative w-full" style={{ height: layout.height }}>
        <span
          ref={emRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 h-px w-[1rem]"
        />
        <div id={cardsId} ref={fanRef} className="absolute inset-0">
          {cards.map((card, index) => {
            const spot = layout.cards[index];
            const { isReversed, label } = getOrientationState(card);
            const isActive = captioned && index === activeIndex;
            const lift = spot.lift + (isActive ? FAN_ACTIVE_LIFT : 0);
            return (
              <div
                key={`${card?.name || 'card'}-${index}`}
                className="absolute left-1/2 hover:z-50! focus-within:z-50!"
                style={{
                  bottom: layout.baseline,
                  zIndex: isActive ? spot.zIndex + 20 : spot.zIndex,
                  transformOrigin: 'center bottom',
                  transform: `translateX(calc(${spot.x}px - 50%)) translateY(${-lift}px) rotate(${spot.rotation}deg)`,
                  transition: motion
                }}
              >
                <button
                  ref={setCardRef(index)}
                  type="button"
                  aria-label={getCardAriaLabel(card, label)}
                  aria-current={isActive ? 'true' : undefined}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onKeyDown={(event) => onCardKeyDown(event, index)}
                  onClick={() => onCardSelect(index)}
                  className="block rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) focus-visible:ring-offset-2 focus-visible:ring-offset-(--panel-dark-1)"
                >
                  <CardThumbnail
                    card={card}
                    size={{ width: layout.cardWidth, height: layout.cardHeight }}
                    isReversed={isReversed}
                    active={isActive}
                    loading={index < EAGER_LOAD_COUNT ? 'eager' : 'lazy'}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* The cards' own labels already carry this text for assistive technology. */}
      {captioned ? (
        <p aria-hidden="true" className="mx-auto max-w-prose px-2 text-center text-sm leading-snug wrap-break-word">
          <span className={cn(META_LABEL_CLASS, 'text-(--text-muted)')}>{getShortPosition(selected?.position)}</span>
          <span className="text-(--text-muted)"> · </span>
          <span className="font-medium text-(--text-main)">{cardName(selected)}</span>
          {selectedIsReversed && <span className="text-(--text-muted)"> · Reversed</span>}
        </p>
      ) : (
        <div
          aria-hidden="true"
          className="grid justify-center"
          style={{ gridTemplateColumns: `repeat(${cards.length}, ${layout.column}px)` }}
        >
          {cards.map((card, index) => (
            <div key={`${card?.name || 'card'}-label-${index}`} className="min-w-0 px-1 text-center">
              <p className={cn(META_LABEL_CLASS, 'text-(--text-muted) wrap-anywhere')}>
                {getShortPosition(card?.position)}
              </p>
              <p className="mt-0.5 text-xs font-medium leading-snug text-(--text-main) wrap-break-word">
                {cardName(card)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
