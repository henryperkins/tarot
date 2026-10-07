import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const token = 'share-note-hardening';
const draft = 'A small pause gives me room to reflect. 安心 مرحبا';
const entry = {
  id: 'share-note-fixture',
  ts: Date.UTC(2026, 9, 6, 12),
  spread: 'Three-Card Story',
  spreadKey: 'threeCard',
  question: 'How can I make time for reflection?',
  cards: [
    { name: 'Queen of Cups', position: 'Past', orientation: 'Upright' },
    { name: 'Five of Wands', position: 'Present', orientation: 'Reversed' },
    { name: 'Temperance', position: 'Future', orientation: 'Upright' }
  ]
};

async function prepare(page, theme) {
  await page.addInitScript(value => {
    localStorage.setItem('tarot-theme', value);
    localStorage.setItem('tarot-onboarding-complete', 'true');
  }, theme);
  await page.route(/https:\/\/[^/]*sentry\.io\//, route => route.fulfill({ json: {} }));
  // All data and failed writes are scoped fixtures; no shared records are created.
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: { user: null } });
    if (path === `/api/share/${token}`) {
      return route.fulfill({ json: {
        token,
        title: `Shared reflection ${'安心مرحبا'.repeat(12)}`,
        entries: [entry],
        notes: [{
          id: 'fixture-note', authorName: 'A trusted friend 安心 مرحبا',
          body: 'Take a little time to notice what matters.', cardPosition: 'Past',
          createdAt: Date.UTC(2026, 9, 6, 13)
        }],
        meta: { entryCount: 1 }, viewCount: 4
      } });
    }
    if (path === `/api/share-notes/${token}` && route.request().method() === 'POST') {
      return route.fulfill({ status: 500, json: { error: 'Unable to save your note. Try again.' } });
    }
    return route.fulfill({ json: { ok: true, notes: [], entries: [], usage: {} } });
  });
}

async function expectUsableControl(locator) {
  await expect.poll(() => locator.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return bounds.top >= 0 && bounds.left >= 0
      && bounds.bottom <= innerHeight + 1 && bounds.right <= innerWidth + 1
      && (hit === element || element.contains(hit));
  })).toBe(true);
}

test.describe('Shared note hardening', () => {
  test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

  for (const [width, height, textScale, theme] of [
    [390, 844, 1, 'light'],
    [320, 568, 2, 'dark'],
    [1440, 900, 2, 'light']
  ]) {
    test(`notes remain reachable at ${width}x${height} with ${textScale * 100}% text`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await prepare(page, theme);
      await page.goto(`/share/${token}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Shared reflection');
      if (textScale > 1) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      if (width === 390) {
        // Simulate an inset browser viewport without requiring a physical device.
        await page.evaluate(() => { document.documentElement.style.setProperty('--safe-pad-top', '44px'); });
      }

      const headerAccount = page.getByRole('link', { name: 'Account', exact: true });
      await headerAccount.focus();
      await expectUsableControl(headerAccount);
      if (width < 1024) {
        const spread = page.getByRole('tab', { name: 'Spread', exact: true });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await spread.focus();
        await expectUsableControl(spread);
        await page.keyboard.press('ArrowRight');
        const notesTab = page.getByRole('tab', { name: /^Notes/ });
        await expect(notesTab).toBeFocused();
        await expect(notesTab).toHaveAttribute('aria-selected', 'true');
        await expectUsableControl(notesTab);
        if (width === 390) {
          await expect.poll(() => page.getByRole('tablist', { name: 'View selection' }).evaluate(element => {
            const headerHeight = document.querySelector('header').getBoundingClientRect().height;
            return Math.abs(parseFloat(getComputedStyle(element).top) - headerHeight);
          })).toBeLessThanOrEqual(1);
        }
      }

      const notes = page.locator('[aria-labelledby="collab-notes-title"]').filter({ visible: true });
      for (const name of ['Refresh shared notes', 'Report this note']) {
        const bounds = await notes.getByRole('button', { name, exact: true }).boundingBox();
        expect(Math.min(bounds.width, bounds.height)).toBeGreaterThanOrEqual(43.99);
      }
      const author = notes.getByRole('textbox', { name: 'Your display name for this note' });
      const reflection = notes.getByRole('textbox', { name: 'Your reflection on this spread' });
      await author.fill('Reader 安心 مرحبا');
      await reflection.fill(draft);
      const submit = notes.getByRole('button', { name: 'Share note', exact: true });
      await expect(submit).toBeEnabled();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await reflection.focus();
      await page.keyboard.press('Tab');
      await expect(submit).toBeFocused();
      await expectUsableControl(submit);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath('note-focus-clearance.png') });

      // Exercise pointer activation against the real hit region and preserve
      // the unsent draft when the mocked API rejects the submission.
      await submit.click();
      await expect(notes.getByRole('alert')).toHaveText('Unable to save your note. Try again.');
      await expect(reflection).toHaveValue(draft);
      await expect(author).toHaveValue('Reader 安心 مرحبا');
      await expect(submit).toBeEnabled();
      await submit.focus();
      await expectUsableControl(submit);
      const result = await new AxeBuilder({ page }).include('[aria-labelledby="collab-notes-title"]').analyze();
      expect(result.violations).toEqual([]);
    });
  }

  test('footer clearance updates when text grows after a note is drafted', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page, 'light');
    await page.goto(`/share/${token}`);
    await page.getByRole('tab', { name: /^Notes/ }).click();
    const reflection = page.getByRole('textbox', { name: 'Your reflection on this spread' }).filter({ visible: true });
    await reflection.fill(draft);
    const submit = page.getByRole('button', { name: 'Share note', exact: true }).filter({ visible: true });
    for (const fontSize of ['100%', '200%', '100%']) {
      await page.evaluate(value => { document.documentElement.style.fontSize = value; }, fontSize);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await reflection.focus();
      await page.keyboard.press('Tab');
      await expect(submit).toBeFocused();
      await expectUsableControl(submit);
      await expect(reflection).toHaveValue(draft);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    }
  });
});
