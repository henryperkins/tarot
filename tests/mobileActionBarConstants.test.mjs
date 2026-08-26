import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as mobileActionBarConstants from '../src/components/mobileActionBarConstants.js';

describe('mobile action mode', () => {
  it('offers only the deal action until every card reaches the spread', () => {
    assert.equal(typeof mobileActionBarConstants.getActionMode, 'function');

    const mode = mobileActionBarConstants.getActionMode({
      isShuffling: false,
      reading: [{}, {}, {}],
      dealIndex: 2,
      allRevealed: false,
      needsNarrative: false,
      hasNarrative: false,
      isGenerating: false,
      isError: false
    });

    assert.equal(mode, 'dealing');
  });

  it('switches from dealing to turning only after the spread is full', () => {
    assert.equal(typeof mobileActionBarConstants.getActionMode, 'function');

    const mode = mobileActionBarConstants.getActionMode({
      isShuffling: false,
      reading: [{}, {}, {}],
      dealIndex: 3,
      allRevealed: false,
      needsNarrative: false,
      hasNarrative: false,
      isGenerating: false,
      isError: false
    });

    assert.equal(mode, 'revealing');
  });
});
