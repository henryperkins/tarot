export const RELATIONSHIP_SPREAD_MIN_CARDS = 3;
export const RELATIONSHIP_SPREAD_MAX_CARDS = 5;
export const RELATIONSHIP_SPREAD_MAX_CLARIFIERS =
  RELATIONSHIP_SPREAD_MAX_CARDS - RELATIONSHIP_SPREAD_MIN_CARDS;

export const RELATIONSHIP_SPREAD_CORE_POSITIONS = [
  'You / your energy',
  'Them / their energy',
  'The connection / shared lesson'
];

export const RELATIONSHIP_SPREAD_CLARIFIER_POSITIONS = [
  'Dynamics / guidance',
  'Outcome / what this can become'
];

export const RELATIONSHIP_SPREAD_POSITIONS = [
  ...RELATIONSHIP_SPREAD_CORE_POSITIONS,
  ...RELATIONSHIP_SPREAD_CLARIFIER_POSITIONS
];
