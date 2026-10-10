import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remarkCueSourcePositions } from '../src/lib/readingCueTimingProbe.js';
import { buildIndependentReadingSchedule, scoreCueBrowserReport, traceCueBrowserOpportunities } from '../e2e/helpers/readingCueBrowserScoring.mjs';
import { buildIdealCueArrivalSchedule } from '../e2e/helpers/readingCueBrowserSession.mjs';
import { loadReadingCueCases } from '../scripts/evaluation/lib/readingCueQualification.mjs';

test('exact source projection preserves overlapping opportunities and rejects decoded leaves', () => {
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [
    { type: 'text', value: 'alpha beta', position: { start: { offset: 0 }, end: { offset: 10 } } },
    { type: 'text', value: '&', position: { start: { offset: 11 }, end: { offset: 16 } } }
  ] }] };
  remarkCueSourcePositions({ raw: 'alpha beta &amp;', enabled: true })(tree);
  assert.equal(tree.children[0].children[0].data.hProperties.dataCueSourceStart, '0');
  assert.equal(tree.children[0].children[0].data.hProperties.dataCueSourceEnd, '10');
  assert.equal(tree.children[0].children[1].data, undefined);
});

test('reader schedule is prose-owned at exactly 180 words per minute', () => {
  const schedule = buildIndependentReadingSchedule('one two three four five six');
  assert.equal(schedule.wordsPerMinute, 180);
  assert.equal(schedule.durationMs, 2000);
  assert.deepEqual(schedule.steps.map(s => s.atMs), [0, 1000 / 3, 2000 / 3, 1000, 4000 / 3, 5000 / 3]);
});

test('six timely receipts with balance-only exposure cannot qualify Star accompaniment', () => {
  const kinds = ['identity', 'literal', 'literal', 'interpretation', 'interpretation', 'balance'];
  const opportunities = kinds.map((kind, i) => ({ id: `o${i}`, required: true, kind,
    targets: [{ spreadIndex: 2, detailIds: i === 5 ? ['pool-pour', 'land-pour'] : [i % 2 ? 'pool-pour' : 'land-pour'] }], anchors: [{ start: i * 10, end: i * 10 + 5 }] }));
  const cues = opportunities.map((o, i) => ({ id: `c${i}`, kind: o.kind, targets: o.targets, passage: o.anchors[0] }));
  const report = { caseId: 'star-2347-excerpt', lane: 'automatic', window: { start: 0, end: 5000 },
    passageIntervals: opportunities.map(o => ({ opportunityId: o.id, start: 0, end: 5000 })),
    passageEvents: opportunities.map(o => ({ opportunityId: o.id, receivedAt: 0, renderedAt: 0 })),
    cueReceipts: cues.map(c => ({ cueId: c.id, at: 10 })), cueAdoptions: cues.map(c => ({ cueId: c.id, at: 20 })),
    detailExposures: [{ cueId: 'c5', start: 50, end: 1000, origin: 'automatic', targets: cues[5].targets, passageVisible: true }] };
  const score = scoreCueBrowserReport({ report, opportunities, cues, offline: true });
  assert.equal(score.availability.numerator, 6);
  assert.equal(score.availability.denominator, 6);
  assert.equal(score.accompaniment.passed, false);
  assert.equal(score.accompaniment.qualifiedExposures.length, 1);
  report.cueReceipts.pop();
  assert.equal(scoreCueBrowserReport({ report, opportunities, cues, offline: true }).availability.denominator, 6);
});

test('first visible interval and fixed window remain authoritative after late arrival and revisit', () => {
  const o = { id: 'pool', kind: 'literal', required: true, anchors: [{ start: 0, end: 5 }], targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] };
  const cue = { id: 'cue', kind: 'literal', passage: o.anchors[0], targets: o.targets };
  const report = { caseId: 'star-2347-excerpt', lane: 'automatic', window: { start: 0, end: 1000 },
    passageIntervals: [{ opportunityId: o.id, start: 0, end: 700 }, { opportunityId: o.id, start: 2000, end: 5000 }],
    passageEvents: [{ opportunityId: o.id, receivedAt: 0 }], cueReceipts: [{ cueId: cue.id, at: 1200 }],
    cueAdoptions: [{ cueId: cue.id, at: 1210 }], detailExposures: [{ cueId: cue.id, start: 2100, end: 4000, origin: 'automatic', targets: o.targets, passageVisible: true }] };
  const score = () => scoreCueBrowserReport({ report, opportunities: [o], cues: [cue], offline: true });
  assert.equal(score().availability.numerator, 0);
  assert.equal(score().rows[0].reason, 'late-static-revisit');
  assert.deepEqual(score().accompaniment.qualifiedExposures, []);
  report.lane = 'held';
  assert.equal(score().availability.denominator, 0);
  assert.equal(score().excludedLifecycleOpportunities, 1);
});

