import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, QUESTION } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);

test('signing out during a cloud save keeps guest save state and storage separate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await createNarrativeFixture(page);
  await page.route('**/api/auth/logout', route => route.fulfill({ json: { success: true } }));
  try {
    await startReading(page, fixture);
    fixture.holdJournal();
    await page.getByRole('button', { name: 'Save to journal', exact: true }).click();
    await expect.poll(() => fixture.requests.journal.length).toBe(1);
    await page.getByRole('button', { name: /^Step 2:/ }).click();
    await page.getByRole('button', { name: 'User menu for fixture', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Sign Out', exact: true }).click();
    await page.getByRole('button', { name: /^Step 4:/ }).click();
    const save = page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true });
    await expect(save).toBeEnabled();
    const completion = page.waitForResponse(response => new URL(response.url()).pathname === '/api/journal' && response.request().method() === 'POST');
    fixture.releaseJournal();
    await completion;
    await expect(save).toBeEnabled();
    await expect(page.getByRole('button', { name: 'View saved entry' })).toHaveCount(0);
    await save.click();
    await expect(page.getByRole('button', { name: 'View saved entry' })).toBeVisible();
    expect(fixture.requests.journal).toHaveLength(1);
  } finally { await fixture.close(); }
});

for (const status of [200, 503]) {
  test(`returning to the original owner recovers a save settled while signed out (${status})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const fixture = await createNarrativeFixture(page);
    await page.route('**/api/auth/logout', route => route.fulfill({ json: { success: true } }));
    await page.route('**/api/auth/login', route => route.fulfill({ json: { user: {
      id: 'fixture-pro-user', email: 'fixture@example.invalid', username: 'fixture',
      subscription_tier: 'pro', subscription_status: 'active', subscription_provider: 'stripe'
    } } }));
    try {
      await startReading(page, fixture);
      fixture.setJournalStatus(status);
      fixture.holdJournal();
      await page.getByRole('button', { name: 'Save to journal', exact: true }).click();
      await expect.poll(() => fixture.requests.journal.length).toBe(1);
      await page.getByRole('button', { name: /^Step 2:/ }).click();
      await page.getByRole('button', { name: 'User menu for fixture', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Sign Out', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
      const completion = page.waitForResponse(response => new URL(response.url()).pathname === '/api/journal' && response.request().method() === 'POST');
      fixture.releaseJournal();
      await (await completion).finished();
      await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Email', { exact: true }).fill('fixture@example.invalid');
      await dialog.getByLabel('Password', { exact: true }).fill('fixture-only-password');
      await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      // Signing in loads the owner's intention draft. Return to the exact
      // original source so this exercises the same save identity again.
      await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
      await page.getByRole('button', { name: /^Step 4:/ }).click();
      if (status === 200) {
        await expect(page.getByRole('button', { name: 'View saved entry' })).toBeVisible();
      } else {
        await expect(page.getByRole('alert').filter({ hasText: 'Failed to save journal entry' })).toBeVisible();
        const retry = page.getByRole('button', { name: 'Save to journal', exact: true });
        await expect(retry).toBeEnabled();
        fixture.setJournalStatus(200);
        await retry.click();
        await expect(page.getByRole('button', { name: 'View saved entry' })).toBeVisible();
      }
      expect(fixture.requests.journal).toHaveLength(status === 200 ? 1 : 2);
    } finally { await fixture.close(); }
  });
}
