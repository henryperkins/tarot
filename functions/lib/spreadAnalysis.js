/**
 * Spread Analysis Library
 *
 * Canonical server-side analysis engine.
 *
 * Responsibilities:
 * - Elemental correspondences and dignities
 * - Theme analysis (suits, elements, reversals)
 * - Spread-specific structural analysis
 * - Relationships and positional notes for UI + narrative consumers
 *
 * Output from this module is the single source of truth for:
 * - AI prompting (narrativeBuilder)
 * - Frontend Spread Highlights (via /api/tarot-reading spreadAnalysis)
 */

import { parseMinorName } from './minorMeta.js';

/**
 * Traditional elemental correspondences for Major Arcana
 * Based on Golden Dawn / Rider-Waite-Smith astrological associations
 */
export const MAJOR_ELEMENTS = {
  0: 'Air',      // The Fool (Aleph / elemental Air current)
  1: 'Air',      // The Magician (Mercury)
  2: 'Water',    // The High Priestess (Moon)
  3: 'Earth',    // The Empress (Venus)
  4: 'Fire',     // The Emperor (Aries)
  5: 'Earth',    // The Hierophant (Taurus)
  6: 'Air',      // The Lovers (Gemini)
  7: 'Water',    // The Chariot (Cancer)
  8: 'Fire',     // Strength (Leo)
  9: 'Earth',    // The Hermit (Virgo)
  10: 'Fire',    // Wheel of Fortune (Jupiter)
  11: 'Air',     // Justice (Libra)
  12: 'Water',   // The Hanged Man (Mem / elemental Water current)
  13: 'Water',   // Death (Scorpio)
  14: 'Fire',    // Temperance (Sagittarius)
  15: 'Earth',   // The Devil (Capricorn)
  16: 'Fire',    // The Tower (Mars)
  17: 'Air',     // The Star (Aquarius)
  18: 'Water',   // The Moon (Pisces)
  19: 'Fire',    // The Sun (Sun)
  20: 'Fire',    // Judgement (Shin / elemental Fire current)
  21: 'Earth'    // The World (Saturn)
};

/**
 * Suit to element mapping (standard)
 */
export const SUIT_ELEMENTS = {
  'Wands': 'Fire',
  'Cups': 'Water',
  'Swords': 'Air',
  'Pentacles': 'Earth'
};

const SUIT_ALIASES = {
  wands: 'Wands',
  wand: 'Wands',
  batons: 'Wands',
  baton: 'Wands',
  staves: 'Wands',
  staffs: 'Wands',
  clubs: 'Wands',
  cups: 'Cups',
  cup: 'Cups',
  coupes: 'Cups',
  chalices: 'Cups',
  swords: 'Swords',
  sword: 'Swords',
  epees: 'Swords',
  epee: 'Swords',
  blades: 'Swords',
  pentacles: 'Pentacles',
  pentacle: 'Pentacles',
  coins: 'Pentacles',
  coin: 'Pentacles',
  deniers: 'Pentacles',
  denier: 'Pentacles',
  disks: 'Pentacles',
  discs: 'Pentacles',
  disques: 'Pentacles'
};

function normalizeSuitToken(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();
}

function normalizeSuitName(value) {
  if (typeof value !== 'string') return null;
  if (SUIT_ELEMENTS[value]) return value;
  const key = normalizeSuitToken(value);
  return SUIT_ALIASES[key] || null;
}

