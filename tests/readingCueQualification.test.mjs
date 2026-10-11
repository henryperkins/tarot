import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  loadReadingCueCases, scoreReadingCueRun, validateReadingCueCases,
  rankReadingCueCandidates, wilsonInterval
} from '../scripts/evaluation/lib/readingCueQualification.mjs';

import { createReadingCueTestManifest } from './helpers/readingCueQualificationFixtures.mjs';

const testManifest = await createReadingCueTestManifest();
const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json');
const sha = raw => createHash('sha256').update(raw, 'utf8').digest('hex');
const reviewer = { id: 'independent-reviewer', authoredVisualPrompt: false, testedModel: false, blinded: true };
const clone = value => structuredClone(value);
const starCase = async () => {
  const manifest = structuredClone(testManifest);
  delete manifest.manifestSha256;
  manifest.cases = manifest.cases.filter(c => c.id === 'star-2347-excerpt');
  return (await loadReadingCueCases({ root, manifest }))[0];
};
function cue(c, o, id = o.id) {
  return { id, kind: o.kind, passage: clone(o.anchors[0]), targets: o.targets.map(t => ({ ...clone(t),
    canonicalName: c.cards.find(card => card.spreadIndex === t.spreadIndex).canonicalName })),
  establishedBy: [...o.establishedByOpportunityIds], ...(o.personalContext ? { personalContext: clone(o.personalContext) } : {}) };
}
function review(c, q, changes = {}) {
  return { caseId: c.id, cueId: q.id, verdict: 'supported', spanAdequate: true, contextSupported: true,
    targetVerdicts: q.targets.flatMap(t => (t.detailIds.length ? t.detailIds : [null]).map(detailId =>
      ({ spreadIndex: t.spreadIndex, detailId, verdict: 'supported' }))), rationale: 'Independent exact source review.', ...changes };
}
function score(cases, cues, reviews = cues.map((q, i) => review(cases[i] || cases[0], q))) {
  return scoreReadingCueRun({ cases, ledgers: cases.map(c => ({ caseId: c.id, raw: c.raw,
    cues: cues.filter(q => !q.caseId || q.caseId === c.id), receipts: [] })), adjudications: { reviewer, cues: reviews } });
}
async function perfectRun() {
  const cases = await loadReadingCueCases({ root, manifest: testManifest });
  const ledgers = cases.map(c => ({ caseId: c.id, raw: c.raw, cues: c.opportunities.map(o => cue(c, o)) }));
  const adjudications = { reviewer, cues: ledgers.flatMap(l => l.cues.map(q =>
    review(cases.find(c => c.id === l.caseId), q))) };
  return { cases, ledgers, adjudications };
}
function addIncorrectExtra(run, { wrongCard = false, errorCategory, caseId = 'star-2347-excerpt' } = {}) {
  const c = run.cases.find(c => c.id === caseId);
  const q = cue(c, c.opportunities.find(o => o.id.endsWith(':pool')), 'incorrect-extra');
  q.passage.start--; q.passage.quote = c.raw.slice(q.passage.start, q.passage.end);
  q.targets = wrongCard ? [{ spreadIndex: 1, canonicalName: 'The Tower', detailIds: ['lightning'] }]
    : [{ spreadIndex: 2, canonicalName: 'The Star', detailIds: ['land-pour'] }];
  run.ledgers.find(l => l.caseId === c.id).cues.push(q);
  const target = { spreadIndex: wrongCard ? 1 : 2, detailId: wrongCard ? 'lightning' : 'land-pour', verdict: 'incorrect' };
  if (errorCategory !== undefined) target.errorCategory = errorCategory;
  run.adjudications.cues.push(review(c, q, { verdict: 'incorrect', targetVerdicts: [target] }));
  return q;
}

