import { memo } from 'react';
import { CardThumbnail } from './CardThumbnail';
import {
  COLLAPSED_THUMB_SIZE,
  getCardStackOffset,
  getOrientationState,
  STACK_OFFSET_X,
  STACK_OFFSET_Y
} from './useCardFan';
import { styles } from '../../EntryCard.primitives';
import { BADGE_LABEL_CLASS, META_LABEL_CLASS } from '../../../../../styles/labelClasses';

export const CardStack = memo(function CardStack({
  cards,
  cardsId,
  onExpand,
  showHint,
  onDismissHint,
  stackButtonRef,
  isExpanded,
  isNarrow
}) {
  const visibleCount = Math.min(cards.length, isNarrow ? 2 : 3);
  const stackCards = cards.slice(0, visibleCount);
  const stackWidth = COLLAPSED_THUMB_SIZE.width + STACK_OFFSET_X * 4;
  const stackHeight = COLLAPSED_THUMB_SIZE.height + STACK_OFFSET_Y * 2;

  return (
    <div className={styles.sectionBody}>
      <button
        type="button"
        onClick={() => {
          onDismissHint();
          onExpand();
        }}
        ref={stackButtonRef}
        aria-expanded={isExpanded}
        aria-controls={cardsId}
        className="flex w-full flex-col items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-(--border-warm-subtle) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus-ring-color) touch-manipulation"
      >
        <div
          className="relative shrink-0"
          style={{ width: stackWidth, height: stackHeight }}
          aria-hidden="true"
        >
          {stackCards.map((card, index) => {
            const { isReversed } = getOrientationState(card);
            const { x, y, rotation, zIndex } = getCardStackOffset(index, stackCards.length);

            return (
              <div
                key={`${card?.name || 'card'}-${index}`}
                className="absolute left-1/2 top-1/2"
                style={{
                  zIndex,
                  transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) translate(-50%, -50%)`
                }}
              >
                <CardThumbnail
                  card={card}
                  size={COLLAPSED_THUMB_SIZE}
                  isReversed={isReversed}
                  loading="eager"
                />
              </div>
            );
          })}
        </div>

        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className={`${BADGE_LABEL_CLASS} text-(--text-muted)`}>
            {cards.length} card{cards.length === 1 ? '' : 's'}
          </span>
          {showHint && (
            <span className={`${META_LABEL_CLASS} text-(--text-muted)`}>
              Tap to view
            </span>
          )}
        </span>
      </button>
    </div>
  );
});
