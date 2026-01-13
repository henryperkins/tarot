// symbolIndex.js
// Reverse index mapping symbol names to cards where they appear
// Auto-generated structure, manually curated for semantic grouping

import { SYMBOL_ANNOTATIONS } from './symbolAnnotations.js';

/**
 * Build reverse index from symbol annotations
 * Maps normalized symbol names to array of card numbers
 */
function buildSymbolIndex() {
  const index = {};

  for (const [cardNum, cardData] of Object.entries(SYMBOL_ANNOTATIONS)) {
    if (!cardData.symbols) continue;

    for (const symbol of cardData.symbols) {
      const key = normalizeSymbolName(symbol.object);
      if (!index[key]) {
        index[key] = [];
      }
      index[key].push(parseInt(cardNum, 10));
    }
  }

  return index;
}

/**
 * Normalize symbol names for matching
 * Handles variations like "sun" vs "radiant sun with face"
 */
function normalizeSymbolName(name) {
  return name
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')  // Remove articles
    .trim();
}

/**
 * Get the base symbol type for grouping related symbols
 * e.g., "radiant sun with face" -> "sun"
 */
function getSymbolFamily(name) {
  const normalized = normalizeSymbolName(name);

  // Symbol family mappings
  const families = {
    // Celestial
    sun: ['sun', 'radiant sun', 'radiant sun with face', 'rising sun', 'sun rising'],
    moon: ['moon', 'full moon', 'full moon with face', 'crescent moon', 'lunar crown'],
    stars: ['star', 'stars', 'large star', 'seven smaller stars', 'six-pointed star'],

    // Elements
    water: ['water', 'waterfall', 'pool', 'river', 'waves', 'gentle waves', 'overflowing water'],
    fire: ['fire', 'flame', 'flames', 'torch', 'flaming debris'],
    mountains: ['mountain', 'mountains', 'mountain peak', 'mountain path'],

    // Flora
    roses: ['rose', 'roses', 'red roses', 'white rose'],
    lilies: ['lily', 'lilies', 'white lilies'],
    flowers: ['flower', 'flowers', 'sunflower', 'sunflowers', 'lotus', 'lotus blossoms'],

    // Figures
    angel: ['angel'],
    sphinx: ['sphinx', 'sphinxes'],
    lion: ['lion', 'lions', 'winged lion', 'winged lion head'],
    dog: ['dog', 'dog and wolf'],

    // Objects
    wand: ['wand', 'wands', 'sprouting wand', 'victory wand', 'defensive wand'],
    cup: ['cup', 'cups', 'chalice', 'raised cups'],
    sword: ['sword', 'swords', 'upright sword', 'crossed swords'],
    pentacle: ['pentacle', 'pentacles'],

    // Structures
    pillars: ['pillar', 'pillars'],
    tower: ['tower', 'towers', 'two towers'],
    castle: ['castle', 'distant castle', 'manor'],
    throne: ['throne', 'enthroned'],

    // Symbols
    infinity: ['infinity', 'infinity symbol'],
    scales: ['scales', 'balance'],
    crown: ['crown', 'lunar crown', 'laurel wreath'],

    // Figures/People
    figure: ['figure', 'figures', 'youth', 'child', 'rider', 'dancer'],
    hand: ['hand', 'hands', 'raised hand', 'hand from cloud'],
  };

  for (const [family, members] of Object.entries(families)) {
    if (members.some(m => normalized.includes(m) || m.includes(normalized))) {
      return family;
    }
  }

  return normalized;
}

