import { test, expect } from './helpers/frontendTest.js';

const FIRST_QUESTION = 'What deserves a quieter place in my week? 🌿 安心';
const cards = [
  { name: 'The Hermit', number: 9, position: 'Past', orientation: 'Upright' },
  { name: 'Three of Cups', suit: 'Cups', rank: 'Three', position: 'Present', orientation: 'Reversed' }
];
const entries = [9, 10, 10, 6].flatMap((count, monthOffset) => Array.from({ length: count }, (_, index) => ({
  id: `list-hardening-${monthOffset}-${index}`,
  readingResultId: `list-hardening-reading-${monthOffset}-${index}`,
  sessionSeed: `list-hardening-seed-${monthOffset}-${index}`,
  ts: Date.UTC(2026, 9 - monthOffset, 25 - index, 12),
  question: monthOffset === 0 && index === 0 ? FIRST_QUESTION : `Reflection ${monthOffset}-${index}`,
  spread: 'Three-Card Story', spreadKey: 'threeCard', deckId: 'rws-1909', context: 'self', cards,
  personalReading: 'Make room for a small, useful reflection.'
})));

async function openList(page, { owner = false, values = entries, theme = 'dark' } = {}) {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill(owner
      ? { json: { user: { id: 'list-owner', username: 'List reviewer', subscription_tier: 'pro', subscription_status: 'active', email_verified: true } } }
      : { status: 401, json: { user: null } });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fulfill({ status: 503, json: { error: 'Read-only list fixture' } });
    if (path === '/api/journal') return route.fulfill({ json: { entries: values, pagination: { total: values.length, hasMore: false, nextCursor: null } } });
    if (path === '/api/share') return route.fulfill({ json: { shares: [{
      token: 'list-audit-synthetic-link', scope: 'entry', entryId: values[0].id, entryIds: [values[0].id],
      entryCount: 1, title: 'A saved reflection', viewCount: 0, expiresAt: null
    }] } });
    if (path === '/api/archetype-journey/preferences') return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(({ values, theme }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot_journal', JSON.stringify(values));
    localStorage.setItem('tarot-theme', theme);
    localStorage.setItem('journal_filters_advanced_v1', 'false');
  }, { values, theme });
  await page.goto('/journal');
  await expect(page.getByRole('heading', { name: 'Saved readings', exact: true })).toBeVisible();
  await expect(page.locator('#history article')).toHaveCount(Math.min(10, values.length));
}

function toggle(article) {
  return article.locator('button[aria-expanded]').first();
}

test('month navigation includes the complete filtered history and reveals its destination', async ({ page }) => {
  await openList(page);
  const months = page.getByRole('combobox', { name: 'Jump to month', exact: true });
  await expect(months.locator('option')).toHaveText([
    'Jump to month', 'October 2026 (9)', 'September 2026 (10)', 'August 2026 (10)', 'July 2026 (6)'
  ]);
  await expect(page.getByText('Showing 10 of 35 readings', { exact: true })).toBeVisible();
  await months.selectOption('2026-07');
  const july = page.locator('#history article').filter({ has: page.getByRole('heading', { name: 'Reflection 3-0', exact: true }) });
  await expect(toggle(july)).toBeFocused();
  await expect(toggle(july)).toBeInViewport();
  await expect(months.locator('option[value="2026-09"]')).toHaveText('September 2026 (10)');
  await expect(months.locator('option[value="2026-07"]')).toHaveText('July 2026 (6)');
  const search = page.getByRole('searchbox', { name: 'Search journal entries' });
  await search.fill('Reflection 2-');
  await expect(page.locator('#history article')).toHaveCount(10);
  await expect(page.getByText('Showing 10 of 10 readings', { exact: true })).toBeVisible();
  await expect(search).toBeFocused();
});

test('keyboard pagination focuses new readings, including when the final loading button disappears', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'Load 10 more', exact: true }).press('Enter');
  await expect(page.locator('#history article')).toHaveCount(20);
  await expect(toggle(page.locator('#history article').nth(10))).toBeFocused();
  await expect(toggle(page.locator('#history article').nth(10))).toBeInViewport();
  await expect(page.getByRole('status').filter({ hasText: 'Showing 20 of 35 readings' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Load 10 more', exact: true }).press('Enter');
  await expect(toggle(page.locator('#history article').nth(20))).toBeFocused();
  await page.getByRole('button', { name: 'Load 5 more', exact: true }).press('Enter');
  await expect(page.locator('#history article')).toHaveCount(35);
  await expect(toggle(page.locator('#history article').nth(30))).toBeFocused();
  await expect(page.getByRole('button', { name: /^Load \d+ more$/ })).toHaveCount(0);
});

test('pointer pagination preserves the current scroll position', async ({ page }) => {
  await openList(page);
  const load = page.getByRole('button', { name: 'Load 10 more', exact: true });
  await load.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await load.click();
  await expect(page.locator('#history article')).toHaveCount(20);
  await expect(toggle(page.locator('#history article').nth(10))).not.toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
});

test('row actions identify their reading and articles expose the reading heading', async ({ page }) => {
  await openList(page);
  const first = page.getByRole('article', { name: FIRST_QUESTION, exact: true });
  await expect(first).toBeVisible();
  await expect(first.getByRole('button', { name: `Copy summary for ${FIRST_QUESTION}`, exact: true })).toBeVisible();
  await first.getByRole('button', { name: `Open entry actions for ${FIRST_QUESTION}`, exact: true }).press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(first.getByRole('button', { name: `Open entry actions for ${FIRST_QUESTION}`, exact: true })).toBeFocused();
});

test('both list densities expose exact semantic dates and handle an undated reading', async ({ page }) => {
  await openList(page, { values: [entries[0], { ...entries[1], id: 'undated-reading', ts: null }] });
  const date = page.locator('#history article').first().locator('time');
  for (const density of ['Comfortable', 'Compact']) {
    await page.getByRole('button', { name: density, exact: true }).click();
    await expect(date).toHaveAttribute('datetime', '2026-10-25T12:00:00.000Z');
    await expect(date).toContainText('Oct 25, 2026');
    await expect(date).toContainText('12:00 PM');
    await expect(page.locator('#history article').nth(1)).toContainText('Date unavailable');
    await expect(page.locator('#history article').nth(1).locator('time')).toHaveCount(0);
  }
});

test.describe('localized exact dates', () => {
  test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  test('uses the reader locale and timezone in both densities', async ({ page }) => {
    await openList(page, { values: [entries[0]] });
    for (const density of ['Comfortable', 'Compact']) {
      await page.getByRole('button', { name: density, exact: true }).click();
      await expect(page.locator('#history article time')).toHaveText('25. Okt. 2026, 13:00');
    }
  });
});

for (const theme of ['dark', 'light']) {
  test(`existing-share controls keep 44px targets at 320px in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openList(page, { owner: true, theme });
    await page.locator('#history article').first().getByRole('button', { name: /^Open entry actions/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('group', { name: 'A saved reflection', exact: true })).toBeVisible();
    for (const name of ['Copy link', 'Delete']) {
      const target = await menu.getByRole('menuitem', { name, exact: true }).boundingBox();
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}
