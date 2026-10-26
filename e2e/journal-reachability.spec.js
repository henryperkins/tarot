import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createD1 } from '../tests/helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser } from '../tests/helpers/journalFixtures.mjs';
import * as me from '../functions/api/auth/me.js';
import * as journal from '../functions/api/journal.js';
import * as journalSearch from '../functions/api/journal/search.js';
import * as reflections from '../functions/api/journal/reflections.js';
import * as share from '../functions/api/share.js';
import * as shareToken from '../functions/api/share/[token].js';
import { onRequest as analytics } from '../functions/api/archetype-journey.js';
import { onRequestGet as patternAlerts } from '../functions/api/journal/pattern-alerts.js';
import { EXTRACTION_VERSION } from '../functions/lib/coachSuggestion.js';

// The full app, router, contexts, journal hooks and components stay real. Only
// the network boundary is adapted to the actual endpoint handlers and SQLite.
const ROUTES = [
  [/^\/api\/auth\/me$/, { GET: me.onRequestGet }],
  [/^\/api\/journal$/, { GET: journal.onRequestGet }],
  [/^\/api\/journal\/search$/, { GET: journalSearch.onRequestGet }],
  [/^\/api\/journal\/pattern-alerts$/, { GET: patternAlerts }],
  [/^\/api\/journal\/([^/]+)\/reflections$/, { POST: reflections.onRequestPost }, 'id'],
  [/^\/api\/share$/, { GET: share.onRequestGet, POST: share.onRequestPost }],
  [/^\/api\/share\/([^/]+)$/, { GET: shareToken.onRequestGet, PATCH: shareToken.onRequestPatch, DELETE: shareToken.onRequestDelete }, 'token'],
  [/^\/api\/archetype-journey$/, { GET: analytics, POST: analytics }]
];

const CARDS = [
  { position: 'Past', name: 'The Hermit', number: 9, orientation: 'Upright' },
  { position: 'Present', name: 'Three of Cups', suit: 'Cups', rank: 'Three', rankValue: 3, orientation: 'Reversed' },
  { position: 'Future', name: 'The Star', number: 17, orientation: 'Upright' }
];

function monthsAgo(count, day = 10) {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, day, 12) / 1000);
}

async function seedCloudEntry(db, {
  id, question = `Question ${id}`, narrative = `Reading ${id}.`, cards = CARDS, createdAt = Math.floor(Date.now() / 1000),
  context = 'self', reflections: notes = null, embedding = null
}) {
  await seedEntry(db, { id, userId: 'user-1', cards, narrative, reflections: notes, sessionSeed: id });
  await db.prepare(`UPDATE journal_entries SET question = ?, created_at = ?, updated_at = ?, context = ?,
    step_embeddings = ?, extraction_version = ? WHERE id = ?`)
    .bind(question, createdAt, createdAt, context, embedding ? JSON.stringify([embedding]) : null,
      embedding ? EXTRACTION_VERSION : null, id)
    .run();
}

async function prepare(page, { tier = 'plus', local = [], seed = async () => {}, path = '/journal' } = {}) {
  const db = await createD1();
  await seedUser(db, { tier });
  await seedSession(db);
  await seed(db);
  const requests = [];
  const errors = [];
  const env = {
    DB: db,
    // Search by meaning embeds the query; every stored step vector matches it.
    AI: { run: async (_model, input) => ({ data: input.text.map(() => [1, 0, 0]) }) }
  };
  page.on('pageerror', error => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    requests.push({ method: req.method(), path: url.pathname, search: url.search, body: req.postData() });
    const request = new Request(req.url(), {
      method: req.method(),
      headers: { Cookie: 'session=session-1', 'Content-Type': 'application/json' },
      ...(req.postData() ? { body: req.postData() } : {})
    });
    let response = Response.json({});
    for (const [pattern, handlers, param] of ROUTES) {
      const match = url.pathname.match(pattern);
      const handler = match && handlers[req.method()];
      if (!handler) continue;
      response = await handler({ request, env, params: param ? { [param]: decodeURIComponent(match[1]) } : {} });
      break;
    }
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  await page.addInitScript(({ local }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('journal_filters_advanced_v1', 'true');
    if (local.length) localStorage.setItem('tarot_journal_user-1', JSON.stringify(local));
  }, { local });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true })).toBeVisible();
  return {
    db,
    requests,
    async close() {
      await page.close();
      db.sqlite.close();
      expect(errors).toEqual([]);
    }
  };
}

