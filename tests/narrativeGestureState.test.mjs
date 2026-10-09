import test from 'node:test';
import assert from 'node:assert/strict';
import { createGestureFocusState, reduceGestureFocus, getCardPresence } from '../src/components/reading/narrative/narrativeGestureState.js';
import { getAllCards } from '../src/lib/cardLookup.js';

const associations = ['pool', 'ground', 'balance'].map((id, index) => ({
  id, kind: index === 2 ? 'balance' : 'literal', passage: { start: index * 10, end: index * 10 + 10 },
  targets: [{ occurrenceId: 'a:0', detailIds: index === 2 ? ['pool-pour', 'land-pour'] : [id] }]
}));
const introductions = [{ occurrenceId: 'a:0', start: 0, namedEnd: 5, descriptionStart: 10, midpoint: 20, end: 30 }];
const initial = () => ({ ...createGestureFocusState({ runId: 'a', sourceRevision: 0, associations, introductions }), passageVisibility: { pool: true, ground: true, balance: true } });
const event = (type, rest = {}) => ({ type, runId: 'a', sourceRevision: 0, ...rest });
const advance = (state, end, ids) => reduceGestureFocus(state, event('PROGRESS', { progress: { visibleEnd: end, complete: false }, eligibleAssociationIds: ids, now: end }));

test('held inspection survives arriving text and release adopts only the latest cue', () => {
  let s = advance(initial(), 10, ['pool']);
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  s = advance(s, 30, ['ground', 'balance']);
  assert.equal(s.current.id, 'pool');
  assert.equal(s.visibleEnd, 30);
  assert.equal(s.pending, 'balance');
  s = reduceGestureFocus(s, event('RELEASE'));
  assert.equal(s.current.id, 'balance');
  assert.equal(s.pending, null);
  assert.deepEqual(s.introduced, ['a:0']);
});

test('identity selection clears detail association and same selection releases', () => {
  let s = advance(initial(), 30, ['balance']);
  const hold = event('HOLD', { selection: { kind: 'identity', occurrenceId: 'a:0' } });
  s = reduceGestureFocus(s, hold);
  assert.deepEqual(s.current.targets, [{ occurrenceId: 'a:0', detailIds: [] }]);
  s = reduceGestureFocus(s, hold);
  assert.equal(s.held, null);
});

test('manual modal inspection suspends motion without releasing a held cue', () => {
  let s = advance(initial(), 10, ['pool']);
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  s = reduceGestureFocus(s, event('INSPECTION', { kind: 'modal', active: true }));
  s = reduceGestureFocus(s, event('INSPECTION', { kind: 'card-detail', active: true }));
  s = advance(s, 30, ['balance']);
  s = reduceGestureFocus(s, event('INSPECTION', { kind: 'modal', active: false }));
  assert.equal(s.held.id, 'pool');
  assert.equal(s.canMove, false);
  s = reduceGestureFocus(s, event('INSPECTION', { kind: 'card-detail', active: false }));
  assert.equal(s.held.id, 'pool');
  assert.equal(s.canMove, true);
});

test('completed hydration provides revisit access without replay', () => {
  const s = createGestureFocusState({ runId: 'a', sourceRevision: 0, associations, introductions, completed: true });
  assert.equal(s.phase, 'static');
  assert.deepEqual(s.introduced, ['a:0']);
  assert.equal(s.pending, null);
  const displayed = reduceGestureFocus(s, event('PROGRESS', { progress: { visibleEnd: 30, complete: true }, eligibleAssociationIds: ['balance'], now: 10 }));
  assert.equal(displayed.phase, 'static');
  assert.equal(displayed.canMove, false);
});

test('the final live cue can arrive with completion without replaying hydration', () => {
  let s = initial();
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, status: 'complete', kind: 'complete' }, associations, introductions });
  s = advance(s, 30, []);
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'passage', id: 'balance', visible: true, now: 30 }));
  assert.equal(s.current?.id, 'balance');
  assert.equal(s.phase, 'active');
});

test('invalidated authored identity cannot survive same-run registry replacement', () => {
  let s = createGestureFocusState({ runId: 'a', sourceRevision: 0, associations: [{ ...associations[0], kind: 'identity' }], introductions });
  s = advance(s, 10, ['pool']);
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, status: 'complete' }, associations: [], introductions: [] });
  assert.equal(s.held, null);
  assert.equal(s.current, null);
});

test('presence follows literal description progress and static reduced meaning', () => {
  const introduction = { start: 10, namedEnd: 20, descriptionStart: 30, midpoint: 50, end: 70 };
  const at = (visibleEnd, reducedMotion = false) => getCardPresence({ introduction, visibleEnd, reducedMotion });
  assert.equal(at(10), 0);
  assert.equal(at(30), .035);
  assert.equal(at(50), .55);
  assert.equal(at(70), 1);
  assert.equal(at(20, true), 1);
});