test('loads exact frozen source without duplicating prose in the manifest', async () => {
  const cases = await loadReadingCueCases({ root, manifest: testManifest });
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(cases.length, 62);
  assert.equal(cases.flatMap(c => c.opportunities).length, 284);
  assert.equal(cases.flatMap(c => c.opportunities).filter(o => o.required).length, 238);
  assert.equal(cases.find(c => c.id === 'star-2347-excerpt').rawSha256,
    '1b3ec02d1af7a4ed04c522ae44c512152e38a5524e51187542064ffb4e683265');
  assert.ok(manifest.cases.every(c => !Object.hasOwn(c, 'raw')));
  assert.equal(cases.filter(c => c.regressionPolarity === 'negative').length, 22);
  assert.equal(cases.find(c => c.id === 'non-english-spanish').cards[2].reversed, true);
});

test('loader rejects changed source bytes before interpreting fields', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'reading-cue-source-'));
  try {
    const m = JSON.parse(await readFile(manifestPath, 'utf8'));
    m.sourceDigests = [{ path: 'changed.json', sha256: sha('{"raw":"old"}') }];
    m.cases = [{ ...m.cases[0], provenance: { sourcePath: 'changed.json', sourceFieldPath: 'raw',
      sourceFileSha256: sha('{"raw":"old"}') } }];
    delete m.manifestSha256;
    await writeFile(resolve(dir, 'changed.json'), '{"raw":"new"}');
    await assert.rejects(loadReadingCueCases({ root: dir, manifest: m }), /source.*hash/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('rejects an excerpt parent hash substituted for its exact text hash', async () => {
  const c = await starCase();
  c.rawSha256 = c.provenance.sourceReadingSha256;
  assert.throws(() => validateReadingCueCases([c]), /raw.*hash/i);
});

test('keeps families in one partition and variants out of independent reading counts', async () => {
  const c = await starCase();
  const variant = { ...clone(c), id: 'variant', independentReading: false, contextVariant: 'question-only',
    reflections: null, opportunities: [] };
  validateReadingCueCases([c, variant]);
  assert.equal(score([c, variant], []).counts.sourceFamilies, 1);
  assert.equal(score([c, variant], []).counts.independentReadings, 0);
  variant.partition = 'reserved-regression';
  assert.throws(() => validateReadingCueCases([c, variant]), /family.*partition/i);
});

test('anchors use exact UTF-16 ranges for accents, emoji, and repeated quotations', async () => {
  const c = await starCase();
  c.raw = 'é🙂 pool é🙂 pool'; c.rawSha256 = sha(c.raw);
  c.opportunities = [{ ...c.opportunities[1], anchors: [{ start: 13, end: 17, quote: 'pool' }] }];
  validateReadingCueCases([c]);
  const q = cue(c, c.opportunities[0]);
  assert.equal(score([c], [q]).counts.matchedRequiredOpportunities, 1);
  q.passage = { start: 4, end: 8, quote: 'pool' };
  assert.equal(score([c], [q]).counts.matchedRequiredOpportunities, 0);
  c.opportunities[0].anchors[0].start = 12;
  assert.throws(() => validateReadingCueCases([c]), /anchor/i);
});

test('one merged Star cue cannot recover the two separate literal pours', async () => {
  const c = await starCase();
  const q = cue(c, c.opportunities[1]);
  q.targets[0].detailIds.push('land-pour');
  q.passage = { start: 117, end: 168, quote: c.raw.slice(117, 168) };
  const r = score([c], [q]);
  assert.equal(r.counts.matchedRequiredOpportunities, 0);
  assert.equal(r.counts.extras, 1);
  assert.equal(r.counts.requiredOpportunities, 6);
});

test('duplicate cue IDs across reconnect batches count once and conflicts fail integrity', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  const r = scoreReadingCueRun({ cases: [c], ledgers: [{ caseId: c.id, raw: c.raw, cues: [q, clone(q)], receipts: [] }],
    adjudications: { reviewer, cues: [review(c, q)] } });
  assert.equal(r.counts.acceptedCues, 1);
  assert.equal(r.counts.matchedRequiredOpportunities, 1);
  const changed = clone(q); changed.targets[0].detailIds = ['land-pour'];
  assert.ok(score([c], [q, changed], [review(c, q)]).hardFailures.some(f => f.code === 'duplicate-cue-conflict'));
});

test('valid but wrong-card target counts incorrect and fails integrity', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  q.targets[0] = { spreadIndex: 1, canonicalName: 'The Tower', detailIds: ['lightning'] };
  const r = score([c], [q], [review(c, q, { verdict: 'incorrect', targetVerdicts: [
    { spreadIndex: 1, detailId: 'lightning', verdict: 'incorrect', errorCategory: 'wrong-card' }] })]);
  assert.equal(r.counts.cuePrecision.numerator, 0);
  assert.equal(r.counts.targetPrecision.denominator, 1);
  assert.ok(r.hardFailures.some(f => f.code === 'wrong-card'));
});

