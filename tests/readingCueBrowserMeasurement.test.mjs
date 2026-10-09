import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remarkCueSourcePositions } from '../src/lib/readingCueTimingProbe.js';
import { buildIndependentReadingSchedule, scoreCueBrowserReport } from '../e2e/helpers/readingCueBrowserScoring.mjs';

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
