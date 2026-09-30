import assert from 'node:assert/strict';
import { it } from 'node:test';
import { computeVisionMetricEntry } from '../scripts/evaluation/computeVisionMetrics.js';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseCsv } from '../scripts/evaluation/lib/csv.js';

const sample = (symbols) => ({ expected: 'The Fool', image: 'fool.jpg', topMatch: { cardName: 'The Fool', score: 1 }, symbolVerification: symbols });

it('uses annotated samples for negatives and actual symbol counts for high-salience recall', () => {
  const metrics = computeVisionMetricEntry([
    sample({ matchRate: 0.8, weightedMatchRate: 0.3, absenceExpectedCount: 2, absentSymbolFalsePositive: true, highSalienceExpectedCount: 4, highSalienceDetectedCount: 1 }),
    sample({ matchRate: 1, weightedMatchRate: 0.4, absenceExpectedCount: 0, highSalienceExpectedCount: 0, highSalienceDetectedCount: 0 }),
    sample(null)
  ]);
  assert.equal(metrics.absentSymbolFalsePositiveRate, 1);
  assert.equal(metrics.absenceAnnotatedSampleCount, 1);
  assert.equal(metrics.absenceAnnotationCoverage, 1 / 3);
  assert.equal(metrics.highSalienceSymbolRecall, 0.25);
  assert.equal(metrics.symbolScoredSampleCount, 2);
  assert.equal(metrics.symbolAnnotationCoverage, 0);
});

it('leaves unmeasured negative and high-salience quality unknown', () => {
  const metrics = computeVisionMetricEntry([sample({ matchRate: 1, weightedMatchRate: 1, highSalienceMissing: [], absentSymbolFalsePositive: false })]);
  assert.equal(metrics.absentSymbolFalsePositiveRate, null);
  assert.equal(metrics.highSalienceSymbolRecall, null);
});

it('does not hide partial symbol scores or unmeasured salience in complete aggregate averages', () => {
  const metrics = computeVisionMetricEntry([
    sample({ annotationStatus: 'verified', matchRate: 1, weightedMatchRate: 0.9, highSalienceExpectedCount: 2, highSalienceDetectedCount: 2 }),
    sample({ annotationStatus: 'verified', weightedMatchRate: 0.9 })
  ]);
  assert.equal(metrics.symbolScoredSampleCount, 1);
  assert.equal(metrics.highSalienceAnnotationCoverage, 0.5);
});

it('queues weak, absent and unsupported symbols even when card recognition is correct', () => {
  const metrics = computeVisionMetricEntry([
    sample({ weightedMatchRate: 0.3, annotationStatus: 'unverified' }),
    sample({ weightedMatchRate: 0.9, absentSymbolFalsePositive: true, absenceExpectedCount: 2, annotationStatus: 'verified' }),
    sample({ weightedMatchRate: null, annotationStatus: 'unsupported' })
  ]);
  assert.equal(metrics.accuracy, 1);
  assert.equal(metrics.mismatches.length, 0);
  assert.equal(metrics.reviewQueue?.length, 3);
  assert.ok(metrics.reviewQueue[0].action.includes('weak_symbols'));
  assert.ok(metrics.reviewQueue[1].action.includes('absence_false_positive'));
  assert.ok(metrics.reviewQueue[2].action.includes('annotations'));
});

it('retains inference time and provenance when recomputing metrics', () => {
  const provenance = { datasetKind: 'reference-art', sourceRevision: 'older-commit' };
  const metrics = computeVisionMetricEntry([sample(null)], { sourceGeneratedAt: '2026-01-17T00:00:00.000Z', provenance });
  assert.equal(metrics.sourceGeneratedAt, '2026-01-17T00:00:00.000Z');
  assert.deepEqual(metrics.provenance, provenance);
  assert.equal(metrics.schemaVersion, 2);
});

it('records unlabeled inputs rather than concealing them in the denominator', () => {
  const metrics = computeVisionMetricEntry([sample(null), { image: 'unknown.jpg', topMatch: { cardName: 'The Fool', score: 1 } }]);
  assert.equal(metrics.inputSampleSize, 2);
  assert.equal(metrics.unmappedSampleCount, 1);
  assert.equal(metrics.reviewQueue?.length, 2);
});

it('writes symbol-only review rows through the CLI and preserves reviewer notes on recomputation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tableu-metrics-'));
  try {
    const input = join(directory, 'input.json');
    const metrics = join(directory, 'metrics.json');
    const review = join(directory, 'review.csv');
    writeFileSync(input, JSON.stringify({ deckStyle: 'rws-1909', generatedAt: '2026-01-17T00:00:00.000Z', provenance: { datasetKind: 'reference-art' }, results: [sample({ weightedMatchRate: 0.2, annotationStatus: 'unverified' })] }));
    writeFileSync(review, 'image,expected,predicted,human_verdict,human_notes\nfool.jpg,The Fool,The Fool,reject,Keep this note\n');
    const result = spawnSync(process.execPath, ['scripts/evaluation/computeVisionMetrics.js', '--in', input, '--metrics-out', metrics, '--review-out', review], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const csv = parseCsv(readFileSync(review, 'utf8'));
    assert.equal(csv.rows.length, 1);
    assert.match(csv.rows[0][csv.header.indexOf('action')], /weak_symbols/);
    assert.equal(csv.rows[0][csv.header.indexOf('human_notes')], 'Keep this note');
    const saved = JSON.parse(readFileSync(metrics, 'utf8')).metricsByDeck['rws-1909'];
    assert.equal(saved.sourceGeneratedAt, '2026-01-17T00:00:00.000Z');
    assert.equal(saved.accuracy, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
