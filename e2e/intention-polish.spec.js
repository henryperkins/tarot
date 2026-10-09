import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, openSetup, startReading, openChat, installSimulatedVisualViewport } from './helpers/narrativeFixtures.js';

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Intention polish — ${platform}`, () => {
    test.use({ serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page);
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    for (const width of [390, 1440]) {
      test(`examples insert editable text and announce each choice at ${width}px`, async ({ page, hasTouch }) => {
        await page.setViewportSize({ width, height: 1000 });
        await openSetup(page);
        const field = page.locator('#quick-intention,#question-input').filter({ visible: true }).first();
        await expect(field).toHaveValue('');
        await expect(field).toHaveAttribute('placeholder', 'In your own words…');
        const example = page.getByRole('button', { name: 'Try an example', exact: true });
        if (hasTouch && width === 390) await example.tap();
        else await example.press('Enter');
        const firstExample = await field.inputValue();
        expect(firstExample.length).toBeGreaterThan(0);
        await expect(page.getByRole('status').filter({ hasText: `Example added: ${firstExample}` })).toHaveText(`Example added: ${firstExample}`);
        await page.getByRole('button', { name: 'Another example', exact: true }).press('Enter');
        await expect(field).not.toHaveValue(firstExample);
        await field.fill('What can I learn from this change at work?');
        await expect(field).toBeFocused();
        await expect(page.getByRole('button', { name: 'Another example', exact: true })).toHaveCount(0);
      });

      test(`composition and clarity feedback behave consistently at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript(() => localStorage.setItem('tarot-theme', 'light'));
        await openSetup(page);
        const field = page.locator('#quick-intention,#question-input').filter({ visible: true }).first();
        await field.fill('Will he come back?');
        await field.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true });
        await expect(field).toBeFocused();
        await expect(field).toHaveAccessibleDescription(/This reads as a yes-or-no question/);
        await expect(page.getByRole('navigation', { name: 'Tarot reading progress' }).locator('[aria-current="step"]')).toHaveAccessibleName(/Question/);
        const guidance = page.getByRole('status').filter({ hasText: /This reads as a yes-or-no question/ });
        await expect(guidance).toHaveText(/This reads as a yes-or-no question/);
        await field.press('Shift+Enter');
        await expect(field).toBeFocused();
        await expect(field).toHaveValue('Will he come back?\n');
        await field.press('Enter');
        await expect(field).not.toBeFocused();
        const axe = await new AxeBuilder({ page }).withRules(['color-contrast', 'label', 'button-name']).analyze();
        expect(axe.violations).toEqual([]);
      });
    }

    test('preparation names are distinct and the question stays on the page', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openSetup(page);
      const field = page.locator('#quick-intention');
      await field.fill('How can I balance work and rest this week?');
      const draw = page.locator('.mobile-action-bar').getByRole('button', { name: 'Draw cards', exact: true });
      await expect(draw).not.toContainText(/Step \d/);
      await page.getByRole('button', { name: 'Open reading preparation', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Prepare your reading', exact: true });
      await expect(drawer.getByRole('textbox')).toHaveCount(0);
      await expect(drawer.getByRole('tablist', { name: 'Preparation settings' }).getByRole('tab')).toHaveText(['Deck', 'Ritual']);
      await drawer.getByRole('button', { name: 'Close reading preparation', exact: true }).click();
      await expect(field).toHaveValue('How can I balance work and rest this week?');
      await expect(page.getByRole('button', { name: 'Open reading preparation', exact: true })).toBeFocused();
      await field.fill('أمان 🌿 安心 — What can I learn today?');
      await field.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true });
      await expect(field).toBeFocused();
    });

    test('the small-phone field remains below the sticky navigation on focus', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await openSetup(page);
      const field = page.locator('#quick-intention');
      if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) {
        await page.locator('.page-transition').evaluate(element => {
          element.style.animation = 'none';
          void element.offsetHeight;
          element.style.animation = 'page-enter 280ms ease-out';
        });
      }
      await field.focus();
      await expect.poll(() => field.evaluate(el => {
        const fieldBox = el.getBoundingClientRect();
        const header = document.querySelector('.header-sticky');
        const headerBottom = getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0;
        const dockTop = document.querySelector('.mobile-action-bar').getBoundingClientRect().top;
        const dock = document.querySelector('.mobile-action-bar').getBoundingClientRect();
        return document.activeElement === el && fieldBox.top >= Math.max(0, headerBottom)
          && fieldBox.bottom <= Math.min(innerHeight, dockTop)
          && dock.top >= 0 && dock.bottom <= innerHeight + 1;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    });

    test('focused intention follows handset layout changes without undoing reader scrolling', async ({ page, browserName, isMobile }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await installSimulatedVisualViewport(page);
      await openSetup(page);
      const field = page.locator('#quick-intention');
      const visible = () => field.evaluate(el => {
        const box = el.getBoundingClientRect();
        const header = document.querySelector('.header-sticky').getBoundingClientRect();
        const dock = document.querySelector('.mobile-action-bar').getBoundingClientRect();
        return document.activeElement === el && box.top >= Math.max(0, header.bottom)
          && box.bottom <= Math.min(innerHeight, dock.top, (visualViewport?.offsetTop || 0) + (visualViewport?.height || innerHeight)) && dock.bottom <= innerHeight + 1;
      });
      await field.focus();
      await expect.poll(visible).toBe(true);
      await field.blur();
      await field.focus();
      await expect.poll(visible).toBe(true);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '20px';
        document.documentElement.style.setProperty('--safe-pad-bottom', '24px');
      });
      await expect.poll(visible).toBe(true);
      await page.setViewportSize({ width: 320, height: 568 });
      await expect.poll(visible).toBe(true);
      await page.setViewportSize({ width: 320, height: 640 });
      await expect.poll(visible).toBe(true);
      await page.evaluate(() => window.__setVisualViewport(480));
      await expect.poll(visible).toBe(true);
      await page.evaluate(() => window.__setVisualViewport(640));
      await expect.poll(visible).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      if (browserName === 'webkit' && isMobile) {
        // Playwright cannot wheel in mobile WebKit. Exercise its touch-intent
        // listener and native scrolling with a synthesized movement instead.
        await page.evaluate(() => {
          dispatchEvent(new Event('touchmove'));
          scrollBy({ top: 180, behavior: 'instant' });
        });
      } else {
        await page.mouse.wheel(0, 180);
      }
      await expect.poll(() => page.evaluate(async () => {
        const position = scrollY;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return position === scrollY;
      })).toBe(true);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      const position = await page.evaluate(() => scrollY);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(await page.evaluate(() => scrollY)).toBe(position);
    });

    test('the question still reaches a completed reading and follow-up conversation', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await startReading(page, fixture);
      const { dialog } = await openChat(page);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      expect(fixture.requests.reading).toHaveLength(1);
    });
  });
}