function entryCard(page, question) {
  return page.locator('article').filter({ has: page.getByRole('heading', { name: question, exact: true }) });
}

async function expandEntry(page, question) {
  const card = entryCard(page, question);
  const toggle = card.locator('button[aria-expanded]').first();
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  return card;
}

async function openDesktopSection(page, name) {
  const aside = page.locator('aside');
  await aside.getByRole('button', { name, exact: true }).click();
  return aside;
}

async function openMobileJourney(page) {
  await page.getByText('Your reading journey', { exact: true }).click();
  return page.getByRole('region', { name: 'Journal insights and journey' });
}

test('share links: the entry menu and the journal panel list, rename and delete existing links', async ({ page }) => {
  const fixture = await prepare(page, {
    seed: async db => {
      await seedCloudEntry(db, { id: 'entry-a', question: 'What steadies me this week?' });
      await seedCloudEntry(db, { id: 'entry-b', question: 'Where is my attention going?', createdAt: Math.floor(Date.now() / 1000) - 60 });
    }
  });
  try {
    // A single-reading link made from the entry header.
    const card = entryCard(page, 'What steadies me this week?');
    await card.getByRole('button', { name: /^Create share link for / }).click();
    await expect(card.getByText('Share link copied (single reading).')).toBeVisible();
    await expect.poll(() => fixture.db.rows('SELECT scope FROM share_tokens')).toEqual([{ scope: 'entry' }]);

    // The entry's own menu now finds it (it reported "No active links" before).
    await card.getByRole('button', { name: /^Open entry actions for / }).click();
    const menu = page.getByRole('menu', { name: 'Entry actions' });
    await expect(menu.getByRole('group', { name: 'Shared reading' })).toBeVisible();
    await expect(menu.getByText('No active links for this reading yet')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // A titled journal snapshot from the Export & Share panel.
    const panel = await openDesktopSection(page, 'Export & Share');
    await panel.getByLabel(/^Link title/).fill('  Autumn   readings ');
    await panel.getByRole('button', { name: 'Create Share Link', exact: true }).click();
    await expect(panel.getByRole('textbox', { name: 'Share link - tap to select and copy', exact: true })).toHaveValue(/\/share\/[a-f0-9]+$/);
    expect(fixture.db.rows("SELECT title FROM share_tokens WHERE scope = 'journal'")).toEqual([{ title: 'Autumn readings' }]);

    // Both links are managed in one list.
    const links = panel.getByRole('region', { name: /^Your share links/ });
    await expect(links.getByRole('listitem')).toHaveCount(2);
    await expect(links.getByRole('paragraph').filter({ hasText: /^Autumn readings$/ })).toBeVisible();
    await expect(links.getByRole('paragraph').filter({ hasText: /^Shared reading$/ })).toBeVisible();

    await links.getByRole('button', { name: 'Rename Shared reading', exact: true }).click();
    await links.getByLabel(/^Link title/).fill('For Sam');
    await links.getByRole('button', { name: 'Save title', exact: true }).click();
    await expect(links.getByText('Renamed the link to “For Sam”.')).toBeVisible();
    expect(fixture.db.rows("SELECT title FROM share_tokens WHERE scope = 'entry'")).toEqual([{ title: 'For Sam' }]);
    await expect(links.getByRole('button', { name: 'Rename For Sam', exact: true })).toBeFocused();

    await links.getByRole('button', { name: 'Copy link for For Sam', exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/share\/[a-f0-9]+$/);

    await links.getByRole('button', { name: 'Delete Autumn readings', exact: true }).click();
    await links.getByRole('button', { name: 'Delete link', exact: true }).click();
    await expect(links.getByText('Deleted “Autumn readings”. It no longer opens.')).toBeVisible();
    await expect(links.getByRole('listitem')).toHaveCount(1);
    expect(fixture.db.rows('SELECT title FROM share_tokens')).toEqual([{ title: 'For Sam' }]);
  } finally { await fixture.close(); }
});

test('share links: a Free account can still find and revoke links it made on Plus', async ({ page }) => {
  const fixture = await prepare(page, {
    tier: 'free',
    local: [{ id: 'local-1', ts: Date.now(), question: 'Device reading', spread: 'Single Card', spreadKey: 'single', cards: [] }],
    seed: async db => {
      await seedCloudEntry(db, { id: 'old-cloud', question: 'Old cloud reading' });
      await db.prepare(`INSERT INTO share_tokens (token, user_id, scope, title, created_at, expires_at, view_count, meta_json)
        VALUES ('abc123', 'user-1', 'journal', 'Still public', ?, NULL, 4, '{"entryCount":1}')`).bind(Math.floor(Date.now() / 1000)).run();
      await db.prepare("INSERT INTO share_token_entries (token, entry_id, sort_index) VALUES ('abc123', 'old-cloud', 0)").run();
    }
  });
  try {
    const panel = await openDesktopSection(page, 'Export & Share');
    await expect(panel.getByRole('button', { name: 'Create Share Link', exact: true })).toHaveCount(0);
    const links = panel.getByRole('region', { name: /^Your share links/ });
    await expect(links.getByText('Journal snapshot · 1 entry · No expiry · 4 views')).toBeVisible();
    await links.getByRole('button', { name: 'Delete Still public', exact: true }).click();
    await links.getByRole('button', { name: 'Delete link', exact: true }).click();
    await expect(links.getByText('You have no active share links.')).toBeVisible();
    await expect(links.getByText('You have no active share links.')).toBeFocused();
    expect(fixture.db.rows('SELECT * FROM share_tokens')).toEqual([]);
  } finally { await fixture.close(); }
});

test('reflections: a cloud entry adds, edits and removes card and whole-reading notes', async ({ page }) => {
  const fixture = await prepare(page, {
    seed: db => seedCloudEntry(db, { id: 'entry-1', question: 'What wants tending?', reflections: { 0: 'Six months alone.' } })
  });
  try {
    const card = await expandEntry(page, 'What wants tending?');
    const section = card.getByRole('region', { name: 'Reflections' });
    await expect(section.getByText('Six months alone.')).toBeVisible();

    await section.getByRole('button', { name: 'Add a reflection', exact: true }).click();
    await section.getByLabel('Reflect on', { exact: true }).selectOption({ label: 'Future · The Star' });
    await section.getByLabel('Your reflection', { exact: true }).fill('Hope, slowly.');
    await section.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(section.getByText('Reflection saved.')).toBeVisible();
    await expect(section.getByText('Hope, slowly.')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Edit reflection: Future · The Star', exact: true })).toBeFocused();

    await section.getByRole('button', { name: 'Edit reflection: Past · The Hermit', exact: true }).click();
    const editor = section.getByLabel('Past · The Hermit', { exact: true });
    await expect(editor).toBeFocused();
    await editor.fill('Six months alone, and I chose them.');
    await section.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(section.getByText('Six months alone, and I chose them.')).toBeVisible();

    await section.getByRole('button', { name: 'Edit reflection: Future · The Star', exact: true }).click();
    await section.getByRole('button', { name: 'Remove note', exact: true }).click();
    await section.getByRole('button', { name: 'Remove note', exact: true }).click();
    await expect(section.getByText('Note removed.')).toBeVisible();
    await expect(section.getByText('Hope, slowly.')).toHaveCount(0);

    const [row] = fixture.db.rows("SELECT reflections_json FROM journal_entries WHERE id = 'entry-1'");
    expect(JSON.parse(row.reflections_json)).toEqual({ 0: 'Six months alone, and I chose them.' });
    const posts = fixture.requests.filter(request => request.path === '/api/journal/entry-1/reflections').map(request => JSON.parse(request.body));
    expect(posts).toEqual([
      { scope: 'card', cardIndex: 2, mode: 'append', text: 'Hope, slowly.', expectedText: '' },
      { scope: 'card', cardIndex: 0, mode: 'replace', text: 'Six months alone, and I chose them.' },
      { scope: 'card', cardIndex: 2, mode: 'remove' }
    ]);
  } finally { await fixture.close(); }
});

test('reflections: a local journal saves a new note in this browser', async ({ page }) => {
  const fixture = await prepare(page, {
    tier: 'free',
    local: [{ id: 'local-1', ts: Date.now(), question: 'What is mine to carry?', spread: 'Three-Card Story', spreadKey: 'threeCard', cards: CARDS }]
  });
  try {
    const card = await expandEntry(page, 'What is mine to carry?');
    const section = card.getByRole('region', { name: 'Reflections' });
    await expect(section.getByText('What resonates for you now?', { exact: true })).toBeVisible();
    await section.getByRole('button', { name: 'Add a reflection', exact: true }).click();
    // The prompt stays beside the editor it invites.
    await expect(section.getByText('What resonates for you now?', { exact: true })).toBeVisible();
    await section.getByLabel('Your reflection', { exact: true }).fill('Only what I chose.');
    await section.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(section.getByText('Only what I chose.')).toBeVisible();
    await expect(section.getByText('What resonates for you now?', { exact: true })).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal_user-1')));
    expect(stored[0].reflections).toEqual({ Overall: 'Only what I chose.' });
    expect(fixture.requests.some(request => request.path.endsWith('/reflections'))).toBe(false);
  } finally { await fixture.close(); }
});

async function seedRisingStar(db) {
  // The Star: 1 reading two months ago, 3 last month, 6 this month.
  let index = 0;
  for (const [ago, count] of [[2, 1], [1, 3], [0, 6]]) {
    for (let n = 0; n < count; n += 1) {
      index += 1;
      await seedCloudEntry(db, {
        id: `star-${index}`,
        question: `Star reading ${index}`,
        cards: [{ position: 'Focus', name: 'The Star', number: 17, orientation: 'Upright' }],
        createdAt: ago === 0 ? Math.floor(Date.now() / 1000) - index * 60 : monthsAgo(ago, 5 + n)
      });
    }
  }
}

test('card trends: a card appearing more each month shows its rise and sparkline', async ({ page }) => {
  const fixture = await prepare(page, { seed: seedRisingStar });
  try {
    const aside = page.locator('aside');
    const row = aside.getByRole('listitem').filter({ hasText: 'The Star' });
    await expect(row.getByRole('img', { name: 'Rising over recent months', exact: true })).toBeVisible();
    await expect(row.locator('.recharts-area-area')).toHaveCount(1);
    // The sparkline is decorative and stays out of the tab order.
    await expect(row.locator('[tabindex="0"]')).toHaveCount(0);
  } finally { await fixture.close(); }
});

test('card trends: the mobile journey shows the rise too @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await prepare(page, { seed: seedRisingStar });
  try {
    const journey = await openMobileJourney(page);
    await journey.getByRole('button', { name: /See Full Journey/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Your Reading Journey' });
    const row = sheet.getByRole('listitem').filter({ hasText: 'The Star' });
    await expect(row.getByRole('img', { name: 'Rising over recent months', exact: true })).toBeVisible();
    // Phones hide sparklines, so they are not mounted at all.
    await expect(sheet.locator('.recharts-responsive-container')).toHaveCount(0);
  } finally { await fixture.close(); }
});

test('search by meaning: a synced journal offers it explicitly and returns related readings', async ({ page }) => {
  const fixture = await prepare(page, {
    seed: async db => {
      await seedCloudEntry(db, { id: 'literal', question: 'Where is the lighthouse?', narrative: 'A lighthouse on the shore.' });
      await seedCloudEntry(db, { id: 'beacon', question: 'What guides me home?', narrative: 'A beacon for ships.', embedding: [1, 0, 0], createdAt: Math.floor(Date.now() / 1000) - 120 });
    }
  });
  try {
    await page.getByRole('searchbox', { name: 'Search journal entries', exact: true }).fill('lighthouse');
    await expect(entryCard(page, 'Where is the lighthouse?')).toBeVisible();
    await expect(entryCard(page, 'What guides me home?')).toHaveCount(0);
    expect(fixture.requests.filter(request => request.path === '/api/journal/search')).toEqual([]);

    await page.getByRole('button', { name: 'Search by meaning', exact: true }).click();
    await expect(entryCard(page, 'What guides me home?')).toBeVisible();
    await expect(page.getByText('Showing readings with a similar meaning, not just these exact words.')).toBeVisible();
    const [searchRequest] = fixture.requests.filter(request => request.path === '/api/journal/search');
    expect(new URLSearchParams(searchRequest.search).get('mode')).toBe('semantic');

    await page.getByRole('button', { name: 'Show exact matches', exact: true }).click();
    await expect(entryCard(page, 'Where is the lighthouse?')).toBeVisible();
    await expect(entryCard(page, 'What guides me home?')).toHaveCount(0);
  } finally { await fixture.close(); }
});

test('pattern alerts: the mobile journey shows the recurring pattern and its readings @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await prepare(page, {
    seed: async db => {
      const month = new Date().toISOString().slice(0, 7);
      for (const id of ['p-1', 'p-2', 'p-3']) {
        await seedCloudEntry(db, { id, question: `Pattern reading ${id}` });
        await db.prepare(`INSERT INTO pattern_occurrences (user_id, pattern_type, pattern_id, entry_id, year_month, created_at)
          VALUES ('user-1', 'triad', 'death-temperance-star', ?, ?, ?)`).bind(id, month, Math.floor(Date.now() / 1000)).run();
      }
      await seedCloudEntry(db, { id: 'unrelated', question: 'Unrelated reading', createdAt: Math.floor(Date.now() / 1000) - 600 });
    }
  });
  try {
    const journey = await openMobileJourney(page);
    await expect(journey.getByText('Recurring Pattern Detected')).toBeVisible();
    await expect(journey.getByText('Death + Temperance + Star', { exact: true })).toBeVisible();
    await journey.getByRole('button', { name: 'View readings', exact: true }).click();
    await expect(entryCard(page, 'Pattern reading p-1')).toBeVisible();
    await expect(entryCard(page, 'Unrelated reading')).toHaveCount(0);
  } finally { await fixture.close(); }
});

test('exports: the journal panel downloads plain text and journal-only JSON for the chosen scope', async ({ page }) => {
  const fixture = await prepare(page, {
    seed: async db => {
      await seedCloudEntry(db, { id: 'newer', question: 'Newer question', reflections: { Overall: 'A whole-reading note.' } });
      await seedCloudEntry(db, { id: 'older', question: 'Older question', createdAt: Math.floor(Date.now() / 1000) - 3600 });
    }
  });
  try {
    const panel = await openDesktopSection(page, 'Export & Share');
    let pending = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Text', exact: true }).click();
    let download = await pending;
    expect(download.suggestedFilename()).toBe('tarot-journal.txt');
    const text = await readFile(await download.path(), 'utf8');
    expect(text).toMatch(/^TAROT JOURNAL EXPORT\nGenerated: .+\nEntries: 2\n/);
    expect(text.indexOf('Newer question')).toBeLessThan(text.indexOf('Older question'));
    expect(text).toContain('Whole reading: A whole-reading note.');

    pending = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'JSON', exact: true }).click();
    download = await pending;
    expect(download.suggestedFilename()).toBe('tarot-journal.json');
    const json = JSON.parse(await readFile(await download.path(), 'utf8'));
    expect(json.entryCount).toBe(2);
    expect(json.scope).toBe('All entries');
    expect(json.entries.map(entry => entry.question)).toEqual(['Newer question', 'Older question']);
    expect(json.entries[0].reflections).toEqual({ Overall: 'A whole-reading note.' });
    await expect(panel.getByText('JSON download started')).toBeVisible();
  } finally { await fixture.close(); }
});

