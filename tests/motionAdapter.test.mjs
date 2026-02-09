import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  animate,
  createScope,
  createTimeline,
  __resetMotionAdapterTestImpl,
  __setMotionAdapterTestImpl
} from '../src/lib/motionAdapter.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createControls() {
  return {
    pause() {},
    play() {},
    stop() {},
    cancel() {}
  };
}

afterEach(() => {
  __resetMotionAdapterTestImpl();
});

describe('motionAdapter.animate', () => {
  test('maps anime-style options to motion options', () => {
    const calls = [];

    __setMotionAdapterTestImpl({
      animateImpl: (target, keyframes, options) => {
        calls.push({ target, keyframes, options });
        return createControls();
      }
    });

    animate('node', {
      translateX: [0, 20],
      opacity: [0, 1],
      duration: 300,
      delay: 150,
      ease: 'outQuad',
      loop: true,
      alternate: true
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].target, 'node');
    assert.deepEqual(calls[0].keyframes.x, [0, 20]);
    assert.deepEqual(calls[0].keyframes.opacity, [0, 1]);
    assert.equal(calls[0].options.duration, 0.3);
    assert.equal(calls[0].options.delay, 0.15);
    assert.deepEqual(calls[0].options.ease, [0.25, 0.46, 0.45, 0.94]);
    assert.equal(calls[0].options.repeat, Infinity);
    assert.equal(calls[0].options.repeatType, 'reverse');
  });
});

describe('motionAdapter.createTimeline', () => {
  test('schedules onBegin at the segment start time when using offsets', async () => {
    const calls = [];

    __setMotionAdapterTestImpl({
      animateImpl: (_target, _keyframes, options) => {
        calls.push(options);
        return createControls();
      }
    });

    const timeline = createTimeline({ autoplay: false });
    const startedAt = Date.now();
    let onBeginAtMs = null;

    timeline.add('node', {
      opacity: [0, 1],
      duration: 60,
      onBegin: () => {
        onBeginAtMs = Date.now() - startedAt;
      }
    }, 80);

    timeline.play();

    await sleep(25);
    assert.equal(onBeginAtMs, null, 'onBegin fired before delayed segment start');

    await sleep(90);
    assert.notEqual(onBeginAtMs, null, 'onBegin never fired');
    assert.ok(onBeginAtMs >= 60, `onBegin fired too early: ${onBeginAtMs}ms`);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].delay, 0.08);
  });

  test('merges numeric delay with absolute offset delay', async () => {
    const calls = [];

    __setMotionAdapterTestImpl({
      animateImpl: (_target, _keyframes, options) => {
        calls.push(options);
        return createControls();
      }
    });

    const timeline = createTimeline({ autoplay: false });

    timeline.add('node', {
      opacity: [0, 1],
      duration: 120,
      delay: 40
    }, 60);

    timeline.play();
    await sleep(5);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].delay, 0.1);
    timeline.pause();
  });
});

describe('motionAdapter.createScope', () => {
  test('revert stops and cancels tracked animations', () => {
    let stopCalls = 0;
    let cancelCalls = 0;

    __setMotionAdapterTestImpl({
      animateImpl: () => ({
        pause() {},
        play() {},
        stop() {
          stopCalls += 1;
        },
        cancel() {
          cancelCalls += 1;
        }
      })
    });

    const scope = createScope({
      root: {
        querySelectorAll() {
          return ['scoped-node'];
        }
      }
    });

    scope.add(() => {
      animate('.scoped-selector', {
        opacity: [0, 1],
        duration: 100
      });
    });

    scope.revert();

    assert.equal(stopCalls, 1);
    assert.equal(cancelCalls, 1);
  });
});