// Card name lookup for display
const CARD_NAMES = {
  0: 'The Fool', 1: 'The Magician', 2: 'The High Priestess', 3: 'The Empress',
  4: 'The Emperor', 5: 'The Hierophant', 6: 'The Lovers', 7: 'The Chariot',
  8: 'Strength', 9: 'The Hermit', 10: 'Wheel of Fortune', 11: 'Justice',
  12: 'The Hanged Man', 13: 'Death', 14: 'Temperance', 15: 'The Devil',
  16: 'The Tower', 17: 'The Star', 18: 'The Moon', 19: 'The Sun',
  20: 'Judgement', 21: 'The World',
  // Wands
  22: 'Ace of Wands', 23: 'Two of Wands', 24: 'Three of Wands', 25: 'Four of Wands',
  26: 'Five of Wands', 27: 'Six of Wands', 28: 'Seven of Wands', 29: 'Eight of Wands',
  30: 'Nine of Wands', 31: 'Ten of Wands', 74: 'Page of Wands', 75: 'Knight of Wands',
  76: 'Queen of Wands', 77: 'King of Wands',
  // Cups
  32: 'Ace of Cups', 33: 'Two of Cups', 34: 'Three of Cups', 35: 'Four of Cups',
  36: 'Five of Cups', 37: 'Six of Cups', 38: 'Seven of Cups', 39: 'Eight of Cups',
  40: 'Nine of Cups', 41: 'Ten of Cups', 42: 'Page of Cups', 43: 'Knight of Cups',
  44: 'Queen of Cups', 45: 'King of Cups',
  // Swords
  46: 'Ace of Swords', 47: 'Two of Swords', 48: 'Three of Swords', 49: 'Four of Swords',
  50: 'Five of Swords', 51: 'Six of Swords', 52: 'Seven of Swords', 53: 'Eight of Swords',
  54: 'Nine of Swords', 55: 'Ten of Swords', 56: 'Page of Swords', 57: 'Knight of Swords',
  58: 'Queen of Swords', 59: 'King of Swords',
  // Pentacles
  60: 'Ace of Pentacles', 61: 'Two of Pentacles', 62: 'Three of Pentacles', 63: 'Four of Pentacles',
  64: 'Five of Pentacles', 65: 'Six of Pentacles', 66: 'Seven of Pentacles', 67: 'Eight of Pentacles',
  68: 'Nine of Pentacles', 69: 'Ten of Pentacles', 70: 'Page of Pentacles', 71: 'Knight of Pentacles',
  72: 'Queen of Pentacles', 73: 'King of Pentacles',
};

/**
 * Find other cards that share this symbol or a related symbol
 * @param {string} symbolName - The symbol to search for
 * @param {number} excludeCard - Card number to exclude (the current card)
 * @param {number} limit - Maximum number of related cards to return
 * @returns {Array<{cardNumber: number, cardName: string, symbolName: string}>}
 */
export function findRelatedCards(symbolName, excludeCard, limit = 4) {
  const family = getSymbolFamily(symbolName);
  const index = buildSymbolIndex();
  const related = [];
  const seen = new Set();

  // First, find exact matches
  for (const [indexedSymbol, cardNumbers] of Object.entries(index)) {
    if (getSymbolFamily(indexedSymbol) === family) {
      for (const cardNum of cardNumbers) {
        if (cardNum !== excludeCard && !seen.has(cardNum)) {
          seen.add(cardNum);
          related.push({
            cardNumber: cardNum,
            cardName: CARD_NAMES[cardNum] || `Card ${cardNum}`,
            symbolName: indexedSymbol
          });
        }
      }
    }
  }

  // Sort by card number (Major Arcana first, then suits)
  related.sort((a, b) => {
    // Major Arcana (0-21) first
    const aIsMajor = a.cardNumber <= 21;
    const bIsMajor = b.cardNumber <= 21;
    if (aIsMajor && !bIsMajor) return -1;
    if (!aIsMajor && bIsMajor) return 1;
    return a.cardNumber - b.cardNumber;
  });

  return related.slice(0, limit);
}

/**
 * Get card name by number
 */
export function getCardName(cardNumber) {
  return CARD_NAMES[cardNumber] || `Card ${cardNumber}`;
}

// Export the index builder for debugging/testing
export { buildSymbolIndex, getSymbolFamily, normalizeSymbolName };
