/**
 * Reasoning Chain for Local Composer
 *
 * Adds an explicit "thinking" phase to narrative construction that analyzes
 * the spread holistically before generating text. This creates more coherent,
 * cross-card-aware readings without requiring an LLM.
 *
 * @module reasoning
 */

import { getPositionWeight } from '../positionWeights.js';
import { getCardElement as getCardElementCanonical } from '../spreadAnalysis.js';
import { isMajorArcana as isMajorArcanaCanonical } from '../imageryHooks.js';

// Canonical Major/Minor classification (guards against misclassified Minors).
// Exported here so callers who already depend on reasoning.js have a clear,
// consistent entry point rather than re-implementing weaker heuristics.
export const isMajorArcana = isMajorArcanaCanonical;

// Re-export Minor parsing guardrails for convenience and consistency.
export { getMinorContext } from '../minorMeta.js';

// ============================================================================
// CARD NUMBER NORMALIZATION
// ============================================================================

/**
 * Normalize card number extraction from various possible property names
 *
 * Card objects may use different property names depending on source:
 * - Frontend data uses: `number`
 * - Some API payloads use: `cardNumber`
 * - Some schemas use: `card_number`
 *
 * @param {Object} cardInfo - Card information object
 * @returns {number|undefined} The card number, or undefined if not available
 */
export function getCardNumber(cardInfo) {
  if (!cardInfo) return undefined;

  // Check all possible property names in order of preference
  if (typeof cardInfo.number === 'number') {
    return cardInfo.number;
  }
  if (typeof cardInfo.cardNumber === 'number') {
    return cardInfo.cardNumber;
  }
  if (typeof cardInfo.card_number === 'number') {
    return cardInfo.card_number;
  }

  return undefined;
}

// ============================================================================
// CARD VALENCE & EMOTIONAL MAPPING
// ============================================================================

/**
 * Cards with strong positive associations
 */
const POSITIVE_CARDS = new Set([
  'The Sun', 'The Star', 'The World', 'The Empress', 'Ace of Cups',
  'Ten of Cups', 'Nine of Cups', 'Six of Wands', 'Three of Cups',
  'Ten of Pentacles', 'Ace of Wands', 'The Lovers', 'Strength',
  'Six of Cups', 'Four of Wands', 'Ace of Pentacles', 'Nine of Pentacles'
]);

/**
 * Cards with challenging/difficult associations
 */
const CHALLENGING_CARDS = new Set([
  'The Tower', 'Ten of Swords', 'Three of Swords', 'Five of Cups',
  'Nine of Swords', 'Five of Pentacles', 'Eight of Swords', 'The Devil',
  'Five of Swords', 'Seven of Swords', 'Ten of Wands', 'Three of Wands reversed'
]);

/**
 * Cards associated with transition/change
 */
const TRANSITION_CARDS = new Set([
  'Death', 'The Tower', 'Wheel of Fortune', 'The Hanged Man',
  'Eight of Cups', 'Six of Swords', 'Two of Wands', 'Three of Wands',
  'Judgement', 'The Fool'
]);

/**
 * Cards associated with inner work/reflection
 */
const INTROSPECTION_CARDS = new Set([
  'The Hermit', 'The High Priestess', 'Four of Swords', 'The Hanged Man',
  'The Moon', 'Seven of Cups', 'Four of Cups', 'Two of Swords',
  'Queen of Cups', 'Page of Cups'
]);

/**
 * Cards associated with action/movement
 */
const ACTION_CARDS = new Set([
  'The Chariot', 'Knight of Wands', 'Knight of Swords', 'Eight of Wands',
  'Ace of Wands', 'Three of Wands', 'Six of Wands', 'The Magician',
  'King of Wands', 'Seven of Wands'
]);

/**
 * Get emotional valence of a card (-1 to +1 scale)
 *
 * @param {Object} cardInfo - Card information object
 * @returns {number} Valence score from -1 (challenging) to +1 (positive)
 */
