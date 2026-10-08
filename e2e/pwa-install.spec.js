import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading } from './helpers/narrativeFixtures.js';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36';
const INSTALL_PREFERENCES_KEY = 'tableu-pwa-install-preferences';
const JOURNAL_ENTRY = {
  id: 'install-controls-reading', ts: Date.now(), spread: 'Celtic Cross', spreadKey: 'celtic',
  question: 'What should I make room for today?',
  cards: [
    { name: 'The Fool', position: 'Present', orientation: 'Upright' },
    { name: 'The High Priestess', position: 'Challenge', orientation: 'Upright' }
  ],
  personalReading: 'Make room for a quiet moment before choosing the next step.'
};

async function expectInstallHitTarget(install, { scrollToEnd = true } = {}) {
  await install.page().evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect.poll(() => install.evaluate(async (button, scrollToEnd) => {
    if (scrollToEnd) {
      scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const rect = button.getBoundingClientRect();
    return [
      // Probe the actual rounded target rather than its transparent corners.
      [rect.left + 4, rect.top + rect.height / 2], [rect.right - 4, rect.top + rect.height / 2],
      [rect.left + rect.width / 2, rect.top + 4], [rect.left + rect.width / 2, rect.bottom - 4],
      [rect.left + rect.width / 2, rect.top + rect.height / 2]
    ].map(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit === button || button.contains(hit);
    });
  }, scrollToEnd), { message: 'All five points must activate the visible install button' }).toEqual([true, true, true, true, true]);
}

function installErrorToast(page) {
  return page.locator('[data-toast]').filter({ hasText: 'browser' });
}

async function expectJournalFocusInView(page) {
  const focused = page.locator('main.journal-page:focus, main.journal-page :focus');
  await expect(focused).toHaveCount(1);
  await expect(focused).toBeInViewport();
  expect(await focused.evaluate(element => element.closest('[data-pwa-footer]') === null)).toBe(true);
}

async function expectPageFocusInView(page) {
  const focused = page.locator('main:focus, main :focus');
  await expect(focused).toHaveCount(1);
  await expect(focused).toBeInViewport();
  expect(await focused.evaluate(element => element.closest('[data-pwa-footer]') === null)).toBe(true);
}

