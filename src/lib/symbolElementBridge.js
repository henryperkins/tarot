import { buildCardInsights } from './cardInsights.js';
import { getSymbolFamily } from '../../shared/symbols/symbolIndex.js';

const ELEMENT_FAMILY_MAP = {
  Fire: ['fire', 'flame', 'wand', 'torch', 'sun', 'salamander', 'lion'],
  Water: ['water', 'cup', 'chalice', 'pool', 'waves', 'waterfall', 'fish', 'crab', 'moon'],
  Air: ['sword', 'feather', 'cloud', 'bird', 'butterfly', 'smoke'],
  Earth: ['pentacle', 'coin', 'mountains', 'tree', 'stone', 'crystal', 'bull', 'wheat']
};

const SUIT_FAMILY_MAP = {
  Wands: ['wand'],
  Cups: ['cup'],
  Swords: ['sword'],
  Pentacles: ['pentacle']
};

/**
 * Get the element associated with a symbol family
 * @param {string} family - Symbol family name
 * @returns {string|null} Element name or null if not mapped
 */
export function getElementForSymbolFamily(family) {
  if (!family) return null;
  const normalizedFamily = family.toLowerCase();
  for (const [element, families] of Object.entries(ELEMENT_FAMILY_MAP)) {
    if (families.includes(normalizedFamily)) {
      return element;
    }
  }
  return null;
}

function getDominantEntry(counts = {}, { minTotal = 3, minRatio = 0.5, minCount = 2 } = {}) {
  const entries = Object.entries(counts).filter(([, count]) => Number.isFinite(count));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total < minTotal) return null;
  const [key, count] = entries.sort((a, b) => b[1] - a[1])[0] || [];
  if (!key || !count) return null;
  const ratio = count / total;
  if (ratio < minRatio && count < minCount) return null;
  return { key, count, total, ratio };
}

function collectSymbols(reading = []) {
  const symbols = [];
  const cards = Array.isArray(reading) ? reading : [];
  cards.forEach((card) => {
    const insights = buildCardInsights(card);
    if (!insights?.symbols?.length) return;
    insights.symbols.forEach((symbol) => {
      if (!symbol?.object) return;
      symbols.push({
        object: symbol.object,
        family: getSymbolFamily(symbol.object)
      });
    });
  });
  return symbols;
}

function uniqueList(items = []) {
  const seen = new Set();
  const output = [];
  items.forEach((item) => {
    if (!item || seen.has(item)) return;
    seen.add(item);
    output.push(item);
  });
  return output;
}

export function buildSymbolElementCue({ reading, themes, maxSymbols = 3 } = {}) {
  if (!themes) return null;

  const dominantElement = getDominantEntry(themes.elementCounts);
  const dominantSuit = getDominantEntry(themes.suitCounts, { minTotal: 3, minRatio: 0.5, minCount: 3 });

  if (!dominantElement && !dominantSuit) return null;

  const targetFamilies = [
    ...(dominantElement ? (ELEMENT_FAMILY_MAP[dominantElement.key] || []) : []),
    ...(dominantSuit ? (SUIT_FAMILY_MAP[dominantSuit.key] || []) : [])
  ];

  if (targetFamilies.length === 0) return null;

  const symbols = collectSymbols(reading);
  if (symbols.length === 0) return null;

  const matched = symbols
    .filter((symbol) => targetFamilies.includes(symbol.family))
    .map((symbol) => symbol.object);

  const uniqueMatches = uniqueList(matched).slice(0, maxSymbols);
  if (uniqueMatches.length === 0) return null;

  const focusParts = [];
  if (dominantElement) focusParts.push(`${dominantElement.key} energy`);
  if (dominantSuit) focusParts.push(`${dominantSuit.key}`);
  const focusText = focusParts.join(' and ');

  return {
    focusText,
    symbols: uniqueMatches,
    text: `Your reading leans ${focusText}. Symbols echoing this: ${uniqueMatches.join(', ')}.`
  };
}

export function getSymbolFollowUpPrompt(reading = [], themes = null) {
  const symbols = collectSymbols(reading);
  if (symbols.length === 0) return null;

  const dominantElement = themes ? getDominantEntry(themes.elementCounts) : null;
  const dominantSuit = themes ? getDominantEntry(themes.suitCounts, { minTotal: 3, minRatio: 0.5, minCount: 3 }) : null;
  const targetFamilies = [
    ...(dominantElement ? (ELEMENT_FAMILY_MAP[dominantElement.key] || []) : []),
    ...(dominantSuit ? (SUIT_FAMILY_MAP[dominantSuit.key] || []) : [])
  ];

  const candidates = targetFamilies.length > 0
    ? symbols.filter((symbol) => targetFamilies.includes(symbol.family))
    : symbols;

  if (candidates.length === 0) return null;

  const symbolCounts = new Map();
  candidates.forEach((symbol) => {
    const key = symbol.object;
    symbolCounts.set(key, (symbolCounts.get(key) || 0) + 1);
  });

  const [topSymbol] = [...symbolCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  if (!topSymbol) return null;

  return `What does the recurring ${topSymbol} symbol invite you to consider?`;
}

/**
 * Enrich a symbol with its element association
 * @param {Object} symbol - Symbol object with object/family properties
 * @returns {Object} Symbol with added element property
 */
export function enrichSymbolWithElement(symbol) {
  if (!symbol) return symbol;
  const family = symbol.family || getSymbolFamily(symbol.object);
  const element = getElementForSymbolFamily(family);
  return { ...symbol, element };
}

/**
 * Get all symbols from a reading enriched with element data
 * @param {Array} reading - Array of card objects
 * @returns {Array} Symbols with element associations
 */
export function getEnrichedSymbols(reading = []) {
  const symbols = collectSymbols(reading);
  return symbols.map(enrichSymbolWithElement);
}

/**
 * Check if a symbol matches the dominant element in a reading
 * @param {Object} symbol - Symbol object
 * @param {Object} themes - Theme analysis with elementCounts
 * @returns {boolean} True if symbol's element matches dominant element
 */
export function symbolMatchesDominantElement(symbol, themes) {
  if (!symbol || !themes?.elementCounts) return false;
  const dominantElement = getDominantEntry(themes.elementCounts);
  if (!dominantElement) return false;
  const symbolElement = getElementForSymbolFamily(symbol.family || getSymbolFamily(symbol.object));
  return symbolElement === dominantElement.key;
}

// Export the element family map for UI use
export { ELEMENT_FAMILY_MAP };

