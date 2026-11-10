import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { DECK_CATALOG } from '../../shared/vision/deckCatalog.js';
import { getDeckAlias } from '../../shared/vision/deckAssets.js';
import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
import { sanitizeReadingCard, sanitizeReadingContext } from './readingCardContext.js';

const canonicalCards = new Map(
  [...MAJOR_ARCANA, ...MINOR_ARCANA].map((card) => [card.name.toLowerCase(), card])
);

export class ReadingCardResolutionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ReadingCardResolutionError';
    this.code = code;
  }
}

/**
 * Resolve schema-validated card labels against the selected deck. Redundant
 * client metadata is never evidence of identity; the catalog owns those facts.
 * Returned names/keys use the canonical namespace and must not be alias-mapped
 * a second time (notably Thoth Prince -> canonical Knight -> Thoth King).
 */
export function canonicalizeReadingCards(cardsInfo, deckStyle = 'rws-1909') {
  if (!Object.hasOwn(DECK_CATALOG, deckStyle)) {
    throw new ReadingCardResolutionError('Unsupported reading deck.', 'invalid_deck_style');
  }

  return cardsInfo.map((card, index) => {
    const canonicalName = canonicalizeCardName(card.card, deckStyle);
    const canonical = canonicalCards.get(canonicalName?.toLowerCase());
    if (!canonical) {
      throw new ReadingCardResolutionError(
        `cardsInfo[${index}].card must identify a supported card for the selected deck.`,
        'invalid_card_identity'
      );
    }

    const canonicalMeaning = card.orientation === 'Reversed' ? canonical.reversed : canonical.upright;
    const incomingMeaning = sanitizeReadingContext(card.meaning).slice(0, 1000);
    const differs = incomingMeaning && incomingMeaning.toLowerCase().replace(/\s+/g, ' ').trim() !== canonicalMeaning.toLowerCase().replace(/\s+/g, ' ').trim();
    const number = canonical.number ?? null;
    const alias = getDeckAlias(canonical, deckStyle);
    // Explicit fields prevent extra client properties from bypassing resolution
    // in a later consumer (name, card_number, deckStyle, isReversed, etc.).
    const resolved = sanitizeReadingCard({
      card: card.card.trim(),
      name: canonical.name,
      canonicalName: canonical.name,
      canonicalKey: canonical.name.toLowerCase(),
      aliases: [...new Set([canonical.name, alias].filter(Boolean))],
      number,
      cardNumber: number,
      card_number: number,
      suit: canonical.suit ?? null,
      rank: canonical.rank ?? null,
      rankValue: canonical.rankValue ?? null,
      deckStyle,
      orientation: card.orientation,
      position: card.position,
      meaning: canonicalMeaning,
      ...(differs ? { callerMeaning: incomingMeaning } : {}),
      userReflection: card.userReflection ?? null
    });
    return {
      ...resolved,
      meaning: canonicalMeaning
    };
  });
}


/** New-request admission: a single deck is drawn without replacement. */
export function resolveReadingCards(cardsInfo, deckStyle = 'rws-1909') {
  const resolved = canonicalizeReadingCards(cardsInfo, deckStyle);
  const firstIndices = new Map();
  resolved.forEach((card, index) => {
    if (firstIndices.has(card.canonicalKey)) {
      const first = firstIndices.get(card.canonicalKey);
      const error = new ReadingCardResolutionError(
        `cardsInfo[${index}] repeats the canonical identity at cardsInfo[${first}].`,
        'duplicate_card_identity'
      );
      error.indices = [first, index];
      throw error;
    }
    firstIndices.set(card.canonicalKey, index);
  });
  return resolved;
}