test('semantically empty matched quote does not earn recall', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[2]);
  q.passage = { start: 145, end: 148, quote: 'the' };
  const r = score([c], [q], [review(c, q, { spanAdequate: false })]);
  assert.equal(r.counts.matchedRequiredOpportunities, 0);
  assert.equal(r.counts.cuePrecision.numerator, 0);
});

test('unsupported or fabricated reflection fails even when reviewer says supported', async () => {
  const c = (await loadReadingCueCases({ root, manifest: testManifest })).find(c => c.id === 'star-2347-excerpt-question-only');
  const q = cue(c, c.opportunities[3]);
  q.personalContext = { type: 'querent-reflection', quote: 'nostalgic' };
  const r = score([c], [q]);
  assert.ok(r.hardFailures.some(f => f.code === 'fabricated-context'));
  assert.equal(r.counts.matchedRequiredOpportunities, 0);
});

test('interpretation requires resolved earlier literals and exact frozen context agreement', async () => {
  const c = await starCase(); const literal = cue(c, c.opportunities[1]);
  const interpretation = cue(c, c.opportunities[3]);
  assert.equal(score([c], [literal, interpretation], [review(c, literal), review(c, interpretation)]).counts.matchedRequiredOpportunities, 2);
  interpretation.establishedBy = [];
  assert.equal(score([c], [literal, interpretation], [review(c, literal), review(c, interpretation)]).counts.matchedRequiredOpportunities, 1);
  interpretation.establishedBy = [literal.id]; interpretation.personalContext.quote = 'reinvention';
  assert.equal(score([c], [literal, interpretation], [review(c, literal), review(c, interpretation)]).counts.matchedRequiredOpportunities, 1);
});

test('unreviewed extras and uncertain target reviews make precision incomplete', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  const extra = { ...clone(q), id: 'extra', passage: { start: 109, end: 168, quote: c.raw.slice(109, 168) } };
  const r = score([c], [q, extra], [review(c, q)]);
  assert.equal(r.incomplete, true); assert.equal(r.semanticPassed, false);
  assert.equal(r.counts.cuePrecision.denominator, 2);
  assert.equal(score([c], [q], [review(c, q, { targetVerdicts: [] })]).incomplete, true);
  assert.equal(score([c], [q], [review(c, q, { verdict: 'uncertain' })]).incomplete, true);
});

test('unknown categories and incomplete selected-detail labels cannot qualify', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]); q.kind = 'gesture';
  assert.equal(score([c], [q]).incomplete, true);
  q.kind = 'literal'; c.reviewComplete = false;
  assert.equal(score([c], [q]).incomplete, true);
});

test('self-review or non-blinded review cannot certify semantic quality', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  const r = scoreReadingCueRun({ cases: [c], ledgers: [{ caseId: c.id, raw: c.raw, cues: [q] }],
    adjudications: { reviewer: { ...reviewer, testedModel: true }, cues: [review(c, q)] } });
  assert.equal(r.incomplete, true); assert.equal(r.semanticPassed, false);
});

