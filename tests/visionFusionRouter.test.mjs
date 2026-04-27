import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildVisionRouterFeatures,
  mergeVisionAnalyses,
  routeVisionDecision
} from '../shared/vision/hybridVisionPipeline.js';

describe('vision fusion router', () => {
  it('boosts calibrated confidence when CLIP and Llama agree with grounded symbols', () => {
    const features = buildVisionRouterFeatures(
      {
        topMatch: { cardName: 'The Fool', score: 0.78 },
        confidence: 0.78,
        matches: [{ cardName: 'The Fool', score: 0.78 }, { cardName: 'The Sun', score: 0.61 }],
        symbolVerification: { weightedMatchRate: 0.71 }
      },
      {
        topMatch: { cardName: 'The Fool', score: 0.74 },
        confidence: 0.74,
        analysisStatus: 'ok',
        orientation: 'upright'
      }
    );

    assert.equal(features.llamaAgrees, true);
    assert.equal(features.symbolWeightedMatch, 0.71);

    const decision = routeVisionDecision(features);
    assert.equal(decision.source, 'agreement');
    assert.equal(decision.abstain, false);
    assert.equal(decision.calibratedConfidence, 0.86);
  });

  it('chooses CLIP on grounded disagreement with a sufficient score gap', () => {
    const features = buildVisionRouterFeatures(
      {
        topMatch: { cardName: 'The Fool', score: 0.82 },
        matches: [{ cardName: 'The Fool', score: 0.82 }, { cardName: 'The Sun', score: 0.63 }],
        symbolVerification: { weightedMatchRate: 0.79 }
      },
      {
        topMatch: { cardName: 'The Sun', score: 0.8 },
        confidence: 0.8,
        analysisStatus: 'ok'
      }
    );

    const decision = routeVisionDecision(features);
    assert.equal(decision.source, 'clip');
    assert.equal(decision.needsReview, true);
    assert.equal(decision.decisionReason, 'clip_symbol_grounded_disagreement');
  });

  it('does not apply CLIP symbol proof to a different Llama-selected card', () => {
    const merged = mergeVisionAnalyses(
      {
        topMatch: { cardName: 'The Fool', score: 0.4 },
        confidence: 0.4,
        symbolVerification: {
          verifiedCard: 'The Fool',
          weightedMatchRate: 0.7,
          matches: [{ object: 'cliff', found: true }]
        }
      },
      {
        topMatch: { cardName: 'The Magician', score: 0.93 },
        confidence: 0.93,
        analysisStatus: 'ok'
      }
    );

    assert.equal(merged.topMatch.cardName, 'The Magician');
    assert.equal(merged.mergeSource, 'llama');
    assert.equal(merged.symbolVerification?.telemetryOnly, true);
    assert.equal(merged.symbolVerification?.appliesToRoutedCard, false);
  });
});
