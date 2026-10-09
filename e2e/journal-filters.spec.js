import { test, expect } from './helpers/frontendTest.js';

/**
 * Journal Filters E2E Tests
 *
 * Verifies:
 * - Desktop: filters appear in Journal History and are reachable via "Jump to journal filters" + a floating "Filters" button
 * - Desktop: sticky rail (Reading Journey) stays visible while scrolling
 * - Mobile: filters render in Journal History (compact) and "More filters" reveals filter-map shortcuts
 * - Filter functionality: context/spread/deck/timeframe/reversal/search
 * - Entry counts update correctly
 * - Load more works after filtering
 */

// Helper to seed localStorage with mock journal entries
async function seedJournalEntries(page, entries) {
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  await page.addInitScript((entriesJson) => {
    localStorage.setItem('tarot_journal', entriesJson);
  }, JSON.stringify(entries));
}

// Generate mock journal entries for testing
// Spreads entries across time to properly test timeframe filters
function generateMockEntries(count = 15) {
  const contexts = ['love', 'career', 'self', 'spiritual', 'wellbeing', 'decision'];
  const spreads = ['single', 'threeCard', 'fiveCard', 'celtic', 'relationship', 'decision'];
  const decks = ['rws-1909', 'thoth', 'marseille'];

  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.parse('2026-10-08T12:00:00Z');

  return Array.from({ length: count }, (_, i) => {
    // Distribute entries: first 5 within 30 days, next 5 within 90 days, rest older
    let daysAgo;
    if (i < 5) {
      daysAgo = i * 5; // 0, 5, 10, 15, 20 days ago
    } else if (i < 10) {
      daysAgo = 35 + (i - 5) * 10; // 35, 45, 55, 65, 75 days ago
    } else {
      daysAgo = 100 + (i - 10) * 30; // 100, 130, 160, 190, 220 days ago
    }

    return {
      id: `mock-entry-${i}`,
      sessionSeed: `seed-${i}`,
      ts: now - daysAgo * DAY_MS,
      question: `Test question ${i + 1}`,
      context: contexts[i % contexts.length],
      spreadKey: spreads[i % spreads.length],
      spread: spreads[i % spreads.length],
      deckId: decks[i % decks.length],
      cards: [
        {
          name: i % 3 === 0 ? 'The Fool' : 'The Magician',
          position: 'Present',
          orientation: i % 4 === 0 ? 'Reversed' : 'Upright',
        },
        {
          name: 'The High Priestess',
          position: 'Challenge',
          orientation: 'Upright',
        },
      ],
      personalReading: `This is a test reading for entry ${i + 1}`,
      reflections: { 0: `Reflection for card 1 in entry ${i + 1}` },
    };
  });
}

test.describe('Journal Filters - Desktop @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    const mockEntries = generateMockEntries(15);
    await seedJournalEntries(page, mockEntries);
    await page.goto('/journal');
    // Wait for entries to load
    await page.waitForSelector('[id="history"]', { timeout: 10000 });
  });

  test('filters appear in journal history', async ({ page }) => {
    const mainFilters = page.locator('#history section[aria-label="Journal filters"]');
    await expect(mainFilters).toBeVisible();

    // Should only render one filters surface (no duplicate rail filters)
    const searchInputs = page.getByPlaceholder('Search readings...');
    await expect(searchInputs).toHaveCount(1);
  });

  test('sticky rail journey stays visible while scrolling', async ({ page }) => {
    const journeyHeading = page.locator('aside').getByRole('heading', { name: /Your Reading Journey/i });
    await expect(journeyHeading).toBeVisible();

    // Scroll down the page
    await page.evaluate(() => window.scrollTo(0, 800));

    // Rail should remain in viewport
    await expect(journeyHeading).toBeVisible();
    await expect(journeyHeading).toBeInViewport();
  });

  test('"Jump to journal filters" jumps to history filters', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 2500, behavior: 'instant' }));
    const jumpButton = page.getByRole('button', { name: 'Jump to journal filters' });
    await expect(jumpButton).toBeVisible();

    await jumpButton.click();

    const filtersAnchor = page.locator('#journal-history-filters');
    await expect(filtersAnchor).toBeInViewport();

    const searchInput = filtersAnchor.getByPlaceholder('Search readings...');
    await expect(searchInput).toBeFocused();
  });

  test('floating "Filters" button appears after scroll and jumps back to filters', async ({ page }) => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    const floatingButton = page.getByRole('button', { name: 'Jump to journal filters' });
    await expect(floatingButton).toBeVisible();

    await floatingButton.click();

    const filtersAnchor = page.locator('#journal-history-filters');
    await expect(filtersAnchor).toBeInViewport();
  });
});

