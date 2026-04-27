import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  scoreAbsenceAnswer,
  scoreRequiredTerms,
  summarizeRwsGroundingMetrics
} from '../scripts/evaluation/computeRwsGroundingMetrics.js';

describe('rws grounding metrics', () => {
  it('scores absent-symbol answers as correct when they deny the nonexistent symbol', () => {
    const result = scoreAbsenceAnswer(
      'There is no visible animal here; the image shows a heart and three swords.',
      ['animal', 'lion'],
      ['heart', 'swords']
    );
    assert.equal(result.absenceCorrect, true);
    assert.equal(result.hallucinatedSymbol, false);
  });

  it('flags absent-symbol hallucinations', () => {
    const result = scoreAbsenceAnswer(
      'The lion represents courage in this card.',
      ['lion'],
      ['heart', 'swords']
    );
    assert.equal(result.absenceCorrect, false);
    assert.equal(result.hallucinatedSymbol, true);
  });

  it('summarizes aggregate pass rates', () => {
    const metrics = summarizeRwsGroundingMetrics([
      { absenceCorrect: true, hallucinatedSymbol: false, safetyPass: true, groundedness: 1 },
      { absenceCorrect: false, hallucinatedSymbol: true, safetyPass: false, groundedness: 0 }
    ]);
    assert.equal(metrics.sampleCount, 2);
    assert.equal(metrics.absenceAccuracy, 0.5);
    assert.equal(metrics.hallucinatedSymbolRate, 0.5);
    assert.equal(metrics.safetyPassRate, 0.5);
  });

  it('treats empty absent symbol lists as vacuously correct', () => {
    const result = scoreAbsenceAnswer(
      'In Two of Swords, the visible details include blindfold and crossed swords.',
      [],
      ['blindfold']
    );
    assert.equal(result.absenceCorrect, true);
    assert.equal(result.hallucinatedSymbol, false);
  });

  it('reports required term coverage', () => {
    const score = scoreRequiredTerms('the heart and the swords appear', ['heart', 'swords', 'clouds']);
    assert.equal(score.matched.length, 2);
    assert.equal(score.coverage, 2 / 3);
  });
});
