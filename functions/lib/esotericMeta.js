const MAJOR_ARCANA_ASTRO = {
  0: {
    label: 'Air — the elemental current of Aleph',
    focus: 'inviting openness, experimentation, and trust in the unfolding journey'
  },
  1: {
    label: 'Mercury',
    focus: 'supporting skillful communication and intentional manifestation'
  },
  2: {
    label: 'Moon (astrology)',
    focus: 'drawing you toward intuition, dreams, and liminal wisdom'
  },
  3: {
    label: 'Venus',
    focus: 'celebrating fertility, creativity, and receptive abundance'
  },
  4: {
    label: 'Aries',
    focus: 'emphasizing decisive leadership, structure, and sovereign agency'
  },
  5: {
    label: 'Taurus',
    focus: 'rooting guidance in steady devotion, embodiment, and values'
  },
  6: {
    label: 'Gemini',
    focus: 'highlighting choice, dialogue, and mirrored understanding'
  },
  7: {
    label: 'Cancer',
    focus: 'centering emotional protection, belonging, and purposeful movement'
  },
  8: {
    label: 'Leo',
    focus: 'calling up heart-led courage and radiant self-expression'
  },
  9: {
    label: 'Virgo',
    focus: 'favoring discernment, service, and grounded reflection'
  },
  10: {
    label: 'Jupiter',
    focus: 'opening cycles of expansion, fortune, and recalibration'
  },
  11: {
    label: 'Libra',
    focus: 'balancing fairness, equilibrium, and relational harmony'
  },
  12: {
    label: 'Water — the elemental path of Mem',
    focus: 'guiding surrender, sacrifice, and spiritual attunement'
  },
  13: {
    label: 'Scorpio',
    focus: 'navigating profound transformation and regenerative endings'
  },
  14: {
    label: 'Sagittarius',
    focus: 'encouraging synthesis, aim, and philosophical integration'
  },
  15: {
    label: 'Capricorn',
    focus: 'confronting structures, contracts, and mastery of material bonds'
  },
  16: {
    label: 'Mars',
    focus: 'igniting sudden change, liberation, and necessary disruption'
  },
  17: {
    label: 'Aquarius',
    focus: 'channeling vision, hope, and communal renewal'
  },
  18: {
    label: 'Pisces',
    focus: 'immersing you in intuition, dreams, and mystery'
  },
  19: {
    label: 'The Sun',
    focus: 'radiating vitality, clarity, and conscious joy'
  },
  20: {
    label: 'Fire — the elemental path of Shin',
    focus: 'stirring rebirth, awakening, and spiritual callings'
  },
  21: {
    label: 'Saturn with an Earth resonance',
    focus: 'grounding completion, responsibility, and embodied wholeness'
  }
};

