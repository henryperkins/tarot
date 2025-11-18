import { SYMBOL_ANNOTATIONS } from '../../shared/symbols/symbolAnnotations.js';
import { getMinorSymbolAnnotation } from '../../shared/vision/minorSymbolLexicon.js';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';

const CARD_LOOKUP = (() => {
  const map = new Map();
  [...MAJOR_ARCANA, ...MINOR_ARCANA].forEach((card) => {
    if (card?.name) {
      map.set(card.name.toLowerCase(), card);
    }
  });
  return map;
})();

function getCanonicalCard(card) {
  if (!card?.name) return null;
  return CARD_LOOKUP.get(card.name.toLowerCase()) || card;
}

function getAnnotation(card) {
  if (!card) return null;
  if (typeof card.number === 'number' && SYMBOL_ANNOTATIONS[card.number]) {
    return SYMBOL_ANNOTATIONS[card.number];
  }
  if (card.suit && card.rank) {
    return getMinorSymbolAnnotation(card);
  }
  return null;
}

function splitKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildCardInsights(card, { orientationOverride } = {}) {
  if (!card) return null;
  const baseCard = getCanonicalCard(card);
  if (!baseCard) return null;

  const isReversed = typeof orientationOverride === 'boolean'
    ? orientationOverride
    : Boolean(card.isReversed);

  const keywords = isReversed
    ? splitKeywords(baseCard.reversed)
    : splitKeywords(baseCard.upright);

  const annotation = getAnnotation(baseCard);
  const dominantSymbols = Array.isArray(annotation?.symbols)
    ? annotation.symbols.slice(0, 3)
    : [];
  const dominantColors = Array.isArray(annotation?.dominantColors)
    ? annotation.dominantColors.slice(0, 3)
    : [];

  return {
    name: baseCard.name || card.name,
    isReversed,
    keywords,
    archetype: annotation?.archetype || null,
    composition: annotation?.composition || null,
    symbols: dominantSymbols,
    colors: dominantColors,
    suit: baseCard.suit || null,
    rank: baseCard.rank || null
  };
}
