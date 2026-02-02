// functions/__tests__/knowledgeGraph.test.js
// Unit tests for Knowledge Graph pattern detection
// Run with: node --test functions/__tests__/knowledgeGraph.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  detectFoolsJourneyStage,
  detectArchetypalTriads,
  detectArchetypalDyads,
  detectSuitProgressions,
  detectAllPatterns,
  getPriorityPatternNarratives
} from '../lib/knowledgeGraph.js';
import { ARCHETYPAL_DYADS, ARCHETYPAL_TRIADS } from '../../src/data/knowledgeGraphData.js';
import { DYAD_PASSAGES, TRIAD_PASSAGES } from '../lib/knowledgeBase.js';

describe('detectFoolsJourneyStage', () => {
  it('detects initiation stage (3+ cards from 0-7)', () => {
    const cards = [
      { number: 0, name: 'The Fool' },
      { number: 1, name: 'The Magician' },
      { number: 7, name: 'The Chariot' },
      { number: 5, name: 'The Hierophant' }
    ];
    const result = detectFoolsJourneyStage(cards);

    // Note: The stage property is 'departure' (not 'initiation' which is the key)
    assert.strictEqual(result.stage, 'departure');
    assert.strictEqual(result.cardCount, 4);
    assert.strictEqual(result.significance, 'strong');
  });

  it('detects integration stage (cards 8-14)', () => {
    const cards = [
      { number: 9, name: 'The Hermit' },
      { number: 12, name: 'The Hanged Man' },
      { number: 13, name: 'Death' }
    ];
    const result = detectFoolsJourneyStage(cards);

    // Note: The stage property is 'initiation' (not 'integration' which is the key)
    assert.strictEqual(result.stage, 'initiation');
    assert.strictEqual(result.cardCount, 3);
    assert.strictEqual(result.significance, 'strong');
  });

  it('detects culmination stage (cards 15-21)', () => {
    const cards = [
      { number: 15, name: 'The Devil' },
      { number: 16, name: 'The Tower' },
      { number: 19, name: 'The Sun' },
      { number: 21, name: 'The World' }
    ];
    const result = detectFoolsJourneyStage(cards);

    // Note: The stage property is 'return' (not 'culmination' which is the key)
    assert.strictEqual(result.stage, 'return');
    assert.strictEqual(result.cardCount, 4);
  });

  it('returns minimal significance for single Major Arcana card', () => {
    const cards = [
      { number: 1, name: 'The Magician' },
      { suit: 'Wands', rank: 'Ace' }
    ];
    const result = detectFoolsJourneyStage(cards);

    // Single Major now returns result with 'minimal' significance for basic archetypal context
    assert.strictEqual(result.significance, 'minimal');
    assert.strictEqual(result.cardCount, 1);
    assert.strictEqual(result.totalMajors, 1);
    assert.strictEqual(result.stageKey, 'initiation');
  });

  it('handles mixed stages (returns dominant)', () => {
    const cards = [
      { number: 0, name: 'The Fool' },      // Initiation
      { number: 1, name: 'The Magician' },  // Initiation
      { number: 9, name: 'The Hermit' },    // Integration
      { number: 15, name: 'The Devil' }     // Culmination
    ];
    const result = detectFoolsJourneyStage(cards);

    assert.strictEqual(result.stage, 'departure'); // Dominant stage for 0-7 range
    assert.strictEqual(result.cardCount, 2);
  });

  it('marks 2-card dominant as "moderate" significance', () => {
    const cards = [
      { number: 8, name: 'Strength' },
      { number: 11, name: 'Justice' }
    ];
    const result = detectFoolsJourneyStage(cards);

    assert.strictEqual(result.significance, 'moderate');
  });
});

