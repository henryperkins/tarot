import { test, expect } from '@playwright/test';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Saved intentions modal @desktop', () => {
  test('confirms before using or deleting an intention', async ({ page }) => {
    test.skip(test.info().project.name.includes('mobile'), 'Desktop-only for this flow');

    const question = 'E2E saved intention for nested modal focus';

    // Match the anonymous storage fixture without relying on a running Worker
    // or any account session outside this browser context.
    await page.route('**/api/auth/me', (route) => route.fulfill({
      status: 401,
      json: { user: null }
    }));

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
    await expect(page.getByRole('heading', { name: 'Your Tarot Journal', level: 1 })).toBeVisible();

    const openButton = page.getByRole('button', { name: 'Saved Intentions' });
    await expect(openButton).toBeVisible({ timeout: 10000 });
    await openButton.click();

    const intentionsDialog = page.getByRole('dialog', { name: 'Saved Intentions' });
    const closeIntentions = intentionsDialog.getByRole('button', { name: 'Close saved intentions' });
    await expect(intentionsDialog).toBeVisible();
    await expect(closeIntentions).toBeFocused();

    const cardButton = page.getByRole('button', {
      name: new RegExp(`Use suggestion: ${escapeRegExp(question)}`, 'i')
    });
    await cardButton.click();

    const useDialog = page.getByRole('dialog', { name: 'Use this intention?' });
    await expect(useDialog).toBeVisible();
    await expect(useDialog).toContainText(question);
    await expect(useDialog.getByRole('button', { name: 'Not yet' })).toBeFocused();
    await expect(intentionsDialog).toHaveCount(0);
    const nestedButtons = useDialog.getByRole('button');
    await nestedButtons.last().focus();
    await page.keyboard.press('Tab');
    await expect(nestedButtons.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(nestedButtons.last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(useDialog).toBeHidden();
    await expect(intentionsDialog).toBeVisible();
    await expect(cardButton).toBeFocused();

    // The parent trap resumes after the nested dialog returns focus.
    await closeIntentions.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(intentionsDialog.getByRole('button').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeIntentions).toBeFocused();

    await cardButton.click();
    await expect(useDialog).toBeVisible();
    await useDialog.getByRole('button', { name: 'Not yet' }).click();
    await expect(useDialog).toBeHidden();
    await expect(cardButton).toBeFocused();

    const cardShell = page.locator('.coach-note-shell').first();
    await cardShell.hover();
    const deleteButton = intentionsDialog.getByRole('button', { name: 'Delete this suggestion' }).first();
    await deleteButton.click();

    const deleteDialog = page.getByRole('dialog', { name: 'Delete saved intention?' });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog).toContainText(question);
    await expect(deleteDialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(deleteDialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
    await expect(intentionsDialog).toBeVisible();

    await deleteButton.click();
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(deleteDialog).toBeHidden();

    await expect(page.getByText('No saved intentions yet.')).toBeVisible();
    await expect.poll(() => intentionsDialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(intentionsDialog).toBeHidden();
    await expect(openButton).toBeFocused();
    await expect(openButton).toBeEnabled();
  });
});
