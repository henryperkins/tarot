import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildReflectionEntries,
  READING_REFLECTION_KEY,
  READING_REFLECTION_LABEL
} from '../shared/journal/reflectionLabels.js';

const CARDS = [
  { position: 'Past', name: 'The Hermit' },
  { position: 'Present', name: 'Three of Cups' },
  { position: 'Future', name: 'The Star' }
];

describe('buildReflectionEntries', () => {
  it('puts the whole-reading note first, then cards in spread order with position and name', () => {
    const entries = buildReflectionEntries({ 2: 'hope returns', Overall: 'gentle overall', 0: 'six months alone' }, CARDS);
    assert.deepEqual(entries, [
      [READING_REFLECTION_LABEL, 'gentle overall'],
      ['Past · The Hermit', 'six months alone'],
      ['Future · The Star', 'hope returns']
    ]);
    assert.equal(READING_REFLECTION_KEY, 'Overall');
  });

  it('falls back to a numbered label when the index has no card', () => {
    assert.deepEqual(buildReflectionEntries({ 5: 'stray note' }, CARDS), [['Card 6', 'stray note']]);
  });

  it('uses the reading field name `card` when a stored card has no `name`', () => {
    assert.deepEqual(buildReflectionEntries({ 0: 'note' }, [{ position: 'Past', card: 'The Fool' }]), [['Past · The Fool', 'note']]);
  });

  it('keeps legacy non-index keys, after the cards', () => {
    assert.deepEqual(buildReflectionEntries({ Past: 'legacy', 0: 'indexed' }, CARDS), [
      ['Past · The Hermit', 'indexed'],
      ['Past', 'legacy']
    ]);
  });

  it('drops blank and non-string notes', () => {
    assert.deepEqual(buildReflectionEntries({ 0: '   ', 1: 42, 2: 'kept' }, CARDS), [['Future · The Star', 'kept']]);
  });

  it('returns an empty list for missing or malformed maps', () => {
    for (const value of [null, undefined, 'text', ['a'], 7]) {
      assert.deepEqual(buildReflectionEntries(value, CARDS), []);
    }
  });
});