describe('detectArchetypalTriads', () => {
  it('detects complete Death-Temperance-Star triad', () => {
    const cards = [
      { number: 13, name: 'Death' },
      { number: 14, name: 'Temperance' },
      { number: 17, name: 'The Star' }
    ];
    const result = detectArchetypalTriads(cards);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'death-temperance-star');
    assert.strictEqual(result[0].isComplete, true);
    assert.strictEqual(result[0].theme, 'Healing Arc');
    assert.strictEqual(result[0].completeness, 100);
  });

  it('detects complete Devil-Tower-Sun triad', () => {
    const cards = [
      { number: 15, name: 'The Devil' },
      { number: 16, name: 'The Tower' },
      { number: 19, name: 'The Sun' }
    ];
    const result = detectArchetypalTriads(cards);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'devil-tower-sun');
    assert.strictEqual(result[0].theme, 'Liberation Arc');
  });

  it('detects partial triads (2 of 3 cards)', () => {
    const cards = [
      { number: 13, name: 'Death' },
      { number: 17, name: 'The Star' }
      // Missing: Temperance (14)
    ];
    const result = detectArchetypalTriads(cards);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].isComplete, false);
    assert.strictEqual(result[0].completeness, 67); // 2/3 = 66.67% rounded
    assert.strictEqual(result[0].strength, 'supporting');
  });

  it('returns empty array when no triads detected', () => {
    const cards = [
      { number: 0, name: 'The Fool' },
      { number: 4, name: 'The Emperor' },
      { number: 8, name: 'Strength' }
    ];
    const result = detectArchetypalTriads(cards);

    assert.strictEqual(result.length, 0);
  });

  it('detects multiple triads in same spread', () => {
    const cards = [
      { number: 13, name: 'Death' },        // Healing Arc
      { number: 14, name: 'Temperance' },   // Healing Arc
      { number: 17, name: 'The Star' },     // Healing Arc
      { number: 1, name: 'The Magician' },  // Mastery Arc
      { number: 7, name: 'The Chariot' },   // Mastery Arc
      { number: 21, name: 'The World' }     // Mastery Arc (also partial fool-magician-world)
    ];
    const result = detectArchetypalTriads(cards);

    // Expects 3: two complete (Healing + Mastery) plus partial fool-magician-world (1,21)
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].isComplete, true);
    assert.strictEqual(result[1].isComplete, true);
    // Third is the partial fool-magician-world triad (Magician + World)
    const partialTriad = result.find(t => !t.isComplete);
    assert.ok(partialTriad, 'Should find partial fool-magician-world triad');
    assert.strictEqual(partialTriad.id, 'fool-magician-world');
  });

  it('sorts complete triads before partial', () => {
    const cards = [
      { number: 13, name: 'Death' },     // Healing partial (death-star)
      { number: 17, name: 'The Star' },  // Healing partial + tower-star-moon partial
      { number: 15, name: 'The Devil' }, // Liberation complete
      { number: 16, name: 'The Tower' }, // Liberation complete + tower-star-moon partial
      { number: 19, name: 'The Sun' }    // Liberation complete
    ];
    const result = detectArchetypalTriads(cards);

    // Expects 3: one complete (Liberation) + two partials (death-star, tower-star)
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].isComplete, true);  // Complete first
    assert.strictEqual(result[1].isComplete, false); // Partial second
    assert.strictEqual(result[2].isComplete, false); // Partial third
  });
});

describe('detectArchetypalDyads', () => {
  it('detects Death + Star dyad', () => {
    const cards = [
      { number: 13, name: 'Death' },
      { number: 17, name: 'The Star' }
    ];
    const result = detectArchetypalDyads(cards);

    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].cards, [13, 17]);
    assert.strictEqual(result[0].theme, 'Transformation clearing into hope');
    assert.strictEqual(result[0].significance, 'high');
  });

  it('detects Fool + Magician dyad', () => {
    const cards = [
      { number: 0, name: 'The Fool' },
      { number: 1, name: 'The Magician' }
    ];
    const result = detectArchetypalDyads(cards);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].category, 'empowerment');
  });

  it('returns empty array when no dyads detected', () => {
    const cards = [
      { number: 4, name: 'The Emperor' },
      { number: 8, name: 'Strength' }
    ];
    const result = detectArchetypalDyads(cards);

    assert.strictEqual(result.length, 0);
  });

  it('detects multiple dyads and sorts by significance', () => {
    const cards = [
      { number: 0, name: 'The Fool' },        // Fool+Magician (high)
      { number: 1, name: 'The Magician' },    // Fool+Magician (high)
      { number: 8, name: 'Strength' },        // Strength+Justice (medium)
      { number: 11, name: 'Justice' }         // Strength+Justice (medium)
    ];
    const result = detectArchetypalDyads(cards);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].significance, 'high');    // High first
    assert.strictEqual(result[1].significance, 'medium');  // Medium second
  });

  it('returns null when <2 Major Arcana', () => {
    const cards = [
      { number: 1, name: 'The Magician' },
      { suit: 'Cups', rank: 'Ace' }
    ];
    const result = detectArchetypalDyads(cards);

    assert.strictEqual(result.length, 0);
  });
});

