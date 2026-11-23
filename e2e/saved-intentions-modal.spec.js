import { test, expect } from './helpers/frontendTest.js';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('Saved intentions modal', () => {
  test('uses an intention in one tap and confirms before deleting', async ({ page }) => {
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

    // The parent trap still wraps while the sheet is the top dialog.
    await closeIntentions.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(intentionsDialog.getByRole('button').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeIntentions).toBeFocused();

    const cardButton = page.getByRole('button', {
      name: new RegExp(`Use intention: ${escapeRegExp(question)}`, 'i')
    });

    const cardShell = page.locator('.coach-note-shell').first();
    await cardShell.hover();
    const deleteButton = intentionsDialog.getByRole('button', {
      name: new RegExp(`Delete intention: ${escapeRegExp(question)}`, 'i')
    });
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
    await deleteDialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(deleteDialog).toBeHidden();
    await expect(deleteButton).toBeFocused();

    await cardButton.click();
    await expect(page.getByRole('dialog', { name: 'Use this intention?' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /What would you like to understand/ })).toHaveValue(question);

    await page.goto('/journal');
    await expect(page.getByRole('heading', { name: 'Your Tarot Journal', level: 1 })).toBeVisible();
    await openButton.click();
    await expect(intentionsDialog).toBeVisible();
    await cardShell.hover();
    await deleteButton.click();
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(deleteDialog).toBeHidden();

    await expect(page.getByText('No saved intentions yet.')).toBeVisible();
    await expect(intentionsDialog.getByRole('link', { name: 'Save one from your question' })).toBeVisible();
    await expect.poll(() => intentionsDialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(intentionsDialog).toBeHidden();
    await expect(openButton).toBeFocused();
    await expect(openButton).toBeEnabled();
  });
});
