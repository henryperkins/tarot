import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeVisionMetricEntry } from '../scripts/evaluation/computeVisionMetrics.js';

describe('weighted vision metrics', () => {
  it('appends weighted grounding and calibration metrics', () => {
    const entry = computeVisionMetricEntry([
      {
        expected: 'The Fool',
        topMatch: { cardName: 'The Fool', score: 0.9 },
        symbolVerification: {
          weightedMatchRate: 0.8,
          highSalienceMissing: [],
          absenceDetections: [],
          absentSymbolFalsePositive: false
        }
      },
      {
        expected: 'The Fool',
        topMatch: { cardName: 'The Sun', score: 0.95 },
        symbolVerification: {
          weightedMatchRate: 0.4,
          highSalienceMissing: ['cliff'],
          absenceDetections: [{ label: 'a horse', confidence: 0.7 }],
          absentSymbolFalsePositive: true
        }
      }
    ], { deckStyle: 'rws-1909', sourceFile: 'fixture.json' });

    assert.equal(entry.sampleSize, 2);
    assert.equal(entry.weightedSymbolCoverageRate, 0.6);
    assert.equal(entry.highSalienceSymbolRecall, 0.5);
    assert.equal(entry.absentSymbolFalsePositiveRate, 0.5);
    assert.equal(entry.highConfidenceErrorRate, 0.5);
    assert.ok(entry.brierScore > 0);
    assert.ok(entry.expectedCalibrationError > 0);
  });
});
