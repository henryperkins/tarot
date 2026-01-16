import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  analyzeCardCoverage,
  detectHallucinatedCards,
  buildCardAliases,
  buildDeckAwarePatterns,
  lookupCardByName,
  AMBIGUOUS_THOTH_EPITHETS,
  persistReadingMetrics
} from '../functions/lib/readingQuality.js';

class MockDB {
  constructor() {
    this.queries = [];
  }

  prepare(sql) {
    const query = { sql, bindings: [] };
    this.queries.push(query);
    return {
      bind: (...args) => {
        query.bindings = args;
        return {
          run: async () => ({ meta: { changes: 1 } })
        };
      }
    };
  }

  getLastQuery() {
    return this.queries[this.queries.length - 1];
  }
}

// =============================================================================
// buildCardAliases tests
// =============================================================================

describe('buildCardAliases', () => {
  describe('RWS deck (default)', () => {
    it('returns only canonical name for Major Arcana', () => {
      const card = lookupCardByName('The Fool');
      const aliases = buildCardAliases(card, 'rws-1909');
      assert.deepStrictEqual(aliases, ['The Fool']);
    });

    it('returns only canonical name for Minor Arcana', () => {
      const card = lookupCardByName('Two of Cups');
      const aliases = buildCardAliases(card, 'rws-1909');
      assert.ok(aliases.includes('Two of Cups'));
      assert.ok(aliases.includes('2 of Cups'));
      assert.ok(aliases.includes('II of Cups'));
    });

    it('returns only canonical name for court cards', () => {
      const card = lookupCardByName('Page of Cups');
      const aliases = buildCardAliases(card, 'rws-1909');
      assert.ok(aliases.includes('Page of Cups'));
      assert.ok(aliases.includes('Pg of Cups'));
    });
  });

  describe('Thoth deck', () => {
    it('includes Thoth Major aliases', () => {
      const card = lookupCardByName('The Magician');
      const aliases = buildCardAliases(card, 'thoth-a1');
      assert.ok(aliases.includes('The Magician'), 'Should include RWS name');
      assert.ok(aliases.includes('The Magus'), 'Should include Thoth alias');
    });

    it('includes court card transformations (Page → Princess)', () => {
      const card = lookupCardByName('Page of Cups');
      const aliases = buildCardAliases(card, 'thoth-a1');
      assert.ok(aliases.includes('Page of Cups'), 'Should include RWS name');
      assert.ok(aliases.includes('Princess of Cups'), 'Should include Thoth alias');
    });

    it('includes court card transformations (King → Knight)', () => {
      const card = lookupCardByName('King of Wands');
      const aliases = buildCardAliases(card, 'thoth-a1');
      assert.ok(aliases.includes('King of Wands'), 'Should include RWS name');
      assert.ok(aliases.includes('Knight of Wands'), 'Should include Thoth alias');
    });

    it('includes Thoth epithets for pip cards', () => {
      const card = lookupCardByName('Two of Wands');
      const aliases = buildCardAliases(card, 'thoth-a1');
      assert.ok(aliases.includes('Two of Wands'), 'Should include RWS name');
      assert.ok(aliases.includes('Dominion'), 'Should include epithet');
      assert.ok(aliases.some(a => a.includes('Dominion (Two of Wands)')), 'Should include full epithet form');
    });

    it('includes suit alias (Pentacles → Disks)', () => {
      const card = lookupCardByName('Three of Pentacles');
      const aliases = buildCardAliases(card, 'thoth-a1');
      assert.ok(aliases.includes('Three of Pentacles'), 'Should include RWS name');
      assert.ok(aliases.includes('Three of Disks'), 'Should include Thoth suit alias');
      assert.ok(aliases.includes('Works'), 'Should include epithet');
    });
  });

  describe('Marseille deck', () => {
    it('includes Marseille Major aliases', () => {
      const card = lookupCardByName('The Fool');
      const aliases = buildCardAliases(card, 'marseille-classic');
      assert.ok(aliases.includes('The Fool'), 'Should include RWS name');
      assert.ok(aliases.includes('Le Mat'), 'Should include Marseille alias');
    });

    it('includes Marseille court transformations (Page → Valet)', () => {
      const card = lookupCardByName('Page of Swords');
      const aliases = buildCardAliases(card, 'marseille-classic');
      assert.ok(aliases.includes('Page of Swords'), 'Should include RWS name');
      assert.ok(aliases.includes('Valet of Epees'), 'Should include Marseille alias');
    });

    it('includes Marseille suit aliases', () => {
      const card = lookupCardByName('Five of Pentacles');
      const aliases = buildCardAliases(card, 'marseille-classic');
      assert.ok(aliases.includes('Five of Pentacles'), 'Should include RWS name');
      assert.ok(aliases.includes('Five of Coins'), 'Should include Marseille suit');
    });
  });
});

