import { test, expect } from './helpers/frontendTest.js';

// Synthetic guest/cloud fixtures exercise presentation and local saved views.
// They do not qualify real authentication, subscriptions, or the search backend.
const OWNER_ID = 'quiet-toolbar-owner';
const cards = [
  { name: 'The Hermit', number: 9, position: 'Past', orientation: 'Upright' },
  { name: 'Three of Cups', suit: 'Cups', rank: 'Three', position: 'Present', orientation: 'Reversed' },
  { name: 'The Star', number: 17, position: 'Future', orientation: 'Upright' }
];
const entries = [9, 10, 10, 6].flatMap((count, monthOffset) => Array.from({ length: count }, (_, index) => ({
  id: `quiet-toolbar-${monthOffset}-${index}`,
  readingResultId: `quiet-toolbar-result-${monthOffset}-${index}`,
  sessionSeed: `quiet-toolbar-seed-${monthOffset}-${index}`,
  ts: Date.UTC(2026, 9 - monthOffset, 25 - index, 12),
  question: `Reflection ${monthOffset}-${index}`,
  spread: 'Three-Card Story', spreadKey: 'threeCard', deckId: 'rws-1909',
  context: index % 2 === 0 ? 'love' : 'self', cards,
  personalReading: 'Make room for a small, useful reflection.'
})));

test.use({ locale: 'en-US', timezoneId: 'UTC' });

async function openJournal(page, {
  owner = false, values = entries, savedViews = [], holdHistory = false, semanticEntries = []
} = {}) {
  const state = { journalRequests: [], searchRequests: [], releaseHistory: null };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/auth/me') return route.fulfill(owner
      ? { json: { user: { id: OWNER_ID, username: 'Toolbar reviewer', subscription_tier: 'pro',
        subscription_status: 'active', email_verified: true } } }
      : { status: 401, json: { user: null } });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      return route.fulfill({ status: 503, json: { error: 'Read-only synthetic toolbar fixture' } });
    }
    if (url.pathname === '/api/journal') {
      state.journalRequests.push(url.searchParams.toString());
      const cursorId = url.searchParams.get('cursorId');
      const start = cursorId ? values.findIndex(entry => entry.id === cursorId) + 1 : 0;
      const limit = Number(url.searchParams.get('limit') || 10);
      const batch = values.slice(start, start + limit);
      if (start > 0 && holdHistory && !state.releaseHistory) {
        await new Promise(resolve => { state.releaseHistory = resolve; });
      }
      return route.fulfill({ json: { entries: batch, pagination: {
        total: values.length, hasMore: start + batch.length < values.length,
        nextCursor: batch.at(-1)?.ts ?? null, nextCursorId: batch.at(-1)?.id ?? null
      } } });
    }
    if (url.pathname === '/api/journal/search') {
      state.searchRequests.push(url.searchParams.toString());
      return route.fulfill({ json: { entries: semanticEntries, mode: 'semantic' } });
    }
    if (url.pathname === '/api/archetype-journey/preferences') {
      return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    }
    if (url.pathname === '/api/share') return route.fulfill({ json: { shares: [] } });
    return route.fulfill({ json: {} });
  });
  await page.addInitScript(({ owner, values, savedViews, ownerId }) => {
    // Seed once, so reload tests observe the app's persisted choices instead of
    // silently resetting them in an init script.
    if (sessionStorage.getItem('quiet-toolbar-fixture-ready')) return;
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-theme', 'dark');
    localStorage.setItem('journal_filters_advanced_v1', 'false');
    localStorage.setItem('tarot_journal', JSON.stringify(owner ? [] : values));
    localStorage.setItem(owner ? `tarot_saved_views_user_${ownerId}` : 'tarot_saved_views_guest',
      JSON.stringify({ views: savedViews, legacyImported: false }));
    sessionStorage.setItem('quiet-toolbar-fixture-ready', 'true');
  }, { owner, values, savedViews, ownerId: OWNER_ID });
  await page.goto('/journal');
  await expect(page.getByRole('heading', { name: 'Saved readings', exact: true })).toBeVisible();
  await expect(page.locator('#history article')).toHaveCount(Math.min(10, values.length));
  if (!holdHistory) await expect(page.getByRole('combobox', { name: 'Sort readings', exact: true })).toBeEnabled();
  return state;
}