function normalizeCardNumber(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getCardNumber(cardInfo) {
  if (!cardInfo || typeof cardInfo !== 'object') {
    return null;
  }
  const fromNumber = normalizeCardNumber(cardInfo.number);
  if (fromNumber !== null) {
    return fromNumber;
  }
  const fromCamel = normalizeCardNumber(cardInfo.cardNumber);
  if (fromCamel !== null) {
    return fromCamel;
  }
  return normalizeCardNumber(cardInfo.card_number);
}

function resolveMinorSuit(cardName, cardSuit) {
  const normalizedCardSuit = normalizeSuitName(cardSuit);
  if (normalizedCardSuit) {
    return normalizedCardSuit;
  }

  if (typeof cardName === 'string') {
    const parsed = parseMinorName(cardName);
    if (parsed?.suit) {
      return parsed.suit;
    }

    const lowerName = cardName.toLowerCase();
    const normalizedName = normalizeSuitToken(lowerName);
    for (const suit of Object.keys(SUIT_ELEMENTS)) {
      if (lowerName.includes(suit.toLowerCase())) {
        return suit;
      }
    }

    // Handle deck aliases that don't include canonical suit names.
    for (const [token, suit] of Object.entries(SUIT_ALIASES)) {
      if (normalizedName.includes(token)) {
        return suit;
      }
    }
  }

  return null;
}

function isMajorArcanaCard(cardName, cardNumber, cardSuit) {
  const minorSuit = resolveMinorSuit(cardName, cardSuit);
  if (minorSuit) {
    return false;
  }

  const normalizedCardNumber = normalizeCardNumber(cardNumber);
  return normalizedCardNumber !== null && normalizedCardNumber >= 0 && normalizedCardNumber <= 21;
}

/**
 * Elemental relationship definitions
 * Used for consistent dignity analysis across the module
 */
const ELEMENTAL_RELATIONSHIPS = {
  // Supportive pairs (active or receptive energies work together)
  supportive: [
    'Fire-Air', 'Air-Fire',
    'Water-Earth', 'Earth-Water'
  ],
  // Tension pairs (opposing qualities create friction)
  tension: [
    'Fire-Water', 'Water-Fire',
    'Air-Earth', 'Earth-Air'
  ],
  // Neutral pairs (neither strongly supportive nor tense)
  neutral: [
    'Fire-Earth', 'Earth-Fire',
    'Air-Water', 'Water-Air'
  ]
};

/**
 * Get elemental correspondence for any card
 *
 * @param {string} cardName - Full card name (e.g., "Three of Wands", "The Fool")
 * @param {number} [cardNumber] - Card number (0-21 for Majors)
 * @param {string} [cardSuit] - Card suit for Minor Arcana
 * @returns {string|null} Element name or null if not determinable
 */
export function getCardElement(cardName, cardNumber, cardSuit) {
  // Minor Arcana should take precedence when suit information is present.
  const minorSuit = resolveMinorSuit(cardName, cardSuit);
  if (minorSuit) {
    return SUIT_ELEMENTS[minorSuit] || null;
  }

  // Major Arcana (0-21) only when card cannot be identified as Minor Arcana.
  const normalizedCardNumber = normalizeCardNumber(cardNumber);
  if (isMajorArcanaCard(cardName, normalizedCardNumber, cardSuit)) {
    return MAJOR_ELEMENTS[normalizedCardNumber] || null;
  }

  return null;
}

/**
 * Analyze elemental dignity (interaction between two cards)
 *
 * Traditional elemental dignities:
 * - Fire & Air support each other (active energies)
 * - Water & Earth support each other (receptive energies)
 * - Fire & Water create tension (steam/conflict)
 * - Air & Earth create tension (scattered vs grounded)
 * - Fire & Earth are neutral (neither strongly aligned nor opposed)
 * - Air & Water are neutral (neither strongly aligned nor opposed)
 * - Same element amplifies
 *
 * @param {Object} card1 - First card object with card name and number
 * @param {Object} card2 - Second card object with card name and number
 * @returns {Object} Elemental relationship analysis with:
 *   - relationship: 'amplified' | 'supportive' | 'tension' | 'neutral'
 *   - element/elements: The element(s) involved
 *   - description: Prose description of the elemental dynamic
 *
 * NOTE: For sensory imagery descriptions of elemental relationships,
 * see getElementalImagery() in imageryHooks.js, which provides
 * metaphorical language (e.g., "Steam rises where fire meets water")
 * for use in narrative prompts and reading generation.
 */
export function analyzeElementalDignity(card1, card2) {
  if (!card1 || !card2) {
    return {
      relationship: 'neutral',
      elements: null,
      description: null
    };
  }

  const e1 = getCardElement(card1.card || '', getCardNumber(card1), card1.suit);
  const e2 = getCardElement(card2.card || '', getCardNumber(card2), card2.suit);

  if (!e1 || !e2) {
    return {
      relationship: 'neutral',
      elements: null,
      description: null
    };
  }

  // Same element - amplification
  if (e1 === e2) {
    return {
      relationship: 'amplified',
      element: e1,
      elements: [e1, e2],
      description: `Both ${e1} cards reinforce and intensify this elemental energy`
    };
  }

  const pair = `${e1}-${e2}`;

  // Supportive combinations (active or receptive pairs)
  if (ELEMENTAL_RELATIONSHIPS.supportive.includes(pair)) {
    return {
      relationship: 'supportive',
      elements: [e1, e2],
      description: `${e1} and ${e2} work harmoniously together, each supporting the other's expression`
    };
  }

  // Tension combinations (opposing qualities)
  if (ELEMENTAL_RELATIONSHIPS.tension.includes(pair)) {
    return {
      relationship: 'tension',
      elements: [e1, e2],
      description: `${e1} and ${e2} create friction that must be balanced and integrated`
    };
  }

  // Neutral combinations (diagonal elements)
  if (ELEMENTAL_RELATIONSHIPS.neutral.includes(pair)) {
    return {
      relationship: 'neutral',
      elements: [e1, e2],
      description: `${e1} and ${e2} operate independently, neither reinforcing nor opposing each other`
    };
  }

  // Fallback (should not reach here with complete relationship definitions)
  return {
    relationship: 'neutral',
    elements: [e1, e2],
    description: null
  };
}

/**
 * Analyze themes across entire spread
 * Detects suit dominance, elemental balance, Major density, reversal patterns
 *
 * @param {Array} cardsInfo - Array of card objects with card, number, orientation properties
 * @param {Object} [options] - Analysis options
 * @param {string} [options.deckStyle='rws-1909'] - Deck style identifier
 * @param {string} [options.reversalFrameworkOverride] - Force specific reversal framework
 * @param {boolean} [options.enableKnowledgeGraph=true] - Enable knowledge graph pattern detection
 * @param {Object} [options.env] - Environment object for Workers (used for feature flags)
 * @returns {Promise<Object>} Theme analysis results
 */
export async function analyzeSpreadThemes(cardsInfo, options = {}) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return {
      deckStyle: options.deckStyle || 'rws-1909',
      suitCounts: { Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 },
      dominantSuit: null,
      suitFocus: null,
      elementCounts: { Fire: 0, Water: 0, Air: 0, Earth: 0 },
      dominantElement: null,
      elementalBalance: 'No elemental data available.',
      majorCount: 0,
      majorRatio: 0,
      archetypeLevel: 'normal',
      archetypeDescription: 'Primarily Minor Arcana, focusing on practical, day-to-day dynamics and immediate concerns.',
      reversalCount: 0,
      reversalRatio: 0,
      reversalFramework: 'none',
      reversalDescription: REVERSAL_FRAMEWORKS.none,
      averageNumber: null,
      lifecycleStage: null,
      timingProfile: null,
      knowledgeGraph: null
    };
  }

  const deckStyle = options.deckStyle || 'rws-1909';
  const normalizedCards = cardsInfo.map((card) => {
    if (!card || typeof card !== 'object') {
      return card;
    }
    const number = getCardNumber(card);
    if (number === null) {
      return card;
    }
    return { ...card, number };
  });
  const suitCounts = { Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 };
  const elementCounts = { Fire: 0, Water: 0, Air: 0, Earth: 0 };
  let majorCount = 0;
  let reversalCount = 0;
  const numbers = [];

  normalizedCards.forEach(card => {
    if (!card) return;

    // Count Major Arcana cards
    if (isMajorArcanaCard(card.card, card.number, card.suit)) {
      majorCount++;
    }

    // Count suits (alias-aware for deck variants).
    const resolvedSuit = resolveMinorSuit(card.card, card.suit);
    if (resolvedSuit && suitCounts[resolvedSuit] !== undefined) {
      suitCounts[resolvedSuit]++;
    }

    // Count elements
    const element = getCardElement(card.card, card.number, card.suit);
    if (element && elementCounts[element] !== undefined) {
      elementCounts[element]++;
    }

    // Count reversals (normalized to handle any casing/variants)
    const orientation = String(card.orientation || '').toLowerCase();
    if (orientation === 'reversed') {
      reversalCount++;
    }

    // Collect numbers for lifecycle analysis
    if (typeof card.number === 'number') {
      numbers.push(card.number);
    }
  });

  const totalCards = normalizedCards.length;
  const reversalRatio = totalCards > 0 ? reversalCount / totalCards : 0;
  const majorRatio = totalCards > 0 ? majorCount / totalCards : 0;

  // Find dominant suit
  const sortedSuitEntries = Object.entries(suitCounts)
    .sort((a, b) => b[1] - a[1]);
  const dominantSuitEntry = sortedSuitEntries[0] || [null, 0];
  const secondSuitEntry = sortedSuitEntries[1] || [null, 0];

  // Find dominant element
  const dominantElementEntry = Object.entries(elementCounts)
    .sort((a, b) => b[1] - a[1])[0] || [null, 0];

  // Calculate average card number
  const avgNumber = numbers.length > 0
    ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length
    : null;

  // Select reversal framework (allow explicit override)
  let reversalFramework = selectReversalFramework(reversalRatio, normalizedCards, {
    userQuestion: options.userQuestion
  });
  if (options.reversalFrameworkOverride && REVERSAL_FRAMEWORKS[options.reversalFrameworkOverride]) {
    reversalFramework = options.reversalFrameworkOverride;
  }

  const themes = {
    deckStyle,
    // Suit analysis
    suitCounts,
    dominantSuit: dominantSuitEntry[1] > 0 ? dominantSuitEntry[0] : null,
    suitFocus: getSuitFocusDescription({
      top: dominantSuitEntry,
      second: secondSuitEntry
    }),

    // Elemental analysis
    elementCounts,
    dominantElement: dominantElementEntry[1] > 0 ? dominantElementEntry[0] : null,
    elementalBalance: getMajorAwareElementalBalanceDescription({
      elementCounts,
      totalCards,
      majorRatio
    }),

    // Major Arcana analysis
    majorCount,
    majorRatio,
    archetypeLevel: majorRatio >= 0.5 ? 'high' : majorRatio >= 0.3 ? 'moderate' : 'normal',
    archetypeDescription: getArchetypeDescription(majorRatio),

    // Reversal analysis
    reversalCount,
    reversalRatio,
    reversalFramework,
    reversalDescription: getReversalFrameworkDescription(reversalFramework),

    // Lifecycle/numerology
    averageNumber: avgNumber,
    lifecycleStage: getLifecycleStage(avgNumber),

    // Timing profile (set below)
    timingProfile: null,

    // Knowledge graph (set below if enabled)
    knowledgeGraph: null
  };

  // Soft timing profile (non-deterministic pacing hint)
  try {
    const { getSpreadTimingProfile } = await import('./timingMeta.js');
    themes.timingProfile = getSpreadTimingProfile({ cardsInfo: normalizedCards, themes });
  } catch {
    // Graceful degradation: timing profile unavailable
    themes.timingProfile = null;
  }

  // Knowledge Graph pattern detection (archetypal triads, Fool's Journey, dyads)
  const enableKG = options.enableKnowledgeGraph !== false;

  if (enableKG) {
    try {
      const { isGraphRAGEnabled, retrievePassages } = await import('./graphRAG.js');
      const KG_ENABLED = isGraphRAGEnabled(options.env);

      if (KG_ENABLED) {
        const { buildGraphContext } = await import('./graphContext.js');
        const graphContext = buildGraphContext(normalizedCards, { deckStyle });

        if (graphContext) {
          themes.knowledgeGraph = graphContext;

          // Retrieve passages for frontend display
          const passages = retrievePassages(graphContext.graphKeys, {
            maxPassages: 5,
            includeMetadata: true
          });
          themes.knowledgeGraph.retrievedPassages = passages;
        }
      }
    } catch (err) {
      console.error('Knowledge graph detection failed:', err);
      // Graceful degradation: continue without patterns
      themes.knowledgeGraph = null;
    }
  }

  return themes;
}

