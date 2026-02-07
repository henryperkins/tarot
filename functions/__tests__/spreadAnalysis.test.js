import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVERSAL_FRAMEWORKS,
  selectReversalFramework,
  getCardElement,
  analyzeSpreadThemes,
  analyzeRelationship
} from '../lib/spreadAnalysis.js';

describe('Reversal Frameworks', () => {
  it('should have all expected frameworks defined', () => {
    const expectedKeys = [
      'none',
      'blocked',
      'delayed',
      'internalized',
      'contextual',
      'shadow',
      'mirror',
      'potentialBlocked'
    ];

    expectedKeys.forEach(key => {
      const framework = REVERSAL_FRAMEWORKS[key];
      assert.ok(framework, `Framework ${key} is missing`);
      assert.ok(framework.name, `Framework ${key} needs a name`);
      assert.ok(framework.description, `Framework ${key} needs a description`);
      assert.ok(framework.guidance, `Framework ${key} needs guidance text`);
    });
  });

  it('shadow framework should have examples for key cards', () => {
    const shadow = REVERSAL_FRAMEWORKS.shadow;
    assert.ok(shadow.examples['The Moon']);
    assert.ok(shadow.examples['The Tower']);
  });
});

describe('selectReversalFramework', () => {
  it('detects shadow intent from question keywords', () => {
    const result = selectReversalFramework(0.3, [], {
      userQuestion: 'What am I afraid to face?'
    });
    assert.strictEqual(result, 'shadow');
  });

  it('detects mirror intent from question keywords', () => {
    const result = selectReversalFramework(0.3, [], {
      userQuestion: 'Why do I keep attracting the same patterns?'
    });
    assert.strictEqual(result, 'mirror');
  });

  it('detects potential-blocked when 2+ Major Arcana are reversed', () => {
    const cardsInfo = [
      { number: 1, orientation: 'Reversed' },
      { number: 17, orientation: 'Reversed' },
      { number: 5, orientation: 'Upright' }
    ];
    const result = selectReversalFramework(0.4, cardsInfo, {});
    assert.strictEqual(result, 'potentialBlocked');
  });

  it('does not treat reversed suited minors as Major Arcana', () => {
    const cardsInfo = [
      { card: 'Three of Cups', suit: 'Cups', number: 3, orientation: 'Reversed' },
      { card: 'Seven of Wands', suit: 'Wands', number: 7, orientation: 'Reversed' },
      { card: 'Ace of Swords', suit: 'Swords', number: 1, orientation: 'Upright' }
    ];

    const result = selectReversalFramework(2 / 3, cardsInfo, {});
    assert.notStrictEqual(result, 'potentialBlocked');
  });

  it('does not trigger potentialBlocked for generic "could be" phrasing', () => {
    const cardsInfo = [
      { card: 'Two of Cups', suit: 'Cups', number: 2, orientation: 'Reversed' },
      { card: 'The Sun', number: 19, orientation: 'Upright' },
      { card: 'Three of Pentacles', suit: 'Pentacles', number: 3, orientation: 'Upright' },
      { card: 'Knight of Wands', suit: 'Wands', number: 12, orientation: 'Upright' },
      { card: 'Justice', number: 11, orientation: 'Upright' }
    ];

    const result = selectReversalFramework(1 / 5, cardsInfo, {
      userQuestion: 'What could be the outcome if I take this role?'
    });

    assert.strictEqual(result, 'contextual');
  });
});