test('Thoth and Marseille stay identity-only and RWS details fail integrity', async () => {
  const cases = (await loadReadingCueCases({ root, manifest: testManifest })).filter(c => ['spiritual-thoth-ritual', 'wellbeing-marseille-reset'].includes(c.id));
  for (const c of cases) {
    assert.equal(c.artworkEdition, null);
    const q = cue(c, c.opportunities[0]);
    assert.equal(score([c], [q]).byKind.literal.requiredRecall.denominator, 0);
    q.targets[0].detailIds = ['pool-pour'];
    assert.ok(score([c], [q]).hardFailures.some(f => f.code === 'non-rws-detail-leakage'));
  }
});

test('maximum matching chooses distinct opportunities rather than greedy first matches', async () => {
  const c = await starCase(); const a = clone(c.opportunities[1]); const b = clone(a);
  a.id = 'a'; b.id = 'b'; a.anchors.push(clone(c.opportunities[2].anchors[0])); c.opportunities = [a, b];
  const q1 = cue(c, a, 'q1'); const q2 = cue(c, a, 'q2'); q2.passage = clone(a.anchors[1]);
  const r = score([c], [q1, q2], [review(c, q1), review(c, q2)]);
  assert.equal(r.counts.matchedRequiredOpportunities, 2);
  assert.deepEqual(r.matches.map(m => [m.opportunityId, m.cueId]), [['a', 'q2'], ['b', 'q1']]);
  c.opportunities = [a, b];
  assert.equal(score([c], [q1]).counts.matchedRequiredOpportunities, 1);
});

test('all frozen cases scored with independently supported exact cues pass semantic gates', async () => {
  const cases = await loadReadingCueCases({ root, manifest: testManifest });
  const ledgers = cases.map(c => ({ caseId: c.id, raw: c.raw, cues: c.opportunities.map(o => cue(c, o)), receipts: [] }));
  const adjudications = { reviewer, cues: ledgers.flatMap(l => l.cues.map(q => review(cases.find(c => c.id === l.caseId), q))) };
  const r = scoreReadingCueRun({ cases, ledgers, adjudications });
  assert.equal(r.incomplete, false); assert.equal(r.hardFailures.length, 0);
  assert.equal(r.counts.matchedRequiredOpportunities, 238);
  assert.equal(r.semanticPassed, true);
  assert.equal(r.byLanguage.es.requiredRecall.value, 1);
  assert.equal(r.spanishSupport, 'detail-qualified');
  assert.equal(r.counts.independentReadings, 11);
  assert.equal(r.counts.completeRecordedReadings, 11);
  assert.equal(r.counts.primaryCases, 12);
  ledgers[0].raw += ' mutation';
  assert.ok(scoreReadingCueRun({ cases, ledgers, adjudications }).hardFailures.some(f => f.code === 'prose-mutation'));
});

test('negative traps permit identity cues but reject invented literals', async () => {
  const c = (await loadReadingCueCases({ root, manifest: testManifest })).find(c => c.id === 'star-reader-idiom');
  const q = cue(c, c.opportunities[0]);
  assert.equal(score([c], [q]).hardFailures.length, 0);
  q.kind = 'literal'; q.targets[0].detailIds = ['pool-pour'];
  assert.ok(score([c], [q]).hardFailures.some(f => f.code === 'negative-trap'));
});

test('rejected proposals count structural failures without inflating semantic precision', async () => {
  const c = await starCase();
  const r = scoreReadingCueRun({ cases: [c], ledgers: [{ caseId: c.id, raw: c.raw, cues: [],
    receipts: [{ batchId: 'b', rejected: [{ code: 'invalid-association' }] }] }], adjudications: { reviewer, cues: [] } });
  assert.equal(r.counts.structuralFailures, 1);
  assert.equal(r.counts.cuePrecision.denominator, 0);
  assert.equal(r.counts.cuePrecision.value, null);
});

