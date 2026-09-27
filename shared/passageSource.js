import { DECK_CATALOG } from './vision/deckCatalog.js';

// The base canon uses RWS names and visual references. The two dedicated
// collections carry their own tradition. Infer these for older saved payloads.
const SOURCE_DECKS = {
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
  const deckStyle = passage?.sourceDeck || SOURCE_DECKS[passage?.type];
  const deck = DECK_CATALOG[deckStyle];
  return deck ? { deckStyle, label: deck.label } : null;
}