test.describe('Journal Filters - Mobile @mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    const mockEntries = generateMockEntries(15);
    await seedJournalEntries(page, mockEntries);
    await page.goto('/journal');
    await page.waitForSelector('[id="history"]', { timeout: 10000 });
  });

  test('"Jump to journal filters" jumps to history filters', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 2500, behavior: 'instant' }));
    const jumpButton = page.getByRole('button', { name: 'Jump to journal filters' });
    await expect(jumpButton).toBeVisible();

    await jumpButton.click();

    const filtersAnchor = page.locator('#journal-history-filters');
    await expect(filtersAnchor).toBeInViewport();

    const searchInput = filtersAnchor.getByPlaceholder('Search readings...');
    await expect(searchInput).toBeFocused();
  });

  test('main content has compact filters', async ({ page }) => {
    const mainFilters = page.locator('#history section[aria-label="Journal filters"]');
    await expect(mainFilters).toBeVisible();

    const advancedToggle = mainFilters.getByRole('button', { name: /more filters/i });
    await expect(advancedToggle).toBeVisible();
  });

  test('more filters reveals filter map shortcuts', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 2500, behavior: 'instant' }));
    await page.getByRole('button', { name: 'Jump to journal filters' }).click();

    const mainFilters = page.locator('#history section[aria-label="Journal filters"]');
    const advancedToggle = mainFilters.getByRole('button', { name: /more filters/i });

    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');

    const timeframeShortcut = mainFilters.getByRole('button', { name: 'Edit Timeframe filter' });
    await expect(timeframeShortcut).toBeVisible();
  });

  test('filter map can open the timeframe dropdown', async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 2500, behavior: 'instant' }));
    await page.getByRole('button', { name: 'Jump to journal filters' }).click();

    const mainFilters = page.locator('#history section[aria-label="Journal filters"]');
    const advancedToggle = mainFilters.getByRole('button', { name: /more filters/i });

    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');

    const timeframeShortcut = mainFilters.getByRole('button', { name: 'Edit Timeframe filter' });
    await timeframeShortcut.click();

    const option30d = page.getByRole('option', { name: '30 days' });
    await expect(option30d).toBeVisible();
    await option30d.click();
    await expect(page.locator('[id^="journal-entry-mock-entry-"]')).toHaveCount(5);
  });
});

