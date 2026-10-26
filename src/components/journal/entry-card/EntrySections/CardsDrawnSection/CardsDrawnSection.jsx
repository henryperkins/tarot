/**
 * CardsDrawnSection.jsx
 * Displays the cards drawn in the reading as a compact stack with an expanded arc/fan view.
 */
import { memo, useMemo } from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { JournalCardIcon } from '../../../../JournalIcons';
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

  // Spans, so the label is valid inside the collapsible header's button.
  const label = (
    <span className="flex min-w-0 items-center gap-2">
      <JournalCardIcon className={styles.sectionIcon} aria-hidden="true" />
      <span className={styles.sectionLabel}>Cards drawn</span>
    </span>
  );

  if (!cardItems || cardItems.length === 0) {
    return (
      <section className={cn(styles.section, 'mt-4')} role="group" aria-label="Cards drawn in this reading">
        <header className={styles.sectionHeader}>
          {label}
        </header>
        <div className={styles.sectionBody}>
          <p className="text-sm text-(--text-muted)">No cards recorded for this entry.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(styles.section, 'mt-4')} role="group" aria-label="Cards drawn in this reading">
      {isCollapsible ? (
        <button
          type="button"
          onClick={cardFan.handleToggle}
          aria-expanded={cardFan.showExpanded}
          aria-controls={cardsId}
          className={styles.sectionHeaderClickable}
        >
          {/* Collapsed, the stack below names the count; open, the header does. */}
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {label}
            {cardFan.showExpanded && <span className={styles.sectionCount}>{cardItems.length}</span>}
          </span>
          <span className="shrink-0 text-(--text-muted)">
            {cardFan.showExpanded ? (
              <CaretUp className="h-5 w-5" aria-hidden="true" />
            ) : (
              <CaretDown className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
        </button>
      ) : (
        <header className={styles.sectionHeader}>
          {label}
          <span className={styles.sectionCount}>{cardItems.length}</span>
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