export function getCardValence(cardInfo) {
  if (!cardInfo?.card) return 0;

  const cardName = cardInfo.card;
  const isReversed = (cardInfo.orientation || '').toLowerCase() === 'reversed';

  let baseValence = 0;

  if (POSITIVE_CARDS.has(cardName)) {
    baseValence = 0.8;
  } else if (CHALLENGING_CARDS.has(cardName)) {
    baseValence = -0.7;
  } else if (TRANSITION_CARDS.has(cardName)) {
    baseValence = 0.1; // Neutral-leaning-positive (change as opportunity)
  } else if (INTROSPECTION_CARDS.has(cardName)) {
    baseValence = 0.3; // Mild positive (growth-oriented)
  } else if (ACTION_CARDS.has(cardName)) {
    baseValence = 0.5;
  }

  // Reversals moderate the valence (don't simply invert)
  if (isReversed) {
    if (baseValence > 0) {
      // Positive cards become blocked/delayed
      baseValence *= 0.3;
    } else if (baseValence < 0) {
      // Challenging cards may be releasing/resolving
      baseValence *= 0.5;
    }
  }

  return baseValence;
}

/**
 * Get the emotional quality label for a valence score
 *
 * @param {number} valence - Valence score
 * @returns {string} Human-readable emotional quality
 */
export function getEmotionalQuality(valence) {
  if (valence >= 0.6) return 'joy';
  if (valence >= 0.3) return 'hope';
  if (valence >= 0.1) return 'openness';
  if (valence >= -0.1) return 'uncertainty';
  if (valence >= -0.3) return 'tension';
  if (valence >= -0.6) return 'challenge';
  return 'difficulty';
}

// ============================================================================
// QUESTION INTENT ANALYSIS
// ============================================================================

/**
 * Question type patterns for intent detection
 */
