import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as board from '../src/components/readingBoardUtils.js';

describe('reading table primary action', () => {
  const positions = ['Past — what brought you here', 'Present — current influences', 'Future — possibilities'];
  it('requires a face-down deal before any reveal', () => {
    assert.deepEqual(board.getReadingTableAction?.({ isSpreadDealt: false, revealedCards: new Set(), totalCards: 3, positions }), {
      phase: 'deal', label: 'Deal spread', nextIndex: -1
    });
  });
  it('finds the next hidden position after an out-of-order reveal', () => {
    assert.deepEqual(board.getReadingTableAction?.({ isSpreadDealt: true, revealedCards: new Set([1]), totalCards: 3, positions }), {
      phase: 'reveal', label: 'Reveal next: Past', nextIndex: 0
    });
  });
  it('offers the narrative only after every position is revealed', () => {
    assert.deepEqual(board.getReadingTableAction?.({ isSpreadDealt: true, revealedCards: new Set([0, 1, 2]), totalCards: 3, positions }), {
      phase: 'narrative', label: 'Create narrative', nextIndex: -1
    });
  });
  it('does not offer an action without cards', () => {
    assert.equal(board.getReadingTableAction?.({ isSpreadDealt: false, revealedCards: new Set(), totalCards: 0, positions }), null);
  });
});
