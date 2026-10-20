/**
 * Card Lookup Utilities
 * 
 * Provides card image lookup, canonical card data access,
 * and orientation meaning helpers.
 */

import { MAJOR_ARCANA } from '../data/majorArcana.js';
import { MINOR_ARCANA } from '../data/minorArcana.js';
import { getDeckAlias, getDeckImagePath } from '../../shared/vision/deckAssets.js';

// Fallback image for missing cards
export const FALLBACK_IMAGE = '/images/card-back.png';

// Build lookup table from all cards
const ALL_CARDS = [...MAJOR_ARCANA, ...MINOR_ARCANA];

export const CARD_LOOKUP = ALL_CARDS.reduce((acc, card) => {
  // Normalize card name for lookup (lowercase, no spaces)
  const normalizedName = card.name.toLowerCase().replace(/\s+/g, '-');
  acc[normalizedName] = card;
  acc[card.name] = card; // Also allow exact name lookup
  acc[card.name.toLowerCase()] = card; // Allow lowercase lookup
  return acc;
}, {});

/**
 * Get card image path
 * @param {Object} card - Card object with name/image properties
 * @returns {string} Image path or fallback
 */
export function getCardImage(card) {
  if (!card) return FALLBACK_IMAGE;
  
  // If card has an image property, use it
  if (card.image) return card.image;
  
  // Try to look up the canonical card
  const canonical = getCanonicalCard(card);
  if (canonical?.image) return canonical.image;
  
  return FALLBACK_IMAGE;
}

const RWS_SCAN = /^\/images\/cards\/(RWS1909_-_[^/]+)\.jpe?g$/i;

/**
 * srcset for a card shown small (spreads, reading rows): the 360 px WebP
 * thumbnail beside the full scan, so phones skip ~220 KB per card. Only the
 * Rider-Waite-Smith scans have thumbnails (scripts/assets/generate-card-thumbnails.mjs);
 * other decks' images are already small and return undefined.
 * @param {string} src - Card image path (getCardImage)
 * @returns {string|undefined}
 */
export function getCardThumbnailSrcSet(src) {
  const match = typeof src === 'string' ? RWS_SCAN.exec(src) : null;
  if (!match) return undefined;
  return `/images/cards/w360/${match[1]}.webp 360w, ${src} 825w`;
}

/** The selected card's small artwork while its full scan is loading. */
export function getCardPreviewImage(card) {
  const image = getCardImage(card);
  const match = RWS_SCAN.exec(image);
  return match ? `/images/cards/w360/${match[1]}.webp` : image;
}

/**
 * Get the canonical card data from the lookup table
 * @param {Object|string} card - Card object or name
 * @returns {Object|null} Canonical card data
 */
export function getCanonicalCard(card) {
  if (!card) return null;
  
  // Deck aliases can collide with a different canonical card (Thoth's Knight
  // is the RWS King), so prefer explicit identity. Fall back to the name when
  // an identity field is missing, malformed or not in the catalog.
  const candidates = typeof card === 'string'
    ? [card]
    : [card.canonicalName, card.canonicalKey, card.name];

  for (const name of candidates) {
    if (typeof name !== 'string' || !name) continue;

    // Try various normalizations
    const lookups = [
      name,
      name.toLowerCase(),
      name.toLowerCase().replace(/\s+/g, '-'),
      name.replace(/\s+/g, '-')
    ];

    for (const lookup of lookups) {
      if (CARD_LOOKUP[lookup]) {
        return CARD_LOOKUP[lookup];
      }
    }
  }

  return null;
}

/** Keep canonical identity and orientation while displaying the selected deck. */
export function getCardForDeck(card, deckStyle = 'rws-1909') {
  if (!card) return null;
  const canonical = getCanonicalCard(card) || card;
  return {
    ...canonical,
    ...card,
    canonicalName: canonical.name,
    name: getDeckAlias(canonical, deckStyle),
    image: getDeckImagePath(canonical, deckStyle) || card.image || canonical.image || FALLBACK_IMAGE
  };
}

/**
 * Get meaning based on card orientation
 * @param {Object} card - Card with isReversed property
 * @returns {string} Upright or reversed meaning
 */
export function getOrientationMeaning(card) {
  if (!card) return '';
  
  const canonical = getCanonicalCard(card);
  if (!canonical) return '';
  
  return card.isReversed ? canonical.reversed : canonical.upright;
}

/**
 * Check if a card exists in our lookup
 * @param {string} name - Card name
 * @returns {boolean} Whether card exists
 */
export function cardExists(name) {
  return getCanonicalCard(name) !== null;
}

/**
 * Get all cards matching a filter
 * @param {Function} filterFn - Filter function
 * @returns {Array} Matching cards
 */
export function filterCards(filterFn) {
  return ALL_CARDS.filter(filterFn);
}

/**
 * Get all Major Arcana cards
 * @returns {Array} Major Arcana cards
 */
export function getMajorArcana() {
  return MAJOR_ARCANA;
}

/**
 * Get all Minor Arcana cards
 * @returns {Array} Minor Arcana cards  
 */
export function getMinorArcana() {
  return MINOR_ARCANA;
}

/**
 * Get all cards
 * @returns {Array} All tarot cards
 */
export function getAllCards() {
  return ALL_CARDS;
}
