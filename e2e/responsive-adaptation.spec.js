import { test, expect } from '@playwright/test';
import { createNarrativeFixture, openSetup } from './helpers/narrativeFixtures.js';

async function expectTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  // Browsers can report transformed 44px edges a few millionths below the integer.
  expect(box.width).toBeGreaterThanOrEqual(43.99);
  expect(box.height).toBeGreaterThanOrEqual(43.99);
}

async function expectNavigationFits(page) {
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  for (const name of ['Reading', 'Journal']) {
    const button = nav.getByRole('button', { name, exact: true });
    await expectTouchTarget(button);
    const bounds = await button.evaluate(element => {
      const buttonBox = element.getBoundingClientRect();
      const labelBox = element.querySelector('span').getBoundingClientRect();
      return {
        left: labelBox.left - buttonBox.left,
        right: buttonBox.right - labelBox.right
      };
    });
    expect(bounds.left, `${name} label extends beyond its button`).toBeGreaterThanOrEqual(0);
    expect(bounds.right, `${name} label extends beyond its button`).toBeGreaterThanOrEqual(0);
  }
  const reading = await nav.getByRole('button', { name: 'Reading', exact: true }).boundingBox();
  const journal = await nav.getByRole('button', { name: 'Journal', exact: true }).boundingBox();
  const overlapX = Math.min(reading.x + reading.width, journal.x + journal.width) - Math.max(reading.x, journal.x);
  const overlapY = Math.min(reading.y + reading.height, journal.y + journal.height) - Math.max(reading.y, journal.y);
  expect(Math.max(0, overlapX) * Math.max(0, overlapY)).toBe(0);
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Responsive adaptation — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

    test('guest navigation keeps readable destinations and usable actions', async ({ page }) => {
      test.setTimeout(60000); // Covers ten full route loads across two viewport widths.
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 844 });
          for (const route of ['/', '/pricing', '/journal', '/journal/gallery', '/account']) {
            await page.goto(route);
            await page.getByRole('navigation', { name: 'Primary navigation' }).waitFor();
            await page.evaluate(() => document.fonts.ready);
            await expectNavigationFits(page);
            await expectTouchTarget(page.getByRole('link', { name: 'Open settings', exact: true }));
          }
        }
        const nav = page.getByRole('navigation', { name: 'Primary navigation' });
        await nav.getByRole('button', { name: 'Reading', exact: true }).press('Enter');
        await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
        await nav.getByRole('button', { name: 'Journal', exact: true }).press('Enter');
        await expect(page).toHaveURL(/\/journal$/);
        await nav.getByRole('button', { name: 'Sign In', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      } finally {
        await fixture.close();
      }
    });

    test('pricing retains prices and upgrade targets at 320px in either billing interval', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Monthly', exact: true })).toBeVisible();
        for (const interval of ['Monthly', 'Annual']) {
          await page.getByRole('button', { name: new RegExp(`^${interval}`) }).click();
          await page.evaluate(() => document.fonts.ready);
          const widths = await page.evaluate(() => ({
            content: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth
          }));
          expect(widths.content, `${interval} pricing overflows`).toBeLessThanOrEqual(widths.viewport);
          for (const tier of ['Plus', 'Pro']) {
            const button = page.getByRole('button', { name: `Upgrade to ${tier}`, exact: true }).last();
            await expectTouchTarget(button);
            const box = await button.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(widths.viewport);
          }
        }
      } finally {
        await fixture.close();
      }
    });

    test('guest actions remain separate from destinations on wider screens and in landscape', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        for (const viewport of [
          { width: 640, height: 844 }, { width: 768, height: 1024 },
          { width: 844, height: 390 }, { width: 1440, height: 1000 }
        ]) {
          await page.setViewportSize(viewport);
          await page.evaluate(() => document.fonts.ready);
          await expectNavigationFits(page);
          const overlaps = await page.locator('.header-sticky__row').evaluate(row => {
            const controls = [...row.querySelectorAll('button,a')].filter(element => element.getClientRects().length);
            return controls.flatMap((control, index) => controls.slice(index + 1).flatMap(other => {
              const a = control.getBoundingClientRect();
              const b = other.getBoundingClientRect();
              const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
                * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
              return overlap > 0.01 ? [`${control.textContent.trim()} / ${other.textContent.trim()}`] : [];
            }));
          });
          expect(overlaps).toEqual([]);
        }
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      } finally {
        await fixture.close();
      }
    });

    test('enlarged text leaves pricing and account controls reachable and restores sticky navigation', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Monthly', exact: true }).waitFor();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        await expectNavigationFits(page);
        await page.getByRole('button', { name: /^Annual/ }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        await page.getByRole('button', { name: 'Upgrade to Plus', exact: true }).last().click();
        await expect(page.getByRole('dialog')).toBeVisible();

        await page.goto('/account');
        await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
        const enlargedText = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const sections = page.getByRole('navigation', { name: 'Jump to section' });
        await sections.getByRole('link', { name: 'Reading', exact: true }).click();
        await expect(page.locator('#reading-heading')).toBeFocused();
        const sectionBox = await page.locator('#reading').boundingBox();
        const navBox = await sections.boundingBox();
        expect(sectionBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
        for (const name of ['Light', 'Dark']) {
          const option = page.getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name, exact: true });
          await option.click();
          await expect(option).toHaveAttribute('aria-checked', 'true');
          const box = await option.boundingBox();
          expect(box.x + box.width).toBeLessThanOrEqual(390);
        }
        await enlargedText.evaluate(element => element.remove());
        await expect.poll(() => page.locator('header').evaluate(element => getComputedStyle(element).position)).toBe('sticky');
        await expect.poll(() => page.evaluate(() => {
          const header = document.querySelector('header').getBoundingClientRect();
          const nav = document.querySelector('[aria-label="Jump to section"]').getBoundingClientRect();
          return nav.top - header.bottom;
        })).toBeCloseTo(0, 0);
      } finally {
        await fixture.close();
      }
    });

    test('account section and utility controls retain 44px touch targets', async ({ page }) => {
      const fixture = await createNarrativeFixture(page);
      try {
        await openSetup(page);
        await page.goto('/account');
        await expect(page.getByRole('heading', { name: 'Account & Settings' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const sectionLinks = page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link');
        for (const link of await sectionLinks.all()) await expectTouchTarget(link);
        for (const name of [
          'Done', 'Edit', 'Password', 'Resend verification', 'Forgot password?',
          'Refresh', 'Try again', 'Restore purchases', 'Reset Journey data',
          'Export PDF', 'Export CSV', 'Download account data', 'Manage subscription', 'Back to Reading'
        ]) {
          const control = page.locator('main').getByRole(/Done|Forgot password\?|Back to Reading/.test(name) ? 'link' : 'button', { name, exact: true });
          await expectTouchTarget(control);
        }
        await expectTouchTarget(page.locator('#reversal-framework-select'));
      } finally {
        await fixture.close();
      }
    });
  });
}
