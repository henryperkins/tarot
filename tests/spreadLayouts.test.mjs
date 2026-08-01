import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CARD_ASPECT,
  SPREAD_LAYOUTS,
  getMaxCardWidth
} from '../src/lib/spreadLayouts.js';

const assertCloseTo = (actual, expected, tolerance = 0.0001) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

describe('getMaxCardWidth', () => {
  test('uses the nearest horizontal or vertical board edge', () => {
    const width = getMaxCardWidth(
      [{ x: 50, y: 50 }],
      { width: 300, height: 200 }
    );

    assertCloseTo(width, 133.333333);
  });

  test('includes position offsets in edge constraints', () => {
    const width = getMaxCardWidth(
      [{ x: 10, y: 50, offsetX: 5 }],
      { width: 200, height: 200 }
    );

    assertCloseTo(width, 60);
  });

  test('separates a horizontally adjacent pair', () => {
    const width = getMaxCardWidth(
      [{ x: 40, y: 50 }, { x: 60, y: 50 }],
      { width: 300, height: 300 }
    );

    assertCloseTo(width, 60);
  });

  test('uses the separating axis that permits the larger non-overlapping card', () => {
    const width = getMaxCardWidth(
      [{ x: 45, y: 40 }, { x: 55, y: 60 }],
      { width: 300, height: 300 }
    );

    assertCloseTo(width, 40);
  });

  test('does not constrain an explicitly allowed overlapping pair', () => {
    const width = getMaxCardWidth(
      [{ x: 50, y: 50 }, { x: 50, y: 50 }],
      { width: 300, height: 200 },
      [[0, 1]]
    );

    assertCloseTo(width, 133.333333);
  });

  test('constrains the same coincident pair when it is not allow-listed', () => {
    const width = getMaxCardWidth(
      [{ x: 50, y: 50 }, { x: 50, y: 50 }],
      { width: 300, height: 200 }
    );

    assert.equal(width, 0);
  });

  test('folds a quarter-turn into horizontal card extent', () => {
    const width = getMaxCardWidth(
      [{ x: 45, y: 50, rotate: 90 }, { x: 55, y: 50 }],
      { width: 1000, height: 1000 }
    );

    assertCloseTo(width, 80);
  });

  test('folds scale into pair separation', () => {
    const width = getMaxCardWidth(
      [{ x: 35, y: 50, scale: 2 }, { x: 65, y: 50 }],
      { width: 500, height: 500 }
    );

    assertCloseTo(width, 100);
  });

  test('returns null for empty layouts and unusable bounds', () => {
    assert.equal(getMaxCardWidth([], { width: 300, height: 200 }), null);
    assert.equal(getMaxCardWidth([{ x: 50, y: 50 }], { width: 0, height: 200 }), null);
  });

  test('clamps out-of-bounds positions without returning a negative dimension', () => {
    const width = getMaxCardWidth(
      [{ x: 150, y: 50, scale: -2, rotate: Number.NaN }],
      { width: 300, height: 200 }
    );

    assert.equal(width, 0);
  });
});

test('exports the card aspect used by spread geometry', () => {
  assert.equal(CARD_ASPECT, 2 / 3);
});

test('declares only the Celtic crossing pair as intentionally overlapping', () => {
  assert.deepEqual(SPREAD_LAYOUTS.celtic.allowOverlap, [[0, 1]]);
  assert.deepEqual(
    Object.entries(SPREAD_LAYOUTS)
      .filter(([key]) => key !== 'celtic')
      .flatMap(([, layout]) => layout.allowOverlap || []),
    []
  );
});
