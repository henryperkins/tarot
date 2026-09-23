import { test, expect } from '@playwright/test';
import { journalFixture, OWNER_KEY, SAVED_READING } from '../tests/helpers/journalD1.mjs';
import { journalClient } from '../mcp/tableau-adapter/tests/in-memory-client.js';
import * as journal from '../functions/api/journal.js';
import * as reflections from '../functions/api/journal/reflections.js';
import * as me from '../functions/api/auth/me.js';
import { buildReadingRequestCard } from '../shared/contracts/readingRequestCards.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

// Real MCP tool dispatch -> production handlers -> local D1 -> app GET/render.
// Only the expensive narrative provider and unrelated app endpoints are fixtures.
for (const [width, deckStyle] of [[1440, 'rws-1909'], [390, 'rws-1909'], [320, 'rws-1909'], [390, 'thoth-a1']]) {
  test(`owner MCP save and appended reflections render at ${width}px with ${deckStyle}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await journalFixture();
    const env = { DB: fixture.db };
    const cardsInfo = SAVED_READING.cards.map((card, index) => buildReadingRequestCard(
      [...MAJOR_ARCANA, ...MINOR_ARCANA].find(candidate => candidate.name === (deckStyle === 'thoth-a1' && index === 1 ? 'King of Cups' : card.name)),
      { deckStyle, position: card.position, isReversed: card.orientation === 'Reversed' }
    ));
    const fetchBackend = async (url, init = {}) => {
      const request = new Request(url, init);
      const path = new URL(url).pathname;
      if (path === '/api/auth/me') return me.onRequestGet({ request, env });
      if (path === '/api/journal') return journal[request.method === 'POST' ? 'onRequestPost' : 'onRequestGet']({ request, env });
      const match = path.match(/^\/api\/journal\/([^/]+)\/reflections$/);
      if (match) return reflections.onRequestPost({ request, env, params: { id: match[1] } });
      if (path === '/api/tarot-reading/draw') return Response.json({
        reading: SAVED_READING.personalReading, provider: 'local-composer', requestId: 'fixture-reading', seed: 987654,
        themes: SAVED_READING.themes,
        cardsInfo
      });
      throw new Error(`Unexpected journal API route: ${path}`);
    };
    const mcp = await journalClient(fetchBackend, OWNER_KEY);
    try {
      const drawn = await mcp.client.callTool({ name: 'drawTarotReading', arguments: {
        spreadInfo: { name: SAVED_READING.spread, key: SAVED_READING.spreadKey },
        userQuestion: SAVED_READING.question, deckStyle, personalization: SAVED_READING.userPreferences
      } });
      expect(drawn.isError).toBeUndefined();
      const saved = await mcp.client.callTool({ name: 'saveReadingToJournal', arguments: drawn.structuredContent.savePayload });
      expect(saved.isError).toBeUndefined();
      const id = saved.structuredContent.entry.id;
      for (const text of ['  The quiet feels familiar.\nI can choose my pace.  ', 'A second thought, kept intact.']) {
        const result = await mcp.client.callTool({ name: 'addReflectionToJournalEntry', arguments: { id, scope: 'card', card: 'The Hermit', position: 'Future', text } });
        expect(result.isError).toBeUndefined();
      }
      await mcp.client.callTool({ name: 'addReflectionToJournalEntry', arguments: { id, scope: 'reading', text: `Whole reading: ${'longword'.repeat(35)}` } });
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
      await expect(notes.getByText('Future — The Hermit', { exact: true })).toBeVisible();
      const note = notes.locator('li').filter({ hasText: 'A second thought' }).locator('span').last();
      await expect(note).toHaveCSS('white-space', 'pre-wrap');
      expect(await note.textContent()).toBe('  The quiet feels familiar.\nI can choose my pace.  \n\nA second thought, kept intact.');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      // Allow content-visibility and scroll paint to settle before evidence capture.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: testInfo.outputPath(`journal-${width}-${deckStyle}.png`), fullPage: false });
    } finally {
      await mcp.close();
      await fixture.close();
    }
  });
}