test('dynamic introductions remain quiet until committed without blocking inspection or reduced motion', () => {
  const introduction = { start: 0, namedEnd: 8, descriptionStart: 8, midpoint: 8, end: 8, pending: true, dynamic: true };
  const presence = (options = {}) => getCardPresence({ introduction, visibleEnd: 8, ...options });
  assert.equal(presence({ visibleEnd: 7 }), 0);
  assert.equal(presence(), .035);
  assert.equal(presence({ visibleEnd: 80 }), .035);
  assert.equal(presence({ inspected: true }), 1);
  assert.equal(presence({ reducedMotion: true }), 1);
  assert.equal(presence({ introduction: { ...introduction, pending: false } }), 1);
});

test('replacement clears stale hold and ignores stale progress', () => {
  let s = advance(initial(), 10, ['pool']);
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'b', sourceRevision: 1, status: 'streaming' }, associations: [], introductions: [] });
  assert.equal(s.held, null);
  assert.equal(s.current, null);
  assert.equal(reduceGestureFocus(s, event('PROGRESS', { progress: { visibleEnd: 500 }, eligibleAssociationIds: ['balance'] })), s);
});

test('visibility and status cancel motion without creating an arrival backlog', () => {
  let s = advance(initial(), 30, ['balance']);
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'artwork', id: 'a:0', visible: false }));
  assert.equal(s.canMove, false);
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'artwork', id: 'a:0', visible: true }));
  s = reduceGestureFocus(s, event('STATUS', { status: 'paused' }));
  assert.equal(s.canMove, false);
  s = reduceGestureFocus(s, event('STATUS', { status: 'streaming' }));
  assert.equal(s.canMove, true);
  s = reduceGestureFocus(s, event('TICK', { now: 5000 }));
  assert.equal(s.phase, 'static');
  s = reduceGestureFocus(s, event('MOTION', { reducedMotion: true }));
  assert.equal(s.canMove, false);
});

test('a delayed active deadline preserves the settling deadline and skips elapsed motion', () => {
  const active = advance(initial(), 10, ['pool']);
  const settling = reduceGestureFocus(active, event('TICK', { now: active.activeUntil + 100 }));
  assert.equal(settling.phase, 'settling');
  assert.equal(settling.activeUntil, active.activeUntil + 1500);
  const finished = reduceGestureFocus(active, event('TICK', { now: active.activeUntil + 1500 }));
  assert.equal(finished.phase, 'static');
  assert.equal(finished.canMove, false);
});

test('all 78 identities in both orientations share introduction, hold, revisit and cleanup', () => {
  for (const card of getAllCards()) for (const reversed of [false, true]) {
    const id = `run:${card.number}-${reversed}`;
    const intro = { occurrenceId: id, start: 0, namedEnd: 5, end: 10 };
    let s = createGestureFocusState({ runId: 'run', sourceRevision: 0, introductions: [intro], completed: true });
    s = reduceGestureFocus(s, { type: 'HOLD', runId: 'run', sourceRevision: 0, selection: { kind: 'identity', occurrenceId: id } });
    assert.equal(s.current.targets[0].occurrenceId, id);
    s = reduceGestureFocus(s, { type: 'RELEASE', runId: 'run', sourceRevision: 0 });
    assert.equal(s.held, null);
    assert.deepEqual(s.introduced, [id]);
    s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'new', sourceRevision: 0 }, associations: [], introductions: [] });
    assert.deepEqual(s.introduced, []);
  }
});

test('SOURCE then progress sees newly arrived cue and invalid identity hold is cleared', () => {
  let s = createGestureFocusState({ runId: 'a', sourceRevision: 0, associations: associations.slice(0, 1), introductions });
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, status: 'streaming' }, associations, introductions });
  s = advance(s, 30, []);
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'passage', id: 'balance', visible: true }));
  assert.equal(s.current.id, 'balance');
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'identity', occurrenceId: 'a:0' } }));
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, status: 'streaming' }, associations: [], introductions: [] });
  assert.equal(s.held, null);
  assert.equal(s.current, null);
  assert.deepEqual(s.introduced, []);
});

test('unreported passages wait for visibility and settled reentry does not replay', () => {
  let s = createGestureFocusState({ runId: 'a', sourceRevision: 0, associations, introductions });
  s = advance(s, 30, []);
  assert.equal(s.current, null);
  assert.equal(s.pending, 'balance');
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'passage', id: 'balance', visible: true }));
  assert.equal(s.current.id, 'balance');
  assert.equal(s.canMove, true);
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'passage', id: 'balance', visible: false }));
  assert.equal(s.phase, 'static');
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'passage', id: 'balance', visible: true }));
  assert.equal(s.canMove, false);
  assert.equal(s.phase, 'static');
});

test('unknown passage never enables automatic motion and hydration visibility stays static', () => {
  let s = createGestureFocusState({ runId: 'a', sourceRevision: 0, associations, introductions });
  s = advance(s, 10, ['pool']);
  assert.equal(s.current, null);
  assert.equal(s.canMove, false);
  assert.equal(s.pending, 'pool');
  s = createGestureFocusState({ runId: 'a', sourceRevision: 0, associations, introductions, completed: true });
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'passage', id: 'balance', visible: true }));
  assert.equal(s.phase, 'static');
  assert.equal(s.canMove, false);
});
