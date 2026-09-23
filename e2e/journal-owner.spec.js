import { test, expect } from '@playwright/test';
import { SAVED_READING } from '../tests/helpers/journalD1.mjs';
import { createD1 } from '../tests/helpers/d1Sqlite.mjs';
import { seedUser, seedSession } from '../tests/helpers/journalFixtures.mjs';
import { connectMcpClient } from '../tests/helpers/mcpClient.mjs';
import { createFakeReadingJobs, readingRunner } from '../tests/helpers/fakeReadingJobs.mjs';
import * as journal from '../functions/api/journal.js';
import * as me from '../functions/api/auth/me.js';

const OWNER = { id: 'owner', username: 'owner', subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session' };
const POSITIONS = ['Past — influences that led here', 'Present — where you stand now', 'Future — trajectory if nothing shifts'];

// Real MCP tool dispatch -> production handlers -> local D1 -> app GET/render.
// Only the expensive narrative provider and unrelated app endpoints are fixtures.
for (const [width, deckStyle] of [[1440, 'rws-1909'], [390, 'rws-1909'], [320, 'rws-1909'], [390, 'thoth-a1']]) {
  test(`owner MCP save and appended reflections render at ${width}px with ${deckStyle}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const db = await createD1();
    const jobs = createFakeReadingJobs({ runReading: readingRunner({
      reading: SAVED_READING.personalReading, requestId: 'fixture-reading', themes: SAVED_READING.themes
    }) });
    const env = { DB: db, READING_JOBS: jobs.namespace };
    const labels = deckStyle === 'thoth-a1'
      ? ['Success (Six of Disks)', 'Prince of Wands', 'Knight of Cups']
      : ['Six of Pentacles', 'Knight of Wands', 'King of Cups'];
    const cardsInfo = labels.map((card, index) => ({ card, position: POSITIONS[index], orientation: index === 0 ? 'Upright' : 'Reversed' }));
    const fetchBackend = async (url, init = {}) => {
      const request = new Request(url, init);
      const path = new URL(url).pathname;
      if (path === '/api/auth/me') return me.onRequestGet({ request, env });
      if (path === '/api/journal') return journal.onRequestGet({ request, env });
      throw new Error(`Unexpected journal API route: ${path}`);
    };
    let mcp;
    try {
      await seedUser(db, { id: OWNER.id, username: OWNER.username });
      await seedSession(db, { id: 'session-owner', userId: OWNER.id });
      mcp = await connectMcpClient({ env, user: OWNER, waitUntil: () => {} });
      const call = (name, args) => mcp.client.callTool({ name, arguments: args });
      const inventory = await mcp.client.listTools();
      expect(inventory.tools).toHaveLength(8);
      const drawn = await call('draw_tarot_reading', {
        spreadInfo: { name: SAVED_READING.spread, key: SAVED_READING.spreadKey },
        userQuestion: SAVED_READING.question, deckStyle, personalization: SAVED_READING.userPreferences, seed: '5'
      });
      expect(drawn.isError).toBeUndefined();
      expect(drawn.structuredContent.cardsInfo.map(({ card, position, orientation }) => ({ card, position, orientation }))).toEqual(cardsInfo);
      await jobs.settle();
      const job = { jobId: drawn.structuredContent.jobId, jobToken: drawn.structuredContent.jobToken };
      const finished = await call('get_tarot_reading_status', job);
      expect(finished.structuredContent.status).toBe('complete');
      const saved = await call('save_reading_to_journal', job);
      expect(saved.isError).toBeUndefined();
      expect(saved.structuredContent.outcome).toBe('saved');
      const id = saved.structuredContent.entry.id;
      const retried = await call('save_reading_to_journal', job);
      expect(retried.structuredContent.outcome).toBe('already_saved');
      expect(retried.structuredContent.entry.id).toBe(id);
      expect(db.rows('SELECT user_id, narrative FROM journal_entries')).toEqual([{ user_id: OWNER.id, narrative: SAVED_READING.personalReading }]);
      for (const text of ['  The quiet feels familiar.\nI can choose my pace.  ', 'A second thought, kept intact.']) {
        const args = { entryId: id, scope: 'card', card: labels[2], position: POSITIONS[2], text };
        const result = await call('add_reflection_to_journal_entry', args);
        expect(result.isError).toBeUndefined();
        expect(result.structuredContent.outcome).toBe('added');
        expect((await call('add_reflection_to_journal_entry', args)).structuredContent.outcome).toBe('already_present');
      }
      const overall = { entryId: id, scope: 'reading', text: `Whole reading: ${'longword'.repeat(35)}` };
      expect((await call('add_reflection_to_journal_entry', overall)).structuredContent.outcome).toBe('added');
      expect((await call('add_reflection_to_journal_entry', overall)).structuredContent.outcome).toBe('already_present');
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { localStorage.setItem('tarot-onboarding-complete', 'true'); });
      await page.route('**/api/**', async route => {
        const req = route.request();
        const path = new URL(req.url()).pathname;
        if (path === '/api/auth/me' || path === '/api/journal') {
          const result = await fetchBackend(req.url(), { headers: { Cookie: 'session=session-owner' } });
          await route.fulfill({ status: result.status, contentType: 'application/json', body: await result.text() });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
      });
      await page.goto('/journal');
      await expect(page.locator('#history')).toContainText(SAVED_READING.spread);
      const expand = page.getByTitle('Expand entry').first();
      if (await expand.isVisible()) await expand.click();
      await expect(page.locator('#history')).toContainText(SAVED_READING.question);
      const cardsToggle = page.getByRole('button', { name: 'Cards drawn (3)', exact: true });
      if (await cardsToggle.isVisible() && await cardsToggle.getAttribute('aria-expanded') === 'false') await cardsToggle.click();
      const renderedCards = page.getByRole('group', { name: 'Cards drawn in this reading', exact: true });
      for (const card of cardsInfo) {
        await expect(renderedCards.getByRole('img', { name: `${card.card}${card.orientation === 'Reversed' ? ' (Reversed)' : ''}`, exact: true })).toBeVisible();
      }
      if (deckStyle === 'thoth-a1') {
        await expect(renderedCards.getByRole('img', { name: 'Knight of Cups (Reversed)', exact: true })).toHaveAttribute('src', '/images/cards/RWS1909_-_Cups_14.jpeg');
        await renderedCards.scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: testInfo.outputPath('journal-thoth-cards.png'), fullPage: false });
      }
      const narrative = page.getByRole('button', { name: 'Reading narrative', exact: true });
      if (await narrative.getAttribute('aria-expanded') === 'false') await narrative.click();
      await expect(page.getByText('Keep your own pace.', { exact: true })).toBeVisible();
      const notes = page.locator('section').filter({ has: page.getByText('Reflections', { exact: true }) }).last();
      await expect(notes).toContainText('A second thought, kept intact.');
      await notes.scrollIntoViewIfNeeded();
      await expect(notes.getByText(`${POSITIONS[2]} · ${labels[2]}`, { exact: true })).toBeVisible();
      await expect(notes.getByText('Whole reading', { exact: true })).toBeVisible();
      const note = notes.locator('li').filter({ hasText: 'A second thought' }).locator('span').last();
      await expect(note).toHaveCSS('white-space', 'pre-wrap');
      expect(await note.textContent()).toBe('  The quiet feels familiar.\nI can choose my pace.  \n\nA second thought, kept intact.');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      // Allow content-visibility and scroll paint to settle before evidence capture.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: testInfo.outputPath(`journal-${width}-${deckStyle}.png`), fullPage: false });
    } finally {
      try { await mcp?.close(); } finally { db.sqlite.close(); }
    }
  });
}
