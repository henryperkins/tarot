import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as readingBoardUtils from '../src/components/readingBoardUtils.js';

const {
  getDealtReading,
  getNextDealIndex,
  getNextTurnIndex,
  getNextUnrevealedIndex,
  getPositionLabel
} = readingBoardUtils;

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

  it('keeps undealt cards out of the spread while preserving slot order', () => {
    assert.equal(typeof getDealtReading, 'function');
    const reading = [{ id: 'moon' }, { id: 'star' }, { id: 'sun' }];

    assert.deepEqual(getDealtReading(reading, 1), [reading[0], null, null]);
    assert.deepEqual(reading, [{ id: 'moon' }, { id: 'star' }, { id: 'sun' }]);
  });

  it('advances one deal at a time and stops at the end of the spread', () => {
    assert.equal(typeof getNextDealIndex, 'function');
    const reading = [{}, {}, {}];

    assert.equal(getNextDealIndex(reading, 0), 1);
    assert.equal(getNextDealIndex(reading, 2), 3);
    assert.equal(getNextDealIndex(reading, 3), 3);
  });

  it('does not turn a card until the whole spread has been dealt', () => {
    assert.equal(typeof getNextTurnIndex, 'function');
    const reading = [{}, {}, {}];

    assert.equal(getNextTurnIndex(reading, new Set(), 2), -1);
    assert.equal(getNextTurnIndex(reading, new Set(), 3), 0);
    assert.equal(getNextTurnIndex(reading, new Set([0]), 3), 1);
  });
});
