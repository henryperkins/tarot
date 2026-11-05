import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KNOCKS_NEEDED,
  clampCut,
  cutAtPosition,
  cutRange,
  cutValueText,
  knockLabel,
  ritualStatus
} from '../src/lib/tableRitual.js';

test('the deck face names the knock it will make, then that all three are made', () => {
  assert.equal(KNOCKS_NEEDED, 3);
  assert.equal(knockLabel(0), 'Knock on the deck, 1 of 3');
  assert.equal(knockLabel(1), 'Knock on the deck, 2 of 3');
  assert.equal(knockLabel(2), 'Knock on the deck, 3 of 3');
  assert.equal(knockLabel(3), 'Knocked three times');
  // Restored or malformed counts stay inside the ritual's own range.
  assert.equal(knockLabel(7), 'Knocked three times');
  assert.equal(knockLabel(-1), 'Knock on the deck, 1 of 3');
  assert.equal(knockLabel(undefined), 'Knock on the deck, 1 of 3');
});

test('a cut falls after the first card and before the last, for either deck size', () => {
  assert.deepEqual(cutRange(78), { min: 1, max: 77, size: 78 });
  assert.deepEqual(cutRange(22), { min: 1, max: 21, size: 22 });
  assert.deepEqual(cutRange(undefined), { min: 1, max: 77, size: 78 });
  assert.equal(clampCut(0, 78), 1);
  assert.equal(clampCut(78, 78), 77);
  assert.equal(clampCut(30, 22), 21);
  assert.equal(clampCut(12.4, 22), 12);
  // A missing value starts in the middle, as the deck does.
  assert.equal(clampCut(NaN, 78), 39);
  assert.equal(clampCut(NaN, 22), 11);
});

test('a point along the edge names the cut beneath it', () => {
  const rect = { left: 100, width: 390 };
  assert.equal(cutAtPosition(100 + 195, rect, 78), 39);
  assert.equal(cutAtPosition(100 + 117, rect, 78), 23);
  // Past either end the cut stays inside the deck.
  assert.equal(cutAtPosition(40, rect, 78), 1);
  assert.equal(cutAtPosition(900, rect, 78), 77);
  assert.equal(cutAtPosition(100 + 195, rect, 22), 11);
  // An edge that has not been laid out yet falls back to the middle.
  assert.equal(cutAtPosition(150, { left: 0, width: 0 }, 78), 39);
  assert.equal(cutAtPosition(150, null, 22), 11);
});

test('the spoken value and the status line say where the deck is cut', () => {
  assert.equal(cutValueText(39, 78), 'Card 39 of 78');
  assert.equal(cutValueText(99, 22), 'Card 21 of 22');
  assert.equal(ritualStatus({ knockCount: 0, hasCut: false, cutIndex: 39, deckSize: 78 }), '');
  assert.equal(ritualStatus({ knockCount: 1, deckSize: 78 }), 'Knocked once.');
  assert.equal(ritualStatus({ knockCount: 2, deckSize: 78 }), 'Knocked twice.');
  assert.equal(ritualStatus({ knockCount: 3, hasCut: true, cutIndex: 26, deckSize: 78 }), 'Knocked three times. Cut at card 26 of 78.');
  assert.equal(ritualStatus({ hasCut: true, cutIndex: 11, deckSize: 22 }), 'Cut at card 11 of 22.');
  assert.equal(ritualStatus(), '');
});