const QUESTION_PATTERNS = {
  decision: {
    patterns: [
      /should i/i,
      /which .* (choose|pick|select)/i,
      /between .* (and|or)/i,
      /what('s| is) the (right|best) (choice|decision|path)/i,
      /either .* or/i
    ],
    description: 'seeking guidance on a choice'
  },
  timing: {
    patterns: [
      /when will/i,
      /how long/i,
      /how soon/i,
      /what time/i,
      /is (it|now) (the right )?time/i
    ],
    description: 'concerned with timing or readiness'
  },
  blockage: {
    patterns: [
      /why (can't|won't|isn't|am i not)/i,
      /what('s| is) (stopping|blocking|preventing|holding)/i,
      /what('s| is) in (the|my) way/i,
      /stuck/i,
      /obstacle/i
    ],
    description: 'sensing resistance or obstacles'
  },
  confirmation: {
    patterns: [
      /am i (right|wrong|on the right)/i,
      /is .* (a )?(good|bad|right|wrong) (idea|path|choice)/i,
      /should i (continue|keep|stay)/i
    ],
    description: 'seeking validation or reassurance'
  },
  outcome: {
    patterns: [
      /what will happen/i,
      /where .* (lead|going|headed)/i,
      /what .* (result|outcome|end)/i,
      /how will .* (turn out|end|resolve)/i
    ],
    description: 'curious about trajectory or results'
  },
  understanding: {
    patterns: [
      /what .* (learn|understand|see|realize)/i,
      /why (is|am|do|does)/i,
      /what does .* mean/i,
      /help me understand/i
    ],
    description: 'seeking insight or clarity'
  },
  exploration: {
    patterns: [
      /how can i/i,
      /what can i do/i,
      /how do i/i,
      /what .* (need|should) .* (do|know)/i
    ],
    description: 'open to guidance and possibilities'
  }
};

/**
 * Focus area patterns for subject detection
 */
const FOCUS_PATTERNS = [
  { pattern: /\b(relationship|partner|love|marriage|dating|boyfriend|girlfriend|spouse|husband|wife)\b/i, focus: 'relationship' },
  { pattern: /\b(job|career|work|boss|promotion|business|company|profession)\b/i, focus: 'career' },
  { pattern: /\b(move|relocate|house|apartment|home|living)\b/i, focus: 'living_situation' },
  { pattern: /\b(health|illness|recovery|body|medical|sick|healing)\b/i, focus: 'health' },
  { pattern: /\b(money|financial|debt|savings|income|wealth)\b/i, focus: 'finances' },
  { pattern: /\b(family|parent|child|mother|father|sibling)\b/i, focus: 'family' },
  { pattern: /\b(friend|friendship|social)\b/i, focus: 'friendship' },
  { pattern: /\b(creative|art|writing|music|project)\b/i, focus: 'creativity' },
  { pattern: /\b(spiritual|soul|purpose|meaning|path)\b/i, focus: 'spiritual' },
  { pattern: /\b(study|school|education|learning|degree)\b/i, focus: 'education' }
];

/**
 * Urgency indicators in questions
 */
const URGENCY_PATTERNS = {
  high: [/urgent/i, /immediately/i, /right now/i, /asap/i, /desperate/i, /crisis/i],
  medium: [/soon/i, /lately/i, /recently/i, /struggling/i, /worried/i],
  low: [/wondering/i, /curious/i, /thinking about/i, /considering/i]
};

/**
 * Analyze user question to determine intent, focus, and urgency
 *
 * @param {string} userQuestion - The user's question
 * @returns {Object} Question intent analysis
 */
export function analyzeQuestionIntent(userQuestion) {
  const defaultIntent = {
    type: 'open',
    typeDescription: 'open exploration',
    focus: null,
    urgency: 'medium',
    keywords: []
  };

  if (!userQuestion || typeof userQuestion !== 'string' || !userQuestion.trim()) {
    return defaultIntent;
  }

  const q = userQuestion.trim();

  // Detect question type
  let questionType = 'exploration';
  let typeDescription = 'open to guidance and possibilities';

  for (const [type, config] of Object.entries(QUESTION_PATTERNS)) {
    if (config.patterns.some(pattern => pattern.test(q))) {
      questionType = type;
      typeDescription = config.description;
      break;
    }
  }

  // Detect focus area
  let focus = null;
  for (const { pattern, focus: focusArea } of FOCUS_PATTERNS) {
    if (pattern.test(q)) {
      focus = focusArea;
      break;
    }
  }

  // Detect urgency
  let urgency = 'medium';
  for (const [level, patterns] of Object.entries(URGENCY_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(q))) {
      urgency = level;
      break;
    }
  }

  // Extract keywords (nouns and verbs that might be significant)
  const keywords = extractKeywords(q);

  return {
    type: questionType,
    typeDescription,
    focus,
    urgency,
    keywords,
    originalQuestion: q
  };
}

/**
 * Extract significant keywords from question
 */
function extractKeywords(question) {
  // Remove common words and extract potential keywords
  const stopWords = new Set([
    'i', 'me', 'my', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'will',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'can', 'could', 'should', 'would', 'what', 'when', 'where', 'why',
    'how', 'which', 'who', 'this', 'that', 'these', 'those', 'it', 'its',
    'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'about', 'and', 'or'
  ]);

  const words = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Return unique keywords
  return [...new Set(words)].slice(0, 5);
}

// ============================================================================
// NARRATIVE ARC DETECTION
// ============================================================================

/**
 * Narrative arc patterns
 */
const ARC_PATTERNS = {
  'struggle-to-resolution': {
    test: (cards) => {
      if (cards.length < 2) return false;
      const startValence = getCardValence(cards[0]);
      const endValence = getCardValence(cards[cards.length - 1]);
      return startValence < -0.2 && endValence > 0.3;
    },
    name: 'From Struggle to Resolution',
    description: 'A journey from difficulty toward healing and clarity',
    emphasis: 'transformation',
    narrativeGuidance: 'Honor where you\'ve been while trusting the trajectory ahead.',
    templateBias: 'hopeful'
  },

  'resolution-to-challenge': {
    test: (cards) => {
      if (cards.length < 2) return false;
      const startValence = getCardValence(cards[0]);
      const endValence = getCardValence(cards[cards.length - 1]);
      return startValence > 0.3 && endValence < -0.2;
    },
    name: 'Approaching a Crossroads',
    description: 'Current stability may be tested; preparation is key',
    emphasis: 'preparation',
    narrativeGuidance: 'Use your current strength to prepare for what\'s ahead.',
    templateBias: 'grounded'
  },

  'disruption-and-renewal': {
    test: (cards) => {
      const hasDisruptor = cards.some(c =>
        ['The Tower', 'Death', 'Ten of Swords', 'Three of Swords'].includes(c.card)
      );
      const hasRenewal = cards.some(c =>
        ['The Star', 'The Sun', 'Ace of Cups', 'Ace of Wands', 'The World'].includes(c.card)
      );
      return hasDisruptor && hasRenewal;
    },
    name: 'Disruption and Renewal',
    description: 'A pattern of necessary change that clears space for something new',
    emphasis: 'release and rebirth',
    narrativeGuidance: 'What falls away makes room for what\'s trying to emerge.',
    templateBias: 'transformative'
  },

  'steady-growth': {
    test: (cards) => {
      const growthCards = ['The Star', 'The Sun', 'Ace of Wands', 'Three of Wands',
        'Six of Wands', 'Nine of Cups', 'Ten of Cups', 'The World'];
      const growthCount = cards.filter(c => growthCards.includes(c.card)).length;
      return growthCount >= Math.ceil(cards.length * 0.4);
    },
    name: 'Steady Growth',
    description: 'An unfolding of potential and positive momentum',
    emphasis: 'opportunity and expansion',
    narrativeGuidance: 'Trust the upward trajectory and step into your expanding possibilities.',
    templateBias: 'encouraging'
  },

  'inner-journey': {
    test: (cards) => {
      const innerCards = ['The Hermit', 'The High Priestess', 'Four of Swords',
        'The Hanged Man', 'The Moon', 'Seven of Cups'];
      const innerCount = cards.filter(c => innerCards.includes(c.card)).length;
      return innerCount >= Math.ceil(cards.length * 0.3);
    },
    name: 'Inner Journey',
    description: 'A call to pause, reflect, and integrate before acting',
    emphasis: 'patience and depth',
    narrativeGuidance: 'The answers you seek are within; create space to listen.',
    templateBias: 'contemplative'
  },

  'active-momentum': {
    test: (cards) => {
      const actionCards = ['The Chariot', 'Knight of Wands', 'Eight of Wands',
        'Ace of Wands', 'The Magician', 'Seven of Wands', 'King of Wands'];
      const actionCount = cards.filter(c => actionCards.includes(c.card)).length;
      return actionCount >= Math.ceil(cards.length * 0.3);
    },
    name: 'Active Momentum',
    description: 'Energy is moving; this is a time for decisive action',
    emphasis: 'initiative and movement',
    narrativeGuidance: 'The moment favors bold action over extended deliberation.',
    templateBias: 'action-oriented'
  },

  'tension-and-choice': {
    test: (cards) => {
      const choiceCards = ['Two of Swords', 'Seven of Cups', 'The Lovers',
        'Two of Wands', 'Justice', 'The Chariot'];
      return cards.some(c => choiceCards.includes(c.card));
    },
    name: 'Tension and Choice',
    description: 'A crossroads requiring discernment and commitment',
    emphasis: 'clarity and decision',
    narrativeGuidance: 'Indecision has its own cost; trust yourself to choose.',
    templateBias: 'clarifying'
  }
};

/**
 * Identify the overall narrative arc of the spread
 *
 * @param {Array} cardsInfo - Array of card information objects
 * @returns {Object} Narrative arc analysis
 */
export function identifyNarrativeArc(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return {
      key: 'unknown',
      name: 'Unfolding Story',
      description: 'A story still taking shape',
      emphasis: 'openness',
      narrativeGuidance: 'Stay present to what emerges.',
      templateBias: 'neutral'
    };
  }

  // Test arc patterns in priority order
  for (const [key, arc] of Object.entries(ARC_PATTERNS)) {
    if (arc.test(cardsInfo)) {
      return {
        key,
        name: arc.name,
        description: arc.description,
        emphasis: arc.emphasis,
        narrativeGuidance: arc.narrativeGuidance,
        templateBias: arc.templateBias
      };
    }
  }

  // Default arc
  return {
    key: 'unfolding',
    name: 'Unfolding Story',
    description: 'A nuanced situation with multiple threads to consider',
    emphasis: 'awareness',
    narrativeGuidance: 'Hold the complexity without rushing to simplify.',
    templateBias: 'balanced'
  };
}

// ============================================================================
// TENSION DETECTION
// ============================================================================

/**
 * Element opposition map
 */
const OPPOSING_ELEMENTS = {
  Fire: 'Water',
  Water: 'Fire',
  Air: 'Earth',
  Earth: 'Air'
};

/**
 * Get element for a card
 * Delegates to canonical spreadAnalysis.js implementation
 */
function getCardElement(cardInfo) {
  // Guard against null/undefined input
  if (!cardInfo) return null;

  // Use explicitly set element if available
  if (cardInfo.element) return cardInfo.element;

  // Normalize the card number (handles number, cardNumber, card_number)
  const cardNum = getCardNumber(cardInfo);

  // Delegate to canonical implementation (handles both Major and Minor Arcana)
  return getCardElementCanonical(cardInfo.card, cardNum);
}

/**
 * Detect tension between two cards
 */
function detectTensionBetweenCards(card1, card2) {
  const v1 = getCardValence(card1);
  const v2 = getCardValence(card2);
  const valenceGap = Math.abs(v1 - v2);

  const tensions = [];

  // Strong valence contrast
  if (valenceGap > 1.0) {
    tensions.push({
      type: 'emotional-contrast',
      intensity: 'strong',
      description: v1 < v2
        ? `${card1.card} carries weight that ${card2.card} begins to lift`
        : `${card1.card}'s brightness meets ${card2.card}'s challenge`,
      bridgePhrase: v1 < v2
        ? 'Yet from this, something shifts—'
        : 'However, this gives way to—'
    });
  } else if (valenceGap > 0.6) {
    tensions.push({
      type: 'emotional-shift',
      intensity: 'moderate',
      description: `A notable shift in energy between ${card1.card} and ${card2.card}`,
      bridgePhrase: v1 < v2 ? 'This opens toward—' : 'This moves into—'
    });
  }

  // Elemental tension
  const e1 = getCardElement(card1);
  const e2 = getCardElement(card2);

  if (e1 && e2 && OPPOSING_ELEMENTS[e1] === e2) {
    tensions.push({
      type: 'elemental-opposition',
      intensity: 'moderate',
      elements: [e1, e2],
      description: `${e1} and ${e2} create dynamic tension requiring integration`,
      bridgePhrase: 'This elemental friction asks for balance—'
    });
  }

  // Action vs. Reflection tension
  const c1IsAction = ACTION_CARDS.has(card1.card);
  const c1IsReflection = INTROSPECTION_CARDS.has(card1.card);
  const c2IsAction = ACTION_CARDS.has(card2.card);
  const c2IsReflection = INTROSPECTION_CARDS.has(card2.card);

  if ((c1IsAction && c2IsReflection) || (c1IsReflection && c2IsAction)) {
    tensions.push({
      type: 'action-reflection',
      intensity: 'moderate',
      description: 'A pull between doing and being, action and reflection',
      bridgePhrase: c1IsAction
        ? 'Yet before moving further—'
        : 'And yet, action calls—'
    });
  }

  return tensions.length > 0 ? tensions : null;
}

/**
 * Identify key tensions across the spread
 *
 * @param {Array} cardsInfo - Array of card information objects
 * @returns {Array} Array of tension objects
 */
export function identifyTensions(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length < 2) {
    return [];
  }

  const allTensions = [];

  // Check adjacent cards
  for (let i = 0; i < cardsInfo.length - 1; i++) {
    const tensions = detectTensionBetweenCards(cardsInfo[i], cardsInfo[i + 1]);
    if (tensions) {
      tensions.forEach(t => {
        allTensions.push({
          ...t,
          positions: [i, i + 1],
          cards: [cardsInfo[i].card, cardsInfo[i + 1].card],
          positionLabels: [cardsInfo[i].position, cardsInfo[i + 1].position]
        });
      });
    }
  }

  // Check first vs. last (overall journey)
  if (cardsInfo.length >= 3) {
    const journeyTensions = detectTensionBetweenCards(cardsInfo[0], cardsInfo[cardsInfo.length - 1]);
    if (journeyTensions) {
      journeyTensions.forEach(t => {
        allTensions.push({
          ...t,
          positions: [0, cardsInfo.length - 1],
          cards: [cardsInfo[0].card, cardsInfo[cardsInfo.length - 1].card],
          positionLabels: [cardsInfo[0].position, cardsInfo[cardsInfo.length - 1].position],
          isJourneyTension: true
        });
      });
    }
  }

  // For Celtic Cross: Check specific position pairs
  if (cardsInfo.length >= 10) {
    // Present vs Outcome
    const presentOutcome = detectTensionBetweenCards(cardsInfo[0], cardsInfo[9]);
    if (presentOutcome) {
      presentOutcome.forEach(t => {
        allTensions.push({
          ...t,
          positions: [0, 9],
          cards: [cardsInfo[0].card, cardsInfo[9].card],
          positionLabels: ['Present', 'Outcome'],
          isKeyTension: true,
          significance: 'This tension between where you are and where things are heading is central to your reading.'
        });
      });
    }

    // Conscious vs Subconscious
    const consciousSub = detectTensionBetweenCards(cardsInfo[4], cardsInfo[5]);
    if (consciousSub) {
      consciousSub.forEach(t => {
        allTensions.push({
          ...t,
          positions: [4, 5],
          cards: [cardsInfo[4].card, cardsInfo[5].card],
          positionLabels: ['Conscious Goals', 'Subconscious'],
          significance: 'What you consciously want may not align with deeper needs—worth exploring.'
        });
      });
    }
  }

  // Sort by intensity and key tension status
  return allTensions.sort((a, b) => {
    if (a.isKeyTension && !b.isKeyTension) return -1;
    if (!a.isKeyTension && b.isKeyTension) return 1;
    if (a.intensity === 'strong' && b.intensity !== 'strong') return -1;
    if (a.intensity !== 'strong' && b.intensity === 'strong') return 1;
    return 0;
  });
}

// ============================================================================
// THROUGHLINE & PIVOT DETECTION
// ============================================================================

/**
 * Identify recurring themes/throughlines across cards
 *
 * @param {Array} cardsInfo - Array of card information objects
 * @param {Object} themes - Theme analysis from spread analysis
 * @returns {Array} Array of throughline descriptions
 */
export function identifyThroughlines(cardsInfo, themes) {
  if (!Array.isArray(cardsInfo)) return [];

  const throughlines = [];

  // Element dominance
  const elementCounts = { Fire: 0, Water: 0, Air: 0, Earth: 0 };
  cardsInfo.forEach(card => {
    const element = getCardElement(card);
    if (element) elementCounts[element]++;
  });

  const dominant = Object.entries(elementCounts)
    .filter(([_, count]) => count >= Math.ceil(cardsInfo.length * 0.4))
    .map(([element]) => element);

  if (dominant.length === 1) {
    const elementThemes = {
      Fire: 'passion, initiative, and creative energy',
      Water: 'emotions, intuition, and relationships',
      Air: 'thoughts, communication, and clarity',
      Earth: 'practical matters, resources, and stability'
    };
    throughlines.push(`Strong ${dominant[0]} energy emphasizes ${elementThemes[dominant[0]]}.`);
  }

  // Major Arcana density (using normalized card number)
  const majorCount = cardsInfo.filter(c => isMajorArcana(c)).length;
  if (majorCount >= Math.ceil(cardsInfo.length * 0.5)) {
    throughlines.push('High Major Arcana presence suggests significant life themes at play, not just day-to-day concerns.');
  }

  // Reversal pattern
  const reversedCount = cardsInfo.filter(c =>
    (c.orientation || '').toLowerCase() === 'reversed'
  ).length;

  if (reversedCount === 0) {
    throughlines.push('All cards upright suggests energy is flowing without major blockages.');
  } else if (reversedCount >= Math.ceil(cardsInfo.length * 0.5)) {
    throughlines.push('Many reversals suggest internalized processes or areas needing attention before external progress.');
  }

  // Suit focus (from themes)
  if (themes?.suitFocus) {
    throughlines.push(themes.suitFocus);
  }

  // Court card presence
  const courtCards = cardsInfo.filter(c =>
    ['Page', 'Knight', 'Queen', 'King'].some(rank => c.card?.includes(rank))
  );
  if (courtCards.length >= 2) {
    throughlines.push('Multiple court cards suggest other people or aspects of yourself are actively involved in this situation.');
  }

  return throughlines.slice(0, 4); // Limit to most relevant
}

/**
 * Identify the pivot card (turning point/leverage point)
 *
 * @param {Array} cardsInfo - Array of card information objects
 * @param {string} spreadKey - Spread type identifier
 * @returns {Object|null} Pivot card information
 */
export function identifyPivotCard(cardsInfo, spreadKey = 'general') {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) return null;

  // Position-based pivot for known spreads
  const pivotPositions = {
    celtic: 6, // Advice position (Card 7, index 6)
    threeCard: 1, // Present position
    fiveCard: 0, // Core position
    decision: 3, // Clarifier position
    relationship: 2 // Connection position
  };

  if (pivotPositions[spreadKey] !== undefined) {
    const pivotIndex = pivotPositions[spreadKey];
    if (cardsInfo[pivotIndex]) {
      return {
        ...cardsInfo[pivotIndex],
        index: pivotIndex,
        reason: getPivotReason(spreadKey, pivotIndex)
      };
    }
  }

  // For unknown spreads, find the card with highest weight or most tension
  let bestPivot = null;
  let highestScore = -Infinity;

  cardsInfo.forEach((card, index) => {
    let score = 0;

    // Weight from position
    const weight = getPositionWeight(spreadKey, index);
    score += weight * 10;

    // Transition cards are natural pivots
    if (TRANSITION_CARDS.has(card.card)) score += 5;

    // Cards in the middle are more likely pivots
    const middleBonus = 1 - Math.abs((index / cardsInfo.length) - 0.5);
    score += middleBonus * 3;

    if (score > highestScore) {
      highestScore = score;
      bestPivot = { ...card, index, reason: 'This card sits at a point of leverage in your spread.' };
    }
  });

  return bestPivot;
}

