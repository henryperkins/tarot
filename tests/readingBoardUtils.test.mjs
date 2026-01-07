import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getNextUnrevealedIndex, getPositionLabel } from '../src/components/readingBoardUtils.js';

describe('readingBoardUtils', () => {

  it('returns a fallback label when no spread positions exist', () => {
    const label = getPositionLabel(null, 2);
    assert.equal(label, 'Position 3');
  });

  it('returns the short position label before the dash', () => {
    const spreadInfo = { positions: ['Past \u2014 Influence', 'Present \u2014 Context'] };
    const label = getPositionLabel(spreadInfo, 0);
    assert.equal(label, 'Past');
  });

  it('finds the next unrevealed index', () => {
    const reading = [{}, {}, {}];
    const revealed = new Set([0, 2]);
    assert.equal(getNextUnrevealedIndex(reading, revealed), 1);
  });

  it('returns -1 when all cards are revealed', () => {
    const reading = [{}, {}];
    const revealed = new Set([0, 1]);
    assert.equal(getNextUnrevealedIndex(reading, revealed), -1);
  });
});