test('pending saves protect reflection drafts and link titles from further edits', async ({ page }) => {
  const fixture = await prepare(page, {
    seed: async db => {
      await seedCloudEntry(db, { id: 'pending-note', question: 'Keep the submitted note' });
      await db.prepare("INSERT INTO share_tokens (token, user_id, scope, title, created_at) VALUES ('pending-link', 'user-1', 'journal', 'Keep this title', ?)")
        .bind(Math.floor(Date.now() / 1000)).run();
      await db.prepare("INSERT INTO share_tokens (token, user_id, scope, title, created_at) VALUES ('other-link', 'user-1', 'journal', 'Another link', ?)")
        .bind(Math.floor(Date.now() / 1000) - 1).run();
    }
  });
  let release;
  try {
    const card = await expandEntry(page, 'Keep the submitted note');
    const section = card.getByRole('region', { name: 'Reflections' });
    await section.getByRole('button', { name: 'Add a reflection', exact: true }).click();
    const field = section.getByLabel('Your reflection', { exact: true });
    await field.fill('Keep these words.');
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/journal/pending-note/reflections', async route => { await gate; await route.fallback(); });
    await section.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(section.getByRole('button', { name: 'Saving…', exact: true })).toBeVisible();
    await expect(field).toHaveAttribute('readonly', '');
    await expect(section.getByLabel('Reflect on', { exact: true })).toBeDisabled();
    release();
    await expect(section.getByText('Reflection saved.', { exact: true })).toBeVisible();

    const panel = await openDesktopSection(page, 'Export & Share');
    const links = panel.getByRole('region', { name: /^Your share links/ });
    await links.getByRole('button', { name: 'Rename Keep this title', exact: true }).click();
    const title = links.getByLabel(/^Link title/);
    await title.fill('Submitted title');
    const renameGate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/share/pending-link', async route => { await renameGate; await route.fallback(); });
    await links.getByRole('button', { name: 'Save title', exact: true }).click();
    await expect(links.getByRole('button', { name: 'Save title', exact: true })).toBeDisabled();
    await expect(title).toHaveAttribute('readonly', '');
    await expect(links.getByRole('button', { name: 'Copy link for Another link', exact: true })).toBeDisabled();
    release();
    await expect(links.getByText('Renamed the link to “Submitted title”.')).toBeVisible();
  } finally { release?.(); await fixture.close(); }
});