test('Wilson intervals preserve empty denominators and hand-calculated bounds', () => {
  assert.equal(wilsonInterval(0, 0), null);
  const interval = wilsonInterval(5, 10);
  assert.ok(Math.abs(interval.lower - 0.236593) < 0.00001);
  assert.ok(Math.abs(interval.upper - 0.763407) < 0.00001);
});

test('two independent repeats keep their recall denominators and reviews separate', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  const r = scoreReadingCueRun({ cases: [c], ledgers: [
    { caseId: c.id, trialId: 'first', raw: c.raw, cues: [q] },
    { caseId: c.id, trialId: 'second', raw: c.raw, cues: [] }
  ], adjudications: { reviewer, cues: [{ ...review(c, q), trialId: 'first' }] } });
  assert.equal(r.counts.requiredOpportunities, 12);
  assert.equal(r.counts.matchedRequiredOpportunities, 1);
  assert.equal(r.counts.independentReadings, 0);
  assert.equal(r.counts.sourceFamilies, 1);
  assert.equal(r.byTrial.first.counts.requiredRecall.numerator, 1);
  assert.equal(r.byTrial.second.counts.requiredRecall.numerator, 0);
  assert.deepEqual(r.variability.requiredRecall.values, [1 / 6, 0]);
  assert.equal(r.incomplete, false);
});

test('mutable reviewed documents retain provenance while runtime catalog and manifest changes fail', async () => {
  const m = structuredClone(testManifest);
  delete m.manifestSha256;
  const doc = m.sourceDigests.find(s => s.path.startsWith('docs/'));
  doc.sha256 = '0'.repeat(64);
  assert.equal((await loadReadingCueCases({ root, manifest: m })).length, 62);
  m.sourceDigests.find(s => s.path === 'src/data/cardGestureArtwork.js').sha256 = '0'.repeat(64);
  await assert.rejects(loadReadingCueCases({ root, manifest: m }), /source.*hash/i);
  const changed = JSON.parse(await readFile(manifestPath, 'utf8'));
  changed.cases[0].question = 'changed input';
  await assert.rejects(loadReadingCueCases({ root, manifest: changed }), /manifest.*hash/i);
});

test('a catalog-valid wrong detail affects precision without being a geometry integrity failure', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  q.targets[0].detailIds = ['land-pour'];
  const r = score([c], [q], [review(c, q, { verdict: 'incorrect', targetVerdicts: [
    { spreadIndex: 2, detailId: 'land-pour', verdict: 'incorrect', errorCategory: 'wrong-detail' }
  ] })]);
  assert.equal(r.hardFailures.length, 0);
  assert.equal(r.incomplete, false);
  assert.equal(r.counts.targetPrecision.numerator, 0);
  assert.ok(r.semanticFailures.some(f => f.code === 'incorrect-target'));
});

test('each emitted target contributes its own review even if its cue is inadequate', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[5]);
  const r = score([c], [q], [review(c, q, { spanAdequate: false, targetVerdicts: [
    { spreadIndex: 2, detailId: 'pool-pour', verdict: 'supported' },
    { spreadIndex: 2, detailId: 'land-pour', verdict: 'incorrect', errorCategory: 'wrong-detail' }
  ] })]);
  assert.equal(r.counts.cuePrecision.numerator, 0);
  assert.equal(r.counts.targetPrecision.numerator, 1);
  assert.equal(r.counts.targetPrecision.denominator, 2);
});

test('identity establishedBy labels are rejected because runtime accepts only literal dependencies', async () => {
  const c = await starCase();
  c.opportunities[5].establishedByOpportunityIds = [c.opportunities[0].id];
  assert.throws(() => validateReadingCueCases([c]), /earlier literal dependency/i);
});

test('absence of optional context is neither fabrication nor unsupported cue content', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  const r = score([c], [q], [review(c, q, { contextSupported: false })]);
  assert.equal(r.counts.matchedRequiredOpportunities, 1);
  assert.equal(r.counts.cuePrecision.numerator, 1);
  assert.equal(r.hardFailures.length, 0);
});

