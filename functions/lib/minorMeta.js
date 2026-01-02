// functions/lib/minorMeta.js
// Shared Minor Arcana metadata + helpers.
// Intentionally aligned with src/data/minorArcana.js and narrative tone guidelines.

export const SUIT_THEMES = {
  Wands:
    'fire, initiative, creativity, desire, and the way you act on your will',
  Cups:
    'water, emotions, relationships, intuition, and how you give and receive care',
  Swords:
    'air, mind, truth, communication, and how you navigate tension or clarity',
  Pentacles:
    'earth, body, work, resources, and the material structures that support you'
};

export const PIP_NUMEROLOGY = {
  1: 'a seed or new spark of this suit’s energy, raw potential and beginnings',
  2: 'duality, choices, early tension or balance within this suit’s themes',
  3: 'growth, first stability, collaboration, and visible development',
  4: 'foundation, consolidation, stability that can comfort or confine',
  5: 'conflict, disruption, tests that stress the pattern and demand adjustment',
  6: 'recognition, victory, and public acknowledgment',
  7: 'assessment, testing, deeper questions about direction and alignment',
  8: 'dedication, focused work, sustained effort in this suit’s domain',
  9: 'fruition, culmination near completion, self-sufficiency in this area',
  10: 'peak expression, legacy, long-term consequence of the suit’s journey'
};

export const COURT_ARCHETYPES = {
  Page:
    'a student or messenger of this suit—curiosity, signals, early expressions of this energy, often within you',
  Knight:
    'movement and pursuit in this suit—how you or another actively chase, defend, or embody this energy',
  Queen:
    'mature, receptive mastery of this suit—embodied wisdom, emotional intelligence, stewardship from within',
  King:
    'mature, directive mastery of this suit—visible leadership, structure, and accountability in this area'
};

export function parseMinorName(name) {
  if (!name || typeof name !== 'string') return null;
  const match = name.match(
    /^\s*([A-Za-z]+)\s+of\s+(Wands|Cups|Swords|Pentacles)\s*$/i
  );
  if (!match) return null;
  const [, rawRank, rawSuit] = match;

  const suitMap = {
    wands: 'Wands',
    cups: 'Cups',
    swords: 'Swords',
    pentacles: 'Pentacles'
  };
  const suit = suitMap[String(rawSuit).toLowerCase()];
  if (!suit) return null;

  const rank = String(rawRank).slice(0, 1).toUpperCase() + String(rawRank).slice(1).toLowerCase();
  return { rank, suit };
}

// Normalize a card-like object into structured Minor context if applicable.
export function getMinorContext(cardLike = {}) {
  const rawName = cardLike.card || cardLike.name;

  let suit = cardLike.suit;
  let rank = cardLike.rank;

  if ((!suit || !rank) && rawName) {
    const parsed = parseMinorName(rawName);
    if (parsed) {
      rank = rank || parsed.rank;
      suit = suit || parsed.suit;
    }
  }

  if (!suit || !rank) return null;

  const isCourt = ['Page', 'Knight', 'Queen', 'King'].includes(rank);

  const pipValues = {
    Ace: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5,
    Six: 6,
    Seven: 7,
    Eight: 8,
    Nine: 9,
    Ten: 10
  };

  const courtValues = {
    Page: 11,
    Knight: 12,
    Queen: 13,
    King: 14
  };

  const inferredRankValue = isCourt
    ? courtValues[rank]
    : pipValues[rank];

  const rankValue =
    typeof cardLike.rankValue === 'number'
      ? cardLike.rankValue
      : inferredRankValue;

  return {
    suit,
    rank,
    isCourt,
    rankValue,
    suitTheme: SUIT_THEMES[suit],
    pipTheme:
      !isCourt && typeof rankValue === 'number'
        ? PIP_NUMEROLOGY[rankValue]
        : undefined,
    courtTheme: isCourt ? COURT_ARCHETYPES[rank] : undefined
  };
}

// Build a concise narrative summary for a Minor Arcana card.
// Intentionally neutral, reflective, and non-deterministic in tone.
export function buildMinorSummary(cardLike = {}) {
  const ctx = getMinorContext(cardLike);
  if (!ctx) return '';

  const bits = [];

  if (ctx.suitTheme) {
    bits.push(
      `As a ${ctx.suit} card, this speaks to ${ctx.suitTheme}.`
    );
  }

  if (ctx.isCourt && ctx.courtTheme) {
    bits.push(
      `As a ${ctx.rank}, it highlights ${ctx.courtTheme}.`
    );
  } else if (ctx.pipTheme) {
    bits.push(
      `At this rank, it marks ${ctx.pipTheme}.`
    );
  }

  return bits.join(' ');
}
