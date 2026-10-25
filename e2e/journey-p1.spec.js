import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createD1 } from '../tests/helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry } from '../tests/helpers/journalFixtures.mjs';
import * as journal from '../functions/api/journal.js';
import * as me from '../functions/api/auth/me.js';
import { onRequest as analytics } from '../functions/api/archetype-journey.js';
import { onRequest as backfill } from '../functions/api/archetype-journey-backfill.js';
import { onRequestGet as patternAlerts } from '../functions/api/journal/pattern-alerts.js';
import { onRequestGet as searchJournal } from '../functions/api/journal/search.js';
import { EXTRACTION_VERSION } from '../functions/lib/coachSuggestion.js';

const HARNESS = `<!doctype html><html><body><div id="root"></div><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  await import('/e2e/helpers/journeyP1Harness.js');
</script></body></html>`;

const state = page => page.getByTestId('journey-state').textContent().then(JSON.parse);
async function prepare(page, { tier = 'plus', count = 3, enabled = true, analyzed = false, guest = false, beforeResponse = null } = {}) {
  const db = await createD1();
  await seedUser(db, { tier });
  await seedSession(db);
  for (let i = 0; i < count; i++) {
    await seedEntry(db, { id: `entry-${i}`, sessionSeed: `seed-${i}` });
    await db.prepare('UPDATE journal_entries SET created_at = ?, question = ? WHERE id = ?')
      .bind(Math.floor(Date.now() / 1000) - i * 86400, `Question ${i}`, `entry-${i}`).run();
  }
  if (!enabled) await db.prepare('INSERT INTO user_analytics_prefs (user_id, archetype_journey_enabled, updated_at) VALUES (?, 0, ?)')
    .bind('user-1', Math.floor(Date.now() / 1000)).run();
  const env = { DB: db };
  if (analyzed) await backfill({ request: new Request('https://example.test/api/archetype-journey-backfill', { method: 'POST', headers: { Cookie: 'session=session-1' } }), env });
  const calls = [];
  let sessionId = guest ? '' : 'session-1';
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/__journey-p1') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    if (url.pathname === '/journal') return route.fulfill({ contentType: 'text/html', body: HARNESS.replace('journeyP1Harness.js', 'journeyP1JournalHarness.jsx') });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    calls.push(url.pathname);
    const request = new Request(req.url(), { method: req.method(), headers: { Cookie: `session=${sessionId}`, 'Content-Type': 'application/json' },
      ...(req.postData() ? { body: req.postData() } : {}) });
    let result;
    if (url.pathname === '/api/auth/me') result = await me.onRequestGet({ request, env });
    else if (url.pathname === '/api/journal') result = await journal.onRequestGet({ request, env });
    else if (url.pathname === '/api/journal/pattern-alerts') result = await patternAlerts({ request, env });
    else if (url.pathname === '/api/journal/search') result = await searchJournal({ request, env });
    else if (url.pathname === '/api/archetype-journey-backfill') result = await backfill({ request, env });
    else if (url.pathname.startsWith('/api/archetype-journey')) result = await analytics({ request, env });
    else result = Response.json({});
    if (beforeResponse) await beforeResponse(url.pathname, result);
    return route.fulfill({ status: result.status, contentType: 'application/json', body: await result.text() });
  });
  await page.addInitScript(() => { localStorage.setItem('tarot-onboarding-complete', 'true'); });
  return { db, calls, setSession(id) { sessionId = id; }, close: async () => { await page.close(); db.sqlite.close(); } };
}
async function openHarness(page) {
  await page.goto('/__journey-p1');
  await expect.poll(async () => { const s = await state(page); return !s.authLoading && !s.journalLoading; }).toBe(true);
}

// Scope chips live behind the Practice snapshot disclosure; open it before use.
async function openPracticeSnapshot(page) {
  const summary = page.locator('summary', { hasText: 'Practice snapshot' });
  const details = summary.locator('xpath=ancestor::details[1]');
  // getAttribute returns '' (falsy) for present boolean attributes; test for absence instead.
  if ((await details.getAttribute('open')) === null) await summary.click();
  await expect(details).toHaveAttribute('open');
}

// The mobile Journey mounts only after its native disclosure is opened.
async function openMobileJourney(page) {
  const summary = page.locator('summary', { hasText: 'Your reading journey' });
  const details = summary.locator('xpath=ancestor::details[1]');
  await summary.waitFor();
  if ((await details.getAttribute('open')) === null) await summary.click();
  await expect(details).toHaveAttribute('open');
}