test('share links update when a link expires while its manager stays open', async ({ page }) => {
  const now = Date.now();
  await page.clock.install({ time: now });
  const fixture = await prepare(page, {
    seed: async db => {
      await seedCloudEntry(db, { id: 'expires', question: 'An expiring link' });
      await db.prepare("INSERT INTO share_tokens (token, user_id, scope, title, created_at, expires_at) VALUES ('expires-soon', 'user-1', 'entry', 'Short-lived link', ?, ?)")
        .bind(Math.floor(now / 1000), Math.floor(now / 1000) + 60).run();
      await db.prepare("INSERT INTO share_token_entries (token, entry_id, sort_index) VALUES ('expires-soon', 'expires', 0)").run();
    }
  });
  try {
    const quickShare = entryCard(page, 'An expiring link').getByRole('button', { name: /^Copy share link for / });
    await expect(quickShare).toBeVisible();
    const panel = await openDesktopSection(page, 'Export & Share');
    const links = panel.getByRole('region', { name: /^Your share links/ });
    await expect(links.getByRole('button', { name: 'Copy link for Short-lived link', exact: true })).toBeVisible();
    await page.clock.fastForward(61_000);
    await expect(links.getByText(/Single reading.*Expired/)).toBeVisible();
    await expect(links.getByRole('button', { name: 'Copy link for Short-lived link', exact: true })).toHaveCount(0);
    await expect(links.getByRole('button', { name: 'Delete Short-lived link', exact: true })).toBeVisible();
    // The header's cached label can outlive the link; the click must recheck
    // expiry and create a usable link rather than copying the expired token.
    await quickShare.click();
    await expect.poll(() => fixture.requests.filter(request => request.method === 'POST' && request.path === '/api/share').length).toBe(1);
    await expect.poll(() => fixture.db.rows("SELECT token FROM share_tokens WHERE token != 'expires-soon'").length).toBe(1);
  } finally { await fixture.close(); }
});

