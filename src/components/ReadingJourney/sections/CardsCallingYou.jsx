/**
 * CardsCallingYou - Top cards list with inline badges and suit icons.
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Fire, TrendUp, TrendDown, Minus, ArrowRight } from '@phosphor-icons/react';
import TrendSparkline from '../../charts/TrendSparkline';
import { getSuitIcon } from '../../illustrations/suitIconUtils';

// Suit color mapping for visual distinction
const SUIT_COLORS = {
  Cups: 'text-cups',
  Wands: 'text-wands',
  Swords: 'text-swords',
  Pentacles: 'text-pentacles',
  Major: 'text-accent',
};

function TrendIndicator({ trend }) {
  if (trend === 'up') {
    return <TrendUp className="h-3 w-3 text-success" aria-label="trending up" />;
  }
  if (trend === 'down') {
    return <TrendDown className="h-3 w-3 text-error" aria-label="trending down" />;
  }
  return <Minus className="h-3 w-3 text-muted opacity-60" aria-label="stable" />;
}

function CardsCallingYou({ cards = [], badges = [], isEmerging = false, sampleSize = 0 }) {
  if (!cards.length) {
    return (
      <p className="text-sm text-amber-100/60">
        Draw more cards to see which ones keep appearing.
      </p>
    );
  }

  const sampleLabel = sampleSize > 0 ? `${sampleSize} reading${sampleSize === 1 ? '' : 's'}` : '';
  const subtitle = isEmerging
    ? `Emerging patterns${sampleLabel ? ` from ${sampleLabel}` : ''}`
    : 'These cards keep appearing in your readings';

  return (
    <div>
      <p className="text-sm sm:text-xs text-amber-100/60 mb-3">
        {subtitle}
      </p>
      <ul className="space-y-2" aria-label="Your top most frequently appearing cards">
        {cards.slice(0, 5).map((card, index) => {
          const hasBadge = card.hasBadge || badges.some(b => b.card_name === card.name);
          const SuitIcon = getSuitIcon(card.name);
          const suitName = card.suit || (card.name?.includes(' of ') ? card.name.split(' of ')[1] : 'Major');
          const suitColor = SUIT_COLORS[suitName] || SUIT_COLORS.Major;

          return (
            <li
              key={`${card.name}-${index}`}
              className="flex items-center justify-between text-sm rounded-lg bg-amber-200/5 px-3 py-3 min-h-touch hover:bg-amber-200/10 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200/15 text-xs font-medium text-amber-100 flex-shrink-0"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {SuitIcon && (
                  <SuitIcon 
                    className={`h-4 w-4 flex-shrink-0 ${suitColor}`}
                    aria-label={`${suitName} suit`}
                  />
                )}
                <span className="text-amber-100/85 truncate">
                  <span className="sr-only">Rank {index + 1}: </span>
                  {card.name}
                </span>
                {hasBadge && (
                  <Fire
                    className="h-3.5 w-3.5 text-orange-400 flex-shrink-0"
                    aria-label="streak badge earned"
                  />
                )}
              </div>

              {card.trendData && (
                <div className="mx-2 hidden sm:block">
                  <TrendSparkline data={card.trendData} height={24} color="var(--brand-primary)" />
                </div>
              )}

              <div className="flex items-center gap-2 flex-shrink-0">
                {card.trend && card.trend !== 'stable' && (
                  <TrendIndicator trend={card.trend} />
                )}
                <span
                  className="text-amber-200/70 tabular-nums"
                  aria-label={`appeared ${card.count} times`}
                >
                  {card.count}x
                </span>
                {card.reversedCount > 0 && (
                  <span
                    className="text-xs text-amber-100/50"
                    aria-label={`${card.reversedCount} reversed`}
                  >
                    ({card.reversedCount}↺)
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      
      <div className="mt-3 pt-2 border-t border-amber-200/10 flex items-center justify-between text-sm sm:text-xs">
        <span className="text-amber-100/50">
          {cards.length > 5 ? `+${cards.length - 5} more` : 'Explore deck'}
        </span>
        <Link 
          to="/journal/gallery" 
          className="flex items-center gap-1 min-h-touch py-2 px-2 -m-2 text-amber-200/70 hover:text-amber-100 transition-colors touch-manipulation"
          aria-label="View your card collection"
        >
          View Collection
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isEmerging && (
        <p className="mt-2 text-[10px] text-amber-100/50">
          Keep logging to confirm which cards stay in focus.
        </p>
      )}
    </div>
  );
}

export default memo(CardsCallingYou);
