import { readFile } from 'node:fs/promises';
import { test, expect } from './helpers/frontendTest.js';
import { REVERSAL_FRAMEWORK_KEYS } from '../src/lib/preferenceStorage.js';

const READER = {
  id: 'account-safety-reader', username: 'Reader', email: 'reader@example.invalid',
  email_verified: true, subscription_tier: 'free', subscription_status: 'inactive'
};
const LOCAL_ENTRIES = [
  { id: 'local-old', ts: 1792400000, spread: 'Single Card', cards: [], personalReading: 'Earlier reflection.' },
  { id: 'local-new', ts: 1792500000000, spread: 'Single Card', cards: [], personalReading: 'Keep this reading.', followUps: [{ question: 'Next?', answer: 'A small step.' }] }
];

function serverExport(user) {
  return {
    exportVersion: 1,
    exportedAt: '2026-10-21T12:00:00.000Z',
    account: user,
    analyticsPreferences: null,
    journal: { count: 1, entries: [{ id: 'cloud-old', narrative: 'Cloud copy.' }] },
    readerMemories: { count: 0, memories: [] },
    followUpConversations: { count: 0, conversations: [] },
    archetypeJourney: { cardAppearances: [], badges: [], patternOccurrences: [] },
    sharedJournals: { links: [], entries: [], notes: [] }
  };
}

// Scoped API fixtures exercise browser behavior; these are not real sessions.
async function prepare(page, overrides = {}, { entries = LOCAL_ENTRIES } = {}) {
  let user = { ...READER, ...overrides };
  const journalRequests = [];
  let logoutRequests = 0;
  await page.addInitScript(({ id, entries }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem(`tarot_journal_${id}`, JSON.stringify(entries));
  }, { id: READER.id, entries });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: user ? 200 : 401, json: { user } });
    if (path === '/api/auth/logout') {
      logoutRequests += 1;
      user = null;
      return route.fulfill({ json: { success: true } });
    }
    if (path === '/api/subscription') return route.fulfill({ json: { subscription: {
      tier: user?.subscription_tier, status: user?.subscription_status, provider: user?.subscription_provider
    } } });
    if (path === '/api/account/export') return route.fulfill({ json: serverExport(user) });
    if (path === '/api/journal') {
      journalRequests.push(route.request().url());
      return route.fulfill({ status: 403, json: { error: 'Cloud journal sync requires an active Plus or Pro subscription' } });
    }
    if (path === '/api/archetype-journey/preferences') return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    return route.fulfill({ json: { success: true, entries: [], memories: [], cards: [], enabled: false } });
  });
  return { journalRequests, setUser: next => { user = next; }, logoutRequests: () => logoutRequests };
}

