import { getSymbolFollowUpPrompt } from './symbolElementBridge';

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
export function generateFollowUpSuggestions(reading, themes, readingMeta) {
  const suggestions = [];
  const spreadKey = readingMeta?.spreadKey || 'general';

  // Normalize reading array
  const cards = Array.isArray(reading) ? reading : [];

  // 1. Reversed card exploration (high priority)
  const reversedCards = cards.filter(c =>
    c.isReversed || c.orientation === 'reversed'
  );

  if (reversedCards.length === 1) {
    const cardName = reversedCards[0].name || reversedCards[0].card || 'this card';
    suggestions.push({
      text: `What does ${cardName} reversed want me to understand?`,
      type: 'reversal',
      priority: 1
    });
  } else if (reversedCards.length > 1) {
    suggestions.push({
      text: 'What pattern do the reversed cards reveal together?',
      type: 'reversal',
      priority: 1
    });
  }

  // 2. Spread-specific questions
  const spreadQuestions = {
    celtic: [
      { text: 'How do the crossing and outcome cards connect?', priority: 2 },
      { text: 'What does the subconscious foundation reveal about this situation?', priority: 3 }
    ],
    threeCard: [
      { text: 'How does the present card bridge past and future?', priority: 2 },
      { text: 'What action bridges where I am and where I\'m heading?', priority: 3 }
    ],
    relationship: [
      { text: 'How can I better understand the other person\'s perspective?', priority: 2 },
      { text: 'What shared ground do these cards suggest?', priority: 3 }
    ],
    decision: [
      { text: 'Which path aligns more with my values?', priority: 2 },
      { text: 'What factor should weigh most in my choice?', priority: 3 }
    ],
    single: [
      { text: 'What specific action does this card suggest for today?', priority: 2 }
    ],
    fiveCard: [
      { text: 'How does the support card help address the challenge?', priority: 2 }
    ]
  };

  if (spreadQuestions[spreadKey]) {
    spreadQuestions[spreadKey].forEach(q => {
      suggestions.push({ ...q, type: 'spread' });
    });
  }

  // 3. Elemental imbalance questions
  if (themes?.elementCounts) {
    const elements = Object.entries(themes.elementCounts);
    const sorted = elements.sort(([, a], [, b]) => b - a);
    const dominant = sorted[0];
    const missing = elements.filter(([, count]) => count === 0).map(([el]) => el);

    if (dominant && dominant[1] >= 3) {
      suggestions.push({
        text: `What does the strong ${dominant[0]} energy suggest I need?`,
        type: 'elemental',
        priority: 3
      });
    }

    if (missing.length > 0 && missing.length < 4) {
      suggestions.push({
        text: `What might the absence of ${missing[0]} energy mean?`,
        type: 'elemental',
        priority: 4
      });
    }
  }

  // 4. Major Arcana emphasis
  // Be conservative: lots of call sites/tests omit `suit` for Minors.
  // Use explicit major flags when available; otherwise, fall back to name + 0–21 guard.
  const looksLikeMinorByName = (name) => {
    if (!name || typeof name !== 'string') return false;
    return /^(ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king)\s+of\s+/i.test(name.trim());
  };

  const majorCards = cards.filter((c) => {
    if (!c || typeof c !== 'object') return false;

    // Explicit major arcana flag.
    if (c.arcana === 'major' || c.isMajor) return true;

    // If suit is present, treat as Minor.
    const suit = typeof c.suit === 'string' ? c.suit.trim() : '';
    if (suit) return false;

    const candidateName = (c.name || c.card || '').trim();
    if (!candidateName) return false;
    if (looksLikeMinorByName(candidateName)) return false;

    const num = c.arcanaNumber ?? c.number;
    return typeof num === 'number' && num >= 0 && num <= 21;
  });

  if (majorCards.length >= 3) {
    suggestions.push({
      text: 'What life lesson do these Major Arcana cards emphasize?',
      type: 'archetype',
      priority: 2
    });
  }

  // 5. Suit-focused questions (when one suit dominates)
  if (themes?.suitCounts) {
    const suitEntries = Object.entries(themes.suitCounts);
    const dominantSuit = suitEntries.sort(([, a], [, b]) => b - a)[0];

    if (dominantSuit && dominantSuit[1] >= 3) {
      const suitQuestions = {
        cups: 'How can I better honor my emotional needs right now?',
        wands: 'What creative or passionate energy wants to be expressed?',
        swords: 'What mental patterns or communications need attention?',
        pentacles: 'What practical steps would ground this guidance?'
      };

      const suitKey = dominantSuit[0].toLowerCase();
      if (suitQuestions[suitKey]) {
        suggestions.push({
          text: suitQuestions[suitKey],
          type: 'suit',
          priority: 3
        });
      }
    }
  }

  // 6. Question-focused (connects reading back to their original question)
  if (readingMeta?.userQuestion && readingMeta.userQuestion.length > 10) {
    suggestions.push({
      text: 'What\'s the most direct answer to my question here?',
      type: 'question',
      priority: 2
    });
  }

  // 7. Symbol-based reflection (when symbol annotations exist)
  const symbolPrompt = getSymbolFollowUpPrompt(cards, themes);
  if (symbolPrompt) {
    suggestions.push({
      text: symbolPrompt,
      type: 'symbol',
      priority: 4
    });
  }

  // 8. Shadow/challenge questions (always useful)
  suggestions.push({
    text: 'What might be blocking me from moving forward?',
    type: 'shadow',
    priority: 5
  });

  // 9. Action-oriented (always include as fallback)
  suggestions.push({
    text: 'What\'s the single most important thing I should focus on?',
    type: 'action',
    priority: 5
  });

  // 10. Relationship between cards question (for multi-card spreads)
  if (cards.length >= 2) {
    suggestions.push({
      text: 'How do these cards speak to each other?',
      type: 'synthesis',
      priority: 4
    });
  }

  // Sort by priority and deduplicate by text
  const seen = new Set();
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .filter(item => {
      if (seen.has(item.text)) return false;
      seen.add(item.text);
      return true;
    })
    .slice(0, 4);
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