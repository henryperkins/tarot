import React from 'react';
import { SPREADS } from '../data/spreads';
import { Card } from './Card';

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
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3'
            }`
      }
    >
      {reading.map((card, index) => {
        const position = spreadInfo.positions[index] || `Position ${index + 1}`;

        return (
          <div
            key={`${card.name}-${index}`}
            className={`modern-surface border border-emerald-400/40 overflow-hidden ${
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
