import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const HARNESS = `<!doctype html><html><body><div id="root"></div><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  await import('/e2e/helpers/journeyP2Harness.jsx');
</script></body></html>`;

const entry = (id, date, extra = {}) => ({ id, ts: Date.parse(date), question: id,
  cards: [{ name: 'Strength', number: 8, orientation: 'Upright' }], context: 'career', ...extra });
const state = page => page.evaluate(() => window.journeyP2?.value);

async function prepare(page, { entries = [], tier = 'free', now = '2026-10-18T12:00:00Z' } = {}) {
  await page.clock.setFixedTime(new Date(now));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/__journey-p2') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    if (url.pathname === '/journal') return route.fulfill({ contentType: 'text/html', body: HARNESS.replace('journeyP2Harness.jsx', 'journeyP1JournalHarness.jsx') });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/auth/me') return route.fulfill({ json: { user: {
      id: 'p2-user', username: 'Journey test', subscription_tier: tier, subscription_status: 'active',
    } } });
    if (url.pathname === '/api/journal') return route.fulfill({ json: { entries, pagination: { hasMore: false, total: entries.length } } });
    if (url.pathname === '/api/archetype-journey') return route.fulfill({ json: { analytics: {
      currentMonth: '2026-10', stats: { needsBackfill: false }, topCards: [{ card_name: 'The Moon', count: 99 }],
      badges: [{ card_name: 'The Moon', count: 99, earned_at: 1 }], streaks: [],
      majorArcanaFrequency: { 'The Moon': 99 },
      trends: [{ year_month: '2026-09', card_name: 'The Moon', count: 99 }],
    } } });
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(data => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot_journal_p2-user', JSON.stringify(data));
  }, entries);
  return { replaceEntries(nextEntries) { entries = nextEntries; } };
}

async function open(page) {
  await page.goto('/__journey-p2');
  await expect.poll(async () => (await state(page))?.ready).toBe(true);
}

async function custom(page, start, end) {
  await page.evaluate(({ start, end }) => {
    window.journeyP2.setScope('custom');
    window.journeyP2.setDate('start', start);
    window.journeyP2.setDate('end', end);
  }, { start, end });
}

async function selectTimeframe(page, timeframe) {
  await page.evaluate(timeframe => {
    window.journeyP2.setFilters(filters => ({ ...filters, timeframe }));
    window.journeyP2.setScope('filters');
  }, timeframe);
  await expect.poll(async () => (await state(page)).analytics.analyticsScope).toBe('filters');
}

async function downloadEntries(page, scope, format = 'CSV') {
  await page.locator(`input[name="exportScope"][value="${scope}"]`).check();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: format, exact: true }).click();
  return readFile(await (await pending).path(), format === 'PDF' ? 'latin1' : 'utf8');
}

