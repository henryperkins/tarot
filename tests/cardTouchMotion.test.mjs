import assert from 'node:assert/strict';
import { describe, test, mock } from 'node:test';
import {
  createHold,
  createTraceEngine,
  frameRatio,
  lensFor,
  TRACE_HOLD_MS,
  TRACE_MIN_MS,
  TRACE_PIN_MS
} from '../src/components/reading/narrative/cardTouchMotion.js';

const percent = (value) => Number.parseFloat(value) / 100;

describe('leaning in on a detail', () => {
  test('rests when nothing is described', () => {
    assert.equal(lensFor([]), null);
  });

  test('reads each deck frame', () => {
    assert.equal(frameRatio('100 / 172'), 1.72);
    assert.equal(frameRatio('16 / 31'), 31 / 16);
    assert.equal(frameRatio(undefined), 1.72);
  });

  test('frames a small detail without leaving the card behind', () => {
    const lens = lensFor([[0.5, 0.5, 0.04]]);
    assert.equal(lens.zoom, 1.9);
    assert.equal(percent(lens.tx), 0);
    assert.equal(percent(lens.ty), 0);
  });

  test('leans in gently on a large detail', () => {
    const lens = lensFor([[0.5, 0.45, 0.3]]);
    assert.ok(lens.zoom >= 1.3 && lens.zoom < 1.9, `zoom ${lens.zoom}`);
  });

  test('keeps the picture covering the frame near an edge', () => {
    for (const spot of [[0.02, 0.02, 0.05], [0.98, 0.98, 0.05], [0.9, 0.1, 0.08]]) {
      const lens = lensFor([spot]);
      const room = (lens.zoom - 1) / 2 + 1e-9;
      assert.ok(Math.abs(percent(lens.tx)) <= room, `x stays covered for ${spot}`);
      assert.ok(Math.abs(percent(lens.ty)) <= room, `y stays covered for ${spot}`);
    }
  });

  test('stays on the painting rather than the title band', () => {
    const lens = lensFor([[0.5, 0.95, 0.05]]);
    // The bottom of the view window, in card fractions, ends above the title.
    const viewCenter = 0.5 - percent(lens.ty) / lens.zoom;
    assert.ok(viewCenter + 0.5 / lens.zoom <= 0.905 + 1e-6, `view ends at ${viewCenter + 0.5 / lens.zoom}`);
  });

  test('frames two details together', () => {
    const one = lensFor([[0.3, 0.6, 0.05]]);
    const both = lensFor([[0.3, 0.6, 0.05], [0.7, 0.6, 0.05]]);
    assert.ok(both.zoom < one.zoom);
    assert.equal(percent(both.tx), 0);
  });
});

describe('pacing gestures', () => {
  function engine() {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const shown = [];
    const traces = createTraceEngine((trace) => shown.push(trace), () => Date.now());
    const last = () => shown[shown.length - 1];
    const points = () => (last() ? `${last().card}:${last().points.join('+')}` : null);
    return { traces, shown, last, points };
  }

  test('shows the first detail at once and lets the card rest after a while', () => {
    const { traces, points } = engine();
    try {
      traces.reach({ card: 2, points: ['pool'] });
      assert.equal(points(), '2:pool');
      mock.timers.tick(TRACE_HOLD_MS);
      assert.equal(points(), null);
    } finally {
      mock.timers.reset();
    }
  });

  test('gives each detail its moment before the next', () => {
    const { traces, points } = engine();
    try {
      traces.reach({ card: 1, points: ['lightning'] });
      mock.timers.tick(600);
      traces.reach({ card: 2, points: ['pool'] });
      assert.equal(points(), '1:lightning');
      mock.timers.tick(TRACE_MIN_MS - 600);
      assert.equal(points(), '2:pool');
    } finally {
      mock.timers.reset();
    }
  });

  test('frames details of one card reached together', () => {
    const { traces, points } = engine();
    try {
      traces.reach({ card: 2, points: ['pool'] });
      traces.reach({ card: 2, points: ['pitchers'] });
      assert.equal(points(), '2:pool+pitchers');
      traces.reach({ card: 2, points: ['land'] });
      assert.equal(points(), '2:pool+pitchers');
      mock.timers.tick(TRACE_MIN_MS);
      assert.equal(points(), '2:land');
    } finally {
      mock.timers.reset();
    }
  });

  test('keeps only the latest details when the reader moves quickly', () => {
    const { traces, shown } = engine();
    try {
      traces.reach({ card: 0, points: ['children'] });
      mock.timers.tick(TRACE_TOGETHER_MS_PLUS);
      for (const point of ['tower', 'crown', 'lightning']) traces.reach({ card: 1, points: [point] });
      mock.timers.tick(TRACE_MIN_MS);
      mock.timers.tick(TRACE_MIN_MS);
      const seen = shown.filter(Boolean).map((trace) => trace.points.join('+'));
      assert.deepEqual(seen, ['children', 'crown', 'lightning']);
    } finally {
      mock.timers.reset();
    }
  });

  test('lets a tapped detail jump the queue and stay a little longer', () => {
    const { traces, points } = engine();
    try {
      traces.reach({ card: 1, points: ['tower'] });
      traces.reach({ card: 2, points: ['pool'] });
      traces.inspect({ card: 0, points: ['children'] });
      assert.equal(points(), '0:children');
      mock.timers.tick(TRACE_HOLD_MS);
      assert.equal(points(), '0:children');
      mock.timers.tick(TRACE_PIN_MS - TRACE_HOLD_MS);
      assert.equal(points(), null);
    } finally {
      mock.timers.reset();
    }
  });

  test('releases a held detail only when it was asked for', () => {
    const { traces, points } = engine();
    try {
      traces.reach({ card: 1, points: ['tower'] });
      traces.release();
      assert.equal(points(), '1:tower');
      traces.inspect({ card: 1, points: ['crown'] });
      traces.release();
      assert.equal(points(), null);
    } finally {
      mock.timers.reset();
    }
  });

  test('ignores details without a card or a point', () => {
    const { traces, shown } = engine();
    try {
      traces.reach({ card: null, points: ['pool'] });
      traces.reach({ card: 1, points: [] });
      assert.deepEqual(shown, []);
    } finally {
      mock.timers.reset();
    }
  });
});

describe('holding the querent\'s words', () => {
  test('lights a note for a while, then lets it go', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const shown = [];
      const hold = createHold((value) => shown.push(value), 5000);
      hold.show({ card: 2 });
      mock.timers.tick(4000);
      hold.show({ card: 2, again: true });
      mock.timers.tick(4000);
      assert.deepEqual(shown, [{ card: 2 }, { card: 2, again: true }]);
      mock.timers.tick(1000);
      assert.deepEqual(shown.at(-1), null);
      hold.clear();
      assert.equal(shown.at(-1), null);
    } finally {
      mock.timers.reset();
    }
  });
});

// Long enough that the next detail is not "reached together" with the first.
const TRACE_TOGETHER_MS_PLUS = 500;