const MINOR_DECANS = {
  Wands: {
    Two: {
      label: 'Mars in Aries',
      focus: 'energizing bold planning and confident choice'
    },
    Three: {
      label: 'Sun in Aries',
      focus: 'illuminating momentum and visible expansion'
    },
    Four: {
      label: 'Venus in Aries',
      focus: 'warming celebration, community, and milestone anchoring'
    },
    Five: {
      label: 'Saturn in Leo',
      focus: 'testing resilience through spirited friction'
    },
    Six: {
      label: 'Jupiter in Leo',
      focus: 'rewarding leadership with recognition and support'
    },
    Seven: {
      label: 'Mars in Leo',
      focus: 'fueling courageous defense of personal vision'
    },
    Eight: {
      label: 'Mercury in Sagittarius',
      focus: 'quickening communication and swift progress'
    },
    Nine: {
      label: 'Moon in Sagittarius',
      focus: 'sustaining vigilance, intuition, and endurance'
    },
    Ten: {
      label: 'Saturn in Sagittarius',
      focus: 'asking for disciplined effort and meaningful closure'
    }
  },
  Cups: {
    Two: {
      label: 'Venus in Cancer',
      focus: 'nurturing bonds, reciprocity, and shared care'
    },
    Three: {
      label: 'Mercury in Cancer',
      focus: 'weaving heartfelt conversations and community'
    },
    Four: {
      label: 'Moon in Cancer',
      focus: 'drawing attention to interior tides and emotional safety'
    },
    Five: {
      label: 'Mars in Scorpio',
      focus: 'exposing intense feelings that crave transformation'
    },
    Six: {
      label: 'Sun in Scorpio',
      focus: 'reviving soulful loyalty, memory, and devotion'
    },
    Seven: {
      label: 'Venus in Scorpio',
      focus: 'casting alluring visions that call for discernment'
    },
    Eight: {
      label: 'Saturn in Pisces',
      focus: 'prompting sober release and spiritual maturity'
    },
    Nine: {
      label: 'Jupiter in Pisces',
      focus: 'expanding compassion, blessings, and wish fulfillment'
    },
    Ten: {
      label: 'Mars in Pisces',
      focus: 'motivating active devotion to shared dreams'
    }
  },
  Swords: {
    Two: {
      label: 'Moon in Libra',
      focus: 'seeking balanced choices through quiet reflection'
    },
    Three: {
      label: 'Saturn in Libra',
      focus: 'underscoring accountability, truth, and hard-won clarity'
    },
    Four: {
      label: 'Jupiter in Libra',
      focus: 'encouraging restorative pause and perspective'
    },
    Five: {
      label: 'Venus in Aquarius',
      focus: 'questioning alignments within communal ideals'
    },
    Six: {
      label: 'Mercury in Aquarius',
      focus: 'guiding strategic transitions into clearer mental space'
    },
    Seven: {
      label: 'Moon in Aquarius',
      focus: 'amplifying independent strategy and emotional detachment'
    },
    Eight: {
      label: 'Jupiter in Gemini',
      focus: 'magnifying mental loops that can still stretch open'
    },
    Nine: {
      label: 'Mars in Gemini',
      focus: 'stirring restless analyses that need compassionate focus'
    },
    Ten: {
      label: 'Sun in Gemini',
      focus: 'revealing full illumination after a cycle of thought concludes'
    }
  },
  Pentacles: {
    Two: {
      label: 'Jupiter in Capricorn',
      focus: 'supporting adaptable resourcefulness within structure'
    },
    Three: {
      label: 'Mars in Capricorn',
      focus: 'activating collaborative mastery through effort'
    },
    Four: {
      label: 'Sun in Capricorn',
      focus: 'spotlighting stewardship, stability, and long-term plans'
    },
    Five: {
      label: 'Mercury in Taurus',
      focus: 'calling attention to mindset shifts amid material strain'
    },
    Six: {
      label: 'Moon in Taurus',
      focus: 'encouraging reciprocal care and tangible nourishment'
    },
    Seven: {
      label: 'Saturn in Taurus',
      focus: 'highlighting patience, pruning, and deliberate progress'
    },
    Eight: {
      label: 'Sun in Virgo',
      focus: 'emphasizing craftsmanship, practice, and refinement'
    },
    Nine: {
      label: 'Venus in Virgo',
      focus: 'celebrating self-sufficiency and cultivated pleasures'
    },
    Ten: {
      label: 'Mercury in Virgo',
      focus: 'harmonizing legacy-building with practical intelligence'
    }
  }
};

