import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { entryHasReversal, isReversedCard } from '../src/lib/journal/utils.js';

describe('journal reversal filter', () => {
  it('recognises orientation and legacy isReversed cards', () => {
    assert.equal(isReversedCard({ orientation: 'Reversed' }), true);
    assert.equal(isReversedCard({ isReversed: true }), true);
    assert.equal(isReversedCard({ orientation: 'Upright', isReversed: false }), false);
    assert.equal(isReversedCard({ isReversed: false }), false);
    assert.equal(isReversedCard(null), false);
  });

  it('matches entries with any reversed card, including legacy entries', () => {
    assert.equal(entryHasReversal({ cards: [{ name: 'The Tower', isReversed: true }] }), true);
    assert.equal(entryHasReversal({ cards: [{ name: 'The Sun', orientation: 'Upright' }, { name: 'The Moon', orientation: 'reversed' }] }), true);
    assert.equal(entryHasReversal({ cards: [{ name: 'The Star', isReversed: false }] }), false);
    assert.equal(entryHasReversal({}), false);
  });
});
