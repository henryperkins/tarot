import { test, expect } from './helpers/frontendTest.js';
import { selectJournalSort } from './helpers/journalControls.js';

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
  if (!holdHistory) await expect(page.getByRole('button', { name: /^Sort readings:/ })).toBeEnabled();
  return state;
}

function toolbar(page) {
  return page.getByRole('region', { name: 'Journal filters', exact: true });
}

function readingToggle(page, question) {
  return page.getByRole('article', { name: question, exact: true }).locator('[data-journal-entry-toggle]');
}

async function expectSortLabelFits(trigger) {
  const size = await trigger.evaluate(async element => {
    await document.fonts.ready;
    const label = element.querySelector('span');
    const caret = element.querySelector('svg');
    const labelBox = label.getBoundingClientRect();
    return {
      label: label.textContent, textWidth: label.scrollWidth, available: label.clientWidth,
      labelRight: labelBox.right, caretLeft: caret.getBoundingClientRect().left
    };
  });
  expect(size.available, `The full ${size.label} label must fit`).toBeGreaterThanOrEqual(size.textWidth);
  expect(size.labelRight, 'The caret must not overlap the label').toBeLessThanOrEqual(size.caretLeft);
}

async function expectFilterFooterInViewport(panel) {
  for (const name of ['Clear filters', 'Show readings']) {
    const button = panel.getByRole('button', { name, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    await expect.poll(() => button.evaluate(element => {
      const box = element.getBoundingClientRect();
      const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return target === element || element.contains(target);
    }), { message: `${name} must stay clear of clipping and fixed navigation` }).toBe(true);
  }
}

for (const width of [320, 390, 768, 1280]) {
  test.describe(`quiet toolbar at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('shows search, sort, Filters and View without exposing the filter wall', async ({ page }) => {
      await openJournal(page);
      const region = toolbar(page);
      const search = region.getByRole('searchbox', { name: 'Search journal entries' });
      const sort = region.getByRole('button', { name: /^Sort readings:/ });
      const filters = region.getByRole('button', { name: 'Filters', exact: true });
      const display = region.getByRole('button', { name: /^View/ });
      await expect(search).toBeVisible();
      await expect(sort).toHaveAccessibleName('Sort readings: Newest first');
      await expectSortLabelFits(sort);
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
        if (width === 390) {
          for (const box of bounds.slice(2)) expect(Math.abs(box.y - bounds[1].y)).toBeLessThanOrEqual(1);
        }
      } else {
        for (const box of bounds.slice(1)) expect(Math.abs(box.y - bounds[0].y)).toBeLessThanOrEqual(2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });

    test('both sort labels remain readable with active filters', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-10T12:00:00Z'));
      await openJournal(page);
      const region = toolbar(page);
      await region.getByRole('button', { name: 'Filters', exact: true }).click();
      const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
      await panel.getByRole('radio', { name: 'Last 30 days', exact: true }).check();
      await panel.getByRole('checkbox', { name: 'Love', exact: true }).check();
      await panel.getByRole('button', { name: 'Show readings', exact: true }).click();
      await expect(region.getByRole('button', { name: 'Filters, 2 active', exact: true })).toBeVisible();
      const sort = region.getByRole('button', { name: /^Sort readings:/ });
      for (const order of ['oldest', 'newest']) {
        await selectJournalSort(page, order);
        await expectSortLabelFits(sort);
      }
      if (width === 390) {
        const boxes = await Promise.all([
          region.getByRole('button', { name: /^Filters/ }), sort,
          region.getByRole('button', { name: /^View:/ })
        ].map(control => control.boundingBox()));
        for (const box of boxes.slice(1)) expect(Math.abs(box.y - boxes[0].y)).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  });
}

for (const width of [320, 390]) {
  test(`sort labels and controls fit at 200% text on a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openJournal(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const region = toolbar(page);
    const sort = region.getByRole('button', { name: /^Sort readings:/ });
    for (const order of ['newest', 'oldest']) {
      await selectJournalSort(page, order);
      await expectSortLabelFits(sort);
    }
    for (const control of await region.locator('input, select, button').all()) {
      const box = await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const width of [390, 1280]) {
  test.describe(`quiet toolbar disclosures at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('View has named keyboard choices, restores focus, and remembers density without changing matches', async ({ page }) => {
      await openJournal(page);
      const region = toolbar(page);
      const search = region.getByRole('searchbox', { name: 'Search journal entries' });
      const sort = region.getByRole('button', { name: /^Sort readings:/ });
      await search.fill('Reflection 1-');
      await selectJournalSort(page, 'oldest');
      const trigger = region.getByRole('button', { name: /^View/ });
      await expect(trigger).toHaveAccessibleName('View: Comfortable');
      await trigger.press('ArrowDown');
      const choices = page.getByRole('listbox', { name: 'View', exact: true });
      await expect(choices).toBeVisible();
      await expect(choices.getByRole('option', { name: 'Comfortable', exact: true })).toBeFocused();
      await expect(choices.getByRole('option', { name: 'Comfortable', exact: true })).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await expect(choices.getByRole('option', { name: 'Compact', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(choices).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAccessibleName('View: Comfortable');

      await trigger.press('Enter');
      await choices.getByRole('option', { name: 'Compact', exact: true }).press('Enter');
      await expect(choices).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAccessibleName('View: Compact');
      await expect(search).toHaveValue('Reflection 1-');
      await expect(sort).toHaveAccessibleName('Sort readings: Oldest first');
      await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 1-9');
      await expect(page.getByText('10 of 35 readings match', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('journal_list_density_v1'))).toBe('compact');

      await page.reload();
      await expect(trigger).toHaveAccessibleName('View: Compact');
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
  const sort = page.getByRole('button', { name: /^Sort readings:/ });
  const months = page.getByRole('combobox', { name: 'Jump to month', exact: true });
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-0');
  await page.getByRole('button', { name: 'Load 10 more', exact: true }).press('Enter');
  await expect(page.locator('#history article')).toHaveCount(20);
  await months.focus();
  await months.selectOption('2026-07');
  await expect(readingToggle(page, 'Reflection 3-0')).toBeFocused();
  await expect(months).toHaveValue('2026-07');

  await sort.focus();
  await selectJournalSort(page, 'oldest');
  await expect(page.locator('#history article')).toHaveCount(10);
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 3-5');
  await expect(months).toHaveValue('');
  await expect(months.locator('option')).toHaveText([
    'Jump to month', 'July 2026 (6)', 'August 2026 (10)', 'September 2026 (10)', 'October 2026 (9)'
  ]);
  await expect(page.getByText('Showing 10 of 35 readings', { exact: true })).toBeVisible();
  await expect(toolbar(page).getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
  await expect(toolbar(page).getByRole('group', { name: 'Active filters', exact: true })).toHaveCount(0);

  await selectJournalSort(page, 'newest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-0');
  await expect(page.locator('#history article')).toHaveCount(10);
});

test('oldest-first month navigation and keyboard pagination focus the actual sorted destination', async ({ page }) => {
  await openJournal(page);
  await selectJournalSort(page, 'oldest');
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
  const sort = region.getByRole('button', { name: /^Sort readings:/ });
  await search.fill('Reflection 1-');
  await selectJournalSort(page, 'oldest');
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
  await expect(sort).toHaveAccessibleName('Sort readings: Oldest first');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 3-5');
  await selectJournalSort(page, 'newest');
  await page.reload();
  await region.getByRole('button', { name: 'September, oldest first', exact: true }).click();
  await expect(search).toHaveValue('Reflection 1-');
  await expect(sort).toHaveAccessibleName('Sort readings: Oldest first');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 1-9');
  await expect(page.getByText('10 of 35 readings match', { exact: true })).toBeVisible();
});

test('saving and cancelling a view restore trigger focus without losing saved values', async ({ page }) => {
  await openJournal(page);
  const region = toolbar(page);
  const search = region.getByRole('searchbox', { name: 'Search journal entries' });
  const sort = region.getByRole('button', { name: /^Sort readings:/ });
  const save = region.getByRole('button', { name: 'Save this view', exact: true });
  const name = region.getByRole('textbox', { name: 'Name for saved filter view', exact: true });
  await search.fill('Reflection 1-');
  await selectJournalSort(page, 'oldest');
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
  await expect(sort).toHaveAccessibleName('Sort readings: Oldest first');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_saved_views_guest')).views)).toEqual(stored);
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 1280, height: 600 }, { width: 768, height: 900 }]) {
  test(`desktop filter footer stays usable after zero matches at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openJournal(page, { values: [entries[0]] });
    const trigger = toolbar(page).getByRole('button', { name: /^Filters/ });
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
    // Check before an action's automatic scrolling could hide the regression.
    await expectFilterFooterInViewport(panel);
    await panel.getByRole('group', { name: 'Context', exact: true })
      .getByRole('checkbox', { name: 'Career', exact: true }).check();
    await expect(page.locator('#history article')).toHaveCount(0);
    await expect(page.getByText('No readings match', { exact: true })).toBeVisible();

    const show = panel.getByRole('button', { name: 'Show readings', exact: true });
    await expectFilterFooterInViewport(panel);
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
}

test('desktop filter footer stays reachable through internal scrolling, resizing and enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openJournal(page);
  const trigger = toolbar(page).getByRole('button', { name: /^Filters/ });
  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
  await expectFilterFooterInViewport(panel);
  const scrollY = await page.evaluate(() => window.scrollY);
  const choices = panel.locator(':scope > .overflow-y-auto');
  await choices.hover();
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => choices.evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 1)).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await expectFilterFooterInViewport(panel);
  await panel.getByRole('checkbox', { name: 'Contains reversed cards', exact: true }).check();
  await page.setViewportSize({ width: 1280, height: 500 });
  await expectFilterFooterInViewport(panel);
  await page.evaluate(() => window.scrollBy(0, 80));
  await expectFilterFooterInViewport(panel);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expectFilterFooterInViewport(panel);
  await expect(panel.getByRole('checkbox', { name: 'Contains reversed cards', exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
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
  await selectJournalSort(page, 'oldest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-8');
  await expect(narrative).toHaveText(original);
  await selectJournalSort(page, 'newest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 0-0');
  await expect(narrative).toHaveText(original);
});

test('legacy saved views default to newest, expose removable chips, and keep query text out of the chip row', async ({ page }) => {
  await openJournal(page, { savedViews: [{ id: 'legacy-love', name: 'Earlier love view', values: {
    query: 'Reflection', contexts: ['love'], spreads: [], decks: [], timeframe: 'all', onlyReversals: false, journeyFilter: null
  } }] });
  const region = toolbar(page);
  const sort = region.getByRole('button', { name: /^Sort readings:/ });
  await selectJournalSort(page, 'oldest');
  await region.getByRole('button', { name: 'Earlier love view', exact: true }).click();
  await expect(sort).toHaveAccessibleName('Sort readings: Newest first');
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
  const sort = region.getByRole('button', { name: /^Sort readings:/ });
  try {
    await expect(sort).toBeDisabled();
    await expect(region.getByRole('searchbox', { name: 'Search journal entries' })).toBeDisabled();
    await expect(region.getByRole('button', { name: 'Filters', exact: true })).toBeDisabled();
    await expect(region.getByRole('button', { name: /^View/ })).toBeDisabled();
    await expect(page.getByText('Loading your complete history', { exact: true })).toBeVisible();
    await expect.poll(() => Boolean(state.releaseHistory)).toBe(true);
    state.releaseHistory();
    await expect(sort).toBeEnabled();
    await selectJournalSort(page, 'oldest');
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
  await selectJournalSort(page, 'oldest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName(matches[2].question);
  await expect(page.getByRole('searchbox', { name: 'Search journal entries' })).toHaveValue('quieter connection');
  await expect(page.getByRole('button', { name: 'Show exact matches', exact: true })).toBeVisible();
  await expect(page.getByText(/Searching your recent analyzed readings by meaning/)).toBeVisible();
  await selectJournalSort(page, 'newest');
  await expect(page.locator('#history article').first()).toHaveAccessibleName(matches[0].question);
  expect(state.searchRequests).toEqual(requestIdentity);
  expect(new URLSearchParams(state.searchRequests[0]).get('mode')).toBe('semantic');
});

for (const width of [390, 1280]) {
  test(`sort choices support keyboard selection, dismissal and focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openJournal(page);
    const trigger = toolbar(page).getByRole('button', { name: /^Sort readings:/ });
    const choices = page.getByRole('listbox', { name: 'Sort readings', exact: true });
    await trigger.press('ArrowDown');
    await expect(choices.getByRole('option', { name: 'Newest first', exact: true })).toBeFocused();
    await expect(choices.getByRole('option', { name: 'Newest first', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(choices.getByRole('option', { name: 'Oldest first', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(choices).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAccessibleName('Sort readings: Oldest first');
    await expect(page.locator('#history article').first()).toHaveAccessibleName('Reflection 3-5');
    await trigger.press('ArrowUp');
    await expect(choices.getByRole('option', { name: 'Oldest first', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('Escape');
    await expect(choices).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAccessibleName('Sort readings: Oldest first');
    await trigger.click();
    await toolbar(page).getByRole('searchbox').click();
    await expect(choices).toHaveCount(0);
    await expect(toolbar(page).getByRole('searchbox')).toBeFocused();
  });

  test(`panel clearing preserves search and order at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openJournal(page);
    const region = toolbar(page);
    const search = region.getByRole('searchbox');
    await search.fill('Reflection 1-');
    await selectJournalSort(page, 'oldest');
    const trigger = region.getByRole('button', { name: 'Filters', exact: true });
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
    const clear = panel.getByRole('button', { name: 'Clear filters', exact: true });
    await expect(clear).toBeDisabled();
    await panel.getByRole('checkbox', { name: 'Love', exact: true }).check();
    await expect(clear).toBeEnabled();
    await clear.click();
    await expect(clear).toBeDisabled();
    await expect(panel.getByRole('checkbox', { name: 'Love', exact: true })).not.toBeChecked();
    await panel.getByRole('button', { name: 'Show readings', exact: true }).click();
    await expect(search).toHaveValue('Reflection 1-');
    await expect(region.getByRole('button', { name: /^Sort readings:/ })).toHaveAccessibleName('Sort readings: Oldest first');
    await expect(page.getByText('10 of 35 readings match', { exact: true })).toBeVisible();
    await expect(trigger).toBeVisible();
    await region.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByText('Showing 10 of 35 readings', { exact: true })).toBeVisible();
  });
}

for (const theme of ['dark', 'light']) {
  test(`toolbar controls match and filter indicators have contrast in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openJournal(page);
    await page.evaluate(theme => document.documentElement.classList.toggle('light', theme === 'light'), theme);
    const region = toolbar(page);
    const controls = [
      region.getByRole('button', { name: 'Filters', exact: true }),
      region.getByRole('button', { name: /^Sort readings:/ }),
      region.getByRole('button', { name: /^View:/ })
    ];
    const styles = await Promise.all(controls.map(control => control.evaluate(element => {
      const style = getComputedStyle(element);
      return [style.fontSize, style.fontWeight, style.color, style.backgroundColor, style.borderColor];
    })));
    expect(styles[1]).toEqual(styles[0]);
    expect(styles[2]).toEqual(styles[0]);
    expect(styles[0][0]).toBe('14px');
    await controls[0].click();
    const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
    const radio = panel.getByRole('radio', { name: 'All time', exact: true });
    const checkbox = panel.getByRole('checkbox', { name: 'Love', exact: true });
    await checkbox.check();
    for (const control of [radio, checkbox]) {
      await expect(control).toBeChecked();
      const measured = await control.evaluate(input => {
        const indicator = input.nextElementSibling;
        const style = getComputedStyle(indicator);
        const inputStyle = getComputedStyle(input);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        const luminance = color => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => {
            const c = channel / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return {
          width: indicator.getBoundingClientRect().width, height: indicator.getBoundingClientRect().height,
          targetHeight: input.closest('label').getBoundingClientRect().height,
          inputPosition: inputStyle.position, inputOpacity: inputStyle.opacity,
          inputHeight: input.getBoundingClientRect().height,
          ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
          selectedShape: Boolean(indicator.querySelector('svg'))
        };
      });
      expect(measured.width).toBe(16);
      expect(measured.height).toBe(16);
      expect(measured.targetHeight).toBeGreaterThanOrEqual(44);
      expect(measured.inputPosition).toBe('absolute');
      expect(measured.inputOpacity).toBe('0');
      expect(measured.inputHeight).toBeGreaterThanOrEqual(42);
      expect(measured.ratio).toBeGreaterThanOrEqual(3);
      expect(measured.selectedShape).toBe(true);
    }
    await radio.focus();
    await page.keyboard.press('ArrowRight');
    await expect(panel.getByRole('radio', { name: 'Last 30 days', exact: true })).toBeChecked();
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox.locator('..').locator('input + span svg')).toHaveCount(0);
    await expect(checkbox.locator('..')).not.toHaveCSS('box-shadow', 'none');
  });
}

test('month label has its own caret space at narrow and wide widths', async ({ page }) => {
  await openJournal(page);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const month = page.getByRole('combobox', { name: 'Jump to month', exact: true });
    const measured = await month.evaluate(async select => {
      await document.fonts.ready;
      const style = getComputedStyle(select);
      const span = document.createElement('span');
      span.textContent = select.selectedOptions[0].text;
      Object.assign(span.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' });
      for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant',
        'letterSpacing', 'fontFeatureSettings', 'fontVariationSettings']) span.style[property] = style[property];
      document.body.append(span);
      const labelWidth = span.getBoundingClientRect().width;
      span.remove();
      const box = select.getBoundingClientRect();
      const caret = select.parentElement.querySelector('svg').getBoundingClientRect();
      return { image: style.backgroundImage, labelRight: box.left + parseFloat(style.borderLeftWidth)
        + parseFloat(style.paddingLeft) + labelWidth, caretLeft: caret.left, right: box.right };
    });
    expect(measured.image).toBe('none');
    expect(measured.labelRight).toBeLessThan(measured.caretLeft);
    expect(measured.right).toBeLessThanOrEqual(width);
  }
});

test('desktop panel stays inside its toolbar and returns backward focus to Filters', async ({ page }) => {
  await openJournal(page);
  const trigger = toolbar(page).getByRole('button', { name: /^Filters/ });
  const panel = page.getByRole('dialog', { name: 'Filter saved readings', exact: true });
  for (const [width, fontSize] of [[1024, 100], [1024, 120], [1100, 120], [1280, 150]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(size => document.documentElement.style.fontSize = `${size}%`, fontSize);
    await trigger.click();
    await expect(panel).toBeVisible();
    const [anchorBox, panelBox] = await Promise.all([toolbar(page).boundingBox(), panel.boundingBox()]);
    expect(panelBox.x).toBeGreaterThanOrEqual(anchorBox.x - 1);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(anchorBox.x + anchorBox.width + 1);
    await expectFilterFooterInViewport(panel);
    await expect(panel.getByRole('button', { name: 'Close filters', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(trigger).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(toolbar(page).getByRole('button', { name: /^Sort readings:/ })).toBeFocused();
    await expect(panel).toHaveCount(0);
  }
});

test('Sort and View menus stay inside phone viewports with enlarged text', async ({ page }) => {
  await openJournal(page);
  for (const [width, fontSize] of [[320, 100], [390, 100], [320, 200], [390, 200]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(size => document.documentElement.style.fontSize = `${size}%`, fontSize);
    for (const name of [/^Sort readings:/, /^View:/]) {
      const trigger = toolbar(page).getByRole('button', { name });
      await trigger.click();
      const menu = toolbar(page).getByRole('listbox');
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(15);
      expect(box.x + box.width).toBeLessThanOrEqual(width - 15);
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
    }
  }
});
