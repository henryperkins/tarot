import React from 'react';
import { SPREADS } from '../data/spreads';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { Card } from './Card';
import { Tooltip } from './Tooltip';

const CARD_LOOKUP = [...MAJOR_ARCANA, ...MINOR_ARCANA].reduce((acc, card) => {
  acc[card.name] = card;
  return acc;
}, {});

function toAreaClass(position) {
  // Normalize full Celtic Cross labels (e.g. "Present — core situation (Card 1)")
  const key = position.split('—')[0].trim(); // take text before the em dash
  const map = {
    'Present': 'present',
    'Challenge': 'challenge',
    'Past': 'past',
    'Near Future': 'future',
    'Future': 'future',
    'Conscious': 'above',
    'Subconscious': 'below',
    'Self / Advice': 'advice',
    'External Influences': 'external',
    'Hopes & Fears': 'hopesfears',
    'Outcome': 'outcome'
  };
  return `cc-${map[key] || 'present'}`;
}

function getOrientationMeaning(card) {
  const meta = CARD_LOOKUP[card.name] || card;
  const uprightMeaning = meta.upright || card.upright || '';
  const reversedMeaning = meta.reversed || card.reversed || '';
  return card.isReversed ? reversedMeaning || uprightMeaning : uprightMeaning || reversedMeaning;
}

export function ReadingGrid({
  selectedSpread,
  reading,
  revealedCards,
  revealCard,
  reflections,
  setReflections,
  onCardClick
}) {
  // Track previous reveal count to detect batch reveals
  const prevRevealedCount = React.useRef(0);

  // Update ref after render
  React.useEffect(() => {
    prevRevealedCount.current = revealedCards.size;
  }, [revealedCards.size]);

  if (!reading) return null;

  const spreadInfo = SPREADS[selectedSpread];
  const isBatchReveal = reading.length > 1 &&
    revealedCards.size === reading.length &&
    prevRevealedCount.current < reading.length - 1;

  return (
    <>
      {reading.length > 1 && (
        <p className="sm:hidden text-center text-xs text-emerald-300/70 mb-2 animate-pulse">
          Swipe to explore cards &rarr;
        </p>
      )}
      <div
        className={
          selectedSpread === 'celtic'
            ? 'cc-grid animate-fade-in'
            : `animate-fade-in ${reading.length === 1
              ? 'grid grid-cols-1 max-w-md mx-auto'
              : 'flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 sm:grid sm:gap-8 sm:overflow-visible sm:snap-none sm:pb-0 ' + (reading.length <= 4
                ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
                : 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3')
            }`
        }
      >
        {reading.map((card, index) => {
          const position = spreadInfo.positions[index] || `Position ${index + 1}`;
          const isRevealed = revealedCards.has(index);

          const tooltipContent = isRevealed ? (
            <div className="space-y-1 text-left leading-snug">
              <strong className="block text-amber-200 text-sm">
                {card.name}
                {card.isReversed ? ' (Reversed)' : ''}
              </strong>
              <em className="block text-xs text-amber-100/80">{position}</em>
              <p className="text-xs-plus text-amber-50/90">{getOrientationMeaning(card)}</p>
            </div>
          ) : null;

          const cardElement = (
            <Card
              card={card}
              index={index}
              isRevealed={isRevealed}
              onReveal={revealCard}
              position={position}
              reflections={reflections}
              setReflections={setReflections}
              onCardClick={onCardClick}
              staggerDelay={isBatchReveal ? index * 0.15 : 0}
            />
          );

          return (
            <div
              key={`${card.name}-${index}`}
              className={`modern-surface border border-emerald-400/40 ${selectedSpread === 'celtic'
                ? toAreaClass(position)
                : reading.length > 1 ? 'min-w-[85vw] snap-center sm:min-w-0' : ''
                }`}
            >
              <Tooltip
                content={isRevealed ? tooltipContent : null}
                position="top"
                asChild
                enableClick={false}
                triggerClassName="block h-full"
              >
                {cardElement}
              </Tooltip>
            </div>
          );
        })}
      </div>
    </>
  );
}