for (const scenario of [
  { timezoneId: 'UTC', now: '2026-12-31T23:59:59Z', last: '2026-12-31T12:00:00Z' },
  { timezoneId: 'America/Los_Angeles', now: '2026-12-31T23:59:59-08:00', last: '2026-12-31T12:00:00-08:00' },
]) {
  test.describe(`New Year in ${scenario.timezoneId}`, () => {
    test.use({ timezoneId: scenario.timezoneId });
    test('year-to-date expires last year without changing filters and accepts a new save', async ({ page }) => {
      await prepare(page, { now: scenario.now, entries: [
        entry('old-summer', '2026-06-01T12:00:00Z'), entry('old-december', scenario.last),
      ] });
      await page.clock.install({ time: new Date(Date.parse(scenario.now) - 1000) });
      await page.clock.pauseAt(new Date(scenario.now));
      await open(page);
      await selectTimeframe(page, 'ytd');
      await expect.poll(async () => (await state(page)).journey.totalReadings).toBe(2);

      await page.clock.fastForward(2000);
      await expect.poll(async () => (await state(page)).filteredEntries.map(e => e.id)).toEqual([]);
      const empty = await state(page);
      expect(empty.analytics.scopedStatsEntries).toEqual([]);
      expect(empty.journey.totalReadings).toBe(0);
      expect(empty.journey.seasonNarrative).toBeNull();
      expect(empty.journey.currentStreak).toBe(1);
      await page.locator('input[name="exportScope"][value="scope"]').check();
      await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();

      const saved = await page.evaluate(() => window.journeyP2.saveEntry({
        question: 'new-year-reading', sessionSeed: 'new-year-reading', cards: [{ name: 'The Star' }], context: 'career',
      }));
      expect(saved.success).toBe(true);
      await expect.poll(async () => (await state(page)).journey.seasonNarrative).toContain('The Star appeared 1x');
      const current = await state(page);
      expect(current.journey.cadence).toEqual([{ label: 'Jan 2027', count: 1 }]);
      for (const scope of ['filters', 'scope']) {
        const csv = await downloadEntries(page, scope);
        expect(csv).toContain('new-year-reading');
        expect(csv).not.toMatch(/old-summer|old-december/);
      }
      const all = await downloadEntries(page, 'all');
      expect(all).toContain('old-summer');
      expect(all).toContain('old-december');
    });
  });
}

for (const timeframe of ['30d', '90d']) {
  for (const rollover of [true, false]) {
    test(`${timeframe} readings age out at the inclusive boundary ${rollover ? 'across midnight' : 'within a day'}`, async ({ page }) => {
      const time = rollover ? '23:59:59' : '12:00:00';
      const now = `2026-10-31T${time}Z`;
      const oldestDay = rollover
        ? (timeframe === '30d' ? '2026-10-02' : '2026-08-03')
        : (timeframe === '30d' ? '2026-10-01' : '2026-08-02');
      await prepare(page, { now, entries: [
        entry('expires-soon', `${oldestDay}T${rollover ? '00:00:00' : time}.500Z`), entry('recent-reading', '2026-10-30T12:00:00Z'),
      ] });
      await page.clock.install({ time: new Date(Date.parse(now) - 1000) });
      await page.clock.pauseAt(new Date(now));
      await open(page);
      await selectTimeframe(page, timeframe);
      await expect.poll(async () => (await state(page)).journey.totalReadings).toBe(2);
      // At exactly 30/90 elapsed days it still belongs; one millisecond later it does not.
      await page.clock.fastForward(rollover ? 1500 : 500);
      expect((await state(page)).filteredEntries).toHaveLength(2);
      await page.clock.fastForward(1);
      await expect.poll(async () => (await state(page)).filteredEntries.map(e => e.id)).toEqual(['recent-reading']);
      const current = await state(page);
      expect(current.journey.totalReadings).toBe(1);
      expect(current.journey.cadence.reduce((sum, month) => sum + month.count, 0)).toBe(1);
      expect(current.journey.seasonNarrative).toContain('Strength appeared 1x');
      for (const scope of ['filters', 'scope']) {
        const csv = await downloadEntries(page, scope);
        expect(csv).toContain('recent-reading');
        expect(csv).not.toContain('expires-soon');
      }
    });
  }
}

for (const [timeframe, event] of [['30d', 'focus'], ['90d', 'visibilitychange']]) {
  test(`${timeframe} refreshes on ${event} after a suspended tab resumes`, async ({ page }) => {
    const now = '2026-10-31T12:00:00Z';
    await prepare(page, { now, entries: [
      entry('expired-while-asleep', timeframe === '30d' ? '2026-10-01T13:00:00Z' : '2026-08-02T13:00:00Z'),
      entry('recent-reading', '2026-10-30T12:00:00Z'),
    ] });
    await page.clock.install({ time: new Date('2026-10-31T11:59:59Z') });
    await page.clock.pauseAt(new Date(now));
    await open(page);
    await selectTimeframe(page, timeframe);
    await expect.poll(async () => (await state(page)).journey.totalReadings).toBe(2);
    // Jump wall time without executing timers, then deliver the browser's resume event.
    await page.clock.setSystemTime(new Date('2026-11-02T12:00:00Z'));
    await page.evaluate(event => (event === 'focus' ? window : document).dispatchEvent(new Event(event)), event);
    await expect.poll(async () => (await state(page)).filteredEntries.map(e => e.id)).toEqual(['recent-reading']);
    expect((await state(page)).journey.seasonNarrative).toContain('Strength appeared 1x');
    const csv = await downloadEntries(page, 'scope');
    expect(csv).toContain('recent-reading');
    expect(csv).not.toContain('expired-while-asleep');
  });
}

