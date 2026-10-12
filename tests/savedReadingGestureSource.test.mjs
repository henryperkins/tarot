import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcileSavedGestureSource } from '../src/lib/savedReadingGestureSource.js';

const entry = { id: 'saved-one', personalReading: 'The Star pours into the pool.',
  question: '  What remains? 🪷\n', reflections: { 0: 'my note' }, deckId: 'rws-1909',
  cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }] };
const binding = { readingResultId: 'trusted-result', sourceRevision: 0, spreadHash: 'a'.repeat(64),
  contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
const snapshot = { version: 1, binding, ledgerRevision: 1, raw: entry.personalReading,
  analyzedEnd: entry.personalReading.length, cues: [], introductions: [] };
const restored = { readingResultId: binding.readingResultId, binding, snapshot, status: 'complete' };
const reconcile = (overrides = {}) => reconcileSavedGestureSource({ entry, fallbackRunId: 'local-saved-one', ...overrides });

test('unannotated saved reading has local completed source', () => {
  const source = reconcile();
  assert.equal(source.runId, 'local-saved-one');
  assert.equal(source.raw, entry.personalReading);
  assert.equal(source.sourceRevision, 0);
  assert.equal(source.kind, 'hydrate');
  assert.equal(source.status, 'complete');
  for (const key of ['readingResultId', 'visualBinding', 'visualJobToken', 'cueLedger']) assert.equal(source[key], undefined);
});

test('unchanged entry preserves source identity', () => {
  const source = reconcile();
  assert.equal(reconcile({ previous: source, entry: structuredClone(entry) }), source);
});

test('replaced saved prose invalidates held ranges including appended saved text', () => {
  for (const raw of ['The Hermit raises his lantern.', `${entry.personalReading} A new ending.`]) {
    const source = reconcile();
    const changed = reconcile({ previous: source, entry: { ...entry, personalReading: raw } });
    assert.equal(changed.runId, source.runId);
    assert.equal(changed.sourceRevision, 1);
    assert.equal(changed.raw, raw);
    assert.equal(changed.kind, 'hydrate');
  }
});

test('cached foreign binding never replaces local prose', () => {
  const source = reconcile({ restored: { ...restored, snapshot: { ...snapshot, raw: 'Foreign source' } } });
  assert.equal(source.raw, entry.personalReading);
  assert.equal(source.visualBinding, undefined);
  assert.equal(source.cueLedger, undefined);
  assert.equal(source.runId, 'local-saved-one');
  const mismatched = reconcile({ restored: { ...restored, readingResultId: 'other-result' } });
  assert.equal(mismatched.visualBinding, undefined);
});

test('validated cached snapshot stays static and strips transport fields', () => {
  const source = reconcile({ restored: { ...restored, visualJobToken: 'private-token' } });
  assert.equal(source.runId, binding.readingResultId);
  assert.equal(source.visualBinding, binding);
  assert.equal(source.cueLedger, snapshot);
  assert.equal(source.kind, 'hydrate');
  assert.equal(source.visualJobToken, undefined);
  assert.equal(reconcile({ previous: source, restored }), source);
});

test('changing saved prose retires an old cached prefix and delayed reattachment', () => {
  const original = reconcile({ restored });
  const changedEntry = { ...entry, personalReading: `${entry.personalReading} Different ending.` };
  const changed = reconcile({ previous: original, entry: changedEntry, restored });
  assert.equal(changed.visualBinding, undefined);
  assert.equal(changed.cueLedger, undefined);
  assert.equal(changed.sourceRevision, 1);
  const again = reconcile({ previous: changed, entry: changedEntry, restored });
  assert.equal(again, changed);
  assert.equal(again.cueLedger, undefined);
});

test('entry account card occurrence and context changes clear saved inspection identity', () => {
  const source = reconcile();
  for (const update of [
    { question: 'new question' }, { reflections: { 0: 'changed note' } },
    { cards: [{ ...entry.cards[0], position: 'Future' }] }, { deckId: 'thoth-a1' }
  ]) assert.equal(reconcile({ previous: source, entry: { ...entry, ...update } }).sourceRevision, 1);
  const switched = reconcile({ previous: source, fallbackRunId: 'other-account-entry' });
  assert.equal(switched.runId, 'other-account-entry');
  assert.equal(switched.sourceRevision, 0);
});

test('source revision changes allow a new independently validated cached binding', () => {
  const original = reconcile({ restored });
  const changedEntry = { ...entry, personalReading: 'A replacement reading.' };
  const changed = reconcile({ previous: original, entry: changedEntry, restored });
  const nextBinding = { ...binding, sourceRevision: 1 };
  const next = reconcile({ previous: changed, entry: changedEntry,
    restored: { ...restored, binding: nextBinding, snapshot: { ...snapshot, binding: nextBinding,
      raw: changedEntry.personalReading, analyzedEnd: changedEntry.personalReading.length } } });
  assert.equal(next.visualBinding, nextBinding);
  assert.equal(next.raw, changedEntry.personalReading);
  assert.equal(next.sourceRevision, 1);
});
