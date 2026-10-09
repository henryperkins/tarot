import { canonicalVisualCueJSON, hashVisualCueText } from '../contracts/visualCueBatches.js';

const clean = value => typeof value === 'string' ? value.trim() : '';
const RWS_DECKS = new Set(['rws-1909', 'rws1909', 'rws', 'rider-waite-smith']);

/** The same occurrence/context identity for generation requests and saved entries. */
export function normalizeVisualSource(source = {}) {
  const cards = source.cardsInfo || source.cards || [];
  const deckId = clean(source.deckStyle || source.deckId || source.spreadInfo?.deckStyle || cards[0]?.deckStyle) || 'rws-1909';
  const artworkEdition = RWS_DECKS.has(deckId) ? 'rws-immanuelle-vector' : `identity:${deckId}`;
  const normalizedCards = cards.map((card, spreadIndex) => ({
    index: spreadIndex,
    spreadIndex,
    canonicalName: clean(card.canonicalName || card.name || card.card),
    position: clean(card.position) || `Position ${spreadIndex + 1}`,
    orientation: card.orientation === 'Reversed' || card.isReversed ? 'Reversed' : 'Upright',
    artworkEdition,
    userReflection: clean(card.userReflection || card.reflection || (typeof source.reflections === 'object' && source.reflections?.[spreadIndex]))
  }));
  return {
    cards: normalizedCards,
    question: clean(source.userQuestion ?? source.question),
    reflections: clean(source.reflectionsText ?? source.reflections),
    artworkEdition,
    catalogVersion: 'v1'
  };
}

export async function fingerprintVisualSource(source = {}) {
  const normalized = normalizeVisualSource(source);
  const spread = normalized.cards.map(({ userReflection: _reflection, ...card }) => card);
  const context = {
    question: normalized.question,
    reflections: normalized.reflections,
    cardReflections: normalized.cards.map(card => card.userReflection)
  };
  return {
    spreadHash: await hashVisualCueText(canonicalVisualCueJSON(spread)),
    contextHash: await hashVisualCueText(canonicalVisualCueJSON(context)),
    rawHash: await hashVisualCueText(source.raw ?? source.personalReading ?? '')
  };
}