test('an active rolling window includes a later save and updates its summary after deletion', async ({ page }) => {
  await prepare(page, { entries: [entry('existing-reading', '2026-10-17T12:00:00Z')] });
  await open(page);
  await selectTimeframe(page, '30d');
  await expect.poll(async () => (await state(page)).journey.totalReadings).toBe(1);
  await page.clock.setFixedTime(new Date('2026-10-18T12:05:00Z'));
  const saved = await page.evaluate(() => window.journeyP2.saveEntry({
    question: 'later-save', sessionSeed: 'later-save', cards: [{ name: 'Strength' }], context: 'career',
  }));
  expect(saved.success).toBe(true);
  await expect.poll(async () => (await state(page)).journey.seasonNarrative).toContain('Strength appeared 2x');
  expect(await downloadEntries(page, 'scope')).toContain('later-save');
  await page.evaluate(id => window.journeyP2.deleteEntry(id), saved.entry.id);
  await expect.poll(async () => (await state(page)).journey.seasonNarrative).toContain('Strength appeared 1x');
  expect(await downloadEntries(page, 'scope')).not.toContain('later-save');
});

test.describe('DST relative-filter exports', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('the rolling start date advances its month after DST without a reading expiring', async ({ page }) => {
    const now = '2026-03-31T00:59:59-07:00';
    await prepare(page, { now, entries: [entry('march-reading', '2026-03-30T12:00:00-07:00')] });
    await page.clock.install({ time: new Date('2026-03-31T00:59:58-07:00') });
    await page.clock.pauseAt(new Date(now));
    await open(page);
    await selectTimeframe(page, '30d');
    await expect.poll(async () => (await state(page)).journey.cadence).toEqual([
      { label: 'Feb 2026', count: 0 }, { label: 'Mar 2026', count: 1 },
    ]);
    // The lower endpoint crosses from February to March at 01:00 PDT, not midnight.
    await page.clock.fastForward(2000);
    await expect.poll(async () => (await state(page)).journey.cadence).toEqual([{ label: 'Mar 2026', count: 1 }]);
    expect((await state(page)).journey.seasonNarrative).toContain('In your March readings');
    expect((await state(page)).filteredEntries.map(e => e.id)).toEqual(['march-reading']);
  });

  test('the Journal page shares its rolling window with the summary, chart and export', async ({ page }) => {
    await prepare(page, { now: '2026-03-31T00:30:00-07:00', entries: [
      entry('outside-timeframe', '2026-02-28T23:29:59-08:00'),
      entry('boundary-reading', '2026-02-28T23:45:00-08:00'), entry('recent-reading', '2026-03-30T12:00:00-07:00'),
    ] });
    await page.addInitScript(() => localStorage.setItem('journal_filters_advanced_v1', 'true'));
    await page.goto('/journal');
    await page.getByRole('button', { name: 'Timeframe', exact: true }).click();
    await page.getByRole('option', { name: '30 days', exact: true }).click();
    await expect(page.locator('[id^="journal-entry-"]')).toHaveCount(2);
    await expect(page.getByText(/In your February–March readings, Strength appeared 2x/)).toBeVisible();
    await page.getByRole('button', { name: 'Patterns & Themes', exact: true }).click();
    await expect(page.getByText('2 readings over 2 months (1/month avg)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Export & Share', exact: true }).click();
    const csv = await downloadEntries(page, 'scope');
    expect(csv).toContain('boundary-reading');
    expect(csv).toContain('recent-reading');
    expect(csv).not.toContain('outside-timeframe');
  });

  for (const scenario of [
    { timeframe: '30d', now: '2026-03-31T00:30:00-07:00', boundary: '2026-02-28T23:45:00-08:00',
      excluded: '2026-02-28T23:29:59-08:00', recent: '2026-03-30T12:00:00-07:00', firstMonth: 'Feb 2026' },
    { timeframe: '90d', now: '2026-04-01T00:30:00-07:00', boundary: '2025-12-31T23:45:00-08:00',
      excluded: '2025-12-31T23:29:59-08:00', recent: '2026-03-31T12:00:00-07:00', firstMonth: 'Dec 2025' },
    { timeframe: '30d', now: '2026-12-01T00:30:00-08:00', boundary: '2026-11-01T01:45:00-07:00',
      excluded: '2026-11-01T01:15:00-07:00', recent: '2026-11-01T01:15:00-08:00', firstMonth: 'Nov 2026' },
  ]) {
    test(`${scenario.timeframe} summary, cadence and downloads agree at ${scenario.now}`, async ({ page }) => {
      await prepare(page, { now: scenario.now, entries: [
        entry('outside-timeframe', scenario.excluded), entry('boundary-reading', scenario.boundary),
        entry('recent-reading', scenario.recent),
      ] });
      await open(page);
      await selectTimeframe(page, scenario.timeframe);
      await expect.poll(async () => (await state(page)).filteredEntries.map(e => e.id).sort()).toEqual(['boundary-reading', 'recent-reading']);
      const current = await state(page);
      expect(current.journey.totalReadings).toBe(2);
      expect(current.journey.cadence.reduce((sum, month) => sum + month.count, 0)).toBe(2);
      expect(current.journey.cadence[0].label).toBe(scenario.firstMonth);
      expect(current.journey.seasonNarrative).toContain('Strength appeared 2x');
      for (const scope of ['filters', 'scope']) {
        for (const format of ['CSV', 'Markdown', 'PDF']) {
          const content = await downloadEntries(page, scope, format);
          expect(content).toContain('boundary-reading');
          expect(content).toContain('recent-reading');
          expect(content).not.toContain('outside-timeframe');
          if (format === 'PDF') expect(content).toContain('Entries: 2');
        }
      }
      expect(await downloadEntries(page, 'all')).toContain('outside-timeframe');
    });
  }
});