test('exposure requires the exact targets, adoption, automatic origin and at least 600 ms', () => {
  const o = { id: 'pool', kind: 'literal', required: true, anchors: [{ start: 0, end: 5 }], targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] };
  const cue = { id: 'cue', kind: 'literal', passage: o.anchors[0], targets: o.targets };
  const exposure = { cueId: 'cue', start: 100, end: 700, origin: 'automatic', targets: o.targets, passageVisible: true };
  const report = { caseId: 'star-2347-excerpt', lane: 'automatic', window: { start: 0, end: 1000 },
    passageIntervals: [{ opportunityId: o.id, start: 0, end: 1000 }], passageEvents: [{ opportunityId: o.id, receivedAt: 0 }],
    cueReceipts: [{ cueId: 'cue', at: 10 }], cueAdoptions: [{ cueId: 'cue', at: 20 }], detailExposures: [exposure] };
  const count = () => scoreCueBrowserReport({ report, opportunities: [o], cues: [cue], offline: true }).accompaniment.qualifiedExposures.length;
  assert.equal(count(), 1);
  exposure.end = 699; assert.equal(count(), 0);
  exposure.end = 700; exposure.origin = 'explicit'; assert.equal(count(), 0);
  exposure.origin = 'static'; assert.equal(count(), 0);
  exposure.origin = 'automatic'; exposure.passageVisible = false; assert.equal(count(), 0);
  exposure.passageVisible = true; exposure.targets = [{ spreadIndex: 2, detailIds: ['land-pour'] }]; assert.equal(count(), 0);
  exposure.targets = o.targets; report.cueAdoptions = []; assert.equal(count(), 0);
});

test('live scoring cannot silently substitute fake structural matching for independent adjudication', () => {
  assert.throws(() => scoreCueBrowserReport({ report: {}, opportunities: [] }), /adjudicated/);
});

test('source projection is inert when disabled and preserves parser-proven formatting delimiters', () => {
  const text = { type: 'text', value: 'word', position: { start: { offset: 2 }, end: { offset: 6 } } };
  const original = { type: 'root', children: [{ type: 'strong', position: { start: { offset: 0 }, end: { offset: 8 } }, children: [text] }] };
  const inert = structuredClone(original);
  remarkCueSourcePositions({ raw: '**word**', enabled: false })(inert);
  assert.deepEqual(inert, original);
  remarkCueSourcePositions({ raw: '**word**', enabled: true })(original);
  assert.equal(original.children[0].data.hProperties.dataCueSyntax, '0:2 6:8');
  const leaf = original.children[0].children[0];
  // Both overlapping anchors project through the same exact leaf, independently.
  for (const [start, end, expected] of [[2, 5, 'wor'], [3, 6, 'ord']]) {
    assert.equal(text.value.slice(start - Number(leaf.data.hProperties.dataCueSourceStart), end - 2), expected);
  }
});

function completedStarReport() {
  const kinds = ['identity', 'literal', 'literal', 'interpretation', 'interpretation', 'balance'];
  const opportunities = kinds.map((kind, i) => ({ id: `o${i}`, required: true, kind,
    targets: [{ spreadIndex: 2, detailIds: i === 0 ? [] : i === 5 ? ['pool-pour', 'land-pour'] : [i % 2 ? 'pool-pour' : 'land-pour'] }],
    anchors: [{ start: i * 10, end: i * 10 + 5 }] }));
  const cues = opportunities.map((o, i) => ({ id: `c${i}`, kind: o.kind, targets: o.targets, passage: o.anchors[0] }));
  const report = { caseId: 'star-2347-excerpt', lane: 'automatic', measurementValid: true, truncated: false,
    scheduledEndpoint: 10000, window: { start: 0, end: 10000, completed: true, endReason: 'reader-endpoint', readerEnabled: true },
    passageIntervals: opportunities.map(o => ({ opportunityId: o.id, start: 0, end: 10000 })),
    passageEvents: opportunities.map(o => ({ opportunityId: o.id, receivedAt: 0 })),
    cueReceipts: cues.map(c => ({ cueId: c.id, at: 10 })), cueAdoptions: cues.map(c => ({ cueId: c.id, at: 20 })),
    detailExposures: cues.map((c, i) => ({ cueId: c.id, start: 100 + 650 * i, end: 700 + 650 * i,
      origin: 'automatic', targets: c.targets, passageVisible: true })) };
  return { report, opportunities, cues, matches: opportunities.map((o, i) => ({ opportunityId: o.id, cueId: cues[i].id })) };
}