test.describe('Filter Functionality @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    const mockEntries = generateMockEntries(15);
    await seedJournalEntries(page, mockEntries);
    await page.goto('/journal');
    await page.waitForSelector('[id="history"]', { timeout: 10000 });
  });

  const articles = page => page.locator('[id^="journal-entry-mock-entry-"]');
  const expectIds = async (page, ids) => {
    await expect.poll(() => articles(page).evaluateAll(elements => elements.map(el => Number(el.id.split('-').at(-1))).sort((a, b) => a - b))).toEqual(ids);
    await expect(page.getByText(`Filtered: ${ids.length}`, { exact: true })).toBeVisible();
    await expect(page.getByText('Loaded: 15 of 15', { exact: true })).toBeVisible();
  };
  const select = async (page, label, option) => {
    await page.locator('#history').getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
    await page.keyboard.press('Escape');
  };

  test('entry count badge updates when filtering', async ({ page }) => {
    await expect(page.getByText('Filtered: 15', { exact: true })).toBeVisible();
    await expect(articles(page)).toHaveCount(10);
    await select(page, 'Context', 'Love');
    await expectIds(page, [0, 6, 12]);
  });

  test('search filter works', async ({ page }) => {
    const search = page.getByPlaceholder('Search readings...');
    await search.fill('entry 1');
    await expectIds(page, [0, 9, 10, 11, 12, 13, 14]);
    await search.fill('');
    await expect(articles(page)).toHaveCount(10);
    await expect(page.getByText('Filtered: 15', { exact: true })).toBeVisible();
  });

  test('timeframe filter works', async ({ page }) => {
    await select(page, 'Timeframe', '30 days');
    await expectIds(page, [0, 1, 2, 3, 4]);
  });

  test('reversals toggle filter works', async ({ page }) => {
    const reversals = page.locator('#history').getByRole('button', { name: 'Reversals', exact: true });
    await reversals.click();
    await expect(reversals).toHaveAttribute('aria-pressed', 'true');
    await expectIds(page, [0, 4, 8, 12]);
  });

  test('reset clears all filters', async ({ page }) => {
    await select(page, 'Context', 'Love');
    await select(page, 'Timeframe', '30 days');
    await page.getByRole('button', { name: 'Reversals', exact: true }).click();
    await expectIds(page, [0]);
    await page.getByPlaceholder('Search readings...').fill('test');
    await page.locator('#history').getByRole('button', { name: 'Reset view', exact: true }).click();
    await expect(page.getByPlaceholder('Search readings...')).toHaveValue('');
    await expect(page.getByText('Filtered: 15', { exact: true })).toBeVisible();
    await expect(articles(page)).toHaveCount(10);
  });

  test('load more button works after filtering', async ({ page }) => {
    await expect(articles(page)).toHaveCount(10);
    await page.getByRole('button', { name: 'Load 5 more', exact: true }).click();
    await expect(articles(page)).toHaveCount(15);
    await expect(page.getByText('Filtered: 15', { exact: true })).toBeVisible();
    const search = page.getByPlaceholder('Search readings...');
    await search.fill('test');
    await expect(articles(page)).toHaveCount(10);
    await page.getByRole('button', { name: 'Load 5 more', exact: true }).click();
    await expect(articles(page)).toHaveCount(15);
    await select(page, 'Context', 'Love');
    await expectIds(page, [0, 6, 12]);
    await page.locator('#history').getByRole('button', { name: 'Reset view', exact: true }).click();
    await expect(articles(page)).toHaveCount(10);
  });
});

test.describe('Filter State Persistence @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('saved filters can be created and applied', async ({ page }) => {
    const mockEntries = generateMockEntries(15);
    await seedJournalEntries(page, mockEntries);
    await page.goto('/journal');
    await page.waitForSelector('[id="history"]', { timeout: 10000 });

    // Apply a filter first
    const contextDropdown = page.locator('#history').getByRole('button', { name: 'Context', exact: true });
    await contextDropdown.click();
    await page.getByRole('option', { name: 'Love' }).click();
    await page.keyboard.press('Escape');

    const saveViewButton = page.locator('#history').getByRole('button', { name: /save this view/i });
    await expect(saveViewButton).toBeVisible();
    await saveViewButton.click();

    const nameInput = page.locator('#history').getByPlaceholder('Name this view');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('My Love Filter');

    const saveButton = page.locator('#history').getByRole('button', { name: /save current/i });
    await saveButton.click();

    // Should see the saved filter appear
    await expect(page.getByText('My Love Filter')).toBeVisible();
  });
});

test.describe('Empty and Edge States @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('shows no results message when filters match nothing', async ({ page }) => {
    const mockEntries = generateMockEntries(5);
    await seedJournalEntries(page, mockEntries);
    await page.goto('/journal');
    await page.waitForSelector('[id="history"]', { timeout: 10000 });

    // Search for something that won't match
    const searchInput = page.locator('#history').getByPlaceholder('Search readings...');
    await searchInput.fill('xyznonexistent123456');

    // Should show "No entries match" message (wait for debounced filter)
    await expect(page.getByText(/no entries match/i)).toBeVisible({ timeout: 2000 });
  });
});