function getPivotReason(spreadKey, index) {
  const reasons = {
    celtic: {
      6: 'The Advice position shows how to engage with everything else in the spread.'
    },
    threeCard: {
      1: 'The Present is your point of power—where awareness becomes choice.'
    },
    fiveCard: {
      0: 'The Core reveals what everything else revolves around.'
    },
    decision: {
      3: 'The Clarifier illuminates what your deeper wisdom already knows.'
    },
    relationship: {
      2: 'The Connection shows what the relationship itself is asking for.'
    }
  };

  return reasons[spreadKey]?.[index] || 'This position carries particular leverage in your situation.';
}

// ============================================================================
// EMOTIONAL ARC MAPPING
// ============================================================================

/**
 * Map the emotional journey across the spread
 *
 * @param {Array} cardsInfo - Array of card information objects
 * @returns {Object} Emotional arc analysis
 */
export function mapEmotionalArc(cardsInfo) {
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    return null;
  }

  const valences = cardsInfo.map(card => ({
    card: card.card,
    position: card.position,
    valence: getCardValence(card),
    quality: getEmotionalQuality(getCardValence(card))
  }));

  const startQuality = valences[0].quality;
  const endQuality = valences[valences.length - 1].quality;

  // Find emotional peaks and valleys
  let peak = valences[0];
  let valley = valences[0];

  valences.forEach(v => {
    if (v.valence > peak.valence) peak = v;
    if (v.valence < valley.valence) valley = v;
  });

  // Determine arc direction
  const startValence = valences[0].valence;
  const endValence = valences[valences.length - 1].valence;
  let direction = 'stable';

  if (endValence - startValence > 0.4) direction = 'ascending';
  else if (startValence - endValence > 0.4) direction = 'descending';
  else if (Math.abs(peak.valence - valley.valence) > 0.8) direction = 'oscillating';

  return {
    start: startQuality,
    end: endQuality,
    direction,
    peak: peak.valence > 0.3 ? peak : null,
    valley: valley.valence < -0.3 ? valley : null,
    journey: valences,
    summary: buildEmotionalSummary(startQuality, endQuality, direction, peak, valley)
  };
}