test('real journal hook and export retain all 125 entries beyond paginated history', async ({ page }) => {
  const fixture = await prepare(page, { count: 125, analyzed: true });
  try {
    await openHarness(page);
    await expect.poll(async () => (await state(page)).loaded).toBe(125);
    // Use the full journal window, as the All time picker does.
    await page.evaluate(() => window.journeyP1.patch({ seasonWindow: { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) } }));
    await expect.poll(async () => (await state(page)).total).toBe(125);
    page.on('dialog', dialog => dialog.accept());
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const csv = await readFile(await (await download).path(), 'utf8');
    expect(csv).toContain('Question 124');
    expect(csv.split('\n').filter(Boolean)).toHaveLength(126);
  } finally { await fixture.close(); }
});

for (const options of [
  { name: 'complete server analytics', analyzed: true, expected: false },
  { name: 'missing server analytics', analyzed: false, expected: true },
  { name: 'opted-out analytics', enabled: false, expected: false }
]) {
  test(`dated scope uses server diagnostics for ${options.name}`, async ({ page }) => {
    const fixture = await prepare(page, options);
    try {
      await openHarness(page);
      await page.evaluate(() => window.journeyP1.patch({ seasonWindow: { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) } }));
      await expect.poll(async () => (await state(page)).needsBackfill).toBe(options.expected);
      if (options.enabled === false) await expect.poll(async () => (await state(page)).disabled).toBe(true);
      if (options.expected) {
        await page.getByRole('button', { name: 'Analyze now', exact: true }).click();
        await expect.poll(async () => (await state(page)).needsBackfill).toBe(false);
        expect(fixture.db.rows('SELECT SUM(count) AS total FROM card_appearances')[0].total).toBe(9);
      }
    } finally { await fixture.close(); }
  });
}

test('Free local journal never offers server backfill', async ({ page }) => {
  const fixture = await prepare(page, { tier: 'free', count: 0 });
  try {
    await page.addInitScript(() => localStorage.setItem('tarot_journal_user-1', JSON.stringify([
      { id: 'local-1', ts: Date.now(), cards: [{ name: 'The Star' }] }
    ])));
    await openHarness(page);
    await page.evaluate(() => window.journeyP1.patch({ seasonWindow: { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) } }));
    await expect.poll(async () => (await state(page)).loaded).toBe(1);
    await expect.poll(async () => (await state(page)).needsBackfill).toBe(false);
    await expect(page.getByRole('button', { name: 'Analyze now', exact: true })).toHaveCount(0);
    expect(fixture.calls).not.toContain('/api/archetype-journey');
  } finally { await fixture.close(); }
});

test('analytics failure never guesses that a loaded journal needs backfill', async ({ page }) => {
  const fixture = await prepare(page);
  try {
    await page.route('**/api/archetype-journey', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
    await openHarness(page);
    await page.evaluate(() => window.journeyP1.patch({ seasonWindow: { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) } }));
    await expect.poll(async () => (await state(page)).needsBackfill).toBe(false);
  } finally { await fixture.close(); }
});

