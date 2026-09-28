import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, openSetup } from './helpers/narrativeFixtures.js';

const MEMORY = {
  id: 'audit-memory',
  text: 'I prefer concrete next steps in my reflections.',
  category: 'communication',
  source: 'user',
  createdAt: '2026-09-26T12:00:00Z'
};

async function renderedOpacity(locator) {
  return locator.evaluate(element => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });
}

async function expectMemoryContrast(page) {
  const violations = await new AxeBuilder({ page })
    .include('[data-reader-memory]')
    .withRules(['color-contrast'])
    .analyze();
  expect(violations.violations).toEqual([]);
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`UI audit hardening — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page);
      await page.addInitScript(() => {
        localStorage.setItem('tarot-onboarding-complete', 'true');
      });
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    test('memory deletion remains visible when reached by keyboard without hovering', async ({ page }) => {
      await page.route('**/api/memories**', route => route.fulfill({ json: { memories: [MEMORY] } }));
      await page.goto('/account');
      const add = page.getByRole('button', { name: 'Add new memory', exact: true });
      await add.scrollIntoViewIfNeeded();
      await page.mouse.move(1, 1);
      await add.focus();
      await page.keyboard.press('Tab');
      const remove = page.getByRole('button', { name: 'Delete memory', exact: true });
      await expect(remove).toBeFocused();
      await expect.poll(() => renderedOpacity(remove)).toBe(1);
    });

    for (const theme of ['dark', 'light']) {
      test(`memory text stays readable in empty, populated, editing, and error states (${theme})`, async ({ page }) => {
        test.setTimeout(45000);
        let memories = [];
        await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
        await page.route('**/api/memories**', route => route.request().method() === 'POST'
          ? route.fulfill({ status: 503, json: { error: 'Memory storage is temporarily unavailable. Please try again.' } })
          : route.fulfill({ json: { memories } }));
        await page.goto('/account');
        await expect(page.getByText('No memories yet', { exact: true })).toBeVisible();
        // Scope by the visible feature heading, independent of its container tag.
        await page.getByRole('heading', { name: 'Reader Memory', exact: true })
          .locator('../..').evaluate(element => element.setAttribute('data-reader-memory', ''));
        await expectMemoryContrast(page);

        memories = [MEMORY];
        await page.reload();
        await expect(page.getByText(MEMORY.text, { exact: true })).toBeVisible();
        await page.getByRole('heading', { name: 'Reader Memory', exact: true })
          .locator('../..').evaluate(element => element.setAttribute('data-reader-memory', ''));
        await expectMemoryContrast(page);
        await page.getByRole('button', { name: 'Add new memory', exact: true }).click();
        const note = page.getByLabel('Memory note', { exact: true });
        await note.fill('My reflection: 🌿 安心 أمان');
        await page.getByRole('button', { name: 'Add Memory', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'We could not save your memory. Please try again.' })).toBeVisible();
        await expect(note).toHaveValue('My reflection: 🌿 安心 أمان');
        await expectMemoryContrast(page);
      });
    }

    test('tab navigation skips unavailable spread arrows', async ({ page }) => {
      await openSetup(page);
      const names = [];
      for (let index = 0; index < 16; index += 1) {
        await page.keyboard.press('Tab');
        const active = page.locator(':focus');
        names.push(await active.getAttribute('aria-label'));
      }
      expect(names).not.toContain('Previous spread');
      expect(names).toContain('Next spread');
    });

    test('a focused spread arrow stays visible at the end and becomes a no-op', async ({ page }) => {
      await openSetup(page);
      const next = page.getByRole('button', { name: 'Next spread', exact: true });
      const carousel = page.getByRole('radiogroup', { name: 'Spread selection' });
      await page.evaluate(() => document.fonts.ready);
      await next.focus();
      for (let index = 1; index < 6; index += 1) {
        await next.press('Enter');
        // Wait for the requested card, not a fixed delay before the next key.
        await expect.poll(() => carousel.getByRole('radio').nth(index).evaluate(card => {
          const bounds = card.getBoundingClientRect();
          const viewport = card.parentElement.getBoundingClientRect();
          return bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1;
        })).toBe(true);
      }
      await expect(next).toHaveAttribute('aria-disabled', 'true');
      await expect(next).toBeFocused();
      await expect.poll(() => renderedOpacity(next)).toBe(1);
      const end = await carousel.evaluate(element => element.scrollLeft);
      await next.press('Enter');
      expect(await carousel.evaluate(element => element.scrollLeft)).toBe(end);
      await page.keyboard.press('Tab');
      await expect(next).not.toBeFocused();
    });

    test('spread artwork uses responsive sources without first downloading fallback PNGs', async ({ page }) => {
      const fallbackRequests = [];
      page.on('request', request => {
        if (request.resourceType() === 'image' && /\/images\/spread-art\/.*\.png(?:\?|$)/.test(request.url())) {
          fallbackRequests.push(request.url());
        }
      });
      await openSetup(page);
      const pictures = page.getByRole('radiogroup', { name: 'Spread selection' }).locator('picture');
      await expect(pictures).toHaveCount(6);
      await expect.poll(() => pictures.locator('img').first().evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      expect(fallbackRequests).toEqual([]);
    });
  });
}
