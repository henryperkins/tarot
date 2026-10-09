import test from 'node:test';
import assert from 'node:assert/strict';
import { createGestureSource, advanceGestureSource } from '../src/lib/narrativeGestureSource.js';

test('append, resume, and completion preserve generation identity', () => {
  let frame = createGestureSource({ runId: 'run-a', raw: 'The Star', status: 'streaming' });
  for (const update of [
    { raw: 'The Star pours.', kind: 'append', status: 'streaming' },
    { raw: 'The Star pours.', kind: 'snapshot', status: 'paused' },
    { raw: 'The Star pours. Water flows.', kind: 'snapshot', status: 'streaming' },
    { raw: 'The Star pours. Water flows.', kind: 'complete', status: 'complete' }
  ]) {
    frame = advanceGestureSource(frame, update);
    assert.equal(frame.runId, 'run-a');
    assert.equal(frame.sourceRevision, 0);
    assert.equal(frame.raw, update.raw);
    assert.equal(frame.status, update.status);
  }
  assert.equal(createGestureSource({ runId: 'hydrated', raw: 'Done', status: 'complete' }).kind, 'hydrate');
});

test('non-prefix source replacement invalidates associations', () => {
  const base = createGestureSource({ runId: 'run-a', raw: 'The Star pours.', status: 'streaming' });
  const replaced = advanceGestureSource(base, { raw: 'The Hermit waits.', kind: 'snapshot', status: 'streaming' });
  assert.equal(replaced.sourceRevision, 1);
  assert.equal(advanceGestureSource(replaced, { raw: 'The Hermit', kind: 'complete', status: 'complete' }).sourceRevision, 2);
  assert.notEqual(createGestureSource({ runId: 'run-b', raw: base.raw }).runId, base.runId);
  assert.equal(advanceGestureSource(base, { status: 'error' }).raw, base.raw);
});

test('semantic metadata follows only the exact generation and is revoked on replacement', () => {
  const document = { version: 1, raw: 'A complete reading.', artworkEdition: 'rws-immanuelle-vector', annotations: [] };
  let frame = createGestureSource({ runId: 'model', semanticDocument: document });
  assert.equal(frame.semanticDocument, document);
  frame = advanceGestureSource(frame, { raw: 'A complete', status: 'streaming' });
  assert.equal(frame.semanticDocument, document);
  frame = advanceGestureSource(frame, { raw: 'An entirely different reading.', kind: 'snapshot' });
  assert.equal(frame.semanticDocument, undefined);
  assert.equal(frame.sourceRevision, 1);
  assert.equal(createGestureSource({ runId: 'wrong', raw: 'Truncated', status: 'complete', semanticDocument: document }).semanticDocument, undefined);
});

test('a replacement can explicitly supply new semantic metadata while late mismatched metadata is ignored', () => {
  let frame = createGestureSource({ runId: 'reading', raw: 'Old' });
  const replacement = { version: 1, raw: 'New text.', artworkEdition: 'rws-immanuelle-vector', annotations: [] };
  frame = advanceGestureSource(frame, { raw: 'New text.', semanticDocument: replacement, status: 'complete' });
  assert.equal(frame.semanticDocument, replacement);
  frame = advanceGestureSource(frame, { semanticDocument: { ...replacement, raw: 'Stale text.' } });
  assert.equal(frame.semanticDocument, undefined);
});

const visualBinding = { readingResultId: 'visual-reading', sourceRevision: 0, spreadHash: 'a'.repeat(64),
  contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: '1' };
const cueLedger = { version: 1, binding: visualBinding, ledgerRevision: 1, raw: 'The Star pours.',
  analyzedEnd: 15, analyzedHash: 'c'.repeat(64), cues: [], introductions: [], receipts: [] };

test('a bound analyzed prefix survives later prose and live completion without becoming hydration', () => {
  let frame = createGestureSource({ runId: visualBinding.readingResultId, raw: cueLedger.raw,
    status: 'streaming', visualBinding });
  frame = advanceGestureSource(frame, { raw: `${cueLedger.raw} Memory remains.`, cueLedger });
  assert.equal(frame.cueLedger, cueLedger);
  frame = advanceGestureSource(frame, { status: 'complete', kind: 'complete' });
  assert.equal(frame.cueLedger, cueLedger);
  assert.equal(frame.kind, 'complete');
  assert.equal(frame.visualBinding, visualBinding);
});

test('ledger attachment requires independent matching identity and exact prefix, never snapshot self-assertion', () => {
  const base = { runId: visualBinding.readingResultId, raw: `${cueLedger.raw} More prose.`, status: 'complete' };
  assert.equal(createGestureSource({ ...base, cueLedger }).cueLedger, undefined);
  for (const binding of [
    { ...visualBinding, readingResultId: 'old-result' }, { ...visualBinding, sourceRevision: 2 },
    { ...visualBinding, spreadHash: 'd'.repeat(64) }, { ...visualBinding, contextHash: 'e'.repeat(64) },
    { ...visualBinding, artworkEdition: 'other' }, { ...visualBinding, catalogVersion: '2' }
  ]) {
    assert.equal(createGestureSource({ ...base, visualBinding, cueLedger: { ...cueLedger, binding } }).cueLedger, undefined);
  }
  assert.equal(createGestureSource({ ...base, visualBinding, cueLedger: { ...cueLedger, raw: 'Different text.' } }).cueLedger, undefined);
  assert.equal(createGestureSource({ ...base, visualBinding, cueLedger: { ...cueLedger, analyzedEnd: 7 } }).cueLedger, undefined);
});

test('replacement retires a ledger and delayed old results cannot reattach even to a matching prefix', () => {
  const original = createGestureSource({ runId: visualBinding.readingResultId, raw: `${cueLedger.raw} Old ending.`,
    status: 'streaming', visualBinding, cueLedger });
  const replaced = advanceGestureSource(original, { raw: `${cueLedger.raw} New ending.`, kind: 'snapshot' });
  assert.equal(replaced.sourceRevision, 1);
  assert.equal(replaced.cueLedger, undefined);
  assert.equal(replaced.visualBinding, undefined);
  assert.equal(advanceGestureSource(replaced, { visualBinding, cueLedger }).cueLedger, undefined);
});

test('older or invalid cumulative snapshots cannot discard already accepted associations', () => {
  const currentLedger = { ...cueLedger, ledgerRevision: 2 };
  const original = createGestureSource({ runId: visualBinding.readingResultId, raw: cueLedger.raw,
    status: 'streaming', visualBinding, cueLedger: currentLedger });
  assert.equal(advanceGestureSource(original, { cueLedger }).cueLedger, currentLedger);
  assert.equal(advanceGestureSource(original, { cueLedger: { ...cueLedger, binding: { ...visualBinding, readingResultId: 'stale' } } }).cueLedger, currentLedger);
  const rebound = advanceGestureSource(original, { visualBinding: { ...visualBinding, catalogVersion: '2' } });
  assert.equal(rebound.cueLedger, undefined);
});
