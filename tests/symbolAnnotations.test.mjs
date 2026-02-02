// tests/symbolAnnotations.test.mjs
// Coverage tests for symbol annotations across the full 78-card deck.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SYMBOL_ANNOTATIONS } from '../shared/symbols/symbolAnnotations.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

const MINOR_INDEX_RULES = {
  Wands: (rankValue) => (rankValue <= 10 ? 21 + rankValue : 63 + rankValue),
  Cups: (rankValue) => 31 + rankValue,
  Swords: (rankValue) => 45 + rankValue,
  Pentacles: (rankValue) => 59 + rankValue
};

describe('symbol annotations coverage', () => {
  it('covers all 78 cards with contiguous indices', () => {
    const keys = Object.keys(SYMBOL_ANNOTATIONS).map((key) => Number(key));
    const uniqueKeys = new Set(keys);

    assert.strictEqual(uniqueKeys.size, 78, 'SYMBOL_ANNOTATIONS should cover 78 unique card indices');

    const missing = [];
    for (let i = 0; i < 78; i += 1) {
      if (!uniqueKeys.has(i)) {
        missing.push(i);
      }
    }

    assert.deepStrictEqual(missing, [], `Missing symbol annotations for indices: ${missing.join(', ')}`);
  });

  it('aligns with major arcana numbering', () => {
    const missing = MAJOR_ARCANA
      .filter((card) => !SYMBOL_ANNOTATIONS[card.number])
      .map((card) => `${card.number}:${card.name}`);

    assert.deepStrictEqual(missing, [], `Missing symbol annotations for Major Arcana: ${missing.join(', ')}`);
  });

  it('aligns with minor arcana numbering scheme', () => {
    const missing = [];
    const collisions = [];
    const used = new Map();

    MINOR_ARCANA.forEach((card) => {
      const resolver = MINOR_INDEX_RULES[card.suit];
      assert.ok(resolver, `Missing index rule for suit ${card.suit}`);
      const index = resolver(card.rankValue);

      if (used.has(index)) {
        collisions.push(`${index}: ${used.get(index)} & ${card.name}`);
      } else {
        used.set(index, card.name);
      }

      if (!SYMBOL_ANNOTATIONS[index]) {
        missing.push(`${index}:${card.name}`);
      }
    });

    assert.deepStrictEqual(collisions, [], `Duplicate minor arcana indices detected: ${collisions.join(', ')}`);
    assert.deepStrictEqual(missing, [], `Missing symbol annotations for Minor Arcana: ${missing.join(', ')}`);
  });
});