/**
 * Select appropriate reversal interpretation framework based on patterns
 *
 * @param {number} ratio - Ratio of reversed cards (0-1)
 * @param {Array} cardsInfo - Card array for pattern detection
 * @param {Object} [options] - Additional context
 * @param {string} [options.userQuestion] - User's question for intent detection
 * @returns {string} Framework key
 */
export function selectReversalFramework(ratio, cardsInfo, options = {}) {
  if (ratio === 0) return 'none';

  const { userQuestion } = options;

  if (userQuestion) {
    const q = userQuestion.toLowerCase();
    const shadowKeywords = [
      'afraid',
      'avoid',
      'fear',
      'shadow',
      'hidden',
      'deny',
      'repress',
      'shame',
      'guilt',
      'trigger'
    ];
    const mirrorKeywords = [
      'reflect',
      'mirror',
      'project',
      'attract',
      'pattern',
      'repeat',
      'always'
    ];
    const potentialPatterns = [
      /\bpotential\b/,
      /\btalent\b/,
      /\bgift(?:s)?\b/,
      /\bdormant\b/,
      /\buntapped\b/,
      /\bhidden potential\b/,
      /\bcapable of more\b/,
      /\bunderused\b/
    ];

    if (shadowKeywords.some(kw => q.includes(kw))) {
      return 'shadow';
    }
    if (mirrorKeywords.some(kw => q.includes(kw))) {
      return 'mirror';
    }
    if (potentialPatterns.some((pattern) => pattern.test(q))) {
      return 'potentialBlocked';
    }
  }

  // Calculate spread size for threshold adjustments
  const totalCards = Array.isArray(cardsInfo) ? cardsInfo.length : 0;
  const reversalCount = totalCards > 0 ? Math.round(ratio * totalCards) : 0;

  // Check for reversed Major Arcana pattern
  if (Array.isArray(cardsInfo)) {
    const reversedMajors = cardsInfo.filter(
      c =>
        c &&
        (c.orientation || '').toLowerCase() === 'reversed' &&
        isMajorArcanaCard(c.card, getCardNumber(c), c.suit)
    );
    if (reversedMajors.length >= 2) {
      return 'potentialBlocked';
    }
  }

  // Spread-aware thresholds: Small spreads (≤5 cards) need adjusted thresholds
  // because 2/3 = 67% would immediately trigger "blocked" which is too aggressive.
  // For small spreads, require higher absolute counts to trigger stronger frameworks.
  if (totalCards > 0 && totalCards <= 5) {
    // Small spread adjustments:
    // - 'blocked' requires 3+ reversals (impossible in 3-card, rare in 5-card)
    // - 'internalized' requires 2+ reversals with ratio >= 0.5
    // - Otherwise use softer frameworks for more nuanced interpretation
    if (reversalCount >= 3) return 'blocked';
    if (reversalCount >= 2 && ratio >= 0.5) return 'internalized';
    if (reversalCount >= 2) return 'delayed';
    if (reversalCount >= 1) return 'contextual';
    return 'contextual';
  }

  // Standard thresholds for larger spreads (6+ cards)
  if (ratio >= 0.6) return 'blocked';
  if (ratio >= 0.4) return 'internalized';
  if (ratio >= 0.2) return 'delayed';
  return 'contextual';
}

/**
 * Reversal framework definitions
 */
export const REVERSAL_FRAMEWORKS = {
  none: {
    name: 'All Upright',
    description: 'All cards appear upright, showing energies flowing freely and directly.',
    guidance: 'Read each card\'s traditional upright meaning in the context of its position.',
    examples: {}
  },
  blocked: {
    name: 'Blocked Energy',
    description: 'Reversed cards show energies present but meeting resistance, obstacles, or internal barriers.',
    guidance: 'Interpret reversals as the same energy encountering blockage that must be addressed before progress.',
    examples: {
      'The Magician': 'Skills and resources are present but meeting external obstacles or internal resistance preventing manifestation',
      'The Chariot': 'Drive and determination exist but are stalled by conflicting priorities or external forces',
      'Three of Pentacles': 'Collaborative work blocked by miscommunication, lack of recognition, or organizational barriers',
      'Eight of Wands': 'Swift momentum halted by delays, bureaucracy, or logistical obstacles requiring patience'
    }
  },
  delayed: {
    name: 'Delayed Timing',
    description: 'Reversed cards indicate timing is not yet ripe; patience and preparation are needed.',
    guidance: 'Read reversals as energies that will manifest later, after certain conditions are met.',
    examples: {
      'The Star': 'Hope and renewal are coming, but the full restoration requires more time and gentle tending',
      'The Sun': 'Success and clarity will arrive after necessary groundwork is complete',
      'Ace of Wands': 'New creative spark is forming but needs incubation before launching externally',
      'Two of Cups': 'Partnership or connection is developing beneath the surface, not yet ready for full expression'
    }
  },
  internalized: {
    name: 'Internal Processing',
    description: 'Reversed cards point to inner work, private processing, and energies working beneath the surface.',
    guidance: 'Interpret reversals as the same themes playing out in the inner world rather than external events.',
    examples: {
      'The Hermit': 'Solitude and reflection happening in private contemplation rather than visible retreat',
      'Justice': 'Seeking inner fairness and self-accountability before external resolution',
      'Five of Cups': 'Grief and loss being processed quietly within, not yet shared or externalized',
      'Knight of Swords': 'Mental clarity and decisiveness operating in internal dialogue and planning'
    }
  },
  contextual: {
    name: 'Context-Dependent',
    description: 'Reversed cards are interpreted individually based on their unique position and relationships.',
    guidance: 'Read each reversal according to what makes most sense for that specific card and position.',
    examples: {
      'The Tower': 'In Challenge position: Avoiding necessary change; in Advice: Transform gradually vs suddenly',
      'The Devil': 'In Subconscious: Releasing limiting beliefs; in External: Others\' attachments affecting you',
      'Seven of Swords': 'In Past: Previous deception being revealed; in Advice: Straightforward honesty needed now',
      'Ten of Pentacles': 'In Outcome: Legacy work still developing; in Hopes/Fears: Ambivalence about stability vs freedom'
    }
  },
  shadow: {
    name: 'Shadow Integration',
    description: 'Reversals reveal disowned emotions, avoided needs, or unconscious habits surfacing for healing and wholeness.',
    guidance: 'Name the hidden feeling, show how it can be witnessed safely, and suggest a micro-practice for reintegration.',
    examples: {
      'The Moon': 'Anxiety eases when you name the fear aloud and create grounding rituals; try writing it down each morning.',
      'Five of Swords': 'Step out of zero-sum thinking by repairing the belief that conflict automatically equals abandonment.',
      'The Tower': 'Resistance to change reveals fear of losing control; acknowledge the grief of letting go as a first step.',
      'The Devil': 'An attachment you judge in yourself deserves compassion; get curious about what need it serves.'
    }
  },
  mirror: {
    name: 'Mirror / Reflection',
    description: 'Reversed cards reflect back what the querent is projecting outward, highlighting unconscious behavior or energy.',
    guidance: 'Ask what aspect of this energy you might be unconsciously expressing, attracting, or projecting onto others.',
    examples: {
      'The Emperor': 'Where might you be overly controlling or rigid without realizing it?',
      'Queen of Cups': 'Are you suppressing your emotional needs while focusing on caring for others?',
      'Knight of Swords': 'Is your mental intensity coming across as aggression to those around you?',
      'The Hermit': 'Are you isolating yourself in ways that others perceive as withdrawal or judgment?'
    }
  },
  potentialBlocked: {
    name: 'Unrealized Potential',
    description: 'Reversed cards show latent gifts, strengths, or capacities that have not yet been activated, claimed, or developed.',
    guidance: 'Treat each reversal as a dormant strength awaiting conscious cultivation and ask what would help this energy emerge fully.',
    examples: {
      'The Magician': 'You have the tools and skills; what belief or circumstance is preventing you from using them fully?',
      'Eight of Pentacles': 'A talent exists that you have not invested time in developing yet; what would daily practice look like?',
      'The Star': 'Hope and inspiration are available but not yet accessed; what would help you reconnect with your vision?',
      'Ace of Wands': 'Creative fire is present but has not been channeled; what outlet would let it take form?'
    }
  }
};

