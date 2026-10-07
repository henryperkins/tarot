import rwsPreview from '../../selectorimages/rider.jpeg';
import thothPreview from '../../selectorimages/Thoth.jpeg';
import marseillePreview from '../../selectorimages/marseille.jpeg';
import { DECK_CATALOG, DECK_ORDER } from '../../shared/vision/deckCatalog.js';

const DECK_PREVIEW_URLS = import.meta.glob(
  '../../selectorimages/{rider,Thoth,marseille}-{480,960}.{avif,webp}',
  { eager: true, query: '?url', import: 'default' }
);

function buildDeckPreview(baseName, src, alt) {
  return {
    src,
    alt,
    width: 982,
    height: 799,
    sources: ['avif', 'webp'].map(format => ({
      type: `image/${format}`,
      srcSet: [480, 960].map(width => (
        `${DECK_PREVIEW_URLS[`../../selectorimages/${baseName}-${width}.${format}`]} ${width}w`
      )).join(', ')
    }))
  };
}

const DECK_VISUALS = {
  'rws-1909': {
    preview: buildDeckPreview('rider', rwsPreview, 'Rider-Waite-Smith cards: The High Priestess, The Magician, and The Moon on dark reading cloth'),
    accent: 'var(--brand-primary)',
  },
  'thoth-a1': {
    preview: buildDeckPreview('Thoth', thothPreview, 'Thoth-inspired illustrative preview with three prismatic cards in teal, magenta, and gold'),
    accent: 'var(--color-cups)',
    note: 'Uses Thoth card names (e.g., "The Magus", "Adjustment").'
  },
  'marseille-classic': {
    preview: buildDeckPreview('marseille', marseillePreview, 'Tarot de Marseille cards: La Papesse, Le Bateleur, and La Lune on dark reading cloth'),
    accent: 'var(--color-wands)',
    note: 'Uses Marseille numbering with French titles.'
  }
};

export const DECK_OPTIONS = DECK_ORDER.map((deckId) => {
  const deck = DECK_CATALOG[deckId];
  const visuals = DECK_VISUALS[deckId];
  return {
    id: deck.id,
    label: deck.label,
    subtitle: deck.subtitleDisplay || deck.subtitle,
    description: deck.description,
    mobileDescription: deck.mobileDescription,
    border: 'var(--border-warm-light)',
    borderActive: 'var(--brand-primary)',
    glow: 'var(--primary-30)',
    background: 'linear-gradient(160deg, var(--panel-dark-2), var(--panel-dark-1))',
    ...visuals
  };
});