for (const timezoneId of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });

    test('month includes its entire last day and exports the same readings', async ({ page }) => {
      await prepare(page);
      await open(page);
      await page.evaluate(() => window.journeyP2.patch({ entries: [
        { id: 'oct-last', question: 'oct-last', ts: new Date(2026, 9, 31, 23, 59, 59, 999).getTime(), cards: [{ name: 'Strength' }] },
        { id: 'nov-first', question: 'nov-first', ts: new Date(2026, 10, 1).getTime(), cards: [{ name: 'The Moon' }] },
      ] }));
      const s = await state(page);
      expect(s.analytics.scopedStatsEntries.map(e => e.id)).toEqual(['oct-last']);
      expect(s.journey.scopedEntries.map(e => e.id)).toEqual(['oct-last']);
      await page.locator('input[name="exportScope"][value="scope"]').check();
      page.on('dialog', dialog => dialog.accept());
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'CSV', exact: true }).click();
      const csv = await readFile(await (await download).path(), 'utf8');
      expect(csv).toContain('oct-last');
      expect(csv).not.toContain('nov-first');
    });

    test('custom dates use local days with inclusive endpoints', async ({ page }) => {
      await prepare(page);
      await open(page);
      await page.evaluate(() => window.journeyP2.patch({ entries: [
        { id: 'before', ts: new Date(2026, 8, 30, 23, 59).getTime(), cards: [] },
        { id: 'start', ts: new Date(2026, 9, 1).getTime(), cards: [] },
        { id: 'end', ts: new Date(2026, 9, 18, 23, 59, 59, 999).getTime(), cards: [] },
        { id: 'after', ts: new Date(2026, 9, 19).getTime(), cards: [] },
      ] }));
      await custom(page, '2026-10-01', '2026-10-18');
      const s = await state(page);
      expect(s.analytics.scopeLabel).toContain('Oct 1, 2026 – Oct 18, 2026');
      expect(s.analytics.scopedStatsEntries.map(e => e.id)).toEqual(['start', 'end']);
      expect(s.journey.scopedEntries.map(e => e.id)).toEqual(['start', 'end']);
    });
  });
}

