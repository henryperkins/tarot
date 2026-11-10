import assert from 'node:assert/strict';
import test from 'node:test';
import { listKnowledgeBasePassages, MAJOR_ARCANA_PASSAGES, mergeEnrichedPassages } from '../functions/lib/knowledgeBase.js';

test('editorial matrix enumerates actual full and pair projections with pending human approvals', async () => {
  const { buildCanonProjectionReview } = await import('../scripts/evaluation/buildCanonProjectionReview.js');
  const review = buildCanonProjectionReview();
  assert.equal(listKnowledgeBasePassages().length, 145);
  assert.equal(review.counts.full, 435);
  assert.equal(review.counts.pair, 90);
  assert.equal(review.counts.enriched, 0);
  assert.equal(review.rows.length, 525);
  assert.equal(new Set(review.rows.map(row => row.projectionId)).size, 525);
  assert.ok(review.rows.every(row => row.humanStatus === 'pending' && row.fidelityStatus === 'pending' && row.absentStageStatus === 'pending'));
});

test('matrix includes active enrichment and visibly records unavailable cross-deck projections', async t => {
  const { buildCanonProjectionReview } = await import('../scripts/evaluation/buildCanonProjectionReview.js');
  const original = MAJOR_ARCANA_PASSAGES[0].passages.slice();
  t.after(() => { MAJOR_ARCANA_PASSAGES[0].passages = original; });
  mergeEnrichedPassages(MAJOR_ARCANA_PASSAGES, { 0: { passages: [{ text: 'A synthetic source interpretation for a small practical step.', context: 'transition', sourceId: 'synthetic:matrix-zero', sourceUrls: ['https://example.com/fool'] }] } });
  const review = buildCanonProjectionReview();
  assert.equal(review.counts.full, 435);
  assert.equal(review.counts.pair, 90);
  assert.equal(review.counts.enriched, 3);
  assert.equal(review.rows.filter(row => row.runtimeStatus === 'missing_or_unapproved_meaning_projection').length, 2);
});

test('review regeneration preserves exact human verdicts and invalidates stale text or agent decisions', async () => {
  const { buildCanonProjectionReview } = await import('../scripts/evaluation/buildCanonProjectionReview.js');
  const first = buildCanonProjectionReview().rows[0];
  assert.equal(typeof first.textHash, 'string');
  assert.equal(typeof first.reviewId, 'string');
  const decision = { ...first, reviewerType: 'human', humanStatus: 'approved', fidelityStatus: 'approved', absentStageStatus: 'approved', notes: 'Checked the actual supplied meaning.' };
  const regenerated = buildCanonProjectionReview({ previousReviews: [decision] }).rows[0];
  assert.equal(regenerated.humanStatus, 'approved');
  assert.equal(regenerated.notes, decision.notes);
  for (const invalid of [{ ...decision, textHash: 'stale' }, { ...decision, reviewerType: 'agent' }]) {
    assert.equal(buildCanonProjectionReview({ previousReviews: [invalid] }).rows[0].humanStatus, 'pending');
  }
});

test('pipeline editorial inventory includes canon plus actual Minor, Major pair, and court highlights', async () => {
  const { buildReadingPipelineEditorialReview } = await import('../scripts/evaluation/buildCanonProjectionReview.js');
  assert.equal(typeof buildReadingPipelineEditorialReview, 'function');
  const review = buildReadingPipelineEditorialReview();
  assert.deepEqual(review.counts, { full: 435, pair: 90, enriched: 0, directMajor: 30, directMinor: 228, directCourt: 24, referenceMinor: 228, referenceCourt: 132 });
  assert.equal(review.rows.length, 1167);
  assert.equal(new Set(review.rows.map(row => row.reviewId)).size, 1167);
  assert.ok(review.rows.every(row => row.humanStatus === 'pending'));
  for (const row of review.rows.filter(row => row.kind === 'directMinor')) assert.doesNotMatch(row.suppliedText, /You're in|The dawn is coming|daybreak coming/);
});