test('only a positively valid completed automatic window can qualify both gates', () => {
  const input = completedStarReport();
  const full = scoreCueBrowserReport(input);
  assert.equal(full.availability.passed, true);
  assert.equal(full.accompaniment.passed, true);
  input.report.window = { ...input.report.window, end: 4100, completed: false, endReason: 'scenario-end-censored' };
  const early = scoreCueBrowserReport(input);
  assert.equal(early.availability.numerator, 6);
  assert.equal(early.availability.denominator, 6);
  assert.equal(early.accompaniment.qualifiedExposures.length, 6);
  assert.equal(early.availability.passed, false);
  assert.equal(early.accompaniment.passed, false);
});

test('missing, inconsistent or invalid completion evidence fails closed without discarding diagnostics', () => {
  for (const mutate of [
    r => { delete r.window.completed; },
    r => { delete r.window.endReason; },
    r => { delete r.window.readerEnabled; },
    r => { delete r.scheduledEndpoint; },
    r => { r.window.end = 4100; },
    r => { r.window.endReason = 'scenario-end-censored'; },
    r => { r.window.readerEnabled = false; },
    r => { r.measurementValid = false; },
    r => { delete r.measurementValid; },
    r => { r.truncated = true; }
  ]) {
    const input = completedStarReport(); mutate(input.report);
    const score = scoreCueBrowserReport(input);
    assert.equal(score.availability.numerator, 6);
    assert.equal(score.availability.passed, false);
    assert.equal(score.accompaniment.passed, false);
  }
});

test('completed lifecycle, held, static and restored reports cannot qualify automatic gates', () => {
  for (const lane of ['lifecycle', 'held', 'static', 'restored']) {
    const input = completedStarReport(); input.report.lane = lane;
    const score = scoreCueBrowserReport(input);
    assert.equal(score.availability.denominator, 0);
    assert.equal(score.excludedLifecycleOpportunities, 6);
    assert.equal(score.availability.passed, false);
    assert.equal(score.accompaniment.passed, false);
  }
});

test('frozen source-active-phase schedule has a compatible Star control and a bounded five-card limitation', async () => {
  const cases = await loadReadingCueCases();
  const star = cases.find(c => c.id === 'star-2347-excerpt');
  const five = cases.find(c => c.id === 'five-card-creative-project');
  const make = c => buildIdealCueArrivalSchedule(c, { mode: 'source-active-phase', activeMs: 1800 });
  const starSchedule = make(star);
  assert.deepEqual(starSchedule.releases.map(r => r.atMs), [0, 1800, 3600, 5400, 7200, 9000]);
  assert.equal(starSchedule.expectedMaxLagMs, 7000);
  assert.ok(starSchedule.releases.every(r => r.atMs >= r.sourceAtMs && r.expectedSourceLagMs <= 10000));
  const fiveSchedule = make(five);
  assert.equal(fiveSchedule.expectedMaxLagMs, 13760);
  assert.equal(fiveSchedule.expectedP95LagMs, 13560);
  assert.equal(fiveSchedule.releases.find(r => r.expectedSourceLagMs > 10000).opportunityId, 'five-card-creative-project:pentacles-group');
  const readerAligned = buildIdealCueArrivalSchedule(star, { mode: 'reader-aligned', activeMs: 1800 });
  assert.equal(readerAligned.releases[1].atMs, 7000);
  assert.ok(readerAligned.expectedP95LagMs > 10000);
  assert.notDeepEqual(readerAligned.releases, starSchedule.releases);
});

test('opportunity traces distinguish actual consumed-without-selection, wrong geometry and short dwell', () => {
  const input = completedStarReport();
  input.report.stageAdoptions = input.cues.slice(1).map(c => ({ cueId: c.id, origin: 'automatic', at: 20 }));
  input.report.playbackStates = [{ at: 20, currentCueId: 'c1', consumedCueIds: ['c0', 'c1'],
    associations: input.cues.map(c => ({ id: c.id, passage: c.passage })), passageVisibility: { c0: true, c1: true } }];
  input.report.detailExposures.shift();
  input.report.detailExposures[0].targets = [{ spreadIndex: 2, detailIds: ['wrong'] }];
  input.report.detailExposures[1].end -= 1;
  const score = scoreCueBrowserReport(input);
  const rows = traceCueBrowserOpportunities({ ...input, score });
  assert.equal(rows[0].classification, 'selection-or-coalescing');
  assert.equal(rows[0].consumedWithoutSelection, true);
  assert.equal(rows[0].source.receivedAt, 0);
  assert.equal(rows[0].receipt.at, 10);
  assert.equal(rows[0].ledgerAdoption.at, 20);
  assert.equal(rows[1].classification, 'renderer-visibility');
  assert.equal(rows[1].selected, true);
  assert.equal(rows[1].exposures[0].exactTargets, false);
  assert.equal(rows[2].classification, 'inadequate-dwell');
  assert.equal(rows[2].exposures[0].qualifyingOverlapMs, 599);
  assert.equal(rows[3].classification, 'qualified');
});
