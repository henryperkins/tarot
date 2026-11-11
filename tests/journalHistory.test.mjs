import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildJournalMonthSections } from '../src/lib/journal/utils.js';
import { sortJournalEntries } from '../src/lib/journal/listOrder.js';

test('month sections retain full totals and the first entry index for navigation', () => {
  const values = [
    ...Array.from({ length: 12 }, (_, index) => ({ id: `oct-${index}`, ts: new Date(2026, 9, 25 - index).getTime() })),
    { id: 'sep-0', ts: new Date(2026, 8, 20).getTime() },
    { id: 'sep-1', ts: new Date(2026, 8, 19).getTime() }
  ];
  const result = buildJournalMonthSections(values);
  assert.deepEqual(result.map(({ key, count, firstIndex }) => ({ key, count, firstIndex })), [
    { key: '2026-10', count: 12, firstIndex: 0 },
    { key: '2026-09', count: 2, firstIndex: 12 }
  ]);
  assert.equal(result[1].anchorId, 'month-2026-09');
  assert.deepEqual(result[1].items.map(({ entry }) => entry.id), ['sep-0', 'sep-1']);
});

test('month sections handle legacy dates and collect undated records without duplicate anchors', () => {
  const values = [
    { id: 'undated-0' },
    { id: 'iso', createdAt: new Date(2026, 9, 20, 12).toISOString() },
    { id: 'invalid', ts: 'not-a-date' },
    { id: 'out-of-range', ts: 1e40 },
    { id: 'seconds', ts: new Date(2026, 9, 19, 12).getTime() / 1000 }
  ];
  const result = buildJournalMonthSections(values);
  assert.deepEqual(result.map(({ key, count, firstIndex }) => ({ key, count, firstIndex })), [
    { key: 'undated', count: 3, firstIndex: 0 },
    { key: '2026-10', count: 2, firstIndex: 1 }
  ]);
  assert.equal(result[0].label, 'Undated');
});

test('empty month sections leave no navigation destinations', () => {
  assert.deepEqual(buildJournalMonthSections([]), []);
  assert.deepEqual(buildJournalMonthSections(null), []);
});

test('a thousand readings keep complete month totals and a usable older-month destination', () => {
  const values = [
    ...Array.from({ length: 1000 }, (_, index) => ({ id: `oct-${index}`, ts: new Date(2026, 9, 20, 12).getTime() })),
    { id: 'older', ts: new Date(2026, 8, 20, 12).getTime() }
  ];
  const result = buildJournalMonthSections(values);
  assert.deepEqual(result.map(({ count, firstIndex }) => ({ count, firstIndex })), [
    { count: 1000, firstIndex: 0 }, { count: 1, firstIndex: 1000 }
  ]);
});

test('rendering consecutive month sections preserves source order and unique anchors', () => {
  const values = [
    { id: 'first-oct', ts: new Date(2026, 9, 20, 12).getTime() },
    { id: 'second-sep', ts: new Date(2026, 8, 20, 12).getTime() },
    { id: 'third-oct', ts: new Date(2026, 9, 19, 12).getTime() }
  ];
  const result = buildJournalMonthSections(values, { consecutive: true });
  assert.deepEqual(result.flatMap(section => section.items.map(({ entry }) => entry.id)), [
    'first-oct', 'second-sep', 'third-oct'
  ]);
  assert.deepEqual(result.map(section => section.anchorId), ['month-2026-10', 'month-2026-09', 'month-2026-10-2']);
});

test('month navigation follows the selected date order with undated readings last', () => {
  const values = [
    { id: 'nov-latest', ts: new Date(2026, 10, 8, 12).getTime() },
    { id: 'undated' },
    { id: 'sep-only', ts: new Date(2026, 8, 20, 12).getTime() },
    { id: 'nov-earliest', ts: new Date(2026, 10, 1, 12).getTime() }
  ];
  for (const [order, expected] of [
    ['newest', [
      { key: '2026-11', count: 2, firstIndex: 0 },
      { key: '2026-09', count: 1, firstIndex: 2 },
      { key: 'undated', count: 1, firstIndex: 3 }
    ]],
    ['oldest', [
      { key: '2026-09', count: 1, firstIndex: 0 },
      { key: '2026-11', count: 2, firstIndex: 1 },
      { key: 'undated', count: 1, firstIndex: 3 }
    ]]
  ]) {
    const sorted = sortJournalEntries(values, order);
    const sections = buildJournalMonthSections(sorted);
    assert.deepEqual(sections.map(({ key, count, firstIndex }) => ({ key, count, firstIndex })), expected);
    assert.deepEqual(sections.flatMap(section => section.items.map(({ entry }) => entry.id)), sorted.map(entry => entry.id));
    for (const section of sections) assert.equal(sorted[section.firstIndex], section.items[0].entry);
  }
});

test('oldest-first rendering keeps full month totals and reveals later jump destinations by batch', () => {
  const values = [
    { id: 'nov-2', ts: new Date(2026, 10, 8, 12).getTime() },
    { id: 'nov-1', ts: new Date(2026, 10, 1, 12).getTime() },
    ...Array.from({ length: 12 }, (_, index) => ({ id: `sep-${index}`, ts: new Date(2026, 8, 20 - index, 12).getTime() }))
  ];
  const sorted = sortJournalEntries(values, 'oldest');
  const sections = buildJournalMonthSections(sorted);
  assert.deepEqual(sections.map(({ key, count, firstIndex }) => ({ key, count, firstIndex })), [
    { key: '2026-09', count: 12, firstIndex: 0 },
    { key: '2026-11', count: 2, firstIndex: 12 }
  ]);
  assert.equal(buildJournalMonthSections(sorted.slice(0, 10), { consecutive: true })[0].count, 10);
  const target = sections[1];
  const visibleCount = Math.ceil((target.firstIndex + 1) / 10) * 10;
  const visible = sorted.slice(0, visibleCount);
  assert.equal(visible[target.firstIndex].id, 'nov-1');
  assert.deepEqual(buildJournalMonthSections(visible, { consecutive: true }).map(section => section.anchorId), [
    'month-2026-09', 'month-2026-11'
  ]);
});
