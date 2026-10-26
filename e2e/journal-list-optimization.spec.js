import { test, expect } from './helpers/frontendTest.js';

const values = Array.from({ length: 300 }, (_, index) => ({
  id: `optimized-${index}`, readingResultId: `optimized-result-${index}`, ts: Date.UTC(2026, 9, 25) - index * 86400000,
  question: `Saved question ${index}`, spread: 'Single Card Insight', spreadKey: 'single', context: 'self',
  cards: [{ name: 'The Hermit', number: 9, position: 'Focus', orientation: 'Upright' }],
  personalReading: index === 299 ? 'An older full narrative with a silver orchard.' : 'A saved reflection. '.repeat(300),
  reflections: { Overall: `A personal note ${index}` }
}));

async function openPaged(page, { hold = false, fail = false, entries = values, firstPageSize = 10, total = entries.length } = {}) {
  const state = { requests: [], release: null, fail };
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: { user: { id: 'optimized-owner', username: 'List reviewer',
      subscription_tier: 'pro', subscription_status: 'active', email_verified: true } } });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fulfill({ status: 503, json: { error: 'Read-only synthetic fixture' } });
    if (path === '/api/journal') {
      state.requests.push(url.searchParams.toString());
      const cursorId = url.searchParams.get('cursorId');
      const start = cursorId ? entries.findIndex(entry => entry.id === cursorId) + 1 : 0;
      const limit = url.searchParams.get('all') === 'true' ? entries.length : Number(url.searchParams.get('limit') || 25);
      const batch = entries.slice(start, start + (start === 0 ? Math.min(limit, firstPageSize) : limit));
      if (start > 0 && hold && !state.release) await new Promise(resolve => { state.release = resolve; });
      if (start > 0 && state.fail) {
        state.fail = false;
        return route.fulfill({ status: 503, json: { error: 'Synthetic interrupted connection' } });
      }
      return route.fulfill({ json: { entries: batch, pagination: { total,
        hasMore: start + batch.length < entries.length,
        nextCursor: batch.at(-1)?.ts ?? null, nextCursorId: batch.at(-1)?.id ?? null } } });
    }
    if (path === '/api/archetype-journey/preferences') return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    if (path === '/api/share') return route.fulfill({ json: { shares: [] } });
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.removeItem('tarot_journal');
    localStorage.setItem('tarot_journal_cache_optimized-owner', JSON.stringify([{ id: 'previous-complete-copy', cards: [] }]));
    localStorage.setItem('journal_filters_advanced_v1', 'false');
  });
  await page.goto('/journal');
  await expect(page.locator('#history article')).toHaveCount(Math.min(firstPageSize, entries.length));
  return state;
}

