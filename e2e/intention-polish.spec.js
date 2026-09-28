import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, openSetup, startReading, openChat } from './helpers/narrativeFixtures.js';

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
      test(`examples insert editable text and keep their full accessible names at ${width}px`, async ({ page, browserName }) => {
        await page.setViewportSize({ width, height: 1000 });
        await openSetup(page);
        const field = page.locator('#quick-intention,#question-input').filter({ visible: true }).first();
        await expect(field).toHaveValue('');
        await expect(field).toHaveAttribute('placeholder', 'Ask about something you want to understand…');
        const example = page.getByRole('button', { name: /^Use example: / }).first();
        const previous = await example.innerText();
        await page.getByRole('button', { name: 'Show another example intention', exact: true }).click();
        await expect(example).not.toHaveText(previous);
        const fullText = (await example.textContent()).replace(/^Use example: /, '');
        await expect(example).toHaveAccessibleName(`Use example: ${fullText}`);
        await expect(page.getByRole('status').filter({ hasText: `Example: ${fullText}` })).toHaveText(`Example: ${fullText}`);
        if (browserName === 'webkit' && width === 390) await example.tap();
        else await example.press('Enter');
        await expect(field).toHaveValue(fullText);
        await expect(field).toBeFocused();
        expect(await field.evaluate(el => el.selectionEnd - el.selectionStart)).toBe(fullText.length);
        await expect(page.getByRole('button', { name: 'Show another example intention', exact: true })).toHaveCount(0);
      });

      test(`composition and clarity feedback behave consistently at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript(() => localStorage.setItem('tarot-theme', 'light'));
        await openSetup(page);
        const field = page.locator('#quick-intention,#question-input').filter({ visible: true }).first();
        await field.fill('Will he come back?');
        await field.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true });
        await expect(field).toBeFocused();
        await expect(field).toHaveAccessibleDescription(/Try "How" or "What"/);
        await expect(page.getByRole('navigation', { name: 'Tarot reading progress' }).locator('[aria-current="step"]')).toHaveAccessibleName(/Question/);
        const guidance = field.locator('..').locator('[aria-live="polite"]').filter({ hasText: /Try "How" or "What"/ });
        await expect(guidance).toBeVisible();
        await field.press('Shift+Enter');
        await expect(field).toBeFocused();
        await expect(field).toHaveValue('Will he come back?\n');
        await field.press('Enter');
        await expect(field).not.toBeFocused();
        const axe = await new AxeBuilder({ page }).withRules(['color-contrast', 'label', 'button-name']).analyze();
        expect(axe.violations).toEqual([]);
      });
    }

    test('preparation names are distinct and the drawer keeps the shared draft', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openSetup(page);
      const field = page.locator('#quick-intention');
      await field.fill('How can I balance work and rest this week?');
      const draw = page.locator('.mobile-action-bar').getByRole('button', { name: 'Shuffle & draw', exact: true });
      await expect(draw).not.toContainText(/Step \d/);
      await page.getByRole('button', { name: 'Open reading preparation', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Prepare your reading', exact: true });
      const editor = drawer.locator('#question-input');
      await expect(editor).toHaveValue('How can I balance work and rest this week?');
      await editor.fill('أمان 🌿 安心 — What can I learn today?');
      await editor.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true });
      await expect(editor).toBeFocused();
      await drawer.getByRole('button', { name: 'Close reading preparation', exact: true }).click();
      await expect(field).toHaveValue('أمان 🌿 安心 — What can I learn today?');
      await expect(page.getByRole('button', { name: 'Open reading preparation', exact: true })).toBeFocused();
    });

    test('the small-phone field remains below the sticky navigation on focus', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await openSetup(page);
      const field = page.locator('#quick-intention');
      await field.focus();
      await expect.poll(() => field.evaluate(el => {
        const fieldBox = el.getBoundingClientRect();
        const header = document.querySelector('.header-sticky');
        const headerBottom = getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0;
        const dockTop = document.querySelector('.mobile-action-bar').getBoundingClientRect().top;
        return fieldBox.top >= headerBottom && fieldBox.bottom <= dockTop;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
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
