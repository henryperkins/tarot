import test from 'node:test';
import assert from 'node:assert/strict';
import { retainHeldPassage, withPassageArtwork } from '../src/lib/retainHeldPassage.js';
import { resolveNarrativePassages } from '../src/lib/generatedNarrativePassages.js';
import { createGestureFocusState, reduceGestureFocus } from '../src/components/reading/narrative/narrativeGestureState.js';

const artworkEdition = 'rws-immanuelle-vector';
const cards = [{ index: 0, canonicalName: 'The Star', artworkEdition }];
const raw = 'The Star pours into a pool. That water may carry your memory.';
const document = { version: 1, artworkEdition, raw, annotations: [
  { id: 'water', kind: 'literal', quote: 'pours into a pool', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] },
  { id: 'memory', kind: 'interpretation', quote: 'That water may carry your memory', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }], establishedBy: ['water'] }
] };
const source = { runId: 'held', sourceRevision: 0, raw, status: 'streaming' };
const resolve = value => withPassageArtwork(resolveNarrativePassages({ source: value, cards, artworkEdition }), cards, artworkEdition);
const event = (type, value = {}) => ({ type, runId: source.runId, sourceRevision: 0, ...value });
function heldState() {
  const resolved = resolve(source);
  let state = createGestureFocusState({ ...source, ...resolved });
  state = reduceGestureFocus(state, event('PROGRESS', { progress: { visibleEnd: raw.length }, now: 10 }));
  const literal = resolved.associations.find(cue => cue.kind === 'literal');
  return reduceGestureFocus(state, event('HOLD', { selection: { kind: 'association', id: literal.id }, now: 20 }));
}
const retain = (state, options = {}) => retainHeldPassage({ state, source, cards, artworkEdition,
  resolved: resolve({ ...source, semanticDocument: document }), ...options });

test('late generated metadata retains the exact held phrase in state and the rendering registry', () => {
  const state = heldState();
  const result = retain(state);
  assert.ok(result.associations.includes(state.current));
  assert.equal(result.associations.some(cue => cue.id === 'water'), false, 'the competing generated span waits for release');
  assert.equal(result.associations.some(cue => cue.id === 'memory'), true);
  const updated = reduceGestureFocus(state, { type: 'SOURCE', source, ...result });
  assert.deepEqual(updated.held, state.held);
  assert.equal(updated.current, state.current);
  const released = reduceGestureFocus(updated, event('RELEASE', { now: 30 }));
  const base = resolve({ ...source, semanticDocument: document });
  assert.equal(retain(released, { resolved: base }), base);
  assert.ok(base.associations.some(cue => cue.id === 'water'));
});

test('replacement, source edits, artwork changes and altered card identities revoke a held passage', () => {
  const state = heldState();
  const resolved = resolve({ ...source, semanticDocument: document });
  for (const overrides of [
    { source: { ...source, runId: 'replacement' } },
    { source: { ...source, sourceRevision: 1 } },
    { source: { ...source, raw: 'The Star has no pool.' } },
    { cards: [{ ...cards[0], artworkEdition: 'rws-1909-scan' }] },
    { cards: [{ ...cards[0], canonicalName: 'The Hermit' }] }
  ]) assert.equal(retain(state, { resolved, ...overrides }), resolved);
});

test('removing a personal reflection strips its acknowledgement while preserving the valid held artwork', () => {
  const state = heldState();
  state.current = { ...state.current, personalContext: { type: 'querent-reflection', quote: 'I miss home.' } };
  const kept = retain(state, { source: { ...source, reflectionsText: 'I miss home.' } });
  assert.equal(kept.associations.find(cue => cue.id === state.current.id).personalContext.quote, 'I miss home.');
  const removed = retain(state, { source: { ...source, reflectionsText: '' } });
  const held = removed.associations.find(cue => cue.id === state.current.id);
  assert.equal(held.personalContext, undefined);
  assert.deepEqual(held.targets, state.current.targets);
});