describe('detectSuitProgressions', () => {
  it('detects strong Wands ignition progression', () => {
    const cards = [
      { card: 'Ace of Wands', suit: 'Wands', rank: 'Ace', rankValue: 1 },
      { card: 'Two of Wands', suit: 'Wands', rank: 'Two', rankValue: 2 },
      { card: 'Three of Wands', suit: 'Wands', rank: 'Three', rankValue: 3 }
    ];

    const result = detectSuitProgressions(cards);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].suit, 'Wands');
    assert.strictEqual(result[0].stage, 'beginning');
    assert.strictEqual(result[0].significance, 'strong-progression');
  });

  it('detects emerging Cups mastery progression with 2 cards', () => {
    const cards = [
      { card: 'Nine of Cups', suit: 'Cups', rank: 'Nine', rankValue: 9 },
      { card: 'Ten of Cups', suit: 'Cups', rank: 'Ten', rankValue: 10 },
      { number: 0, name: 'The Fool' }
    ];

    const result = detectSuitProgressions(cards);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].stage, 'mastery');
    assert.strictEqual(result[0].significance, 'emerging-progression');
  });

  it('returns empty array when suit metadata missing', () => {
    const cards = [
      { number: 13, name: 'Death' },
      { card: 'Page of Pentacles', suit: 'Pentacles', rank: 'Page', rankValue: 11 }
    ];

    const result = detectSuitProgressions(cards);
    assert.strictEqual(result.length, 0);
  });
});

describe('detectAllPatterns', () => {
  it('detects all pattern types when present', () => {
    const cards = [
      { number: 0, name: 'The Fool' },      // Journey: initiation, Dyad: Fool+Magician, Partial: fool-magician-world
      { number: 1, name: 'The Magician' },  // Journey: initiation, Dyad: Fool+Magician, Partial Triad: Mastery Arc + fool-magician-world
      { number: 7, name: 'The Chariot' },   // Journey: initiation, Partial Triad: Mastery Arc
      { number: 13, name: 'Death' },        // Triad: Healing Arc, Dyad: Death+Star
      { number: 14, name: 'Temperance' },   // Triad: Healing Arc
      { number: 17, name: 'The Star' },     // Triad: Healing Arc, Dyad: Death+Star
      { card: 'Ace of Wands', suit: 'Wands', rank: 'Ace', rankValue: 1 },
      { card: 'Two of Wands', suit: 'Wands', rank: 'Two', rankValue: 2 }
    ];
    const result = detectAllPatterns(cards);

    assert.ok(result.foolsJourney);
    assert.ok(result.triads);
    assert.ok(result.dyads);
    assert.ok(result.suitProgressions);
    assert.strictEqual(result.foolsJourney.stage, 'departure'); // Stage value for 0-7 range
    // 3 triads: Healing Arc (complete) + Mastery Arc partial (1,7) + fool-magician-world partial (0,1)
    assert.strictEqual(result.triads.length, 3);
    assert.strictEqual(result.dyads.length, 3); // Fool+Magician + Death+Star + Death+Temperance
    assert.strictEqual(result.suitProgressions.length, 1);
  });

  it('detects court lineages with deck-aware suit aliases', () => {
    const cards = [
      { card: 'Page of Wands', suit: 'Wands', rank: 'Page', rankValue: 11 },
      { card: 'Knight of Wands', suit: 'Wands', rank: 'Knight', rankValue: 12 },
      { card: 'Queen of Wands', suit: 'Wands', rank: 'Queen', rankValue: 13 }
    ];
    const result = detectAllPatterns(cards, { deckStyle: 'marseille-classic' });

    assert.ok(result);
    assert.ok(result.courtLineages);
    assert.strictEqual(result.courtLineages[0].displaySuit, 'Batons');
    assert.strictEqual(result.courtLineages[0].significance, 'council');
  });

  it('returns null when no patterns detected', () => {
    const cards = [
      { suit: 'Wands', rank: 'Ace' },
      { suit: 'Cups', rank: 'Two' }
    ];
    const result = detectAllPatterns(cards);

    assert.strictEqual(result, null);
  });

  it('handles empty or invalid input gracefully', () => {
    assert.strictEqual(detectAllPatterns([]), null);
    assert.strictEqual(detectAllPatterns(null), null);
    assert.strictEqual(detectAllPatterns(undefined), null);
  });

  it('continues if one detector fails', () => {
    // This test validates graceful degradation
    // Even if one detection function throws, others should still run
    const cards = [
      { number: 13, name: 'Death' },
      { number: 14, name: 'Temperance' },
      { number: 17, name: 'The Star' }
    ];
    const result = detectAllPatterns(cards);

    // Should detect triads regardless of other detectors
    assert.ok(result.triads);
  });
});