test('the share manager reaches and revokes a link beyond the first page', async ({ page }) => {
  const fixture = await prepare(page, {
    tier: 'free',
    local: [{ id: 'local-pages', ts: Date.now(), question: 'Local reading', spreadKey: 'single', cards: [] }],
    seed: async db => {
      await seedCloudEntry(db, { id: 'old-shared', question: 'Old public reading' });
      for (let index = 0; index < 52; index += 1) {
        const token = `page-${String(index).padStart(3, '0')}`;
        await db.prepare("INSERT INTO share_tokens (token, user_id, scope, title, created_at) VALUES (?, 'user-1', 'entry', ?, ?)")
          .bind(token, `Shared reading ${index}`, 1790000000 + index).run();
        await db.prepare("INSERT INTO share_token_entries (token, entry_id, sort_index) VALUES (?, 'old-shared', 0)").bind(token).run();
      }
    }
  });
  try {
    const panel = await openDesktopSection(page, 'Export & Share');
    const links = panel.getByRole('region', { name: /^Your share links/ });
    await expect(links.getByRole('listitem')).toHaveCount(52);
    await links.getByRole('button', { name: 'Delete Shared reading 0', exact: true }).click();
    await links.getByRole('button', { name: 'Delete link', exact: true }).click();
    await expect(links.getByRole('listitem')).toHaveCount(51);
    expect(fixture.db.rows("SELECT token FROM share_tokens WHERE token = 'page-000'")).toEqual([]);
    expect(fixture.requests.some(request => request.path === '/api/share' && new URLSearchParams(request.search).has('cursor'))).toBe(true);
  } finally { await fixture.close(); }
});

