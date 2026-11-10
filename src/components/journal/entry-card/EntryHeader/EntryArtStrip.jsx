/**
 * EntryArtStrip.jsx
 * A collapsed entry's cards, as a small overlapping stack of the reading's own
 * art (its deck, its orientations: a reversed card is turned, too small for a
 * badge). Decorative: the toggle's description names the cards and their
 * orientation, so screen readers skip the stack.
 */
import { memo } from 'react';
import { REVERSED_PATTERN } from '../../../../lib/journalInsights';
import { CardThumbnail } from '../EntrySections/CardsDrawnSection/CardThumbnail';
import { FAN_CARD_ASPECT } from '../EntrySections/CardsDrawnSection/fanGeometry';
import { cn } from '../EntryCard.primitives';

const MAX_SHOWN = 3;
// Each card overlaps the previous one by this share of its width.
const OVERLAP = 0.55;

export const EntryArtStrip = memo(function EntryArtStrip({ cards, cardWidth = 32, className }) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const shown = cards.slice(0, MAX_SHOWN);
  const extra = cards.length - shown.length;
  const size = { width: cardWidth, height: Math.round(cardWidth * FAN_CARD_ASPECT) };
  const step = Math.round(cardWidth * (1 - OVERLAP));
  const stackWidth = cardWidth + step * (MAX_SHOWN - 1);

  return (
    <div
      aria-hidden="true"
      className={cn('relative shrink-0', className)}
      style={{ width: stackWidth, height: size.height }}
    >
      {shown.map((card, index) => (
        <div
          key={`${card?.canonicalName || card?.name || 'card'}-${index}`}
          className="absolute top-0"
          style={{ left: index * step }}
        >
          <CardThumbnail
            card={card}
            size={size}
            isReversed={REVERSED_PATTERN.test(card?.orientation || '') || Boolean(card?.isReversed)}
            showReversedBadge={false}
            tiny
          />
        </div>
      ))}
      {extra > 0 && (
        <span className="absolute -bottom-1.5 right-0 rounded-full border border-(--border-warm) bg-(--bg-surface) px-1.5 py-0.5 text-2xs font-semibold leading-none text-(--text-main) tabular-nums">
          +{extra}
        </span>
      )}
    </div>
  );
});
