/**
 * Saved journal cards keep their canonical (Rider-Waite-Smith) identity:
 * name, number, suit, rank and orientation. A reading drawn with another
 * deck is shown in that deck, the way the reading screen showed it: its art
 * and its card names, with the canonical name kept as `canonicalName`.
 */
import { getCardForDeck } from '../cardLookup.js';

const DECKS_WITH_OWN_ART = new Set(['thoth-a1', 'marseille-classic']);

export function hasOwnDeckArt(deckId) {
  return DECKS_WITH_OWN_ART.has(deckId);
}

export function toDeckCard(card, deckId) {
  if (!card || typeof card !== 'object' || !hasOwnDeckArt(deckId)) return card;
  return getCardForDeck(card, deckId);
}

export function toDeckCards(cards, deckId) {
  if (!Array.isArray(cards)) return [];
  if (!hasOwnDeckArt(deckId)) return cards;
  return cards.map(card => toDeckCard(card, deckId));
}
