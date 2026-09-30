import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RawImage } from '@xenova/transformers';
import { SymbolDetector, computeSymbolVerificationScores } from '../shared/vision/symbolDetector.js';

const image = () => new RawImage(new Uint8Array(12), 2, 2, 3);
const fool = { name: 'The Fool', number: 0 };

describe('symbol evidence integrity', () => {
  it('preserves counted and qualified concepts instead of querying their fragments', () => {
    const detector = new SymbolDetector();
    const labels = detector._buildCandidateLabels([
      { object: 'two swords', aliases: ['crossed swords'], absenceNegatives: ['eight swords', 'red robe'] },
      { object: 'sunflowers', absenceNegatives: ['white rose'] }
    ]);
    assert.ok(labels.candidateLabels.includes('an eight swords'));
    assert.ok(labels.candidateLabels.includes('a red robe'));
    for (const fragment of ['a sword', 'an eight', 'a red', 'a flower', 'a sunflower']) {
      assert.equal(labels.candidateLabels.includes(fragment), false, fragment);
    }
    assert.equal(labels.absenceLabels.has('a two swords'), false);
  });

  it('rejects contradictory annotations instead of silently discarding either side', () => {
    assert.throws(() => new SymbolDetector()._buildCandidateLabels([
      { object: 'sunflower', absenceNegatives: ['a sunflower'] }
    ]), /conflict/i);
  });

  it('keeps a real negative below five unused positive detections', async () => {
    const detector = new SymbolDetector();
    // Only model inference is replaced: image loading, query construction,
    // matching, scoring, and output limits all use the production path.
    detector._detectorPromise = Promise.resolve(async () => [
      ...Array.from({ length: 6 }, (_, i) => ({ label: 'a dog', score: 0.99 - i * 0.01 })),
      { label: 'a throne', score: 0.8 }
    ]);
    const result = await detector.verifySymbols(image(), fool);
    assert.equal(result.absentSymbolFalsePositive, true);
    assert.equal(result.absenceDetectionCount, 1);
    assert.equal(result.absenceDetections[0].label, 'a throne');
  });

  it('counts all high-salience misses and negatives before display limits', () => {
    const result = computeSymbolVerificationScores(
      Array.from({ length: 9 }, (_, i) => ({ object: `symbol ${i}`, salience: 0.8, absenceNegatives: ['throne'] })),
      [], Array.from({ length: 8 }, () => ({ label: 'a throne', score: 0.8, absenceNegative: true }))
    );
    assert.equal(result.highSalienceExpectedCount, 9);
    assert.equal(result.highSalienceDetectedCount, 0);
    assert.equal(result.absenceExpectedCount, 1);
    assert.equal(result.absenceDetectionCount, 8);
    assert.equal(result.absenceDetections.length, 5);
  });

  for (const deckStyle of ['thoth-a1', 'marseille-classic']) {
    it(`does not score ${deckStyle} against RWS annotations`, async () => {
      const detector = new SymbolDetector();
      detector._detectorPromise = Promise.resolve(async () => { throw new Error('Unsupported deck must not run inference'); });
      const result = await detector.verifySymbols(image(), fool, { deckStyle });
      assert.equal(result.annotationStatus, 'unsupported');
      assert.equal(result.weightedMatchRate, null);
      assert.equal(result.deckStyle, deckStyle);
    });
  }

  it('does not present generic Minor Arcana templates as visual ground truth', async () => {
    const detector = new SymbolDetector();
    detector._detectorPromise = Promise.resolve(async () => []);
    const result = await detector.verifySymbols(image(), { name: 'Two of Swords', suit: 'Swords', rank: 'Two' });
    assert.equal(result.annotationStatus, 'unsupported');
    assert.equal(result.weightedMatchRate, null);
  });

  it('marks legacy RWS spatial and symbol annotations as unverified', async () => {
    const detector = new SymbolDetector();
    detector._detectorPromise = Promise.resolve(async () => []);
    const result = await detector.verifySymbols(image(), fool);
    assert.equal(result.annotationStatus, 'unverified');
    assert.equal(result.spatialVerification, 'unverified');
  });
});
