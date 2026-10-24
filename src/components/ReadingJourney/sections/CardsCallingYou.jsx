/**
 * CardsCallingYou - Top cards list with inline badges and suit icons.
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useSmallScreen } from '../../../hooks/useSmallScreen';
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

// role="img" makes the SVG's label part of the row for screen readers.
function TrendIndicator({ trend }) {
  if (trend === 'up') {
    return <TrendUp className="h-3 w-3 text-success" role="img" aria-label="Rising over recent months" />;
  }
  if (trend === 'down') {
    return <TrendDown className="h-3 w-3 text-error" role="img" aria-label="Falling over recent months" />;
  }
  return <Minus className="h-3 w-3 text-muted opacity-60" role="img" aria-label="Steady over recent months" />;
}

function CardsCallingYou({ cards = [], badges = [], isEmerging = false, sampleSize = 0 }) {
  // Sparklines appear from the `sm` breakpoint. Below it they are not mounted,
  // so phones never load or measure charts they would hide.
  const showSparklines = !useSmallScreen(639);
  if (!cards.length) {
    return (
      <p className="text-sm text-muted">
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
      <p className="text-sm sm:text-xs text-muted mb-3">
        {subtitle}
      </p>
      <ul className="space-y-2" aria-label="Your top most frequently appearing cards">
        {(showSparklines ? cards : cards.map(({ trendData: _trendData, ...card }) => card)).slice(0, 5).map((card, index) => {
          const hasBadge = card.hasBadge || badges.some(b => b.card_name === card.name);
          const SuitIcon = getSuitIcon(card.name);
          const suitName = card.suit || (card.name?.includes(' of ') ? card.name.split(' of ')[1] : 'Major');
          const suitColor = SUIT_COLORS[suitName] || SUIT_COLORS.Major;

          return (
            <li
              key={`${card.name}-${index}`}
              className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm rounded-lg bg-surface-muted/40 px-3 py-3 min-h-touch hover:bg-surface-muted/60 transition-colors"
            >
              <div className="flex flex-wrap min-w-0 flex-[1_1_12rem] items-center gap-x-2 gap-y-1">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-accent shrink-0"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {SuitIcon && (
                  <SuitIcon 
                    className={`h-4 w-4 shrink-0 ${suitColor}`}
                    aria-label={`${suitName} suit`}
                  />
                )}
                <span className="min-w-0 flex-[1_1_8ch] text-main wrap-break-word">
                  <span className="sr-only">Rank {index + 1}: </span>
                  {card.name}
                </span>
                {hasBadge && (
                  <Fire
                    className="h-3.5 w-3.5 text-accent shrink-0"
                    aria-label="streak badge earned"
                  />
                )}
              </div>

              {card.trendData && (
                <div className="mx-2 hidden sm:block">
                  <TrendSparkline data={card.trendData} height={24} color="var(--brand-primary)" />
                </div>
              )}

              <div className="ms-auto flex max-w-full flex-wrap items-center gap-2">
                {card.trend && card.trend !== 'stable' && (
                  <TrendIndicator trend={card.trend} />
                )}
                <span
                  className="text-muted tabular-nums"
                >
                  <span aria-hidden="true">{card.count}x</span>
                  <span className="sr-only">appeared {card.count} {card.count === 1 ? 'time' : 'times'}</span>
                </span>
                {card.reversedCount > 0 && (
                  <span
                    className="text-xs text-muted/70"
                  >
                    <span aria-hidden="true">({card.reversedCount}↺)</span>
                    <span className="sr-only">{card.reversedCount} reversed</span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      
      <div className="mt-3 pt-2 border-t border-secondary/20 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm sm:text-xs">
        <span className="text-muted/70">
          {cards.length > 5 ? `+${cards.length - 5} more` : 'Explore deck'}
        </span>
        <Link 
          to="/journal/gallery" 
          className="flex items-center gap-1 min-h-touch py-2 px-2 -m-2 text-accent hover:text-main transition-colors touch-manipulation"
          aria-label="View your card collection"
        >
          View Collection
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isEmerging && (
        <p className="mt-2 text-2xs text-muted/70">
          Keep logging to confirm which cards stay in focus.
        </p>
      )}
    </div>
  );
}

export default memo(CardsCallingYou);