function buildEmotionalSummary(start, end, direction, peak, valley) {
  if (direction === 'ascending') {
    return `This reading moves from ${start} toward ${end}—an upward emotional trajectory.`;
  }
  if (direction === 'descending') {
    return `This reading moves from ${start} into ${end}—prepare for and work with what's coming.`;
  }
  if (direction === 'oscillating') {
    const peakNote = peak ? ` reaching toward ${peak.quality} at ${peak.card}` : '';
    const valleyNote = valley ? ` and touching ${valley.quality} at ${valley.card}` : '';
    return `This reading moves through varied emotional terrain${peakNote}${valleyNote}.`;
  }
  return `The emotional tone remains relatively steady, centered around ${start}.`;
}

// ============================================================================
// EMPHASIS MAP
// ============================================================================

/**
 * Build a map of how much emphasis each position should receive
 *
 * @param {Array} cardsInfo - Array of card information objects
 * @param {Object} reasoning - Partial reasoning object
 * @returns {Array} Array of emphasis objects per position
 */
export function buildEmphasisMap(cardsInfo, reasoning) {
  if (!Array.isArray(cardsInfo)) return [];

  return cardsInfo.map((card, index) => {
    let emphasis = 'normal';
    const reasons = [];

    // Check if this is the pivot card
    if (reasoning.pivotCard?.index === index) {
      emphasis = 'high';
      reasons.push('pivot position');
    }

    // Check if this card is part of a key tension
    const isInKeyTension = reasoning.tensions?.some(t =>
      t.isKeyTension && t.positions.includes(index)
    );
    if (isInKeyTension) {
      emphasis = 'high';
      reasons.push('key tension');
    }

    // Check if this is emotional peak or valley
    if (reasoning.emotionalArc?.peak?.card === card.card) {
      emphasis = emphasis === 'high' ? 'high' : 'moderate';
      reasons.push('emotional peak');
    }
    if (reasoning.emotionalArc?.valley?.card === card.card) {
      emphasis = emphasis === 'high' ? 'high' : 'moderate';
      reasons.push('emotional valley');
    }

    // Major Arcana get slightly more emphasis (using normalized card number)
    if (isMajorArcana(card)) {
      if (emphasis === 'normal') emphasis = 'moderate';
      reasons.push('Major Arcana');
    }

    return {
      index,
      card: card.card,
      position: card.position,
      emphasis,
      reasons
    };
  });
}