/**
 * Get reversal framework description object
 *
 * @param {string} framework - Framework key
 * @returns {Object} Framework definition
 */
function getReversalFrameworkDescription(framework) {
  const definition = REVERSAL_FRAMEWORKS[framework] || REVERSAL_FRAMEWORKS.contextual;
  return {
    ...definition,
    examples: definition.examples ? { ...definition.examples } : {}
  };
}

/**
 * Get description of suit focus
 *
 * @param {Object} params - Suit entry data
 * @param {Array} params.top - [suitName, count] for dominant suit
 * @param {Array} params.second - [suitName, count] for second suit
 * @returns {string|null} Description or null if no clear focus
 */
function getSuitFocusDescription({ top, second }) {
  const [topSuit, topCount] = top || [null, 0];
  const [secondSuit, secondCount] = second || [null, 0];

  if (!topSuit || topCount < 2) return null;

  if (topCount === secondCount && topCount > 1 && secondSuit) {
    return `Balanced focus between ${topSuit} and ${secondSuit}, each surfacing ${topCount} times.`;
  }

  const descriptions = {
    Wands: `${topCount} Wands cards suggest a strong focus on action, creativity, passion, drive, and personal will.`,
    Cups: `${topCount} Cups cards indicate emotional matters, relationships, intuition, and heart-centered concerns are central to this reading.`,
    Swords: `${topCount} Swords cards point to mental processes, communication, truth-seeking, conflict resolution, and clarity of thought as key themes.`,
    Pentacles: `${topCount} Pentacles cards highlight practical matters, material resources, work, physical health, and tangible results.`
  };

  return descriptions[topSuit] || null;
}

/**
 * Get description of elemental balance with Major Arcana awareness
 *
 * @param {Object} params - Analysis parameters
 * @param {Object} params.elementCounts - Element count map
 * @param {number} params.totalCards - Total card count
 * @param {number} params.majorRatio - Ratio of Major Arcana cards
 * @returns {string} Elemental balance description
 */
function getMajorAwareElementalBalanceDescription({ elementCounts, totalCards, majorRatio }) {
  if (majorRatio > 0.8) {
    return 'Archetypal energies dominate, transcending elemental themes.';
  }

  return getElementalBalanceDescription(elementCounts, totalCards);
}

/**
 * Get description of elemental balance
 *
 * @param {Object} elementCounts - Element count map
 * @param {number} total - Total card count
 * @returns {string} Elemental balance description
 */
function getElementalBalanceDescription(elementCounts, total) {
  if (total === 0) return 'No elemental data available.';

  const active = Object.entries(elementCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (active.length === 0) return 'Balanced elemental presence.';
  if (active.length === 1) return `Strong ${active[0][0]} emphasis dominates this reading.`;

  const [dominant] = active;
  const ratio = dominant[1] / total;

  if (ratio >= 0.5) {
    return `${dominant[0]} energy strongly dominates (${dominant[1]}/${total} cards), requiring attention to balance with other elements.`;
  }

  if (ratio >= 0.35) {
    return `${dominant[0]} leads (${dominant[1]}/${total}), with ${active.slice(1).map(([e, c]) => `${e} (${c})`).join(', ')} providing supporting or contrasting energies.`;
  }

  return `Mixed elemental energies: ${active.map(([e, c]) => `${e} (${c})`).join(', ')}.`;
}

/**
 * Get description of Major Arcana density
 *
 * @param {number} ratio - Ratio of Major Arcana cards (0-1)
 * @returns {string} Archetype level description
 */
function getArchetypeDescription(ratio) {
  if (ratio >= 0.5) {
    return 'High Major Arcana presence indicates profound, soul-level themes, karmic patterns, and significant life transitions.';
  }
  if (ratio >= 0.3) {
    return 'Moderate Major Arcana suggests important archetypal lessons woven through everyday matters.';
  }
  return 'Primarily Minor Arcana, focusing on practical, day-to-day dynamics and immediate concerns.';
}

/**
 * Get lifecycle stage based on average card number
 *
 * @param {number|null} avgNumber - Average card number
 * @returns {string|null} Lifecycle stage description or null
 */
function getLifecycleStage(avgNumber) {
  if (avgNumber === null || typeof avgNumber !== 'number') return null;
  if (avgNumber <= 7) return 'new cycles, initiative, fresh beginnings, and reclaiming agency';
  if (avgNumber <= 14) return 'integration, balance, working through challenges, and staying centered amidst change';
  return 'culmination, mastery, completion, and preparing to release what is finished';
}

/* ==========================================================================
 * CELTIC CROSS SPECIFIC ANALYSIS
 *
 * Analyzes the unique position relationships in the Celtic Cross spread:
 * - Nucleus (Cards 1-2): Heart of the matter
 * - Timeline (Cards 3-1-4): Past → Present → Future
 * - Consciousness (Cards 6-1-5): Subconscious → Present → Conscious
 * - Staff (Cards 7-10): Self, External, Hopes/Fears, Outcome
 * - Cross-checks between key positions
 * ========================================================================== */

/**
 * Analyze a Celtic Cross spread
 *
 * @param {Array} cardsInfo - Array of 10 card objects
 * @returns {Object|null} Celtic Cross analysis or null if invalid input
 */
export function analyzeCelticCross(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length !== 10) {
    return null;
  }

  // Validate all cards exist
  for (let i = 0; i < 10; i++) {
    if (!cardsInfo[i]) return null;
  }

  const nucleus = analyzeNucleus(cardsInfo[0], cardsInfo[1]);
  const timeline = analyzeTimeline(cardsInfo[2], cardsInfo[0], cardsInfo[3]);
  const consciousness = analyzeConsciousness(cardsInfo[5], cardsInfo[0], cardsInfo[4]);
  const staff = analyzeStaff(cardsInfo[6], cardsInfo[7], cardsInfo[8], cardsInfo[9]);

  const crossChecks = {
    goalVsOutcome: comparePositions(
      cardsInfo[4], cardsInfo[9],
      'Conscious Goal (Above)', 'Outcome (Final)'
    ),
    adviceVsOutcome: comparePositions(
      cardsInfo[6], cardsInfo[9],
      'Self/Advice', 'Outcome'
    ),
    subconsciousVsHopesFears: comparePositions(
      cardsInfo[5], cardsInfo[8],
      'Subconscious (Below)', 'Hopes & Fears'
    ),
    nearFutureVsOutcome: comparePositions(
      cardsInfo[3], cardsInfo[9],
      'Near Future', 'Outcome'
    )
  };

  return {
    version: '1.0.0',
    spreadKey: 'celtic',
    themes: null, // Filled by performSpreadAnalysis; kept for normalized shape parity
    relationships: [
      {
        type: 'nucleus',
        summary: nucleus.synthesis,
        positions: [0, 1],
        cards: [nucleus.present, nucleus.challenge]
      },
      {
        type: 'timeline',
        summary: timeline.causality,
        positions: [2, 0, 3],
        cards: [
          { card: timeline.flow.past },
          { card: timeline.flow.present },
          { card: timeline.flow.future }
        ]
      },
      {
        type: 'consciousness-axis',
        axis: 'Subconscious ↔ Conscious',
        summary: consciousness.synthesis,
        positions: [5, 4],
        cards: [consciousness.subconscious, consciousness.conscious]
      },
      {
        type: 'staff-axis',
        axis: 'Self/Advice ↔ Outcome',
        summary: staff.adviceImpact,
        positions: [6, 9],
        cards: [staff.self, staff.outcome]
      },
      {
        type: 'cross-check',
        key: 'goalVsOutcome',
        summary: buildCrossCheckSummary(crossChecks.goalVsOutcome),
        alignmentType: crossChecks.goalVsOutcome.alignmentType,
        elementalRelationship: crossChecks.goalVsOutcome.elementalRelationship,
        orientationAlignment: crossChecks.goalVsOutcome.orientationAlignment,
        cards: [crossChecks.goalVsOutcome.position1, crossChecks.goalVsOutcome.position2]
      },
      {
        type: 'cross-check',
        key: 'adviceVsOutcome',
        summary: buildCrossCheckSummary(crossChecks.adviceVsOutcome),
        alignmentType: crossChecks.adviceVsOutcome.alignmentType,
        elementalRelationship: crossChecks.adviceVsOutcome.elementalRelationship,
        orientationAlignment: crossChecks.adviceVsOutcome.orientationAlignment,
        cards: [crossChecks.adviceVsOutcome.position1, crossChecks.adviceVsOutcome.position2]
      },
      {
        type: 'cross-check',
        key: 'subconsciousVsHopesFears',
        summary: buildCrossCheckSummary(crossChecks.subconsciousVsHopesFears),
        alignmentType: crossChecks.subconsciousVsHopesFears.alignmentType,
        elementalRelationship: crossChecks.subconsciousVsHopesFears.elementalRelationship,
        orientationAlignment: crossChecks.subconsciousVsHopesFears.orientationAlignment,
        cards: [
          crossChecks.subconsciousVsHopesFears.position1,
          crossChecks.subconsciousVsHopesFears.position2
        ]
      },
      {
        type: 'cross-check',
        key: 'nearFutureVsOutcome',
        summary: buildCrossCheckSummary(crossChecks.nearFutureVsOutcome),
        alignmentType: crossChecks.nearFutureVsOutcome.alignmentType,
        elementalRelationship: crossChecks.nearFutureVsOutcome.elementalRelationship,
        orientationAlignment: crossChecks.nearFutureVsOutcome.orientationAlignment,
        cards: [
          crossChecks.nearFutureVsOutcome.position1,
          crossChecks.nearFutureVsOutcome.position2
        ]
      }
    ],
    positionNotes: [
      {
        index: 0,
        label: 'Present',
        notes: ['Core situation; anchor for nucleus and all axes.']
      },
      {
        index: 1,
        label: 'Challenge',
        notes: ['Crossing tension; always read as obstacle to integrate.']
      },
      {
        index: 2,
        label: 'Past',
        notes: ['Foundation feeding into present in the timeline.']
      },
      {
        index: 3,
        label: 'Near Future',
        notes: ['Next chapter, cross-checked against Outcome.']
      },
      {
        index: 4,
        label: 'Conscious',
        notes: ['Stated goals; cross-check with Outcome.']
      },
      {
        index: 5,
        label: 'Subconscious',
        notes: ['Hidden drivers; cross-check with Hopes & Fears.']
      },
      {
        index: 6,
        label: 'Self / Advice',
        notes: ['Active guidance; cross-check with Outcome.']
      },
      {
        index: 7,
        label: 'External',
        notes: ['Environment and others; context, not command.']
      },
      {
        index: 8,
        label: 'Hopes & Fears',
        notes: ['Mixed desires/anxieties; mirrored with Subconscious.']
      },
      {
        index: 9,
        label: 'Outcome',
        notes: ['Trajectory if unchanged; never deterministic.']
      }
    ],
    // Raw components preserved for narrativeBuilder and any future consumers
    nucleus,
    timeline,
    consciousness,
    staff,
    crossChecks
  };
}

