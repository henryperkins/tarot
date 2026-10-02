import { test, expect } from '@playwright/test';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

const entry = {
  id: 'arcana-keyboard', ts: Date.now(), spread: 'Three-Card Story', spreadKey: 'threeCard',
  cards: [{ name: 'The Fool', position: 'Present', orientation: 'Upright' }],
  question: 'What can I learn from this week?', personalReading: 'Make room for a fresh perspective.'
};

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Startup hardening — ${platform}`, () => {
    test.use({ serviceWorkers: 'block' });

    for (const theme of ['light', 'dark']) {
      test(`stored ${theme} theme is applied before the React entry executes`, async ({ page }) => {
        const fixture = await createNarrativeFixture(page, { signedOut: true });
        let release;
        const held = new Promise(resolve => { release = resolve; });
        await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
        await page.route(/\/(assets\/app-[^/]+\.js|src\/main\.jsx)(?:\?.*)?$/, async route => {
          await held;
          await route.continue();
        });
        try {
          await page.goto('/', { waitUntil: 'commit' });
          await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(theme === 'light');
          await expect(page.locator('#root')).toBeEmpty();
          await expect.poll(() => page.locator('meta[name="theme-color"]').evaluateAll(nodes => nodes.map(node => node.content.toLowerCase())))
            .toEqual([theme === 'light' ? '#fafafa' : '#0f0e13', theme === 'light' ? '#fafafa' : '#0f0e13']);
          release();
          await expect(page.getByRole('heading', { level: 2, name: 'Welcome to Tableu', exact: true })).toBeVisible();
          await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(theme === 'light');
        } finally {
          release();
          await fixture.close();
        }
      });
    }

    test('theme storage failures preserve a usable default and in-memory switching', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      await page.addInitScript(() => {
        const get = Storage.prototype.getItem;
        const set = Storage.prototype.setItem;
        Storage.prototype.getItem = function (key) {
          if (key === 'tarot-theme') throw new DOMException('Storage unavailable', 'SecurityError');
          return get.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
          if (key === 'tarot-theme') throw new DOMException('Storage is full', 'QuotaExceededError');
          return set.call(this, key, value);
        };
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto('/account');
        const themes = page.getByRole('radiogroup', { name: 'Theme', exact: true });
        for (const label of ['Light', 'Dark']) {
          const option = themes.getByRole('radio', { name: label, exact: true });
          await option.press('Enter');
          await expect(option).toHaveAttribute('aria-checked', 'true');
          await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(label === 'Light');
        }
        expect(errors).toEqual([]);
      } finally {
        await fixture.close();
      }
    });

    test('the journey panel keeps controls and card names reachable at 200% text', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      await page.addInitScript(value => {
        localStorage.setItem('tarot-onboarding-complete', 'true');
        localStorage.setItem('tarot_journal', JSON.stringify([value]));
      }, entry);
      try {
        await page.goto('/journal');
        const opener = page.getByRole('button', { name: 'See Full Journey', exact: false });
        await opener.press('Enter');
        const panel = page.getByRole('dialog', { name: 'Your Reading Journey', exact: true });
        await expect(panel).toBeVisible();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        for (const control of [panel.getByRole('link', { name: 'Journey settings' }), panel.getByRole('button', { name: 'Close journey panel' })]) {
          const box = await control.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(320);
          expect(box.width).toBeGreaterThanOrEqual(43.99);
          expect(box.height).toBeGreaterThanOrEqual(43.99);
        }
        const card = panel.getByRole('list', { name: 'Your top most frequently appearing cards' }).locator('li').first().locator('span.text-main');
        expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        const row = panel.getByRole('group', { name: 'Major Arcana 0 to 10', exact: true });
        await row.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => row.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        for (const tab of await panel.getByRole('tab').all()) {
          await tab.focus();
          await tab.press('Enter');
          await expect(tab).toHaveAttribute('aria-selected', 'true');
          const box = await tab.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(320);
        }
        await panel.getByRole('button', { name: 'Close journey panel' }).press('Enter');
        await expect(panel).toHaveCount(0);
        await expect(opener).toBeFocused();
      } finally {
        await fixture.close();
      }
    });

    test('the Arcana map exposes named rows and supports keyboard scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      await page.addInitScript(value => {
        localStorage.setItem('tarot-onboarding-complete', 'true');
        localStorage.setItem('tarot_journal', JSON.stringify([value]));
      }, entry);
      try {
        await page.goto('/journal');
        const first = page.getByRole('group', { name: 'Major Arcana 0 to 10', exact: true });
        const second = page.getByRole('group', { name: 'Major Arcana 11 to 21', exact: true });
        await expect(first).toBeVisible();
        await first.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await second.focus();
        await page.keyboard.press('Shift+Tab');
        await expect(first).toBeFocused();
        expect(await first.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => first.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        await page.keyboard.press('Tab');
        await expect(second).toBeFocused();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => second.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        await expect(first.getByRole('img', { name: 'The Fool: appeared 1 times', exact: true })).toHaveCount(1);
        expect(await first.getByRole('img').count() + await second.getByRole('img').count()).toBe(22);
      } finally {
        await fixture.close();
      }
    });
  });
}
