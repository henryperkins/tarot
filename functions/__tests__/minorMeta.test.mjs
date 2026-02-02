// functions/__tests__/minorMeta.test.mjs
// Tests for minorMeta alias parsing and normalization.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseMinorName, getMinorContext } from '../lib/minorMeta.js';

describe('parseMinorName alias support', () => {
  it('parses Thoth court aliases and suit synonyms', () => {
    assert.deepStrictEqual(parseMinorName('Princess of Disks'), { rank: 'Page', suit: 'Pentacles' });
    assert.deepStrictEqual(parseMinorName('Prince of Cups'), { rank: 'Knight', suit: 'Cups' });
  });

  it('parses Marseille court aliases and suit synonyms', () => {
    assert.deepStrictEqual(parseMinorName('Valet of Batons'), { rank: 'Page', suit: 'Wands' });
    assert.deepStrictEqual(parseMinorName('Chevalier of Epees'), { rank: 'Knight', suit: 'Swords' });
    assert.deepStrictEqual(parseMinorName('Reine of Coupes'), { rank: 'Queen', suit: 'Cups' });
    assert.deepStrictEqual(parseMinorName('Roi of Deniers'), { rank: 'King', suit: 'Pentacles' });
  });

  it('parses non-standard suit aliases for pip cards', () => {
    assert.deepStrictEqual(parseMinorName('Ace of Coins'), { rank: 'Ace', suit: 'Pentacles' });
    assert.deepStrictEqual(parseMinorName('Two of Clubs'), { rank: 'Two', suit: 'Wands' });
  });
});

describe('getMinorContext alias normalization', () => {
  it('normalizes aliases from card names', () => {
    const ctx = getMinorContext({ card: 'Princess of Disks' });
    assert.ok(ctx);
    assert.equal(ctx.rank, 'Page');
    assert.equal(ctx.suit, 'Pentacles');
    assert.equal(ctx.isCourt, true);
    assert.equal(ctx.rankValue, 11);
    assert.equal(ctx.suitTheme, 'earth, body, work, resources, and the material structures that support you');
  });

  it('normalizes aliases from explicit suit/rank fields', () => {
    const ctx = getMinorContext({ suit: 'Batons', rank: 'Chevalier' });
    assert.ok(ctx);
    assert.equal(ctx.rank, 'Knight');
    assert.equal(ctx.suit, 'Wands');
    assert.equal(ctx.isCourt, true);
    assert.equal(ctx.rankValue, 12);
  });
});