describe('major/minor classification', () => {
  it('prefers suit-based element mapping for suited cards with numeric values', () => {
    assert.strictEqual(getCardElement('Three of Cups', 3), 'Water');
    assert.strictEqual(getCardElement('Three of Cups', 3, 'Cups'), 'Water');
    assert.strictEqual(getCardElement('The Empress', 3), 'Earth');
  });

  it('resolves deck-alias suit names before falling back to Major number mapping', () => {
    assert.strictEqual(getCardElement('Two of Disks', 2), 'Earth');
    assert.strictEqual(getCardElement('Valet of Batons', 11), 'Fire');
  });

  it('counts only true majors in spread analysis when minors include numeric values', async () => {
    const themes = await analyzeSpreadThemes(
      [
        { card: 'Three of Cups', suit: 'Cups', number: 3, orientation: 'Upright' },
        { card: 'Knight of Pentacles', suit: 'Pentacles', number: 12, orientation: 'Reversed' },
        { card: 'The Sun', number: 19, orientation: 'Upright' }
      ],
      { enableKnowledgeGraph: false }
    );

    assert.strictEqual(themes.majorCount, 1);
    assert.strictEqual(themes.majorRatio, 1 / 3);
    assert.strictEqual(themes.elementCounts.Water, 1);
    assert.strictEqual(themes.elementCounts.Earth, 1);
    assert.strictEqual(themes.elementCounts.Fire, 1);
  });

  it('accepts Major Arcana numbers from alternate cardNumber fields', async () => {
    const themes = await analyzeSpreadThemes(
      [
        { card: 'The Fool', cardNumber: 0, orientation: 'Upright' },
        { card: 'The Sun', cardNumber: '19', orientation: 'Reversed' },
        { card: 'Two of Cups', suit: 'Cups', number: 2, orientation: 'Upright' }
      ],
      { enableKnowledgeGraph: false }
    );

    assert.strictEqual(themes.majorCount, 2);
    assert.strictEqual(themes.elementCounts.Air, 1);
    assert.strictEqual(themes.elementCounts.Fire, 1);
    assert.strictEqual(themes.elementCounts.Water, 1);
  });
});

describe('relationship spread contract', () => {
  it('uses the first three cards when clarifiers are present', () => {
    const fourCardInput = [
      { card: 'Two of Cups', orientation: 'Upright', position: 'You', meaning: 'Partnership' },
      { card: 'The Lovers', orientation: 'Upright', position: 'Them', meaning: 'Values alignment' },
      { card: 'Temperance', orientation: 'Upright', position: 'Connection', meaning: 'Integration' },
      { card: 'The Star', orientation: 'Upright', position: 'Extra', meaning: 'Hope' }
    ];

    const analysis = analyzeRelationship(fourCardInput);
    assert.ok(analysis);
    assert.strictEqual(analysis.spreadKey, 'relationship');
  });

  it('includes clarifier semantics when dynamics/outcome cards are provided', () => {
    const fiveCardInput = [
      { card: 'Two of Cups', orientation: 'Upright', position: 'You / your energy', meaning: 'Partnership' },
      { card: 'The Lovers', orientation: 'Upright', position: 'Them / their energy', meaning: 'Values alignment' },
      { card: 'Temperance', orientation: 'Upright', position: 'The connection / shared lesson', meaning: 'Integration' },
      { card: 'The Star', orientation: 'Upright', position: 'Dynamics / guidance', meaning: 'Guidance' },
      { card: 'Ten of Cups', orientation: 'Upright', position: 'Outcome / what this can become', meaning: 'Outcome potential' }
    ];

    const analysis = analyzeRelationship(fiveCardInput);
    assert.ok(analysis);
    assert.ok(Array.isArray(analysis.positionNotes));
    assert.ok(analysis.positionNotes.some((note) => note.label === 'Dynamics / guidance'));
    assert.ok(analysis.positionNotes.some((note) => note.label === 'Outcome / what this can become'));
    assert.ok(Array.isArray(analysis.relationships));
    assert.ok(analysis.relationships.some((rel) => rel.type === 'guidance'));
    assert.ok(analysis.relationships.some((rel) => rel.type === 'outcome'));
  });
});

describe('case-insensitive suit detection', () => {
  it('resolves Water element for lowercase "three of cups"', () => {
    assert.strictEqual(getCardElement('three of cups', 3), 'Water');
  });

  it('resolves Fire element for mixed-case "ace of wands"', () => {
    assert.strictEqual(getCardElement('Ace of wands', 1), 'Fire');
  });

  it('still resolves standard casing', () => {
    assert.strictEqual(getCardElement('Seven of Swords', 7), 'Air');
    assert.strictEqual(getCardElement('Ten of Pentacles', 10), 'Earth');
  });
});
