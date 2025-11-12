/**
 * Spread Analysis Library
 *
 * Provides authentic tarot reading analysis including:
 * - Elemental correspondences and dignities
 * - Position-relationship synthesis
 * - Theme analysis (suits, elements, reversals)
 * - Spread-specific structural analysis
 */

/**
 * Traditional elemental correspondences for Major Arcana
 * Based on Golden Dawn / Rider-Waite-Smith astrological associations
 */
export const MAJOR_ELEMENTS = {
  0: 'Air',      // The Fool (Uranus/Air)
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
  12: 'Water',   // The Hanged Man (Neptune)
  13: 'Water',   // Death (Scorpio)
  14: 'Fire',    // Temperance (Sagittarius)
  15: 'Earth',   // The Devil (Capricorn)
  16: 'Fire',    // The Tower (Mars)
  17: 'Air',     // The Star (Aquarius)
  18: 'Water',   // The Moon (Pisces)
  19: 'Fire',    // The Sun (Sun)
  20: 'Fire',    // Judgement (Pluto)
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

/**
 * Get elemental correspondence for any card
 */
export function getCardElement(cardName, cardNumber) {
  // Major Arcana (0-21)
  if (cardNumber !== undefined && cardNumber >= 0 && cardNumber <= 21) {
    return MAJOR_ELEMENTS[cardNumber] || null;
  }

  // Minor Arcana - extract suit from card name
  for (const [suit, element] of Object.entries(SUIT_ELEMENTS)) {
    if (cardName.includes(suit)) {
      return element;
    }
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
 * - Same element amplifies
 */
export function analyzeElementalDignity(card1, card2) {
  if (!card1 || !card2) {
    return {
      relationship: 'neutral',
      description: null
    };
  }

  const e1 = getCardElement(card1.card || '', card1.number);
  const e2 = getCardElement(card2.card || '', card2.number);

  if (!e1 || !e2) {
    return {
      relationship: 'neutral',
      description: null
    };
  }

  // Same element
  if (e1 === e2) {
    return {
      relationship: 'amplified',
      element: e1,
      description: `Both ${e1} cards reinforce and intensify this elemental energy`
    };
  }

  const pair = `${e1}-${e2}`;

  // Supportive combinations (active or receptive pairs)
  if (['Fire-Air', 'Air-Fire', 'Water-Earth', 'Earth-Water'].includes(pair)) {
    return {
      relationship: 'supportive',
      elements: [e1, e2],
      description: `${e1} and ${e2} work harmoniously together, each supporting the other's expression`
    };
  }

  // Tension combinations (opposing qualities)
  if (['Fire-Water', 'Water-Fire', 'Air-Earth', 'Earth-Air'].includes(pair)) {
    return {
      relationship: 'tension',
      elements: [e1, e2],
      description: `${e1} and ${e2} create friction that must be balanced and integrated`
    };
  }

  return {
    relationship: 'neutral',
    description: null
  };
}

/**
 * Analyze themes across entire spread
 * Detects suit dominance, elemental balance, Major density, reversal patterns
 *
 * Accepts optional options:
 * - reversalFrameworkOverride: if provided and valid, forces that framework.
 */
export function analyzeSpreadThemes(cardsInfo, options = {}) {
  const suitCounts = { Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 };
  const elementCounts = { Fire: 0, Water: 0, Air: 0, Earth: 0 };
  let majorCount = 0;
  let reversalCount = 0;
  const numbers = [];

  cardsInfo.forEach(card => {
    // Count Majors (numbers 0-21)
    if (card.number >= 0 && card.number <= 21) {
      majorCount++;
    }

    // Count suits
    for (const suit of Object.keys(suitCounts)) {
      if (card.card.includes(suit)) {
        suitCounts[suit]++;
        break;
      }
    }

    // Count elements
    const element = getCardElement(card.card, card.number);
    if (element && elementCounts[element] !== undefined) {
      elementCounts[element]++;
    }

    // Count reversals
    if (card.orientation === 'Reversed') {
      reversalCount++;
    }

    // Collect numbers for lifecycle analysis
    if (typeof card.number === 'number') {
      numbers.push(card.number);
    }
  });

  const totalCards = cardsInfo.length;
  const reversalRatio = reversalCount / totalCards;
  const majorRatio = majorCount / totalCards;

  // Find dominant suit
  const dominantSuitEntry = Object.entries(suitCounts)
    .sort((a, b) => b[1] - a[1])[0];

  // Find dominant element
  const dominantElementEntry = Object.entries(elementCounts)
    .sort((a, b) => b[1] - a[1])[0];

  // Calculate average card number
  const avgNumber = numbers.length > 0
    ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length
    : null;

  // Select reversal framework (allow explicit override)
  let reversalFramework = selectReversalFramework(reversalRatio, cardsInfo);
  if (options.reversalFrameworkOverride && REVERSAL_FRAMEWORKS[options.reversalFrameworkOverride]) {
    reversalFramework = options.reversalFrameworkOverride;
  }

  return {
    // Suit analysis
    suitCounts,
    dominantSuit: dominantSuitEntry[1] > 0 ? dominantSuitEntry[0] : null,
    suitFocus: getSuitFocusDescription(dominantSuitEntry),

    // Elemental analysis
    elementCounts,
    dominantElement: dominantElementEntry[1] > 0 ? dominantElementEntry[0] : null,
    elementalBalance: getElementalBalanceDescription(elementCounts, totalCards),

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
    lifecycleStage: getLifecycleStage(avgNumber)
  };
}

/**
 * Select appropriate reversal interpretation framework based on patterns
 */
function selectReversalFramework(ratio, cardsInfo) {
  if (ratio === 0) return 'none';
  if (ratio >= 0.6) return 'blocked';      // Heavy reversals suggest blockage
  if (ratio >= 0.4) return 'internalized'; // Moderate = internal work
  if (ratio >= 0.2) return 'delayed';      // Light = timing issues
  return 'contextual';                      // Very light = case-by-case
}

/**
 * Reversal framework definitions
 */
export const REVERSAL_FRAMEWORKS = {
  none: {
    name: 'All Upright',
    description: 'All cards appear upright, showing energies flowing freely and directly.',
    guidance: 'Read each card\'s traditional upright meaning in the context of its position.'
  },
  blocked: {
    name: 'Blocked Energy',
    description: 'Reversed cards show energies present but meeting resistance, obstacles, or internal barriers.',
    guidance: 'Interpret reversals as the same energy encountering blockage that must be addressed before progress.'
  },
  delayed: {
    name: 'Delayed Timing',
    description: 'Reversed cards indicate timing is not yet ripe; patience and preparation are needed.',
    guidance: 'Read reversals as energies that will manifest later, after certain conditions are met.'
  },
  internalized: {
    name: 'Internal Processing',
    description: 'Reversed cards point to inner work, private processing, and energies working beneath the surface.',
    guidance: 'Interpret reversals as the same themes playing out in the inner world rather than external events.'
  },
  contextual: {
    name: 'Context-Dependent',
    description: 'Reversed cards are interpreted individually based on their unique position and relationships.',
    guidance: 'Read each reversal according to what makes most sense for that specific card and position.'
  }
};

function getReversalFrameworkDescription(framework) {
  return REVERSAL_FRAMEWORKS[framework] || REVERSAL_FRAMEWORKS.contextual;
}

/**
 * Get description of suit focus
 */
function getSuitFocusDescription(dominantSuitEntry) {
  const [suit, count] = dominantSuitEntry;
  if (count === 0 || count < 2) return null;

  const descriptions = {
    Wands: `${count} Wands cards suggest a strong focus on action, creativity, passion, drive, and personal will.`,
    Cups: `${count} Cups cards indicate emotional matters, relationships, intuition, and heart-centered concerns are central to this reading.`,
    Swords: `${count} Swords cards point to mental processes, communication, truth-seeking, conflict resolution, and clarity of thought as key themes.`,
    Pentacles: `${count} Pentacles cards highlight practical matters, material resources, work, physical health, and tangible results.`
  };

  return descriptions[suit] || null;
}

/**
 * Get description of elemental balance
 */
function getElementalBalanceDescription(elementCounts, total) {
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
 */
function getLifecycleStage(avgNumber) {
  if (avgNumber === null) return null;
  if (avgNumber <= 7) return 'new cycles, initiative, fresh beginnings, and reclaiming agency';
  if (avgNumber <= 14) return 'integration, balance, working through challenges, and staying centered amidst change';
  return 'culmination, mastery, completion, and preparing to release what is finished';
}

/**
 * CELTIC CROSS SPECIFIC ANALYSIS
 *
 * Analyzes the unique position relationships in the Celtic Cross spread:
 * - Nucleus (Cards 1-2): Heart of the matter
 * - Timeline (Cards 3-1-4): Past → Present → Future
 * - Consciousness (Cards 6-1-5): Subconscious → Present → Conscious
 * - Staff (Cards 7-10): Self, External, Hopes/Fears, Outcome
 * - Cross-checks between key positions
 */
export function analyzeCelticCross(cardsInfo) {
  if (!cardsInfo || cardsInfo.length !== 10) {
    return null; // Not a Celtic Cross
  }

  return {
    nucleus: analyzeNucleus(cardsInfo[0], cardsInfo[1]),
    timeline: analyzeTimeline(cardsInfo[2], cardsInfo[0], cardsInfo[3]),
    consciousness: analyzeConsciousness(cardsInfo[5], cardsInfo[0], cardsInfo[4]),
    staff: analyzeStaff(cardsInfo[6], cardsInfo[7], cardsInfo[8], cardsInfo[9]),
    crossChecks: {
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
    }
  };
}

/**
 * Analyze the nucleus (Cards 1-2) - the heart of the matter
 */
function analyzeNucleus(present, challenge) {
  const elemental = analyzeElementalDignity(present, challenge);

  const synthesis = elemental.relationship === 'supportive'
    ? `The energies of ${present.card} and ${challenge.card} can work together constructively once the challenge is integrated.`
    : elemental.relationship === 'tension'
    ? `${present.card} and ${challenge.card} create friction between present state and challenge, requiring careful balance.`
    : elemental.relationship === 'amplified'
    ? `Both cards share ${elemental.element} energy, intensifying this theme at the heart of the matter.`
    : `${present.card} represents where you stand, while ${challenge.card} crosses as the immediate obstacle.`;

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
  }

  causality += ` This is developing toward ${future.card} in the near future.`;

  if (presentToFuture.relationship === 'tension') {
    causality += ` Moving forward will require navigating elemental tension.`;
  } else if (presentToFuture.relationship === 'supportive') {
    causality += ` The trajectory ahead is supported by current energies.`;
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
 */
function analyzeConsciousness(subconscious, present, conscious) {
  const belowToAbove = analyzeElementalDignity(subconscious, conscious);

  const alignment = belowToAbove.relationship === 'supportive'
    ? 'aligned'
    : belowToAbove.relationship === 'tension'
    ? 'conflicted'
    : belowToAbove.relationship === 'amplified'
    ? 'intensely unified'
    : 'complex';

  let synthesis = `Hidden beneath awareness: ${subconscious.card} ${subconscious.orientation}. `;
  synthesis += `Conscious goal or aspiration: ${conscious.card} ${conscious.orientation}. `;

  if (alignment === 'aligned') {
    synthesis += `Your subconscious drives and conscious goals are working together harmoniously.`;
  } else if (alignment === 'conflicted') {
    synthesis += `There is tension between what you want consciously and what drives you beneath awareness. Integration is needed.`;
  } else if (alignment === 'intensely unified') {
    synthesis += `Your inner depths and conscious mind are unified around the same ${belowToAbove.element} theme.`;
  } else {
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
 */
function analyzeStaff(self, external, hopesFears, outcome) {
  const adviceToOutcome = analyzeElementalDignity(self, outcome);

  let adviceImpact;
  if (adviceToOutcome.relationship === 'supportive') {
    adviceImpact = `Following the guidance of ${self.card} actively supports and harmonizes with the likely outcome of ${outcome.card}.`;
  } else if (adviceToOutcome.relationship === 'tension') {
    adviceImpact = `Acting on ${self.card} creates dynamic tension with the trajectory toward ${outcome.card}, requiring skillful navigation.`;
  } else if (adviceToOutcome.relationship === 'amplified') {
    adviceImpact = `The advice (${self.card}) and outcome (${outcome.card}) share the same ${adviceToOutcome.element} energy, creating a unified path forward.`;
  } else {
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
    adviceToOutcome: adviceToOutcome,
    adviceImpact
  };
}

/**
 * Compare two position cards for cross-checks
 */
function comparePositions(card1, card2, pos1Name, pos2Name) {
  const elemental = analyzeElementalDignity(card1, card2);
  const orientationMatch = card1.orientation === card2.orientation;

  let synthesis = `Comparing ${pos1Name} (${card1.card} ${card1.orientation}) with ${pos2Name} (${card2.card} ${card2.orientation}): `;

  if (elemental.description) {
    synthesis += elemental.description + '. ';
  }

  if (orientationMatch) {
    synthesis += 'Both share the same orientation, suggesting thematic continuity.';
  } else {
    synthesis += 'Different orientations suggest a shift or evolution between these positions.';
  }

  return {
    position1: { name: pos1Name, card: card1.card, orientation: card1.orientation },
    position2: { name: pos2Name, card: card2.card, orientation: card2.orientation },
    elementalRelationship: elemental,
    orientationAlignment: orientationMatch,
    synthesis
  };
}

/**
 * THREE-CARD ANALYSIS
 *
 * Analyzes Past-Present-Future or Situation-Challenge-Advice patterns
 */
export function analyzeThreeCard(cardsInfo) {
  if (!cardsInfo || cardsInfo.length !== 3) {
    return null;
  }

  const [first, second, third] = cardsInfo;

  // Analyze the causal flow
  const firstToSecond = analyzeElementalDignity(first, second);
  const secondToThird = analyzeElementalDignity(second, third);
  const firstToThird = analyzeElementalDignity(first, third);

  return {
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
    narrative: buildThreeCardNarrative(first, second, third, firstToSecond, secondToThird)
  };
}

function buildThreeCardNarrative(first, second, third, trans1, trans2) {
  let narrative = `The story unfolds from ${first.card} through ${second.card} to ${third.card}. `;

  if (trans1.relationship === 'supportive') {
    narrative += `The transition from first to second position is harmonious. `;
  } else if (trans1.relationship === 'tension') {
    narrative += `The move from first to second involves friction that shapes the narrative. `;
  }

  if (trans2.relationship === 'supportive') {
    narrative += `The path forward from second to third is well-supported.`;
  } else if (trans2.relationship === 'tension') {
    narrative += `Reaching the third position will require navigating dynamic tension.`;
  }

  return narrative;
}

/**
 * FIVE-CARD ANALYSIS
 *
 * Analyzes the five-card clarity spread structure
 */
export function analyzeFiveCard(cardsInfo) {
  if (!cardsInfo || cardsInfo.length !== 5) {
    return null;
  }

  // Core vs Challenge
  const coreVsChallenge = analyzeElementalDignity(cardsInfo[0], cardsInfo[1]);

  // Support vs Direction
  const supportVsDirection = analyzeElementalDignity(cardsInfo[3], cardsInfo[4]);

  return {
    coreVsChallenge,
    supportVsDirection,
    synthesis: `The core matter (${cardsInfo[0].card}) faces the challenge of ${cardsInfo[1].card}.
      Support comes through ${cardsInfo[3].card}, pointing toward ${cardsInfo[4].card} as the likely direction.`
  };
}