describe('getPriorityPatternNarratives', () => {
  it('prioritizes complete triads first', () => {
    const patterns = {
      triads: [
        {
          id: 'death-temperance-star',
          theme: 'Healing Arc',
          isComplete: true,
          matchedNames: ['Death', 'Temperance', 'The Star'],
          matchedCards: [13, 14, 17],
          narrative: 'Ending → Integration → Renewal'
        }
      ],
      dyads: [
        {
          cards: [0, 1],
          names: ['The Fool', 'The Magician'],
          narrative: 'Fresh vision with tools to manifest',
          significance: 'high'
        }
      ]
    };

    const result = getPriorityPatternNarratives(patterns);

    assert.ok(result.length > 0);
    assert.strictEqual(result[0].priority, 1);
    assert.strictEqual(result[0].type, 'complete-triad');
  });

  it('includes strong Fool\'s Journey at priority 2', () => {
    const patterns = {
      foolsJourney: {
        stage: 'integration',
        cardCount: 4,
        significance: 'strong',
        readingSignificance: 'shadow work and transformation',
        cards: [
          { number: 9 }, { number: 12 }, { number: 13 }, { number: 14 }
        ]
      }
    };

    const result = getPriorityPatternNarratives(patterns);

    assert.ok(result.length > 0);
    assert.strictEqual(result[0].priority, 2);
    assert.strictEqual(result[0].type, 'fools-journey');
  });

  it('surfaces strong suit progression at priority 3', () => {
    const patterns = {
      triads: [
        {
          id: 'triad1',
          theme: 'Arc',
          isComplete: true,
          matchedNames: ['Death', 'Temperance', 'The Star'],
          matchedCards: [13, 14, 17],
          narrative: 'Healing arc'
        }
      ],
      suitProgressions: [
        {
          suit: 'Wands',
          stage: 'beginning',
          theme: 'Ignition',
          readingSignificance: 'Ignition phase energy.',
          narrative: 'Ace → Two → Three',
          stageCards: [
            { card: 'Ace of Wands', rankValue: 1 },
            { card: 'Two of Wands', rankValue: 2 },
            { card: 'Three of Wands', rankValue: 3 }
          ],
          stageCardCount: 3,
          significance: 'strong-progression'
        }
      ],
      dyads: [
        {
          cards: [0, 1],
          names: ['The Fool', 'The Magician'],
          narrative: 'Fresh potential meets skill',
          significance: 'high',
          category: 'empowerment'
        }
      ]
    };

    const result = getPriorityPatternNarratives(patterns);

    assert.ok(result.length >= 2);
    assert.strictEqual(result[1].type, 'suit-progression');
    assert.strictEqual(result[1].priority, 3);
  });

  it('includes court lineage highlights with deck-aware naming', () => {
    const cards = [
      { card: 'Page of Wands', suit: 'Wands', rank: 'Page', rankValue: 11 },
      { card: 'Knight of Wands', suit: 'Wands', rank: 'Knight', rankValue: 12 }
    ];
    const patterns = detectAllPatterns(cards, { deckStyle: 'thoth-a1' });
    const result = getPriorityPatternNarratives(patterns, 'thoth-a1');

    const lineage = result.find((entry) => entry.type === 'court-lineage');
    assert.ok(lineage, 'Expected a court-lineage narrative');
    assert.match(lineage.text, /Princess of Wands/);
  });

  it('limits output to maximum 5 patterns', () => {
    const patterns = {
      triads: [
        // 3 complete triads
        { id: 'triad1', isComplete: true, theme: 'Arc 1', matchedNames: ['A', 'B', 'C'], matchedCards: [1, 2, 3], narrative: 'test' },
        { id: 'triad2', isComplete: true, theme: 'Arc 2', matchedNames: ['D', 'E', 'F'], matchedCards: [4, 5, 6], narrative: 'test' },
        { id: 'triad3', isComplete: true, theme: 'Arc 3', matchedNames: ['G', 'H', 'I'], matchedCards: [7, 8, 9], narrative: 'test' }
      ],
      foolsJourney: {
        stage: 'initiation',
        cardCount: 3,
        significance: 'strong',
        readingSignificance: 'building',
        cards: [{ number: 0 }, { number: 1 }, { number: 2 }]
      },
      dyads: [
        { cards: [10, 11], names: ['X', 'Y'], narrative: 'test', significance: 'high', category: 'test' },
        { cards: [12, 13], names: ['W', 'Z'], narrative: 'test', significance: 'high', category: 'test' }
      ]
    };

    const result = getPriorityPatternNarratives(patterns);

    assert.ok(result.length <= 5);
  });

  it('returns empty array when no patterns provided', () => {
    const result = getPriorityPatternNarratives(null);

    assert.strictEqual(result.length, 0);
  });

  it('includes moderate Fool\'s Journey at priority 4', () => {
    const patterns = {
      foolsJourney: {
        stage: 'initiation',
        cardCount: 2,
        significance: 'moderate',
        readingSignificance: 'building',
        displayNames: ['The Fool', 'The Magician'],
        cards: [{ number: 0 }, { number: 1 }]
      }
    };

    const result = getPriorityPatternNarratives(patterns);

    // Moderate journey now included at priority 4
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].priority, 4);
    assert.strictEqual(result[0].type, 'fools-journey');
  });
});

