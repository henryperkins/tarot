import { test, expect } from './helpers/frontendTest.js';

async function seedJournalEntries(page, entries) {
  await page.addInitScript((entriesJson) => {
    localStorage.setItem('tarot_journal', entriesJson);
    localStorage.removeItem('cards_drawn_stack_hint_dismissed');
  }, JSON.stringify(entries));
}

async function waitForImages(locator) {
  await locator.evaluateAll((images) => Promise.all(
    images.map((image) => {
      if (image.complete) {
        if (!image.naturalWidth) throw new Error(`Image failed: ${image.currentSrc}`);
        return true;
      }
      return new Promise((resolve) => {
        image.addEventListener('load', () => resolve(true), { once: true });
        image.addEventListener('error', () => resolve(true), { once: true });
      });
    })
  ));
}

const CARD_SET = [
  { name: 'The Fool', position: 'Past', orientation: 'Reversed' },
  { name: 'Two of Cups', position: 'Present', orientation: 'Upright' },
  { name: 'Three of Swords', position: 'Future', orientation: 'Upright' },
  { name: 'Seven of Pentacles', position: 'Challenge', orientation: 'Upright' },
  { name: 'Ace of Wands', position: 'Advice', orientation: 'Upright' },
  { name: 'The High Priestess', position: 'Outcome', orientation: 'Upright' }
];

function buildEntry() {
  return {
    id: 'cards-drawn-entry',
    ts: Date.now(),
    spread: 'Celtic Cross',
    question: 'What should I focus on right now?',
    cards: CARD_SET,
    personalReading: 'A short reading for testing.'
  };
}

test.describe('Cards Drawn Section - Mobile @mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }, testInfo) => {
    const count = Number(testInfo.title.match(/all (\d+) rotated/)?.[1]);
    const entry = buildEntry();
    if (count) entry.cards = Array.from({ length: count }, (_, i) => ({ ...CARD_SET[i % CARD_SET.length], position: `Position ${i + 1}` }));
    await seedJournalEntries(page, [entry]);
    await page.goto('/journal');
    await page.waitForSelector('[id="history"]', { timeout: 10000 });
  });

  test('expands stack into arc/fan and collapses back', async ({ page }) => {
    const entryToggle = page.getByRole('button', { name: /celtic cross/i }).first();
    await entryToggle.click();

    const cardsSection = page.getByRole('group', { name: 'Cards drawn in this reading' });
    await expect(cardsSection).toBeVisible();

    const stackButton = cardsSection.getByRole('button', { name: /tap to view/i });
    await expect(stackButton).toBeVisible();
    await expect(stackButton).toContainText('6 cards');

    await stackButton.click();

    // Cards should now be visible in a fan layout (all cards visible at once)
    const firstCard = cardsSection.getByRole('button', { name: /the fool, past position/i });
    await expect(firstCard).toBeVisible();

    // All cards should be visible in the fan (no scrolling needed)
    const lastCard = cardsSection.getByRole('button', { name: /the high priestess, outcome position/i });
    await expect(lastCard).toBeVisible();

    await firstCard.click();
    await expect(page.getByRole('dialog', { name: /card symbol insights/i })).toHaveCount(0);

    // Collapse back to stack
    await firstCard.focus();
    await page.keyboard.press('Escape');

    // Should show collapsed stack again
    await expect(cardsSection.getByText('6 cards')).toBeVisible();

    // Re-expand
    const cardsHeaderToggle = cardsSection.getByRole('button', { name: /cards drawn/i });
    await cardsHeaderToggle.click();

    // Cards should be visible again in fan layout
    await expect(firstCard).toBeVisible();
    await expect(lastCard).toBeVisible();
  });

  for (const count of [1, 3, 6, 10]) {
    test(`all ${count} rotated cards fit at 320px with enlarged text`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.evaluate(() => document.documentElement.style.fontSize = '20px');
      await page.getByRole('button', { name: /celtic cross/i }).first().click();
      const section = page.getByRole('group', { name: 'Cards drawn in this reading' });
      const stack = section.getByRole('button', { name: /tap to view/i });
      if (await stack.count()) await stack.click();
      const cardsInFan = section.getByRole('button', { name: /Position \d+ position/i });
      await expect(cardsInFan).toHaveCount(count);
      await expect.poll(() => cardsInFan.evaluateAll(nodes => nodes.every(node => {
        const card = node.getBoundingClientRect();
        const section = node.closest('[role="group"]').getBoundingClientRect();
        return card.left >= Math.max(0, section.left) && card.right <= Math.min(innerWidth, section.right)
          && card.top >= section.top && card.bottom <= section.bottom;
      }))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    });
  }

  test('matches visual snapshots for collapsed and expanded fan states', async ({ page }) => {
    const entryToggle = page.getByRole('button', { name: /celtic cross/i }).first();
    await entryToggle.click();

    const cardsSection = page.getByRole('group', { name: 'Cards drawn in this reading' });
    await cardsSection.scrollIntoViewIfNeeded();

    await page.evaluate(() => document.fonts.ready);
    await waitForImages(cardsSection.locator('img'));
    await cardsSection.evaluate(async el => {
      await Promise.allSettled(el.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await expect(cardsSection.getByRole('button', { name: /tap to view/i })).toBeVisible();
    await expect(cardsSection.getByRole('button', { name: /cards drawn/i })).toHaveAttribute('aria-expanded', 'false');
    await expect(cardsSection).toHaveScreenshot('cards-drawn-collapsed-mobile.png');

    const stackButton = cardsSection.getByRole('button', { name: /tap to view/i });
    await stackButton.click();

    // Wait for fan layout cards to be visible
    const firstCard = cardsSection.getByRole('button', { name: /the fool, past position/i });
    await expect(firstCard).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await waitForImages(cardsSection.locator('img'));
    await cardsSection.evaluate(async el => {
      await Promise.allSettled(el.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await expect(cardsSection.getByRole('button', { name: /cards drawn/i })).toHaveAttribute('aria-expanded', 'true');
    await expect(cardsSection).toHaveScreenshot('cards-drawn-fan-mobile.png');
  });
});

test.describe('Cards Drawn Section - Desktop @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await seedJournalEntries(page, [buildEntry()]);
    await page.goto('/journal');
    await page.waitForSelector('[id="history"]', { timeout: 10000 });
  });

  test('supports keyboard navigation without card insights popover', async ({ page }) => {
    const entryToggle = page.getByRole('button', { name: /celtic cross/i }).first();
    await entryToggle.click();

    const cardsSection = page.getByRole('group', { name: 'Cards drawn in this reading' });
    await expect(cardsSection).toBeVisible();

    const firstCard = cardsSection.getByRole('button', { name: /the fool, past position/i });
    await firstCard.focus();
    await page.keyboard.press('ArrowRight');

    const secondCard = cardsSection.getByRole('button', { name: /two of cups, present position/i });
    await expect(secondCard).toBeFocused();

    await secondCard.hover();
    await expect(page.locator('#card-symbol-tooltip-two-of-cups-present')).toHaveCount(0);
  });
});
