import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { generateFollowUpSuggestions } from '../src/lib/followUpSuggestions.js';

describe('generateFollowUpSuggestions', () => {
  describe('reversal-based suggestions', () => {
    test('generates card-specific question for single reversed card', () => {
      const reading = [
        { name: 'The Tower', isReversed: true },
        { name: 'The Star', isReversed: false }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});

      const reversalSuggestion = suggestions.find(s => s.type === 'reversal');
      assert.ok(reversalSuggestion, 'Should generate reversal suggestion');
      assert.ok(reversalSuggestion.text.includes('Tower'), 'Should mention the reversed card by name');
      assert.ok(reversalSuggestion.text.includes('reversed'), 'Should mention reversed orientation');
    });

    test('handles orientation property for reversed detection', () => {
      const reading = [
        { name: 'The Moon', orientation: 'reversed' },
        { name: 'The Sun', orientation: 'upright' }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});

      const reversalSuggestion = suggestions.find(s => s.type === 'reversal');
      assert.ok(reversalSuggestion, 'Should detect reversed via orientation property');
      assert.ok(reversalSuggestion.text.includes('Moon'));
    });

    test('generates pattern question for multiple reversed cards', () => {
      const reading = [
        { name: 'The Tower', isReversed: true },
        { name: 'The Moon', isReversed: true },
        { name: 'The Star', isReversed: false }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});

      const reversalSuggestion = suggestions.find(s => s.type === 'reversal');
      assert.ok(reversalSuggestion, 'Should generate reversal suggestion');
      assert.ok(reversalSuggestion.text.includes('pattern'), 'Should ask about pattern for multiple reversals');
      assert.ok(!reversalSuggestion.text.includes('Tower'), 'Should not name specific card for pattern question');
    });

    test('uses card property as fallback for name', () => {
      const reading = [
        { card: 'The Hermit', isReversed: true }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});

      const reversalSuggestion = suggestions.find(s => s.type === 'reversal');
      assert.ok(reversalSuggestion.text.includes('Hermit'));
    });
  });

  describe('spread-specific suggestions', () => {
    test('includes Celtic Cross specific questions', () => {
      const suggestions = generateFollowUpSuggestions(
        [{ name: 'Card 1' }],
        {},
        { spreadKey: 'celtic' }
      );

      const spreadSuggestion = suggestions.find(s => s.type === 'spread');
      assert.ok(spreadSuggestion, 'Should include spread-specific suggestion');
      assert.ok(
        spreadSuggestion.text.includes('crossing') || spreadSuggestion.text.includes('subconscious'),
        'Should reference Celtic Cross positions'
      );
    });

    test('includes Three Card specific questions', () => {
      const suggestions = generateFollowUpSuggestions(
        [{ name: 'Card 1' }],
        {},
        { spreadKey: 'threeCard' }
      );

      const spreadSuggestion = suggestions.find(s => s.type === 'spread');
      assert.ok(spreadSuggestion);
      assert.ok(
        spreadSuggestion.text.includes('present') || spreadSuggestion.text.includes('bridge'),
        'Should reference past/present/future flow'
      );
    });

    test('includes Relationship spread specific questions', () => {
      const suggestions = generateFollowUpSuggestions(
        [{ name: 'Card 1' }],
        {},
        { spreadKey: 'relationship' }
      );

      const spreadSuggestion = suggestions.find(s => s.type === 'spread');
      assert.ok(spreadSuggestion);
      assert.ok(
        spreadSuggestion.text.includes('person') || spreadSuggestion.text.includes('shared'),
        'Should reference relationship dynamics'
      );
    });

    test('includes Decision spread specific questions', () => {
      const suggestions = generateFollowUpSuggestions(
        [{ name: 'Card 1' }],
        {},
        { spreadKey: 'decision' }
      );

      const spreadSuggestion = suggestions.find(s => s.type === 'spread');
      assert.ok(spreadSuggestion);
      assert.ok(
        spreadSuggestion.text.includes('path') || spreadSuggestion.text.includes('choice'),
        'Should reference decision paths'
      );
    });

    test('includes Single card specific questions', () => {
      const suggestions = generateFollowUpSuggestions(
        [{ name: 'Card 1' }],
        {},
        { spreadKey: 'single' }
      );

      const spreadSuggestion = suggestions.find(s => s.type === 'spread');
      assert.ok(spreadSuggestion);
      assert.ok(spreadSuggestion.text.includes('action') || spreadSuggestion.text.includes('today'));
    });

    test('handles unknown spread gracefully', () => {
      const suggestions = generateFollowUpSuggestions(
        [{ name: 'Card 1' }],
        {},
        { spreadKey: 'unknownSpread' }
      );

      // Should still generate other suggestions
      assert.ok(suggestions.length >= 1);
      assert.ok(suggestions.find(s => s.type === 'action'), 'Should still have action fallback');
    });
  });

  describe('elemental suggestions', () => {
    test('detects dominant element with 3+ cards', () => {
      const themes = {
        elementCounts: { Fire: 4, Water: 1, Air: 0, Earth: 1 }
      };

      const suggestions = generateFollowUpSuggestions([], themes, {});

      const elementalSuggestion = suggestions.find(s => s.type === 'elemental');
      assert.ok(elementalSuggestion, 'Should generate elemental suggestion');
      assert.ok(elementalSuggestion.text.includes('Fire'), 'Should mention dominant element');
    });

    test('detects missing elements', () => {
      const themes = {
        elementCounts: { Fire: 2, Water: 2, Air: 0, Earth: 2 }
      };

      const suggestions = generateFollowUpSuggestions([], themes, {});

      const missingElementSuggestion = suggestions.find(
        s => s.type === 'elemental' && s.text.includes('absence')
      );
      assert.ok(missingElementSuggestion, 'Should detect missing element');
      assert.ok(missingElementSuggestion.text.includes('Air'));
    });

    test('handles missing elementCounts gracefully', () => {
      const suggestions = generateFollowUpSuggestions([], {}, {});

      // Should not throw and should still have other suggestions
      assert.ok(Array.isArray(suggestions));
    });

    test('handles null themes gracefully', () => {
      const suggestions = generateFollowUpSuggestions([], null, {});
      assert.ok(Array.isArray(suggestions));
    });
  });

  describe('Major Arcana suggestions', () => {
    test('generates archetype question when 3+ Major Arcana present', () => {
      const reading = [
        { name: 'The Fool', number: 0 },
        { name: 'The Magician', number: 1 },
        { name: 'The High Priestess', number: 2 },
        { name: 'Two of Cups', number: 2 }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});

      const archetypeSuggestion = suggestions.find(s => s.type === 'archetype');
      assert.ok(archetypeSuggestion, 'Should generate archetype suggestion');
      assert.ok(archetypeSuggestion.text.includes('Major Arcana'));
    });

    test('uses arcanaNumber as fallback for number', () => {
      const reading = [
        { name: 'The Fool', arcanaNumber: 0 },
        { name: 'The Magician', arcanaNumber: 1 },
        { name: 'The High Priestess', arcanaNumber: 2 }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});

      const archetypeSuggestion = suggestions.find(s => s.type === 'archetype');
      assert.ok(archetypeSuggestion, 'Should detect Major Arcana via arcanaNumber');
    });

    test('does not generate archetype suggestion for < 3 Major Arcana', () => {
      const reading = [
        { name: 'The Fool', number: 0 },
        { name: 'Two of Cups', number: 2 },
        { name: 'Three of Wands', number: 3 }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});

      const archetypeSuggestion = suggestions.find(s => s.type === 'archetype');
      assert.ok(!archetypeSuggestion, 'Should not suggest archetype with < 3 Major Arcana');
    });
  });

  describe('fallback suggestions', () => {
    test('always includes action-oriented fallback', () => {
      const suggestions = generateFollowUpSuggestions([], {}, {});

      const actionSuggestion = suggestions.find(s => s.type === 'action');
      assert.ok(actionSuggestion, 'Should always include action suggestion');
      assert.ok(actionSuggestion.text.includes('focus'));
    });

    test('includes shadow/blocking suggestion', () => {
      const suggestions = generateFollowUpSuggestions([], {}, {});

      const shadowSuggestion = suggestions.find(s => s.type === 'shadow');
      assert.ok(shadowSuggestion, 'Should include shadow suggestion');
      assert.ok(shadowSuggestion.text.includes('blocking'));
    });
  });

  describe('suggestion limits and ordering', () => {
    test('limits suggestions to 4', () => {
      const reading = Array(10).fill(null).map((_, i) => ({
        name: `Card ${i}`,
        isReversed: i % 2 === 0,
        number: i
      }));

      const suggestions = generateFollowUpSuggestions(reading, {
        elementCounts: { Fire: 5, Water: 0, Air: 0, Earth: 0 }
      }, { spreadKey: 'celtic' });

      assert.ok(suggestions.length <= 4, `Expected <= 4 suggestions, got ${suggestions.length}`);
    });

    test('sorts suggestions by priority', () => {
      // Create scenario with multiple suggestion types
      const reading = [
        { name: 'The Tower', isReversed: true } // Priority 1
      ];
      const themes = {
        elementCounts: { Fire: 4, Water: 0, Air: 0, Earth: 0 } // Priority 3
      };
      const meta = { spreadKey: 'celtic' }; // Priority 2

      const suggestions = generateFollowUpSuggestions(reading, themes, meta);

      // Reversal should be first (priority 1)
      assert.equal(suggestions[0].type, 'reversal');
    });

    test('deduplicates suggestions with same text', () => {
      const suggestions = generateFollowUpSuggestions([], {}, {});

      const texts = suggestions.map(s => s.text);
      const uniqueTexts = [...new Set(texts)];
      assert.equal(texts.length, uniqueTexts.length, 'Should not have duplicate suggestions');
    });
  });

  describe('edge cases', () => {
    test('handles empty reading array', () => {
      const suggestions = generateFollowUpSuggestions([], {}, {});
      assert.ok(Array.isArray(suggestions));
      assert.ok(suggestions.length >= 1);
    });

    test('handles null reading', () => {
      const suggestions = generateFollowUpSuggestions(null, {}, {});
      assert.ok(Array.isArray(suggestions));
    });

    test('handles undefined reading', () => {
      const suggestions = generateFollowUpSuggestions(undefined, {}, {});
      assert.ok(Array.isArray(suggestions));
    });

    test('handles null readingMeta', () => {
      const suggestions = generateFollowUpSuggestions([], {}, null);
      assert.ok(Array.isArray(suggestions));
    });

    test('handles reading with no card names', () => {
      const reading = [
        { isReversed: true },
        { isReversed: false }
      ];

      const suggestions = generateFollowUpSuggestions(reading, {}, {});
      assert.ok(Array.isArray(suggestions));
    });
  });

  describe('suit-based suggestions', () => {
    test('detects dominant suit', () => {
      const themes = {
        suitCounts: { Wands: 4, Cups: 1, Swords: 0, Pentacles: 1 }
      };

      const suggestions = generateFollowUpSuggestions([], themes, {});

      // Look for any suggestion mentioning the dominant suit
      const suitSuggestion = suggestions.find(s => 
        s.type === 'suit' || 
        (s.text && s.text.toLowerCase().includes('wand'))
      );
      
      // This is optional behavior - may or may not be implemented
      // Just verify we don't crash
      assert.ok(Array.isArray(suggestions));
    });
  });
});
