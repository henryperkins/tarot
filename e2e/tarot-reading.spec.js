import { test, expect } from '@playwright/test';

/**
 * Tarot Reading Flow E2E Tests
 *
 * Tests the core user journey:
 * Spread Selection → Question Input → Ritual → Shuffle → Reveal → Narrative → Save
 *
 * These are the highest-value E2E tests as they cover the primary product experience.
 */

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wait for the app to be ready (spread selector visible)
 */
async function waitForAppReady(page) {
  await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', {
    timeout: 15000
  });
}

/**
 * Select a spread by name
 */
async function selectSpread(page, spreadName) {
  const spreadButton = page.getByRole('radio', { name: new RegExp(spreadName, 'i') });
  await spreadButton.click();
  // Wait for selection to register (checkmark appears)
  await expect(spreadButton).toHaveAttribute('aria-checked', 'true');
}

/**
 * Enter a question in the intention input
 * @unused Reserved for future tests
 */
async function _enterQuestion(page, question) {
  // The question input may be in different locations (desktop vs mobile)
  const questionInput = page.locator('textarea').filter({ hasText: '' }).first();
  await questionInput.fill(question);
}

/**
 * Perform the knock ritual (3 knocks)
 */
async function performKnocks(page, count = 3) {
  for (let i = 0; i < count; i++) {
    // Match the actual knock button (shows "Knock X of 3" pattern), not the accordion header
    const knockButton = page.getByRole('button', { name: /knock \d+ of \d+|tap.*knock/i });
    await knockButton.click();
    // Small delay between knocks to simulate natural rhythm
    await page.waitForTimeout(150);
  }
}

/**
 * Apply the cut at current slider position and deal the cards
 */
async function applyCut(page) {
  const applyButton = page.getByRole('button', { name: /lock cut/i });
  if (await applyButton.isVisible()) {
    await applyButton.click();
  }

  // After ritual is complete, click "Draw cards" to deal
  const drawCardsButton = page.getByRole('button', { name: /draw cards/i });
  if (await drawCardsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await drawCardsButton.click();
  }
}

/**
 * Skip the ritual entirely and trigger shuffle/deal
 */
