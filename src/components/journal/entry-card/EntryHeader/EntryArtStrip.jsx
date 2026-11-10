/**
 * EntryArtStrip.jsx
 * A collapsed Comfortable entry's cards, rendered as a tactile dealt hand from
 * the reading's own deck (120px renditions; reversed cards are turned).
 * Decorative: the toggle's description names the cards and their orientation,
 * so screen readers skip the stack.
 */
import { memo } from 'react';
import { REVERSED_PATTERN } from '../../../../lib/journalInsights';
import { CardThumbnail } from '../EntrySections/CardsDrawnSection/CardThumbnail';
import { FAN_CARD_ASPECT } from '../EntrySections/CardsDrawnSection/fanGeometry';
import { cn } from '../EntryCard.primitives';

const MAX_SHOWN = 3;
// Each card overlaps the previous one by this share of its width so faces stay legible.
const OVERLAP = 0.42;

function cardAngle(index, count) {
  if (count === 3) return (index - 1) * 3;
  if (count === 2) return index === 0 ? -2 : 2;
  return 0;
}

export const EntryArtStrip = memo(function EntryArtStrip({
  cards,
  cardWidth = 44,
  fixedColumn = false,
  className
}) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const shown = cards.slice(0, MAX_SHOWN);
  const extra = cards.length - shown.length;
  const size = { width: cardWidth, height: Math.round(cardWidth * FAN_CARD_ASPECT) };
  const step = Math.round(cardWidth * (1 - OVERLAP));
  const actualWidth = cardWidth + step * (shown.length - 1);
  const fullColumnWidth = cardWidth + step * (MAX_SHOWN - 1);
  const containerWidth = fixedColumn ? fullColumnWidth : actualWidth;
  const offsetX = fixedColumn ? Math.round((containerWidth - actualWidth) / 2) : 0;
  // Reserve vertical clearance so slight card rotation never clips at the container edge.
  const padY = shown.length > 1 ? 3 : 0;

  return (
    <div
      aria-hidden="true"
      className={cn('relative shrink-0', className)}
      style={{ width: containerWidth, height: size.height + padY * 2 }}
    >
      {shown.map((card, index) => {
        const angle = cardAngle(index, shown.length);
        return (
          <div
            key={`${card?.canonicalName || card?.name || 'card'}-${index}`}
            className="absolute"
            style={{
              left: offsetX + index * step,
              top: padY,
              zIndex: index + 1,
              transform: angle ? `rotate(${angle}deg)` : undefined
            }}
          >
            <CardThumbnail
              card={card}
              size={size}
              isReversed={REVERSED_PATTERN.test(card?.orientation || '') || Boolean(card?.isReversed)}
              showReversedBadge={false}
              tiny
            />
          </div>
        );
      })}
      {extra > 0 && (
        <span className="absolute -bottom-1 right-0 z-10 rounded-full border border-(--border-warm) bg-(--bg-surface) px-1.5 py-0.5 text-2xs font-semibold leading-none text-(--text-main) tabular-nums">
          +{extra}
        </span>
      )}
    </div>
  );
});