const MAJOR_PATHS = {
  0: {
    label: 'Path Aleph (Kether ↔ Chokmah)',
    focus: 'channeling pure potential into first breath and awareness'
  },
  1: {
    label: 'Path Beth (Kether ↔ Binah)',
    focus: 'guiding intention to take form through focused will'
  },
  2: {
    label: 'Path Gimel (Kether ↔ Tiphareth)',
    focus: 'carrying mystery from crown to the heart-center'
  },
  3: {
    label: 'Path Daleth (Chokmah ↔ Binah)',
    focus: 'bridging electric insight with receptive understanding'
  },
  4: {
    label: 'Path Heh (Chokmah ↔ Tiphareth)',
    focus: 'seeding visionary fire into purposeful action'
  },
  5: {
    label: 'Path Vav (Chokmah ↔ Chesed)',
    focus: 'extending divine impulse into benevolent structure'
  },
  6: {
    label: 'Path Zayin (Binah ↔ Tiphareth)',
    focus: 'harmonizing discernment, choice, and soulful union'
  },
  7: {
    label: 'Path Cheth (Binah ↔ Geburah)',
    focus: 'armoring compassion with disciplined courage'
  },
  8: {
    label: 'Path Teth (Chesed ↔ Geburah)',
    focus: 'taming power through heart-centered strength'
  },
  9: {
    label: 'Path Yod (Chesed ↔ Tiphareth)',
    focus: 'refining devotion through mindful service'
  },
  10: {
    label: 'Path Kaph (Chesed ↔ Netzach)',
    focus: 'turning opportunity through the wheel of fortune'
  },
  11: {
    label: 'Path Lamed (Geburah ↔ Tiphareth)',
    focus: 'measuring balance, justice, and ethical alignment'
  },
  12: {
    label: 'Path Mem (Geburah ↔ Hod)',
    focus: 'inviting surrender that purifies perception'
  },
  13: {
    label: 'Path Nun (Tiphareth ↔ Netzach)',
    focus: 'moving lifeforce toward profound transformation'
  },
  14: {
    label: 'Path Samekh (Tiphareth ↔ Yesod)',
    focus: 'tempering experience into integrated wholeness'
  },
  15: {
    label: 'Path Ayin (Tiphareth ↔ Hod)',
    focus: 'revealing shadow attachments for mindful release'
  },
  16: {
    label: 'Path Peh (Netzach ↔ Hod)',
    focus: 'breaking open stale structures to free vitality'
  },
  17: {
    label: 'Path Tzaddi (Netzach ↔ Yesod)',
    focus: 'catching starlight inspirations for embodied hope'
  },
  18: {
    label: 'Path Qoph (Netzach ↔ Malkuth)',
    focus: 'guiding dreamscapes toward compassionate embodiment'
  },
  19: {
    label: 'Path Resh (Hod ↔ Yesod)',
    focus: 'illuminating clarity that animates the self'
  },
  20: {
    label: 'Path Shin (Hod ↔ Malkuth)',
    focus: 'sparking resurrection fire within lived reality'
  },
  21: {
    label: 'Path Tav (Yesod ↔ Malkuth)',
    focus: 'grounding spiritual insight into the physical world'
  }
};

const RANK_TO_SEPHIROTH = {
  Ace: {
    label: 'Kether — Crown',
    focus: 'pure seed potential entering this suit'
  },
  Two: {
    label: 'Chokmah — Wisdom',
    focus: 'dynamic surge of expanding energy'
  },
  Three: {
    label: 'Binah — Understanding',
    focus: 'shaping structure, pattern, and containment'
  },
  Four: {
    label: 'Chesed — Mercy',
    focus: 'stabilizing growth with generosity and order'
  },
  Five: {
    label: 'Geburah — Severity',
    focus: 'applying discernment, challenge, and recalibration'
  },
  Six: {
    label: 'Tiphareth — Beauty',
    focus: 'harmonizing the suit around its radiant heart'
  },
  Seven: {
    label: 'Netzach — Victory',
    focus: 'moving through desire, artistry, and endurance'
  },
  Eight: {
    label: 'Hod — Splendor',
    focus: 'refining intellect, craft, and communication'
  },
  Nine: {
    label: 'Yesod — Foundation',
    focus: 'coalescing the suit’s energy into lived patterns'
  },
  Ten: {
    label: 'Malkuth — Kingdom',
    focus: 'manifesting tangible results and embodiment'
  }
};

const SUIT_TO_WORLD = {
  Wands: 'Atziluth (Fire) — archetypal impulse',
  Cups: 'Briah (Water) — creative formation',
  Swords: 'Yetzirah (Air) — mental shaping',
  Pentacles: 'Assiah (Earth) — material expression'
};

const ASTRO_MINOR_PREFERRED_RANKS = new Set(['Two', 'Three', 'Six', 'Nine']);
const QABALAH_MINOR_PREFERRED_RANKS = new Set(['Ace', 'Six', 'Ten']);

