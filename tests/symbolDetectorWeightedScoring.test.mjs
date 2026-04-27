import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeSymbolVerificationScores } from '../shared/vision/symbolDetector.js';
import { getRwsCardEvidence } from '../shared/vision/rwsEvidenceOntology.js';

describe('computeSymbolVerificationScores', () => {
  it('weights high-salience detections more heavily than flat match rate', () => {
    const fool = getRwsCardEvidence('The Fool');
    const expected = ['cliff', 'dog', 'white_rose', 'feather']
      .map((symbol) => fool.visualSymbols.find((entry) => entry.symbol === symbol));
    const matches = [
      { object: 'cliff', found: true, confidence: 0.9 },
      { object: 'dog', found: true, confidence: 0.8 },
      { object: 'white rose', found: false, confidence: 0 },
      { object: 'feather', found: false, confidence: 0 }
    ];

    const scores = computeSymbolVerificationScores(expected, matches, []);

    assert.equal(scores.expectedCount, 4);
    assert.equal(scores.detectedCount, 2);
    assert.equal(scores.matchRate, 0.5);
    assert.ok(scores.weightedMatchRate > scores.matchRate);
    assert.deepEqual(scores.highSalienceMissing, []);
    assert.deepEqual(scores.lowSalienceMissing, ['white rose', 'feather']);
  });

  it('separates absence-negative detections from generic unexpected detections', () => {
    const fool = getRwsCardEvidence('The Fool');
    const expected = fool.visualSymbols.slice(0, 3);
    const scores = computeSymbolVerificationScores(expected, [], [
      { label: 'a scales', confidence: 0.81, box: { xmin: 0.1, ymin: 0.1, xmax: 0.2, ymax: 0.2 }, absenceNegative: true },
      { label: 'a table', confidence: 0.42, box: null }
    ]);

    assert.equal(scores.absentSymbolFalsePositive, true);
    assert.deepEqual(scores.absenceDetections, [
      { label: 'a scales', confidence: 0.81, box: { xmin: 0.1, ymin: 0.1, xmax: 0.2, ymax: 0.2 } }
    ]);
    assert.deepEqual(scores.unexpectedDetections, [
      { label: 'a table', confidence: 0.42, box: null }
    ]);
  });
});
