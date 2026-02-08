/**
 * CardsDrawnSection.jsx
 * Displays the cards drawn in the reading as a compact stack with an expanded arc/fan view.
 */
import { memo, useMemo } from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import {
  useSmallScreen,
  COMPACT_SCREEN_MAX
} from '../../../../../hooks/useSmallScreen';
import { useReducedMotion } from '../../../../../hooks/useReducedMotion';
import { styles, cn } from '../../EntryCard.primitives';
import { CardStack } from './CardStack';
import { CardFan } from './CardFan';
import { useCardFan } from './useCardFan';

export const CardsDrawnSection = memo(function CardsDrawnSection({
  cards = [],
  cardsId,
  isSmallScreen,
  hasQuestion = false,
  collapsible = true,
  defaultExpanded = false
}) {
  const reduceMotion = useReducedMotion();
  const isNarrow = useSmallScreen(COMPACT_SCREEN_MAX);
  const isCollapsible = collapsible && isSmallScreen;
  const cardItems = useMemo(() => cards, [cards]);
  const cardFan = useCardFan({
    cards: cardItems,
    isCollapsible,
    reduceMotion,
    defaultExpanded
  });

  if (!cardItems || cardItems.length === 0) {
    return (
      <section className={cn(styles.section, hasQuestion && 'mt-4')} role="group" aria-label="Cards drawn in this reading">
        <header className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Cards drawn</div>
          <span className="text-xs text-muted">0</span>
        </header>
        <div className={styles.sectionBody}>
          <p className="text-sm text-[color:var(--text-muted)]">No cards recorded for this entry.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(styles.section, hasQuestion && 'mt-4')} role="group" aria-label="Cards drawn in this reading">
      {isCollapsible ? (
        <button
          type="button"
          onClick={cardFan.handleToggle}
          aria-expanded={cardFan.showExpanded}
          aria-controls={cardsId}
          className={styles.sectionHeaderClickable}
        >
          <div className="flex items-center gap-3">
            <div className={styles.sectionLabel}>Cards drawn</div>
            <span className="text-xs text-muted">({cardItems.length})</span>
          </div>
          <div className="text-[color:var(--text-muted)]">
            {cardFan.showExpanded ? (
              <CaretUp className="h-5 w-5" aria-hidden="true" />
            ) : (
              <CaretDown className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
        </button>
      ) : (
        <header className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Cards drawn</div>
          <span className="text-xs text-muted">{cardItems.length}</span>
        </header>
      )}

      {cardFan.showExpanded ? (
        <div
          key="cards-expanded"
          className={styles.sectionBody}
          style={{ transition: reduceMotion ? 'none' : 'opacity 200ms ease-out' }}
        >
          <CardFan
            cards={cardItems}
            cardsId={cardsId}
            activeIndex={cardFan.activeIndex}
            onCardKeyDown={cardFan.handleCardKeyDown}
            onCardSelect={cardFan.handleCardSelect}
            setCardRef={cardFan.setCardRef}
            fanRef={cardFan.stripRef}
            reduceMotion={reduceMotion}
          />
        </div>
      ) : (
        <div
          key="cards-collapsed"
          style={{ transition: reduceMotion ? 'none' : 'opacity 180ms ease-out' }}
        >
          <CardStack
            cards={cardItems}
            cardsId={cardsId}
            onExpand={cardFan.handleExpand}
            showHint={cardFan.showHint}
            onDismissHint={cardFan.dismissHint}
            stackButtonRef={cardFan.stackButtonRef}
            isExpanded={cardFan.showExpanded}
            isNarrow={isNarrow}
          />
        </div>
      )}
    </section>
  );
});