async function editProfile(page) {
  await page.locator('#profile').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('ChangedReader');
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Account data safety — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

    for (const status of ['active', 'inactive']) {
      test(`Free plan summary omits the misleading ${status} billing status`, async ({ page }) => {
        await prepare(page, { subscription_status: status });
        await page.goto('/account');
        const summary = page.locator('button[aria-controls="plan-usage-details"]');
        await expect(summary).toContainText('Free plan');
        await expect(summary).not.toContainText(/Inactive|Active/);
        await expect(page.locator('#privacy')).not.toContainText('Active subscription detected');
      });
    }

    test('paid plan summary names the tier once and keeps the billing status', async ({ page }) => {
      await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
      await page.goto('/account');
      const summary = page.locator('button[aria-controls="plan-usage-details"]');
      await expect(summary).toContainText('Active');
      expect((await summary.innerText()).match(/Mystic/g)).toHaveLength(1);
    });

    test('cloud practice summary omits full journal reads and embeddings', async ({ page }) => {
      await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
      const queries = [];
      await page.route('**/api/journal?*', route => {
        const query = new URL(route.request().url()).search;
        queries.push(query);
        return route.fulfill(query === '?summary=true' ? { json: { summary: { total: 3, lastReadingAt: Date.now() } } }
          : { status: 500, json: { error: 'Account must request only the summary.' } });
      });
      await page.goto('/account');
      await expect(page.locator('#practice .tabular-nums')).toHaveText('3');
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.every(query => query === '?summary=true')).toBe(true);
    });

    test.describe('local calendar labels', () => {
      test.use({ timezoneId: 'America/Chicago' });
      test('a reading from yesterday evening stays Yesterday the next morning', async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-10-21T13:00:00Z'));
        await prepare(page, {}, { entries: [{ ...LOCAL_ENTRIES[1], ts: Date.parse('2026-10-21T04:00:00Z') }] });
        await page.goto('/account');
        await expect(page.locator('#practice')).toContainText('Yesterday');
      });
    });

    for (const [provider, label] of [['stripe', 'Stripe'], ['apple', 'Apple App Store'], ['google_play', 'Google Play'], ['manual', 'billing provider']]) {
      test(`${provider} deletion billing copy matches its cancellation behavior`, async ({ page }) => {
        await prepare(page, { subscription_tier: 'pro', subscription_status: 'active', subscription_provider: provider });
        await page.goto('/account');
        await page.getByRole('button', { name: 'Delete account', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Delete account?' });
        await expect(dialog).toContainText(label);
        if (provider === 'stripe') {
          await expect(dialog).toContainText('requests cancellation');
          await expect(dialog).not.toContainText('does not cancel');
        } else if (provider !== 'manual') {
          await expect(dialog).toContainText('does not cancel');
          await expect(dialog).toContainText('separately');
        }
      });
    }

    test('all supported reversal lenses persist through reload and Auto clears the preference', async ({ page }) => {
      await prepare(page);
      await page.goto('/account#reading');
      const select = page.locator('#reversal-framework-select');
      await expect(select).toBeVisible();
      await expect(select.locator('option')).toHaveCount(REVERSAL_FRAMEWORK_KEYS.length + 1);
      expect(await select.locator('option').evaluateAll(options => options.map(option => option.value)))
        .toEqual(['auto', ...REVERSAL_FRAMEWORK_KEYS]);
      for (const key of REVERSAL_FRAMEWORK_KEYS) {
        await select.selectOption(key);
        await expect.poll(() => page.evaluate(() => localStorage.getItem('tarot-reversal-framework'))).toBe(key);
        await page.reload();
        await expect(select).toHaveValue(key);
      }
      await select.selectOption('auto');
      await expect.poll(() => page.evaluate(() => localStorage.getItem('tarot-reversal-framework'))).toBe(null);
      await page.reload();
      await expect(select).toHaveValue('auto');
      expect(await page.evaluate(() => localStorage.getItem('tarot-reversal-framework'))).toBe(null);
    });

    for (const [tier, status] of [['free', 'inactive'], ['pro', 'expired']]) {
      test(`${tier}/${status} counts and exports device readings alongside server data`, async ({ page }) => {
        const fixture = await prepare(page, { subscription_tier: tier, subscription_status: status });
        await page.goto('/account');
        const practice = page.locator('#practice');
        await expect(practice.locator('.tabular-nums')).toHaveText('2');
        await expect(practice).not.toContainText('Unable to load your journal');
        expect(fixture.journalRequests).toEqual([]);
        await editProfile(page);
        const downloadEvent = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export all data (JSON)', exact: true }).click();
        const download = await downloadEvent;
        const data = JSON.parse(await readFile(await download.path(), 'utf8'));
        expect(data.journal.count).toBe(3);
        expect(data.journal.entries.map(entry => entry.id)).toEqual(expect.arrayContaining(['cloud-old', 'local-old', 'local-new']));
        expect(data.journal.entries.find(entry => entry.id === 'local-new').followUps).toEqual(LOCAL_ENTRIES[1].followUps);
        expect(data.devicePreferences).toBeTruthy();
        expect(fixture.journalRequests).toEqual([]);
        await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toHaveCount(0);
        await expect(page.getByLabel('Username', { exact: true })).toHaveValue('ChangedReader');
      });
    }

    for (const tier of ['plus', 'pro']) {
      test(`${tier} exports unmigrated device readings with cloud data and excludes other owners and deletions`, async ({ page }) => {
        await prepare(page, { subscription_tier: tier, subscription_status: 'active' }, { entries: [
          ...LOCAL_ENTRIES,
          { id: 'cloud-old', personalReading: 'Local copy of a migrated reading.', followUps: [{ question: 'Keep?', answer: 'Keep the local follow-up.' }] },
          { id: 'legacy-first', ts: 1792590000000, personalReading: 'First saved reflection.' },
          { id: 'legacy-second', ts: 1792590000000, personalReading: 'Second saved reflection.' },
          { id: 'deleted-local', ts: 1792600000000, personalReading: 'Deleted reading.' }
        ] });
        await page.addInitScript(id => {
          localStorage.setItem('tarot_journal_other-reader', JSON.stringify([{ id: 'other-owner', personalReading: 'Private other owner.' }]));
          localStorage.setItem('tarot_journal', JSON.stringify([{ id: 'unclaimed-guest', personalReading: 'Unclaimed guest reading.' }]));
          localStorage.setItem(`tarot_deleted_journal_entry:user:${encodeURIComponent(id)}:deleted-local`, '1');
        }, READER.id);
        await page.goto('/account');
        const downloadEvent = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export all data (JSON)', exact: true }).click();
        const data = JSON.parse(await readFile(await (await downloadEvent).path(), 'utf8'));
        expect(data.journal.count).toBe(5);
        expect(data.journal.entries.map(entry => entry.id).sort()).toEqual(['cloud-old', 'legacy-first', 'legacy-second', 'local-new', 'local-old']);
        expect(data.journal.entries.find(entry => entry.id === 'cloud-old')).toMatchObject({
          narrative: 'Cloud copy.', followUps: [{ question: 'Keep?', answer: 'Keep the local follow-up.' }]
        });
        expect(JSON.stringify(data)).not.toMatch(/other-owner|unclaimed-guest|deleted-local/);
        await expect(page.getByText('Export ready', { exact: true })).toBeVisible();
      });
    }

    for (const failure of ['invalid JSON', 'missing sections', 'invalid entry list', 'incorrect count', 'wrong owner']) {
      test(`${failure} in the server export prevents a successful partial download`, async ({ page }) => {
        await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
        const payload = serverExport({ ...READER, subscription_tier: 'pro', subscription_status: 'active' });
        if (failure === 'missing sections') delete payload.sharedJournals;
        if (failure === 'invalid entry list') payload.journal.entries = 'unreadable entries';
        if (failure === 'incorrect count') payload.journal.count = 5;
        if (failure === 'wrong owner') payload.account.id = 'other-reader';
        await page.route('**/api/account/export', route => route.fulfill({
          contentType: 'application/json', body: failure === 'invalid JSON' ? '{"journal":' : JSON.stringify(payload)
        }));
        await page.goto('/account');
        const downloads = [];
        page.on('download', download => downloads.push(download));
        await page.getByRole('button', { name: 'Export all data (JSON)', exact: true }).click();
        await expect(page.getByText('Export failed', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Export all data (JSON)', exact: true })).toBeEnabled();
        expect(downloads).toHaveLength(0);
        await expect(page.getByText('Export ready', { exact: true })).toHaveCount(0);
      });
    }

    test('unreadable device storage prevents a paid account from downloading an incomplete export', async ({ page }) => {
      await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
      await page.goto('/account');
      await page.evaluate(id => {
        const read = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key === `tarot_journal_${id}`) throw new DOMException('Storage unavailable', 'SecurityError');
          return read.call(this, key);
        };
      }, READER.id);
      const downloads = [];
      page.on('download', download => downloads.push(download));
      await page.getByRole('button', { name: 'Export all data (JSON)', exact: true }).click();
      await expect(page.getByText('Unable to read your saved journal.', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export all data (JSON)', exact: true })).toBeEnabled();
      expect(downloads).toHaveLength(0);
    });

    test('an unavailable cloud count stays unknown instead of displaying zero', async ({ page }) => {
      await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
      await page.goto('/account');
      await expect(page.locator('#practice')).toContainText('Unable to load your journal.');
      await expect(page.locator('#practice .tabular-nums')).toHaveText('—');
      await expect(page.locator('#practice')).not.toContainText('None yet');
    });

    test('the practice card refreshes when cloud journal access is gained', async ({ page }) => {
      const fixture = await prepare(page);
      await page.route('**/api/journal?*', route => route.fulfill({ json: {
        summary: { total: 12, lastReadingAt: Date.now() }
      } }));
      await page.goto('/account');
      await expect(page.locator('#practice .tabular-nums')).toHaveText('2');
      fixture.setUser({ ...READER, subscription_tier: 'plus', subscription_status: 'active' });
      await page.evaluate(async () => {
        dispatchEvent(new CustomEvent('tableau:route-change', { detail: { pathname: '/design' } }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        dispatchEvent(new CustomEvent('tableau:route-change', { detail: { pathname: '/account' } }));
      });
      await expect(page.locator('#practice .tabular-nums')).toHaveText('12');
    });

    for (const [scenario, stored] of [['invalid JSON', '{broken json'], ['invalid list', '{"entries":[]}'], ['invalid entry', '[null]']]) {
      for (const tier of ['free', 'pro']) {
        test(`${tier} ${scenario} in local readings prevents a successful partial JSON download`, async ({ page }) => {
          await prepare(page, { subscription_tier: tier, subscription_status: tier === 'free' ? 'inactive' : 'active' });
          await page.goto('/account');
          if (tier === 'free') await expect(page.locator('#practice .tabular-nums')).toHaveText('2');
          const downloads = [];
          page.on('download', download => downloads.push(download));
          await page.evaluate(({ id, stored }) => localStorage.setItem(`tarot_journal_${id}`, stored), { id: READER.id, stored });
          await page.getByRole('button', { name: 'Export all data (JSON)', exact: true }).click();
          await expect(page.getByText('Unable to read your saved journal.', { exact: true }).first()).toBeVisible();
          await expect(page.getByRole('button', { name: 'Export all data (JSON)', exact: true })).toBeEnabled();
          expect(downloads).toHaveLength(0);
        });
      }
    }

    test('subscription deep links expand details on load and after another section', async ({ page }) => {
      await prepare(page);
      await page.goto('/account#subscription');
      const summary = page.locator('button[aria-controls="plan-usage-details"]');
      await expect(summary).toHaveAttribute('aria-expanded', 'true');
      await summary.click();
      await page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link', { name: 'Profile', exact: true }).click();
      await page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link', { name: /Plan/ }).click();
      await expect(summary).toHaveAttribute('aria-expanded', 'true');
    });

    for (const provider of ['manual', 'stripe']) {
      test(`${provider} billing errors are visible beside account removal`, async ({ page }) => {
        await prepare(page, { subscription_tier: 'pro', subscription_status: 'active', subscription_provider: provider });
        await page.route('**/api/create-portal-session', route => route.fulfill({ status: 503, json: { error: 'Billing service unavailable.' } }));
        await page.goto('/account');
        await page.getByRole('button', { name: 'Manage subscription', exact: true }).click();
        await expect(page.locator('#privacy').getByRole('alert')).toContainText(provider === 'manual'
          ? 'Use your billing provider' : 'Billing service unavailable.');
      });
    }

    test('section jumps keep edits and Back protection without opening a discard dialog', async ({ page }) => {
      await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
      await page.goto('/pricing');
      await page.getByRole('link', { name: 'Manage current plan', exact: true }).click();
      await editProfile(page);
      const originalLength = await page.evaluate(() => history.length);
      const sections = page.getByRole('navigation', { name: 'Jump to section' });
      for (const name of ['Profile', 'Plan', 'Audio', 'Plan']) {
        await sections.getByRole('link', { name, exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toHaveCount(0);
        expect(await page.evaluate(() => history.length)).toBe(originalLength);
        await expect(page.getByLabel('Username', { exact: true })).toHaveValue('ChangedReader');
      }
      await page.locator('button[aria-controls="plan-usage-details"]').click();
      await sections.getByRole('link', { name: 'Plan', exact: true }).click();
      await expect(page.locator('button[aria-controls="plan-usage-details"]')).toHaveAttribute('aria-expanded', 'true');
      await page.goBack();
      const dialog = page.getByRole('dialog', { name: 'Discard your changes?' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
      await expect(page.getByLabel('Username', { exact: true })).toHaveValue('ChangedReader');
      await page.goBack();
      await dialog.getByRole('button', { name: 'Discard and leave', exact: true }).click();
      await expect(page).toHaveURL(/\/pricing$/);
    });

    test('confirming sign out retains the history guard until logout completes', async ({ page }) => {
      const fixture = await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
      let release;
      let requested = false;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/api/auth/logout', async route => {
        requested = true;
        await gate;
        fixture.setUser(null);
        await route.fulfill({ json: { success: true } });
      });
      try {
        await page.goto('/pricing');
        await page.getByRole('link', { name: 'Manage current plan', exact: true }).click();
        await editProfile(page);
        await page.locator('#actions').getByRole('button', { name: 'Sign Out', exact: true }).click();
        await page.getByRole('button', { name: 'Discard and leave', exact: true }).click();
        await expect.poll(() => requested).toBe(true);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        expect(await page.evaluate(() => history.state?.tableuOverlayGuard)).toBeTruthy();
        release();
        await expect(page).toHaveURL(/\/$/);
      } finally { release(); }
    });

    for (const action of ['Save changes', 'Cancel']) {
      test(`${action} after section jumps preserves the selected section and removes the profile Back guard`, async ({ page }) => {
        const fixture = await prepare(page, { subscription_tier: 'pro', subscription_status: 'active' });
        await page.route('**/api/account/profile', route => {
          fixture.setUser({ ...READER, subscription_tier: 'pro', subscription_status: 'active', ...route.request().postDataJSON() });
          return route.fulfill({ json: { success: true } });
        });
        await page.goto('/pricing');
        await page.getByRole('link', { name: 'Manage current plan', exact: true }).click();
        await editProfile(page);
        await page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link', { name: 'Reading', exact: true }).click();
        await page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link', { name: 'Audio', exact: true }).click();
        await expect(page).toHaveURL(/\/account#audio$/);
        await page.locator('#profile').getByRole('button', { name: action, exact: true }).last().click();
        if (action === 'Save changes') await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
        await expect.poll(() => page.evaluate(() => history.state?.tableuOverlayGuard ?? null)).toBe(null);
        await expect(page).toHaveURL(/\/account#audio$/);
        await expect(page.locator('#subscription-heading')).not.toBeFocused();
        await expect(page.locator('#audio')).toBeInViewport();
        await page.goBack();
        await expect(page).toHaveURL(/\/pricing$/);
        await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toHaveCount(0);
      });
    }

    for (const exit of ['journal link', 'global navigation', 'home link', 'pricing link', 'back link', 'menu plan link', 'sign out', 'menu sign out', 'tutorial', 'menu tutorial', 'browser Back']) {
      test(`unsaved profile changes survive ${exit} until discard is confirmed`, async ({ page }) => {
        const fixture = await prepare(page, exit === 'menu plan link' ? {} : {
          subscription_tier: 'pro', subscription_status: 'active', subscription_provider: 'stripe'
        });
        if (exit === 'menu plan link') await page.goto('/account');
        else {
          await page.goto('/pricing');
          await page.getByRole('link', { name: 'Manage current plan', exact: true }).click();
        }
        await expect(page).toHaveURL(/\/account/);
        await editProfile(page);
        const leave = async () => {
          if (exit === 'journal link') await page.getByRole('link', { name: 'Open journal', exact: true }).click();
          if (exit === 'global navigation') await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Journal', exact: true }).click();
          if (exit === 'home link') await page.getByRole('link', { name: 'Tableu home', exact: true }).click();
          if (exit === 'back link') await page.locator('main').getByRole('link', { name: 'Back to reading', exact: true }).first().click();
          if (exit.startsWith('menu')) {
            await page.getByRole('button', { name: 'User menu for Reader', exact: true }).click();
            const menu = page.getByRole('menu', { name: 'User menu', exact: true });
            if (exit === 'menu plan link') await menu.getByRole('link', { name: 'View Plans', exact: true }).click();
            if (exit === 'menu sign out') await menu.getByRole('menuitem', { name: 'Sign Out', exact: true }).click();
            if (exit === 'menu tutorial') await menu.getByRole('menuitem', { name: 'Replay Tutorial', exact: true }).click();
          }
          if (exit === 'pricing link') {
            const summary = page.locator('button[aria-controls="plan-usage-details"]');
            if (await summary.getAttribute('aria-expanded') === 'false') await summary.click();
            await page.locator('#subscription').getByRole('link', { name: /Upgrade|View Plans/ }).click();
          }
          if (exit === 'sign out') await page.locator('#actions').getByRole('button', { name: 'Sign Out', exact: true }).click();
          if (exit === 'tutorial') await page.locator('#actions').getByRole('button', { name: 'Replay Tutorial', exact: true }).click();
          if (exit === 'browser Back') await page.goBack();
        };
        await leave();
        const dialog = page.getByRole('dialog', { name: 'Discard your changes?' });
        await expect(dialog).toBeVisible();
        expect(fixture.logoutRequests()).toBe(0);
        await expect(page.locator('[data-app-header]')).toHaveAttribute('inert', '');
        await expect(page.locator('[data-app-bottom-region]')).toHaveAttribute('inert', '');
        await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
        await expect(page.getByLabel('Username', { exact: true })).toHaveValue('ChangedReader');
        await leave();
        await dialog.getByRole('button', { name: 'Discard and leave', exact: true }).click();
        if (exit === 'tutorial' || exit === 'menu tutorial') {
          await expect(page.getByRole('dialog', { name: 'Replay tutorial?' })).toBeVisible();
        } else {
          await expect(page).toHaveURL(exit.includes('journal') || exit === 'global navigation' ? /\/journal$/
            : ['sign out', 'back link', 'home link'].includes(exit) ? /\/$/ : exit === 'menu sign out' ? /\/account/ : /\/pricing$/);
        }
        if (exit.includes('sign out')) expect(fixture.logoutRequests()).toBe(1);
      });
    }
  });
}
