import rwsPreview from '../../selectorimages/rider.jpeg';
import thothPreview from '../../selectorimages/Thoth.jpeg';
import marseillePreview from '../../selectorimages/marseille.jpeg';
import { DECK_CATALOG, DECK_ORDER } from '../../shared/vision/deckCatalog.js';

const DECK_VISUALS = {
  'rws-1909': {
    preview: {
      src: rwsPreview,
      alt: 'Rider-Waite-Smith deck featuring The Magician card'
    },
    accent: '#e5c48e',
    border: 'rgba(220, 188, 141, 0.35)',
    borderActive: 'rgba(229, 196, 142, 0.9)',
    glow: 'rgba(229, 196, 142, 0.45)',
    background: 'linear-gradient(150deg, rgba(255, 209, 159, 0.12), var(--panel-dark-1)), radial-gradient(circle at 20% 18%, rgba(255, 225, 180, 0.12), transparent 52%), radial-gradient(circle at 80% -10%, rgba(63, 118, 192, 0.18), transparent 48)'
  },
  'thoth-a1': {
    preview: {
      src: thothPreview,
      alt: 'Thoth deck featuring The Magus card with Art Deco styling'
    },
    accent: '#44e0d2',
    border: 'rgba(83, 216, 206, 0.25)',
    borderActive: 'rgba(83, 216, 206, 0.75)',
    glow: 'rgba(83, 216, 206, 0.35)',
    background: 'linear-gradient(165deg, var(--panel-dark-2), var(--panel-dark-1)), radial-gradient(circle at 12% 18%, rgba(68, 224, 210, 0.22), transparent 48%), radial-gradient(circle at 90% 0%, rgba(193, 36, 139, 0.18), transparent 50)',
    note: 'Uses Thoth card names (e.g., "The Magus", "Adjustment").'
  },
  'marseille-classic': {
    preview: {
      src: marseillePreview,
      alt: 'Tarot de Marseille deck featuring Le Bateleur card'
    },
    accent: '#d8a300',
    border: 'rgba(192, 146, 64, 0.28)',
    borderActive: 'rgba(216, 163, 0, 0.82)',
    glow: 'rgba(216, 163, 0, 0.35)',
    background: 'linear-gradient(170deg, var(--panel-dark-2), var(--panel-dark-1)), radial-gradient(circle at 12% 22%, rgba(216, 163, 0, 0.16), transparent 46%), radial-gradient(circle at 85% -8%, rgba(47, 86, 178, 0.18), transparent 48)',
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
    ...visuals
  };
});
