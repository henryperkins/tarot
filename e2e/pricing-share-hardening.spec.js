import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';

async function prepare(page, { theme = 'light', tier = null, status = 'active' } = {}) {
  await page.addInitScript(value => {
    localStorage.setItem('tarot-theme', value);
    localStorage.setItem('tarot-onboarding-complete', 'true');
  }, theme);
  await page.route(/https:\/\/[^/]*sentry\.io\//, route => route.fulfill({ json: {} }));
  // Subscription cases are explicit fixtures, separate from real-session review.
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname === '/api/auth/me') {
      return route.fulfill({
        status: tier ? 200 : 401,
        json: { user: tier ? {
          id: 'hardening-fixture', username: 'Reader', email: 'reader@example.invalid',
          email_verified: 1, subscription_tier: tier, subscription_status: status,
          subscription_provider: 'stripe'
        } : null }
      });
    }
    return route.fulfill({ json: { entries: [], memories: [], usage: {}, ok: true } });
  });
}

async function openComparison(page) {
  await page.goto('/pricing');
  const opener = page.getByRole('button', { name: 'Compare all features', exact: true });
  await opener.focus();
  await opener.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Compare all features' });
  await expect(dialog).toBeVisible();
  return { dialog, opener };
}

async function expectWithinViewport(locator) {
  expect(await locator.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.left >= 0
      && bounds.bottom <= innerHeight + 1 && bounds.right <= innerWidth + 1;
  })).toBe(true);
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Pricing and shared-link hardening — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

    test('comparison owns focus, isolates the page, and restores its opener on dismissal', async ({ page }) => {
      await prepare(page);
      const { dialog, opener } = await openComparison(page);
      await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      await expect(page.getByRole('main')).toHaveCount(0);
      for (const key of ['Tab', 'Shift+Tab']) {
        for (let index = 0; index < 9; index += 1) {
          await page.keyboard.press(key);
          expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
        }
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await expect(page.getByRole('main')).toBeVisible();
      await opener.press('Enter');
      await dialog.getByRole('button', { name: 'Close comparison' }).click();
      await expect(opener).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed');
    });

    test('plan availability and feature explanations work with a keyboard and accessible names', async ({ page }) => {
      await prepare(page);
      const { dialog } = await openComparison(page);
      const row = dialog.getByRole('row', { name: /^Guided AI questions/ });
      await expect(row.getByRole('cell', { name: 'Not included', exact: true })).toHaveCount(1);
      await expect(row.getByRole('cell', { name: 'Included', exact: true })).toHaveCount(2);
      const details = dialog.getByRole('button', { name: 'About Developer access', exact: true });
      await details.focus();
      await details.press('Enter');
      await expect(details).toHaveAttribute('aria-expanded', 'true');
      await expect(dialog.getByText('Includes API access for integrating Tableu into your workflows.', { exact: true })).toBeVisible();
      await details.press('Space');
      await expect(details).toHaveAttribute('aria-expanded', 'false');
      const result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(result.violations).toEqual([]);
    });

    for (const [width, height, textScale] of [[320, 844, 1], [844, 390, 1], [320, 568, 2], [1440, 900, 2]]) {
      test(`comparison scrolls completely at ${width}x${height} with ${textScale * 100}% text`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height });
        await prepare(page, { theme: width === 844 ? 'dark' : 'light' });
        const { dialog } = await openComparison(page);
        if (textScale > 1) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        const close = dialog.getByRole('button', { name: 'Close comparison' });
        await expectWithinViewport(close);
        const closeSize = await close.boundingBox();
        // Layout transforms can produce fractional values such as 43.999996.
        expect(Math.min(closeSize.width, closeSize.height)).toBeGreaterThanOrEqual(43.99);
        const scroll = dialog.getByRole('region', { name: 'Plan comparison', exact: true });
        const columns = dialog.getByRole('region', { name: 'Plan feature columns', exact: true });
        await columns.focus();
        await expect(columns).toBeFocused();
        const horizontalOverflow = await columns.evaluate(element => element.scrollWidth > element.clientWidth);
        if (horizontalOverflow) {
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => columns.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
          // Read the last plan, then verify that the refund note still fits.
          await columns.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        let previousHeight = null;
        let stableMeasurements = 0;
        await expect.poll(async () => {
          const height = await scroll.evaluate(element => element.scrollHeight);
          stableMeasurements = height === previousHeight ? stableMeasurements + 1 : 0;
          previousHeight = height;
          return stableMeasurements >= 3;
        }, { intervals: [50] }).toBe(true);
        await scroll.focus();
        await expect(scroll).toBeFocused();
        await page.keyboard.press('End');
        const footer = dialog.getByText('All paid plans include a 7-day refund window on first purchase', { exact: true });
        await expect.poll(() => footer.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.bottom <= innerHeight && bounds.top >= 0;
        })).toBe(true);
        await expectWithinViewport(footer);
        await expectWithinViewport(close);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: testInfo.outputPath('comparison.png') });
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      });
    }

    for (const status of ['canceled', 'past_due', 'unpaid']) {
      for (const theme of ['light', 'dark']) {
        test(`subscription recovery remains readable before and during hover (${status}, ${theme})`, async ({ page }) => {
          await prepare(page, { theme, tier: 'pro', status });
          await page.goto('/account');
          const banner = page.getByRole('status').filter({ hasText: 'Subscription needs attention' });
          await expect(banner).toBeVisible();
          await banner.evaluate(element => element.setAttribute('data-recovery-banner', ''));
          const action = banner.getByRole(status === 'canceled' ? 'link' : 'button', {
            name: status === 'canceled' ? 'Resubscribe' : 'Update payment', exact: true
          });
          for (const hover of [false, true]) {
            if (hover) await action.hover();
            const result = await new AxeBuilder({ page }).include('[data-recovery-banner]')
              .withRules(['color-contrast']).analyze();
            expect(result.violations).toEqual([]);
          }
        });
      }
    }

    test('a delayed missing share retains its main landmark and keyboard recovery at large text sizes', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await prepare(page);
      let finishResponse;
      const responseReady = new Promise(resolve => { finishResponse = resolve; });
      const message = `Share link not found: ${'安心أمان'.repeat(30)}`;
      await page.route('**/api/share/hardening-missing', async route => {
        await responseReady;
        await route.fulfill({ status: 404, json: { error: message } });
      });
      try {
        await page.goto('/share/hardening-missing');
        await expect(page.getByRole('status').filter({ hasText: 'Opening sacred space' })).toBeVisible();
        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Shared reading');
        const skip = page.getByRole('link', { name: 'Skip to main content', exact: true });
        await skip.focus();
        await skip.press('Enter');
        await expect(main).toBeFocused();
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        finishResponse();
        await expect(main.getByRole('heading', { level: 1 })).toHaveText(message);
        await expect(main.getByRole('alert')).toContainText(message);
        await expect(main).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        const recovery = main.getByRole('link', { name: 'Return to Tableu' });
        const bounds = await recovery.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        await recovery.focus();
        await expect(recovery).toBeFocused();
        await recovery.press('Enter');
        await expect(page).toHaveURL(/\/$/);
      } finally {
        finishResponse();
      }
    });

    for (const tier of [null, 'free', 'plus']) {
      test(`the upgrade landmark respects the current plan (${tier ? `mocked ${tier}` : 'guest'})`, async ({ page }) => {
        await prepare(page, { tier });
        await page.goto('/pricing');
        if (tier) await expect(page.getByRole('button', { name: 'Current plan', exact: true })).toBeVisible();
        const upgrade = page.getByRole('region', { name: 'Plan upgrade', exact: true });
        if (tier === 'plus') await expect(upgrade).toHaveCount(0);
        else await expect(upgrade.getByRole('button', { name: 'Go Plus', exact: true })).toBeVisible();
        const result = await new AxeBuilder({ page }).withRules(['region']).analyze();
        expect(result.violations).toEqual([]);
      });
    }
  });
}
