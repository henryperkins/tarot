import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getSpreadTableContainerPresentation } from '../src/lib/spreadTablePresentation.js';

describe('getSpreadTableContainerPresentation', () => {
  test('returns minimal container when cardsOnly is enabled', () => {
    const presentation = getSpreadTableContainerPresentation({
      cardsOnly: true,
      compact: false,
      aspectRatio: '4/3'
    });

    assert.equal(presentation.className, 'spread-table relative w-full');
    assert.deepEqual(presentation.style, { aspectRatio: '4/3' });
  });

  test('returns panel styling when cardsOnly is disabled', () => {
    const presentation = getSpreadTableContainerPresentation({
      cardsOnly: false,
      compact: false,
      aspectRatio: '3/2'
    });

    assert.match(presentation.className, /\bspread-table\b/);
    assert.match(presentation.className, /\bpanel-mystic\b/);
    assert.match(presentation.className, /\bp-4 sm:p-6\b/);
    assert.equal(presentation.style.aspectRatio, '3/2');
    assert.equal(presentation.style.borderColor, 'var(--border-warm)');
    assert.ok(presentation.style.background.includes('radial-gradient'));
    assert.ok(presentation.style.boxShadow.includes('rgba(0, 0, 0, 0.8)'));
  });

  test('uses compact padding class when compact mode is enabled', () => {
    const presentation = getSpreadTableContainerPresentation({
      cardsOnly: false,
      compact: true,
      aspectRatio: '3/2'
    });

    assert.match(presentation.className, /\bp-3\b/);
    assert.doesNotMatch(presentation.className, /\bp-4 sm:p-6\b/);
  });
});
