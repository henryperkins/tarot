import test from 'node:test';
import assert from 'assert';
import { randomUUID } from 'crypto';
import { dedupeEntries } from '../shared/journal/dedupe.js';

const baseCard = (name, position, orientation = 'Upright') => ({
  name,
  position,
  orientation
});

const makeEntry = (overrides = {}) => ({
  id: overrides.id || randomUUID(),
  ts: overrides.ts ?? Date.now(),
  spreadKey: overrides.spreadKey || 'threeCard',
  spread: overrides.spread || 'Three Card Story',
  question: overrides.question || 'What should I focus on?',
  cards: overrides.cards || [baseCard('The Fool', 'Past'), baseCard('The Magician', 'Present')],
  sessionSeed: overrides.sessionSeed || null
});

test('dedupes by session seed first', () => {
  const seed = 'abc123';
  const entries = [
    makeEntry({ sessionSeed: seed, ts: 1000, id: 'a' }),
    makeEntry({ sessionSeed: seed, ts: 2000, id: 'b' })
  ];

  const result = dedupeEntries(entries);
  assert.equal(result.length, 1);
  assert.equal(result[0].sessionSeed, seed);
});

test('dedupes by composite fingerprint when no session seed', () => {
  const ts = 1_700_000_000_000;
  const shared = {
    ts,
    spreadKey: 'single',
    question: 'What now?',
    cards: [baseCard('The Star', 'Single', 'Upright')]
  };
  const entries = [
    makeEntry({ ...shared, id: 'a' }),
    makeEntry({ ...shared, id: 'b', ts }), // different id, identical ts
    makeEntry({ ...shared, id: 'c', question: 'What now? ' }) // trimmed question
  ];

  const result = dedupeEntries(entries);
  assert.equal(result.length, 1);
  assert.equal(result[0].question.trim(), 'What now?');
});

test('keeps newest when fingerprints differ', () => {
  const entries = [
    makeEntry({ ts: 1, id: 'old' }),
    makeEntry({ ts: 3, id: 'newer' }),
    makeEntry({ ts: 2, id: 'mid' })
  ];

  const result = dedupeEntries(entries);
  assert.equal(result.length, 3);
  assert.deepStrictEqual(result.map((e) => e.id), ['newer', 'mid', 'old']);
});