/**
 * Analyze the nucleus (Cards 1-2) - the heart of the matter
 *
 * @param {Object} present - Present position card
 * @param {Object} challenge - Challenge/crossing card
 * @returns {Object} Nucleus analysis
 */
function analyzeNucleus(present, challenge) {
  const elemental = analyzeElementalDignity(present, challenge);

  let synthesis;
  switch (elemental.relationship) {
    case 'supportive':
      synthesis = `The energies of ${present.card} and ${challenge.card} can work together constructively once the challenge is integrated.`;
      break;
    case 'tension':
      synthesis = `${present.card} and ${challenge.card} create friction between present state and challenge, requiring careful balance.`;
      break;
    case 'amplified':
      synthesis = `Both cards share ${elemental.element} energy, intensifying this theme at the heart of the matter.`;
      break;
    case 'neutral':
    default:
      synthesis = `${present.card} represents where you stand, while ${challenge.card} crosses as the immediate obstacle.`;
  }

  return {
    theme: 'The Heart of the Matter (Nucleus)',
    present: {
      card: present.card,
      orientation: present.orientation,
      meaning: present.meaning
    },
    challenge: {
      card: challenge.card,
      orientation: challenge.orientation,
      meaning: challenge.meaning
    },
    elementalDynamic: elemental,
    synthesis
  };
}

/**
 * Analyze the timeline (Cards 3-1-4) - past, present, future flow
 *
 * @param {Object} past - Past position card
 * @param {Object} present - Present position card
 * @param {Object} future - Future position card
 * @returns {Object} Timeline analysis
 */
function analyzeTimeline(past, present, future) {
  const pastToPresent = analyzeElementalDignity(past, present);
  const presentToFuture = analyzeElementalDignity(present, future);
  const pastToFuture = analyzeElementalDignity(past, future);

  let causality = `${past.card} in the past has led to ${present.card} in the present.`;

  if (pastToPresent.relationship === 'tension') {
    causality += ` The transition from past to present involved friction and adjustment.`;
  } else if (pastToPresent.relationship === 'supportive') {
    causality += ` The past supports and flows naturally into the present state.`;
  } else if (pastToPresent.relationship === 'amplified') {
    causality += ` The same elemental theme persists from past into present.`;
  }

  causality += ` This is developing toward ${future.card} in the near future.`;

  if (presentToFuture.relationship === 'tension') {
    causality += ` Moving forward will require navigating elemental tension.`;
  } else if (presentToFuture.relationship === 'supportive') {
    causality += ` The trajectory ahead is supported by current energies.`;
  } else if (presentToFuture.relationship === 'amplified') {
    causality += ` The elemental energy intensifies as you move forward.`;
  }

  return {
    theme: 'The Timeline',
    flow: {
      past: past.card,
      present: present.card,
      future: future.card
    },
    causality,
    pastToPresent,
    presentToFuture,
    pastToFuture
  };
}

/**
 * Analyze consciousness flow (Cards 6-1-5) - below, center, above
 *
 * @param {Object} subconscious - Subconscious position card
 * @param {Object} present - Present position card
 * @param {Object} conscious - Conscious position card
 * @returns {Object} Consciousness analysis
 */
function analyzeConsciousness(subconscious, present, conscious) {
  const belowToAbove = analyzeElementalDignity(subconscious, conscious);

  let alignment;
  switch (belowToAbove.relationship) {
    case 'supportive':
      alignment = 'aligned';
      break;
    case 'tension':
      alignment = 'conflicted';
      break;
    case 'amplified':
      alignment = 'intensely unified';
      break;
    default:
      alignment = 'complex';
  }

  let synthesis = `Hidden beneath awareness: ${subconscious.card} ${subconscious.orientation}. `;
  synthesis += `Conscious goal or aspiration: ${conscious.card} ${conscious.orientation}. `;

  switch (alignment) {
    case 'aligned':
      synthesis += `Your subconscious drives and conscious goals are working together harmoniously.`;
      break;
    case 'conflicted':
      synthesis += `There is tension between what you want consciously and what drives you beneath awareness. Integration is needed.`;
      break;
    case 'intensely unified':
      synthesis += `Your inner depths and conscious mind are unified around the same ${belowToAbove.element} theme.`;
      break;
    default:
      synthesis += `Your inner and outer goals show nuanced dynamics worth exploring.`;
  }

  return {
    theme: 'Consciousness Flow (Vertical Axis)',
    alignment,
    subconscious: {
      card: subconscious.card,
      orientation: subconscious.orientation
    },
    conscious: {
      card: conscious.card,
      orientation: conscious.orientation
    },
    elementalRelationship: belowToAbove,
    synthesis
  };
}

/**
 * Analyze the staff (Cards 7-10) - self, external, hopes/fears, outcome
 *
 * @param {Object} self - Self/Advice position card
 * @param {Object} external - External influences card
 * @param {Object} hopesFears - Hopes & Fears card
 * @param {Object} outcome - Outcome card
 * @returns {Object} Staff analysis
 */
