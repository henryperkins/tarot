export const RELATIONSHIP_SPREAD_MIN_CARDS = 3;

// Explicit roles are authoritative; slot order alone does not imply time.
export function usesThreeCardTimeline(cardsInfo) {
  const roles = [/^(?:recent\s+)?past\b/i, /^present\b/i, /^(?:(?:near|possible)\s+)?future\b/i];
  return Array.isArray(cardsInfo) && cardsInfo.length === 3 && cardsInfo.every((card, index) => {
    const role = typeof card?.position === 'string' ? card.position.split(/[—–:]/, 1)[0].trim() : '';
    return !role || roles[index].test(role);
  });
}
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
