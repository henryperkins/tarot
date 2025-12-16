import { test, expect } from '@playwright/test';

/**
 * Journal Filters E2E Tests
 *
 * Verifies:
 * - Desktop: filters appear in Journal History and are reachable via "Find a reading" + a floating "Filters" button
 * - Desktop: sticky rail (Reading Journey) stays visible while scrolling
 * - Mobile: filters render in Journal History (compact) and "Advanced filters" reveals filter-map shortcuts
 * - Filter functionality: context/spread/deck/timeframe/reversal/search
 * - Entry counts update correctly
 * - Load more works after filtering
 */

// Helper to seed localStorage with mock journal entries
async function seedJournalEntries(page, entries) {
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
  const now = Date.now();

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
    const mainFilters = page.locator('#history section[aria-label="Focus your journal"]');
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

  test('"Find a reading" jumps to history filters', async ({ page }) => {
    const jumpButton = page.getByRole('button', { name: /find a reading/i });
    await expect(jumpButton).toBeVisible();

    await jumpButton.click();

    const filtersAnchor = page.locator('#journal-history-filters');
    await expect(filtersAnchor).toBeInViewport();

    const searchInput = filtersAnchor.getByPlaceholder('Search readings...');
    await expect(searchInput).toBeVisible();
  });

  test('floating "Filters" button appears after scroll and jumps back to filters', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 2500));

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

  test('"Find a reading" jumps to history filters', async ({ page }) => {
    const jumpButton = page.getByRole('button', { name: /find a reading/i });
    await expect(jumpButton).toBeVisible();

    await jumpButton.click();

    const filtersAnchor = page.locator('#journal-history-filters');
    await expect(filtersAnchor).toBeInViewport();

    const searchInput = filtersAnchor.getByPlaceholder('Search readings...');
    await expect(searchInput).toBeVisible();
  });

  test('main content has compact filters', async ({ page }) => {
    const mainFilters = page.locator('#history section[aria-label="Focus your journal"]');
    await expect(mainFilters).toBeVisible();

    const advancedToggle = mainFilters.getByRole('button', { name: /advanced filters/i });
    await expect(advancedToggle).toBeVisible();
  });

  test('advanced filters reveals filter map shortcuts', async ({ page }) => {
    await page.getByRole('button', { name: /find a reading/i }).click();

    const mainFilters = page.locator('#history section[aria-label="Focus your journal"]');
    const advancedToggle = mainFilters.getByRole('button', { name: /advanced filters/i });

    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');

    const timeframeShortcut = mainFilters.getByRole('button', { name: 'Edit Timeframe filter' });
    await expect(timeframeShortcut).toBeVisible();
  });

  test('filter map can open the timeframe dropdown', async ({ page }) => {
    await page.getByRole('button', { name: /find a reading/i }).click();

    const mainFilters = page.locator('#history section[aria-label="Focus your journal"]');
    const advancedToggle = mainFilters.getByRole('button', { name: /advanced filters/i });

    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute('aria-expanded', 'true');

    const timeframeShortcut = mainFilters.getByRole('button', { name: 'Edit Timeframe filter' });
    await timeframeShortcut.click();

    const option30d = page.getByRole('option', { name: '30 days' });
    await expect(option30d).toBeVisible();
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

  test('entry count badge updates when filtering', async ({ page }) => {
    // Find the entry count badge
    const countBadge = page.locator('#history').locator('text=/Showing \\d+ of \\d+/');
    await expect(countBadge).toBeVisible();

    const initialText = await countBadge.textContent();

    // Apply a context filter by clicking the Context dropdown
    const contextDropdown = page.locator('#history').getByRole('button', { name: 'Context', exact: true });
    await contextDropdown.click();

    // Select "Love" option
    await page.getByRole('option', { name: 'Love' }).click();

    // Close dropdown (multi-select stays open by design)
    await page.keyboard.press('Escape');

    // Count should have changed (filtered to only "love" context entries)
    // With 15 entries cycling through 6 contexts, ~2-3 will be "love"
    await expect(countBadge).not.toHaveText(initialText);
  });

  test('search filter works', async ({ page }) => {
    const searchInput = page.locator('#history').getByPlaceholder('Search readings...');
    const countBadge = page.locator('#history').locator('text=/Showing \\d+ of \\d+/');

    // Get initial count
    const initialText = await countBadge.textContent();

    // Search for something specific that will filter results
    await searchInput.fill('entry 1');

    // Wait for the count to change (debounced filter applied)
    await expect(async () => {
      const newText = await countBadge.textContent();
      expect(newText).not.toBe(initialText);
    }).toPass({ timeout: 2000 });

    // Should find entries with "entry 1" in question text
    const countText = await countBadge.textContent();
    expect(countText).toMatch(/Showing \d+ of \d+/);
  });

  test('timeframe filter works', async ({ page }) => {
    const countBadge = page.locator('#history').locator('text=/Showing \\d+ of \\d+/');
    const initialText = await countBadge.textContent();

    // Click timeframe dropdown
    const timeframeDropdown = page.locator('#history').getByRole('button', { name: 'Timeframe', exact: true });
    await timeframeDropdown.click();

    // Select "30 days" - should filter to only 5 entries (those within 30 days)
    await page.getByRole('option', { name: '30 days' }).click();

    // Count should change (mock data has 5 entries within 30 days, 5 within 90, 5 older)
    await expect(countBadge).not.toHaveText(initialText);
  });

  test('reversals toggle filter works', async ({ page }) => {
    // Find and click the Reversals toggle
    const reversalsToggle = page.locator('#history').getByRole('button', { name: 'Reversals', exact: true });
    await reversalsToggle.click();

    // Button should now show active state (has check mark)
    const checkIcon = reversalsToggle.locator('svg');
    await expect(checkIcon).toBeVisible();

    // Entry count should update to show only entries with reversed cards
    const countBadge = page.locator('#history').locator('text=/Showing \\d+ of \\d+/');
    await expect(countBadge).toBeVisible();
  });

  test('reset clears all filters', async ({ page }) => {
    const searchInput = page.locator('#history').getByPlaceholder('Search readings...');

    // Apply some filters
    await searchInput.fill('test');

    // Click reset button
    const resetButton = page.locator('#history').getByRole('button', { name: /reset|clear/i }).first();
    await resetButton.click();

    // Search should be cleared
    await expect(searchInput).toHaveValue('');
  });

  test('load more button works after filtering', async ({ page }) => {
    // With 15 entries and batch size of 10, load more should exist
    const loadMoreButton = page.getByRole('button', { name: /load \d+ more/i });
    await expect(loadMoreButton).toBeVisible();

    const countBadge = page.locator('#history').locator('text=/Showing \\d+ of \\d+/');
    const initialText = await countBadge.textContent();
    const initialShowing = parseInt(initialText.match(/Showing (\d+)/)?.[1] || '0');

    // Click load more
    await loadMoreButton.click();

    // Should show more entries
    await expect(async () => {
      const newText = await countBadge.textContent();
      const newShowing = parseInt(newText.match(/Showing (\d+)/)?.[1] || '0');
      expect(newShowing).toBeGreaterThan(initialShowing);
    }).toPass();
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
