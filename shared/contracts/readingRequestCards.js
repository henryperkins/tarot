import { getDeckAlias } from '../vision/deckAssets.js';

/**
 * Build a reading request from a trusted catalog card. Catalog names already
 * identify canonical cards and must never be resolved as deck display aliases.
 */
export function buildReadingRequestCard(card, {
  deckStyle = 'rws-1909',
  position,
  isReversed = card.isReversed === true,
  userReflection = null
} = {}) {
  const canonicalName = card.name;
  return {
    position,
    card: getDeckAlias(card, deckStyle),
    canonicalName,
    canonicalKey: canonicalName.toLowerCase(),
    aliases: Array.isArray(card.aliases) ? [...card.aliases] : [],
    orientation: isReversed ? 'Reversed' : 'Upright',
    meaning: isReversed ? card.reversed : card.upright,
    number: typeof card.number === 'number' ? card.number : null,
    suit: card.suit || null,
    rank: card.rank || null,
    rankValue: typeof card.rankValue === 'number' ? card.rankValue : null,
    userReflection: typeof userReflection === 'string' ? (userReflection.trim() || null) : null
  };
}