test('catalog-valid wrong occurrence cannot bypass source ownership with a supported review', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  q.targets = [{ spreadIndex: 1, canonicalName: 'The Tower', detailIds: ['lightning'] }];
  assert.ok(score([c], [q]).hardFailures.some(f => f.code === 'wrong-card'));
});

test('missing target/span/context review data remains incomplete', async () => {
  const c = await starCase(); const q = cue(c, c.opportunities[1]);
  for (const key of ['targetVerdicts', 'spanAdequate', 'contextSupported']) {
    const a = review(c, q); delete a[key];
    assert.equal(score([c], [q], [a]).incomplete, true);
  }
});

test('explicit mixed trial plan repeats only 12 primary cases and preserves 74 evaluations', async () => {
  const cases = await loadReadingCueCases({ root, manifest: testManifest });
  const primary = cases.filter(c => ['recorded-reading', 'recorded-excerpt'].includes(c.provenance.sourceKind));
  const expectedTrials = [{ trialId: 'first', caseIds: cases.map(c => c.id) },
    { trialId: 'second', caseIds: primary.map(c => c.id) }];
  const ledgers = expectedTrials.flatMap(trial => trial.caseIds.map(caseId => {
    const c = cases.find(c => c.id === caseId);
    return { caseId, trialId: trial.trialId, raw: c.raw, cues: c.opportunities.map(o => cue(c, o)) };
  }));
  const adjudications = { reviewer, cues: ledgers.flatMap(l => l.cues.map(q =>
    ({ ...review(cases.find(c => c.id === l.caseId), q), trialId: l.trialId }))) };
  const result = scoreReadingCueRun({ cases, ledgers, adjudications, expectedTrials });
  assert.equal(result.counts.caseEvaluations, 74);
  assert.equal(result.counts.requiredOpportunities, 396);
  assert.equal(result.counts.matchedRequiredOpportunities, 396);
  assert.equal(result.counts.completeRecordedReadings, 11);
  assert.equal(result.incomplete, false);
  assert.equal(result.semanticPassed, true);
  assert.equal(result.byTrial.second.byCase['star-reader-idiom'], undefined);
  ledgers.splice(ledgers.findIndex(l => l.trialId === 'second' && l.caseId === 'single-new-role'), 1);
  const missing = scoreReadingCueRun({ cases, ledgers, adjudications, expectedTrials });
  assert.equal(missing.incomplete, true);
  assert.equal(missing.counts.requiredOpportunities, 396);
  assert.equal(missing.semanticPassed, false);
});

test('empty question-only variants cannot qualify through pooled recall', async () => {
  const run = await perfectRun();
  for (const c of run.cases.filter(c => c.contextVariant === 'question-only')) run.ledgers.find(l => l.caseId === c.id).cues = [];
  const result = scoreReadingCueRun(run);
  assert.equal(result.counts.requiredRecall.numerator, 207);
  assert.equal(result.gates.overall.passed, true);
  assert.equal(result.incomplete, false);
  assert.equal(result.gates.context.passed, false);
  assert.equal(result.semanticPassed, false);
  assert.deepEqual(result.gates.context.variants.map(v => [v.counts.requiredRecall.numerator, v.counts.requiredRecall.denominator]), [[0, 6], [0, 25]]);
});

test('each question-only variant must meet precision despite otherwise passing metrics', async () => {
  const run = await perfectRun();
  addIncorrectExtra(run, { caseId: 'star-2347-excerpt-question-only', errorCategory: 'wrong-detail' });
  const result = scoreReadingCueRun(run);
  assert.equal(result.gates.overall.passed, true);
  assert.equal(result.hardFailures.length, 0);
  assert.equal(result.gates.context.passed, false);
  assert.equal(result.semanticPassed, false);
});

