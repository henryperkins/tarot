/**
 * Pattern web for a saved reading: which drawn cards form the archetypal
 * triads and dyads saved with it.
 *
 * Saved graph keys name complete triads by id and dyads by Major Arcana
 * number, so cards are matched by their canonical number in the reading's deck
 * (Thoth "Lust" is Strength; Marseille "Le Bateleur" is The Magician).
 */
import { canonicalizeCardName } from '../../../shared/vision/cardNameMapping.js';
import { MAJOR_ARCANA } from '../../data/majorArcana.js';
import { ARCHETYPAL_DYADS, ARCHETYPAL_TRIADS } from '../../data/knowledgeGraphData.js';

const MAJOR_NUMBERS = new Map(MAJOR_ARCANA.map((card) => [card.name.toLowerCase(), card.number]));
const TRIADS = new Map(ARCHETYPAL_TRIADS.map((triad) => [triad.id, triad]));
const pairKey = (numbers) => [...numbers].sort((a, b) => a - b).join('-');
const DYADS = new Map(ARCHETYPAL_DYADS.map((dyad) => [pairKey(dyad.cards), dyad]));

/**
 * @param {Object} card - Saved card ({ name, canonicalName })
 * @param {string} [deckStyle] - Reading deck id
 * @returns {number|null} Major Arcana number, or null for Minor Arcana and unknown cards
 */
export function majorArcanaNumber(card, deckStyle = 'rws-1909') {
  for (const value of [card?.canonicalName, card?.name, card?.card]) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const canonical = canonicalizeCardName(value, deckStyle || 'rws-1909') || value;
    const number = MAJOR_NUMBERS.get(canonical.trim().toLowerCase());
    if (Number.isInteger(number)) return number;
  }
  return null;
}

function cardIndices(numbers, cardNumbers) {
  const indices = numbers.map((number) => cardNumbers.indexOf(number));
  if (indices.some((index) => index < 0) || new Set(indices).size !== indices.length) return null;
  return indices;
}

/**
 * @param {Array} cards - The reading's saved cards, in spread order
 * @param {Object} graphKeys - `themes.knowledgeGraph.graphKeys` from the saved entry
 * @param {string} [deckStyle] - Reading deck id
 * @returns {{ triads: Array<{id, theme, indices}>, dyads: Array<{key, theme, category, indices}> }}
 *   Only relationships whose cards are all in this reading; indices point into `cards`.
 */
export function resolvePatternWeb(cards, graphKeys, deckStyle) {
  const cardNumbers = (Array.isArray(cards) ? cards : []).map((card) => majorArcanaNumber(card, deckStyle));
  const triads = [];
  const seenTriads = new Set();
  for (const id of Array.isArray(graphKeys?.completeTriadIds) ? graphKeys.completeTriadIds : []) {
    const triad = TRIADS.get(id);
    const indices = triad ? cardIndices(triad.cards, cardNumbers) : null;
    if (!indices || seenTriads.has(id)) continue;
    seenTriads.add(id);
    triads.push({ id, theme: triad.theme || null, indices });
  }

  const dyads = [];
  const seenDyads = new Set();
  for (const pair of Array.isArray(graphKeys?.dyadPairs) ? graphKeys.dyadPairs : []) {
    const numbers = Array.isArray(pair?.cards) ? pair.cards.map(Number) : [];
    if (numbers.length !== 2 || !numbers.every(Number.isInteger)) continue;
    const key = pairKey(numbers);
    const indices = cardIndices(numbers, cardNumbers);
    if (!indices || seenDyads.has(key)) continue;
    seenDyads.add(key);
    const known = DYADS.get(key);
    dyads.push({ key, theme: known?.theme || null, category: pair.category || known?.category || null, indices });
  }

  return { triads, dyads };
}
