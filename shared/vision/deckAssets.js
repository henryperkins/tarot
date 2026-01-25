import { THOTH_MINOR_TITLES as THOTH_MINOR_TITLE_DETAILS } from './thothMinorTitles.js';

export const THOTH_MAJOR_ALIASES = {
  0: 'The Fool',
  1: 'The Magus',
  2: 'The Priestess',
  3: 'The Empress',
  4: 'The Emperor',
  5: 'The Hierophant',
  6: 'The Lovers',
  7: 'The Chariot',
  8: 'Adjustment',
  9: 'The Hermit',
  10: 'Fortune',
  11: 'Lust',
  12: 'The Hanged Man',
  13: 'Death',
  14: 'Art',
  15: 'The Devil',
  16: 'The Tower',
  17: 'The Star',
  18: 'The Moon',
  19: 'The Sun',
  20: 'The Aeon',
  21: 'The Universe'
};

const ROOT_TITLE_PREFIX = 'Root of the Powers of ';
const ROOT_TITLE_SHORT_PREFIX = 'Root of ';

const getShortThothTitle = (entry) => {
  if (!entry?.title) return entry?.title;
  if (entry.rank === 1 && entry.title.startsWith(ROOT_TITLE_PREFIX)) {
    return `${ROOT_TITLE_SHORT_PREFIX}${entry.title.slice(ROOT_TITLE_PREFIX.length)}`;
  }
  return entry.title;
};

export const THOTH_MINOR_TITLES = Object.values(THOTH_MINOR_TITLE_DETAILS).reduce(
  (acc, entry) => {
    if (!entry?.suit || typeof entry.rank !== 'number') {
      return acc;
    }
    if (!acc[entry.suit]) {
      acc[entry.suit] = {};
    }
    acc[entry.suit][entry.rank] = getShortThothTitle(entry);
    return acc;
  },
  {}
);

export const THOTH_SUIT_ALIASES = {
  Pentacles: 'Disks',
  Wands: 'Wands',
  Cups: 'Cups',
  Swords: 'Swords'
};

export const THOTH_COURT_ALIASES = {
  Page: 'Princess',
  Knight: 'Prince',
  Queen: 'Queen',
  King: 'Knight'
};

const THOTH_RANK_LABELS = {
  1: 'Ace',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten'
};

export const MARSEILLE_MAJOR_ALIASES = {
  0: 'Le Mat',
  1: 'Le Bateleur',
  2: 'La Papesse',
  3: "L'Imperatrice",
  4: "L'Empereur",
  5: 'Le Pape',
  6: "L'Amoureux",
  7: 'Le Chariot',
  8: 'La Justice',
  9: "L'Hermite",
 10: 'La Roue de Fortune',
 11: 'La Force',
 12: 'Le Pendu',
 13: 'La Mort',
 14: 'Temperance',
 15: 'Le Diable',
 16: 'La Maison Dieu',
 17: "L'Etoile",
 18: 'La Lune',
 19: 'Le Soleil',
 20: 'Le Jugement',
 21: 'Le Monde'
};

const MARSEILLE_SUIT_PREFIX = {
  Wands: 'clubs',
  Cups: 'cups',
  Swords: 'swords',
  Pentacles: 'coins'
};

export const MARSEILLE_SUIT_ALIASES = {
  Wands: 'Batons',
  Cups: 'Coupes',
  Swords: 'Epees',
  Pentacles: 'Coins'
};

export const MARSEILLE_COURT_ALIASES = {
  Page: 'Valet',
  Knight: 'Chevalier',
  Queen: 'Reine',
  King: 'Roi'
};

const slugify = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const pad2 = (value) => String(value ?? '').padStart(2, '0');

