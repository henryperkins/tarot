import { test, expect } from '@playwright/test';

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Offline recovery — ${platform}`, () => {
    test.use({ viewport: { width: 320, height: 800 }, serviceWorkers: 'block' });

    for (const theme of ['dark', 'light']) {
      test(`saved ${theme} theme, keyboard actions and enlarged text work without other assets`, async ({ page }) => {
        await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
        await page.route('**/*', route => new URL(route.request().url()).pathname === '/offline.html'
          ? route.continue() : route.abort());
        await page.goto('/offline.html');
        await expect(page.getByRole('heading', { name: 'Offline for now' })).toBeVisible();
        await expect(page.locator('body')).toHaveCSS('background-color', theme === 'light' ? 'rgb(250, 250, 250)' : 'rgb(15, 14, 19)');
        await page.keyboard.press('Tab');
        const journal = page.getByRole('link', { name: 'Open Journal' });
        await expect(journal).toBeFocused();
        await expect(journal).toHaveAttribute('href', '/journal');
        await page.keyboard.press('Tab');
        const retry = page.getByRole('button', { name: 'Retry connection' });
        await expect(retry).toBeFocused();
        await Promise.all([page.waitForEvent('framenavigated'), retry.press('Enter')]);
        await expect(page.getByRole('heading', { name: 'Offline for now' })).toBeVisible();
        await page.addStyleTag({ content: 'html { font-size: 200%; }' });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const control of [journal, retry]) {
          const box = await control.boundingBox();
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      });
    }

    test('blocked storage still presents usable recovery actions', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        Storage.prototype.getItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
      });
      await page.goto('/offline.html');
      await expect(page.getByRole('heading', { name: 'Offline for now' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Retry connection' })).toBeEnabled();
      expect(errors).toEqual([]);
    });
  });
}

test('service worker serves recovery when the cached app shell is unavailable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    await page.goto('/offline.html');
    await page.evaluate(async () => {
      localStorage.setItem('tarot-theme', 'light');
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        await cache.delete('/');
      }
    });
    await context.setOffline(true);
    await page.goto('/uncached-offline-route');
    await expect(page.getByRole('heading', { name: 'Offline for now' })).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 250)');
  } finally {
    await context.close();
  }
});
