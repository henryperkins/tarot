import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNarrativeFocusTarget,
  registerNarrativeFocusTarget,
  subscribeNarrativeFocusTarget
} from '../src/lib/narrativeFocusTarget.js';

test('narrative skip destination follows actual header mounts and unmounts', () => {
  const changes = [];
  const unsubscribe = subscribeNarrativeFocusTarget(() => changes.push(getNarrativeFocusTarget()));
  const first = { isConnected: true };
  const next = { isConnected: true };
  const removeFirst = registerNarrativeFocusTarget(first);
  assert.equal(getNarrativeFocusTarget(), first);

  const removeNext = registerNarrativeFocusTarget(next);
  removeFirst();
  assert.equal(getNarrativeFocusTarget(), next, 'a leaving scene cannot clear the next scene heading');

  removeNext();
  assert.equal(getNarrativeFocusTarget(), null);
  assert.deepEqual(changes, [first, next, null]);
  unsubscribe();

  const cleanup = registerNarrativeFocusTarget(first);
  cleanup();
  assert.equal(changes.length, 3, 'unmounted navigation stops receiving updates');
});

test('a detached narrative heading is never offered as a skip destination', () => {
  const heading = { isConnected: true };
  const cleanup = registerNarrativeFocusTarget(heading);
  heading.isConnected = false;
  assert.equal(getNarrativeFocusTarget(), null);
  cleanup();
});
