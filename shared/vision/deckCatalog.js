export const DECK_CATALOG = {
  'rws-1909': {
    id: 'rws-1909',
    label: 'Rider-Waite-Smith',
    subtitle: '1909',
    subtitleDisplay: '1909 Edition',
    displayName: 'Rider-Waite-Smith 1909',
    description:
      'Classic Pamela Colman Smith watercolors with bold ink outlines and theatrical staging.',
    mobileDescription: 'Classic watercolor art with bold ink.',
    palette: {
      ui: [
        { label: 'Sunlit yellows', swatch: '#eac26d', textColor: '#1c1308' },
        { label: 'Lapis blues', swatch: '#1f3f78', textColor: '#e6ecf7' },
        { label: 'Crimson accents', swatch: '#8d1c33', textColor: '#f7e7ef' }
      ],
      promptExtras: ['stone gray backdrops']
    },
    texture: 'Hand-painted inks on watercolor paper with a slightly muted finish.'
  },
  'thoth-a1': {
    id: 'thoth-a1',
    label: 'Thoth',
    subtitle: 'Crowley/Harris A1',
    subtitleDisplay: 'Crowley/Harris A1',
    displayName: 'Thoth',
    description:
      'Abstract, prismatic geometry with layered astrological sigils and Art Deco gradients.',
    mobileDescription: 'Prismatic geometry with astro sigils.',
    palette: {
      ui: [
        { label: 'Electric teal', swatch: '#27cfc0', textColor: '#061412' },
        { label: 'Magenta', swatch: '#c1248b', textColor: '#fde7f4' },
        { label: 'Saffron gold', swatch: '#d9a441', textColor: '#120c05' }
      ],
      promptExtras: ['deep indigo shadows']
    },
    texture: 'Oil and watercolor washes blended into airbrushed gradients.'
  },
  'marseille-classic': {
    id: 'marseille-classic',
    label: 'Tarot de Marseille',
    subtitle: '18th century scans',
    subtitleDisplay: '18th Century Scans',
    displayName: 'Tarot de Marseille',
    description: 'Woodcut line work with flat primary colors and medieval heraldry.',
    mobileDescription: 'Historic woodcuts with bold primaries.',
    palette: {
      ui: [
        { label: 'Carmine red', swatch: '#a32035', textColor: '#fde6ec' },
        { label: 'Cobalt blue', swatch: '#21489b', textColor: '#e7efff' },
        { label: 'Sunflower yellow', swatch: '#d8a300', textColor: '#140d02' }
      ],
      promptExtras: ['bone white']
    },
    texture: 'Bold, block-printed textures with minimal shading.'
  }
};

export const DECK_ORDER = ['rws-1909', 'thoth-a1', 'marseille-classic'];

export function getDeckCatalogEntry(deckId = 'rws-1909') {
  return DECK_CATALOG[deckId] || DECK_CATALOG['rws-1909'];
}

export function getDeckProfileLabel(deckId = 'rws-1909') {
  const deck = getDeckCatalogEntry(deckId);
  if (!deck) return '';
  if (deck.subtitle) {
    return `${deck.label} (${deck.subtitle})`;
  }
  return deck.label || '';
}

export function getDeckPromptPalette(deckId = 'rws-1909') {
  const deck = getDeckCatalogEntry(deckId);
  const uiPalette = deck?.palette?.ui || [];
  const promptExtras = deck?.palette?.promptExtras || [];
  const base = uiPalette.map((item) => item.label.toLowerCase());
  return [...base, ...promptExtras];
}
