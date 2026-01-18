/**
 * CardsDrawnSection.jsx
 * Displays the cards drawn in the reading with suit icons and orientation badges.
 */
import { memo, useState } from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { CardSymbolInsights } from '../../../CardSymbolInsights';
import { JournalPlusCircleIcon } from '../../../JournalIcons';
import { CupsIcon, WandsIcon, SwordsIcon, PentaclesIcon, MajorIcon } from '../../../illustrations/SuitIcons';
import { buildCardInsightPayload, REVERSED_PATTERN } from '../../../../lib/journalInsights';
import { styles, getSuitAccentVar, cn } from '../EntryCard.primitives';

function getSuitIcon(cardName) {
  if (!cardName) return MajorIcon;
  const lower = cardName.toLowerCase();
  if (lower.includes('cups') || lower.includes('chalices')) return CupsIcon;
  if (lower.includes('wands') || lower.includes('staves') || lower.includes('rods')) return WandsIcon;
  if (lower.includes('swords') || lower.includes('blades')) return SwordsIcon;
  if (lower.includes('pentacles') || lower.includes('coins') || lower.includes('disks')) return PentaclesIcon;
  return MajorIcon;
}

function renderSuitIcon(cardName, suitColor) {
  const IconComponent = getSuitIcon(cardName);
  return (
    <IconComponent
      className="w-3.5 h-3.5 shrink-0"
      style={{ color: suitColor }}
      aria-hidden="true"
    />
  );
}

const JournalCardListItem = memo(function JournalCardListItem({ card }) {
  const insightCard = buildCardInsightPayload(card);
  const isReversed = REVERSED_PATTERN.test(card?.orientation || '');
  const suitColor = getSuitAccentVar(card?.name) || 'var(--brand-primary)';

  return (
    <li className="group relative flex flex-col gap-3 rounded-2xl border border-[color:rgba(255,255,255,0.1)] bg-[color:rgba(10,11,18,0.6)] p-3 transition-colors hover:bg-[color:rgba(255,255,255,0.05)] shadow-[0_18px_38px_-28px_rgba(0,0,0,0.8)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Position indicator bar */}
        <div
          className="flex-shrink-0 w-1 self-stretch rounded-full hidden sm:block opacity-70"
          aria-hidden="true"
          style={{ backgroundColor: suitColor }}
        />

        <div className="flex-1 min-w-0">
          {/* Position label */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--text-muted)] leading-tight">
            {card.position}
          </span>
          {/* Card name + orientation */}
          <div className="flex items-center gap-2 mt-0.5">
            {renderSuitIcon(card.name, suitColor)}
            <p className="text-sm font-medium text-[color:var(--text-main)] truncate">
              {card.name}
            </p>
            {isReversed ? (
              <span className={styles.reversedBadge}>Rev</span>
            ) : (
              <span className={styles.uprightBadge}>Up</span>
            )}
          </div>
        </div>
      </div>

      {/* Symbol insights - visible on mobile, hover-reveal on desktop */}
      {insightCard && (
        <div className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 shrink-0">
          <CardSymbolInsights card={insightCard} position={card.position} />
        </div>
      )}
    </li>
  );
});

export const CardsDrawnSection = memo(function CardsDrawnSection({
  cards,
  cardsId,
  isSmallScreen,
  hasQuestion = false
}) {
  const [showCards, setShowCards] = useState(false);

  if (cards.length === 0) {
    return (
      <section className={cn(styles.section, hasQuestion && 'mt-4')}>
        <header className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>Cards drawn</div>
          <span className="text-[12px] text-[color:var(--text-muted)]">0</span>
        </header>
        <div className={styles.sectionBody}>
          <p className="text-sm text-[color:var(--text-muted)]">No cards recorded for this entry.</p>
        </div>
      </section>
    );
  }

  // Mobile: collapsible cards section
  if (isSmallScreen) {
    return (
      <section className={cn(styles.section, hasQuestion && 'mt-4')}>
        <button
          type="button"
          onClick={() => setShowCards((prev) => !prev)}
          aria-expanded={showCards}
          aria-controls={cardsId}
          className={styles.sectionHeaderClickable}
        >
          <div className="flex items-center gap-3">
            <div className={styles.sectionLabel}>View cards</div>
            <span className="text-[12px] text-[color:var(--text-muted)]">({cards.length})</span>
          </div>
          <div className="text-[color:var(--text-muted)]">
            {showCards ? (
              <CaretUp className="h-5 w-5" aria-hidden="true" />
            ) : (
              <CaretDown className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
        </button>

        {/* Card preview chips when collapsed */}
        {!showCards && (
          <div className={styles.sectionBody}>
            <div className="flex flex-wrap gap-2">
              {cards.slice(0, 2).map((card, idx) => {
                const name = (card.name || '').replace(/^The\s+/i, '').replace(/\s+of\s+/i, ' ');
                return (
                  <span
                    key={`${card.name || 'card'}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(255,255,255,0.12)] bg-[color:rgba(10,11,18,0.65)] px-2.5 py-1 text-[12px] font-medium text-[color:var(--text-main)]"
                  >
                    <JournalPlusCircleIcon className="h-3 w-3 text-[color:var(--text-muted)]" aria-hidden="true" />
                    {name || 'Card'}
                  </span>
                );
              })}
              {cards.length > 2 && (
                <span className="text-xs text-[color:var(--text-muted)]">+{cards.length - 2} more</span>
              )}
            </div>
          </div>
        )}

        {/* Full cards list when expanded */}
        <div
          id={cardsId}
          className={cn(styles.sectionBody, showCards ? 'block pt-0' : 'hidden')}
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {cards.map((card, idx) => (
              <JournalCardListItem key={idx} card={card} />
            ))}
          </ul>
        </div>
      </section>
    );
  }

  // Desktop: always show cards
  return (
    <section className={cn(styles.section, hasQuestion && 'mt-4')}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionLabel}>Cards drawn</div>
        <span className="text-[12px] text-[color:var(--text-muted)]">{cards.length}</span>
      </header>

      <div id={cardsId} className={styles.sectionBody}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {cards.map((card, idx) => (
            <JournalCardListItem key={idx} card={card} />
          ))}
        </ul>
      </div>
    </section>
  );
});
