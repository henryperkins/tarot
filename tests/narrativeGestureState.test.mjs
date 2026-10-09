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
  assert.equal(s.pending, null);
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
  assert.equal(s.pending, null);
  s = createGestureFocusState({ runId: 'a', sourceRevision: 0, associations, introductions, completed: true });
  s = reduceGestureFocus(s, event('VISIBLE', { kind: 'passage', id: 'balance', visible: true }));
  assert.equal(s.phase, 'static');
  assert.equal(s.canMove, false);
});

const binding = { readingResultId: 'a', sourceRevision: 0, spreadHash: 'spread', contextHash: 'context', artworkEdition: 'rws', catalogVersion: '1' };
const arrival = (rest = {}) => event('CUES_ARRIVED', {
  binding, ledgerRevision: 1, associations, introductions,
  addedCueIds: associations.map(({ id }) => id), visibilitySnapshot: {}, now: 100, ...rest
});
const deliveredWithoutCues = () => advance(createGestureFocusState({ runId: 'a', sourceRevision: 0 }), 30, []);

test('late batch selects the earlier visible cue instead of a later offscreen cue', () => {
  const before = deliveredWithoutCues();
  const s = reduceGestureFocus(before, arrival({ visibilitySnapshot: { pool: true, ground: false, balance: false } }));
  assert.equal(s.current?.id, 'pool');
  assert.equal(s.pending, null);
  assert.equal(s.visibleEnd, before.visibleEnd);
  assert.equal(s.phase, 'active');
});

test('cue arrival preserves held inspection and release recomputes changed visibility', () => {
  let s = advance({ ...initial(), passageVisibility: { pool: true, ground: false, balance: false } }, 10, ['pool']);
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  s = advance(s, 30, []);
  s = reduceGestureFocus(s, arrival({ visibilitySnapshot: { pool: true, ground: true, balance: false } }));
  assert.equal(s.held?.id, 'pool');
  assert.equal(s.current.id, 'pool');
  assert.equal(s.pending, 'ground');
  s = reduceGestureFocus(s, event('VISIBILITY', { visibilitySnapshot: { pool: false, ground: false, balance: true }, now: 150 }));
  s = reduceGestureFocus(s, event('RELEASE', { now: 200 }));
  assert.equal(s.current.id, 'balance');
  assert.equal(s.pending, null);
});

test('duplicate and older ledger arrivals preserve settled state and deadlines exactly', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival({ visibilitySnapshot: { pool: true } }));
  s = reduceGestureFocus(s, event('TICK', { now: 10000 }));
  assert.equal(s.phase, 'static');
  const repeated = reduceGestureFocus(s, arrival({ now: 12000, visibilitySnapshot: { balance: true } }));
  assert.equal(repeated, s);
  assert.equal(reduceGestureFocus(s, arrival({ ledgerRevision: 0 })), s);
});

test('an active visible cue keeps its deadline while newer visible candidates coalesce', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival({ associations: associations.slice(0, 1), addedCueIds: ['pool'], visibilitySnapshot: { pool: true } }));
  const deadline = s.activeUntil;
  s = reduceGestureFocus(s, arrival({ ledgerRevision: 2, visibilitySnapshot: { ground: true, balance: true }, now: 200 }));
  assert.equal(s.current.id, 'pool');
  assert.equal(s.activeUntil, deadline);
  assert.equal(s.pending, 'balance');
  s = reduceGestureFocus(s, event('TICK', { now: deadline }));
  assert.equal(s.current.id, 'balance');
  assert.equal(s.pending, null);
  s = reduceGestureFocus(s, event('TICK', { now: 10000 }));
  s = reduceGestureFocus(s, event('VISIBILITY', { visibilitySnapshot: { pool: false, ground: true, balance: false }, now: 11000 }));
  assert.equal(s.current.id, 'balance');
  assert.equal(s.phase, 'static');
});

