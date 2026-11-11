import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeJournalSortOrder, sortJournalEntries } from '../src/lib/journal/listOrder.js';

const ids = entries => entries.map(entry => entry.id);
const date = day => new Date(2026, 10, day, 12).getTime();

test('journal sort order accepts oldest and otherwise falls back to newest', () => {
  assert.equal(normalizeJournalSortOrder('oldest'), 'oldest');
  for (const value of ['newest', undefined, null, '', 'relevance', 'OLDEST', 1, {}, []]) {
    assert.equal(normalizeJournalSortOrder(value), 'newest');
  }
});

test('journal sorting returns a new array in either direction without mutating entries', () => {
  const middle = Object.freeze({ id: 'middle', ts: date(5) });
  const oldest = Object.freeze({ id: 'oldest', ts: date(1) });
  const newest = Object.freeze({ id: 'newest', ts: date(8) });
  const values = Object.freeze([middle, oldest, newest]);

  const descending = sortJournalEntries(values);
  const ascending = sortJournalEntries(values, 'oldest');
  assert.deepEqual(ids(descending), ['newest', 'middle', 'oldest']);
  assert.deepEqual(ids(ascending), ['oldest', 'middle', 'newest']);
  assert.deepEqual(ids(values), ['middle', 'oldest', 'newest']);
  assert.notEqual(descending, values);
  assert.notEqual(ascending, values);
  assert.equal(descending[0], newest);
  assert.equal(ascending[0], oldest);
});

test('equal journal timestamps retain source order in both directions', () => {
  const values = [
    { id: 'tie-b', ts: date(5) },
    { id: 'newest', ts: date(8) },
    { id: 'tie-a', ts: date(5) },
    { id: 'oldest', ts: date(1) }
  ];
  assert.deepEqual(ids(sortJournalEntries(values)), ['newest', 'tie-b', 'tie-a', 'oldest']);
  assert.deepEqual(ids(sortJournalEntries(values, 'oldest')), ['oldest', 'tie-b', 'tie-a', 'newest']);
});

test('missing, malformed and out-of-range dates stay last and stable in both directions', () => {
  const values = [
    { id: 'missing' },
    { id: 'older', ts: date(1) },
    { id: 'malformed', ts: 'not-a-date' },
    { id: 'out-of-range', ts: 1e40 },
    { id: 'newer', ts: date(8) },
    { id: 'infinite', ts: Infinity }
  ];
  const undated = ['missing', 'malformed', 'out-of-range', 'infinite'];
  assert.deepEqual(ids(sortJournalEntries(values)), ['newer', 'older', ...undated]);
  assert.deepEqual(ids(sortJournalEntries(values, 'oldest')), ['older', 'newer', ...undated]);
});

test('sorting supports legacy seconds, numeric strings, ISO dates and timestamp fallback fields', () => {
  const values = [
    { id: 'milliseconds', ts: date(8) },
    { id: 'iso', createdAt: new Date(date(5)).toISOString() },
    { id: 'seconds', ts: date(1) / 1000 },
    { id: 'numeric-string', timestamp: String(date(3) / 1000) },
    { id: 'fallback', ts: 'invalid', created_at: date(7) / 1000 },
    { id: 'epoch', ts: 0 }
  ];
  assert.deepEqual(ids(sortJournalEntries(values, 'oldest')), [
    'epoch', 'seconds', 'numeric-string', 'iso', 'fallback', 'milliseconds'
  ]);
});

test('unknown sort values keep newest-first and empty inputs produce independent empty arrays', () => {
  const values = [{ id: 'oldest', ts: date(1) }, { id: 'newest', ts: date(8) }];
  assert.deepEqual(ids(sortJournalEntries(values, 'relevance')), ['newest', 'oldest']);
  for (const value of [null, undefined, {}, 'readings']) assert.deepEqual(sortJournalEntries(value), []);
  const empty = [];
  assert.deepEqual(sortJournalEntries(empty), []);
  assert.notEqual(sortJournalEntries(empty), empty);
});
