import assert from 'node:assert/strict';
import { test } from 'node:test';

import { separateLabelBoxes } from '../src/components/charts/labelSeparation.js';

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

test('overlapping names are moved until their boxes no longer intersect', () => {
  const boxes = [
    { x: 10, y: 10, w: 70, h: 18 },
    { x: 40, y: 16, w: 90, h: 18 },
    { x: 200, y: 10, w: 40, h: 18 }
  ];
  const shifts = separateLabelBoxes(boxes);
  const placed = boxes.map((box, index) => ({
    x: box.x + shifts[index].x,
    y: box.y + shifts[index].y,
    w: box.w,
    h: box.h
  }));
  assert.equal(overlaps(placed[0], placed[1]), false);
  assert.equal(overlaps(placed[0], placed[2]), false);
  assert.equal(overlaps(placed[1], placed[2]), false);
  assert.deepEqual(shifts[2], { x: 0, y: 0 });
});