test.describe('daylight saving', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  for (const date of ['2026-03-08', '2026-11-01']) {
    test(`single-day custom range covers the whole ${date}`, async ({ page }) => {
      await prepare(page);
      await open(page);
      await page.evaluate(date => {
        const [year, month, day] = date.split('-').map(Number);
        window.journeyP2.patch({ entries: [
          { id: 'start', ts: new Date(year, month - 1, day).getTime(), cards: [] },
          { id: 'last', ts: new Date(year, month - 1, day, 23, 59, 59, 999).getTime(), cards: [] },
          { id: 'next', ts: new Date(year, month - 1, day + 1).getTime(), cards: [] },
        ] });
      }, date);
      await custom(page, date, date);
      const s = await state(page);
      expect(s.analytics.scopedStatsEntries.map(e => e.id)).toEqual(['start', 'last']);
      expect(s.journey.scopedEntries.map(e => e.id)).toEqual(['start', 'last']);
    });
  }
});

test('streak crosses the month boundary and empty scope offers all history', async ({ page }) => {
  await prepare(page, { now: '2026-11-01T12:00:00Z', entries: [
    entry('oct-30', '2026-10-30T12:00:00Z'), entry('oct-31', '2026-10-31T12:00:00Z'),
  ] });
  await open(page);
  const s = await state(page);
  expect(s.journey.totalReadings).toBe(0);
  expect(s.journey.currentStreak).toBe(2);
  await expect(page.getByText(/No readings in this scope/)).toBeVisible();
  await page.getByRole('button', { name: 'View all time', exact: true }).click();
  await expect.poll(async () => (await state(page)).journey.totalReadings).toBe(2);
});

