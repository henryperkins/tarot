import { test, expect } from '@playwright/test';
import { createNarrativeFixture, expectForeground, observeNarrativeUiHealth } from './helpers/narrativeFixtures.js';

test('confirmed account deletion clears only its saved readings before authentication refresh', async ({ page }) => {
  const assertHealth = observeNarrativeUiHealth(page, { allowGuestAuthRejection: true });
  const fixture = await createNarrativeFixture(page);
  const owner = 'fixture-pro-user';
  let deleted = false;
  let deletions = 0;
  let finishAuth;
  const authRefresh = new Promise(resolve => { finishAuth = resolve; });
  await page.route('**/api/auth/me', async route => {
    if (!deleted) return route.fallback();
    await authRefresh;
    return route.fulfill({ status: 401, json: { user: null } });
  });
  await page.route('**/api/account/delete', route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ confirm: true });
    deleted = true;
    deletions++;
    return route.fulfill({ json: { success: true } });
  });
  try {
    await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
    await page.goto('/account');
    const button = page.getByRole('button', { name: 'Delete account', exact: true });
    await expect(button).toBeVisible();
    const retained = await page.evaluate(userId => {
      const prefixes = ['tarot_journal', 'tarot_journal_cache', 'tarot_journal_insights',
        'tarot_coach_recommendation', 'tarot_coach_stats_snapshot'];
      for (const id of [userId, 'other-owner']) for (const prefix of prefixes) {
        localStorage.setItem(`${prefix}_${id}`, JSON.stringify([{ id: 'saved', personalReading: `${id} saved reading` }]));
      }
      localStorage.setItem('tarot_journal', JSON.stringify([{ id: 'guest-saved', personalReading: 'guest saved reading', cards: [] }]));
      localStorage.setItem(`tarot_visual_resume:user:${encodeURIComponent(userId)}:saved`, 'deleted owner capability');
      localStorage.setItem('tarot_visual_resume:user:other-owner:saved', 'other owner capability');
      localStorage.setItem('tarot_visual_resume:anon:saved', 'guest capability');
      localStorage.setItem('journey_narrative_cache', JSON.stringify({
        [`${userId}:season`]: { narrative: 'deleted owner narrative' },
        'other-owner:season': { narrative: 'other owner narrative' },
        'anon:season': { narrative: 'guest narrative' }
      }));
      const keys = [...prefixes.map(prefix => `${prefix}_other-owner`), 'tarot_journal',
        'tarot_visual_resume:user:other-owner:saved', 'tarot_visual_resume:anon:saved'];
      return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
    }, owner);
    // WebKit's automation scroll can return while CSS smooth scrolling still
    // moves the target. Assert its actual foreground position before input.
    await expectForeground(button);
    await button.click();
    const confirmation = page.getByRole('dialog', { name: 'Delete account?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Delete account', exact: true }).click();
    await expect.poll(() => page.evaluate(userId => ['tarot_journal', 'tarot_journal_cache', 'tarot_journal_insights',
      'tarot_coach_recommendation', 'tarot_coach_stats_snapshot'].every(prefix => localStorage.getItem(`${prefix}_${userId}`) === null)
      && localStorage.getItem(`tarot_visual_resume:user:${encodeURIComponent(userId)}:saved`) === null, owner)).toBe(true);
    const state = await page.evaluate(keys => ({ retained: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])),
      narratives: JSON.parse(localStorage.getItem('journey_narrative_cache')) }), Object.keys(retained));
    expect(state.retained).toEqual(retained);
    expect(state.narratives).toEqual({ 'other-owner:season': { narrative: 'other owner narrative' }, 'anon:season': { narrative: 'guest narrative' } });
    expect(deletions).toBe(1);
    expect(fixture.requests.reading).toHaveLength(0);
    expect(fixture.requests.visual).toHaveLength(0);
    finishAuth();
    await expect(page).toHaveURL(new URL('/', page.url()).href);
    await expect(page.getByText('Account deleted', { exact: true })).toBeVisible();
    const after = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(retained));
    expect(after).toEqual(retained);
    assertHealth();
  } finally {
    finishAuth();
    await fixture.close();
  }
});
