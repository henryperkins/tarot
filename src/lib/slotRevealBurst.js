/**
 * Geometry for the CSS slot reveal burst.
 *
 * Kept free of DOM access so the spark fan can be verified directly, and free of
 * randomness so a reveal never renders two different bursts.
 */

export const SLOT_REVEAL_SPARK_COUNT = 10;

// Cycled so neighbouring sparks reach different depths; one shared reach reads
// as an expanding ring rather than a burst.
const SPARK_REACH_CYCLE_PX = [44, 32, 38, 50];

/**
 * @returns {Array<{ angle: number, distance: number }>} angle in degrees,
 * distance in px, one entry per spark, fanned evenly around the slot.
 */
export function getSlotRevealSparks() {
  const step = 360 / SLOT_REVEAL_SPARK_COUNT;
  return Array.from({ length: SLOT_REVEAL_SPARK_COUNT }, (_, index) => ({
    angle: index * step,
    distance: SPARK_REACH_CYCLE_PX[index % SPARK_REACH_CYCLE_PX.length]
  }));
}
