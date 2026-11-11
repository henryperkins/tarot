import { test, expect } from './helpers/frontendTest.js';
import { selectJournalSort } from './helpers/journalControls.js';

// These mounted source probes require Vite. All account/API data is synthetic;
// they verify React state isolation, not a real session or subscription backend.
async function mountProbe(page, kind) {
  const entries = [2, 1].map(index => ({
    id: `toolbar-owner-${index}`, question: `Owner reading ${index}`,
    ts: Date.UTC(2026, 9, index), spread: 'Single Card', spreadKey: 'single',
    context: 'self', deckId: 'rws-1909', cards: [], personalReading: 'A synthetic reflection.'
  }));
  const user = id => ({ id, username: id, subscription_tier: 'pro', subscription_status: 'active', email_verified: true });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { user: user('owner-a') } });
    if (path === '/api/auth/login') return route.fulfill({ json: { user: user(route.request().postDataJSON().email) } });
    if (path === '/api/auth/logout') return route.fulfill({ json: { success: true } });
    if (path === '/api/journal') return route.fulfill({ json: { entries, pagination: { total: 2, hasMore: false } } });
    if (path === '/api/archetype-journey/preferences') {
      return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    }
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(entries => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    for (const key of ['tarot_journal', 'tarot_journal_owner-a', 'tarot_journal_owner-b']) {
      localStorage.setItem(key, JSON.stringify(entries));
    }
  }, entries);
  await page.goto('/journal');
  await expect(page.getByRole('heading', { name: 'Saved readings', exact: true })).toBeVisible();
  await page.evaluate(async kind => {
    const { mountOwnerProbe } = await import('/e2e/helpers/journalToolbarOwnerProbe.jsx');
    mountOwnerProbe(kind);
  }, kind);
  return page.locator('#toolbar-owner-probe');
}

test('mounted journal resets order on account switches and sign-out', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const host = await mountProbe(page, 'journal');
  const sort = host.getByRole('button', { name: /^Sort readings:/ });
  await expect(host.locator('[data-probe-owner]')).toHaveText('owner-a');
  await expect(sort).toBeEnabled();
  for (const nextOwner of ['owner-b', null, 'owner-a']) {
    await selectJournalSort(host, 'oldest');
    await expect(host.locator('#history article').first()).toHaveAccessibleName('Owner reading 1');
    await expect(host.getByRole('button', { name: 'Save this view', exact: true })).toBeVisible();
    await page.evaluate(owner => window.__toolbarOwnerProbe.owner(owner), nextOwner);
    await expect(host.locator('[data-probe-owner]')).toHaveText(nextOwner || 'guest');
    await expect(sort).toHaveAccessibleName('Sort readings: Newest first');
    await expect(host.locator('#history article').first()).toHaveAccessibleName('Owner reading 2');
    await expect(host.getByRole('button', { name: 'Save this view', exact: true })).toHaveCount(0);
  }
  await page.evaluate(() => window.__toolbarOwnerProbe.cleanup());
  expect(errors).toEqual([]);
});

test('mounted toolbar closes Filters, Sort and View when its owner changes', async ({ page }) => {
  const host = await mountProbe(page, 'toolbar');
  const filters = host.getByRole('button', { name: 'Filters', exact: true });
  for (const nextOwner of ['owner-b', null, 'owner-a']) {
    await filters.click();
    await expect(host.getByRole('dialog', { name: 'Filter saved readings', exact: true })).toBeVisible();
    await page.evaluate(owner => window.__toolbarOwnerProbe.owner(owner), nextOwner);
    await expect(host.getByRole('dialog')).toHaveCount(0);
    await expect(filters).toHaveAttribute('aria-expanded', 'false');
  }
  for (const [name, nextOwner] of [[/^Sort readings:/, 'owner-b'], [/^View:/, null]]) {
    const trigger = host.getByRole('button', { name });
    await trigger.click();
    await expect(host.getByRole('listbox')).toBeVisible();
    await page.evaluate(owner => window.__toolbarOwnerProbe.owner(owner), nextOwner);
    await expect(host.getByRole('listbox')).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  }
  await page.evaluate(() => window.__toolbarOwnerProbe.cleanup());
});
