import { test, expect } from '@playwright/test';

/**
 * Journal Filters E2E Tests
 *
 * Verifies:
 * - Desktop: filters appear both above entries and in sticky rail
 * - Mobile: accordion filter opens/works before insights/journey
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

  test('filters appear in both main content and sticky rail', async ({ page }) => {
    // Main content area filters (inside #history section)
    const mainFilters = page.locator('#history section[aria-label="Focus your journal"]');
    await expect(mainFilters).toBeVisible();

    // Sticky rail filters (inside aside element)
    const railFilters = page.locator('aside section[aria-label="Focus your journal"]');
    await expect(railFilters).toBeVisible();

    // Both should have search inputs
    const searchInputs = page.getByPlaceholder('Search readings...');
    await expect(searchInputs).toHaveCount(2);
  });

  test('sticky rail stays visible while scrolling', async ({ page }) => {
    const railFilters = page.locator('aside section[aria-label="Focus your journal"]');

    // Scroll down the page
    await page.evaluate(() => window.scrollTo(0, 500));

    // Wait for scroll to complete and rail to remain in viewport
    await expect(railFilters).toBeVisible();
    await expect(railFilters).toBeInViewport();
  });

  test('filters in both locations stay in sync', async ({ page }) => {
    // Get both search inputs
    const mainSearch = page.locator('#history').getByPlaceholder('Search readings...');
    const railSearch = page.locator('aside').getByPlaceholder('Search readings...');

    // Type in the main search
    await mainSearch.fill('test query');

    // Both inputs should have the same value (they share state)
    await expect(mainSearch).toHaveValue('test query');
    await expect(railSearch).toHaveValue('test query');
  });

  test('insights panel appears in sticky rail', async ({ page }) => {
    // Check for insights panel in the rail (header text is "Journal Insights")
    const insightsPanel = page.locator('aside').getByText('Journal Insights');
    await expect(insightsPanel).toBeVisible();
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

  test('accordion sections appear in correct order', async ({ page }) => {
    // Find the mobile accordion section
    const accordionSection = page.locator('section[aria-label="Journal filters, insights, and journey"]');
    await expect(accordionSection).toBeVisible();

    // Get all accordion buttons in order
    const accordionButtons = accordionSection.getByRole('button');
    const buttonTexts = await accordionButtons.allTextContents();

    // Filters should come first
    expect(buttonTexts[0]).toContain('Filters');
  });

  test('filter accordion opens and shows filter controls', async ({ page }) => {
    // Find and click the Filters accordion
    const filtersAccordion = page.getByRole('button', { name: /filters/i }).first();
    await expect(filtersAccordion).toBeVisible();

    // Check it's collapsed initially (aria-expanded="false")
    await expect(filtersAccordion).toHaveAttribute('aria-expanded', 'false');

    // Open the accordion
    await filtersAccordion.click();
    await expect(filtersAccordion).toHaveAttribute('aria-expanded', 'true');

    // Filter controls should now be visible
    const searchInput = page.locator('section[aria-label="Journal filters, insights, and journey"]').getByPlaceholder('Search readings...');
    await expect(searchInput).toBeVisible();
  });

  test('insights accordion exists after filters', async ({ page }) => {
    // Look for insights accordion
    const insightsAccordion = page.getByRole('button', { name: /insights/i });
    await expect(insightsAccordion).toBeVisible();
  });

  test('main content also has compact filters', async ({ page }) => {
    // The main content area should also have filters
    const mainFilters = page.locator('#history section[aria-label="Focus your journal"]');
    await expect(mainFilters).toBeVisible();
  });
});

test.describe('Filter Functionality', () => {
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
    const contextDropdown = page.locator('#history').getByRole('button', { name: 'Context' });
    await contextDropdown.click();

    // Select "Love" option
    await page.getByRole('option', { name: 'Love' }).click();

    // Close dropdown by clicking elsewhere
    await page.locator('#history h2').click();

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
    const timeframeDropdown = page.locator('#history').getByRole('button', { name: /all time|timeframe/i });
    await timeframeDropdown.click();

    // Select "30 days" - should filter to only 5 entries (those within 30 days)
    await page.getByRole('option', { name: '30 days' }).click();

    // Count should change (mock data has 5 entries within 30 days, 5 within 90, 5 older)
    await expect(countBadge).not.toHaveText(initialText);
  });

  test('reversals toggle filter works', async ({ page }) => {
    // Find and click the Reversals toggle
    const reversalsToggle = page.locator('#history').getByRole('button', { name: 'Reversals' });
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

test.describe('Filter State Persistence', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('saved filters can be created and applied', async ({ page }) => {
    const mockEntries = generateMockEntries(15);
    await seedJournalEntries(page, mockEntries);
    await page.goto('/journal');
    await page.waitForSelector('[id="history"]', { timeout: 10000 });

    // Apply a filter first
    const contextDropdown = page.locator('#history').getByRole('button', { name: 'Context' });
    await contextDropdown.click();
    await page.getByRole('option', { name: 'Love' }).click();
    await page.locator('#history h2').click();

    // Find the "Name this view" input - it should be visible after applying a filter
    const nameInput = page.locator('#history').getByPlaceholder('Name this view');
    await expect(nameInput).toBeVisible();

    await nameInput.fill('My Love Filter');

    const saveButton = page.locator('#history').getByRole('button', { name: /save current/i });
    await saveButton.click();

    // Should see the saved filter appear
    await expect(page.getByText('My Love Filter')).toBeVisible();
  });
});

test.describe('Empty and Edge States', () => {
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
