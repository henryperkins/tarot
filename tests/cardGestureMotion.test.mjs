import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardGestureMotionController } from '../src/components/reading/narrative/useCardGestureMotion.js';
test('water settles quadratically for 1500ms, catches resized controls, and hold resumes only eligible ownership', () => {
  let time = 0, frame, pauses = 0;
  const water = { playbackRate: 1, play() {}, pause() { pauses++; } };
  const extra = { ...water };
  const controls = [water];
  const controller = createCardGestureMotionController({ getWaterAnimations: () => controls, now: () => time, requestFrame: cb => { frame = cb; return 1; }, cancelFrame() {} });
  const gesture = { details: [{ motionRecipe: { kind: 'water' } }] };
  controller.sync({ gesture, phase: 'active', canMove: true });
  controller.sync({ gesture, phase: 'settling', canMove: true });
  time = 750; frame(); assert.equal(water.playbackRate, .25);
  controls.push(extra); time = 1500; frame(); assert.equal(extra.playbackRate, 0); assert.equal(pauses, 2);
  controller.sync({ gesture, phase: 'held', canMove: true }); assert.equal(water.playbackRate, 1);
  controller.sync({ gesture, phase: 'held', canMove: false }); assert.equal(pauses, 4);
  controller.dispose();
});
test('finite effects finish within 1800ms while held, stable appends retain handles, and static preference changes do not replay', () => {
  let time = 0, frame, starts = 0, stops = 0;
  const controller = createCardGestureMotionController({ startFinite: () => { starts++; return [{ cancel() { stops++; } }]; }, now: () => time, requestFrame: cb => { frame = cb; return 1; }, cancelFrame() {} });
  const gesture = { associationId: 'same', details: [{ motionRecipe: { kind: 'finite' } }] };
  controller.sync({ gesture, phase: 'held', canMove: true });
  controller.sync({ gesture: { ...gesture }, phase: 'held', canMove: true }); assert.equal(starts, 1);
  time = 1800; frame(); assert.equal(stops, 1);
  controller.sync({ gesture, phase: 'held', canMove: true }); assert.equal(starts, 1);
  controller.sync({ gesture, phase: 'static', canMove: true, reducedMotion: true });
  controller.sync({ gesture, phase: 'static', canMove: true }); assert.equal(starts, 1);
  controller.dispose();
});
test('reduced motion, replacement, lost ownership and dispose cancel scoped handles without stale work', () => {
  let starts = 0, stops = 0, pauses = 0, callback, frames = 0;
  const water = { pause() { pauses++; }, play() {}, playbackRate: 1 };
  const controller = createCardGestureMotionController({
    startFinite: () => { starts++; return [{ cancel() { stops++; } }]; },
    getWaterAnimations: () => [water],
    requestFrame: cb => { callback = cb; frames++; return frames; }, cancelFrame() {}, now: () => 0
  });
  const gesture = { id: 'a', motionRecipes: [{ kind: 'finite' }, { kind: 'water' }] };
  controller.sync({ gesture, phase: 'active', canMove: true, reducedMotion: true }); assert.equal(starts, 0);
  controller.sync({ gesture, phase: 'held', canMove: true }); assert.equal(starts, 1);
  controller.sync({ gesture: { ...gesture, id: 'b' }, phase: 'active', canMove: true }); assert.equal(stops, 1); assert.equal(starts, 2);
  controller.sync({ gesture: { ...gesture, id: 'b' }, phase: 'active', canMove: false }); assert.equal(stops, 2);
  assert.ok(pauses >= 3);
  controller.dispose(); const previousFrames = frames; callback(); assert.equal(frames, previousFrames);
  controller.sync({ gesture, phase: 'held', canMove: true }); assert.equal(starts, 2);
});
test('settled owner pauses replacement water handles without replaying loops', () => {
  let time = 0, frame;
  const first = { playbackRate: 1, play() {}, pause() { this.paused = true; } };
  const controls = [first];
  const controller = createCardGestureMotionController({ getWaterAnimations: () => controls, now: () => time, requestFrame: cb => { frame = cb; return 1; }, cancelFrame() {} });
  const gesture = { id: 'pool', motionRecipes: [{ kind: 'water' }] };
  controller.sync({ gesture, phase: 'active', canMove: true });
  controller.sync({ gesture, phase: 'settling', canMove: true });
  time = 1500; frame();
  const replacement = { playbackRate: 1, play() { throw new Error('must not replay'); }, pause() { this.paused = true; } };
  controls.push(replacement);
  controller.sync({ gesture, phase: 'settling', canMove: true });
  assert.equal(replacement.paused, true);
  assert.equal(replacement.playbackRate, 0);
  controller.dispose();
});
test('held water reacquires CSS handles created after preference restoration within bounded frames', () => {
  let frame, frames = 0, time = 0;
  const controls = [];
  const controller = createCardGestureMotionController({ getWaterAnimations: () => controls, now: () => time, requestFrame: cb => { frame = cb; frames++; return frames; }, cancelFrame() {} });
  const gesture = { id: 'pool', motionRecipes: [{ kind: 'water' }] };
  controller.sync({ gesture, phase: 'held', canMove: true, reducedMotion: true });
  controller.sync({ gesture, phase: 'held', canMove: true, reducedMotion: false });
  assert.equal(typeof frame, 'function', 'restoration must await CSS handle recreation');
  const recreated = { playbackRate: 0, play() { this.playing = true; }, pause() { this.playing = false; } };
  controls.push(recreated);
  let pending = frame;
  for (let index = 0; index < 10 && pending; index++) { frame = undefined; time += 16; pending(); pending = frame; }
  assert.equal(recreated.playing, true); assert.equal(recreated.playbackRate, 1);
  assert.ok(frames <= 3, 'water discovery must not become an endless focus loop');
  controller.sync({ gesture, phase: 'held', canMove: false });
  assert.equal(recreated.playing, false);
  controller.sync({ gesture, phase: 'held', canMove: true });
  const staleFrame = frame;
  controller.sync({ gesture, phase: 'held', canMove: false });
  staleFrame();
  assert.equal(recreated.playing, false, 'cancelled discovery cannot revive outgoing controls');
  controller.dispose();
});