test('unfiltered scope uses full history even with server analytics', async ({ page }) => {
  await prepare(page, { tier: 'plus', entries: [
    entry('april', '2026-04-01T12:00:00Z'), entry('october', '2026-10-01T12:00:00Z'),
  ] });
  await open(page);
  await expect.poll(async () => (await state(page)).journey.hasBackfilled).toBe(true);
  await page.evaluate(() => window.journeyP2.setScope('filters'));
  await expect.poll(async () => (await state(page)).journey.totalReadings).toBe(2);
  const s = await state(page);
  expect(s.journey.cardFrequency[0]).toMatchObject({ name: 'Strength', count: 2 });
  expect(s.journey.badges).toEqual([]);
  expect(s.journey.cadence.map(month => month.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
});

test('incomplete, invalid and reversed custom ranges never claim all history', async ({ page }) => {
  await prepare(page, { entries: [entry('reading', '2026-10-01T12:00:00Z')] });
  await open(page);
  await page.evaluate(() => window.journeyP2.setScope('custom'));
  expect((await state(page)).analytics.scopedStatsEntries).toEqual([]);
  await expect(page.getByTestId('scope-error')).toContainText('start and end');
  await custom(page, '2026-02-30', '2026-03-01');
  expect((await state(page)).analytics.scopedStatsEntries).toEqual([]);
  await custom(page, '2026-10-18', '2026-10-01');
  expect((await state(page)).analytics.scopedStatsEntries).toEqual([]);
  await expect(page.getByTestId('scope-error')).toContainText('end');
});

test('real saved theme sentences become readable summaries and navigable theme labels', async ({ page }) => {
  const themes = { suitFocus: '3 Cups cards indicate emotional matters, relationships, intuition, and heart-centered concerns are central to this reading.',
    reversalDescription: { name: 'All Upright' } };
  await prepare(page, { entries: [1, 2, 3].map(i => entry(`reading-${i}`, `2026-10-0${i}T12:00:00Z`, {
    themes: { ...themes, suitFocus: themes.suitFocus.replace('3 Cups', `${i + 1} Cups`) },
  })) });
  await open(page);
  const s = await state(page);
  expect(s.journey.themes).toEqual(['Emotions and relationships']);
  expect(s.journey.seasonNarrative).toContain('Emotions and relationships');
  expect(s.journey.seasonNarrative).not.toMatch(/cards indicate|reading\.\.|All Upright/);
  expect(s.journey.journeyStory).not.toMatch(/cards indicate|All Upright/);
  const suggestion = s.journey.coachSuggestions.find(item => item.source === 'theme');
  expect(suggestion.question).not.toContain('cards indicate');
  expect(suggestion.signalsUsed[0].detail).toContain('3 of 3 readings');
  await page.evaluate(filter => {
    window.journeyP2.setFilters(previous => ({ ...previous, journeyFilter: filter }));
    window.journeyP2.setScope('filters');
  }, suggestion.journalFilter);
  expect((await state(page)).filteredEntries.map(e => e.id).sort()).toEqual(['reading-1', 'reading-2', 'reading-3']);
});

test('summary follows remote saves and same-ID edits within a cached date window', async ({ page }) => {
  const entries = [1, 2, 3].map(i => entry(`reading-${i}`, `2026-10-0${i}T12:00:00Z`));
  const fixture = await prepare(page, { entries, tier: 'plus' });
  await open(page);
  expect((await state(page)).journey.seasonNarrative).toContain('Strength appeared 3x');
  fixture.replaceEntries([...entries,
    entry('remote-4', '2026-10-04T12:00:00Z'), entry('remote-5', '2026-10-05T12:00:00Z')]);
  await page.evaluate(() => window.journeyP2.reload());
  expect((await state(page)).journey.seasonNarrative).toContain('Strength appeared 5x');
  fixture.replaceEntries(entries.map(e => ({ ...e, cards: [{ name: 'The Tower' }] })));
  await page.evaluate(() => window.journeyP2.reload());
  expect((await state(page)).journey.seasonNarrative).toContain('The Tower appeared 3x');
  expect((await state(page)).journey.seasonNarrative).not.toContain('Strength');
});

test('Free saves and deletes update the summary through the real journal hook', async ({ page }) => {
  await prepare(page, { entries: [entry('local-first', '2026-10-02T12:00:00Z')] });
  await open(page);
  const saved = await page.evaluate(() => window.journeyP2.saveEntry({
    question: 'A new reading', sessionSeed: 'unique-second', cards: [{ name: 'Strength' }], context: 'career',
  }));
  expect(saved.success).toBe(true);
  await expect.poll(async () => (await state(page)).journey.seasonNarrative).toContain('Strength appeared 2x');
  await page.evaluate(id => window.journeyP2.deleteEntry(id), saved.entry.id);
  await expect.poll(async () => (await state(page)).journey.seasonNarrative).toContain('Strength appeared 1x');
});

test('obsolete persistent summary cache cannot override current readings', async ({ page }) => {
  await prepare(page, { entries: [entry('current', '2026-10-02T12:00:00Z')] });
  await page.addInitScript(() => localStorage.setItem('journey_narrative_cache', JSON.stringify({
    'p2-user:p2-user:default:2026-10-01:2026-10-31:en-US:UTC': {
      timestamp: Date.now(), narrative: 'Stale summary: Strength appeared 99x.', sourceEntryIds: ['current'],
    },
  })));
  await open(page);
  expect((await state(page)).journey.seasonNarrative).toContain('Strength appeared 1x');
  expect((await state(page)).journey.seasonNarrative).not.toContain('99x');
});

test('an open journal advances its month scope at local midnight', async ({ page }) => {
  await prepare(page, { now: '2026-10-31T23:59:59Z', entries: [entry('october', '2026-10-31T12:00:00Z')] });
  await page.clock.install({ time: new Date('2026-10-31T23:59:50Z') });
  await page.clock.pauseAt(new Date('2026-10-31T23:59:59Z'));
  await open(page);
  expect((await state(page)).journey.totalReadings).toBe(1);
  await page.clock.fastForward(2000);
  await expect.poll(async () => (await state(page)).journey.totalReadings).toBe(0);
  expect((await state(page)).journey.currentStreak).toBe(1);
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  expect((await state(page)).journey.currentStreak).toBe(0);
});

test('reading rhythm includes quiet months and counts readings instead of card draws', async ({ page }) => {
  await prepare(page, { entries: [
    entry('first-1', '2025-01-01T12:00:00Z'), entry('first-2', '2025-01-02T12:00:00Z'),
    entry('middle-1', '2025-12-01T12:00:00Z'), entry('middle-2', '2025-12-02T12:00:00Z'),
    entry('last-1', '2026-10-01T12:00:00Z'), entry('last-2', '2026-10-02T12:00:00Z'),
  ].map(e => ({ ...e, cards: [{ name: 'Strength' }, { name: 'The Star' }, { name: 'The Moon' }] })) });
  await open(page);
  await page.evaluate(() => window.journeyP2.setScope('all'));
  const { journey } = await state(page);
  expect(journey.totalReadings).toBe(6);
  expect(journey.totalCards).toBe(18);
  expect(journey.cadence).toHaveLength(22);
  expect(journey.cadence[0]).toEqual({ label: 'Jan 2025', count: 2 });
  expect(journey.cadence[1]).toEqual({ label: 'Feb 2025', count: 0 });
  expect(journey.cadence[21]).toEqual({ label: 'Oct 2026', count: 2 });
  await expect(page.getByText('6 readings over 22 months (0.3/month avg)')).toBeVisible();
});

test('current-filter summaries advance their period after midnight and a new reading', async ({ page }) => {
  const previous = entry('october', '2026-10-31T12:00:00Z');
  await prepare(page, { now: '2026-10-31T23:59:59Z', entries: [previous] });
  await page.clock.install({ time: new Date('2026-10-31T23:59:50Z') });
  await page.clock.pauseAt(new Date('2026-10-31T23:59:59Z'));
  await open(page);
  await page.evaluate(() => {
    window.journeyP2.setFilters(filters => ({ ...filters, timeframe: '30d' }));
    window.journeyP2.setScope('filters');
  });
  await page.clock.fastForward(2000);
  await page.evaluate(entries => window.journeyP2.patch({ entries }), [previous, entry('november', '2026-11-01T00:00:01Z')]);
  const { journey } = await state(page);
  expect(journey.totalReadings).toBe(2);
  expect(journey.cadence.reduce((total, month) => total + month.count, 0)).toBe(2);
  expect(journey.seasonNarrative).toContain('November');
});

for (const mobile of [false, true]) {
  test(`empty month offers history in the real Journal (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page, { now: '2026-11-01T12:00:00Z', entries: [entry('october', '2026-10-31T12:00:00Z')] });
    await page.goto('/journal');
    await expect(page.getByRole('button', { name: 'View all time', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View all time', exact: true }).click();
    await expect(page.getByText(/Strength.*(?:1x|appeared)/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    await expect(page.getByText('Select a valid start and end date for custom scope.').first()).toBeVisible();
    await expect(page.getByText(/appeared 1x/)).toHaveCount(0);
  });
}
