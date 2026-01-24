import { getSymbolFollowUpPrompt } from './symbolElementBridge.js';
import { hashString, seededShuffle } from '../../shared/utils.js';

/**
 * Follow-Up Question Suggestions Generator
 *
 * Generates contextual follow-up question suggestions based on the reading.
 * Used by FollowUpChat component to provide quick-tap question options.
 */

/**
 * Generate contextual follow-up question suggestions based on the reading
 *
 * @param {Array} reading - Array of card objects from the reading
 * @param {Object} themes - Theme analysis (elementCounts, reversalCount, etc.)
 * @param {Object} readingMeta - Reading metadata (spreadKey, etc.)
 * @returns {Array<{text: string, type: string, priority: number}>}
 */
export function generateFollowUpSuggestions(reading, themes, readingMeta, options = {}) {
  const suggestions = [];
  const cards = Array.isArray(reading) ? reading : [];
  const spreadKey = options.spreadKey || readingMeta?.spreadKey || 'general';
  const userQuestion = options.userQuestion || readingMeta?.userQuestion || '';
  const limit = Number.isFinite(options.limit) ? options.limit : 4;
  const rotationSeedBase = String(options.rotationSeed || readingMeta?.requestId || readingMeta?.spreadKey || 'reading');
  const rotationIndex = Number.isFinite(options.rotationIndex) ? options.rotationIndex : 0;
  const rotationSeed = hashString(`${rotationSeedBase}:${rotationIndex}`);

  const suitElements = {
    Wands: 'Fire',
    Cups: 'Water',
    Swords: 'Air',
    Pentacles: 'Earth'
  };

  const getCardName = (card) => card?.name || card?.card || card?.canonicalName || 'this card';
  const normalizeText = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizeOrientation = (card) => String(card?.orientation || '').toLowerCase();
  const isReversed = (card) => Boolean(card?.isReversed) || normalizeOrientation(card) === 'reversed';

  const looksLikeMinorByName = (name) => {
    if (!name || typeof name !== 'string') return false;
    return /^(ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king)\s+of\s+/i.test(name.trim());
  };

  const isMajor = (card) => {
    if (!card || typeof card !== 'object') return false;
    if (card.arcana === 'major' || card.isMajor) return true;
    const suit = typeof card.suit === 'string' ? card.suit.trim() : '';
    if (suit) return false;
    const candidateName = (card.name || card.card || '').trim();
    if (!candidateName) return false;
    if (looksLikeMinorByName(candidateName)) return false;
    const num = card.arcanaNumber ?? card.number;
    return typeof num === 'number' && num >= 0 && num <= 21;
  };

  const getSuitCounts = () => {
    if (themes?.suitCounts && typeof themes.suitCounts === 'object') {
      return themes.suitCounts;
    }
    return cards.reduce((acc, card) => {
      const name = card?.name || card?.card || '';
      const suit = card?.suit || Object.keys(suitElements).find((key) => name.includes(key));
      if (suit && acc[suit] !== undefined) {
        acc[suit] += 1;
      }
      return acc;
    }, { Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 });
  };

  const getElementCounts = (suitCounts) => {
    if (themes?.elementCounts && typeof themes.elementCounts === 'object') {
      return themes.elementCounts;
    }
    return Object.entries(suitCounts).reduce((acc, [suit, count]) => {
      const element = suitElements[suit];
      if (element) {
        acc[element] = (acc[element] || 0) + count;
      }
      return acc;
    }, { Fire: 0, Water: 0, Air: 0, Earth: 0 });
  };

  const getDominantEntry = (counts) => {
    const entries = Object.entries(counts || {}).filter(([, count]) => Number.isFinite(count));
    if (entries.length === 0) return null;
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return null;
    const [key, count] = entries.sort((a, b) => b[1] - a[1])[0];
    return { key, count, ratio: total > 0 ? count / total : 0, total };
  };

  const suitCounts = getSuitCounts();
  const elementCounts = getElementCounts(suitCounts);
  const dominantSuit = themes?.dominantSuit || getDominantEntry(suitCounts)?.key || null;
  const dominantElement = themes?.dominantElement || getDominantEntry(elementCounts)?.key || null;
  const dominantSuitEntry = getDominantEntry(suitCounts);
  const dominantElementEntry = getDominantEntry(elementCounts);
  const reversalCount = Number.isFinite(themes?.reversalCount)
    ? themes.reversalCount
    : cards.filter((card) => isReversed(card)).length;
  const majorCount = cards.filter((card) => isMajor(card)).length;
  const majorRatio = Number.isFinite(themes?.majorRatio)
    ? themes.majorRatio
    : (cards.length > 0 ? majorCount / cards.length : 0);

  const addSuggestion = ({ text, type, priority, anchorKey, triggerKey }) => {
    if (!text || !type) return;
    suggestions.push({
      text,
      type,
      priority,
      anchorKey: anchorKey || null,
      triggerKey: triggerKey || null
    });
  };

  // 1. Reversal exploration (high priority)
  if (reversalCount === 1) {
    const reversedCard = cards.find((card) => isReversed(card));
    const cardName = getCardName(reversedCard);
    addSuggestion({
      text: `What does ${cardName} reversed want me to acknowledge or release?`,
      type: 'reversal',
      priority: 1,
      anchorKey: cardName,
      triggerKey: 'single-reversal'
    });
  } else if (reversalCount > 1) {
    addSuggestion({
      text: 'What pattern links the reversed cards, and where is that energy blocked or internal?',
      type: 'reversal',
      priority: 1,
      triggerKey: 'multi-reversal'
    });
  }

  // 2. Spread-specific questions (with coverage across spreads)
  const spreadQuestions = {
    celtic: [
      { text: 'How do the Challenge and Outcome positions connect?', anchorKey: 'challenge-outcome', priority: 2 },
      { text: 'What do the Subconscious and Conscious positions say about each other?', anchorKey: 'subconscious-conscious', priority: 3 },
      { text: 'How does the Near Future echo the Present?', anchorKey: 'near-future-present', priority: 3 }
    ],
    threeCard: [
      { text: 'How does the Present bridge the Past and Future?', anchorKey: 'present-bridge', priority: 2 },
      { text: 'What would shift the Future if I act now?', anchorKey: 'future-shift', priority: 3 }
    ],
    relationship: [
      { text: 'How can I better understand the other person\'s perspective here?', anchorKey: 'them-perspective', priority: 2 },
      { text: 'What shared lesson do the connection cards point to?', anchorKey: 'connection-lesson', priority: 3 }
    ],
    decision: [
      { text: 'Which path aligns more with my values and long-term direction?', anchorKey: 'path-values', priority: 2 },
      { text: 'What clarifier matters most before choosing?', anchorKey: 'clarifier', priority: 3 }
    ],
    single: [
      { text: 'What specific action does this card suggest for today?', anchorKey: 'single-action', priority: 2 },
      { text: 'What would change if I fully embodied this card?', anchorKey: 'single-embody', priority: 3 }
    ],
    fiveCard: [
      { text: 'How does the Support card help resolve the Challenge?', anchorKey: 'support-challenge', priority: 2 },
      { text: 'What does the Hidden influence reveal about the Core?', anchorKey: 'hidden-core', priority: 3 }
    ]
  };

  if (spreadQuestions[spreadKey]) {
    spreadQuestions[spreadKey].forEach((q) => {
      addSuggestion({ ...q, type: 'spread' });
    });
  }

  // 3. Elemental imbalance questions
  if (dominantElementEntry && dominantElementEntry.ratio >= 0.4 && dominantElementEntry.total >= 3) {
    addSuggestion({
      text: `What does the strong ${dominantElement} energy suggest I need most right now?`,
      type: 'elemental',
      priority: 3,
      anchorKey: dominantElement,
      triggerKey: 'dominant-element'
    });
  }

  const missingElements = Object.entries(elementCounts)
    .filter(([, count]) => count === 0)
    .map(([element]) => element);
  if (missingElements.length > 0 && missingElements.length < 4) {
    addSuggestion({
      text: `What might the absence of ${missingElements[0]} energy mean for this situation?`,
      type: 'elemental',
      priority: 4,
      anchorKey: missingElements[0],
      triggerKey: 'missing-element'
    });
  }

  // 4. Major Arcana emphasis
  if (majorRatio >= 0.35 || majorCount >= 3) {
    addSuggestion({
      text: 'What life lesson do these Major Arcana cards emphasize?',
      type: 'archetype',
      priority: 2,
      triggerKey: 'major-emphasis'
    });
  }

  // 5. Suit-focused questions (when one suit dominates)
  if (dominantSuitEntry && dominantSuitEntry.ratio >= 0.4 && dominantSuitEntry.total >= 3) {
    const suitQuestions = {
      Wands: 'What creative or passionate energy wants to be expressed?',
      Cups: 'How can I better honor my emotional needs right now?',
      Swords: 'What mental patterns or conversations need attention?',
      Pentacles: 'What practical steps would ground this guidance?'
    };
    const suitKey = dominantSuit;
    if (suitQuestions[suitKey]) {
      addSuggestion({
        text: suitQuestions[suitKey],
        type: 'suit',
        priority: 3,
        anchorKey: suitKey,
        triggerKey: 'dominant-suit'
      });
    }
  }

  // 6. Question-focused
  if (typeof userQuestion === 'string' && userQuestion.trim().length > 10) {
    const snippet = userQuestion.trim().slice(0, 36);
    const suffix = userQuestion.trim().length > 36 ? '...' : '';
    addSuggestion({
      text: `What is the most direct answer to my question about "${snippet}${suffix}"?`,
      type: 'question',
      priority: 2,
      triggerKey: 'user-question'
    });
  }

  // 7. Symbol-based reflection
  const symbolPrompt = getSymbolFollowUpPrompt(cards, themes);
  if (symbolPrompt) {
    addSuggestion({
      text: symbolPrompt,
      type: 'symbol',
      priority: 4,
      triggerKey: 'symbol'
    });
  }

  // 8. Shadow/challenge questions (fallback)
  addSuggestion({
    text: 'What might be blocking me from moving forward?',
    type: 'shadow',
    priority: 5,
    triggerKey: 'shadow'
  });

  // 9. Action-oriented (fallback)
  addSuggestion({
    text: 'What\'s the single most important thing I should focus on?',
    type: 'action',
    priority: 5,
    triggerKey: 'action'
  });

  // 10. Relationship between cards (multi-card)
  if (cards.length >= 2) {
    addSuggestion({
      text: 'How do these cards change each other\'s meaning when read together?',
      type: 'synthesis',
      priority: 4,
      triggerKey: 'synthesis'
    });
  }

  const dedupe = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${normalizeText(item.text)}::${item.anchorKey || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const orderCandidates = (items, seedTag) => {
    const grouped = items.reduce((acc, item) => {
      const key = Number.isFinite(item.priority) ? item.priority : 10;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
    return Object.keys(grouped)
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((priority) => {
        const seed = hashString(`${rotationSeed}:${seedTag}:${priority}`);
        return seededShuffle(grouped[priority], seed);
      });
  };

  const coreTypes = new Set(['reversal', 'spread', 'question']);
  const patternTypes = new Set(['elemental', 'suit', 'archetype', 'symbol', 'synthesis']);

  const deduped = dedupe(suggestions);
  const orderedAll = orderCandidates(deduped, 'all');
  const orderedCore = orderCandidates(deduped.filter((s) => coreTypes.has(s.type)), 'core');
  const orderedPattern = orderCandidates(deduped.filter((s) => patternTypes.has(s.type)), 'pattern');

  const selected = [];
  const used = new Set();

  const take = (item) => {
    if (!item) return;
    if (used.has(item)) return;
    selected.push(item);
    used.add(item);
  };

  take(orderedCore[0]);
  if (selected.length < limit) {
    take(orderedPattern.find((item) => !used.has(item)));
  }
  orderedAll.forEach((item) => {
    if (selected.length >= limit) return;
    if (used.has(item)) return;
    selected.push(item);
    used.add(item);
  });

  return selected.slice(0, limit);
}

/**
 * Get question type description for analytics
 *
 * @param {string} type - Question type
 * @returns {string} Human-readable description
 */
export function getQuestionTypeLabel(type) {
  const labels = {
    reversal: 'Reversed Card',
    spread: 'Spread-Specific',
    elemental: 'Elemental Balance',
    archetype: 'Archetypal/Major Arcana',
    suit: 'Suit Focus',
    question: 'Original Question',
    symbol: 'Symbol Reflection',
    shadow: 'Shadow/Blocks',
    action: 'Action-Oriented',
    synthesis: 'Card Relationships'
  };
  return labels[type] || 'General';
}

/**
 * Generate position-specific questions for a card
 * Used for "Tell me more about X" style follow-ups
 *
 * @param {Object} card - Card object with position info
 * @param {string} spreadKey - Type of spread
 * @returns {Array<string>} Position-specific questions
 */
export function getPositionQuestions(card, spreadKey) {
  const cardName = card?.name || card?.card || 'this card';
  const position = card?.position || 'this position';

  // Generic questions that work for any position
  const generic = [
    `What does ${cardName} want me to understand about ${position}?`,
    `How does ${cardName} relate to my original question?`
  ];

  // Position-specific questions for Celtic Cross
  const celticPositions = {
    'Present Situation': [
      `What core energy is ${cardName} bringing to my situation right now?`
    ],
    'Challenge/Crossing': [
      `How can I work with the challenge ${cardName} represents?`,
      `What opportunity is hidden in this challenge?`
    ],
    'Subconscious Foundation': [
      `What hidden influence is ${cardName} revealing?`
    ],
    'Recent Past': [
      `How has the energy of ${cardName} been shaping my path?`
    ],
    'Possible Outcome': [
      `What trajectory is ${cardName} showing me?`,
      `What choices could shift this outcome?`
    ],
    'Near Future': [
      `What should I prepare for with ${cardName} approaching?`
    ],
    'Self': [
      `What aspect of myself does ${cardName} reflect?`
    ],
    'Environment': [
      `How is ${cardName} showing up in my surroundings?`
    ],
    'Hopes & Fears': [
      `Is ${cardName} representing hope or fear here?`
    ],
    'Final Outcome': [
      `What is ${cardName} suggesting about where this leads?`
    ]
  };

  // Position-specific for Three-Card
  const threeCardPositions = {
    'Past': [
      `How has ${cardName} influenced where I am today?`
    ],
    'Present': [
      `What current energy does ${cardName} want me to embrace?`
    ],
    'Future': [
      `What is ${cardName} inviting me toward?`
    ]
  };

  // Select appropriate position questions
  let positionSpecific = [];
  if (spreadKey === 'celtic' && celticPositions[position]) {
    positionSpecific = celticPositions[position];
  } else if (spreadKey === 'threeCard' && threeCardPositions[position]) {
    positionSpecific = threeCardPositions[position];
  }

  return [...positionSpecific, ...generic].slice(0, 3);
}

export default generateFollowUpSuggestions;
