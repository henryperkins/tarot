import { memo } from 'react';
import { CardThumbnail } from './CardThumbnail';
import {
  COLLAPSED_THUMB_SIZE,
  getCardStackOffset,
  getOrientationState,
  STACK_OFFSET_X,
  STACK_OFFSET_Y
} from './useCardFan';
import { styles, getSuitAccentVar } from '../../EntryCard.primitives';

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
        className="relative flex w-full min-h-[100px] items-center justify-center rounded-2xl border border-[color:var(--border-warm-light)] bg-[color:var(--panel-dark-1)] py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
      >
        <div
          className="relative"
          style={{ width: stackWidth, height: stackHeight }}
          aria-hidden="true"
        >
          {stackCards.map((card, index) => {
            const { isReversed } = getOrientationState(card);
            const suitColor = getSuitAccentVar(card?.name) || 'var(--brand-primary)';
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
                  suitColor={suitColor}
                  isReversed={isReversed}
                  showLabels={false}
                  loading="eager"
                  className="shadow-[0_18px_38px_-28px_rgba(0,0,0,0.8)]"
                />
              </div>
            );
          })}
        </div>

        <span className="absolute bottom-2 right-2 rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--panel-dark-2)] px-2 py-1 text-2xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
          {cards.length} card{cards.length === 1 ? '' : 's'}
        </span>

        {showHint && (
          <span className="absolute bottom-2 left-3 text-2xs uppercase tracking-[0.25em] text-[color:var(--text-muted)]">
            Tap to view
          </span>
        )}
      </button>
    </div>
  );
});