test('explicit wrong-card adjudication catches extras beyond approved anchor boundaries', async () => {
  const run = await perfectRun();
  const extra = addIncorrectExtra(run, { wrongCard: true, errorCategory: 'wrong-card' });
  assert.equal(extra.passage.quote, ' one pitcher into a pool');
  const result = scoreReadingCueRun(run);
  assert.equal(result.gates.overall.passed, true);
  assert.equal(result.incomplete, false);
  assert.ok(result.hardFailures.some(f => f.code === 'wrong-card' && f.cueId === extra.id));
  assert.equal(result.semanticPassed, false);
});

test('classified registered wrong-detail extras remain ordinary precision errors below five percent', async () => {
  const run = await perfectRun();
  addIncorrectExtra(run, { errorCategory: 'wrong-detail' });
  const result = scoreReadingCueRun(run);
  assert.equal(result.hardFailures.length, 0);
  assert.equal(result.incomplete, false);
  assert.equal(result.semanticPassed, true);
  assert.equal(result.counts.cuePrecision.numerator, 284);
  assert.equal(result.counts.cuePrecision.denominator, 285);
});

test('missing and unknown incorrect-target classifications cannot certify precision', async () => {
  for (const errorCategory of [undefined, 'unrecognized']) {
    const run = await perfectRun();
    addIncorrectExtra(run, { errorCategory });
    const result = scoreReadingCueRun(run);
    assert.equal(result.incomplete, true);
    assert.equal(result.semanticPassed, false);
    assert.ok(result.incompleteReasons.some(reason => reason.includes('target error classification')));
  }
});

test('question-only gates apply separately to each planned repeat trial', async () => {
  const run = await perfectRun();
  const variants = run.cases.filter(c => c.contextVariant === 'question-only');
  const expectedTrials = [{ trialId: 'first', caseIds: run.cases.map(c => c.id) },
    { trialId: 'second', caseIds: variants.map(c => c.id) }];
  for (const l of run.ledgers) l.trialId = 'first';
  for (const a of run.adjudications.cues) a.trialId = 'first';
  run.ledgers.push(...variants.map(c => ({ caseId: c.id, trialId: 'second', raw: c.raw, cues: [] })));
  const result = scoreReadingCueRun({ ...run, expectedTrials });
  assert.equal(result.gates.overall.passed, true);
  assert.equal(result.incomplete, false);
  assert.equal(result.gates.context.passed, false);
  assert.equal(result.semanticPassed, false);
  assert.deepEqual(result.gates.context.variants.map(v => [v.trialId, v.passed]),
    [['first', true], ['first', true], ['second', false], ['second', false]]);
});

test('candidate ranking excludes unqualified runs then follows every declared tie-break', () => {
  const candidate = (id, recall, cuePrecision, targetPrecision, lag, cost, fullyQualified = true) => ({ id, fullyQualified,
    score: { counts: { requiredRecall: { value: recall }, cuePrecision: { value: cuePrecision }, targetPrecision: { value: targetPrecision } } },
    receiptLagP95Ms: lag, estimatedCost: cost });
  const rows = [candidate('baseline', .8, .95, .95, 5000, 2), candidate('recall', .9, .95, .95, 9000, 3),
    candidate('cue', .8, .99, .95, 5000, 2), candidate('target', .8, .95, .99, 5000, 2),
    candidate('lag', .8, .95, .95, 4000, 2), candidate('cost', .8, .95, .95, 5000, 1),
    candidate('tie', .8, .95, .95, 5000, 2), candidate('failed', 1, 1, 1, 1, 0, false)];
  assert.deepEqual(rankReadingCueCandidates(rows, rows.map(c => c.id)).map(c => c.id),
    ['recall', 'cue', 'target', 'lag', 'cost', 'baseline', 'tie']);
  const unknown = candidate('unknown-cost', 1, 1, 1, 1, null);
  assert.deepEqual(rankReadingCueCandidates([unknown]), []);
  const unknownOrder = candidate('undeclared', 1, 1, 1, 1, 0);
  assert.deepEqual(rankReadingCueCandidates([unknownOrder], ['baseline']), []);
});
