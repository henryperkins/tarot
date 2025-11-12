import React from 'react';
import { SPREADS } from '../data/spreads';
import { Card } from './Card';

function toAreaClass(position) {
  const map = {
    Present: 'present',
    Challenge: 'challenge',
    Past: 'past',
    Future: 'future',
    Above: 'above',
    Below: 'below',
    Advice: 'advice',
    External: 'external',
    'Hopes/Fears': 'hopesfears',
    Outcome: 'outcome'
  };
  return `cc-${map[position] || 'present'}`;
}

export function ReadingGrid({
  selectedSpread,
  reading,
  revealedCards,
  revealCard,
  reflections,
  setReflections
}) {
  if (!reading) return null;

  const spreadInfo = SPREADS[selectedSpread];

  return (
    <div
      className={
        selectedSpread === 'celtic'
          ? 'cc-grid'
          : `grid gap-8 ${
              reading.length === 1
                ? 'grid-cols-1 max-w-md mx-auto'
                : reading.length <= 4
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`
      }
    >
      {reading.map((card, index) => {
        const position = spreadInfo.positions[index] || `Position ${index + 1}`;

        return (
          <div
            key={`${card.name}-${index}`}
            className={`bg-indigo-900/40 backdrop-blur rounded-lg border border-amber-500/30 overflow-hidden ${
              selectedSpread === 'celtic' ? toAreaClass(position) : ''
            }`}
          >
            <Card
              card={card}
              index={index}
              isRevealed={revealedCards.has(index)}
              onReveal={revealCard}
              position={position}
              reflections={reflections}
              setReflections={setReflections}
            />
          </div>
        );
      })}
    </div>
  );
}