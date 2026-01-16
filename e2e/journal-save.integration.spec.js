import { test, expect } from '@playwright/test';

async function waitForAppReady(page) {
  await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', {
    timeout: 30000
  });
}

async function selectSpread(page, spreadName) {
  const spreadButton = page.getByRole('radio', { name: new RegExp(spreadName, 'i') });
  await spreadButton.click();
  await expect(spreadButton).toHaveAttribute('aria-checked', 'true');
}

async function skipRitual(page) {
  const ritualSkipButton = page.locator('button:has-text("Skip")').first();
  if (await ritualSkipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ritualSkipButton.click();
    const confirmButton = page.getByRole('button', { name: /skip.*draw|confirm|yes/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }
  }
}

async function waitForCardsDealt(page) {
  await expect(async () => {
    const cards = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 15000 });
}

async function revealCard(page, index) {
  const cards = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
  const card = cards.nth(index);
  await expect(card).toBeVisible({ timeout: 10000 });
  await card.click();
  await page.waitForTimeout(600);
}

test.describe('Save to journal flow @integration', () => {
  test('saved entry appears in Journal history and summary stats', async ({ page }) => {
    test.skip(test.info().project.name.includes('mobile'), 'Desktop-only for this integration test');

    const question = `E2E integration: journal save ${Date.now()}`;

    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      localStorage.removeItem('tarot_journal');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });

    await page.goto('/');
    await waitForAppReady(page);

    await selectSpread(page, 'One-Card');

    const questionInput = page.locator('textarea').first();
    await questionInput.fill(question);

    // Explicitly draw the cards (desktop CTA) before attempting to reveal
    const drawButton = page.getByRole('button', { name: /draw cards/i }).first();
    await expect(drawButton).toBeVisible({ timeout: 10000 });
    await drawButton.click();

    await skipRitual(page);
    await waitForCardsDealt(page);
    await revealCard(page, 0);

    const generateButton = page.getByRole('button', { name: /generate|create.*narrative|get.*reading|receive.*reading/i }).first();
    await expect(generateButton).toBeVisible({ timeout: 10000 });
    await generateButton.click();

    const saveButton = page.getByRole('button', { name: /save to journal/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 60000 });
    await saveButton.click();

    await expect(
      page.locator('p[role="status"]').filter({ hasText: /saved to your journal|already.*journal/i })
    ).toBeVisible({ timeout: 15000 });

    const savedEntries = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('tarot_journal') || '[]');
      } catch {
        return [];
      }
    });

    expect(Array.isArray(savedEntries)).toBe(true);
    expect(savedEntries).toHaveLength(1);
    expect(savedEntries[0]?.question).toBe(question);
    expect(savedEntries[0]?.spreadKey).toBeTruthy();
    expect(Array.isArray(savedEntries[0]?.cards)).toBe(true);
    expect(savedEntries[0]?.cards?.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: /view journal/i }).click();
    await page.waitForSelector('#history', { timeout: 15000 });

    await expect(page.locator('#history')).toContainText(question, { timeout: 15000 });

    const entriesLoggedLabel = page.locator('p', { hasText: 'Entries logged' }).last();
    await expect(entriesLoggedLabel).toBeVisible({ timeout: 15000 });
    await expect(entriesLoggedLabel.locator('..')).toContainText('1');
  });
});
