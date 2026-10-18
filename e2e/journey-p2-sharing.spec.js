import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createD1 } from '../tests/helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry } from '../tests/helpers/journalFixtures.mjs';
import * as me from '../functions/api/auth/me.js';
import * as journal from '../functions/api/journal.js';
import * as share from '../functions/api/share.js';
import { onRequest as analytics } from '../functions/api/archetype-journey.js';
import { onRequestGet as patternAlerts } from '../functions/api/journal/pattern-alerts.js';

const localEntry = (id = 'local-reading-1', question = 'Device-only reading') => ({
  id, ts: Date.now(), question, spread: 'Single Card', spreadKey: 'single', context: 'career',
  cards: [{ name: 'Strength', number: 8, orientation: 'Upright', position: 'Focus' }],
});

// Keep the full app, router, contexts, journal/sharing hooks and components real.
// Only the network boundary is adapted to actual endpoint handlers and SQLite.
async function prepare(page, { tier = 'free', guest = false, local = [localEntry()], cloud = [] } = {}) {
  const db = await createD1(); const env = { DB: db }; const posts = []; const errors = [];
  await seedUser(db, { tier }); await seedSession(db);
  for (const id of cloud) await seedEntry(db, { id, sessionSeed: id });
  page.on('pageerror', error => errors.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const request = new Request(req.url(), { method: req.method(),
      headers: { Cookie: guest ? '' : 'session=session-1', 'Content-Type': 'application/json' },
      ...(req.postData() ? { body: req.postData() } : {}),
    });
    let response;
    if (url.pathname === '/api/auth/me') response = await me.onRequestGet({ request, env });
    else if (url.pathname === '/api/journal') response = await journal.onRequestGet({ request, env });
    else if (url.pathname === '/api/share') {
      if (req.method() === 'POST') posts.push(req.postDataJSON());
      response = await (req.method() === 'POST' ? share.onRequestPost : share.onRequestGet)({ request, env });
    } else if (url.pathname === '/api/archetype-journey') response = await analytics({ request, env });
    else if (url.pathname === '/api/journal/pattern-alerts') response = await patternAlerts({ request, env });
    else response = Response.json({});
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  await page.addInitScript(({ local, guest }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('journal_filters_advanced_v1', 'true');
    localStorage.setItem(guest ? 'tarot_journal' : 'tarot_journal_user-1', JSON.stringify(local));
  }, { local, guest });
  await page.goto('/journal');
  await expect(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true })).toBeVisible();
  return { db, posts, async close() { await page.close(); db.sqlite.close(); expect(errors).toEqual([]); } };
}

async function openSection(page, name, mobile) {
  if (mobile) {
    await page.getByRole('button', { name: 'See Full Journey', exact: false }).click();
    await page.getByRole('tab', { name: name === 'AI Summary' ? 'Summary' : 'Export', exact: true }).click();
    return page.getByRole('tabpanel');
  }
  await page.getByRole('button', { name, exact: true }).click();
  return page.locator('aside');
}