function analyzeStaff(self, external, hopesFears, outcome) {
  const adviceToOutcome = analyzeElementalDignity(self, outcome);

  let adviceImpact;
  switch (adviceToOutcome.relationship) {
    case 'supportive':
      adviceImpact = `Following the guidance of ${self.card} actively supports and harmonizes with the likely outcome of ${outcome.card}.`;
      break;
    case 'tension':
      adviceImpact = `Acting on ${self.card} creates dynamic tension with the trajectory toward ${outcome.card}, requiring skillful navigation.`;
      break;
    case 'amplified':
      adviceImpact = `The advice (${self.card}) and outcome (${outcome.card}) share the same ${adviceToOutcome.element} energy, creating a unified path forward.`;
      break;
    default:
      adviceImpact = `The relationship between the advice of ${self.card} and the outcome shows subtle complexity.`;
  }

  return {
    theme: 'The Staff (Context and Trajectory)',
    self: {
      card: self.card,
      orientation: self.orientation
    },
    external: {
      card: external.card,
      orientation: external.orientation
    },
    hopesFears: {
      card: hopesFears.card,
      orientation: hopesFears.orientation
    },
    outcome: {
      card: outcome.card,
      orientation: outcome.orientation
    },
    adviceToOutcome,
    adviceImpact
  };
}

/**
 * Determine alignment type based on elemental relationship and orientation
 *
 * @param {Object} elemental - Elemental relationship object from analyzeElementalDignity
 * @param {boolean} orientationMatch - Whether both cards share the same orientation
 * @returns {string} Alignment type: 'unified' | 'harmonious' | 'evolving-support' |
 *                   'parallel-tension' | 'dynamic-shift' | 'complex'
 */
function determineAlignmentType(elemental, orientationMatch) {
  if (!elemental) return 'complex';

  switch (elemental.relationship) {
    case 'amplified':
      return 'unified';
    case 'supportive':
      return orientationMatch ? 'harmonious' : 'evolving-support';
    case 'tension':
      return orientationMatch ? 'parallel-tension' : 'dynamic-shift';
    default:
      return 'complex';
  }
}

/**
 * Generate summary prose for cross-check relationships
 * Used to populate the summary field needed by UI highlights
 *
 * @param {Object} crossCheck - Cross-check comparison result
 * @returns {string} Summary prose
 */
function buildCrossCheckSummary(crossCheck) {
  if (!crossCheck || !crossCheck.position1 || !crossCheck.position2) {
    return 'Unable to compare these positions.';
  }

  const { position1, position2, elementalRelationship, alignmentType } = crossCheck;

  let summary = `${position1.name} (${position1.card} ${position1.orientation}) compared to ${position2.name} (${position2.card} ${position2.orientation}): `;

  // Add elemental description if available
  if (elementalRelationship?.description) {
    summary += elementalRelationship.description + ' ';
  }

  // Add alignment-based insight
  const alignmentInsights = {
    'unified': 'Both positions share the same elemental theme, creating unified energy.',
    'harmonious': 'These positions support each other harmoniously.',
    'evolving-support': 'Supportive flow suggests evolution between these positions.',
    'parallel-tension': 'Both hold tension in the same direction.',
    'dynamic-shift': 'Different orientations signal a transformative shift.',
    'complex': 'These positions show nuanced interplay.'
  };

  summary += alignmentInsights[alignmentType] || 'These positions relate in subtle ways.';

  return summary;
}

/**
 * Compare two position cards for cross-checks
 *
 * Returns structured data only - prose generation handled by narrative builder.
 * This eliminates redundant synthesis text and centralizes narrative logic.
 *
 * @param {Object} card1 - First card object
 * @param {Object} card2 - Second card object
 * @param {string} pos1Name - First position name
 * @param {string} pos2Name - Second position name
 * @returns {Object} Comparison result with elemental and orientation data
 */
function comparePositions(card1, card2, pos1Name, pos2Name) {
  if (!card1 || !card2) {
    return {
      position1: { name: pos1Name, card: null, orientation: null, meaning: null },
      position2: { name: pos2Name, card: null, orientation: null, meaning: null },
      elementalRelationship: null,
      orientationAlignment: false,
      alignmentType: 'complex'
    };
  }

  const elemental = analyzeElementalDignity(card1, card2);
  const orientationMatch = card1.orientation === card2.orientation;

  return {
    position1: {
      name: pos1Name,
      card: card1.card,
      orientation: card1.orientation,
      meaning: card1.meaning
    },
    position2: {
      name: pos2Name,
      card: card2.card,
      orientation: card2.orientation,
      meaning: card2.meaning
    },
    elementalRelationship: elemental,
    orientationAlignment: orientationMatch,
    alignmentType: determineAlignmentType(elemental, orientationMatch)
  };
}

/* ==========================================================================
 * THREE-CARD ANALYSIS
 *
 * Analyzes Past-Present-Future or Situation-Challenge-Advice patterns
 * ========================================================================== */

/**
 * Analyze a three-card spread
 *
 * @param {Array} cardsInfo - Array of 3 card objects
 * @returns {Object|null} Three-card analysis or null if invalid input
 */
export function analyzeThreeCard(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length !== 3) {
    return null;
  }

  const [first, second, third] = cardsInfo;

  if (!first || !second || !third) {
    return null;
  }

  // Analyze the causal flow
  const firstToSecond = analyzeElementalDignity(first, second);
  const secondToThird = analyzeElementalDignity(second, third);
  const firstToThird = analyzeElementalDignity(first, third);

  const narrative = buildThreeCardNarrative(first, second, third, firstToSecond, secondToThird);

  return {
    version: '1.0.0',
    spreadKey: 'threeCard',
    relationships: [
      {
        type: 'sequence',
        summary: narrative,
        positions: [0, 1, 2],
        cards: [
          { card: first.card, orientation: first.orientation },
          { card: second.card, orientation: second.orientation },
          { card: third.card, orientation: third.orientation }
        ]
      }
    ],
    positionNotes: [
      { index: 0, label: 'Past', notes: ['Foundation / cause.'] },
      { index: 1, label: 'Present', notes: ['Current state shaped by past.'] },
      { index: 2, label: 'Future', notes: ['Trajectory if nothing shifts.'] }
    ],
    flow: {
      first: first.card,
      second: second.card,
      third: third.card
    },
    transitions: {
      firstToSecond,
      secondToThird,
      firstToThird
    },
    narrative
  };
}

/**
 * Build narrative prose for three-card spread
 *
 * @param {Object} first - First card
 * @param {Object} second - Second card
 * @param {Object} third - Third card
 * @param {Object} trans1 - First to second transition analysis
 * @param {Object} trans2 - Second to third transition analysis
 * @returns {string} Narrative prose
 */
function buildThreeCardNarrative(first, second, third, trans1, trans2) {
  let narrative = `The story unfolds from ${first.card} through ${second.card} to ${third.card}. `;

  if (trans1.relationship === 'supportive') {
    narrative += `The transition from first to second position is harmonious. `;
  } else if (trans1.relationship === 'tension') {
    narrative += `The move from first to second involves friction that shapes the narrative. `;
  } else if (trans1.relationship === 'amplified') {
    narrative += `The same elemental energy intensifies from first to second position. `;
  }

  if (trans2.relationship === 'supportive') {
    narrative += `The path forward from second to third is well-supported.`;
  } else if (trans2.relationship === 'tension') {
    narrative += `Reaching the third position will require navigating dynamic tension.`;
  } else if (trans2.relationship === 'amplified') {
    narrative += `The elemental theme continues to build toward the third position.`;
  }

  return narrative;
}

/* ==========================================================================
 * FIVE-CARD ANALYSIS
 *
 * Analyzes the five-card clarity spread structure
 * ========================================================================== */

/**
 * Analyze a five-card spread
 *
 * @param {Array} cardsInfo - Array of 5 card objects
 * @returns {Object|null} Five-card analysis or null if invalid input
 */
