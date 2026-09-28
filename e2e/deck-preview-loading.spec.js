import { test, expect } from '@playwright/test';
import { createNarrativeFixture, openSetup } from './helpers/narrativeFixtures.js';

const DECK_IMAGE = /\/(rider|Thoth|marseille)[^/]*\.(?:jpeg|webp|avif)(?:\?|$)/;

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Deck preview loading — ${platform}`, () => {
    test.use({ serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page);
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    async function openDecks(page) {
      await openSetup(page);
      if (page.viewportSize().width < 640) {
        await page.getByRole('button', { name: 'Change deck', exact: true }).click();
      }
      return page.getByRole('radiogroup', { name: 'Choose your deck style' });
    }

    test('artwork keeps its space while the image is delayed or unavailable', async ({ page }) => {
      let releaseImages;
      const gate = new Promise(resolve => { releaseImages = resolve; });
      await page.route(DECK_IMAGE, async route => {
        if (route.request().resourceType() !== 'image') return route.continue();
        await gate;
        await route.abort();
      });
      try {
        const decks = await openDecks(page);
        const first = decks.getByRole('radio').first();
        await first.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        const img = first.locator('img');
        const before = await img.boundingBox();
        expect(before.width / before.height).toBeCloseTo(982 / 799, 2);
        const cardBefore = await first.boundingBox();
        releaseImages();
        await expect(img).toBeHidden();
        const cardAfter = await first.boundingBox();
        expect(Math.abs(cardAfter.height - cardBefore.height)).toBeLessThan(1);
        await first.click();
        await expect(first).toHaveAttribute('aria-checked', 'true');
      } finally {
        releaseImages();
      }
    });

    test('responsive previews load without original JPEGs and preserve deck selection', async ({ page }) => {
      const originalRequests = [];
      page.on('request', request => {
        if (request.resourceType() === 'image' && DECK_IMAGE.test(request.url()) && /\.jpeg(?:\?|$)/.test(request.url())) {
          originalRequests.push(request.url());
        }
      });
      const decks = await openDecks(page);
      const choices = decks.getByRole('radio');
      await expect(choices).toHaveCount(3);
      for (const choice of await choices.all()) {
        await choice.scrollIntoViewIfNeeded();
        const img = choice.locator('img');
        await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
        expect(await img.evaluate(el => el.currentSrc)).toMatch(/\.(avif|webp)(?:\?|$)/);
        await choice.click();
        await expect(choice).toHaveAttribute('aria-checked', 'true');
      }
      expect(originalRequests).toEqual([]);
      await choices.last().focus();
      await page.keyboard.press('Home');
      await expect(choices.first()).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(choices.first()).toHaveAttribute('aria-checked', 'true');
    });
  });
}
