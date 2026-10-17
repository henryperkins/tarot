import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import { createGestureSource, advanceGestureSource } from '../src/lib/narrativeGestureSource.js';
import { sameVisualCueBinding } from '../shared/contracts/visualCueBinding.js';

// Run the actual provider callbacks with storage, transport, and React setters
// injected at their boundaries. This includes the synchronous ownership reset
// that prevents the aborted stream's later catch handler from pausing playback.
const source = await readFile(new URL('../src/contexts/ReadingContext.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const callbacks = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.init?.callee?.name === 'useCallback') {
    callbacks.set(node.id.name, node.init.arguments[0]);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value?.type) visit(value);
  }
}
visit(ast);
function callback(name, dependencies) {
  const node = callbacks.get(name);
  assert.ok(node, `${name} exists`);
  return new Function(...Object.keys(dependencies), `return (${source.slice(node.start, node.end)});`)(...Object.values(dependencies));
}
function fixture({ active = true, rejectCancellation = false } = {}) {
  const controller = new AbortController();
  const state = { personalReading: 'partial reading', isGenerating: active, isReadingStreamActive: active,
    narrativePhase: active ? 'streaming' : 'idle' };
  const requests = [];
  const removedKeys = [];
  const gestureSourceRef = { current: active ? createGestureSource({ runId: 'reading-1',
    raw: 'The Fool opens a possibility.', status: 'streaming', sourceRevision: 3 }) : null };
  const inFlightReadingRef = { current: active ? { controller } : null };
  const readingJobRef = { current: active ? { jobId: 'job-1', jobToken: 'test-token', cursor: 8, readingKey: 'reading-1' } : {} };
  const cursorPersistRef = { current: { lastPersistAt: 100, eventCount: 8, lastJobId: 'job-1' } };
  const clearReadingJob = callback('clearReadingJob', { readingJobRef, cursorPersistRef,
    safeSessionStorage: { removeItem: key => removedKeys.push(key) }, readingJobStorageKey: 'tarot:reading-job' });
  const cancelInFlightReading = callback('cancelInFlightReading', { inFlightReadingRef, readingJobRef, clearReadingJob,
    resetNarrationStream: () => { state.narrationReset = true; },
    fetch: (url, options) => { requests.push({ url, ...options });
      return rejectCancellation ? Promise.reject(new Error('offline')) : Promise.resolve(new Response()); } });
  const updateGestureSource = callback('updateGestureSource', { gestureSourceRef, advanceGestureSource, sameVisualCueBinding,
    setGestureSource: value => { state.gestureSource = value; },
    setVisualResume: () => assert.fail('pausing must not replace visual identity'),
    setReadingMeta: () => assert.fail('pausing must not replace reading metadata') });
  const setters = Object.fromEntries(['personalReading', 'isGenerating', 'isReadingStreamActive', 'narrativePhase', 'srAnnouncement']
    .map(key => [`set${key[0].toUpperCase()}${key.slice(1)}`, value => { state[key] = value; }]));
  const cancel = callback('cancelPersonalReading', { cancelInFlightReading, gestureSourceRef, updateGestureSource, ...setters });
  return { cancel, state, controller, gestureSourceRef, inFlightReadingRef, readingJobRef, cursorPersistRef, requests, removedKeys };
}

for (const rejectCancellation of [false, true]) {
  test(`cancelling pauses the delivered source after releasing stream ownership (offline=${rejectCancellation})`, async () => {
    const f = fixture({ rejectCancellation });
    const previous = f.gestureSourceRef.current;
    f.cancel();
    await Promise.resolve();
    assert.equal(f.controller.signal.aborted, true);
    assert.equal(f.inFlightReadingRef.current, null);
    assert.deepEqual(f.gestureSourceRef.current, { ...previous, status: 'paused' });
    assert.equal(f.state.gestureSource, f.gestureSourceRef.current);
    assert.equal(f.state.personalReading, null);
    assert.equal(f.state.isGenerating, false);
    assert.equal(f.state.isReadingStreamActive, false);
    assert.equal(f.state.narrativePhase, 'idle');
    assert.equal(f.state.narrationReset, true);
    assert.deepEqual(f.requests, [{ url: '/api/tarot-reading/jobs/job-1/cancel', method: 'POST', headers: { 'X-Job-Token': 'test-token' } }]);
    assert.deepEqual(f.readingJobRef.current, { jobId: null, jobToken: null, cursor: 0, readingKey: null });
    assert.deepEqual(f.cursorPersistRef.current, { lastPersistAt: 0, eventCount: 0, lastJobId: null });
    assert.deepEqual(f.removedKeys, ['tarot:reading-job']);
    f.cancel();
    assert.equal(f.requests.length, 1, 'repeat cancellation must not replay the server request');
  });
}

test('cancelling before a source exists is harmless', () => {
  const f = fixture({ active: false });
  f.cancel();
  assert.equal(f.gestureSourceRef.current, null);
  assert.equal(f.requests.length, 0);
  assert.equal(f.state.isGenerating, false);
  assert.equal(f.state.narrativePhase, 'idle');
});
