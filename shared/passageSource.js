import { DECK_CATALOG } from './vision/deckCatalog.js';

// The base canon uses RWS names and visual references. The two dedicated
// collections carry their own tradition. Infer these for older saved payloads.
export const PASSAGE_SOURCE_DECKS = {
  triad: 'rws-1909',
  'fools-journey': 'rws-1909',
  'major-arcana': 'rws-1909',
  dyad: 'rws-1909',
  'suit-progression': 'rws-1909',
  'court-lineage': 'rws-1909',
  'thoth-suit': 'thoth-a1',
  'marseille-numerology': 'marseille-classic'
};

export function getPassageSource(passage) {
  const deckStyle = passage?.sourceDeck || PASSAGE_SOURCE_DECKS[passage?.type];
  const deck = Object.hasOwn(DECK_CATALOG, deckStyle) ? DECK_CATALOG[deckStyle] : null;
  return deck ? { deckStyle, label: deck.label } : null;
}
