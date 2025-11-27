import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REVERSAL_FRAMEWORKS, selectReversalFramework } from '../spreadAnalysis.js';

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
});