for (const mobile of [false, true]) {
  test(`theme action selects readings from their saved themes (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    const fixture = await prepare(page, { count: 4 });
    try {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      for (let i = 0; i < 4; i++) {
        await fixture.db.prepare('UPDATE journal_entries SET cards_json = ?, themes_json = ? WHERE id = ?')
          .bind(JSON.stringify([{ name: ['The Star', 'The Moon', 'The Sun', 'The Tower'][i] }]),
            JSON.stringify({ suitFocus: i < 3 ? 'Water brings emotional matters to this reading.' : 'A different theme.' }), `entry-${i}`).run();
      }
      await page.goto('/journal');
      if (mobile) await openMobileJourney(page);
      await expect(page.getByRole('button', { name: 'Open journal', exact: true })).toBeVisible();
      const theme = page.getByRole('button', { name: 'Theme', exact: true });
      if (await theme.count()) await theme.click();
      await page.getByRole('button', { name: 'Open journal', exact: true }).click();
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(3);
      await expect(page.locator('#journal-entry-entry-3')).toHaveCount(0);
      await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toBeFocused();
    } finally { await fixture.close(); }
  });
}

test('numeric pattern action selects the actual owned readings', async ({ page }) => {
  const fixture = await prepare(page, { count: 4 });
  try {
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 3; i++) await fixture.db.prepare(`INSERT INTO pattern_occurrences
      (user_id, entry_id, pattern_type, pattern_id, year_month, created_at) VALUES (?, ?, 'dyad', '13-17', ?, ?)`)
      .bind('user-1', `entry-${i}`, new Date().toISOString().slice(0, 7), now).run();
    await page.goto('/journal');
    await page.getByRole('button', { name: 'View readings', exact: true }).click();
    await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(3);
    await expect(page.locator('#journal-entry-entry-3')).toHaveCount(0);
  } finally { await fixture.close(); }
});

test('aborted backfill clears its busy state and can be retried', async ({ page }) => {
  const fixture = await prepare(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  try {
    await openHarness(page);
    await expect.poll(async () => (await state(page)).needsBackfill).toBe(true);
    await page.route('**/api/archetype-journey-backfill', async route => { await gate; await route.fallback(); });
    await page.evaluate(() => {
      window.abortBackfill = new AbortController();
      window.journeyP1.backfill(window.abortBackfill.signal);
    });
    await expect.poll(async () => (await state(page)).busy).toBe(true);
    await page.evaluate(() => window.abortBackfill.abort());
    await expect.poll(async () => (await state(page)).busy).toBe(false);
    release();
    await page.unroute('**/api/archetype-journey-backfill');
    await page.getByRole('button', { name: 'Analyze now', exact: true }).click();
    await expect.poll(async () => (await state(page)).needsBackfill).toBe(false);
  } finally { release(); await fixture.close(); }
});

test('guest journal never requests analytics or offers backfill', async ({ page }) => {
  const fixture = await prepare(page, { guest: true, count: 0 });
  try {
    await page.addInitScript(() => localStorage.setItem('tarot_journal', JSON.stringify([
      { id: 'local-guest', ts: Date.now(), cards: [{ name: 'The Star' }] }
    ])));
    await openHarness(page);
    await expect.poll(async () => (await state(page)).loaded).toBe(1);
    expect((await state(page)).needsBackfill).toBe(false);
    expect(fixture.calls).not.toContain('/api/archetype-journey');
  } finally { await fixture.close(); }
});

for (const mobile of [false, true]) {
  test(`incomplete cached history has no all-history export (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    const fixture = await prepare(page);
    try {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => localStorage.setItem('tarot_journal_cache_user-1', JSON.stringify([
        { id: 'cached-one', ts: Date.now(), cards: [{ name: 'The Star' }], question: 'Cached reading' }
      ])));
      await page.route('**/api/journal?*', route => route.fulfill({ status: 503, json: { error: 'Offline' } }));
      await page.goto('/journal');
      if (mobile) await openMobileJourney(page);
      await expect(page.getByText('Journey insights and exports need your complete journal.', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'CSV', exact: true })).toHaveCount(0);
    } finally { await fixture.close(); }
  });
}

for (const scenario of [
  { name: 'drift', count: 3, matching: 2, button: 'New focus spotted' },
  { name: 'emerging drift', count: 10, matching: 1, button: 'Emerging interest' }
]) {
  test(`${scenario.name} action uses its context, clears an old search, and supports reset`, async ({ page }) => {
    const fixture = await prepare(page, { count: scenario.count });
    try {
      await page.addInitScript(() => localStorage.setItem('tarot-personalization:user-1', JSON.stringify({ focusAreas: ['love'] })));
      await fixture.db.prepare('UPDATE journal_entries SET cards_json = ?, created_at = ?')
        .bind('[]', Math.floor(Date.now() / 1000)).run();
      for (let i = 0; i < scenario.count; i++) await fixture.db.prepare('UPDATE journal_entries SET context = ? WHERE id = ?')
        .bind(i < scenario.matching ? 'career' : 'love', `entry-${i}`).run();
      await page.goto('/journal');
      await page.getByRole('button', { name: scenario.button, exact: true }).click();
      // Keep analytics on All time while the history has an unrelated search.
      await openPracticeSnapshot(page);
      await page.getByRole('button', { name: 'All time', exact: true }).first().click();
      await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('Question 2');
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(1);
      await page.getByRole('button', { name: scenario.button, exact: true }).click();
      await page.getByRole('button', { name: 'Open journal', exact: true }).click();
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(scenario.matching);
      await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('');
      await page.getByRole('button', { name: 'Reset view', exact: true }).first().click();
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(scenario.count);
    } finally { await fixture.close(); }
  });
}