async function offerInstall(page, outcome = 'dismissed', fails = false) {
  return page.evaluate(({ outcome, fails }) => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => {
      window.installPromptCalls = (window.installPromptCalls || 0) + 1;
      return fails ? Promise.reject(new Error('Fixture prompt failure')) : Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(event);
    return event.defaultPrevented;
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

      test('the branded install action lives at page end and leaves the narrow reading dock clear', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/');
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        const add = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
        await expect(add).toBeVisible();
        await expect(dock.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        const coachLabel = dock.getByRole('button', { name: 'Open guided intention coach', exact: true }).locator('span');
        await expect(coachLabel).toBeVisible();
        await expect(coachLabel).toHaveText('Coach');
        await expectInstallHitTarget(add);
        await expect(add).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole('navigation', { name: 'Primary navigation' })
          .getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        const bounds = await add.boundingBox();
        expect(bounds.width).toBeGreaterThan(100);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
        const icon = add.locator('img');
        await expect(icon).toHaveAttribute('src', '/icons/icon-maskable-512.png');
        await expect.poll(() => icon.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
        const affordance = await add.evaluate(button => {
          const style = getComputedStyle(button);
          return { border: parseFloat(style.borderTopWidth), background: style.backgroundColor };
        });
        expect(affordance.border).toBeGreaterThan(0);
        expect(affordance.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        await page.goto('/reading');
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(1);
        await expect(dock.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await expectInstallHitTarget(page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true }));
      });

      for (const theme of ['dark', 'light']) {
        test(`home-screen steps trap and restore focus without clipping (${theme})`, async ({ page }) => {
          await page.setViewportSize({ width: 320, height: 568 });
          await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
          await page.goto('/pricing');
          const add = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
          await expect(add).toBeVisible();
          const dock = page.getByRole('region', { name: 'Plan upgrade' });
          await expect(dock.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
          await expectInstallHitTarget(add);
          const install = await add.boundingBox();
          expect(install.width).toBeGreaterThan(100);
          expect(install.height).toBeGreaterThanOrEqual(44);
          expect(install.y + install.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
          await add.click();
          const dialog = page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true });
          await expect(dialog).toBeVisible();
          await expect(dialog).toContainText('Safari');
          await expect(dialog).toContainText('Share');
          await expect(dialog).toContainText('Open as Web App');
          const close = dialog.getByRole('button', { name: 'Close home-screen instructions', exact: true });
          await expect(close).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(dialog.getByRole('button', { name: 'Later', exact: true })).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(dialog.getByRole('button', { name: 'Already added', exact: true })).toBeFocused();
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
          await expect(add).toBeInViewport({ ratio: 1 });
          expect(await page.locator('#root').evaluate(element => element.inert)).toBe(false);
        });
      }

      test('standalone iOS hides installation guidance', async ({ page }) => {
        await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
      });

      test('Later hides the guide across routes and reloads for seven days', async ({ page }) => {
        const started = Date.UTC(2026, 9, 8, 12);
        await page.clock.setFixedTime(started);
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Later', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Journal', exact: true }).click();
        await expect(page).toHaveURL(/\/journal$/);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await page.clock.setFixedTime(started + 6 * 86_400_000);
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await page.clock.setFixedTime(started + 8 * 86_400_000);
        await page.reload();
        await expect(page.locator('[data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true })).toBeVisible();
      });

      test('Already added remembers the choice after navigation and reopening Safari', async ({ page }) => {
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Already added', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Journal', exact: true }).click();
        await expect(page).toHaveURL(/\/journal$/);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).hasAddedToHomeScreen, INSTALL_PREFERENCES_KEY)).toBe(true);
      });

      for (const mode of ['throw', 'silent']) {
        test(`a ${mode} storage write hides guidance for the visit and explains the limit`, async ({ page }) => {
          await page.addInitScript(({ key, mode }) => {
            const setItem = Storage.prototype.setItem;
            Storage.prototype.setItem = function (name, value) {
              if (name === key) {
                if (mode === 'throw') throw new DOMException('Fixture storage denial', 'SecurityError');
                return;
              }
              return setItem.call(this, name, value);
            };
          }, { key: INSTALL_PREFERENCES_KEY, mode });
          await page.goto('/pricing');
          await page.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
          await page.getByRole('dialog').getByRole('button', { name: 'Later', exact: true }).click();
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
          const notice = page.locator('[data-toast]').filter({ hasText: 'Hidden for this visit' });
          await expect(notice).toBeInViewport();
          await expect(notice).toContainText('could not save this choice');
          await page.getByRole('button', { name: 'Journal', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
          await page.reload();
          await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toBeVisible();
        });
      }

      test('unreadable install preferences keep the page and guidance usable', async ({ page }) => {
        await page.addInitScript(key => {
          const getItem = Storage.prototype.getItem;
          Storage.prototype.getItem = function (name) {
            if (name === key) throw new DOMException('Fixture storage denial', 'SecurityError');
            return getItem.call(this, name);
          };
        }, INSTALL_PREFERENCES_KEY);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Draw cards', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        expect(errors).toEqual([]);
      });

      test('installation closes an open guide and removes its control', async ({ page }) => {
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        await expectPageFocusInView(page);
      });

      test('completed readings keep installation at page end and preserve journal actions', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await startReading(page, fixture);
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        await expect(dock.getByRole('button', { name: /^Save reading to journal/ })).toBeVisible();
        await expect(dock.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
        await expectInstallHitTarget(install);
        await expect(install).toBeInViewport({ ratio: 1 });
        expect((await install.boundingBox()).y + (await install.boundingBox()).height).toBeLessThanOrEqual((await dock.boundingBox()).y);
      });

      test('closing an enlarged landscape guide restores its page-end opener without another scroll', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await startReading(page, fixture);
        await page.setViewportSize({ width: 844, height: 390 });
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
        await expectInstallHitTarget(install);
        await install.focus();
        await install.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true });
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(install).toBeFocused();
        await expect(install).toBeInViewport({ ratio: 1 });
        await expectInstallHitTarget(install, { scrollToEnd: false });
      });

      test.describe('safe-area reflow', () => {
        test.use({ isMobile: true, hasTouch: true });

        test.describe('initial landscape viewport', () => {
          test.use({ viewport: { width: 844, height: 390 } });

          test('a fresh enlarged landscape reading leaves its page-end action above the dock', async ({ page }) => {
            await page.addInitScript(() => {
              window.addEventListener('DOMContentLoaded', () => {
                document.documentElement.style.setProperty('font-size', '200%', 'important');
                document.documentElement.style.setProperty('--safe-pad-bottom', '64px');
              }, { once: true });
            });
            await page.goto('/');
            const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
            await page.evaluate(() => document.fonts.ready);
            await expect.poll(() => install.evaluate(async button => {
              scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              return document.querySelector('.mobile-action-bar').getBoundingClientRect().top - button.getBoundingClientRect().bottom;
            }), { message: 'The freshly rendered install action must clear the dock before hit testing' }).toBeGreaterThanOrEqual(0);
            await expectInstallHitTarget(install);
            const bounds = await install.boundingBox();
            const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
            expect(bounds.y + bounds.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
          });
        });

        for (const textPercent of [100, 200]) {
          test(`the page-end reading action stays clickable as landscape bottom padding grows (${textPercent}% text)`, async ({ page }) => {
            await page.setViewportSize({ width: 320, height: 568 });
            await startReading(page, fixture);
            await page.setViewportSize({ width: 844, height: 390 });
            await page.addStyleTag({ content: `html { font-size: ${textPercent}% !important; }` });
            const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
            const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
            await expect(dock).toBeVisible();
            await expectInstallHitTarget(install);

            // Browser chrome can update the safe area after the orientation
            // reflow. This changes dock padding without changing its content.
            for (const safeBottom of [34, 64]) {
              await page.evaluate(value => document.documentElement.style.setProperty('--safe-pad-bottom', `${value}px`), safeBottom);
              await expectInstallHitTarget(install);
              const bounds = await install.boundingBox();
              expect(bounds.y + bounds.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
            }

            await install.click();
            await expect(page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true })).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(install).toBeFocused();
            await expectInstallHitTarget(install, { scrollToEnd: false });
          });

          test(`the page-end pricing action stays clickable as bottom padding grows (${textPercent}% text)`, async ({ page }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto('/pricing');
            await page.addStyleTag({ content: `html { font-size: ${textPercent}% !important; }` });
            const dock = page.getByRole('region', { name: 'Plan upgrade', exact: true });
            const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
            await expect(dock).toBeVisible();
            await expectInstallHitTarget(install);
            await page.evaluate(() => document.documentElement.style.setProperty('--safe-pad-bottom', '100px'));
            await expectInstallHitTarget(install);
            const bounds = await install.boundingBox();
            expect(bounds.y + bounds.height).toBeLessThanOrEqual((await dock.boundingBox()).y);
            await install.click();
            await expect(page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true })).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(install).toBeFocused();
            await expectInstallHitTarget(install, { scrollToEnd: false });
          });
        }
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

      for (const viewport of [{ width: 390, height: 844 }, { width: 800, height: 1000 }, { width: 1024, height: 768 }]) {
        test(`populated journal leaves its page-end install button clickable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await page.addInitScript(entry => localStorage.setItem('tarot_journal', JSON.stringify(
            Array.from({ length: 10 }, (_, index) => ({ ...entry, id: `${entry.id}-${index}`, ts: entry.ts - index * 60_000 }))
          )), JOURNAL_ENTRY);
          await page.goto('/journal');
          await expect(page.getByRole('heading', { name: 'Celtic Cross', exact: true })).toHaveCount(10);
          await page.evaluate(() => document.fonts.ready);
          const install = page.locator('main.journal-page [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
          let previousHeight = 0;
          await expect.poll(async () => {
            const end = await page.evaluate(async () => {
              scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
              await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              return { height: document.documentElement.scrollHeight, remaining: document.documentElement.scrollHeight - innerHeight - scrollY };
            });
            const stableHeight = end.height === previousHeight;
            previousHeight = end.height;
            return stableHeight && end.remaining <= 1
              && await page.getByRole('button', { name: 'Jump to journal filters', exact: true }).count() === 1;
          }, { timeout: 15000, message: 'The loaded journal must reach its stable end with floating controls mounted' }).toBe(true);
          await expect(page.getByRole('button', { name: 'Jump to journal filters', exact: true })).toBeInViewport();
          // The floating controls reserve their space after the first scroll.
          // Reach the current page end after that measurement has settled.
          await expect.poll(async () => {
            await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
            return install.evaluate(button => button.getBoundingClientRect().bottom - innerHeight);
          }).toBeLessThanOrEqual(0);
          await expect(install).toBeInViewport({ ratio: 1 });
          await expectInstallHitTarget(install);
          await install.focus();
          await expect(install).toBeFocused();
          await expectInstallHitTarget(install);
          await install.press('Enter');
          await expect(page.getByRole('dialog', { name: 'Add Tableu to your Home Screen', exact: true })).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(install).toBeFocused();
        });
      }

      for (const { path, chunk, heading } of [
        { path: '/journal', chunk: 'Journal', heading: 'Your Tarot Journal' },
        { path: '/account', chunk: 'AccountPage', heading: 'Settings' }
      ]) {
        test(`cold ${path} visits keep installation out of the route loader`, async ({ page }) => {
          let release;
          let held = false;
          const gate = new Promise(resolve => { release = resolve; });
          await page.route(new RegExp(`/(?:assets/${chunk}-[^/]+\\.js|src/(?:components|pages)/${chunk}\\.jsx)(?:\\?.*)?$`), async route => {
            held = true;
            await gate;
            await route.continue();
          });
          try {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            await expect.poll(() => held, 'The actual lazy route chunk must be held').toBe(true);
            await expect(page.getByRole('status').filter({ hasText: 'Loading…' })).toBeVisible();
            await expect(page.locator('[data-pwa-footer]')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
          } finally {
            release();
          }
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
          await expect(page.locator('main [data-pwa-footer]')).toHaveCount(1);
        });
      }

      test('page-end installation uses each desktop page content column', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        for (const path of ['/reset-password', '/verify-email', '/design']) {
          await page.goto(path);
          const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
          await install.scrollIntoViewIfNeeded();
          const geometry = await install.evaluate(button => {
            const main = button.closest('main');
            const style = getComputedStyle(main);
            const column = main.getBoundingClientRect();
            const target = button.getBoundingClientRect();
            return { left: column.left + parseFloat(style.paddingLeft), right: column.right - parseFloat(style.paddingRight), target: target.toJSON() };
          });
          expect(geometry.target.x, path).toBeGreaterThanOrEqual(geometry.left);
          expect(geometry.target.x + geometry.target.width, path).toBeLessThanOrEqual(geometry.right + 1);
        }
      });

      test('enlarged annual pricing keeps bottom actions and final content reachable', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/pricing');
        await page.getByRole('button', { name: /^Annual/ }).click();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const dock = page.getByRole('region', { name: 'Plan upgrade', exact: true });
        await expect(dock.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
        const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Add to Home Screen', exact: true });
        await expectInstallHitTarget(install);
        await expect(install).toBeInViewport({ ratio: 1 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        const restore = page.getByRole('button', { name: 'Restore purchases', exact: true }).last();
        await expect.poll(async () => {
          await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
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
          await dock.getByRole('button', { name: 'Open guided intention coach', exact: true }).locator('span').evaluate(element => { element.textContent = 'Guided intention coaching'; });
          await page.evaluate(() => document.fonts.ready);
          await expect.poll(() => draw.locator('..').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
          const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Install Tableu', exact: true });
          await expect(dock.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
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
          const visibleTasks = await draw.locator('..').boundingBox();
          expect(focusedAction.x).toBeGreaterThanOrEqual(visibleTasks.x - 1);
          expect(focusedAction.x + focusedAction.width).toBeLessThanOrEqual(visibleTasks.x + visibleTasks.width + 1);
          await expectInstallHitTarget(install);
          await install.focus();
          await install.press('Enter');
          await expect(install).toHaveCount(0);
          await expectPageFocusInView(page);
          await expect(draw).toBeInViewport({ ratio: 0.99 });
        });

        test('page-end prompt dismissal leaves the landscape reading actions available', async ({ page }) => {
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
          const tasks = save.locator('..');
          await tasks.evaluate(element => { element.scrollLeft = element.scrollWidth; });
          expect(await tasks.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
          expect((await save.boundingBox()).x).toBeLessThan((await tasks.boundingBox()).x);
          const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Install Tableu', exact: true });
          await expectInstallHitTarget(install);
          await install.focus();
          await install.press('Enter');
          await expect(install).toHaveCount(0);
          await expectPageFocusInView(page);
          await save.focus();
          await expect(save).toBeFocused();
          await expect(save).toBeInViewport({ ratio: 1 });
          const action = await save.boundingBox();
          const group = await tasks.boundingBox();
          expect(action.x).toBeGreaterThanOrEqual(group.x);
          expect(action.x + action.width).toBeLessThanOrEqual(group.x + group.width + 1);
        });

        test('a narrow landscape dock reveals the whole focus ring after labels enlarge', async ({ page }) => {
          await page.setViewportSize({ width: 568, height: 320 });
          await page.goto('/');
          const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
          const draw = dock.getByRole('button', { name: 'Draw cards', exact: true });
          const coach = dock.getByRole('button', { name: 'Open guided intention coach', exact: true });
          await expect(draw).toBeInViewport({ ratio: 1 });
          await page.evaluate(() => document.fonts.ready);
          await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
          await draw.locator('span').evaluate(element => { element.textContent = 'Draw cards for your daily reflection'; });
          await coach.locator('span').evaluate(element => { element.textContent = 'Guided intention coaching'; });
          await coach.focus();
          await page.keyboard.press('Tab');
          await expect(draw).toBeFocused();
          await expect(draw).toBeInViewport({ ratio: 1 });
          await expect.poll(() => draw.evaluate(button => {
            const action = button.getBoundingClientRect();
            const group = button.parentElement.getBoundingClientRect();
            return Math.min(action.left - group.left, group.right - action.right, action.top - group.top, group.bottom - action.bottom);
          }), { message: 'The full 4px focus ring must stay inside the scrolling action group' }).toBeGreaterThanOrEqual(3.5);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(568);
        });
      });

      test('unsupported browsers keep the navigation free of install controls', async ({ page }) => {
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add to Home Screen', exact: true })).toHaveCount(0);
      });

      for (const valid of [true, false]) {
        test(`a ${valid ? 'valid' : 'unavailable'} shared reading leaves the browser install offer available`, async ({ page }) => {
          const token = 'native-install-fixture';
          await page.route(`**/api/share/${token}`, route => route.fulfill(valid ? {
            json: { token, title: 'Shared install fixture', entries: [JOURNAL_ENTRY], notes: [], meta: { entryCount: 1 } }
          } : { status: 404, json: { error: 'This share link is unavailable.' } }));
          await page.goto(`/share/${token}`);
          await expect(page.getByRole('heading', { level: 1, name: valid ? 'Shared install fixture' : 'This share link is unavailable.', exact: true })).toBeVisible();
          expect(await offerInstall(page)).toBe(false);
          await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
          await page.getByRole('link', { name: valid ? 'Account' : 'Return to Tableu', exact: true }).first().click();
          await expect(page.locator('[data-pwa-footer]')).toBeAttached();
          await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
          expect(await offerInstall(page)).toBe(true);
          await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
        });
      }

      for (const { path, heading } of [
        { path: '/admin', heading: 'Admin Dashboard' },
        { path: '/auth/callback', heading: 'Login failed' }
      ]) {
        test(`${path} leaves an install offer uncanceled when it has no custom host`, async ({ page }) => {
          await page.goto(path);
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
          expect(await offerInstall(page)).toBe(false);
          await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
          if (path === '/auth/callback') {
            await page.getByRole('button', { name: 'Back to account', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
          }
        });
      }

      for (const { path, chunk, heading } of [
        { path: '/journal', chunk: 'Journal', heading: 'Your Tarot Journal' },
        { path: '/account', chunk: 'AccountPage', heading: 'Settings' }
      ]) {
        test(`an offer during cold ${path} loading stays native and is not cached later`, async ({ page }) => {
          let release;
          let held = false;
          const gate = new Promise(resolve => { release = resolve; });
          await page.route(new RegExp(`/(?:assets/${chunk}-[^/]+\\.js|src/(?:components|pages)/${chunk}\\.jsx)(?:\\?.*)?$`), async route => {
            held = true;
            await gate;
            await route.continue();
          });
          try {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            await expect.poll(() => held).toBe(true);
            await expect(page.getByRole('status').filter({ hasText: 'Loading…' })).toBeVisible();
            expect(await offerInstall(page)).toBe(false);
            await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
          } finally {
            release();
          }
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
          expect(await offerInstall(page)).toBe(true);
          await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
        });
      }

      test('a late handset install offer preserves the primary and coach hit targets', async ({ page }) => {
        await page.goto('/');
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        const draw = dock.getByRole('button', { name: 'Draw cards', exact: true });
        const coach = dock.getByRole('button', { name: 'Open guided intention coach', exact: true });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await expect.poll(() => page.locator('.page-transition').evaluate(element => getComputedStyle(element).transform)).toBe('none');
        await expect(draw).toBeInViewport();
        await expect(coach).toBeInViewport();
        await page.evaluate(() => document.fonts.ready);
        const before = { draw: await draw.boundingBox(), coach: await coach.boundingBox() };
        const thumbPoint = { x: before.draw.x + before.draw.width - 4, y: before.draw.y + before.draw.height / 2 };
        await offerInstall(page);
        await expect(page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
        await expect(dock.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
        const after = { draw: await draw.boundingBox(), coach: await coach.boundingBox() };
        for (const name of ['draw', 'coach']) {
          for (const axis of ['x', 'y', 'width', 'height']) {
            expect(Math.abs(after[name][axis] - before[name][axis]), `${name} ${axis} must remain stable`).toBeLessThanOrEqual(1);
          }
        }
        expect(await draw.evaluate((button, point) => button.contains(document.elementFromPoint(point.x, point.y)), thumbPoint)).toBe(true);
      });

      test('page-end prompt consumption restores local focus without leaving a dock slot', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto('/');
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        await expect(dock.getByRole('button', { name: 'Draw cards', exact: true })).toBeVisible();
        const coachLabel = dock.getByRole('button', { name: 'Open guided intention coach', exact: true }).locator('span');
        await expect(coachLabel).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await expect(dock.getByRole('button', { name: 'Draw cards', exact: true })).toBeInViewport({ ratio: 1 });
        const drawBounds = await dock.getByRole('button', { name: 'Draw cards', exact: true }).boundingBox();
        const tasks = await dock.getByRole('button', { name: 'Draw cards', exact: true }).locator('..').boundingBox();
        expect(tasks.x + tasks.width - drawBounds.x - drawBounds.width).toBeLessThanOrEqual(12);
        await offerInstall(page);
        const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Install Tableu', exact: true });
        await expectInstallHitTarget(install);
        await install.focus();
        await install.press('Enter');
        await expect(install).toHaveCount(0);
        await expectPageFocusInView(page);
        await expect(coachLabel).toBeVisible();
        await expect(dock.getByRole('button', { name: 'Install Tableu', exact: true })).toHaveCount(0);
        expect(await dock.getByRole('button', { name: 'Draw cards', exact: true }).boundingBox()).toEqual(drawBounds);
        const dockHeight = (await dock.boundingBox()).height;
        await offerInstall(page, 'dismissed', true);
        await expectInstallHitTarget(install);
        await install.focus();
        await install.press('Enter');
        const toast = installErrorToast(page);
        await expect(toast).toBeInViewport({ ratio: 1 });
        const bounds = await toast.boundingBox();
        const dockBounds = await dock.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(dockBounds.y);
        expect(dockBounds.height).toBe(dockHeight);
        await expectPageFocusInView(page);
        await toast.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
        await expect(toast).toHaveCount(0);
      });

      test('page-end installation preserves pending interpretation and local focus', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await startReading(page, fixture, { complete: false });
        const dock = page.getByRole('navigation', { name: 'Primary mobile actions', exact: true });
        await expect(dock.getByRole('button', { name: /^Interpreting cards/ })).toBeDisabled();
        await offerInstall(page, 'dismissed', true);
        const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Install Tableu', exact: true });
        await expectInstallHitTarget(install);
        await expect(install).toBeInViewport({ ratio: 1 });
        await install.focus();
        await install.press('Enter');
        await expect(install).toHaveCount(0);
        await expectPageFocusInView(page);
        await expect(dock.getByRole('button', { name: 'Start a new reading (resets the current spread)', exact: true })).toBeEnabled();
        const status = installErrorToast(page);
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
        await expectJournalFocusInView(page);
        await offerInstall(page, 'accepted');
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
        expect(await page.evaluate(() => window.installPromptCalls)).toBe(1);
        const install = page.getByRole('button', { name: 'Install Tableu', exact: true });
        await install.focus();
        await install.press('Enter');
        await expect(install).toHaveCount(0);
        await expectJournalFocusInView(page);
        expect(await page.evaluate(() => window.installPromptCalls)).toBe(2);
      });

      test('a page without other actions keeps keyboard focus at its page end', async ({ page }) => {
        await page.goto('/governance-critique');
        await expect(page.locator('main.governance-critique-page')).toBeVisible();
        await offerInstall(page);
        const install = page.locator('main [data-pwa-footer]').getByRole('button', { name: 'Install Tableu', exact: true });
        await expect(install).toBeVisible();
        await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await expect(install).toBeInViewport({ ratio: 1 });
        await install.focus();
        const scrollY = await page.evaluate(() => window.scrollY);
        await install.press('Enter');
        await expect(install).toHaveCount(0);
        await expect(page.locator('main.governance-critique-page')).toBeFocused();
        const remainingScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY);
        expect(remainingScroll).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollY / 2);
      });

      test('prompt failures announce a dismissible toast that expires across navigation', async ({ page }) => {
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Reading', exact: true })).toBeVisible();
        await offerInstall(page, 'dismissed', true);
        await page.getByRole('button', { name: 'Install Tableu', exact: true }).click();
        const toast = installErrorToast(page);
        await expect(toast).toBeInViewport({ ratio: 1 });
        await expect(toast.getByRole('button', { name: 'Dismiss notification', exact: true })).toBeVisible();
        await expect(toast).not.toContainText('Fixture prompt failure');
        await page.getByRole('button', { name: 'Journal', exact: true }).click();
        await expect(page).toHaveURL(/\/journal$/);
        await expect(toast).toHaveCount(0, { timeout: 7000 });
        await offerInstall(page);
        await expect(toast).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Install Tableu', exact: true })).toBeVisible();
      });

      if (platform === 'Chromium') {
        test('install failures update a persistent assertive accessibility live region, including repeats', async ({ page, context }) => {
          await page.goto('/pricing');
          await expect(page.locator('main [data-pwa-footer]')).toBeAttached();
          const announcer = page.locator('[data-toast-announcer="assertive"]');
          await expect(announcer).toHaveText('');
          await expect(announcer).toHaveAttribute('aria-live', 'assertive');
          await expect(announcer).toHaveAttribute('aria-atomic', 'true');
          await announcer.evaluate(node => {
            window.installAnnouncer = node;
            window.installAnnouncements = [];
            new MutationObserver(() => window.installAnnouncements.push(node.textContent))
              .observe(node, { subtree: true, childList: true, characterData: true });
          });
          const client = await context.newCDPSession(page);
          await client.send('Accessibility.enable');
          await offerInstall(page, 'dismissed', true);
          const install = page.getByRole('button', { name: 'Install Tableu', exact: true });
          await install.focus();
          await install.press('Enter');
          const toast = installErrorToast(page);
          await expect(toast).toBeInViewport();
          await expect(announcer).toContainText('browser menu');
          expect(await announcer.evaluate(node => node === window.installAnnouncer)).toBe(true);

          const { root } = await client.send('DOM.getDocument');
          const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-toast-announcer="assertive"]' });
          const { node } = await client.send('DOM.describeNode', { nodeId });
          const { nodes } = await client.send('Accessibility.getPartialAXTree', { backendNodeId: node.backendNodeId, fetchRelatives: true });
          const accessible = nodes.find(candidate => candidate.backendDOMNodeId === node.backendNodeId);
          const properties = Object.fromEntries((accessible?.properties || []).map(property => [property.name, property.value.value]));
          expect(properties.live).toBe('assertive');
          expect(properties.atomic).toBe(true);
          expect(nodes.some(candidate => candidate.name?.value?.includes('browser menu'))).toBe(true);
          expect(await page.evaluate(() => document.querySelector('main').contains(document.activeElement))).toBe(true);
          await toast.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
          await expect(toast).toHaveCount(0);
          await offerInstall(page, 'dismissed', true);
          await install.focus();
          await install.press('Enter');
          await expect(toast).toBeVisible();
          await expect.poll(() => page.evaluate(() => window.installAnnouncements.filter(text => text.includes('browser menu')).length)).toBeGreaterThanOrEqual(2);
          expect(await page.evaluate(() => window.installAnnouncements.includes(''))).toBe(true);
          expect(await announcer.evaluate(node => node === window.installAnnouncer)).toBe(true);
          await client.detach();
        });
      }
    });
  });
}
