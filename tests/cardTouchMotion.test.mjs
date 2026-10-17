import assert from 'node:assert/strict';
import { describe, test, mock } from 'node:test';
import {
  createHold,
  createTraceEngine,
  frameRatio,
  lensFor,
  TRACE_HOLD_MS,
  TRACE_TURN_MS
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
  // Words in the reading; `visible` says whether they are on screen.
  const words = (visible = true) => ({ visible });
  // One turn at a time: a timer set while another runs fires on a later tick.
  const turns = (count) => {
    for (let index = 0; index < count; index += 1) mock.timers.tick(TRACE_TURN_MS);
  };

  function engine() {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    const shown = [];
    const traces = createTraceEngine((trace) => shown.push(trace), {
      now: () => Date.now(),
      isVisible: (element) => element.visible
    });
    const last = () => shown[shown.length - 1];
    const points = () => (last() ? `${last().card}:${last().points.join('+')}` : null);
    const seen = () => shown.filter(Boolean).map((trace) => trace.points.join('+'));
    return { traces, shown, last, points, seen };
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

  test('gives each detail its full turn before the next', () => {
    const { traces, points } = engine();
    try {
      assert.equal(TRACE_TURN_MS, 1800);
      traces.reach({ card: 1, points: ['lightning'] });
      mock.timers.tick(600);
      traces.reach({ card: 2, points: ['pool'] });
      assert.equal(points(), '1:lightning');
      mock.timers.tick(TRACE_TURN_MS - 601);
      assert.equal(points(), '1:lightning');
      mock.timers.tick(1);
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
      mock.timers.tick(TRACE_TURN_MS);
      assert.equal(points(), '2:land');
    } finally {
      mock.timers.reset();
    }
  });

  test('plays every detail still on screen, in reading order', () => {
    const { traces, seen } = engine();
    try {
      traces.reach({ card: 0, points: ['children'], element: words() });
      mock.timers.tick(TRACE_TOGETHER_MS_PLUS);
      for (const point of ['tower', 'crown', 'lightning']) traces.reach({ card: 1, points: [point], element: words() });
      turns(3);
      assert.deepEqual(seen(), ['children', 'tower', 'crown', 'lightning']);
    } finally {
      mock.timers.reset();
    }
  });

  test('skips details the reader has scrolled past before their turn', () => {
    const { traces, seen } = engine();
    try {
      const crown = words();
      traces.reach({ card: 0, points: ['children'], element: words() });
      mock.timers.tick(TRACE_TOGETHER_MS_PLUS);
      traces.reach({ card: 1, points: ['tower'], element: words() });
      traces.reach({ card: 1, points: ['crown'], element: crown });
      traces.reach({ card: 2, points: ['pool'], element: words() });
      crown.visible = false;
      turns(3);
      assert.deepEqual(seen(), ['children', 'tower', 'pool']);
      // Nothing is reached from off screen either.
      traces.reach({ card: 2, points: ['star'], element: words(false) });
      assert.deepEqual(seen(), ['children', 'tower', 'pool']);
    } finally {
      mock.timers.reset();
    }
  });

  test('shows a pointed-at detail while it lasts, then resumes in order', () => {
    const { traces, points } = engine();
    try {
      traces.reach({ card: 1, points: ['tower'] });
      traces.reach({ card: 2, points: ['pool'] });
      mock.timers.tick(100);
      traces.inspect({ card: 0, points: ['children'] });
      assert.equal(points(), '0:children');
      mock.timers.tick(TRACE_HOLD_MS * 4);
      assert.equal(points(), '0:children');
      traces.release();
      assert.equal(points(), '1:tower');
      mock.timers.tick(TRACE_TURN_MS - 101);
      assert.equal(points(), '1:tower');
      mock.timers.tick(1);
      assert.equal(points(), '2:pool');
    } finally {
      mock.timers.reset();
    }
  });

  test('split-format fragments share one turn and all clear on suspension and completion', () => {
    const { traces, points } = engine();
    const fragment = () => {
      const attrs = new Map();
      return {
        visible: true, isConnected: true,
        setAttribute: (key, value) => attrs.set(key, value),
        getAttribute: key => attrs.get(key),
        hasAttribute: key => attrs.has(key),
        removeAttribute: key => attrs.delete(key)
      };
    };
    try {
      const first = fragment();
      const second = fragment();
      const detail = { key: 'split', card: 0, points: ['pitchers'] };
      traces.reach({ ...detail, element: first });
      traces.reach({ ...detail, element: second });
      assert.equal(first.getAttribute('data-tracing'), 'true');
      assert.equal(second.getAttribute('data-tracing'), 'true');
      traces.setSuspended(true);
      assert.equal(first.hasAttribute('data-tracing'), false);
      assert.equal(second.hasAttribute('data-tracing'), false);
      // A partially visible phrase waits until all its fragments are readable.
      second.visible = false;
      traces.setSuspended(false);
      assert.equal(points(), null);
      traces.clear();
      second.visible = true;
      traces.reach({ ...detail, element: first });
      traces.reach({ ...detail, element: second });
      mock.timers.tick(TRACE_HOLD_MS);
      assert.equal(first.hasAttribute('data-tracing'), false);
      assert.equal(second.hasAttribute('data-tracing'), false);
    } finally { mock.timers.reset(); }
  });

  test('a passive preview resumes only automatic words still visible', () => {
    const { traces, points } = engine();
    try {
      const original = words();
      traces.reach({ key: 'one', card: 0, points: ['star'], element: original });
      traces.reach({ key: 'two', card: 1, points: ['pool'], element: words() });
      mock.timers.tick(100);
      traces.inspect({ card: 2, points: ['land'] });
      original.visible = false;
      traces.release();
      assert.equal(points(), '1:pool');
    } finally { mock.timers.reset(); }
  });

  test('a visible member of a combined turn resumes when its partner leaves view', () => {
    const { traces, points } = engine();
    try {
      const gone = words();
      traces.reach({ key: 'pool', card: 0, points: ['pool'], element: gone });
      traces.reach({ key: 'pitchers', card: 0, points: ['pitchers'], element: words() });
      traces.reach({ key: 'next', card: 1, points: ['land'], element: words() });
      mock.timers.tick(100);
      traces.inspect({ card: 2, points: ['star'] });
      gone.visible = false;
      traces.release();
      assert.equal(points(), '0:pitchers');
      mock.timers.tick(TRACE_TURN_MS - 101);
      assert.equal(points(), '0:pitchers');
      mock.timers.tick(1);
      assert.equal(points(), '1:land');
    } finally { mock.timers.reset(); }
  });

  test('holds a chosen detail until the reader lets it go', () => {
    const { traces, last, points } = engine();
    try {
      const pitchers = words();
      assert.equal(traces.hold({ card: 2, points: ['pitchers'], element: pitchers, place: 'bottom' }), true);
      assert.equal(last().held, true);
      assert.equal(last().place, 'bottom');
      mock.timers.tick(60000);
      assert.equal(points(), '2:pitchers');
      // Pointing elsewhere, or pointing ending, does not take it away.
      traces.inspect({ card: 1, points: ['crown'] });
      traces.release();
      traces.reach({ card: 1, points: ['tower'] });
      assert.equal(points(), '2:pitchers');
      // Choosing it again lets it go; waiting details resume.
      assert.equal(traces.hold({ card: 2, points: ['pitchers'] }), false);
      assert.equal(points(), '1:tower');
    } finally {
      mock.timers.reset();
    }
  });

  test('lets a held detail go on request or when its words leave the screen', () => {
    const { traces, points } = engine();
    try {
      traces.hold({ card: 2, points: ['pool'] });
      traces.unhold();
      assert.equal(points(), null);
      const pool = words();
      traces.hold({ card: 2, points: ['pool'], element: pool });
      traces.check();
      assert.equal(points(), '2:pool');
      pool.visible = false;
      traces.check();
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
      assert.equal(traces.hold({ card: 1 }), false);
      assert.deepEqual(shown, []);
    } finally {
      mock.timers.reset();
    }
  });

  test('occurrences play once across replacement nodes; repeated mentions each get a turn', () => {
    const { traces, shown, points } = engine();
    try {
      traces.reach({ key: 'one', card: 1, points: ['pool'], element: words(false) });
      assert.equal(shown.length, 0);
      traces.reach({ key: 'one', card: 1, points: ['pool'], element: words() });
      mock.timers.tick(500);
      traces.reach({ key: 'two', card: 1, points: ['pool'], element: words() });
      mock.timers.tick(1300);
      assert.equal(shown.filter(Boolean).length, 2);
      mock.timers.tick(TRACE_HOLD_MS);
      traces.reach({ key: 'one', card: 1, points: ['pool'], element: words() });
      assert.equal(points(), null);
      traces.clear();
      traces.reach({ key: 'one', card: 1, points: ['pool'], element: words() });
      assert.equal(points(), '1:pool');
    } finally { mock.timers.reset(); }
  });

  test('a paused occurrence rebinds its replacement before inspection closes', () => {
    const { traces, points } = engine();
    try {
      const original = words();
      traces.reach({ key: 'one', card: 0, points: ['star'], element: original });
      traces.setSuspended(true);
      original.visible = false;
      traces.reach({ key: 'one', card: 0, points: ['star'], element: words() });
      traces.setSuspended(false);
      assert.equal(points(), '0:star');
    } finally { mock.timers.reset(); }
  });

  test('inspection suspends playback and resumes only visible waiting occurrences', () => {
    const { traces, points } = engine();
    try {
      const gone = words();
      traces.reach({ key: 'one', card: 0, points: ['star'], element: words() });
      traces.reach({ key: 'two', card: 1, points: ['pool'], element: gone });
      traces.setSuspended(true);
      traces.reach({ key: 'three', card: 2, points: ['land'], element: words() });
      gone.visible = false;
      mock.timers.tick(10000);
      assert.equal(points(), null);
      traces.setSuspended(false);
      assert.equal(points(), '0:star');
      turns(1);
      assert.equal(points(), '2:land');
    } finally { mock.timers.reset(); }
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
