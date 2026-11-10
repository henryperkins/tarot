import assert from 'node:assert/strict';
import test from 'node:test';
import * as editorial from '../scripts/evaluation/buildCanonProjectionReview.js';

const rows = () => editorial.buildReadingPipelineEditorialReview().rows;
function grouped(input = rows(), verdicts = []) {
  assert.equal(typeof editorial.buildGroupedEditorialReview, 'function', 'Grouped review must be implemented');
  return editorial.buildGroupedEditorialReview(input, { verdicts });
}

test('grouped editorial review covers every row once without treating variants as human assignments', () => {
  const source = rows();
  const review = grouped(source);
  assert.equal(review.groups.length, 191);
  assert.equal(review.rowCount, 1167);
  const covered = review.groups.flatMap(group => group.rowIds);
  assert.equal(covered.length, 1167);
  assert.deepEqual(new Set(covered), new Set(source.map(row => row.reviewId)));
  assert.equal(review.groups.filter(group => group.category === 'canon').length, 145);
  assert.equal(review.groups.filter(group => group.category === 'pair').length, 30);
  assert.equal(review.groups.filter(group => group.category === 'minor').length, 12);
  assert.equal(review.groups.filter(group => group.category === 'court').length, 4);
  assert.equal(review.humanApprovalRequired, false);
  assert.equal(review.mechanical.issues.length, 0);
  assert.equal(review.summary.pending, 191, 'Mechanical success cannot supply an editorial decision');
});

test('review includes retrieved Minor and court membership variants in the existing template groups', () => {
  const source = rows();
  assert.equal(source.filter(row => row.kind === 'referenceMinor').length, 228);
  assert.equal(source.filter(row => row.kind === 'referenceCourt').length, 132);
  const review = grouped(source);
  const cups = review.groups.find(group => group.id === 'court:Cups');
  assert.equal(cups.rowIds.length, 39);
  assert.ok(cups.variants.some(variant => /idealism and romantic expression/.test(variant.suppliedText)));
  const missingKnight = source.find(row => row.kind === 'referenceCourt' && row.patternId === 'Cups:court:Page-Queen-King' && row.deckStyle === 'rws-1909');
  assert.doesNotMatch(missingKnight.suppliedText, /idealism and romantic expression/);
  const bad = structuredClone(source);
  bad.find(row => row.reviewId === missingKnight.reviewId).suppliedText += ' Knight of Cups: idealism and romantic expression.';
  assert.ok(grouped(bad).mechanical.issues.some(issue => issue.code === 'absent_court_role'));
});

test('one pair review contains its direct theme and three deck projections with exact duplicates grouped', () => {
  const review = grouped();
  const pair = review.groups.find(group => group.id === 'pair:death-temperance-star:14-17');
  assert.equal(pair.rowIds.length, 4);
  assert.equal(pair.variants.length, 2);
  assert.equal(pair.variants.find(variant => variant.kind === 'pair').rowIds.length, 3);
});

test('explicit agent verdicts survive exact regeneration but never become human approval', () => {
  const source = rows();
  const first = grouped(source).groups[0];
  const verdict = { groupId: first.id, inputHash: first.inputHash, reviewerType: 'agent', status: 'accepted', notes: 'Read the native text and meaning projection; no concrete defect in this fixture.' };
  const review = grouped(source, [verdict]);
  assert.equal(review.groups[0].review.status, 'accepted');
  assert.equal(review.groups[0].review.reviewerType, 'agent');
  assert.equal(source[0].humanStatus, 'pending');
  assert.equal(grouped(source, [{ ...verdict, reviewerType: 'human' }]).groups[0].review.status, 'pending');
});

test('a changed variant, new member, or removed member invalidates the entire group verdict', () => {
  const source = rows();
  const first = grouped(source).groups[0];
  const verdict = { groupId: first.id, inputHash: first.inputHash, reviewerType: 'agent', status: 'accepted', notes: 'Reviewed all members.' };
  const changed = structuredClone(source);
  changed[1].suppliedText += ' An added claim.';
  assert.equal(grouped(changed, [verdict]).groups[0].review.status, 'pending');
  assert.equal(grouped(source.slice(1), [verdict]).groups[0].review.status, 'pending');
  const extra = { ...source[0], reviewId: 'new-member', projectionId: 'new-projection' };
  assert.equal(grouped([...source, extra], [verdict]).groups[0].review.status, 'pending');
});

test('mechanical checks reject duplicate identity and foreign-deck visual anchors', () => {
  const source = rows();
  const changed = structuredClone(source);
  changed.find(row => row.kind === 'full' && row.deckStyle !== row.sourceDeck).anchors = ['white horse'];
  const codes = grouped([...changed, changed[0]]).mechanical.issues.map(issue => issue.code);
  assert.ok(codes.includes('duplicate_review_id'));
  assert.ok(codes.includes('foreign_visual_anchor'));
  assert.ok(codes.includes('stale_row_hash'));
});

test('mechanical checks reject missing drawn roles and injected absent Minor roles', () => {
  const source = rows();
  const row = source.find(row => row.kind === 'directMinor' && row.patternId === 'Cups:challenge:4-6-7' && row.deckStyle === 'rws-1909');
  row.suppliedText = row.suppliedText.replace('Sweet memory', 'Mourning what is lost');
  const codes = grouped(source).mechanical.issues.filter(issue => issue.rowId === row.reviewId).map(issue => issue.code);
  assert.ok(codes.includes('missing_drawn_role'));
  assert.ok(codes.includes('absent_member_role'));
});

test('mechanical checks catch canonical names leaking into a selected deck and missing court aliases', () => {
  const source = rows();
  const reference = source.find(row => row.kind === 'full' && row.patternId === 'death-temperance-star' && row.deckStyle === 'thoth-a1');
  reference.suppliedText = reference.suppliedText.replace('Art', 'Temperance');
  const court = source.find(row => row.kind === 'directCourt' && row.patternId === 'Pentacles:court:2' && row.deckStyle === 'thoth-a1');
  court.suppliedText = court.suppliedText.replace('Queen of Disks', 'Queen of Pentacles');
  const issues = grouped(source).mechanical.issues;
  assert.ok(issues.some(issue => issue.rowId === reference.reviewId && issue.code === 'foreign_card_label'));
  assert.ok(issues.some(issue => issue.rowId === court.reviewId && issue.code === 'missing_court_label'));
});

test('owner exceptions require a concrete choice and cannot be manufactured from missing human metadata', () => {
  const source = rows();
  const first = grouped(source).groups[0];
  const base = { groupId: first.id, inputHash: first.inputHash, reviewerType: 'agent', status: 'owner_decision', notes: 'A genuine editorial choice.' };
  assert.equal(grouped(source, [base]).groups[0].review.status, 'pending');
  const decision = { ...base, question: 'Which of these two meanings is intended?', recommendation: 'Keep the current meaning.', alternatives: ['Keep the current meaning.', 'Adopt the alternate meaning.'] };
  assert.equal(grouped(source, [decision]).summary.ownerDecisions, 1);
  assert.equal(grouped(source).summary.ownerDecisions, 0);
});