const RANK_NAME_BY_VALUE = {
  1: 'Ace',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Page',
  12: 'Knight',
  13: 'Queen',
  14: 'King'
};

const SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];

function normalizeRank(rawRank) {
  if (!rawRank) return null;
  const key = rawRank.toString().trim().toLowerCase();
  switch (key) {
    case 'ace':
      return 'Ace';
    case 'two':
      return 'Two';
    case 'three':
      return 'Three';
    case 'four':
      return 'Four';
    case 'five':
      return 'Five';
    case 'six':
      return 'Six';
    case 'seven':
      return 'Seven';
    case 'eight':
      return 'Eight';
    case 'nine':
      return 'Nine';
    case 'ten':
      return 'Ten';
    case 'page':
      return 'Page';
    case 'knight':
      return 'Knight';
    case 'queen':
      return 'Queen';
    case 'king':
      return 'King';
    default:
      return null;
  }
}

function inferRankFromName(cardName) {
  if (typeof cardName !== 'string') return null;
  const parts = cardName.split(' of ');
  if (!parts[0]) return null;
  return normalizeRank(parts[0]);
}

function getRankKey(cardInfo) {
  const directRank = normalizeRank(cardInfo?.rank);
  if (directRank) return directRank;

  if (typeof cardInfo?.rankValue === 'number') {
    const mapped = RANK_NAME_BY_VALUE[cardInfo.rankValue];
    if (mapped) return mapped;
  }

  return inferRankFromName(cardInfo?.card || '');
}

function resolveSuit(cardInfo) {
  if (cardInfo?.suit) return cardInfo.suit;
  if (typeof cardInfo?.card !== 'string') return null;
  return SUITS.find(suit => cardInfo.card.includes(suit)) || null;
}

export const ASTRO_ASSOCIATIONS = {
  majors: MAJOR_ARCANA_ASTRO,
  minors: MINOR_DECANS
};

export function getAstroForCard(cardInfo = {}) {
  if (typeof cardInfo.number === 'number' && cardInfo.number >= 0 && cardInfo.number <= 21) {
    return MAJOR_ARCANA_ASTRO[cardInfo.number] || null;
  }

  const suit = resolveSuit(cardInfo);
  const rankKey = getRankKey(cardInfo);

  if (suit && rankKey && MINOR_DECANS[suit] && MINOR_DECANS[suit][rankKey]) {
    return MINOR_DECANS[suit][rankKey];
  }

  return null;
}

export const QABALAH_PATHS = {
  majors: MAJOR_PATHS,
  minors: RANK_TO_SEPHIROTH
};

export function getQabalahForCard(cardInfo = {}) {
  if (typeof cardInfo.number === 'number' && cardInfo.number >= 0 && cardInfo.number <= 21) {
    return MAJOR_PATHS[cardInfo.number] || null;
  }

  const suit = resolveSuit(cardInfo);
  const rankKey = getRankKey(cardInfo);
  const sephirothMeta = rankKey ? RANK_TO_SEPHIROTH[rankKey] : null;

  if (sephirothMeta) {
    const world = suit ? SUIT_TO_WORLD[suit] : null;
    return {
      label: sephirothMeta.label,
      focus: world ? `${sephirothMeta.focus} within ${world}` : sephirothMeta.focus
    };
  }

  return null;
}

export function shouldSurfaceAstroLens(cardInfo = {}) {
  if (typeof cardInfo.number === 'number' && cardInfo.number >= 0 && cardInfo.number <= 21) {
    return true;
  }

  const rankKey = getRankKey(cardInfo);
  return ASTRO_MINOR_PREFERRED_RANKS.has(rankKey || '');
}

export function shouldSurfaceQabalahLens(cardInfo = {}) {
  if (typeof cardInfo.number === 'number' && cardInfo.number >= 0 && cardInfo.number <= 21) {
    return true;
  }

  const rankKey = getRankKey(cardInfo);
  return QABALAH_MINOR_PREFERRED_RANKS.has(rankKey || '');
}
