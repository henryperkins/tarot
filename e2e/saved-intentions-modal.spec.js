import { test, expect } from '@playwright/test';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Saved intentions modal @desktop', () => {
  test('confirms before using or deleting an intention', async ({ page }) => {
    test.skip(test.info().project.name.includes('mobile'), 'Desktop-only for this flow');

    const question = `E2E saved intention ${Date.now()}`;

    await page.addInitScript((seedQuestion) => {
      const historyKey = 'tarot_coach_history_anon';
      const payload = [
        {
          id: 'question-e2e',
          question: seedQuestion,
          createdAt: Date.now()
        }
      ];

      localStorage.setItem(historyKey, JSON.stringify(payload));
      localStorage.setItem('tarot-onboarding-complete', 'true');
    }, question);

    await page.goto('/journal');

    const openButton = page.getByRole('button', { name: 'Saved Intentions' });
    await expect(openButton).toBeVisible({ timeout: 10000 });
    await openButton.click();

    await expect(page.getByRole('dialog', { name: 'Saved Intentions' })).toBeVisible();

    const cardButton = page.getByRole('button', {
      name: new RegExp(`Use suggestion: ${escapeRegExp(question)}`, 'i')
    });
    await cardButton.click();

    const useDialog = page.getByRole('dialog', { name: 'Use this intention?' });
    await expect(useDialog).toBeVisible();
    await expect(useDialog).toContainText(question);
    await useDialog.getByRole('button', { name: 'Not yet' }).click();
    await expect(useDialog).toBeHidden();

    const cardShell = page.locator('.coach-note-shell').first();
    await cardShell.hover();
    await page.getByRole('button', { name: 'Delete this suggestion' }).first().click();

    const deleteDialog = page.getByRole('dialog', { name: 'Delete saved intention?' });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog).toContainText(question);
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(deleteDialog).toBeHidden();

    await expect(page.getByText('No saved intentions yet.')).toBeVisible();
  });
});
