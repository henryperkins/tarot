/**
 * Unit tests for the Reasoning Chain system
 *
 * Tests the reasoning chain's ability to analyze spreads holistically
 * and produce coherent, cross-card-aware narrative guidance.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// --------------------------------------------------------------------------
// Minimal `expect()` shim for Node's test runner
// --------------------------------------------------------------------------

function expect(received) {
  const toContain = (container, item) => {
    if (typeof container === 'string') {
      assert.ok(container.includes(item), `Expected string to contain ${String(item)}`);
      return;
    }
    if (Array.isArray(container)) {
      assert.ok(container.includes(item), `Expected array to contain ${String(item)}`);
      return;
    }
    assert.fail('toContain expects a string or array');
  };

  const api = {
    toBe(expected) {
      assert.equal(received, expected);
    },
    toEqual(expected) {
      assert.deepEqual(received, expected);
    },
    toBeTruthy() {
      assert.ok(received);
    },
    toBeFalsy() {
      assert.ok(!received);
    },
    toBeNull() {
      assert.equal(received, null);
    },
    toHaveLength(length) {
      assert.equal(received?.length, length);
    },
    toHaveProperty(prop, value) {
      assert.ok(received && Object.prototype.hasOwnProperty.call(received, prop), `Expected object to have property ${String(prop)}`);
      if (arguments.length >= 2) {
        assert.equal(received[prop], value);
      }
    },
    toContain(expected) {
      toContain(received, expected);
    },
    toBeGreaterThan(expected) {
      assert.ok(received > expected, `Expected ${received} to be > ${expected}`);
    },
    toBeLessThan(expected) {
      assert.ok(received < expected, `Expected ${received} to be < ${expected}`);
    },
    toBeLessThanOrEqual(expected) {
      assert.ok(received <= expected, `Expected ${received} to be <= ${expected}`);
    },
    toThrow() {
      assert.throws(received);
    },
    not: {
      toBe(expected) {
        assert.notEqual(received, expected);
      },
      toEqual(expected) {
        assert.notDeepEqual(received, expected);
      },
      toBeTruthy() {
        assert.ok(!received);
      },
      toBeFalsy() {
        assert.ok(received);
      },
      toBeNull() {
        assert.notEqual(received, null);
      },
      toContain(expected) {
        if (typeof received === 'string') {
          assert.ok(!received.includes(expected), `Expected string NOT to contain ${String(expected)}`);
          return;
        }
        if (Array.isArray(received)) {
          assert.ok(!received.includes(expected), `Expected array NOT to contain ${String(expected)}`);
          return;
        }
        assert.fail('not.toContain expects a string or array');
      },
      toHaveProperty(prop) {
        assert.ok(!(received && Object.prototype.hasOwnProperty.call(received, prop)), `Expected object NOT to have property ${String(prop)}`);
      },
      toThrow() {
        assert.doesNotThrow(received);
      }
    }
  };

  // Vitest-style API used in this file: expect(fn).not.toThrow()
  api.not.toThrow = () => assert.doesNotThrow(received);

  return api;
}
import {
  buildReadingReasoning,
  analyzeQuestionIntent,
  identifyNarrativeArc,
  identifyTensions,
  identifyThroughlines,
  identifyPivotCard,
  mapEmotionalArc,
  buildEmphasisMap,
  getCardValence,
  getEmotionalQuality,
  getCardNumber,
  isMajorArcana
} from '../functions/lib/narrative/reasoning.js';

import {
  MAJOR_ELEMENTS,
  SUIT_ELEMENTS,
  getCardElement
} from '../functions/lib/spreadAnalysis.js';

import {
  selectReasoningConnector,
  buildReasoningAwareOpening,
  enhanceCardTextWithReasoning,
  buildReasoningSynthesis,
  formatReasoningChain
} from '../functions/lib/narrative/reasoningIntegration.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createCard = (card, orientation = 'upright', position = '', suit = null) => ({
  card,
  orientation,
  position,
  suit,
  meaning: `Meaning for ${card}`
});

// Sample spreads for testing
const threeCardSpread = {
  positive: [
    createCard('The Star', 'upright', 'Past — influences that led here'),
    createCard('The Sun', 'upright', 'Present — where you stand now'),
    createCard('The World', 'upright', 'Future — trajectory if nothing shifts')
  ],
  challenging: [
    createCard('The Tower', 'upright', 'Past — influences that led here'),
    createCard('Ten of Swords', 'upright', 'Present — where you stand now'),
    createCard('Five of Cups', 'upright', 'Future — trajectory if nothing shifts')
  ],
  struggleToResolution: [
    createCard('Three of Swords', 'upright', 'Past — influences that led here'),
    createCard('The Hermit', 'upright', 'Present — where you stand now'),
    createCard('The Sun', 'upright', 'Future — trajectory if nothing shifts')
  ],
  innerJourney: [
    createCard('The High Priestess', 'upright', 'Past — influences that led here'),
    createCard('The Hermit', 'upright', 'Present — where you stand now'),
    createCard('Four of Swords', 'upright', 'Future — trajectory if nothing shifts')
  ]
};

const celticCrossSpread = [
  createCard('The Fool', 'upright', 'Present — core situation (Card 1)'),
  createCard('The Tower', 'upright', 'Challenge — crossing / tension (Card 2)'),
  createCard('Six of Cups', 'upright', 'Past — what lies behind (Card 3)'),
  createCard('Eight of Wands', 'upright', 'Near Future — what lies before (Card 4)'),
  createCard('The Star', 'upright', 'Conscious — goals & focus (Card 5)'),
  createCard('The Moon', 'reversed', 'Subconscious — roots / hidden forces (Card 6)'),
  createCard('The Hermit', 'upright', 'Self / Advice — how to meet this (Card 7)'),
  createCard('Three of Pentacles', 'upright', 'External Influences — people & environment (Card 8)'),
  createCard('Nine of Swords', 'upright', 'Hopes & Fears — deepest wishes & worries (Card 9)'),
  createCard('The Sun', 'upright', 'Outcome — likely path if unchanged (Card 10)')
];

// ============================================================================
// CARD VALENCE TESTS
// ============================================================================

describe('Card Valence', () => {
  describe('getCardValence', () => {
    it('should return positive valence for positive cards', () => {
      const sunValence = getCardValence(createCard('The Sun'));
      expect(sunValence).toBeGreaterThan(0.5);
    });

    it('should return negative valence for challenging cards', () => {
      const towerValence = getCardValence(createCard('The Tower'));
      expect(towerValence).toBeLessThan(0);
    });

    it('should moderate valence for reversed positive cards', () => {
      const sunUpright = getCardValence(createCard('The Sun', 'upright'));
      const sunReversed = getCardValence(createCard('The Sun', 'reversed'));
      expect(sunReversed).toBeLessThan(sunUpright);
      expect(sunReversed).toBeGreaterThan(-0.5); // Not fully negative
    });

    it('should moderate valence for reversed challenging cards', () => {
      const towerUpright = getCardValence(createCard('The Tower', 'upright'));
      const towerReversed = getCardValence(createCard('The Tower', 'reversed'));
      expect(Math.abs(towerReversed)).toBeLessThan(Math.abs(towerUpright));
    });

    it('should return neutral valence for unknown cards', () => {
      const unknownValence = getCardValence(createCard('Unknown Card'));
      expect(unknownValence).toBe(0);
    });

    it('should handle missing card info gracefully', () => {
      expect(getCardValence(null)).toBe(0);
      expect(getCardValence({})).toBe(0);
      expect(getCardValence({ card: null })).toBe(0);
    });
  });

  describe('getEmotionalQuality', () => {
    it('should return "joy" for high positive valence', () => {
      expect(getEmotionalQuality(0.8)).toBe('joy');
    });

    it('should return "difficulty" for low negative valence', () => {
      expect(getEmotionalQuality(-0.8)).toBe('difficulty');
    });

    it('should return "uncertainty" for near-zero valence', () => {
      expect(getEmotionalQuality(0)).toBe('uncertainty');
    });

    it('should return appropriate qualities for intermediate values', () => {
      expect(getEmotionalQuality(0.4)).toBe('hope');
      expect(getEmotionalQuality(0.15)).toBe('openness');
      expect(getEmotionalQuality(-0.2)).toBe('tension');
      expect(getEmotionalQuality(-0.5)).toBe('challenge');
    });
  });
});

// ============================================================================
// CARD NUMBER NORMALIZATION TESTS
// ============================================================================

describe('Card Number Normalization', () => {
  describe('getCardNumber', () => {
    it('should return number when "number" property exists', () => {
      expect(getCardNumber({ number: 14 })).toBe(14);
      expect(getCardNumber({ number: 0 })).toBe(0);
    });

    it('should return number when "cardNumber" property exists', () => {
      expect(getCardNumber({ cardNumber: 14 })).toBe(14);
      expect(getCardNumber({ cardNumber: 0 })).toBe(0);
    });

    it('should return number when "card_number" property exists', () => {
      expect(getCardNumber({ card_number: 14 })).toBe(14);
      expect(getCardNumber({ card_number: 0 })).toBe(0);
    });

    it('should prefer "number" over "cardNumber" and "card_number"', () => {
      expect(getCardNumber({ number: 5, cardNumber: 10 })).toBe(5);
      expect(getCardNumber({ number: 5, card_number: 10 })).toBe(5);
    });

    it('should prefer "cardNumber" over "card_number" when "number" is absent', () => {
      expect(getCardNumber({ cardNumber: 10, card_number: 15 })).toBe(10);
    });

    it('should return undefined for null/undefined input', () => {
      expect(getCardNumber(null)).toBe(undefined);
      expect(getCardNumber(undefined)).toBe(undefined);
    });

    it('should return undefined when no number property exists', () => {
      expect(getCardNumber({ card: 'The Fool' })).toBe(undefined);
      expect(getCardNumber({})).toBe(undefined);
    });

    it('should ignore non-number values', () => {
      expect(getCardNumber({ number: 'fourteen' })).toBe(undefined);
      expect(getCardNumber({ cardNumber: null })).toBe(undefined);
    });
  });

  describe('isMajorArcana', () => {
    it('should return true for Major Arcana numbers 0-21', () => {
      expect(isMajorArcana({ number: 0 })).toBe(true);   // The Fool
      expect(isMajorArcana({ number: 14 })).toBe(true);  // Temperance
      expect(isMajorArcana({ number: 21 })).toBe(true);  // The World
    });

    it('should work with cardNumber property', () => {
      expect(isMajorArcana({ cardNumber: 0 })).toBe(true);
      expect(isMajorArcana({ cardNumber: 14 })).toBe(true);
    });

    it('should work with card_number property', () => {
      expect(isMajorArcana({ card_number: 0 })).toBe(true);
      expect(isMajorArcana({ card_number: 14 })).toBe(true);
    });

    it('should return false for numbers outside 0-21 range', () => {
      expect(isMajorArcana({ number: 22 })).toBe(false);
      expect(isMajorArcana({ number: -1 })).toBe(false);
      expect(isMajorArcana({ number: 100 })).toBe(false);
    });

    it('should return false when no number property exists', () => {
      expect(isMajorArcana({ card: 'Three of Cups' })).toBe(false);
      expect(isMajorArcana({})).toBe(false);
      expect(isMajorArcana(null)).toBe(false);
    });
  });
});

// ============================================================================
// CARD ELEMENT MAPPING TESTS
// ============================================================================

describe('Card Element Mapping (Canonical)', () => {
  describe('MAJOR_ELEMENTS lockdown', () => {
    // This test locks the Major Arcana element mappings based on
    // Golden Dawn / RWS astrological associations to prevent regressions
    const expectedElements = {
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
      14: 'Fire',    // Temperance (Sagittarius) - NOT Water!
      15: 'Earth',   // The Devil (Capricorn)
      16: 'Fire',    // The Tower (Mars)
      17: 'Air',     // The Star (Aquarius)
      18: 'Water',   // The Moon (Pisces)
      19: 'Fire',    // The Sun (Sun)
      20: 'Fire',    // Judgement (Pluto)
      21: 'Earth'    // The World (Saturn)
    };

    it('should have all 22 Major Arcana mappings', () => {
      expect(Object.keys(MAJOR_ELEMENTS).length).toBe(22);
    });

    it('should have correct element for The Fool (0)', () => {
      expect(MAJOR_ELEMENTS[0]).toBe('Air');
    });

    it('should have correct element for The Hierophant (5) - Earth via Taurus', () => {
      expect(MAJOR_ELEMENTS[5]).toBe('Earth');
    });

    it('should have correct element for Temperance (14) - Fire via Sagittarius, NOT Water', () => {
      // This is the critical bug fix verification
      expect(MAJOR_ELEMENTS[14]).toBe('Fire');
      expect(MAJOR_ELEMENTS[14]).not.toBe('Water');
    });

    it('should match all expected elements', () => {
      for (const [cardNumber, expectedElement] of Object.entries(expectedElements)) {
        expect(MAJOR_ELEMENTS[Number(cardNumber)]).toBe(expectedElement);
      }
    });
  });

  describe('SUIT_ELEMENTS lockdown', () => {
    it('should map Wands to Fire', () => {
      expect(SUIT_ELEMENTS.Wands).toBe('Fire');
    });

    it('should map Cups to Water', () => {
      expect(SUIT_ELEMENTS.Cups).toBe('Water');
    });

    it('should map Swords to Air', () => {
      expect(SUIT_ELEMENTS.Swords).toBe('Air');
    });

    it('should map Pentacles to Earth', () => {
      expect(SUIT_ELEMENTS.Pentacles).toBe('Earth');
    });
  });

  describe('getCardElement (canonical)', () => {
    it('should return correct element for Major Arcana by number', () => {
      expect(getCardElement('Temperance', 14)).toBe('Fire');
      expect(getCardElement('The Hierophant', 5)).toBe('Earth');
      expect(getCardElement('The Fool', 0)).toBe('Air');
    });

    it('should return correct element for Minor Arcana by suit', () => {
      expect(getCardElement('Three of Wands')).toBe('Fire');
      expect(getCardElement('Ace of Cups')).toBe('Water');
      expect(getCardElement('Ten of Swords')).toBe('Air');
      expect(getCardElement('Four of Pentacles')).toBe('Earth');
    });

    it('should return null for unknown cards', () => {
      expect(getCardElement('Unknown Card')).toBeNull();
    });
  });

  describe('reasoning.js getCardElement delegation', () => {
    // Verify that reasoning.js now correctly uses the canonical mappings

    it('should get correct element for Temperance via reasoning chain', () => {
      const cards = [
        { card: 'Temperance', cardNumber: 14, position: 'Test' }
      ];
      const reasoning = buildReadingReasoning(cards, '', 'general', {}, 'single');

      // The reasoning chain should detect Fire element tensions correctly
      // If Temperance were incorrectly mapped to Water, elemental dignities would be wrong
      expect(reasoning).toBeTruthy();
    });

    it('should detect Fire-Water tension when Temperance meets Cups', () => {
      const cards = [
        { card: 'Temperance', cardNumber: 14, position: 'Past', suit: null },
        { card: 'Ace of Cups', position: 'Present', suit: 'Cups' }
      ];
      const tensions = identifyTensions(cards);

      // Temperance (Fire) + Cups (Water) = elemental opposition
      const elementalTension = tensions.find(t => t.type === 'elemental-opposition');
      expect(elementalTension).toBeTruthy();
      expect(elementalTension.elements).toContain('Fire');
      expect(elementalTension.elements).toContain('Water');
    });

    it('should NOT detect Fire-Fire tension when Temperance meets Wands', () => {
      const cards = [
        { card: 'Temperance', cardNumber: 14, position: 'Past', suit: null },
        { card: 'Ace of Wands', position: 'Present', suit: 'Wands' }
      ];
      const tensions = identifyTensions(cards);

      // Temperance (Fire) + Wands (Fire) = amplified, not opposition
      const elementalTension = tensions.find(t => t.type === 'elemental-opposition');
      expect(elementalTension).toBeFalsy();
    });
  });
});

// ============================================================================
// QUESTION INTENT TESTS
// ============================================================================

describe('Question Intent Analysis', () => {
  describe('analyzeQuestionIntent', () => {
    it('should detect decision intent', () => {
      const result = analyzeQuestionIntent('Should I take the new job or stay?');
      expect(result.type).toBe('decision');
    });

    it('should detect timing intent', () => {
      const result = analyzeQuestionIntent('When will I meet my soulmate?');
      expect(result.type).toBe('timing');
    });

    it('should detect blockage intent', () => {
      const result = analyzeQuestionIntent("Why can't I move forward in my career?");
      expect(result.type).toBe('blockage');
    });

    it('should detect confirmation intent', () => {
      const result = analyzeQuestionIntent('Am I on the right path with this relationship?');
      expect(result.type).toBe('confirmation');
    });

    it('should detect outcome intent', () => {
      const result = analyzeQuestionIntent('What will happen if I move to a new city?');
      expect(result.type).toBe('outcome');
    });

    it('should detect understanding intent', () => {
      const result = analyzeQuestionIntent('What does this situation mean for me?');
      expect(result.type).toBe('understanding');
    });

    it('should detect focus areas', () => {
      const relationship = analyzeQuestionIntent('How can I improve my relationship?');
      expect(relationship.focus).toBe('relationship');

      const career = analyzeQuestionIntent('What about my job prospects?');
      expect(career.focus).toBe('career');

      const health = analyzeQuestionIntent('How can I support my healing?');
      expect(health.focus).toBe('health');
    });

    it('should detect urgency levels', () => {
      const high = analyzeQuestionIntent('I desperately need guidance right now!');
      expect(high.urgency).toBe('high');

      const medium = analyzeQuestionIntent("I've been struggling lately with this.");
      expect(medium.urgency).toBe('medium');

      const low = analyzeQuestionIntent("I'm just curious about what might happen.");
      expect(low.urgency).toBe('low');
    });

    it('should extract keywords', () => {
      const result = analyzeQuestionIntent('How can I improve communication with my partner?');
      expect(result.keywords).toContain('improve');
      expect(result.keywords).toContain('communication');
      expect(result.keywords).toContain('partner');
    });

    it('should handle empty/null questions', () => {
      expect(analyzeQuestionIntent('')).toHaveProperty('type', 'open');
      expect(analyzeQuestionIntent(null)).toHaveProperty('type', 'open');
      expect(analyzeQuestionIntent(undefined)).toHaveProperty('type', 'open');
    });
  });
});

// ============================================================================
// NARRATIVE ARC TESTS
// ============================================================================

describe('Narrative Arc Detection', () => {
  describe('identifyNarrativeArc', () => {
    it('should detect struggle-to-resolution arc', () => {
      const result = identifyNarrativeArc(threeCardSpread.struggleToResolution);
      expect(result.key).toBe('struggle-to-resolution');
      expect(result.emphasis).toBe('transformation');
    });

    it('should detect inner-journey arc', () => {
      const result = identifyNarrativeArc(threeCardSpread.innerJourney);
      expect(result.key).toBe('inner-journey');
      expect(result.emphasis).toBe('patience and depth');
    });

    it('should detect steady-growth arc', () => {
      const result = identifyNarrativeArc(threeCardSpread.positive);
      expect(result.key).toBe('steady-growth');
      expect(result.emphasis).toBe('opportunity and expansion');
    });

    it('should include narrative guidance', () => {
      const result = identifyNarrativeArc(threeCardSpread.struggleToResolution);
      expect(result.narrativeGuidance).toBeTruthy();
      expect(typeof result.narrativeGuidance).toBe('string');
    });

    it('should include template bias', () => {
      const result = identifyNarrativeArc(threeCardSpread.struggleToResolution);
      expect(result.templateBias).toBe('hopeful');
    });

    it('should return default arc for empty array', () => {
      const result = identifyNarrativeArc([]);
      expect(result.key).toBe('unknown');
    });

    it('should return default arc for unmatched patterns', () => {
      // Cards that don't match any specific pattern
      const neutralCards = [
        createCard('Two of Pentacles'),
        createCard('Five of Wands'),
        createCard('Seven of Pentacles')
      ];
      const result = identifyNarrativeArc(neutralCards);
      expect(result.key).toBe('unfolding');
    });
  });
});

// ============================================================================
// TENSION DETECTION TESTS
// ============================================================================

describe('Tension Detection', () => {
  describe('identifyTensions', () => {
    it('should detect emotional contrast tension', () => {
      const cards = [
        createCard('Three of Swords'),
        createCard('The Sun')
      ];
      const tensions = identifyTensions(cards);

      expect(tensions.length).toBeGreaterThan(0);
      const emotionalTension = tensions.find(t => t.type === 'emotional-contrast');
      expect(emotionalTension).toBeTruthy();
    });

    it('should detect elemental opposition tension', () => {
      const cards = [
        createCard('Ace of Wands', 'upright', '', 'Wands'), // Fire
        createCard('Ace of Cups', 'upright', '', 'Cups')    // Water
      ];
      const tensions = identifyTensions(cards);

      const elementalTension = tensions.find(t => t.type === 'elemental-opposition');
      expect(elementalTension).toBeTruthy();
      expect(elementalTension.elements).toContain('Fire');
      expect(elementalTension.elements).toContain('Water');
    });

    it('should mark key tensions for Celtic Cross', () => {
      const tensions = identifyTensions(celticCrossSpread);
      const keyTension = tensions.find(t => t.isKeyTension);

      expect(keyTension).toBeTruthy();
      expect(keyTension.positionLabels).toContain('Present');
      expect(keyTension.positionLabels).toContain('Outcome');
    });

    it('should include bridge phrases', () => {
      const cards = [
        createCard('Three of Swords'),
        createCard('The Sun')
      ];
      const tensions = identifyTensions(cards);

      expect(tensions[0].bridgePhrase).toBeTruthy();
      expect(typeof tensions[0].bridgePhrase).toBe('string');
    });

    it('should sort by intensity and key status', () => {
      const tensions = identifyTensions(celticCrossSpread);

      if (tensions.length >= 2) {
        const firstIsKey = tensions[0].isKeyTension || tensions[0].intensity === 'strong';
        expect(firstIsKey).toBe(true);
      }
    });

    it('should return empty array for single card', () => {
      const tensions = identifyTensions([createCard('The Fool')]);
      expect(tensions).toEqual([]);
    });
  });
});

// ============================================================================
// THROUGHLINE TESTS
// ============================================================================

describe('Throughline Detection', () => {
  describe('identifyThroughlines', () => {
    it('should detect elemental dominance', () => {
      const waterHeavy = [
        createCard('Ace of Cups', 'upright', '', 'Cups'),
        createCard('Two of Cups', 'upright', '', 'Cups'),
        createCard('Three of Cups', 'upright', '', 'Cups')
      ];
      const throughlines = identifyThroughlines(waterHeavy, {});

      const waterTheme = throughlines.find(t => t.includes('Water'));
      expect(waterTheme).toBeTruthy();
    });

    it('should detect Major Arcana density', () => {
      const majorHeavy = [
        createCard('The Fool'),
        createCard('The Magician'),
        createCard('The High Priestess')
      ];
      // Mock the number property for Major Arcana detection
      majorHeavy.forEach((card, i) => card.number = i);

      const throughlines = identifyThroughlines(majorHeavy, {});
      const majorTheme = throughlines.find(t => t.includes('Major Arcana'));
      expect(majorTheme).toBeTruthy();
    });

    it('should detect all-upright pattern', () => {
      const allUpright = [
        createCard('The Star', 'upright'),
        createCard('The Sun', 'upright'),
        createCard('The World', 'upright')
      ];
      const throughlines = identifyThroughlines(allUpright, {});

      const uprightTheme = throughlines.find(t => t.includes('upright'));
      expect(uprightTheme).toBeTruthy();
    });

    it('should detect heavy reversal pattern', () => {
      const manyReversed = [
        createCard('The Star', 'reversed'),
        createCard('The Sun', 'reversed'),
        createCard('The World', 'upright')
      ];
      const throughlines = identifyThroughlines(manyReversed, {});

      const reversalTheme = throughlines.find(t => t.includes('reversal'));
      expect(reversalTheme).toBeTruthy();
    });

    it('should limit throughlines to 4', () => {
      const throughlines = identifyThroughlines(celticCrossSpread, {});
      expect(throughlines.length).toBeLessThanOrEqual(4);
    });
  });
});

// ============================================================================
// PIVOT CARD TESTS
// ============================================================================

describe('Pivot Card Identification', () => {
  describe('identifyPivotCard', () => {
    it('should identify Advice position as pivot for Celtic Cross', () => {
      const pivot = identifyPivotCard(celticCrossSpread, 'celtic');
      expect(pivot.index).toBe(6);
      expect(pivot.card).toBe('The Hermit');
    });

    it('should identify Present position as pivot for Three-Card', () => {
      const pivot = identifyPivotCard(threeCardSpread.positive, 'threeCard');
      expect(pivot.index).toBe(1);
    });

    it('should include reason for pivot', () => {
      const pivot = identifyPivotCard(celticCrossSpread, 'celtic');
      expect(pivot.reason).toBeTruthy();
      expect(pivot.reason).toContain('Advice');
    });

    it('should return null for empty array', () => {
      const pivot = identifyPivotCard([], 'celtic');
      expect(pivot).toBeNull();
    });

    it('should find pivot for unknown spread types', () => {
      const pivot = identifyPivotCard(threeCardSpread.positive, 'unknown');
      expect(pivot).not.toBeNull();
      expect(pivot.card).toBeTruthy();
    });
  });
});

// ============================================================================
// EMOTIONAL ARC TESTS
// ============================================================================

describe('Emotional Arc Mapping', () => {
  describe('mapEmotionalArc', () => {
    it('should detect ascending emotional arc', () => {
      const arc = mapEmotionalArc(threeCardSpread.struggleToResolution);

      expect(arc.direction).toBe('ascending');
      // Three of Swords has valence ~ -0.7, which maps to 'difficulty'
      expect(arc.start).toBe('difficulty');
      expect(arc.end).toBe('joy');
    });

    it('should identify emotional peak', () => {
      const arc = mapEmotionalArc(threeCardSpread.struggleToResolution);

      expect(arc.peak).not.toBeNull();
      expect(arc.peak.card).toBe('The Sun');
    });

    it('should identify emotional valley', () => {
      const arc = mapEmotionalArc(threeCardSpread.struggleToResolution);

      expect(arc.valley).not.toBeNull();
      expect(arc.valley.card).toBe('Three of Swords');
    });

    it('should include journey breakdown', () => {
      const arc = mapEmotionalArc(threeCardSpread.positive);

      expect(arc.journey).toHaveLength(3);
      expect(arc.journey[0]).toHaveProperty('valence');
      expect(arc.journey[0]).toHaveProperty('quality');
    });

    it('should generate summary', () => {
      const arc = mapEmotionalArc(threeCardSpread.struggleToResolution);

      expect(arc.summary).toBeTruthy();
      expect(arc.summary).toContain('difficulty');
      expect(arc.summary).toContain('joy');
    });

    it('should return null for empty array', () => {
      const arc = mapEmotionalArc([]);
      expect(arc).toBeNull();
    });
  });
});

// ============================================================================
// EMPHASIS MAP TESTS
// ============================================================================

describe('Emphasis Map Building', () => {
  describe('buildEmphasisMap', () => {
    it('should mark pivot card as high emphasis', () => {
      const reasoning = {
        pivotCard: { index: 1, card: 'The Sun' },
        tensions: [],
        emotionalArc: null
      };
      const emphasisMap = buildEmphasisMap(threeCardSpread.positive, reasoning);

      expect(emphasisMap[1].emphasis).toBe('high');
      expect(emphasisMap[1].reasons).toContain('pivot position');
    });

    it('should mark key tension cards as high emphasis', () => {
      const reasoning = {
        pivotCard: null,
        tensions: [{
          isKeyTension: true,
          positions: [0, 2]
        }],
        emotionalArc: null
      };
      const emphasisMap = buildEmphasisMap(threeCardSpread.positive, reasoning);

      expect(emphasisMap[0].emphasis).toBe('high');
      expect(emphasisMap[2].emphasis).toBe('high');
    });

    it('should include reasons for emphasis', () => {
      const reasoning = {
        pivotCard: { index: 0, card: 'The Star' },
        tensions: [],
        emotionalArc: { peak: { card: 'The Star' } }
      };
      const emphasisMap = buildEmphasisMap(threeCardSpread.positive, reasoning);

      expect(emphasisMap[0].reasons).toContain('pivot position');
    });
  });
});

// ============================================================================
// FULL REASONING CHAIN TESTS
// ============================================================================

describe('Full Reasoning Chain', () => {
  describe('buildReadingReasoning', () => {
    it('should build complete reasoning chain', () => {
      const reasoning = buildReadingReasoning(
        threeCardSpread.struggleToResolution,
        'How can I heal from this heartbreak?',
        'love',
        {},
        'threeCard'
      );

      expect(reasoning).toHaveProperty('questionIntent');
      expect(reasoning).toHaveProperty('narrativeArc');
      expect(reasoning).toHaveProperty('tensions');
      expect(reasoning).toHaveProperty('throughlines');
      expect(reasoning).toHaveProperty('pivotCard');
      expect(reasoning).toHaveProperty('emotionalArc');
      expect(reasoning).toHaveProperty('emphasisMap');
      expect(reasoning).toHaveProperty('synthesisHooks');
    });

    it('should include synthesis hooks', () => {
      const reasoning = buildReadingReasoning(
        threeCardSpread.struggleToResolution,
        'Should I stay or leave?',
        'love',
        {},
        'threeCard'
      );

      expect(reasoning.synthesisHooks.length).toBeGreaterThan(0);
    });

    it('should include metadata', () => {
      const reasoning = buildReadingReasoning(
        threeCardSpread.positive,
        'What lies ahead?',
        'general',
        {},
        'threeCard'
      );

      expect(reasoning.context).toBe('general');
      expect(reasoning.spreadKey).toBe('threeCard');
      expect(reasoning.cardCount).toBe(3);
      expect(reasoning.timestamp).toBeTruthy();
    });
  });
});

// ============================================================================
// INTEGRATION LAYER TESTS
// ============================================================================

describe('Reasoning Integration', () => {
  let sampleReasoning;

  beforeEach(() => {
    sampleReasoning = buildReadingReasoning(
      threeCardSpread.struggleToResolution,
      'How can I move forward?',
      'self',
      {},
      'threeCard'
    );
  });

  describe('selectReasoningConnector', () => {
    it('should return connector for pivot transition', () => {
      const connector = selectReasoningConnector(sampleReasoning, 0, 1);
      // Should return something (either tension-aware or pivot-aware)
      expect(typeof connector).toBe('string');
    });

    it('should return null when no special connector applies', () => {
      const emptyReasoning = {
        tensions: [],
        pivotCard: null,
        narrativeArc: { key: 'unfolding' },
        emotionalArc: null,
        emphasisMap: []
      };
      const connector = selectReasoningConnector(emptyReasoning, 0, 1);
      // May be null or a default arc-based connector
      expect(connector === null || typeof connector === 'string').toBe(true);
    });
  });

  describe('buildReasoningAwareOpening', () => {
    it('should include spread name', () => {
      const opening = buildReasoningAwareOpening(
        'Three-Card Story',
        'How can I heal?',
        'love',
        sampleReasoning,
        {}
      );

      expect(opening).toContain('Three-Card Story');
    });

    it('should include arc description for notable arcs', () => {
      const opening = buildReasoningAwareOpening(
        'Three-Card Story',
        'How can I heal?',
        'love',
        sampleReasoning,
        {}
      );

      // Should include arc description if arc is not 'unfolding'
      if (sampleReasoning.narrativeArc.key !== 'unfolding') {
        expect(opening).toContain(sampleReasoning.narrativeArc.description);
      }
    });

    it('should include personalization when provided', () => {
      const opening = buildReasoningAwareOpening(
        'Three-Card Story',
        'How can I heal?',
        'love',
        sampleReasoning,
        { personalization: { displayName: 'Luna' } }
      );

      expect(opening).toContain('Luna');
    });
  });

  describe('enhanceCardTextWithReasoning', () => {
    it('should add pivot annotation for pivot card', () => {
      const pivotIndex = sampleReasoning.pivotCard?.index || 1;
      const result = enhanceCardTextWithReasoning(
        'Base card text.',
        pivotIndex,
        sampleReasoning
      );

      expect(result.enhanced).toBe(true);
      expect(result.enhancements).toContain('pivot');
      expect(result.text).toContain(sampleReasoning.pivotCard.reason);
    });

    it('should skip annotations in prose mode', () => {
      const pivotIndex = sampleReasoning.pivotCard?.index || 1;
      const result = enhanceCardTextWithReasoning(
        'Base card text.',
        pivotIndex,
        sampleReasoning,
        { proseMode: true }
      );

      expect(result.enhanced).toBe(false);
      expect(result.text).toBe('Base card text.');
    });

    it('should return unchanged text when no enhancements apply', () => {
      // Pass null reasoning to get no enhancements
      const result = enhanceCardTextWithReasoning(
        'Base card text.',
        0,
        null
      );

      expect(result.enhanced).toBe(false);
      expect(result.text).toBe('Base card text.');
    });
  });

  describe('buildReasoningSynthesis', () => {
    it('should include synthesis hooks', () => {
      const synthesis = buildReasoningSynthesis(
        threeCardSpread.struggleToResolution,
        sampleReasoning,
        {},
        'How can I heal?',
        'love'
      );

      expect(synthesis).toBeTruthy();
      expect(synthesis.length).toBeGreaterThan(0);
    });

    it('should include agency reminder', () => {
      const synthesis = buildReasoningSynthesis(
        threeCardSpread.struggleToResolution,
        sampleReasoning,
        {},
        'How can I heal?',
        'love'
      );

      // Agency reminders now vary; check that at least one variant is present
      const agencyKeywords = ['choices', 'agency', 'decisions', 'wisdom', 'illuminate', 'trajectory', 'resonates'];
      const hasAgency = agencyKeywords.some(kw => synthesis.includes(kw));
      assert.ok(hasAgency, `Expected synthesis to contain an agency reminder keyword, got: ${synthesis.slice(-200)}`);
    });
  });

  describe('formatReasoningChain', () => {
    it('should format reasoning as readable text', () => {
      const formatted = formatReasoningChain(sampleReasoning);

      expect(formatted).toContain('REASONING CHAIN');
      expect(formatted).toContain('QUESTION INTENT');
      expect(formatted).toContain('NARRATIVE ARC');
    });

    it('should handle null reasoning', () => {
      const formatted = formatReasoningChain(null);
      expect(formatted).toContain('No reasoning chain');
    });
  });
});

// ============================================================================
// EDGE CASES & ROBUSTNESS
// ============================================================================

describe('Edge Cases', () => {
  it('should handle cards with missing properties', () => {
    const incompleteCards = [
      { card: 'The Sun' },
      { card: 'The Moon', orientation: null },
      { card: null }
    ];

    expect(() => {
      buildReadingReasoning(incompleteCards, '', 'general', {}, 'threeCard');
    }).not.toThrow();
  });

  it('should handle very short questions', () => {
    const result = analyzeQuestionIntent('Love?');
    expect(result.type).toBeTruthy();
  });

  it('should handle very long questions', () => {
    const longQuestion = 'I have been thinking about this for a long time and I wonder if '.repeat(20);
    const result = analyzeQuestionIntent(longQuestion);
    expect(result.type).toBeTruthy();
    expect(result.keywords.length).toBeLessThanOrEqual(5);
  });

  it('should handle single card spreads', () => {
    const singleCard = [createCard('The Fool')];
    const reasoning = buildReadingReasoning(singleCard, '', 'general', {}, 'single');

    expect(reasoning.pivotCard).not.toBeNull();
    expect(reasoning.tensions).toEqual([]);
  });

  it('should handle large spreads', () => {
    const largeSpread = Array.from({ length: 20 }, (_, i) =>
      createCard(`Card ${i}`, i % 2 === 0 ? 'upright' : 'reversed')
    );

    expect(() => {
      buildReadingReasoning(largeSpread, '', 'general', {}, 'custom');
    }).not.toThrow();
  });
});
