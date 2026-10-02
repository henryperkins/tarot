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
    preview: buildDeckPreview('rider', rwsPreview, 'Rider-Waite-Smith deck featuring The Magician card'),
    accent: 'var(--brand-primary)',
  },
  'thoth-a1': {
    preview: buildDeckPreview('Thoth', thothPreview, 'Thoth deck featuring The Magus card with Art Deco styling'),
    accent: 'var(--color-cups)',
    note: 'Uses Thoth card names (e.g., "The Magus", "Adjustment").'
  },
  'marseille-classic': {
    preview: buildDeckPreview('marseille', marseillePreview, 'Tarot de Marseille deck featuring Le Bateleur card'),
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
    palette: deck.palette?.ui || [],
    border: 'var(--border-warm-light)',
    borderActive: 'var(--brand-primary)',
    glow: 'var(--primary-30)',
    background: 'linear-gradient(160deg, var(--panel-dark-2), var(--panel-dark-1))',
    ...visuals
  };
});
