export const SPREADS = [
  {
    key: 'three-card',
    name: 'Three Card',
    description: 'Past, present, and future guidance.',
    cards: 3,
    positions: ['Past', 'Present', 'Future'],
    layout: {
      type: 'grid',
      columns: 3,
      slots: [0, 1, 2]
    }
  },
  {
    key: 'celtic-cross',
    name: 'Celtic Cross',
    description: 'Deeper context with ten positions.',
    cards: 10,
    positions: [
      'Present',
      'Challenge',
      'Past',
      'Future',
      'Above',
      'Below',
      'Advice',
      'External',
      'Hopes',
      'Outcome'
    ],
    layout: {
      type: 'grid',
      columns: 3,
      slots: [
        4, 1, 6,
        2, 0, 7,
        5, 3, 8,
        null, null, 9
      ]
    }
  },
  {
    key: 'daily-draw',
    name: 'Daily Draw',
    description: 'Single-card focus for today.',
    cards: 1,
    positions: ['Focus'],
    layout: {
      type: 'grid',
      columns: 1,
      slots: [0]
    }
  }
];

export const RELATIONSHIP_SPREAD_MAX_CARDS = 5;

export function getSpreadByKey(key) {
  return SPREADS.find((spread) => spread.key === key) || null;
}
