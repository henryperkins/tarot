/**
 * Card Lookup Utilities
 * 
 * Provides card image lookup, canonical card data access,
 * and orientation meaning helpers.
 */

import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';

// Fallback image for missing cards
export const FALLBACK_IMAGE = '/images/cards/card-back.jpeg';

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

/**
 * Get the canonical card data from the lookup table
 * @param {Object|string} card - Card object or name
 * @returns {Object|null} Canonical card data
 */
export function getCanonicalCard(card) {
  if (!card) return null;
  
  const name = typeof card === 'string' ? card : card.name;
  if (!name) return null;
  
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
  
  return null;
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
