import { MAJOR_ARCANA } from './majorArcana';
import { MINOR_ARCANA } from './minorArcana';

export const ALL_CARDS = [...MAJOR_ARCANA, ...MINOR_ARCANA];

const CARD_LOOKUP = ALL_CARDS.reduce((acc, card) => {
  acc[card.name] = card;
  acc[card.name.toLowerCase()] = card;
  return acc;
}, {});

export const DEFAULT_POSITIONS = [
  'Past',
  'Present',
  'Future',
  'Foundation',
  'Crown',
  'Near Future',
  'Self',
  'Environment',
  'Hopes',
  'Outcome'
];

export function getCardByName(name) {
  if (!name) return null;
  return CARD_LOOKUP[name] || CARD_LOOKUP[name.toLowerCase()] || null;
}

export function drawSampleReading(count = 3, positions = DEFAULT_POSITIONS) {
  const deck = [...ALL_CARDS];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const activePositions = Array.isArray(positions) && positions.length > 0
    ? positions
    : DEFAULT_POSITIONS;

  return deck.slice(0, count).map((card, index) => ({
    ...card,
    position: activePositions[index] || `Card ${index + 1}`,
    isReversed: Math.random() < 0.35
  }));
}
