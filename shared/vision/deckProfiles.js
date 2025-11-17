import { getThothAlias, getThothImagePath, getMarseilleAlias, getMarseilleImagePath } from './deckAssets.js';

const DECK_PROFILES = {
  'rws-1909': {
    id: 'rws-1909',
    label: 'Rider-Waite-Smith (1909)',
    promptCue:
      'Classic Pamela Colman Smith watercolor palette with bold ink outlines and theatrical staging.',
    palette: ['sunlit yellows', 'lapis blues', 'crimson accents', 'stone gray backdrops'],
    texture: 'Hand-painted inks on watercolor paper with a slightly muted finish.',
    aliasResolver: (card) => card?.name || 'Tarot card',
    imageResolver: (card) => card?.image || null,
    assetScanDir: '.'
  },
  'thoth-a1': {
    id: 'thoth-a1',
    label: 'Thoth (Crowley/Harris A1)',
    promptCue:
      'Abstract, prismatic geometry with layered astrological sigils and Art Deco gradients.',
    palette: ['electric teal', 'magenta', 'saffron gold', 'deep indigo shadows'],
    texture: 'Oil and watercolor washes blended into airbrushed gradients.',
    aliasResolver: getThothAlias,
    imageResolver: getThothImagePath,
    assetScanDir: 'thoth'
  },
  'marseille-classic': {
    id: 'marseille-classic',
    label: 'Tarot de Marseille (18th century scans)',
    promptCue: 'Woodcut line work with flat primary colors and medieval heraldry.',
    palette: ['carmine red', 'cobalt blue', 'sunflower yellow', 'bone white'],
    texture: 'Bold, block-printed textures with minimal shading.',
    aliasResolver: getMarseilleAlias,
    imageResolver: getMarseilleImagePath,
    assetScanDir: 'marseille'
  }
};

export function getDeckProfile(deckStyle = 'rws-1909') {
  return DECK_PROFILES[deckStyle] || DECK_PROFILES['rws-1909'];
}

export { DECK_PROFILES };