for (const mobile of [false, true]) {
  for (const source of ['cloud banner', 'AI summary']) {
    test(`${source} upgrade opens the real pricing page (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const fixture = await prepare(page);
      try {
        if (source === 'AI summary') {
          const panel = await openSection(page, 'AI Summary', mobile);
          await panel.getByRole('button', { name: 'Upgrade to Plus', exact: true }).click();
        } else await page.getByRole('button', { name: 'Upgrade to Cloud Journal', exact: true }).click();
        await expect(page).toHaveURL(/\/pricing$/);
        await expect(page.getByRole('heading', { name: 'Keep every reading grounded and growing', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Choose your path', exact: true })).toBeVisible();
      } finally { await fixture.close(); }
    });
  }

  test(`Free local readings disable cloud links and retain summary/CSV sharing (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await prepare(page);
    try {
      const panel = await openSection(page, 'Export & Share', mobile);
      const create = panel.getByRole('button', { name: 'Create Share Link', exact: true });
      await expect(create).toBeDisabled();
      await expect(panel.getByText(/These readings are stored locally only/)).toBeVisible();
      await panel.locator('input[name="shareScope"][value="scope"]').check();
      await expect(create).toBeDisabled();
      await panel.getByRole('button', { name: 'Copy summary', exact: true }).click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Entries: 1');
      const pending = page.waitForEvent('download');
      await panel.getByRole('button', { name: 'CSV', exact: true }).click();
      expect(await readFile(await (await pending).path(), 'utf8')).toContain('Device-only reading');
      if (mobile) await page.getByRole('button', { name: 'Close journey panel', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Search journal entries', exact: true }).fill('Device-only');
      const filteredPanel = mobile ? await openSection(page, 'Export & Share', true) : panel;
      await filteredPanel.locator('input[name="shareScope"][value="filters"]').check();
      await expect(filteredPanel.getByRole('button', { name: 'Create Share Link', exact: true })).toBeDisabled();
      expect(fixture.posts).toEqual([]);
      expect(fixture.db.rows('SELECT * FROM share_tokens')).toEqual([]);
    } finally { await fixture.close(); }
  });
}

test('local ID whitespace cannot turn a Free reading into a shareable cloud ID', async ({ page }) => {
  const fixture = await prepare(page, { local: [localEntry('  local-imported  ')] });
  try {
    const panel = await openSection(page, 'Export & Share', false);
    await expect(panel.getByRole('button', { name: 'Create Share Link', exact: true })).toBeDisabled();
    expect(fixture.posts).toEqual([]);
  } finally { await fixture.close(); }
});

test('a mixed local journal selects cloud IDs before applying the share limit', async ({ page }) => {
  const local = [
    ...Array.from({ length: 6 }, (_, i) => localEntry(`local-${i}`, `Device-only ${i}`)),
    localEntry('cloud-1', 'Previous cloud reading'), localEntry('cloud-2', 'Another cloud reading'),
  ];
  const fixture = await prepare(page, { local, cloud: ['cloud-1', 'cloud-2'] });
  try {
    const panel = await openSection(page, 'Export & Share', false);
    await panel.getByLabel('Max entries to share', { exact: true }).fill('1');
    await panel.getByRole('button', { name: 'Create Share Link', exact: true }).click();
    await expect(panel.getByRole('textbox', { name: 'Share link - tap to select and copy', exact: true })).toHaveValue(/\/share\/[a-f0-9]+$/);
    expect(fixture.posts).toHaveLength(1);
    expect(fixture.posts[0].entryIds).toEqual(['cloud-1']);
    expect(fixture.db.rows('SELECT entry_id FROM share_token_entries ORDER BY sort_index')).toEqual([{ entry_id: 'cloud-1' }]);
  } finally { await fixture.close(); }
});

for (const tier of ['plus', 'pro']) {
  test(`${tier} cloud entries still create real scoped, expiring share links`, async ({ page }) => {
    const fixture = await prepare(page, { tier, local: [], cloud: ['cloud-1', 'cloud-2'] });
    try {
      const panel = await openSection(page, 'Export & Share', false);
      await panel.locator('input[name="shareScope"][value="scope"]').check();
      await panel.getByLabel('Link expiry', { exact: true }).selectOption('24');
      await panel.getByRole('button', { name: 'Create Share Link', exact: true }).click();
      await expect(panel.getByRole('textbox', { name: 'Share link - tap to select and copy', exact: true })).toHaveValue(/\/share\/[a-f0-9]+$/);
      expect(fixture.db.rows('SELECT entry_id FROM share_token_entries ORDER BY entry_id')).toEqual([{ entry_id: 'cloud-1' }, { entry_id: 'cloud-2' }]);
      const [record] = fixture.db.rows('SELECT expires_at - created_at AS lifetime FROM share_tokens');
      expect(record.lifetime).toBe(86400);
      expect(fixture.posts[0].expiresInHours).toBe(24);
    } finally { await fixture.close(); }
  });
}

test('guests retain summary copy and CSV exports without a cloud-link action', async ({ page }) => {
  const fixture = await prepare(page, { guest: true });
  try {
    const panel = await openSection(page, 'Export & Share', false);
    await expect(panel.getByRole('button', { name: 'Create Share Link', exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Copy summary', exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Tableu Journal Snapshot');
    const pending = page.waitForEvent('download'); await panel.getByRole('button', { name: 'CSV', exact: true }).click();
    expect(await readFile(await (await pending).path(), 'utf8')).toContain('Device-only reading');
    expect(fixture.posts).toEqual([]);
  } finally { await fixture.close(); }
});