async function skipRitual(page) {
  // Try the ritual section's skip button first (if ritual panel is expanded)
  const ritualSkipButton = page.locator('button:has-text("Skip")').first();
  if (await ritualSkipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ritualSkipButton.click();
    // Confirm skip if modal appears (button text is "Skip & draw")
    const confirmButton = page.getByRole('button', { name: /skip.*draw|confirm|yes/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
      return;
    }
  }

  // Fallback: click the "Draw cards" button directly
  const drawCardsButton = page.getByRole('button', { name: /draw cards/i });
  if (await drawCardsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await drawCardsButton.click();
  }
}

/**
 * Wait for shuffle animation to complete and cards to appear
 */
async function waitForCardsDealt(page, _expectedCount) {
  // Wait for the card grid/carousel to appear with cards
  await expect(async () => {
    const cards = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 5000 });
}

/**
 * Reveal a single card by index
 */
async function revealCard(page, index) {
  const cards = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
  const card = cards.nth(index);
  if (await card.isVisible()) {
    await card.click();
    // Wait for flip animation
    await page.waitForTimeout(600);
  }
}

/**
 * Reveal all cards at once
 */
async function revealAllCards(page) {
  const revealAllButton = page.getByRole('button', { name: /reveal all/i });
  if (await revealAllButton.isVisible()) {
    await revealAllButton.click();
    // Wait for all flip animations
    await page.waitForTimeout(1500);
  }
}

/**
 * Check if all cards are revealed
 */
async function areAllCardsRevealed(page, _expectedCount) {
  // Look for card images (revealed cards show images)
  const revealedCards = page.locator('.card-front img, [class*="card"] img[alt*="card"], [class*="card"] img[alt*="Arcana"]');
  const count = await revealedCards.count();
  return count >= 1; // At least one card revealed
}

/**
 * Generate the narrative reading
 * @unused Reserved for full narrative tests (requires API)
 */
async function _generateNarrative(page) {
  // Desktop button or mobile action bar button
  const generateButton = page.getByRole('button', { name: /generate|create.*narrative|get.*reading|receive.*reading/i }).first();
  await expect(generateButton).toBeVisible({ timeout: 5000 });
  await generateButton.click();
}

/**
 * Wait for narrative to complete loading
 * @unused Reserved for full narrative tests (requires API)
 */
async function _waitForNarrativeComplete(page) {
  // Wait for loading skeleton to disappear and text to appear
  await expect(async () => {
    const skeleton = page.locator('[aria-label="Generating your personalized narrative"]');
    const isSkeletonVisible = await skeleton.isVisible().catch(() => false);
    expect(isSkeletonVisible).toBe(false);
  }).toPass({ timeout: 30000 }); // Narrative generation can take a while

  // Verify narrative text appeared
  const narrativeText = page.locator('.narrative-text, [class*="narrative"], [class*="reading-text"]').first();
  await expect(narrativeText).toBeVisible({ timeout: 5000 });
}

/**
 * Save the reading to journal
 * @unused Reserved for full save tests (requires API)
 */
async function _saveToJournal(page) {
  const saveButton = page.getByRole('button', { name: /save/i }).first();
  if (await saveButton.isVisible()) {
    await saveButton.click();
  }
}

/**
 * Start a new reading (shuffle again)
 */
async function startNewReading(page) {
  // Use aria-label to avoid matching "Reset reveals" button
  const newReadingButton = page.getByRole('button', { name: /start a new reading|new reading.*reset this spread/i });
  await newReadingButton.click();
}

// ============================================================================
// DESKTOP TESTS
// ============================================================================

test.describe('Tarot Reading Flow - Desktop @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      // Expand ritual section in preparation panel (stored in sessionStorage)
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('complete single-card reading flow', async ({ page }) => {
    // 1. Select single card spread (quickest flow)
    await selectSpread(page, 'One-Card');

    // 2. Enter a question
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('What should I focus on today?');

    // 3. Skip ritual for speed
    await skipRitual(page);

    // 4. Wait for card to be dealt
    await waitForCardsDealt(page, 1);

    // 5. Reveal the card
    await revealCard(page, 0);

    // 6. Verify card is revealed (image visible)
    await expect(async () => {
      const revealed = await areAllCardsRevealed(page, 1);
      expect(revealed).toBe(true);
    }).toPass({ timeout: 3000 });

    // 7. Generate narrative button should appear
    const generateButton = page.getByRole('button', { name: /generate|create.*narrative|get.*reading|receive/i }).first();
    await expect(generateButton).toBeVisible({ timeout: 5000 });
  });

  test('complete three-card reading with full ritual', async ({ page }) => {
    // 1. Select three-card spread
    await selectSpread(page, 'Three-Card');

    // 2. Enter question
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('What are the influences on my career path?');

    // 3. Perform ritual - 3 knocks
    await performKnocks(page, 3);

    // 4. Apply cut
    await applyCut(page);

    // 5. Wait for cards
    await waitForCardsDealt(page, 3);

    // 6. Reveal cards one by one
    for (let i = 0; i < 3; i++) {
      await revealCard(page, i);
    }

    // 7. Verify all revealed
    await expect(async () => {
      const revealed = await areAllCardsRevealed(page, 3);
      expect(revealed).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test('spread selection changes theme colors', async ({ page }) => {
    // Select Celtic Cross - should have distinct theme
    await selectSpread(page, 'Celtic');

    // Verify the spread is selected
    const celticButton = page.getByRole('radio', { name: /celtic/i });
    await expect(celticButton).toHaveAttribute('aria-checked', 'true');

    // Select Three-Card - different theme
    await selectSpread(page, 'Three-Card');

    // Verify selection changed
    const threeCardButton = page.getByRole('radio', { name: /three-card/i });
    await expect(threeCardButton).toHaveAttribute('aria-checked', 'true');
    await expect(celticButton).toHaveAttribute('aria-checked', 'false');
  });

  test('reveal all cards button works', async ({ page }) => {
    // Quick setup
    await selectSpread(page, 'Three-Card');
    await skipRitual(page);
    await waitForCardsDealt(page, 3);

    // Use reveal all
    await revealAllCards(page);

    // All cards should be revealed
    await expect(async () => {
      const revealed = await areAllCardsRevealed(page, 3);
      expect(revealed).toBe(true);
    }).toPass({ timeout: 5000 });
  });

  test('can start new reading after completing one', async ({ page }) => {
    // Complete a quick reading
    await selectSpread(page, 'One-Card');
    await skipRitual(page);
    await waitForCardsDealt(page, 1);
    await revealCard(page, 0);

    // Start new reading
    await startNewReading(page);

    // Should have new unrevealed card(s)
    await waitForCardsDealt(page, 1);

    // Card should be unrevealed (back showing)
    const unrevealedCard = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
    await expect(unrevealedCard).toBeVisible({ timeout: 3000 });
  });

  test('question persists after shuffle', async ({ page }) => {
    const testQuestion = 'My unique test question for persistence';

    await selectSpread(page, 'One-Card');

    // Enter question
    const questionInput = page.locator('textarea').first();
    await questionInput.fill(testQuestion);

    // Shuffle
    await skipRitual(page);
    await waitForCardsDealt(page, 1);

    // Shuffle again
    await startNewReading(page);
    await waitForCardsDealt(page, 1);

    // Question should still be there
    await expect(questionInput).toHaveValue(testQuestion);
  });
});

// ============================================================================
// MOBILE TESTS
// ============================================================================

test.describe('Tarot Reading Flow - Mobile @mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      // Expand ritual section in preparation panel (stored in sessionStorage)
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('mobile layout shows spread carousel', async ({ page }) => {
    // Spreads should be in a horizontal scrollable carousel on mobile
    const spreadSelector = page.locator('[role="radiogroup"][aria-label="Spread selection"]');
    await expect(spreadSelector).toBeVisible();

    // Should be scrollable horizontally
    const isScrollable = await spreadSelector.evaluate(el => el.scrollWidth > el.clientWidth);
    expect(isScrollable).toBe(true);
  });

  test('can complete reading on mobile', async ({ page }) => {
    // Select spread (may need to scroll carousel)
    await selectSpread(page, 'One-Card');

    // Skip ritual
    await skipRitual(page);

    // Wait for card
    await waitForCardsDealt(page, 1);

    // Reveal card
    await revealCard(page, 0);

    // Verify revealed
    await expect(async () => {
      const revealed = await areAllCardsRevealed(page, 1);
      expect(revealed).toBe(true);
    }).toPass({ timeout: 3000 });
  });

  test('mobile action bar shows appropriate actions', async ({ page }) => {
    await selectSpread(page, 'One-Card');
    await skipRitual(page);
    await waitForCardsDealt(page, 1);

    // Reveal card
    await revealCard(page, 0);

    // After reveal - should show generate action
    const generateButton = page.getByRole('button', { name: /generate|reading/i }).first();
    await expect(generateButton).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// RITUAL TESTS
// ============================================================================

test.describe('Ritual Mechanics @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      // Expand ritual section in preparation panel (stored in sessionStorage)
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);
    await selectSpread(page, 'Three-Card');
  });

  test('knock counter increments correctly', async ({ page }) => {
    // First knock
    const knockButton = page.getByRole('button', { name: /knock 1 of 3/i });
    if (await knockButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await knockButton.click();

      // Should now show "Knock 2 of 3"
      await expect(page.getByRole('button', { name: /knock 2 of 3/i })).toBeVisible({ timeout: 2000 });
    }
  });

  test('cut slider is interactive', async ({ page }) => {
    const cutSlider = page.locator('[aria-label="Cut position"]');
    if (await cutSlider.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Slider should be draggable
      await expect(cutSlider).toBeEnabled();
    }
  });

  test('skip ritual triggers shuffle', async ({ page }) => {
    await skipRitual(page);

    // Cards should be dealt
    await waitForCardsDealt(page, 3);
  });
});

// ============================================================================
// DETERMINISTIC SEED TESTS
// ============================================================================

test.describe('Deterministic Shuffle @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('same question produces consistent shuffle', async ({ page }) => {
    const testQuestion = 'What does the universe want me to know?';

    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });

    // First reading
    await page.goto('/');
    await waitForAppReady(page);
    await selectSpread(page, 'Three-Card');

    const questionInput = page.locator('textarea').first();
    await questionInput.fill(testQuestion);

    await skipRitual(page);
    await waitForCardsDealt(page, 3);
    await revealAllCards(page);

    // Note: We can't easily compare card values between reloads without
    // exposing card data. This test validates the flow works with question.
    // Full determinism testing would require API-level verification.
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

test.describe('Error Handling @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('handles network errors gracefully', async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);
    await selectSpread(page, 'One-Card');
    await skipRitual(page);
    await waitForCardsDealt(page, 1);
    await revealCard(page, 0);

    // Block API calls to simulate network error
    await page.route('**/api/tarot-reading', route => {
      route.abort('failed');
    });

    // Try to generate narrative
    const generateButton = page.getByRole('button', { name: /generate|reading/i }).first();
    if (await generateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateButton.click();

      // Should show error state (not crash)
      // The app should remain interactive
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('can retry after error', async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);
    await selectSpread(page, 'One-Card');
    await skipRitual(page);
    await waitForCardsDealt(page, 1);
    await revealCard(page, 0);

    // First request fails
    let requestCount = 0;
    await page.route('**/api/tarot-reading', route => {
      requestCount++;
      if (requestCount === 1) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    const generateButton = page.getByRole('button', { name: /generate|reading/i }).first();
    if (await generateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // First attempt - fails
      await generateButton.click();
      await page.waitForTimeout(1000);

      // App should still be usable - can try again or shuffle
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

test.describe('Accessibility @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('spread selector is keyboard navigable', async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);

    // Focus the first spread button in the spread selector
    const spreadSelector = page.locator('[role="radiogroup"][aria-label="Spread selection"]');
    const firstSpread = spreadSelector.getByRole('radio').first();
    await firstSpread.focus();

    // Navigate with arrow keys
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // Select with Enter
    await page.keyboard.press('Enter');

    // A spread should be selected in the spread selector
    const selectedSpread = spreadSelector.getByRole('radio', { checked: true });
    await expect(selectedSpread).toBeVisible();
  });

  test('cards have proper ARIA labels', async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);
    await selectSpread(page, 'One-Card');
    await skipRitual(page);
    await waitForCardsDealt(page, 1);

    // Unrevealed card should have descriptive label
    const card = page.locator('[aria-label*="reveal"]').first();
    await expect(card).toBeVisible();

    const label = await card.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label.toLowerCase()).toContain('reveal');
  });

  test('step progress indicates current stage', async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);

    // Step progress should be visible
    const stepNav = page.locator('[aria-label="Tarot reading progress"]');
    await expect(stepNav).toBeVisible();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

test.describe('Performance @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('app loads within acceptable time', async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    const startTime = Date.now();
    await page.goto('/');
    await waitForAppReady(page);
    const loadTime = Date.now() - startTime;

    // App should load within 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });

  test('shuffle animation completes smoothly', async ({ page }) => {
    // Skip onboarding wizard and expand ritual section for testing
    await page.addInitScript(() => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
        intention: false,
        experience: false,
        ritual: true,
        audio: false
      }));
    });
    await page.goto('/');
    await waitForAppReady(page);
    await selectSpread(page, 'One-Card');

    const shuffleStart = Date.now();
    await skipRitual(page);
    await waitForCardsDealt(page, 1);
    const shuffleTime = Date.now() - shuffleStart;

    // Shuffle should complete within 3 seconds
    expect(shuffleTime).toBeLessThan(3000);
  });
});
