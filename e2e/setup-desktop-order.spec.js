import { test, expect } from './helpers/frontendTest.js';

// Wider screens read in the order a reading is made: the question first, then
// the spread, then the deck. Draw cards, with the step and what will be drawn,
// stays pinned to the bottom edge until the setup ends. The ritual waits at the
// reading table (table-ritual.spec.js).
test.use({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });

const SPREAD_GROUP = '[role="radiogroup"][aria-label="Spread selection"]';

async function openSetup(page) {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(SPREAD_GROUP)).toBeVisible({ timeout: 15000 });
}

const pageTop = locator => locator.evaluate(element => element.getBoundingClientRect().top + window.scrollY);

test.describe('Setup order on wider screens @desktop', () => {
  test('the question leads, the deck follows the spreads, and Draw cards stays in reach', async ({ page }) => {
    await openSetup(page);
    const question = page.getByRole('textbox', { name: /What would you like to understand/ });
    const spreads = page.locator(SPREAD_GROUP);
    const deckRow = page.getByRole('button', { name: /^Deck\b/ });

    await expect(question).toBeInViewport();
    expect(await pageTop(question)).toBeLessThan(await pageTop(spreads));
    expect(await pageTop(spreads)).toBeLessThan(await pageTop(deckRow));
    await expect(page.getByRole('button', { name: /^Ritual/ })).toHaveCount(0);

    const draw = page.getByRole('button', { name: 'Draw cards', exact: true });
    await expect(draw).toBeInViewport();
    await expect(draw).toHaveAccessibleDescription(/Three-Card Story.*3 cards.*Rider-Waite-Smith/);
    await page.getByRole('radio', { name: /Celtic Cross|Five-Card Clarity/ }).last().scrollIntoViewIfNeeded();
    await expect(draw).toBeInViewport();

    // The step beside Draw cards follows the reading.
    const row = page.locator('#step-reading');
    await expect(row).toContainText('Pick a spread');
    await question.fill('What can I learn from this change at work?');
    await expect(row).toContainText('Your intention is ready');
  });

  test('each progress step brings its section into view and focus, with reduced motion too', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSetup(page);
    for (const [name, id] of [[/^Step 1: Spread/, 'step-spread'], [/^Step 2: Intent/, 'step-intention']]) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole('button', { name }).click();
      const section = page.locator(`#${id}`);
      await expect(section).toBeFocused();
      await expect(section).toBeInViewport();
    }
    // Before Draw, the ritual's step points at Draw cards: the ritual itself
    // happens at the table.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: /^Step 3: Ritual/ }).click();
    const draw = page.getByRole('button', { name: 'Draw cards', exact: true });
    await expect(draw).toBeFocused();
    await expect(draw).toBeInViewport();
  });

  test('a short window releases Draw cards into the page, and a taller one pins it again', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await openSetup(page);
    const row = page.locator('#step-reading');
    await expect(row).toHaveAttribute('data-chrome-pinned', 'false');
    await expect(page.getByRole('button', { name: 'Draw cards', exact: true })).not.toBeInViewport();
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(row).toHaveAttribute('data-chrome-pinned', 'true');
    await expect(page.getByRole('button', { name: 'Draw cards', exact: true })).toBeInViewport();
  });
});