test('retrying a reflection after its saved response is lost appends it once', async ({ page }) => {
  const fixture = await prepare(page, { seed: db => seedCloudEntry(db, { id: 'lost-response', question: 'Keep my reflection once' }) });
  let first = true;
  await page.route('**/api/journal/lost-response/reflections', async route => {
    if (!first) return route.fallback();
    first = false;
    const response = await reflections.onRequestPost({
      request: new Request(route.request().url(), { method: 'POST', headers: { Cookie: 'session=session-1', 'Content-Type': 'application/json' }, body: route.request().postData() }),
      env: { DB: fixture.db }, params: { id: 'lost-response' }
    });
    expect(response.status).toBe(200);
    await route.abort('failed');
  });
  try {
    const card = await expandEntry(page, 'Keep my reflection once');
    const section = card.getByRole('region', { name: 'Reflections' });
    await section.getByRole('button', { name: 'Add a reflection', exact: true }).click();
    await section.getByLabel('Your reflection', { exact: true }).fill('Leave room.');
    await section.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(section.getByText('Your reflection could not be saved. Check your connection and try again.')).toBeVisible();
    await section.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(section.getByText('Reflection saved.', { exact: true })).toBeVisible();
    let stored = JSON.parse(fixture.db.rows("SELECT reflections_json FROM journal_entries WHERE id = 'lost-response'")[0].reflections_json);
    expect(stored.Overall).toBe('Leave room.');
    // Opening another editor is a new intentional append, even for identical text.
    await section.getByRole('button', { name: 'Add a reflection', exact: true }).click();
    await section.getByLabel('Your reflection', { exact: true }).fill('Leave room.');
    await section.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(section.getByText('Reflection saved.', { exact: true })).toBeVisible();
    stored = JSON.parse(fixture.db.rows("SELECT reflections_json FROM journal_entries WHERE id = 'lost-response'")[0].reflections_json);
    expect(stored.Overall).toBe('Leave room.\n\nLeave room.');
  } finally { await fixture.close(); }
});