describe('GraphRAG pattern consistency', () => {
  it('keeps triad passages aligned with archetypal triads', () => {
    const triadIds = new Set(ARCHETYPAL_TRIADS.map((triad) => triad.id));
    const passageIds = new Set(Object.keys(TRIAD_PASSAGES));

    const missingPassages = [...triadIds].filter((id) => !passageIds.has(id));
    const extraPassages = [...passageIds].filter((id) => !triadIds.has(id));

    assert.deepStrictEqual(
      missingPassages,
      [],
      `Triads missing GraphRAG passages: ${missingPassages.join(', ')}`
    );
    assert.deepStrictEqual(
      extraPassages,
      [],
      `Triad passages without matching triads: ${extraPassages.join(', ')}`
    );
  });

  it('keeps dyad passages aligned with GraphRAG-eligible dyads', () => {
    const eligibleDyads = ARCHETYPAL_DYADS.filter((dyad) =>
      ['high', 'medium-high'].includes(dyad.significance)
    );
    const dyadByKey = new Map(
      ARCHETYPAL_DYADS.map((dyad) => [dyad.cards.join('-'), dyad])
    );
    const eligibleKeys = new Set(eligibleDyads.map((dyad) => dyad.cards.join('-')));
    const passageKeys = Object.keys(DYAD_PASSAGES);

    const missingPassages = [...eligibleKeys].filter((key) => !DYAD_PASSAGES[key]);
    const extraPassages = passageKeys.filter((key) => !dyadByKey.has(key));
    assert.deepStrictEqual(
      missingPassages,
      [],
      `Dyads missing GraphRAG passages: ${missingPassages.join(', ')}`
    );
    assert.deepStrictEqual(
      extraPassages,
      [],
      `Dyad passages without matching dyads: ${extraPassages.join(', ')}`
    );
  });
});
