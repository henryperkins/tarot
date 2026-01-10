import { test, expect } from '@playwright/test';

const MOCK_READING_RESPONSE = {
  reading: 'Mock narrative response for follow-up tests.',
  provider: 'mock',
  requestId: 'mock-follow-up-request',
  themes: {
    elementCounts: { fire: 1, water: 1, air: 1, earth: 1 },
    reversalCount: 0
  }
};

async function mockTarotReading(page, overrides = {}) {
  await page.route('**/api/tarot-reading', async (route) => {
    const responseBody = { ...MOCK_READING_RESPONSE, ...overrides };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseBody)
    });
  });
}

async function mockFollowUp(page, options = {}) {
  const {
    status = 200,
    responseText = 'Mock follow-up response.',
    journalContext = null,
    onRequest = null
  } = options;

  await page.route('**/api/reading-followup', async (route) => {
    let body = null;
    try {
      body = route.request().postDataJSON();
    } catch {
      body = null;
    }

    if (onRequest) {
      await onRequest(body);
    }

    const responseBody = status === 200
      ? {
          response: responseText,
          turn: 1,
          journalContext,
          meta: {
            provider: 'mock',
            latencyMs: 12,
            requestId: 'mock-follow-up'
          }
        }
      : {
          error: 'Not authenticated'
        };

    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(responseBody)
    });
  });
}

async function seedOnboardingState(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
      intention: false,
      experience: false,
      ritual: true,
      audio: false
    }));
  });
}

async function waitForAppReady(page) {
  await page.waitForSelector('[role="radiogroup"][aria-label="Spread selection"]', {
    timeout: 15000
  });
}

async function selectSpread(page, spreadName) {
  const spreadButton = page.getByRole('radio', { name: new RegExp(spreadName, 'i') });
  await spreadButton.click();
  await expect(spreadButton).toHaveAttribute('aria-checked', 'true');
}

async function skipRitual(page) {
  const ritualSkipButton = page.locator('button:has-text("Skip")').first();
  if (await ritualSkipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ritualSkipButton.click();
    const confirmButton = page.getByRole('button', { name: /skip.*draw|confirm|yes/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
      return;
    }
  }

  const drawCardsButton = page.getByRole('button', { name: /draw cards/i });
  if (await drawCardsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await drawCardsButton.click();
    return;
  }

  const shuffleDrawButton = page.getByRole('button', { name: /shuffle\s*&\s*draw/i });
  if (await shuffleDrawButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await shuffleDrawButton.click();
  }
}

async function waitForCardsDealt(page) {
  await expect(async () => {
    const cards = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 8000 });
}

async function revealCard(page, index) {
  const cards = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
  const card = cards.nth(index);
  await expect(card).toBeVisible({ timeout: 8000 });
  await card.click();
  await page.waitForTimeout(600);
}

async function completeReading(page, question = 'What should I focus on?') {
  await seedOnboardingState(page);
  await page.goto('/');
  await waitForAppReady(page);

  await selectSpread(page, 'One-Card');

  const questionInput = page.locator('textarea').first();
  await questionInput.fill(question);

  await skipRitual(page);
  await waitForCardsDealt(page);
  await revealCard(page, 0);

  const generateButton = page.getByRole('button', { name: /generate|create.*narrative|get.*reading|receive.*reading/i }).first();
  await expect(generateButton).toBeVisible({ timeout: 8000 });
  await generateButton.click();

  await expect(page.getByText('Your narrative is ready')).toBeVisible({ timeout: 10000 });
}

async function openFollowUp(page) {
  const toggleButton = page.getByRole('button', { name: /have a question about your reading/i });
  await expect(toggleButton).toBeVisible({ timeout: 5000 });
  await toggleButton.click();
  await expect(page.locator('#follow-up-content')).toBeVisible();
}

test.describe('Follow-up questions - Desktop @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('follow-up section appears after narrative completes', async ({ page }) => {
    await mockTarotReading(page);
    await completeReading(page);

    const followUpButton = page.getByRole('button', { name: /have a question about your reading/i });
    await expect(followUpButton).toBeVisible();
  });

  test('suggested question submits and renders response', async ({ page }) => {
    await mockTarotReading(page);
    await mockFollowUp(page, { responseText: 'Mocked follow-up answer.' });
    await completeReading(page);
    await openFollowUp(page);

    const suggestionList = page.getByRole('list', { name: /suggested questions/i });
    const firstSuggestion = suggestionList.getByRole('listitem').first();
    const suggestionText = (await firstSuggestion.textContent())?.trim();

    await firstSuggestion.click();

    if (suggestionText) {
      await expect(page.getByText(suggestionText)).toBeVisible();
    }
    await expect(page.getByText('Mocked follow-up answer.')).toBeVisible();
  });

  test('free-form input submits and shows response', async ({ page }) => {
    await mockTarotReading(page);
    await mockFollowUp(page, { responseText: 'Free-form response.' });
    await completeReading(page);
    await openFollowUp(page);

    const input = page.getByLabel('Follow-up question');
    await input.fill('Can you clarify the main lesson?');
    await input.press('Enter');

    await expect(page.getByText('Free-form response.')).toBeVisible();
  });

  test('free tier limit disables additional questions', async ({ page }) => {
    await mockTarotReading(page);
    await mockFollowUp(page, { responseText: 'First follow-up response.' });
    await completeReading(page);
    await openFollowUp(page);

    const input = page.getByLabel('Follow-up question');
    await input.fill('First follow-up question.');
    await input.press('Enter');

    await expect(page.getByText('First follow-up response.')).toBeVisible();
    await expect(page.getByText(/used all 1 follow-up question/i)).toBeVisible();
    await expect(page.getByLabel('Follow-up question')).toHaveCount(0);
  });

  test('journal context toggle affects request payload for Plus users', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-plus',
            email: 'plus@example.com',
            username: 'plus-user',
            subscription_tier: 'plus',
            subscription_status: 'active',
            subscription_provider: 'stripe'
          }
        })
      });
    });

    let includeJournalContext = null;
    await mockTarotReading(page);
    await mockFollowUp(page, {
      responseText: 'Journal toggle response.',
      onRequest: (body) => {
        includeJournalContext = body?.options?.includeJournalContext ?? null;
      }
    });

    await completeReading(page);
    await openFollowUp(page);

    const journalToggle = page.getByRole('checkbox', { name: /include insights from my journal history/i });
    await expect(journalToggle).toBeVisible();
    await journalToggle.uncheck();

    const input = page.getByLabel('Follow-up question');
    await input.fill('Test journal toggle.');
    await input.press('Enter');

    await expect(page.getByText('Journal toggle response.')).toBeVisible();
    expect(includeJournalContext).toBe(false);
  });

  test('error states display when follow-up fails', async ({ page }) => {
    await mockTarotReading(page);
    await mockFollowUp(page, { status: 401 });
    await completeReading(page);
    await openFollowUp(page);

    const suggestionList = page.getByRole('list', { name: /suggested questions/i });
    await suggestionList.getByRole('listitem').first().click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Please sign in to ask follow-up questions.');
    await expect(page.getByRole('log', { name: /conversation history/i })).toHaveCount(0);
  });
});

test.describe('Follow-up questions - Mobile @mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('follow-up UI remains usable on mobile', async ({ page }) => {
    await mockTarotReading(page);
    await completeReading(page, 'Mobile follow-up test');

    await openFollowUp(page);

    await expect(page.getByRole('list', { name: /suggested questions/i })).toBeVisible();
    await expect(page.getByLabel('Follow-up question')).toBeVisible();
  });
});
