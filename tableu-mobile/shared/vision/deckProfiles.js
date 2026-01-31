import {
  getThothAlias,
  getThothImagePath,
  getMarseilleAlias,
  getMarseilleImagePath,
  getDeckSuitAlias,
  getDeckCourtAlias
} from './deckAssets.js';
import {
  DECK_CATALOG,
  getDeckProfileLabel,
  getDeckPromptPalette
} from './deckCatalog.js';

const buildDeckProfile = (deckId, overrides) => {
  const deck = DECK_CATALOG[deckId];
  if (!deck) return null;
  return {
    id: deck.id,
    label: getDeckProfileLabel(deckId),
    promptCue: deck.description,
    palette: getDeckPromptPalette(deckId),
    texture: deck.texture,
    ...overrides
  };
};

const DECK_PROFILES = {
  'rws-1909': buildDeckProfile('rws-1909', {
    aliasResolver: (card) => card?.name || 'Tarot card',
    imageResolver: (card) => card?.image || null,
    assetScanDir: '.',
    suitAliasResolver: (suit) => getDeckSuitAlias(suit, 'rws-1909'),
    courtAliasResolver: (rank) => getDeckCourtAlias(rank, 'rws-1909')
  }),
  'thoth-a1': buildDeckProfile('thoth-a1', {
    aliasResolver: getThothAlias,
    imageResolver: getThothImagePath,
    assetScanDir: 'thoth',
    suitAliasResolver: (suit) => getDeckSuitAlias(suit, 'thoth-a1'),
    courtAliasResolver: (rank) => getDeckCourtAlias(rank, 'thoth-a1')
  }),
  'marseille-classic': buildDeckProfile('marseille-classic', {
    aliasResolver: getMarseilleAlias,
    imageResolver: getMarseilleImagePath,
    assetScanDir: 'marseille',
    suitAliasResolver: (suit) => getDeckSuitAlias(suit, 'marseille-classic'),
    courtAliasResolver: (rank) => getDeckCourtAlias(rank, 'marseille-classic')
  })
};

export function getDeckProfile(deckStyle = 'rws-1909') {
  return DECK_PROFILES[deckStyle] || DECK_PROFILES['rws-1909'];
}

export { DECK_PROFILES };