test('new cue registration defers without visibility and atomically chooses the latest visible passage', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival());
  assert.equal(s.current, null);
  assert.equal(s.pending, null);
  s = reduceGestureFocus(s, event('VISIBILITY', { visibilitySnapshot: { pool: true, ground: true, balance: false }, now: 200 }));
  assert.equal(s.current.id, 'ground');
  assert.equal(s.pending, null);
});

test('late passed cues remain available for explicit revisit while an unseen future cue can play', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival({ visibilitySnapshot: { pool: false, ground: false, balance: false }, passedCueIds: ['pool'] }));
  s = reduceGestureFocus(s, event('VISIBILITY', { visibilitySnapshot: { pool: true, ground: false, balance: false }, now: 150 }));
  assert.equal(s.current, null);
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  assert.equal(s.current.id, 'pool');
  assert.equal(s.phase, 'held');
  s = reduceGestureFocus(s, event('RELEASE'));
  s = reduceGestureFocus(s, event('VISIBILITY', { visibilitySnapshot: { pool: false, balance: true }, now: 200 }));
  assert.equal(s.current.id, 'balance');
  assert.equal(s.phase, 'active');
});

test('cue arrival never plays a visible but not fully rendered passage', () => {
  let s = advance(createGestureFocusState({ runId: 'a', sourceRevision: 0 }), 10, []);
  s = reduceGestureFocus(s, arrival({ visibilitySnapshot: { pool: false, ground: true, balance: true } }));
  assert.equal(s.current, null);
  assert.equal(s.visibleEnd, 10);
  s = advance(s, 20, ['ground']);
  assert.equal(s.current.id, 'ground');
});

test('source binding replacement clears playback history and rejects the old binding', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival({ visibilitySnapshot: { pool: true } }));
  const replacement = { ...binding, contextHash: 'other-context' };
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, binding: replacement, status: 'streaming' }, associations, introductions });
  assert.equal(s.current, null);
  assert.equal(s.ledgerRevision, 0);
  assert.equal(reduceGestureFocus(s, arrival({ ledgerRevision: 2 })), s);
  s = advance(s, 30, []);
  s = reduceGestureFocus(s, arrival({ binding: replacement, visibilitySnapshot: { pool: true } }));
  assert.equal(s.current.id, 'pool');
});

test('late restored and reduced-motion cues update static meaning without automatic deadlines', () => {
  for (const hydrate of [false, true]) {
    let s = createGestureFocusState({ runId: 'a', sourceRevision: 0, completed: hydrate });
    s = advance(s, 30, []);
    if (!hydrate) s = reduceGestureFocus(s, event('MOTION', { reducedMotion: true }));
    s = reduceGestureFocus(s, arrival({ visibilitySnapshot: { pool: true, ground: true, balance: false } }));
    assert.equal(s.current?.id, 'ground');
    assert.equal(s.phase, 'static');
    assert.equal(s.canMove, false);
    assert.equal(s.activeUntil, 0);
    assert.equal(s.pending, null);
  }
});

test('live completion accepts useful late visible cues and is not mistaken for hydration', () => {
  let s = deliveredWithoutCues();
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, status: 'complete', kind: 'complete' }, associations: [], introductions: [] });
  s = reduceGestureFocus(s, arrival({ visibilitySnapshot: { pool: true } }));
  assert.equal(s.current?.id, 'pool');
  assert.equal(s.phase, 'active');
});

test('held fallback association survives a same-binding cumulative registry replacement', () => {
  let s = advance(initial(), 10, ['pool']);
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  s = reduceGestureFocus(s, arrival({ associations: associations.slice(1), addedCueIds: ['ground', 'balance'] }));
  assert.equal(s.held?.id, 'pool');
  assert.equal(s.current.id, 'pool');
  s = reduceGestureFocus(s, event('RELEASE'));
  assert.equal(s.held, null);
});

test('legacy registry arrival stays usable without fabricating a visual binding', () => {
  const s = reduceGestureFocus(deliveredWithoutCues(), arrival({ binding: undefined, visibilitySnapshot: { pool: true } }));
  assert.equal(s.current?.id, 'pool');
  assert.equal(s.binding, null);
});

