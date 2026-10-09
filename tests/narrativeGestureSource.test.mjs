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
