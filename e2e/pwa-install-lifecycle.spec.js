import { test, expect } from './helpers/frontendTest.js';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';
const INSTALL_PREFERENCES_KEY = 'tableu-pwa-install-preferences';
const SNOOZE_DURATION = 7 * 24 * 60 * 60 * 1000;

async function openGuidance(page) {
  const install = page.locator('[data-pwa-footer] [data-pwa-install]');
  await page.bringToFront();
  await expect(install).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await install.focus();
  await expect.poll(() => install.evaluate(async button => {
    // Let WebKit finish the page-end scroll before sampling a pointer target.
    scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const remaining = document.documentElement.scrollHeight - innerHeight - scrollY;
    return remaining <= 1 && (hit === button || button.contains(hit));
  }), { message: 'The page-end install target must settle before activation' }).toBe(true);
  await install.click();
}

test.describe('Install guidance lifecycle', () => {
  test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

  test.beforeEach(async ({ context }) => {
    await context.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { user: null } }));
    await context.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
    await context.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  });

  for (const choice of ['Later', 'Already added']) {
    test(`an externally hidden guide stays closed after ${choice === 'Later' ? 'snooze expiry' : 'clearing the added choice'}`, async ({ page, context }) => {
      const started = Date.UTC(2026, 9, 8, 12);
      // Playwright's clock controls the whole context, including the other tab.
      await page.clock.install({ time: started });
      await page.goto('/governance-critique');
      const install = page.locator('[data-pwa-footer] [data-pwa-install]');
      const dialog = page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true });
      await openGuidance(page);
      await expect(dialog).toBeVisible();

      const other = await context.newPage();
      await other.goto('/governance-critique');
      await openGuidance(other);
      await other.getByRole('dialog').getByRole('button', { name: choice, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(install).toHaveCount(0);
      await expect(page.locator('#root')).toHaveJSProperty('inert', false);
      await expect(page.locator('main')).toBeFocused();

      if (choice === 'Later') {
        await page.clock.fastForward(SNOOZE_DURATION + 100);
      } else {
        await other.evaluate(key => localStorage.removeItem(key), INSTALL_PREFERENCES_KEY);
      }

      await expect(install).toBeVisible();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('#root')).toHaveJSProperty('inert', false);
      await expect(page.locator('main')).toBeFocused();
      await openGuidance(page);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(install).toBeFocused();
    });
  }
});
