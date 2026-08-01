import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  SLOT_REVEAL_SPARK_COUNT,
  getSlotRevealSparks
} from '../src/lib/slotRevealBurst.js';

describe('getSlotRevealSparks', () => {
  test('emits a small fixed number of sparks', () => {
    assert.ok(
      SLOT_REVEAL_SPARK_COUNT >= 6 && SLOT_REVEAL_SPARK_COUNT <= 16,
      `expected a small fixed spark count, got ${SLOT_REVEAL_SPARK_COUNT}`
    );
    assert.equal(getSlotRevealSparks().length, SLOT_REVEAL_SPARK_COUNT);
  });

  test('fans the sparks evenly around the full circle', () => {
    const sparks = getSlotRevealSparks();
    const step = 360 / SLOT_REVEAL_SPARK_COUNT;

    assert.deepEqual(
      sparks.map((spark) => spark.angle),
      Array.from({ length: SLOT_REVEAL_SPARK_COUNT }, (_, index) => index * step)
    );
  });

  test('throws every spark outward at a varied reach', () => {
    const distances = getSlotRevealSparks().map((spark) => spark.distance);

    distances.forEach((distance, index) => {
      assert.ok(distance > 0, `spark ${index} must travel outward, got ${distance}`);
    });
    assert.ok(
      new Set(distances).size > 1,
      'sparks must not all share one reach, or the burst reads as a ring'
    );
  });

  test('is deterministic so a reveal never renders two different bursts', () => {
    assert.deepEqual(getSlotRevealSparks(), getSlotRevealSparks());
  });
});