// ============================================================================
// MAIN REASONING CHAIN BUILDER
// ============================================================================

/**
 * Build complete reasoning chain for a reading
 *
 * This is the main entry point that orchestrates all analysis functions
 * to produce a comprehensive reasoning object that informs narrative construction.
 *
 * @param {Array} cardsInfo - Array of card information objects
 * @param {string} userQuestion - The user's question
 * @param {string} context - Reading context (love, career, etc.)
 * @param {Object} themes - Theme analysis from spread analysis
 * @param {string} spreadKey - Spread type identifier
 * @returns {Object} Complete reasoning chain
 */
export function buildReadingReasoning(cardsInfo, userQuestion, context, themes, spreadKey = 'general') {
  // Step 1: Analyze the question
  const questionIntent = analyzeQuestionIntent(userQuestion);

  // Step 2: Identify narrative arc
  const narrativeArc = identifyNarrativeArc(cardsInfo);

  // Step 3: Detect tensions
  const tensions = identifyTensions(cardsInfo);

  // Step 4: Find throughlines
  const throughlines = identifyThroughlines(cardsInfo, themes);

  // Step 5: Identify pivot card
  const pivotCard = identifyPivotCard(cardsInfo, spreadKey);

  // Step 6: Map emotional arc
  const emotionalArc = mapEmotionalArc(cardsInfo);

  // Build partial reasoning for emphasis map
  const partialReasoning = { pivotCard, tensions, emotionalArc };

  // Step 7: Build emphasis map
  const emphasisMap = buildEmphasisMap(cardsInfo, partialReasoning);

  // Step 8: Generate synthesis hooks
  const synthesisHooks = buildSynthesisHooks(questionIntent, narrativeArc, tensions, pivotCard);

  return {
    questionIntent,
    narrativeArc,
    tensions,
    throughlines,
    pivotCard,
    emotionalArc,
    emphasisMap,
    synthesisHooks,
    context,
    spreadKey,
    cardCount: cardsInfo?.length || 0,
    timestamp: Date.now()
  };
}