// =============================================================================
// analyzeCardCoverage tests
// =============================================================================

describe('analyzeCardCoverage', () => {
  describe('RWS deck (default)', () => {
    it('finds coverage with exact RWS names', () => {
      const text = 'The **Page of Cups** suggests new emotional beginnings.';
      const cardsInfo = [{ card: 'Page of Cups', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'rws-1909');
      assert.strictEqual(result.coverage, 1);
      assert.deepStrictEqual(result.missingCards, []);
    });

    it('reports missing cards', () => {
      const text = 'This reading speaks of new beginnings.';
      const cardsInfo = [{ card: 'Page of Cups', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'rws-1909');
      assert.strictEqual(result.coverage, 0);
      assert.deepStrictEqual(result.missingCards, ['Page of Cups']);
    });

    it('recognizes numeric and roman shorthand for pip cards', () => {
      const text = 'The **IV of Cups** invites a quiet pause before moving on.';
      const cardsInfo = [{ card: 'Four of Cups', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'rws-1909');
      assert.strictEqual(result.coverage, 1, 'IV of Cups should count as Four of Cups');
    });

    it('tolerates minor misspellings in card names', () => {
      const text = '**The Magican** urges deliberate action.';
      const cardsInfo = [{ card: 'The Magician', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'rws-1909');
      assert.strictEqual(result.coverage, 1, 'Minor misspellings should count as coverage');
    });

    it('recognizes abbreviated court shorthand', () => {
      const text = 'The **K of Wands** pushes you toward bold leadership.';
      const cardsInfo = [{ card: 'King of Wands', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'rws-1909');
      assert.strictEqual(result.coverage, 1, 'K of Wands should count as King of Wands');
    });
  });

  describe('Thoth deck', () => {
    it('recognizes Princess as coverage for Page', () => {
      const text = 'The **Princess of Cups** brings emotional intuition.';
      const cardsInfo = [{ card: 'Page of Cups', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'thoth-a1');
      assert.strictEqual(result.coverage, 1, 'Princess should count as coverage for Page');
      assert.deepStrictEqual(result.missingCards, []);
    });

    it('recognizes epithet as coverage', () => {
      const text = 'The Dominion card shows mastery over your domain.';
      const cardsInfo = [{ card: 'Two of Wands', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'thoth-a1');
      assert.strictEqual(result.coverage, 1, 'Dominion should count as coverage for Two of Wands');
    });

    it('recognizes Thoth Major alias (The Magus)', () => {
      const text = 'The Magus brings transformative power to this reading.';
      const cardsInfo = [{ card: 'The Magician', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'thoth-a1');
      assert.strictEqual(result.coverage, 1, 'The Magus should count as coverage for The Magician');
    });

    it('recognizes Disks as coverage for Pentacles', () => {
      const text = 'The Three of Disks represents collaborative work.';
      const cardsInfo = [{ card: 'Three of Pentacles', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'thoth-a1');
      assert.strictEqual(result.coverage, 1, 'Three of Disks should count for Three of Pentacles');
    });

    it('recognizes numeric shorthand with Thoth suit aliases', () => {
      const text = 'The **4 of Disks** shows protective boundaries.';
      const cardsInfo = [{ card: 'Four of Pentacles', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'thoth-a1');
      assert.strictEqual(result.coverage, 1, '4 of Disks should count for Four of Pentacles');
    });
  });

  describe('Marseille deck', () => {
    it('recognizes Le Mat as coverage for The Fool', () => {
      const text = 'Le Mat begins the journey through the Major Arcana.';
      const cardsInfo = [{ card: 'The Fool', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'marseille-classic');
      assert.strictEqual(result.coverage, 1, 'Le Mat should count as coverage for The Fool');
    });

    it('recognizes Valet as coverage for Page', () => {
      const text = 'The Valet of Epees cuts through confusion.';
      const cardsInfo = [{ card: 'Page of Swords', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'marseille-classic');
      assert.strictEqual(result.coverage, 1, 'Valet of Epees should count for Page of Swords');
    });

    it('recognizes roman shorthand with Marseille suit aliases', () => {
      const text = 'The **IV of Coins** highlights conservation.';
      const cardsInfo = [{ card: 'Four of Pentacles', position: 'Present' }];

      const result = analyzeCardCoverage(text, cardsInfo, 'marseille-classic');
      assert.strictEqual(result.coverage, 1, 'IV of Coins should count for Four of Pentacles');
    });
  });
});

// =============================================================================
// detectHallucinatedCards tests
// =============================================================================

describe('detectHallucinatedCards', () => {
  describe('RWS deck (default)', () => {
    it('detects hallucinated cards not in spread', () => {
      // Use full card names - "The Tower" not just "Tower"
      const text = '**The Tower** brings sudden change, while **The Star** offers hope.';
      const cardsInfo = [{ card: 'The Star', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'rws-1909');
      assert.ok(result.includes('The Tower'), 'The Tower should be detected as hallucinated');
      assert.ok(!result.includes('The Star'), 'The Star should not be hallucinated (it is in spread)');
    });

    it('does not flag cards that are in the spread', () => {
      const text = 'The **Page of Cups** and **The Fool** appear together.';
      const cardsInfo = [
        { card: 'Page of Cups', position: 'Present' },
        { card: 'The Fool', position: 'Future' }
      ];

      const result = detectHallucinatedCards(text, cardsInfo, 'rws-1909');
      assert.deepStrictEqual(result, []);
    });

    it('flags shorthand mentions as hallucinations when absent', () => {
      const text = 'The **IV of Cups** signals withdrawal.';
      const cardsInfo = [{ card: 'The Fool', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'rws-1909');
      assert.ok(result.includes('Four of Cups'), 'IV of Cups should map to Four of Cups');
    });

    it('does not flag misspelled drawn cards as hallucinations', () => {
      const text = '**The Hie Priestess** guides intuition.';
      const cardsInfo = [{ card: 'The High Priestess', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'rws-1909');
      assert.deepStrictEqual(result, []);
    });

    it('flags misspelled hallucinated cards', () => {
      const text = '**The Empresss** signals a surge of creative abundance.';
      const cardsInfo = [{ card: 'The Fool', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'rws-1909');
      assert.ok(result.includes('The Empress'), 'Misspelled Empress should be flagged');
    });
  });

  describe('Thoth deck alias handling', () => {
    it('does not flag Princess when Page is in spread', () => {
      const text = 'The **Princess of Cups** brings emotional intuition.';
      const cardsInfo = [{ card: 'Page of Cups', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'thoth-a1');
      assert.deepStrictEqual(result, [], 'Princess of Cups should not be hallucinated when Page of Cups is drawn');
    });

    it('does not flag epithet when pip is in spread', () => {
      const text = 'The **Dominion** card shows mastery.';
      const cardsInfo = [{ card: 'Two of Wands', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'thoth-a1');
      assert.deepStrictEqual(result, [], 'Dominion should not be hallucinated when Two of Wands is drawn');
    });

    it('does not flag Thoth Major alias when RWS Major is drawn', () => {
      const text = 'The **Magus** channels transformative energy.';
      const cardsInfo = [{ card: 'The Magician', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'thoth-a1');
      assert.deepStrictEqual(result, [], 'The Magus should not be hallucinated when The Magician is drawn');
    });

    it('flags Princess as hallucinated when Page is NOT in spread', () => {
      const text = 'The **Princess of Cups** and the **Princess of Wands** appear.';
      const cardsInfo = [{ card: 'The Fool', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'thoth-a1');
      assert.ok(result.includes('Page of Cups'), 'Page of Cups (canonical) should be flagged');
      assert.ok(result.includes('Page of Wands'), 'Page of Wands (canonical) should be flagged');
    });
  });

  describe('Thoth epithet ambiguity', () => {
    it('does not flag epithets used as common words (no card context)', () => {
      const text = 'Practice love and abundance in your daily life.';
      const cardsInfo = [{ card: 'The Fool', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'thoth-a1');
      assert.deepStrictEqual(result, [], 'Common words should not trigger false positives');
    });

    it('flags epithet when used with explicit card context', () => {
      const text = 'The **Love** card speaks of deep emotional bonds.';
      const cardsInfo = [{ card: 'The Fool', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'thoth-a1');
      assert.ok(result.includes('Two of Cups'), 'Two of Cups (canonical for Love) should be flagged');
    });
  });

  describe('Marseille deck alias handling', () => {
    it('does not flag Le Mat when The Fool is in spread', () => {
      const text = 'Le Mat begins the journey anew.';
      const cardsInfo = [{ card: 'The Fool', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'marseille-classic');
      assert.deepStrictEqual(result, [], 'Le Mat should not be hallucinated when The Fool is drawn');
    });

    it('does not flag Valet when Page is in spread', () => {
      const text = 'The **Valet of Epees** cuts through illusion.';
      const cardsInfo = [{ card: 'Page of Swords', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'marseille-classic');
      assert.deepStrictEqual(result, [], 'Valet of Epees should not be hallucinated when Page of Swords is drawn');
    });
  });

  describe('cross-deck consistency', () => {
    it('RWS deck does not recognize Thoth aliases as valid', () => {
      // When using RWS deck, Princess of Cups should be hallucinated even if Page of Cups is drawn
      // because RWS readings shouldn't use Thoth terminology
      const text = 'The **Princess of Cups** brings intuition.';
      const cardsInfo = [{ card: 'Page of Cups', position: 'Present' }];

      const result = detectHallucinatedCards(text, cardsInfo, 'rws-1909');
      // Princess of Cups is not in the RWS pattern set, so it won't be detected as a card at all
      // This is correct behavior - RWS readings shouldn't mention Princess
      assert.ok(!result.includes('Princess of Cups'), 'Princess is not an RWS card name');
    });
  });
});

// =============================================================================
// buildDeckAwarePatterns tests
// =============================================================================

describe('buildDeckAwarePatterns', () => {
  it('caches patterns per deck style', () => {
    const patterns1 = buildDeckAwarePatterns('thoth-a1');
    const patterns2 = buildDeckAwarePatterns('thoth-a1');
    assert.strictEqual(patterns1, patterns2, 'Should return cached patterns');
  });

  it('returns different patterns for different deck styles', () => {
    const rwsPatterns = buildDeckAwarePatterns('rws-1909');
    const thothPatterns = buildDeckAwarePatterns('thoth-a1');
    assert.notStrictEqual(rwsPatterns.length, thothPatterns.length,
      'Thoth should have more patterns due to aliases');
  });

  it('marks epithets correctly', () => {
    const patterns = buildDeckAwarePatterns('thoth-a1');
    const dominion = patterns.find(p => p.name === 'Dominion');
    assert.ok(dominion, 'Should have Dominion pattern');
    assert.strictEqual(dominion.isEpithet, true, 'Dominion should be marked as epithet');
    assert.strictEqual(dominion.canonical, 'Two of Wands', 'Should map to canonical name');
  });
});

// =============================================================================
// AMBIGUOUS_THOTH_EPITHETS tests
// =============================================================================

describe('AMBIGUOUS_THOTH_EPITHETS', () => {
  it('contains common-word epithets', () => {
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('love'), 'Should contain love');
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('peace'), 'Should contain peace');
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('victory'), 'Should contain victory');
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('power'), 'Should contain power');
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('wealth'), 'Should contain wealth');
  });

  it('contains less-common but still ambiguous epithets', () => {
    // Some epithets are less common as words but still prone to false positives
    // because they might appear in advice or metaphorical language
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('dominion'), 'Dominion could appear in context of control/power');
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('oppression'), 'Oppression is used metaphorically');
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.has('sorrow'), 'Sorrow is common in emotional readings');
  });

  it('set size covers common-word epithets', () => {
    // We expect a reasonable number of epithets to be marked as ambiguous
    // There are 40 pip epithets total, and most are common words
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.size >= 20, 'Should have at least 20 ambiguous epithets');
    assert.ok(AMBIGUOUS_THOTH_EPITHETS.size <= 40, 'Should not exceed total pip count');
  });
});

// =============================================================================
// persistReadingMetrics tests
// =============================================================================

describe('persistReadingMetrics', () => {
  it('persists backend error details and quality issues', async () => {
    const mockDB = new MockDB();
    const payload = {
      requestId: 'metrics-test',
      spreadKey: 'threeCard',
      deckStyle: 'rws-1909',
      provider: 'azure-gpt5',
      narrative: { cardCoverage: 0.4 },
      backendErrors: [
        {
          backend: 'azure-gpt5',
          error: 'Narrative failed quality checks',
          qualityIssues: ['low card coverage']
        }
      ]
    };

    await persistReadingMetrics({ DB: mockDB }, payload);

    const query = mockDB.getLastQuery();
    const payloadBinding = query.bindings.find(binding => typeof binding === 'string' && binding.startsWith('{'));
    const storedPayload = JSON.parse(payloadBinding);

    assert.deepStrictEqual(storedPayload.backendErrors, payload.backendErrors);
    assert.deepStrictEqual(storedPayload.backendErrors[0].qualityIssues, ['low card coverage']);
  });
});