function buildThothMinorAlias(card) {
  const suitTitles = THOTH_MINOR_TITLES[card?.suit];
  if (!suitTitles || typeof card?.rankValue !== 'number') {
    return card?.name || 'Unknown card';
  }
  const suitAlias = THOTH_SUIT_ALIASES[card.suit] || card.suit;
  if (card.rankValue >= 11) {
    const baseRank = { 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King' }[card.rankValue];
    const aliasRank = THOTH_COURT_ALIASES[baseRank] || baseRank || 'Court';
    return `${aliasRank} of ${suitAlias}`;
  }
  const rankLabel = THOTH_RANK_LABELS[card.rankValue] || card.rank;
  const epithet = suitTitles[card.rankValue];
  if (epithet) {
    return `${epithet} (${rankLabel} of ${suitAlias})`;
  }
  return `${rankLabel} of ${suitAlias}`;
}

export function getThothAlias(card) {
  if (typeof card?.number === 'number') {
    return THOTH_MAJOR_ALIASES[card.number] || card?.name || 'Major Arcana';
  }
  return buildThothMinorAlias(card);
}

export function getThothImagePath(card) {
  if (typeof card?.number === 'number') {
    const alias = getThothAlias(card);
    return `/images/cards/thoth/thoth_major_${pad2(card.number)}_${slugify(alias)}.png`;
  }
  if (!card?.suit || typeof card?.rankValue !== 'number') {
    return null;
  }
  const suitAlias = (THOTH_SUIT_ALIASES[card.suit] || card.suit).toLowerCase();
  if (card.rankValue >= 11) {
    const baseRank = { 11: 'Page', 12: 'Knight', 13: 'Queen', 14: 'King' }[card.rankValue];
    const aliasRank = THOTH_COURT_ALIASES[baseRank] || baseRank || 'Court';
    return `/images/cards/thoth/thoth_${suitAlias}_${pad2(card.rankValue)}_${slugify(
      `${aliasRank}-${suitAlias}`
    )}.png`;
  }
  const rankLabel = THOTH_RANK_LABELS[card.rankValue] || card.rank || card.rankValue;
  const epithet = THOTH_MINOR_TITLES[card.suit]?.[card.rankValue];
  const slugSource = epithet ? `${rankLabel}-${suitAlias}-${epithet}` : `${rankLabel}-${suitAlias}`;
  return `/images/cards/thoth/thoth_${suitAlias}_${pad2(card.rankValue)}_${slugify(slugSource)}.png`;
}

export function getMarseilleAlias(card) {
  if (typeof card?.number === 'number') {
    const alias = MARSEILLE_MAJOR_ALIASES[card.number];
    if (alias) {
      return card?.name && card.name !== alias ? `${alias} (RWS: ${card.name})` : alias;
    }
  }
  if (card?.suit && card?.rank) {
    const suitAlias = MARSEILLE_SUIT_ALIASES[card.suit] || card.suit;
    const rankAlias = MARSEILLE_COURT_ALIASES[card.rank] || card.rank;
    const label = `${rankAlias} of ${suitAlias}`;
    if (card?.name && card.name !== label) {
      return `${label} (RWS: ${card.name})`;
    }
    return label;
  }
  return card?.name || 'Tarot de Marseille card';
}

export function getMarseilleImagePath(card) {
  if (typeof card?.number === 'number') {
    return `/images/cards/marseille/major${pad2(card.number)}.jpg`;
  }
  if (!card?.suit || typeof card?.rankValue !== 'number') {
    return null;
  }
  const prefix = MARSEILLE_SUIT_PREFIX[card.suit];
  if (!prefix) return null;
  return `/images/cards/marseille/${prefix}${pad2(card.rankValue)}.jpg`;
}

export function getDeckAlias(card, deckId) {
  if (deckId === 'thoth-a1') {
    return getThothAlias(card);
  }
  if (deckId === 'marseille-classic') {
    return getMarseilleAlias(card);
  }
  return card?.name || 'Tarot card';
}

export function getDeckImagePath(card, deckId) {
  if (deckId === 'thoth-a1') {
    return getThothImagePath(card);
  }
  if (deckId === 'marseille-classic') {
    return getMarseilleImagePath(card);
  }
  return card?.image || null;
}

export function getDeckSuitAlias(suit, deckId) {
  if (!suit) return suit;
  if (deckId === 'thoth-a1') {
    return THOTH_SUIT_ALIASES[suit] || suit;
  }
  if (deckId === 'marseille-classic') {
    return MARSEILLE_SUIT_ALIASES[suit] || suit;
  }
  return suit;
}

export function getDeckCourtAlias(rank, deckId) {
  if (!rank) return rank;
  if (deckId === 'thoth-a1') {
    return THOTH_COURT_ALIASES[rank] || rank;
  }
  if (deckId === 'marseille-classic') {
    return MARSEILLE_COURT_ALIASES[rank] || rank;
  }
  return rank;
}
