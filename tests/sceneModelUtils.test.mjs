import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getSceneModel } from '../src/components/scenes/sceneModelUtils.js';

describe('getSceneModel', () => {
  test('returns a top-level named model when present', () => {
    const model = getSceneModel({
      revealModel: { ready: true },
      completionModel: { done: false }
    }, 'revealModel');

    assert.deepEqual(model, { ready: true });
  });

  test('falls back to nested sceneData model for compatibility', () => {
    const model = getSceneModel({
      sceneData: {
        ritualModel: { cardsRemaining: 2 }
      }
    }, 'ritualModel');

    assert.deepEqual(model, { cardsRemaining: 2 });
  });

  test('falls back to the full object when keyed model is missing', () => {
    const source = { narrativePanel: { id: 'panel' } };
    const model = getSceneModel(source, 'narrativeModel');

    assert.equal(model, source);
  });

  test('returns an empty object for non-object inputs', () => {
    assert.deepEqual(getSceneModel(null, 'revealModel'), {});
    assert.deepEqual(getSceneModel('not-an-object', 'revealModel'), {});
  });
});