test('SOURCE accepts visualBinding and never lets an unbound arrival mutate its registry', () => {
  let s = deliveredWithoutCues();
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, visualBinding: binding, status: 'streaming' }, associations: [], introductions: [] });
  assert.deepEqual(s.binding, binding);
  assert.equal(reduceGestureFocus(s, arrival({ binding: undefined })), s);
  s = reduceGestureFocus(s, arrival({ visibilitySnapshot: { pool: true } }));
  assert.equal(s.current.id, 'pool');
});

test('restoration of the same result clears held inspection and old automatic deadlines', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival({ visibilitySnapshot: { pool: true } }));
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, binding, status: 'complete', kind: 'hydrate' }, associations, introductions });
  assert.equal(s.held, null);
  assert.equal(s.pending, null);
  assert.equal(s.phase, 'static');
  assert.equal(s.activeUntil, 0);
});

test('reduced-motion arrival during modal inspection leaves no pending playback', () => {
  let s = deliveredWithoutCues();
  s = reduceGestureFocus(s, event('MOTION', { reducedMotion: true }));
  s = reduceGestureFocus(s, event('INSPECTION', { kind: 'modal', active: true }));
  s = reduceGestureFocus(s, arrival({ visibilitySnapshot: { ground: true } }));
  assert.equal(s.current, null);
  assert.equal(s.pending, null);
  s = reduceGestureFocus(s, event('INSPECTION', { kind: 'modal', active: false }));
  assert.equal(s.current.id, 'ground');
  assert.equal(s.phase, 'static');
});

test('adopting the first visual binding resets legacy revisions while preserving held fallback and consumed cues', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival({ binding: undefined, ledgerRevision: 8, visibilitySnapshot: { pool: true } }));
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  const consumed = s.consumedCueIds;
  const deadline = s.activeUntil;
  s = reduceGestureFocus(s, { type: 'SOURCE', source: { runId: 'a', sourceRevision: 0, visualBinding: binding, status: 'streaming' }, associations, introductions });
  s = reduceGestureFocus(s, arrival({ ledgerRevision: 0, addedCueIds: [], visibilitySnapshot: { pool: true } }));
  assert.equal(s.ledgerRevision, 0);
  assert.equal(s.held?.id, 'pool');
  assert.equal(s.current.id, 'pool');
  assert.equal(s.activeUntil, deadline);
  assert.deepEqual(s.consumedCueIds, consumed);
  s = reduceGestureFocus(s, arrival({ ledgerRevision: 1, visibilitySnapshot: { ground: true } }));
  assert.equal(s.ledgerRevision, 1);
  assert.equal(s.pending, 'ground');
  assert.equal(s.held?.id, 'pool');
});

test('late arrival updates the clock used when a modal releases focus after prose stopped', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), event('INSPECTION', { kind: 'modal', active: true, now: 100 }));
  s = reduceGestureFocus(s, arrival({ visibilitySnapshot: { pool: true }, now: 10000 }));
  s = reduceGestureFocus(s, event('INSPECTION', { kind: 'modal', active: false }));
  assert.equal(s.current.id, 'pool');
  assert.equal(s.phase, 'active');
  assert.equal(s.activeUntil, 11800);
});

test('an unplayed pending cue can become visible again during inspection without being consumed', () => {
  let s = reduceGestureFocus(deliveredWithoutCues(), arrival({ visibilitySnapshot: { pool: true } }));
  s = reduceGestureFocus(s, event('HOLD', { selection: { kind: 'association', id: 'pool' } }));
  for (const visible of [true, false, true]) {
    s = reduceGestureFocus(s, event('VISIBILITY', { visibilitySnapshot: { balance: visible }, now: 200 }));
  }
  assert.equal(s.pending, 'balance');
  assert.equal(s.consumedCueIds.includes('balance'), false);
  s = reduceGestureFocus(s, event('RELEASE', { now: 300 }));
  assert.equal(s.current.id, 'balance');
});