for (const heldPath of ['/api/archetype-journey', '/api/archetype-journey-backfill']) {
  test(`late ${heldPath.split('/').at(-1)} response cannot update another account`, async ({ page }) => {
    let release, started;
    const gate = new Promise(resolve => { release = resolve; });
    const held = new Promise(resolve => { started = resolve; });
    let heldOnce = false;
    const fixture = await prepare(page, { beforeResponse: async path => {
      if (path === heldPath && !heldOnce) { heldOnce = true; started(); await gate; }
    } });
    try {
      await seedUser(fixture.db, { id: 'other' });
      await seedSession(fixture.db, { id: 'session-other', userId: 'other' });
      // Deliberately ignore cancellation to prove ownership checks reject late data.
      await page.addInitScript(() => {
        const original = window.fetch;
        window.fetch = (url, options) => original(url, String(url).includes('/api/archetype-journey') ? { ...options, signal: undefined } : options);
      });
      await openHarness(page);
      if (heldPath.endsWith('backfill')) {
        await expect.poll(async () => (await state(page)).needsBackfill).toBe(true);
        await page.evaluate(() => { window.pendingBackfill = window.journeyP1.backfill(); });
      }
      await held;
      fixture.setSession('session-other');
      await page.evaluate(() => window.journeyP1.checkAuth());
      await expect.poll(() => page.evaluate(() => window.journeyP1.value.entries.length)).toBe(0);
      await expect.poll(async () => (await state(page)).needsBackfill).toBe(false);
      release();
      await page.evaluate(async () => { if (window.pendingBackfill) await window.pendingBackfill; });
      expect((await state(page)).needsBackfill).toBe(false);
      expect((await state(page)).busy).toBe(false);
      const result = await page.evaluate(() => window.journeyP1.value.backfillResult);
      expect(result).toBeNull();
    } finally { release(); await fixture.close(); }
  });
}

for (const source of ['Journal prompt', 'Streak check-in']) {
  test(`${source} action opens unfiltered history and focuses search`, async ({ page }) => {
    const fixture = await prepare(page, { count: 2 });
    try {
      await fixture.db.prepare("UPDATE journal_entries SET cards_json = '[]'").run();
      await page.goto('/journal');
      await page.getByRole('button', { name: source, exact: true }).click();
      await openPracticeSnapshot(page);
      await page.getByRole('button', { name: 'All time', exact: true }).first().click();
      await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('Question 1');
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(1);
      await page.getByRole('button', { name: source, exact: true }).click();
      await page.getByRole('button', { name: 'Open journal', exact: true }).click();
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(2);
      await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toBeFocused();
      await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('');
    } finally { await fixture.close(); }
  });
}

