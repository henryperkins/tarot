import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading } from './helpers/narrativeFixtures.js';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36';

async function offerInstall(page, outcome = 'dismissed', fails = false) {
  await page.evaluate(({ outcome, fails }) => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => {
      window.installPromptCalls = (window.installPromptCalls || 0) + 1;
      return fails ? Promise.reject(new Error('Fixture prompt failure')) : Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(event);
  }, { outcome, fails });
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Home-screen installation — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page, { signedOut: true });
      await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
    });

    test.afterEach(async () => fixture.close());

    test.describe('iPhone guidance', () => {
      test.use({ userAgent: IPHONE_UA });

      test('the compact branded install action lives beside the bottom reading controls', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/');
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        const add = dock.getByRole('button', { name: 'Add to Home Screen', exact: true });
        await expect(add).toBeInViewport();
        await expect(page.getByRole('navigation', { name: 'Primary navigation' })
          .getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        const bounds = await add.boundingBox();
        expect(bounds.width).toBe(44);
        expect(bounds.height).toBe(44);
        expect(bounds.y).toBeGreaterThan(568 * 0.7);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
        const draw = await dock.getByRole('button', { name: 'Draw cards', exact: true }).boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(draw.x + draw.width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        await page.goto('/reading');
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(1);
        await expect(dock.getByRole('button', { name: 'Add to Home Screen', exact: true })).toBeInViewport();
      });

      for (const theme of ['dark', 'light']) {
        test(`home-screen steps trap and restore focus without clipping (${theme})`, async ({ page }) => {
          await page.setViewportSize({ width: 320, height: 568 });
          await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
          await page.goto('/pricing');
          const add = page.getByRole('button', { name: 'Add to Home Screen', exact: true });
          await expect(add).toBeVisible();
          await expect(page.getByRole('region', { name: 'Plan upgrade' }).getByRole('button', { name: 'Add to Home Screen', exact: true })).toBeInViewport();
          const upgrade = await page.getByRole('button', { name: 'Go Plus', exact: true }).boundingBox();
          const install = await add.boundingBox();
          expect(install.width).toBe(44);
          expect(install.height).toBe(44);
          expect(install.x).toBeGreaterThanOrEqual(upgrade.x + upgrade.width);
          await add.click();
          const dialog = page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true });
          await expect(dialog).toBeVisible();
          await expect(dialog).toContainText('Safari');
          await expect(dialog).toContainText('Share');
          await expect(dialog).toContainText('Open as Web App');
          const close = dialog.getByRole('button', { name: 'Close home-screen instructions', exact: true });
          await expect(close).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(close).toBeFocused();
          expect(await page.locator('#root').evaluate(element => element.inert)).toBe(true);
          const bounds = await dialog.boundingBox();
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
          const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
          expect(accessibility.violations).toEqual([]);
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await expect(add).toBeFocused();
          expect(await page.locator('#root').evaluate(element => element.inert)).toBe(false);
        });
      }

      test('standalone iOS hides installation guidance', async ({ page }) => {
        await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
      });

      test('installation closes an open guide and removes its control', async ({ page }) => {
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Go Plus', exact: true })).toBeFocused();
      });

      test('completed readings keep installation at the trailing thumb edge', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await startReading(page, fixture);
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        await expect(dock.getByRole('button', { name: /^Save reading to journal/ })).toBeVisible();
        const install = dock.getByRole('button', { name: 'Add to Home Screen', exact: true });
        await expect(install).toBeInViewport({ ratio: 1 });
        expect((await install.boundingBox()).x).toBeGreaterThan(320 * 0.75);
      });

      test('page-end installation respects landscape safe areas', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.goto('/journal');
        await page.evaluate(() => {
          document.documentElement.style.setProperty('--safe-pad-left', '32px');
          document.documentElement.style.setProperty('--safe-pad-right', '64px');
        });
        const install = page.locator('[data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
        await install.scrollIntoViewIfNeeded();
        const bounds = await install.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(32);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(844 - 64);
      });

      test('enlarged annual pricing keeps bottom actions and final content reachable', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/pricing');
        await page.getByRole('button', { name: /^Annual/ }).click();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const dock = page.getByRole('region', { name: 'Plan upgrade', exact: true });
        const install = dock.getByRole('button', { name: 'Add to Home Screen', exact: true });
        await expect(install).toBeInViewport({ ratio: 1 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        const restore = page.getByRole('button', { name: 'Restore purchases', exact: true }).last();
        await expect.poll(async () => {
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          return restore.evaluate(element => (
            element.getBoundingClientRect().bottom
            - document.querySelector('[aria-label="Plan upgrade"]').getBoundingClientRect().top
          ));
        }).toBeLessThanOrEqual(0);
        await dock.getByRole('button', { name: 'Go Plus', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      });
    });

    test.describe('browser install prompt', () => {
      test.use({ userAgent: DESKTOP_UA });

      test.describe('touch landscape', () => {
        test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

        test('long reading labels stay inside their own targets in landscape', async ({ page }) => {
          await page.goto('/');
          const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
          const draw = dock.getByRole('button', { name: 'Draw cards', exact: true });
          await expect(draw).toBeVisible();
          await offerInstall(page);
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await draw.locator('span').evaluate(element => { element.textContent = 'Draw cards for your daily reflection'; });
          await dock.locator('.mobile-action-coach-label').evaluate(element => { element.textContent = 'Guided intention coaching'; });
          const install = dock.getByRole('button', { name: 'Install Tableu', exact: true });
          await expect(install).toBeInViewport({ ratio: 1 });
          const geometry = await draw.evaluate(button => {
            const range = document.createRange();
            range.selectNodeContents(button.querySelector('span'));
            return { text: range.getBoundingClientRect().toJSON(), button: button.getBoundingClientRect().toJSON() };
          });
          expect(geometry.text.left).toBeGreaterThanOrEqual(geometry.button.left);
          expect(geometry.text.right).toBeLessThanOrEqual(geometry.button.right);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
          await dock.getByRole('button', { name: 'Open guided intention coach', exact: true }).focus();
          await page.keyboard.press('Tab');
          await expect(draw).toBeFocused();
          await expect(draw).toBeInViewport({ ratio: 0.99 });
          const focusedAction = await draw.boundingBox();
          const visibleTasks = await dock.locator('.mobile-action-tasks').boundingBox();
          expect(focusedAction.x).toBeGreaterThanOrEqual(visibleTasks.x - 1);
          expect(focusedAction.x + focusedAction.width).toBeLessThanOrEqual(visibleTasks.x + visibleTasks.width + 1);
          await page.keyboard.press('Tab');
          await expect(install).toBeFocused();
          const scrollY = await page.evaluate(() => window.scrollY);
          await install.press('Enter');
          await expect(install).toHaveCount(0);
          await expect(draw).toBeFocused();
          await expect(draw).toBeInViewport({ ratio: 0.99 });
          expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
        });

        test('prompt dismissal reveals the restored reading action without scrolling the page', async ({ page }) => {
          await page.setViewportSize({ width: 320, height: 568 });
          await startReading(page, fixture);
          await page.setViewportSize({ width: 844, height: 390 });
          const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
          const save = dock.getByRole('button', { name: /^Save reading to journal/ });
          const next = dock.getByRole('button', { name: /^Start a new reading/ });
          await offerInstall(page);
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await save.locator('span').evaluate(element => { element.textContent = 'Save this reading in your personal journal'; });
          await next.locator('span').evaluate(element => { element.textContent = 'Start a new reading for your next reflection'; });
          const tasks = dock.locator('.mobile-action-tasks');
          await tasks.evaluate(element => { element.scrollLeft = element.scrollWidth; });
          expect(await tasks.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
          expect((await save.boundingBox()).x).toBeLessThan((await tasks.boundingBox()).x);
          const install = dock.getByRole('button', { name: 'Install Tableu', exact: true });
          await install.focus();
          const scrollY = await page.evaluate(() => window.scrollY);
          await install.press('Enter');
          await expect(install).toHaveCount(0);
          await expect(save).toBeFocused();
          await expect(save).toBeInViewport({ ratio: 1 });
          const action = await save.boundingBox();
          const group = await tasks.boundingBox();
          expect(action.x).toBeGreaterThanOrEqual(group.x);
          expect(action.x + action.width).toBeLessThanOrEqual(group.x + group.width + 1);
          expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
        });
      });

      test('unsupported browsers keep the navigation free of install controls', async ({ page }) => {
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
      });

      test('the bottom install action restores keyboard focus to Draw cards', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/');
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        await expect(dock.getByRole('button', { name: 'Draw cards', exact: true })).toBeVisible();
        await offerInstall(page);
        const install = dock.getByRole('button', { name: 'Install Tableu', exact: true });
        await install.focus();
        await install.press('Enter');
        await expect(install).toHaveCount(0);
        await expect(dock.getByRole('button', { name: 'Draw cards', exact: true })).toBeFocused();
        const dockHeight = (await dock.boundingBox()).height;
        await offerInstall(page, 'dismissed', true);
        await install.focus();
        await install.press('Enter');
        const status = page.getByRole('status').filter({ hasText: 'browser' });
        await expect(status).toBeInViewport({ ratio: 1 });
        // The page transition moves fixed descendants briefly. Compare both
        // boxes in one frame rather than mixing two transition positions.
        const { bounds, dockBounds } = await status.evaluate(element => ({
          bounds: element.getBoundingClientRect().toJSON(),
          dockBounds: element.closest('[aria-label="Primary mobile actions"]').getBoundingClientRect().toJSON()
        }));
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(dockBounds.y);
        expect(dockBounds.height).toBe(dockHeight);
        await expect(dock.getByRole('button', { name: 'Draw cards', exact: true })).toBeFocused();
      });

      test('installation leaves focus in the dock while interpretation is running', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await startReading(page, fixture, { complete: false });
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        await expect(dock.locator('[data-mobile-primary]')).toBeDisabled();
        await offerInstall(page, 'dismissed', true);
        const install = dock.getByRole('button', { name: 'Install Tableu', exact: true });
        await expect(install).toBeInViewport({ ratio: 1 });
        expect((await install.boundingBox()).x).toBeGreaterThan(320 * 0.75);
        await install.focus();
        await install.press('Enter');
        await expect(install).toHaveCount(0);
        await expect(dock).toBeFocused();
        await expect(dock.getByRole('button', { name: 'Start a new reading (resets the current spread)', exact: true })).toBeEnabled();
        const status = page.getByRole('status').filter({ hasText: 'browser' });
        await expect(status).toBeVisible();
        const bounds = await status.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
      });

      test('a deferred prompt survives route navigation and runs once', async ({ page }) => {
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Journal', exact: true })).toBeVisible();
        await offerInstall(page, 'accepted');
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Journal', exact: true }).click();
        await expect(page).toHaveURL(/\/journal$/);
        await expect(page.locator('main.journal-page')).toBeFocused();
        await expect(page.locator('[data-pwa-footer]').getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Install Tableu', exact: true }).click();
        await expect.poll(() => page.evaluate(() => window.installPromptCalls)).toBe(1);
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
        await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
        await offerInstall(page);
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
      });

      test('dismissal consumes the prompt until the browser offers another', async ({ page }) => {
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Journal', exact: true }).click();
        await expect(page).toHaveURL(/\/journal$/);
        await expect(page.locator('main.journal-page')).toBeFocused();
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
        await offerInstall(page);
        await page.getByRole('button', { name: 'Install Tableu', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeFocused();
        await offerInstall(page, 'accepted');
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
        expect(await page.evaluate(() => window.installPromptCalls)).toBe(1);
        const install = page.getByRole('button', { name: 'Install Tableu', exact: true });
        await install.focus();
        await install.press('Enter');
        await expect(install).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeFocused();
        expect(await page.evaluate(() => window.installPromptCalls)).toBe(2);
      });

      test('prompt failures show a safe fallback and recover on a fresh offer', async ({ page }) => {
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
        await offerInstall(page, 'dismissed', true);
        await page.getByRole('button', { name: 'Install Tableu', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'browser' })).toBeVisible();
        await offerInstall(page);
        await expect(page.getByRole('status').filter({ hasText: 'browser' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
      });
    });
  });
}
