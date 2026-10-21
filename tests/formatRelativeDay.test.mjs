import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRelativeDay } from '../shared/journal/utils.js';

test('last reading uses local calendar days across midnight rather than elapsed hours', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    const now = new Date(2026, 9, 21, 8).getTime();
    assert.equal(formatRelativeDay(new Date(2026, 9, 20, 23).getTime(), now), 'Yesterday');
    assert.equal(formatRelativeDay(new Date(2026, 9, 21, 1).getTime(), now), 'Today');
    assert.equal(formatRelativeDay(new Date(2026, 9, 19, 23).getTime(), now), '2 days ago');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('calendar labels survive both daylight saving transitions', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    assert.equal(formatRelativeDay(new Date(2026, 2, 7, 23, 30).getTime(), new Date(2026, 2, 9, 0, 30).getTime()), '2 days ago');
    assert.equal(formatRelativeDay(new Date(2026, 9, 31, 23).getTime(), new Date(2026, 10, 2, 8).getTime()), '2 days ago');
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('relative day formatting accepts journal seconds and rejects missing or invalid timestamps', () => {
  const now = new Date(2026, 9, 21, 8).getTime();
  assert.equal(formatRelativeDay(Math.floor(now / 1000), now), 'Today');
  for (const value of [null, undefined, '', 'invalid date', NaN]) assert.equal(formatRelativeDay(value, now), null);
  assert.match(formatRelativeDay(new Date(2025, 0, 10).getTime(), now), /2025/);
  assert.notEqual(formatRelativeDay(new Date(2026, 9, 22).getTime(), now), 'Today');
});
