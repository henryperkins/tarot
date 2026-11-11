import { test, expect } from './helpers/frontendTest.js';
import { selectJournalDensity } from './helpers/journalControls.js';

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
  await expect(page.getByText('10 of 35 readings match', { exact: true })).toBeVisible();
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
  // Locator.click can scroll again while the app chrome settles. Measure at
  // pointer-down so this assertion covers pagination, not Playwright's positioning.
  await load.evaluate(button => {
    button.addEventListener('pointerdown', () => {
      window.__journalPointerScrollY = window.scrollY;
    }, { once: true });
  });
  await load.click();
  await expect(page.locator('#history article')).toHaveCount(20);
  await expect(toggle(page.locator('#history article').nth(10))).not.toBeFocused();
  const scroll = await page.evaluate(() => ({ before: window.__journalPointerScrollY, after: scrollY }));
  expect(scroll.after).toBeCloseTo(scroll.before, 0);
});

test('row actions identify their reading and articles expose the reading heading', async ({ page }) => {
  await openList(page);
  const first = page.getByRole('article', { name: FIRST_QUESTION, exact: true });
  await expect(first).toBeVisible();
  // A collapsed row is one target; its actions appear once the reading is open.
  await expect(first.getByRole('button', { name: /^(Copy summary|Open entry actions) for / })).toHaveCount(0);
  await toggle(first).click();
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
    await selectJournalDensity(page, density);
    await expect(date).toHaveAttribute('datetime', '2026-10-25T12:00:00.000Z');
    await expect(date).toContainText('Oct 25, 2026');
    await expect(date).toContainText('12:00 PM');
    await expect(page.locator('#history article').nth(1)).toContainText('Date unavailable');
    await expect(page.locator('#history article').nth(1).locator('time')).toHaveCount(0);
  }
});

for (const width of [1280, 390]) {
  test.describe(`entry header interactions at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: width === 390 });

    for (const density of ['Comfortable', 'Compact']) {
      test(`${density} keeps keyboard focus through repeated expansion and collapse`, async ({ page }) => {
        await openList(page, { values: entries.slice(0, 2) });
        await selectJournalDensity(page, density);
        const article = page.locator('#history article').first();
        const opener = toggle(article);
        await opener.focus();

        // Use the active element, so a lost focus cannot be masked by a locator
        // that silently refocuses a replacement button before the next keypress.
        for (const key of ['Enter', 'Space']) {
          await page.keyboard.press(key);
          await expect(opener).toHaveAttribute('aria-expanded', 'true');
          await expect(opener).toBeFocused();
          await expect(page.locator('#history [data-journal-entry-toggle][aria-expanded="true"]')).toHaveCount(1);
          await page.keyboard.press(key);
          await expect(opener).toHaveAttribute('aria-expanded', 'false');
          await expect(opener).toBeFocused();
        }

        // Expanding must keep the header's natural Tab order and action-menu return focus.
        await page.keyboard.press('Enter');
        await page.keyboard.press('Tab');
        await expect(article.getByRole('button', { name: /^Copy summary for / })).toBeFocused();
        await page.keyboard.press('Tab');
        const menuButton = article.getByRole('button', { name: /^Open entry actions for / });
        await expect(menuButton).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('menu')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menuButton).toBeFocused();
        await expect(opener).toHaveAttribute('aria-expanded', 'true');
      });
    }

    test('artwork and the extra-card badge open only their own reading', async ({ page }) => {
      const drawnCards = [
        ...cards,
        { name: 'The Star', number: 17, position: 'Future', orientation: 'Upright' },
        { name: 'The Fool', number: 0, position: 'Advice', orientation: 'Upright' },
        { name: 'The Sun', number: 19, position: 'Outcome', orientation: 'Upright' }
      ];
      await openList(page, { values: [1, 3, 5].map((count, index) => ({
        ...entries[index], cards: drawnCards.slice(0, count)
      })) });

      const activatePoint = ({ x, y }) => width === 390
        ? page.touchscreen.tap(x, y)
        : page.mouse.click(x, y);

      for (const article of await page.locator('#history article').all()) {
        const opener = toggle(article);
        const artwork = article.locator('img');
        const shown = await artwork.count();
        for (let index = 0; index < shown; index += 1) {
          const image = artwork.nth(index);
          await image.scrollIntoViewIfNeeded();
          const box = await image.boundingBox();
          // Hit the exposed face of each overlapping card, including reversed cards.
          // Coordinate input exercises the reader's click/tap through decorative art.
          await activatePoint({ x: box.x + box.width * (index === shown - 1 ? 0.5 : 0.2), y: box.y + box.height / 2 });
          await expect(opener).toHaveAttribute('aria-expanded', 'true');
          await expect(page.locator('#history [data-journal-entry-toggle][aria-expanded="true"]')).toHaveCount(1);
          await opener.click();
        }

        const extraBadge = article.getByText('+2', { exact: true });
        if (await extraBadge.count()) {
          await extraBadge.scrollIntoViewIfNeeded();
          const box = await extraBadge.boundingBox();
          await activatePoint({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
          await expect(opener).toHaveAttribute('aria-expanded', 'true');
          await expect(page.locator('#history [data-journal-entry-toggle][aria-expanded="true"]')).toHaveCount(1);
          await opener.click();
        }
        await expect(opener).toHaveAttribute('aria-expanded', 'false');
      }
    });
  });
}

test.describe('localized exact dates', () => {
  test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  test('uses the reader locale and timezone in both densities', async ({ page }) => {
    await openList(page, { values: [entries[0]] });
    for (const density of ['Comfortable', 'Compact']) {
      await selectJournalDensity(page, density);
      await expect(page.locator('#history article time')).toHaveText('25. Okt. 2026, 13:00');
    }
  });
});

for (const theme of ['dark', 'light']) {
  test(`existing-share controls keep 44px targets at 320px in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openList(page, { owner: true, theme });
    const first = page.locator('#history article').first();
    await toggle(first).click();
    await first.getByRole('button', { name: /^Open entry actions/ }).click();
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