export function analyzeFiveCard(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length !== 5) {
    return null;
  }

  // Validate all cards exist
  for (let i = 0; i < 5; i++) {
    if (!cardsInfo[i]) return null;
  }

  // Core vs Challenge
  const coreVsChallenge = analyzeElementalDignity(cardsInfo[0], cardsInfo[1]);

  // Support vs Direction
  const supportVsDirection = analyzeElementalDignity(cardsInfo[3], cardsInfo[4]);

  const synthesis = `The core matter (${cardsInfo[0].card}) faces the challenge of ${cardsInfo[1].card}. Support comes through ${cardsInfo[3].card}, pointing toward ${cardsInfo[4].card} as the likely direction.`;

  return {
    version: '1.0.0',
    spreadKey: 'fiveCard',
    relationships: [
      {
        type: 'axis',
        axis: 'Core vs Challenge',
        summary:
          coreVsChallenge.description ||
          'Tension or harmony between core and challenge frames the heart of this spread.',
        positions: [0, 1],
        cards: [
          { card: cardsInfo[0].card, orientation: cardsInfo[0].orientation },
          { card: cardsInfo[1].card, orientation: cardsInfo[1].orientation }
        ]
      },
      {
        type: 'axis',
        axis: 'Support vs Direction',
        summary:
          supportVsDirection.description ||
          'Supportive energies shape how the likely direction can be navigated.',
        positions: [3, 4],
        cards: [
          { card: cardsInfo[3].card, orientation: cardsInfo[3].orientation },
          { card: cardsInfo[4].card, orientation: cardsInfo[4].orientation }
        ]
      }
    ],
    positionNotes: [
      { index: 0, label: 'Core', notes: ['Central issue.'] },
      { index: 1, label: 'Challenge', notes: ['Obstacle / friction.'] },
      { index: 2, label: 'Hidden', notes: ['Subconscious / unseen influence.'] },
      { index: 3, label: 'Support', notes: ['Helpful energy / allies.'] },
      { index: 4, label: 'Direction', notes: ['Likely direction on current path.'] }
    ],
    coreVsChallenge,
    supportVsDirection,
    synthesis
  };
}

/* ==========================================================================
 * RELATIONSHIP SNAPSHOT ANALYSIS
 *
 * Maps the interplay between You ↔ Them and the shared Connection card.
 * ========================================================================== */

/**
 * Analyze a relationship spread
 *
 * @param {Array} cardsInfo - Array of 3+ card objects (first 3 are You, Them, Connection)
 * @returns {Object|null} Relationship analysis or null if invalid input
 */
export function analyzeRelationship(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length < 3) {
    return null;
  }

  const [you, them, connection, dynamics, outcome] = cardsInfo;
  if (!you || !them || !connection) {
    return null;
  }

  const youLabel = you.position || 'You / your energy';
  const themLabel = them.position || 'Them / their energy';
  const _connectionLabel = connection.position || 'The connection / shared lesson';
  const dynamicsLabel = dynamics?.position || 'Dynamics / guidance';
  const outcomeLabel = outcome?.position || 'Outcome / what this can become';

  const youVsThem = comparePositions(you, them, youLabel, themLabel);
  const youBridge = analyzeElementalDignity(connection, you);
  const themBridge = analyzeElementalDignity(connection, them);

  const connectionSummaryParts = [
    `${connection.card} ${connection.orientation} anchors the shared lesson between you.`,
    connection.meaning ? connection.meaning : null,
    youBridge?.description ? `With your card, ${youBridge.description}.` : null,
    themBridge?.description ? `With their card, ${themBridge.description}.` : null
  ].filter(Boolean);

  const relationships = [];

  if (youVsThem) {
    // Generate summary from structured data
    let summary = `${youLabel} (${you.card} ${you.orientation}) and ${themLabel} (${them.card} ${them.orientation}): `;

    if (youVsThem.elementalRelationship?.description) {
      summary += youVsThem.elementalRelationship.description;
    } else {
      switch (youVsThem.alignmentType) {
        case 'unified':
          summary += `The dynamic between you resonates with shared energy.`;
          break;
        case 'harmonious':
          summary += `The dynamic between you flows harmoniously.`;
          break;
        default:
          summary += `The dynamic between you holds creative tension.`;
      }
    }

    relationships.push({
      type: 'axis',
      axis: 'You ↔ Them',
      summary,
      positions: [0, 1],
      cards: [
        { card: you.card, orientation: you.orientation },
        { card: them.card, orientation: them.orientation }
      ],
      elementalRelationship: youVsThem.elementalRelationship,
      alignmentType: youVsThem.alignmentType
    });
  }

  relationships.push({
    type: 'connection',
    summary:
      connectionSummaryParts.join(' ') ||
      `${connection.card} illustrates the shared energy in this connection.`,
    positions: [2],
    cards: [{ card: connection.card, orientation: connection.orientation }],
    bridges: {
      toYou: youBridge,
      toThem: themBridge
    }
  });

  if (dynamics) {
    const dynamicsBridge = analyzeElementalDignity(connection, dynamics);
    const summaryParts = [
      `${dynamics.card} ${dynamics.orientation} offers guidance on how to work with the dynamic in real time.`,
      dynamics.meaning || null,
      dynamicsBridge?.description ? `In relation to the shared lesson, ${dynamicsBridge.description}.` : null
    ].filter(Boolean);

    relationships.push({
      type: 'guidance',
      summary: summaryParts.join(' '),
      positions: [3],
      cards: [{ card: dynamics.card, orientation: dynamics.orientation }],
      bridges: {
        toConnection: dynamicsBridge
      }
    });
  }

  if (outcome) {
    const connectionToOutcome = analyzeElementalDignity(connection, outcome);
    const dynamicsToOutcome = dynamics
      ? analyzeElementalDignity(dynamics, outcome)
      : null;
    const summaryParts = [
      `${outcome.card} ${outcome.orientation} sketches a likely trajectory for what this connection can become if current patterns continue.`,
      outcome.meaning || null,
      connectionToOutcome?.description ? `Relative to the shared lesson, ${connectionToOutcome.description}.` : null,
      dynamicsToOutcome?.description ? `Relative to current guidance, ${dynamicsToOutcome.description}.` : null
    ].filter(Boolean);

    relationships.push({
      type: 'outcome',
      summary: summaryParts.join(' '),
      positions: [4],
      cards: [{ card: outcome.card, orientation: outcome.orientation }],
      bridges: {
        toConnection: connectionToOutcome,
        toDynamics: dynamicsToOutcome
      }
    });
  }

  return {
    version: '1.0.0',
    spreadKey: 'relationship',
    relationships,
    positionNotes: [
      { index: 0, label: 'You / your energy', notes: ['How you are currently showing up.'] },
      { index: 1, label: 'Them / their energy', notes: ['How they are approaching the connection.'] },
      { index: 2, label: 'The connection / shared lesson', notes: ['The third energy between you—what the bond is asking from both sides.'] },
      ...(dynamics ? [{ index: 3, label: dynamicsLabel, notes: ['Clarifying guidance on how to engage the dynamic.'] }] : []),
      ...(outcome ? [{ index: 4, label: outcomeLabel, notes: ['Likely trajectory if current relational dynamics continue.'] }] : [])
    ],
    dyad: {
      you: { card: you.card, orientation: you.orientation },
      them: { card: them.card, orientation: them.orientation },
      elementalRelationship: youVsThem?.elementalRelationship
    },
    connection: {
      card: connection.card,
      orientation: connection.orientation,
      meaning: connection.meaning,
      bridges: {
        toYou: youBridge,
        toThem: themBridge
      }
    },
    guidance: dynamics
      ? {
        card: dynamics.card,
        orientation: dynamics.orientation,
        meaning: dynamics.meaning || null
      }
      : null,
    outcome: outcome
      ? {
        card: outcome.card,
        orientation: outcome.orientation,
        meaning: outcome.meaning || null
      }
      : null
  };
}

/* ==========================================================================
 * SINGLE-CARD ANALYSIS
 *
 * Provides minimal synthesis structure so prompt builders can consume
 * spreadAnalysis consistently across all supported spread keys.
 * ========================================================================== */

/**
 * Analyze a single-card spread
 *
 * @param {Array} cardsInfo - Array containing one card object
 * @returns {Object|null} Single-card analysis or null if invalid input
 */
