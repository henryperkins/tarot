import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

// The account may finish loading after a returning reader accepts the spread
// shown. That response must not cancel a shuffle or relabel already dealt cards.
const REMOTE = {
  v: 1,
  personalization: { preferredSpreadDepth: 'deep' },
  explicitFields: ['preferredSpreadDepth'],
  onboardingCompletedAt: 1_700_000_000,
  updatedAt: 1_700_000_000
};

const snapshot = page => page.evaluate(() => {
  const saved = JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null');
  return saved && { spread: saved.spreadKey, cards: saved.reading.length, dealt: saved.isSpreadDealt };
});

test('restoring a table preserves a separate spread draft until the reader chooses again', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { accountPreferences: {
    ...REMOTE, personalization: {}, explicitFields: []
  } });
  try {
    await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
    await page.goto('/');
    await page.getByRole('radio', { name: 'Five-Card Clarity', exact: true }).click();
    await page.getByRole('button', { name: 'Draw cards', exact: true }).click();
    await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
    await expect.poll(() => snapshot(page)).toEqual({ spread: 'fiveCard', cards: 5, dealt: true });
    // A prior paid choice can differ from a table drawn using a plan fallback.
    await page.evaluate(() => sessionStorage.setItem('tarot-spread-draft', JSON.stringify({ spreadKey: 'celtic' })));
    await page.reload();
    await expect(page.locator('#reading-table-title')).toHaveText('Five-Card Clarity');
    const draft = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot-spread-draft')).spreadKey);
    expect(await draft()).toBe('celtic');
    await page.getByRole('button', { name: /^Step 1: Spread/ }).first().click();
    await page.getByRole('radio', { name: 'Five-Card Clarity', exact: true }).click();
    await expect.poll(draft).toBe('fiveCard');
    await expect.poll(() => snapshot(page)).toEqual({ spread: 'fiveCard', cards: 5, dealt: true });
  } finally {
    await fixture.close();
  }
});

for (const platform of ['desktop', 'phone @mobile']) {
  test.describe(`Late account preferences during a reading — ${platform}`, () => {
    if (platform.includes('@mobile')) test.use({ viewport: { width: 390, height: 844 } });

    for (const phase of ['shuffle', 'deal']) {
      test(`preferences received after ${phase} keep the accepted spread`, async ({ page }) => {
        const fixture = await createNarrativeFixture(page, { accountPreferences: REMOTE });
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        await page.route('**/api/account/preferences', async route => {
          if (route.request().method() === 'GET') await gate;
          return route.fulfill({ json: { preferences: REMOTE, available: true } });
        });
        try {
          await page.addInitScript(() => {
            localStorage.setItem('tarot-onboarding-complete', 'true');
            localStorage.setItem('tarot-nudge-state', JSON.stringify({
              readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true,
              hasSeenJournalNudge: true, hasDismissedAccountNudge: true
            }));
          });
          const requested = page.waitForRequest('**/api/account/preferences');
          await page.goto('/');
          await requested;
          const draw = page.getByRole('button', { name: 'Draw cards', exact: true }).filter({ visible: true }).first();
          await expect(draw).toBeVisible();
          await draw.click();
          const deal = page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).first();
          if (phase === 'deal') {
            await deal.click();
            await expect.poll(() => snapshot(page)).toEqual({ spread: 'threeCard', cards: 3, dealt: true });
          }
          release();
          // Confirm that the preference actually arrived; the active reading
          // stays coherent while the account's new default is stored for setup.
          await expect.poll(() => page.evaluate(() => JSON.parse(
            localStorage.getItem('tarot-personalization:fixture-pro-user') || '{}'
          ).preferredSpreadDepth)).toBe('deep');
          if (phase === 'shuffle') await deal.click();
          await expect(page.locator('#reading-table-title')).toHaveText('Three-Card Story');
          await expect.poll(() => snapshot(page)).toEqual({ spread: 'threeCard', cards: 3, dealt: true });
          await page.reload();
          await expect(page.locator('#reading-table-title')).toHaveText('Three-Card Story');
          await expect.poll(() => snapshot(page)).toEqual({ spread: 'threeCard', cards: 3, dealt: true });
        } finally {
          release();
          await fixture.close();
        }
      });
    }
  });
}