test('first readings work while bounded pages load; full-text search waits for complete history', async ({ page }) => {
  const state = await openPaged(page, { hold: true });
  expect(new URLSearchParams(state.requests[0]).get('limit')).toBe('10');
  expect(new URLSearchParams(state.requests[0]).has('all')).toBe(false);
  const search = page.getByRole('searchbox', { name: 'Search journal entries' });
  await expect(search).toBeDisabled();
  await expect(page.getByText('Loading your complete history', { exact: true })).toBeVisible();
  await page.locator('#history article').first().getByTitle('Expand entry', { exact: true }).click();
  await expect(page.locator('#history article').first().getByText('A saved reflection.', { exact: false }).first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal_cache_optimized-owner'))[0].id)).toBe('previous-complete-copy');
  await expect.poll(() => Boolean(state.release)).toBe(true);
  state.release();
  await expect(search).toBeEnabled();
  await expect(page.getByText('Loaded: 300 of 300', { exact: true })).toBeVisible();
  expect(state.requests).toHaveLength(4);
  expect(state.requests.every(query => Number(new URLSearchParams(query).get('limit')) <= 100)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal_cache_optimized-owner')).length)).toBe(300);
  await search.fill('silver orchard');
  await expect(page.locator('#history article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Saved question 299', exact: true })).toBeVisible();
  await search.fill('A personal note 298');
  await expect(page.getByRole('heading', { name: 'Saved question 298', exact: true })).toBeVisible();
});

test('completed history reconciles both count labels when server rows include a duplicate', async ({ page }) => {
  const state = await openPaged(page, { entries: values.slice(0, 12), total: 13, hold: true });
  const search = page.getByRole('searchbox', { name: 'Search journal entries' });
  await expect(search).toBeDisabled();
  await expect(page.getByText('Loaded: 10 of 13', { exact: true })).toBeVisible();
  await expect(page.getByText('Loaded 10 of 13 entries', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(state.release)).toBe(true);
  state.release();

  await expect(search).toBeEnabled();
  await expect(page.getByText('Loaded: 12 of 12', { exact: true })).toBeVisible();
  await expect(page.getByText('Showing 10 of 12 readings', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Loaded [0-9]+ of [0-9]+ entries$/)).toHaveCount(0);
  await search.fill('A personal note 11');
  await expect(page.locator('#history article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Saved question 11', exact: true })).toBeVisible();
  await expect(page.getByText('Loaded: 12 of 12', { exact: true })).toBeVisible();
});

test('an interrupted background page pauses automatically and explicit retry restores full-history tools', async ({ page }) => {
  const state = await openPaged(page, { fail: true });
  const retry = page.getByRole('button', { name: 'Retry loading history', exact: true });
  await expect(retry).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toBeDisabled();
  await expect(page.locator('#history article')).toHaveCount(10);
  const requestCount = state.requests.length;
  await page.waitForTimeout(1000);
  expect(state.requests.length).toBe(requestCount);
  await retry.press('Enter');
  await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toBeEnabled();
  await expect(page.getByText('Loaded: 300 of 300', { exact: true })).toBeVisible();
  await expect(retry).toHaveCount(0);
});

test('retry stays reachable when the loaded readings are deleted before older history recovers', async ({ page }) => {
  await openPaged(page, { fail: true, firstPageSize: 1 });
  const retry = page.getByRole('button', { name: 'Retry loading history', exact: true });
  await expect(retry).toBeVisible();
  await page.route('**/api/journal/optimized-0', route => route.fulfill({ json: {
    success: true, retiredReadingResultIds: ['optimized-result-0']
  } }));
  await page.locator('#history article').getByRole('button', { name: /^Open entry actions for / }).click();
  await page.getByRole('menuitem', { name: 'Delete entry', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete Journal Entry' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('#history article')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Start your tarot journal', exact: true })).toHaveCount(0);
  await expect(page.locator('#journal-history-progress')).not.toContainText('Open a reading now');
  await expect(retry).toBeVisible();
  await retry.press('Enter');
  await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toBeEnabled();
  await expect(page.locator('#history article').first().locator('button[aria-expanded]').first()).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal_cache_optimized-owner')).some(entry => entry.id === 'optimized-0'))).toBe(false);
});

test('search and density changes do not reparse the unchanged local history', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: new URL(route.request().url()).pathname === '/api/auth/me' ? 401 : 200, json: {} }));
  await page.addInitScript(entries => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot_journal', JSON.stringify(entries));
    window.__largeJournalParses = 0;
    const parse = JSON.parse;
    JSON.parse = function (text, ...args) {
      if (typeof text === 'string' && text.length > 100000) window.__largeJournalParses += 1;
      return parse.call(this, text, ...args);
    };
  }, values);
  await page.goto('/journal');
  await expect(page.locator('#history article')).toHaveCount(10);
  await page.evaluate(() => { window.__largeJournalParses = 0; });
  await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('silver orchard');
  await expect(page.locator('#history article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  expect(await page.evaluate(() => window.__largeJournalParses)).toBe(0);
});

test('local import availability follows storage changes in another tab without a reload', async ({ page, context }) => {
  await openPaged(page, { entries: [values[0]] });
  const migrate = page.getByRole('button', { name: 'Add local entries to cloud journal', exact: true });
  await expect(migrate).toHaveCount(0);
  const other = await context.newPage();
  await other.goto('/robots.txt');
  await other.evaluate(entry => localStorage.setItem('tarot_journal', JSON.stringify([entry])), values[1]);
  await expect(migrate).toBeVisible();
  await other.evaluate(() => localStorage.removeItem('tarot_journal'));
  await expect(migrate).toHaveCount(0);
  await other.close();
});
