import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureSummarySource, getSummaryCandidates, summarySourceMatches } from '../src/lib/journalSummarySource.js';

const entry = (id, day = 1) => ({ id, ts: Date.UTC(2026, 9, day), question: 'What can I learn?', cards: [{ name: 'The Star' }] });

test('summary candidates exclude local, missing, and duplicate IDs and sort newest first without mutating history', () => {
  const entries = [entry('older'), entry('local-draft', 9), entry(null), entry('newer', 3), entry('older')];
  assert.deepEqual(getSummaryCandidates(entries).map(({ id }) => id), ['newer', 'older']);
  assert.equal(entries[0].id, 'older');
});

test('source identity survives unrelated entries, reordering, and visual-only updates', () => {
  const first = entry('first');
  const source = captureSummarySource([first]);
  assert.equal(summarySourceMatches(source, [entry('newer', 3), { ...first, savedVisual: { status: 'ready' } }]), true);
});

test('source identity invalidates removed or edited summary inputs', () => {
  const first = entry('first');
  const source = captureSummarySource([first]);
  assert.equal(summarySourceMatches(source, []), false);
  for (const change of [
    { question: 'A different question' }, { cards: [{ name: 'The Sun' }] },
    { context: 'career' }, { themes: ['Renewal'] }, { reflections: { note: 'New insight' } },
    { personalReading: 'Updated reading' }, { ts: Date.UTC(2026, 9, 3) },
  ]) {
    assert.equal(summarySourceMatches(source, [{ ...first, ...change }]), false);
  }
});