function toolbar(page) {
  return page.getByRole('region', { name: 'Journal filters', exact: true });
}

function readingToggle(page, question) {
  return page.getByRole('article', { name: question, exact: true }).locator('[data-journal-entry-toggle]');
}

for (const width of [320, 390, 1280]) {
  test.describe(`quiet toolbar at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('shows search, sort, Filters and Display without exposing the filter wall', async ({ page }) => {
      await openJournal(page);
      const region = toolbar(page);
      const search = region.getByRole('searchbox', { name: 'Search journal entries' });
      const sort = region.getByRole('combobox', { name: 'Sort readings', exact: true });
      const filters = region.getByRole('button', { name: 'Filters', exact: true });
      const display = region.getByRole('button', { name: /^Display/ });
      await expect(search).toBeVisible();
      await expect(sort).toHaveValue('newest');
      await expect(filters).toHaveAttribute('aria-expanded', 'false');
      await expect(display).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('dialog', { name: 'Filter saved readings', exact: true })).toHaveCount(0);
      await expect(region.getByText('What fields are searched?', { exact: true })).toHaveCount(0);

      const bounds = await Promise.all([search, sort, filters, display].map(control => control.boundingBox()));
      for (const box of bounds) {
        expect(box).not.toBeNull();
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
      if (width < 640) {
        const regionBox = await region.boundingBox();
        expect(bounds[0].width).toBeCloseTo(regionBox.width, 0);
        for (const box of bounds.slice(1)) expect(box.y).toBeGreaterThanOrEqual(bounds[0].y + bounds[0].height);
      } else {
        for (const box of bounds.slice(1)) expect(Math.abs(box.y - bounds[0].y)).toBeLessThanOrEqual(2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  });
}

for (const width of [390, 1280]) {
  test.describe(`quiet toolbar disclosures at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('Display has named keyboard choices, restores focus, and remembers density without changing matches', async ({ page }) => {
      await openJournal(page);
      const region = toolbar(page);
      const search = region.getByRole('searchbox', { name: 'Search journal entries' });
      const sort = region.getByRole('combobox', { name: 'Sort readings', exact: true });
      await search.fill('Reflection 1-');
      await sort.selectOption('oldest');
      const trigger = region.getByRole('button', { name: /^Display/ });
      await expect(trigger).toHaveAccessibleName('Display: Comfortable');
      await trigger.press('ArrowDown');
      const choices = page.getByRole('listbox', { name: 'Display', exact: true });
      await expect(choices).toBeVisible();
      await expect(choices.getByRole('option', { name: 'Comfortable', exact: true })).toBeFocused();
      await expect(choices.getByRole('option', { name: 'Comfortable', exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await expect(choices.getByRole('option', { name: 'Compact', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(choices).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAccessibleName('Display: Comfortable');

      await trigger.press('Enter');
      await choices.getByRole('option', { name: 'Compact', exact: true }).press('Enter');
      await expect(choices).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAccessibleName('Display: Compact');
      await expect(search).toHaveValue('Reflection 1-');
      await expect(sort).toHaveValue('oldest');
      await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 1-9');
      await expect(page.getByText('10 of 35 readings match', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('journal_list_density_v1'))).toBe('compact');

      await page.reload();
      await expect(trigger).toHaveAccessibleName('Display: Compact');
      await trigger.press('Enter');
      await expect(choices.getByRole('option', { name: 'Compact', exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    });

    test('Filters groups native choices, applies them live, and closes with safe focus', async ({ page }) => {
      await openJournal(page);
      const region = toolbar(page);
      const trigger = region.getByRole('button', { name: /^Filters/ });
      await trigger.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
      await expect(dialog).toBeVisible();
      if (width < 640) await expect(dialog).toHaveAttribute('aria-modal', 'true');
      else await expect(dialog).not.toHaveAttribute('aria-modal', 'true');
      for (const name of ['Timeframe', 'Context', 'Spread', 'Deck']) {
        await expect(dialog.getByRole('group', { name, exact: true })).toBeVisible();
      }
      await expect(dialog.getByRole('radio', { name: 'All time', exact: true })).toBeChecked();
      await expect(dialog.getByRole('checkbox', { name: 'Contains reversed cards', exact: true })).not.toBeChecked();
      await dialog.getByRole('group', { name: 'Context', exact: true })
        .getByRole('checkbox', { name: 'Love', exact: true }).check();
      await expect(dialog.getByRole('checkbox', { name: 'Love', exact: true })).toBeChecked();
      await dialog.getByRole('button', { name: 'Show readings', exact: true }).press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAccessibleName('Filters, 1 active');
      await expect(region.getByRole('button', { name: 'Remove Love filter', exact: true })).toBeVisible();
      await expect(page.getByText('18 of 35 readings match · showing 10', { exact: true })).toBeVisible();

      await trigger.press('Enter');
      await expect(dialog.getByRole('checkbox', { name: 'Love', exact: true })).toBeChecked();
      if (width < 640) {
        // The sheet's final action must not Tab into the inert page behind it.
        await dialog.getByRole('button', { name: 'Show readings', exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(region.getByRole('button', { name: 'Remove Love filter', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  });
}

test('sort resets the visible batch and month selection without changing the matching set', async ({ page }) => {
  await openJournal(page);
  const sort = page.getByRole('combobox', { name: 'Sort readings', exact: true });
  const months = page.getByRole('combobox', { name: 'Jump to month', exact: true });
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-0');
  await page.getByRole('button', { name: 'Load 10 more', exact: true }).press('Enter');
  await expect(page.locator('#history article')).toHaveCount(20);
  await months.focus();
  await months.selectOption('2026-07');
  await expect(readingToggle(page, 'Reflection 3-0')).toBeFocused();
  await expect(months).toHaveValue('2026-07');

  await sort.focus();
  await sort.selectOption('oldest');
  await expect(page.locator('#history article')).toHaveCount(10);
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 3-5');
  await expect(months).toHaveValue('');
  await expect(months.locator('option')).toHaveText([
    'Jump to month', 'July 2026 (6)', 'August 2026 (10)', 'September 2026 (10)', 'October 2026 (9)'
  ]);
  await expect(page.getByText('Showing 10 of 35 readings', { exact: true })).toBeVisible();
  await expect(toolbar(page).getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
  await expect(toolbar(page).getByRole('group', { name: 'Active filters', exact: true })).toHaveCount(0);

  await sort.selectOption('newest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-0');
  await expect(page.locator('#history article')).toHaveCount(10);
});

test('oldest-first month navigation and keyboard pagination focus the actual sorted destination', async ({ page }) => {
  await openJournal(page);
  await page.getByRole('combobox', { name: 'Sort readings', exact: true }).selectOption('oldest');
  await page.getByRole('button', { name: 'Load 10 more', exact: true }).press('Enter');
  await expect(readingToggle(page, 'Reflection 2-5')).toBeFocused();
  await expect(readingToggle(page, 'Reflection 2-5')).toBeInViewport();
  const months = page.getByRole('combobox', { name: 'Jump to month', exact: true });
  await months.focus();
  await months.selectOption('2026-10');
  await expect(page.locator('#history article')).toHaveCount(30);
  await expect(readingToggle(page, 'Reflection 0-8')).toBeFocused();
  await expect(readingToggle(page, 'Reflection 0-8')).toBeInViewport();
  await page.getByRole('button', { name: 'Load 5 more', exact: true }).press('Enter');
  await expect(page.locator('#history article')).toHaveCount(35);
  await expect(readingToggle(page, 'Reflection 0-4')).toBeFocused();
  await expect(page.getByRole('button', { name: /^Load \d+ more$/ })).toHaveCount(0);
});

test('saved views round-trip the selected ordering, while Clear filters preserves it', async ({ page }) => {
  await openJournal(page);
  const region = toolbar(page);
  const search = region.getByRole('searchbox', { name: 'Search journal entries' });
  const sort = region.getByRole('combobox', { name: 'Sort readings', exact: true });
  await search.fill('Reflection 1-');
  await sort.selectOption('oldest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 1-9');
  await region.getByRole('button', { name: 'Save this view', exact: true }).click();
  await region.getByRole('textbox', { name: 'Name for saved filter view', exact: true }).fill('September, oldest first');
  await region.getByRole('button', { name: 'Save current', exact: true }).click();
  await expect(region.getByRole('button', { name: 'September, oldest first', exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_saved_views_guest')).views[0]);
  expect(stored.sortOrder).toBe('oldest');
  expect(stored.values.query).toBe('Reflection 1-');

  await region.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(sort).toHaveValue('oldest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 3-5');
  await sort.selectOption('newest');
  await page.reload();
  await region.getByRole('button', { name: 'September, oldest first', exact: true }).click();
  await expect(search).toHaveValue('Reflection 1-');
  await expect(sort).toHaveValue('oldest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 1-9');
  await expect(page.getByText('10 of 35 readings match', { exact: true })).toBeVisible();
});

test('saving and cancelling a view restore trigger focus without losing saved values', async ({ page }) => {
  await openJournal(page);
  const region = toolbar(page);
  const search = region.getByRole('searchbox', { name: 'Search journal entries' });
  const sort = region.getByRole('combobox', { name: 'Sort readings', exact: true });
  const save = region.getByRole('button', { name: 'Save this view', exact: true });
  const name = region.getByRole('textbox', { name: 'Name for saved filter view', exact: true });
  await search.fill('Reflection 1-');
  await sort.selectOption('oldest');
  await save.press('Enter');
  await expect(name).toBeFocused();
  await name.fill('September reflections');
  await region.getByRole('button', { name: 'Save current', exact: true }).press('Enter');
  await expect(name).toHaveCount(0);
  await expect(save).toBeFocused();
  await expect(region.getByRole('button', { name: 'September reflections', exact: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_saved_views_guest')).views);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ name: 'September reflections', sortOrder: 'oldest', values: { query: 'Reflection 1-' } });

  await save.press('Enter');
  await expect(name).toBeFocused();
  await name.fill('Do not save this draft');
  await region.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
  await expect(name).toHaveCount(0);
  await expect(save).toBeFocused();
  await expect(search).toHaveValue('Reflection 1-');
  await expect(sort).toHaveValue('oldest');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_saved_views_guest')).views)).toEqual(stored);
});

test('desktop filter footer stays hit-testable and usable after matches shrink to zero', async ({ page }) => {
  // Keep the complete popup inside the viewport, so scrolling an overflow-hidden
  // ancestor cannot accidentally conceal the clipping regression under test.
  await page.setViewportSize({ width: 1280, height: 1200 });
  await openJournal(page, { values: [entries[0]] });
  const trigger = toolbar(page).getByRole('button', { name: /^Filters/ });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
  await panel.getByRole('group', { name: 'Context', exact: true })
    .getByRole('checkbox', { name: 'Career', exact: true }).check();
  await expect(page.locator('#history article')).toHaveCount(0);
  await expect(page.getByText('No readings match', { exact: true })).toBeVisible();

  const show = panel.getByRole('button', { name: 'Show readings', exact: true });
  await expect(show).toBeInViewport();
  const hit = await show.evaluate(button => {
    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const target = document.elementFromPoint(x, y);
    return { x, y, receivesPointer: target === button || button.contains(target) };
  });
  expect(hit.receivesPointer, 'The filter footer must not be clipped by the shrunken history shell').toBe(true);
  await page.mouse.click(hit.x, hit.y);
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(toolbar(page).getByRole('button', { name: 'Remove Career filter', exact: true })).toBeVisible();
  await toolbar(page).getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('#history article')).toHaveCount(1);
});

test('sorting the same filtered readings does not rewrite the journey summary', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
  await openJournal(page);
  await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('Reflection 0-');
  const journey = page.locator('aside');
  // A newly active filter automatically selects the filtered analytics scope.
  const narrative = journey.locator('p').filter({ hasText: /^In your .* readings,/ }).first();
  await expect(narrative).toBeVisible();
  const original = await narrative.innerText();
  expect(original.trim().length).toBeGreaterThan(0);
  const sort = page.getByRole('combobox', { name: 'Sort readings', exact: true });
  await sort.selectOption('oldest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-8');
  await expect(narrative).toHaveText(original);
  await sort.selectOption('newest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-0');
  await expect(narrative).toHaveText(original);
});

test('legacy saved views default to newest, expose removable chips, and keep query text out of the chip row', async ({ page }) => {
  await openJournal(page, { savedViews: [{ id: 'legacy-love', name: 'Earlier love view', values: {
    query: 'Reflection', contexts: ['love'], spreads: [], decks: [], timeframe: 'all', onlyReversals: false, journeyFilter: null
  } }] });
  const region = toolbar(page);
  const sort = region.getByRole('combobox', { name: 'Sort readings', exact: true });
  await sort.selectOption('oldest');
  await region.getByRole('button', { name: 'Earlier love view', exact: true }).click();
  await expect(sort).toHaveValue('newest');
  await expect(region.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('Reflection');
  await expect(region.getByRole('button', { name: 'Filters, 1 active', exact: true })).toBeVisible();
  await expect(region.getByRole('button', { name: 'Remove Love filter', exact: true })).toBeVisible();
  await expect(region.getByRole('button', { name: /Remove .*Reflection.* filter/ })).toHaveCount(0);
  await region.getByRole('button', { name: 'Remove Love filter', exact: true }).press('Enter');
  await expect(region.getByRole('searchbox', { name: 'Search journal entries' })).toBeFocused();
  await expect(region.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
  await expect(page.getByText('35 of 35 readings match · showing 10', { exact: true })).toBeVisible();
});

test('incomplete cloud history disables sorting until all history is available', async ({ page }) => {
  const state = await openJournal(page, { owner: true, holdHistory: true });
  const region = toolbar(page);
  const sort = region.getByRole('combobox', { name: 'Sort readings', exact: true });
  try {
    await expect(sort).toBeDisabled();
    await expect(region.getByRole('searchbox', { name: 'Search journal entries' })).toBeDisabled();
    await expect(region.getByRole('button', { name: 'Filters', exact: true })).toBeDisabled();
    await expect(region.getByRole('button', { name: /^Display/ })).toBeDisabled();
    await expect(page.getByText('Loading your complete history', { exact: true })).toBeVisible();
    await expect.poll(() => Boolean(state.releaseHistory)).toBe(true);
    state.releaseHistory();
    await expect(sort).toBeEnabled();
    await sort.selectOption('oldest');
    await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 3-5');
    await expect(page.getByText('Showing 10 of 35 readings', { exact: true })).toBeVisible();
    expect(state.journalRequests).toHaveLength(2);
  } finally {
    state.releaseHistory?.();
  }
});

test('sorting semantic matches keeps their mode, coverage explanation and request identity', async ({ page }) => {
  const matches = [entries[0], entries[12], entries[31]];
  const state = await openJournal(page, { owner: true, semanticEntries: matches });
  await page.getByRole('searchbox', { name: 'Search journal entries' }).fill('quieter connection');
  await page.getByRole('button', { name: 'Search by meaning', exact: true }).click();
  await expect(page.locator('#history article')).toHaveCount(3);
  await expect(page.getByText(/Searching your recent analyzed readings by meaning/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show exact matches', exact: true })).toBeVisible();
  await expect.poll(() => state.searchRequests.length).toBe(1);
  const requestIdentity = [...state.searchRequests];
  await page.getByRole('combobox', { name: 'Sort readings', exact: true }).selectOption('oldest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName(matches[2].question);
  await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('quieter connection');
  await expect(page.getByRole('button', { name: 'Show exact matches', exact: true })).toBeVisible();
  await expect(page.getByText(/Searching your recent analyzed readings by meaning/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Sort readings', exact: true }).selectOption('newest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName(matches[0].question);
  expect(state.searchRequests).toEqual(requestIdentity);
  expect(new URLSearchParams(state.searchRequests[0]).get('mode')).toBe('semantic');
});