test('saving a reflection during search preserves the other open draft', async ({ page }) => {
  const fixture = await prepare(page, { seed: async db => {
    await seedCloudEntry(db, { id: 'searched-a', question: 'A guiding beacon', embedding: [1, 0, 0] });
    await seedCloudEntry(db, { id: 'searched-b', question: 'A path through the dark', embedding: [1, 0, 0] });
  } });
  try {
    await page.getByRole('searchbox', { name: 'Search journal entries', exact: true }).fill('lighthouse');
    await page.getByRole('button', { name: 'Search by meaning', exact: true }).click();
    await expect(entryCard(page, 'A guiding beacon')).toBeVisible();
    const cardA = await expandEntry(page, 'A guiding beacon');
    const cardB = await expandEntry(page, 'A path through the dark');
    const sectionA = cardA.getByRole('region', { name: 'Reflections' });
    const sectionB = cardB.getByRole('region', { name: 'Reflections' });
    for (const section of [sectionA, sectionB]) await section.getByRole('button', { name: 'Add a reflection', exact: true }).click();
    await sectionA.getByLabel('Your reflection', { exact: true }).fill('Save this one.');
    await sectionB.getByLabel('Your reflection', { exact: true }).fill('Keep this unfinished draft.');
    await sectionA.getByRole('button', { name: 'Save reflection', exact: true }).click();
    await expect(sectionA.getByText('Reflection saved.', { exact: true })).toBeVisible();
    await expect(sectionB.getByLabel('Your reflection', { exact: true })).toHaveValue('Keep this unfinished draft.');
    expect(fixture.requests.filter(request => request.path === '/api/journal/search')).toHaveLength(1);
  } finally { await fixture.close(); }
});
