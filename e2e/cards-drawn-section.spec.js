import { test, expect } from '@playwright/test';

async function seedJournalEntries(page, entries) {
  await page.addInitScript((entriesJson) => {
    localStorage.setItem('tarot_journal', entriesJson);
    localStorage.removeItem('cards_drawn_stack_hint_dismissed');
  }, JSON.stringify(entries));
}

async function waitForImages(locator) {
  await locator.evaluateAll((images) => Promise.all(
    images.map((image) => {
      if (image.complete) return true;
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

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedJournalEntries(page, [buildEntry()]);
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

  test('matches visual snapshots for collapsed and expanded fan states', async ({ page }) => {
    const entryToggle = page.getByRole('button', { name: /celtic cross/i }).first();
    await entryToggle.click();

    const cardsSection = page.getByRole('group', { name: 'Cards drawn in this reading' });
    await cardsSection.scrollIntoViewIfNeeded();

    await waitForImages(cardsSection.locator('img'));
    await expect(cardsSection).toHaveScreenshot('cards-drawn-collapsed-mobile.png');

    const stackButton = cardsSection.getByRole('button', { name: /tap to view/i });
    await stackButton.click();

    // Wait for fan layout cards to be visible
    const firstCard = cardsSection.getByRole('button', { name: /the fool, past position/i });
    await expect(firstCard).toBeVisible();
    await waitForImages(cardsSection.locator('img'));
    await expect(cardsSection).toHaveScreenshot('cards-drawn-fan-mobile.png');
  });
});

test.describe('Cards Drawn Section - Desktop @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
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