export function analyzeSingleCard(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length !== 1) {
    return null;
  }

  const [card] = cardsInfo;
  if (!card) {
    return null;
  }

  const positionLabel = card.position || 'Theme / Guidance of the Moment';
  const orientationLabel = card.orientation || 'Upright';
  const orientationLower = orientationLabel.toLowerCase();
  const orientationGuidance = orientationLower === 'reversed'
    ? 'Treat this as inward-facing energy that benefits from reflection before action.'
    : 'Treat this as active energy you can translate into one grounded next step.';
  const meaningText = card.meaning
    ? `${card.meaning.trim()}`
    : 'This card is the central lens for interpreting the current moment.';
  const synthesis = `${card.card} ${orientationLabel} frames the reading through "${positionLabel}". ${meaningText} ${orientationGuidance}`;

  return {
    version: '1.0.0',
    spreadKey: 'single',
    focusCard: {
      card: card.card,
      orientation: orientationLabel,
      position: positionLabel,
      meaning: card.meaning || null
    },
    positionNotes: [
      {
        index: 0,
        label: positionLabel,
        notes: ['This single position sets the full interpretive throughline.']
      }
    ],
    synthesis
  };
}

/* ==========================================================================
 * DECISION / TWO-PATH ANALYSIS
 *
 * Compares Path A vs Path B with respect to the heart of the decision
 * and synthesizes clarifier + free-will guidance.
 * ========================================================================== */

/**
 * Analyze a decision/two-path spread
 *
 * @param {Array} cardsInfo - Array of 5 card objects (Heart, PathA, PathB, Clarifier, FreeWill)
 * @returns {Object|null} Decision analysis or null if invalid input
 */
export function analyzeDecision(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length !== 5) {
    return null;
  }

  const [heart, pathA, pathB, clarifier, freeWill] = cardsInfo;
  if (!heart || !pathA || !pathB) {
    return null;
  }

  const heartLabel = heart.position || 'Heart of the decision';
  const pathALabel = pathA.position || 'Path A — energy & likely outcome';
  const pathBLabel = pathB.position || 'Path B — energy & likely outcome';
  const clarifierLabel = clarifier?.position || 'What clarifies the best path';
  const freeWillLabel = freeWill?.position || 'What to remember about your free will';

  const heartVsA = comparePositions(heart, pathA, heartLabel, pathALabel);
  const heartVsB = comparePositions(heart, pathB, heartLabel, pathBLabel);
  const pathAVsB = comparePositions(pathA, pathB, pathALabel, pathBLabel);

  const relationships = [];

  if (heartVsA) {
    // Generate summary from structured data
    let summary = `${heartLabel} (${heart.card} ${heart.orientation}) and ${pathALabel} (${pathA.card} ${pathA.orientation}): `;

    if (heartVsA.elementalRelationship?.description) {
      summary += heartVsA.elementalRelationship.description;
    } else {
      switch (heartVsA.alignmentType) {
        case 'unified':
          summary += `This path strongly aligns with your core values.`;
          break;
        case 'harmonious':
          summary += `This path supports your core values.`;
          break;
        default:
          summary += `This path creates complexity with your core values.`;
      }
    }

    relationships.push({
      type: 'axis',
      axis: 'Heart ↔ Path A',
      summary,
      positions: [0, 1],
      cards: [
        { card: heart.card, orientation: heart.orientation },
        { card: pathA.card, orientation: pathA.orientation }
      ],
      elementalRelationship: heartVsA.elementalRelationship,
      alignmentType: heartVsA.alignmentType
    });
  }

  if (heartVsB) {
    // Generate summary from structured data
    let summary = `${heartLabel} (${heart.card} ${heart.orientation}) and ${pathBLabel} (${pathB.card} ${pathB.orientation}): `;

    if (heartVsB.elementalRelationship?.description) {
      summary += heartVsB.elementalRelationship.description;
    } else {
      switch (heartVsB.alignmentType) {
        case 'unified':
          summary += `This path strongly aligns with your core values.`;
          break;
        case 'harmonious':
          summary += `This path supports your core values.`;
          break;
        default:
          summary += `This path creates complexity with your core values.`;
      }
    }

    relationships.push({
      type: 'axis',
      axis: 'Heart ↔ Path B',
      summary,
      positions: [0, 2],
      cards: [
        { card: heart.card, orientation: heart.orientation },
        { card: pathB.card, orientation: pathB.orientation }
      ],
      elementalRelationship: heartVsB.elementalRelationship,
      alignmentType: heartVsB.alignmentType
    });
  }

  if (pathAVsB) {
    // Generate summary from structured data
    let summary = `${pathALabel} (${pathA.card} ${pathA.orientation}) and ${pathBLabel} (${pathB.card} ${pathB.orientation}): `;

    if (pathAVsB.elementalRelationship?.description) {
      summary += pathAVsB.elementalRelationship.description;
    } else {
      if (pathAVsB.alignmentType === 'unified') {
        summary += `These paths share similar energies.`;
      } else if (pathAVsB.alignmentType === 'parallel-tension' || pathAVsB.alignmentType === 'dynamic-shift') {
        summary += `These paths contrast with each other.`;
      } else {
        summary += `These paths offer different approaches.`;
      }
    }

    relationships.push({
      type: 'axis',
      axis: 'Path A ↔ Path B',
      summary,
      positions: [1, 2],
      cards: [
        { card: pathA.card, orientation: pathA.orientation },
        { card: pathB.card, orientation: pathB.orientation }
      ],
      elementalRelationship: pathAVsB.elementalRelationship,
      alignmentType: pathAVsB.alignmentType
    });
  }

  const guidanceSummary = buildDecisionGuidanceSummary(clarifier, clarifierLabel, freeWill, freeWillLabel);
  if (guidanceSummary) {
    const guidanceCards = [clarifier, freeWill].filter(Boolean).map(card => ({
      card: card.card,
      orientation: card.orientation
    }));
    const guidancePositions = [];
    if (clarifier) guidancePositions.push(3);
    if (freeWill) guidancePositions.push(4);

    relationships.push({
      type: 'sequence',
      summary: guidanceSummary,
      positions: guidancePositions,
      cards: guidanceCards
    });
  }

  return {
    version: '1.0.0',
    spreadKey: 'decision',
    relationships,
    positionNotes: [
      { index: 0, label: 'Heart of the decision', notes: ['Core desire or non-negotiable value.'] },
      { index: 1, label: 'Path A — energy & likely outcome', notes: ['Trajectory if you commit to Path A.'] },
      { index: 2, label: 'Path B — energy & likely outcome', notes: ['Trajectory if you commit to Path B.'] },
      { index: 3, label: 'What clarifies the best path', notes: ['Insight that helps you evaluate the options.'] },
      { index: 4, label: 'What to remember about your free will', notes: ['Agency reminder; how you shape the outcome.'] }
    ],
    comparisons: {
      heartVsA,
      heartVsB,
      pathAVsB
    },
    guidance: {
      clarifier: clarifier ? { card: clarifier.card, orientation: clarifier.orientation } : null,
      freeWill: freeWill ? { card: freeWill.card, orientation: freeWill.orientation } : null
    }
  };
}

/**
 * Build guidance summary for decision spread
 *
 * @param {Object|null} clarifier - Clarifier card object
 * @param {string} clarifierLabel - Clarifier position label
 * @param {Object|null} freeWill - Free will card object
 * @param {string} freeWillLabel - Free will position label
 * @returns {string|null} Guidance summary prose or null
 */
function buildDecisionGuidanceSummary(clarifier, clarifierLabel, freeWill, freeWillLabel) {
  const parts = [];

  if (clarifier) {
    parts.push(
      `${clarifierLabel}: ${clarifier.card} ${clarifier.orientation} explains what data point or reflection helps you compare the routes.`
    );
  }

  if (freeWill) {
    parts.push(
      `${freeWillLabel}: ${freeWill.card} ${freeWill.orientation} reminds you that your agency ultimately shapes how this plays out.`
    );
  }

  if (parts.length === 0) return null;

  if (clarifier && freeWill) {
    parts.push('Together they ask you to pair clear-eyed assessment with empowered choice.');
  }

  return parts.join(' ');
}