test('the Journal page wires full history into All time and All entries CSV', async ({ page }) => {
  const fixture = await prepare(page, { count: 125, analyzed: true });
  try {
    await page.goto('/journal');
    await openPracticeSnapshot(page);
    await page.getByRole('button', { name: 'All time', exact: true }).first().click();
    await page.getByRole('button', { name: 'Export & Share', exact: true }).click();
    await page.locator('input[name="exportScope"][value="all"]').check();
    await expect(page.getByText('Exporting: All entries · 125 entries', { exact: true })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const csv = await readFile(await (await download).path(), 'utf8');
    expect(csv).toContain('Question 124');
    expect(csv.split('\n').filter(Boolean)).toHaveLength(126);
  } finally { await fixture.close(); }
});

for (const mobile of [false, true]) {
  test(`opted-out Journal keeps complete and filtered exports available (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    const fixture = await prepare(page, { count: 125, enabled: false });
    try {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/journal');
      if (mobile) await openMobileJourney(page);
      await expect(page.getByText('Journey analytics are currently disabled.', { exact: true })).toBeVisible();
      if (!mobile) await page.getByRole('button', { name: 'Export & Share', exact: true }).click();
      await page.locator('input[name="exportScope"][value="all"]').check();
      await expect(page.getByText('Exporting: All entries · 125 entries', { exact: true })).toBeVisible();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'CSV', exact: true }).click();
      const csv = await readFile(await (await download).path(), 'utf8');
      expect(csv.split('\n').filter(Boolean)).toHaveLength(126);
      expect(csv).toContain('Question 124');

      await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('Question 124');
      await page.locator('input[name="exportScope"][value="filters"]').check();
      await expect(page.getByText('Exporting: Current filters · 1 entry', { exact: true })).toBeVisible();
      const filteredDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'CSV', exact: true }).click();
      const filteredCsv = await readFile(await (await filteredDownload).path(), 'utf8');
      expect(filteredCsv.split('\n').filter(Boolean)).toHaveLength(2);
      expect(filteredCsv).toContain('Question 124');

      await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('no matching reading');
      await page.locator('input[name="exportScope"][value="all"]').check();
      await expect(page.getByText('Exporting: All entries · 125 entries', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Analyze/ })).toHaveCount(0);
      expect(fixture.calls).not.toContain('/api/archetype-journey-backfill');
      expect(fixture.db.rows('SELECT * FROM card_appearances')).toHaveLength(0);
      expect(fixture.db.rows('SELECT archetype_journey_enabled FROM user_analytics_prefs')[0].archetype_journey_enabled).toBe(0);
    } finally { await fixture.close(); }
  });

  test(`embedding navigation selects the source readings of the leading cluster (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    const fixture = await prepare(page, { count: 4 });
    try {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      for (let i = 0; i < 4; i++) await fixture.db.prepare('UPDATE journal_entries SET cards_json = ?, context = NULL, themes_json = NULL WHERE id = ?')
        .bind(JSON.stringify([{ name: ['Ace of Wands', 'Two of Cups', 'Three of Swords', 'Four of Pentacles'][i] }]), `entry-${i}`).run();
      // Extracted steps can paraphrase a reading: neither source narrative
      // contains this wording. A text search cannot identify these sources.
      const steps = [
        ['Ask a friend for support', 'Reach out to someone you trust'],
        ['Make room for help from friends'],
        ['Plan time alone']
      ];
      for (let i = 0; i < steps.length; i++) await fixture.db.prepare('UPDATE journal_entries SET extracted_steps = ?, step_embeddings = ?, extraction_version = ? WHERE id = ?')
        .bind(JSON.stringify(steps[i]), JSON.stringify(steps[i].map(() => i < 2 ? [1, 0, 0] : [0, 1, 0])), EXTRACTION_VERSION, `entry-${i}`).run();
      await page.goto('/journal');
      await openPracticeSnapshot(page);
      if (mobile) await openMobileJourney(page);
      await page.getByRole('button', { name: 'All time', exact: true }).first().click();
      await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('Question 3');
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(1);
      await page.getByRole('button', { name: 'Gentle next steps', exact: true }).click();
      await page.getByRole('button', { name: 'Open journal', exact: true }).click();
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(2);
      await expect(page.locator('#journal-entry-entry-0')).toBeVisible();
      await expect(page.locator('#journal-entry-entry-1')).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toBeFocused();
      await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('');
      await page.getByRole('button', { name: 'Reset view', exact: true }).first().click();
      await expect(page.locator('[id^="journal-entry-entry-"]')).toHaveCount(4);
    } finally { await fixture.close(); }
  });
}

test('a journal above 200 entries keeps every text-filter match in its export', async ({ page }) => {
  const fixture = await prepare(page, { count: 220, analyzed: true });
  try {
    await page.goto('/journal');
    await openPracticeSnapshot(page);
    await page.getByRole('button', { name: 'All time', exact: true }).first().click();
    await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('Question');
    await page.getByRole('button', { name: 'Export & Share', exact: true }).click();
    await page.locator('input[name="exportScope"][value="filters"]').check();
    await expect(page.getByText('Exporting: Current filters · 220 entries', { exact: true })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV', exact: true }).click();
    const csv = await readFile(await (await download).path(), 'utf8');
    expect(csv.split('\n').filter(Boolean)).toHaveLength(221);
    expect(csv).toContain('Question 219');
  } finally { await fixture.close(); }
});

test('a retained backfill callback cannot act for a different signed-in account', async ({ page }) => {
  const fixture = await prepare(page);
  try {
    await seedUser(fixture.db, { id: 'other' });
    await seedSession(fixture.db, { id: 'session-other', userId: 'other' });
    await seedEntry(fixture.db, { id: 'other-entry', userId: 'other' });
    await openHarness(page);
    await expect.poll(async () => (await state(page)).needsBackfill).toBe(true);
    await page.evaluate(() => { window.oldBackfill = window.journeyP1.backfill; });
    fixture.setSession('session-other');
    await page.evaluate(() => window.journeyP1.checkAuth());
    await expect.poll(() => page.evaluate(() => window.journeyP1.value.entries[0]?.id)).toBe('other-entry');
    await expect.poll(async () => (await state(page)).needsBackfill).toBe(true);
    const requestsBefore = fixture.calls.length;
    await page.evaluate(() => window.oldBackfill());
    expect(fixture.calls.slice(requestsBefore)).not.toContain('/api/archetype-journey-backfill');
    expect(fixture.db.rows('SELECT * FROM card_appearances')).toHaveLength(0);
    expect((await state(page)).needsBackfill).toBe(true);
  } finally { await fixture.close(); }
});
