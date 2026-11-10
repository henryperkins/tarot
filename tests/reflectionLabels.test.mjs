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
  it('preserves the stored deck display label and verbatim note text', () => {
    assert.deepEqual(buildReflectionEntries({ 0: '  first\r\nsecond  ' }, [
      { position: 'Past', name: 'Knight of Cups', displayName: 'Prince of Cups' }
    ]), [['Past · Prince of Cups', '  first\r\nsecond  ']]);
  });

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

describe('editable reflection items', () => {
  it('carries each note’s stored key, and only index and whole-reading keys are editable', async () => {
    const { buildReflectionItems } = await import('../shared/journal/reflectionLabels.js');
    assert.deepEqual(buildReflectionItems({ Past: 'legacy', 1: 'present note', Overall: 'whole', 7: 'stray' }, CARDS), [
      { key: 'Overall', label: READING_REFLECTION_LABEL, note: 'whole', cardIndex: null, editable: true },
      { key: '1', label: 'Present · Three of Cups', note: 'present note', cardIndex: 1, editable: true },
      { key: '7', label: 'Card 8', note: 'stray', cardIndex: 7, editable: false },
      { key: 'Past', label: 'Past', note: 'legacy', cardIndex: null, editable: false }
    ]);
  });

  it('offers the whole reading, then every card, as places for a new note', async () => {
    const { buildReflectionTargets } = await import('../shared/journal/reflectionLabels.js');
    assert.deepEqual(buildReflectionTargets(CARDS).map(({ key, label }) => [key, label]), [
      ['Overall', READING_REFLECTION_LABEL],
      ['0', 'Past · The Hermit'],
      ['1', 'Present · Three of Cups'],
      ['2', 'Future · The Star']
    ]);
    assert.deepEqual(buildReflectionTargets(undefined).map(({ key }) => key), ['Overall']);
  });

  it('applies append, replace and remove like the reflections endpoint, without mutating', async () => {
    const { applyReflectionEdit } = await import('../shared/journal/reflectionLabels.js');
    const original = Object.freeze({ 0: 'first', Overall: 'whole' });
    assert.deepEqual(applyReflectionEdit(original, { key: '0', text: 'second', mode: 'append' }), { 0: 'first\n\nsecond', Overall: 'whole' });
    assert.deepEqual(applyReflectionEdit(original, { key: '1', text: 'new', mode: 'append' }), { 0: 'first', 1: 'new', Overall: 'whole' });
    assert.deepEqual(applyReflectionEdit(original, { key: 'Overall', text: 'rewritten', mode: 'replace' }), { 0: 'first', Overall: 'rewritten' });
    assert.deepEqual(applyReflectionEdit(original, { key: '0', mode: 'remove' }), { Overall: 'whole' });
    assert.deepEqual(applyReflectionEdit(null, { key: 'Overall', text: 'note', mode: 'replace' }), { Overall: 'note' });
  });
});