/**
 * Build hooks for synthesis section based on reasoning
 */
function buildSynthesisHooks(questionIntent, narrativeArc, tensions, pivotCard) {
  const hooks = [];

  // Question-responsive hook
  if (questionIntent.type === 'decision') {
    hooks.push({
      type: 'question-response',
      text: 'You asked about a choice. The cards illuminate what each path asks of you, not which is "right."'
    });
  } else if (questionIntent.type === 'timing') {
    hooks.push({
      type: 'question-response',
      text: 'Regarding timing: the cards speak to readiness and trajectory rather than calendar dates.'
    });
  } else if (questionIntent.type === 'blockage') {
    hooks.push({
      type: 'question-response',
      text: 'You sense something in the way. The cards reveal what this resistance is made of.'
    });
  } else if (questionIntent.type === 'confirmation') {
    hooks.push({
      type: 'question-response',
      text: 'You\'re looking for confirmation. The cards offer perspective, not permission—trust your knowing.'
    });
  }

  // Arc hook
  if (narrativeArc.key !== 'unfolding') {
    hooks.push({
      type: 'arc',
      text: `**The Overall Shape:** ${narrativeArc.description}`
    });
  }

  // Key tension hook
  const keyTension = tensions.find(t => t.isKeyTension);
  if (keyTension) {
    hooks.push({
      type: 'tension',
      text: `**Core Dynamic:** ${keyTension.description}. ${keyTension.significance || ''}`
    });
  }

  // Pivot hook
  if (pivotCard) {
    hooks.push({
      type: 'pivot',
      text: `**The Pivot:** ${pivotCard.card} in ${pivotCard.position}. ${pivotCard.reason}`
    });
  }

  return hooks;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  getCardElement,
  detectTensionBetweenCards
  // getCardNumber is exported at function definition; isMajorArcana is exported above.
};
