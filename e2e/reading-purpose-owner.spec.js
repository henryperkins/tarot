import { test, expect, openAccountOptions } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);

for (const status of [200, 503]) {
  test(`signing out during a cloud save clears the previous owner's reading (${status})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const fixture = await createNarrativeFixture(page);
    await page.route('**/api/auth/logout', route => route.fulfill({ json: { success: true } }));
    try {
      await startReading(page, fixture, { reflection: 'Private original-owner note' });
      fixture.setJournalStatus(status);
      fixture.holdJournal();
      await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
      await expect.poll(() => fixture.requests.journal.length).toBe(1);
      await page.getByRole('button', { name: /^Step 2:/ }).click();
      await page.getByRole('button', { name: 'User menu for fixture', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Sign Out', exact: true }).click();
      await openAccountOptions(page);
      await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
      const completion = page.waitForResponse(response => new URL(response.url()).pathname === '/api/journal' && response.request().method() === 'POST');
      fixture.releaseJournal();
      await (await completion).finished();
      await expect(page.locator('.narrative-stream')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'View saved entry' })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem('tarot:reading-snapshot'))).toBeNull();
      const guest = await page.evaluate(() => localStorage.getItem('tarot_journal'));
      expect(guest || '').not.toContain('Private original-owner note');
      expect(fixture.requests.journal).toHaveLength(1);
    } finally { await fixture.close(); }
  });
}
