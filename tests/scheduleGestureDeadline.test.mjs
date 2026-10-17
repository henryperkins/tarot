import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleGestureDeadline } from '../src/components/reading/narrative/scheduleGestureDeadline.js';

function clock() {
  let time = 0;
  let serial = 0;
  const timers = new Map();
  return {
    timers,
    now: () => time,
    setTimer(callback, delay) { const id = ++serial; timers.set(id, { callback, delay }); return id; },
    clearTimer(id) { timers.delete(id); },
    wake(at) {
      time = at;
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
    }
  };
}

test('early timer wakes re-arm and deliver a single tick only when the deadline is reached', () => {
  const runtime = clock();
  const calls = [];
  scheduleGestureDeadline(1800.7, now => calls.push(now), runtime);
  assert.equal([...runtime.timers.values()][0].delay, 1801);
  runtime.wake(1800.2);
  assert.deepEqual(calls, []);
  assert.equal([...runtime.timers.values()][0].delay, 1);
  runtime.wake(1801.2);
  assert.deepEqual(calls, [1801.2]);
  assert.equal(runtime.timers.size, 0);
});

test('late timer wakes report actual time so elapsed phases can be skipped', () => {
  const runtime = clock();
  const calls = [];
  scheduleGestureDeadline(1800, now => calls.push(now), runtime);
  runtime.wake(9000);
  assert.deepEqual(calls, [9000]);
  assert.equal(runtime.timers.size, 0);
});

test('cleanup prevents pending and already-queued callbacks after hold, replacement or unmount', () => {
  const runtime = clock();
  const calls = [];
  const cancel = scheduleGestureDeadline(1800, now => calls.push(now), runtime);
  runtime.wake(1750);
  const queued = [...runtime.timers.values()][0].callback;
  cancel();
  cancel();
  assert.equal(runtime.timers.size, 0);
  queued();
  assert.deepEqual(calls, []);
  assert.equal(runtime.timers.size, 0);
});
