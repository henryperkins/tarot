import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CARD_ASPECT,
  COMPACT_SPREAD_LAYOUTS,
  SPREAD_LAYOUTS,
  getMaxCardWidth,
  getSpreadLayout
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

describe('handset Celtic layout', () => {
  // The handset spread board is square; 334px is the measured board width at a
  // 390px viewport.
  const HANDSET_BOUNDS = { width: 334, height: 334 };
  const DESKTOP_CELTIC_HANDSET_BOUNDS = { width: 334, height: 334 / 1.2 };

  test('substitutes the compact layout only for Celtic on a handset', () => {
    assert.equal(getSpreadLayout('celtic'), SPREAD_LAYOUTS.celtic);
    assert.equal(getSpreadLayout('celtic', { isHandset: false }), SPREAD_LAYOUTS.celtic);
    assert.equal(getSpreadLayout('celtic', { isHandset: true }), COMPACT_SPREAD_LAYOUTS.celtic);
    assert.equal(getSpreadLayout('fiveCard', { isHandset: true }), SPREAD_LAYOUTS.fiveCard);
    assert.equal(getSpreadLayout('single', { isHandset: true }), SPREAD_LAYOUTS.single);
  });

  test('keeps Celtic position order and the single crossing overlap', () => {
    assert.deepEqual(
      COMPACT_SPREAD_LAYOUTS.celtic.positions.map((position) => position.label),
      SPREAD_LAYOUTS.celtic.positions.map((position) => position.label)
    );
    assert.deepEqual(COMPACT_SPREAD_LAYOUTS.celtic.allowOverlap, [[0, 1]]);
  });

  test('arranges the cross as a plus with the crossing card quarter-turned', () => {
    const [present, challenge, past, nearFuture, conscious, subconscious] =
      COMPACT_SPREAD_LAYOUTS.celtic.positions;

    assert.equal(challenge.x, present.x);
    assert.equal(conscious.x, present.x);
    assert.equal(subconscious.x, present.x);
    assert.ok(past.x < present.x, 'Past sits left of Present');
    assert.ok(nearFuture.x > present.x, 'Near Future sits right of Present');

    assert.equal(challenge.y, present.y);
    assert.equal(past.y, present.y);
    assert.equal(nearFuture.y, present.y);
    assert.ok(conscious.y < present.y, 'Conscious sits above Present');
    assert.ok(subconscious.y > present.y, 'Subconscious sits below Present');

    assert.equal(challenge.rotate, 90);
  });

  test('lays the staff out as one horizontal row beneath the cross', () => {
    const positions = COMPACT_SPREAD_LAYOUTS.celtic.positions;
    const cross = positions.slice(0, 6);
    const staff = positions.slice(6);

    assert.equal(staff.length, 4);
    assert.deepEqual([...new Set(staff.map((position) => position.y))], [staff[0].y]);
    assert.ok(
      staff[0].y > Math.max(...cross.map((position) => position.y)),
      'the staff row sits below every cross position'
    );
    assert.deepEqual(
      staff.map((position) => position.x),
      [...staff.map((position) => position.x)].sort((left, right) => left - right)
    );
  });

  test('fits a card a sixth of the square handset board without unintended overlap', () => {
    const width = getMaxCardWidth(
      COMPACT_SPREAD_LAYOUTS.celtic.positions,
      HANDSET_BOUNDS,
      COMPACT_SPREAD_LAYOUTS.celtic.allowOverlap
    );

    assertCloseTo(width, HANDSET_BOUNDS.height / 6, 0.001);
  });

  test('fits a materially larger card than the desktop Celtic layout does on a handset', () => {
    const compactWidth = getMaxCardWidth(
      COMPACT_SPREAD_LAYOUTS.celtic.positions,
      HANDSET_BOUNDS,
      COMPACT_SPREAD_LAYOUTS.celtic.allowOverlap
    );
    const desktopWidth = getMaxCardWidth(
      SPREAD_LAYOUTS.celtic.positions,
      DESKTOP_CELTIC_HANDSET_BOUNDS,
      SPREAD_LAYOUTS.celtic.allowOverlap
    );

    assert.ok(
      compactWidth >= desktopWidth * 1.2,
      `expected compact width ${compactWidth} to be at least 20% above desktop width ${desktopWidth}`
    );
  });
});
