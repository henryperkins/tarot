import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    status: new URL(route.request().url()).pathname === '/api/auth/me' ? 401 : 404,
    json: { user: null }
  }));
});

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
  const responseBody = { ...MOCK_READING_RESPONSE, ...overrides };
  await page.route('**/api/tarot-reading/jobs', route => route.fulfill({
    json: { jobId: 'follow-up-reading-job', jobToken: 'fixture-token' }
  }));
  await page.route('**/api/tarot-reading/jobs/*/stream*', route => route.fulfill({
    contentType: 'text/event-stream',
    body: `event: done\ndata: ${JSON.stringify({ ...responseBody, fullText: responseBody.reading, eventId: 1 })}\n\n`
  }));
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

    // Check if streaming is requested
    const isStreaming = body?.options?.stream === true;

    if (status !== 200) {
      // Error responses are always JSON
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' })
      });
      return;
    }

    if (isStreaming) {
      // Return SSE stream format
      const metaEvent = `event: meta\ndata: ${JSON.stringify({
        turn: 1,
        journalContext,
        provider: 'mock-stream',
        requestId: 'mock-follow-up-stream'
      })}\n\n`;

      // Simulate streaming by sending text in chunks
      const words = responseText.split(' ');
      let deltaEvents = '';
      for (const word of words) {
        deltaEvents += `event: delta\ndata: ${JSON.stringify({ text: word + ' ' })}\n\n`;
      }

      const doneEvent = `event: done\ndata: ${JSON.stringify({ fullText: responseText })}\n\n`;

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        body: metaEvent + deltaEvents + doneEvent
      });
    } else {
      // Non-streaming JSON response (fallback for older clients)
      const responseBody = {
        response: responseText,
        turn: 1,
        journalContext,
        meta: {
          provider: 'mock',
          latencyMs: 12,
          requestId: 'mock-follow-up'
        }
      };

      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseBody)
      });
    }
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
    // Suppress the gesture coach overlay that blocks UI interactions
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      hasSeenRitualNudge: true,
      hasSeenJournalNudge: true,
      hasSeenGestureCoach: true,
      hasDismissedAccountNudge: true,
      readingCount: 1,
      journalSaveCount: 0,
      lastCountedReadingRequestId: null
    }));
  });
}

async function mockAuth(page, tier = 'free') {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: `user-${tier}`,
          email: `${tier}@example.com`,
          username: `${tier}-user`,
          subscription_tier: tier,
          subscription_status: tier === 'free' ? 'inactive' : 'active',
          subscription_provider: tier === 'free' ? null : 'stripe'
        }
      })
    });
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

async function completeReading(page, question = 'What should I focus on?') {
  await seedOnboardingState(page);
  await page.goto('/');
  await waitForAppReady(page);

  await selectSpread(page, 'One-Card');

  const questionInput = page.locator('#question-input, #quick-intention').filter({ visible: true }).first();
  await questionInput.fill(question);

  await page.getByRole('button', { name: /^Draw cards$|^Shuffle & draw/ }).click();
  await page.getByRole('button', { name: /^Deal spread/ }).click();
  await page.getByRole('button', { name: /^Reveal next:/ }).click();
  // Dealing leaves the card face-down until the explicit reveal.

  const generateButton = page.getByRole('button', { name: /^Create Personal Narrative$|^Create narrative/ });
  await expect(generateButton).toBeVisible({ timeout: 8000 });
  await generateButton.click();

  await expect(page.getByRole('heading', { name: 'Your Personalized Narrative' })).toBeVisible();
  await expect(page.locator('.narrative-stream')).toContainText(MOCK_READING_RESPONSE.reading);
  await expect(page.getByRole('button', { name: /open (follow-up )?chat/i })).toBeVisible({ timeout: 10000 });
}

async function openFollowUpModal(page) {
  const openButton = page.getByRole('button', { name: /open chat/i });
  await expect(openButton).toBeVisible({ timeout: 5000 });
  await openButton.click();
  await expect(page.getByRole('dialog', { name: /follow-up chat/i })).toBeVisible();
}

async function openFollowUpDrawer(page) {
  const openButton = page.getByRole('button', { name: /open follow-up chat/i });
  await expect(openButton).toBeVisible({ timeout: 5000 });
  await openButton.click();
  await expect(page.getByRole('dialog', { name: /follow-up chat/i })).toBeVisible();
}

test.describe('Follow-up questions - Desktop @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('follow-up section appears after narrative completes', async ({ page }) => {
    await mockTarotReading(page);
    await completeReading(page);

    const followUpButton = page.getByRole('button', { name: /open chat/i });
    await expect(followUpButton).toBeVisible();
  });

  test('suggested question submits and renders response', async ({ page }) => {
    await mockAuth(page);
    await mockTarotReading(page);
    await mockFollowUp(page, { responseText: 'Mocked follow-up answer.' });
    await completeReading(page);
    await openFollowUpModal(page);

    const suggestionList = page.getByRole('list', { name: /suggested questions/i });
    const firstSuggestion = suggestionList.getByRole('button').first();
    const suggestionText = (await firstSuggestion.textContent())?.trim();

    await firstSuggestion.click();

    if (suggestionText) {
      await expect(page.getByText(suggestionText)).toBeVisible();
    }
    await expect(page.getByText('Mocked follow-up answer.')).toBeVisible();
  });

  test('free-form input submits and shows response', async ({ page }) => {
    await mockAuth(page);
    await mockTarotReading(page);
    await mockFollowUp(page, { responseText: 'Free-form response.' });
    await completeReading(page);
    await openFollowUpModal(page);

    const input = page.getByRole('textbox', { name: 'Follow-up question' });
    await input.fill('Can you clarify the main lesson?');
    await input.press('Enter');

    await expect(page.getByText('Free-form response.')).toBeVisible();
  });

  test('free tier limit disables additional questions', async ({ page }) => {
    await mockAuth(page);
    await mockTarotReading(page);
    await mockFollowUp(page, { responseText: 'First follow-up response.' });
    await completeReading(page);
    await openFollowUpModal(page);

    const input = page.getByRole('textbox', { name: 'Follow-up question' });
    await input.fill('First follow-up question.');
    await input.press('Enter');

    await expect(page.getByText('First follow-up response.')).toBeVisible();
    await expect(page.getByText(/used all 1 follow-up question/i)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Follow-up question' })).toHaveCount(0);
  });

  test('journal context toggle affects request payload for Plus users', async ({ page }) => {
    await mockAuth(page, 'plus');

    let includeJournalContext = null;
    await mockTarotReading(page);
    await mockFollowUp(page, {
      responseText: 'Journal toggle response.',
      onRequest: (body) => {
        includeJournalContext = body?.options?.includeJournalContext ?? null;
      }
    });

    await completeReading(page);
    await openFollowUpModal(page);

    const journalToggle = page.getByRole('checkbox', { name: /include insights from my journal history/i });
    await expect(journalToggle).toBeVisible();
    await journalToggle.uncheck();

    const input = page.getByRole('textbox', { name: 'Follow-up question' });
    await input.fill('Test journal toggle.');
    await input.press('Enter');

    await expect(page.getByText('Journal toggle response.')).toBeVisible();
    expect(includeJournalContext).toBe(false);
  });

  test('error states display when follow-up fails', async ({ page }) => {
    // Mock auth to enable UI buttons, but API returns 401 (simulating expired session)
    await mockAuth(page);
    await mockTarotReading(page);
    await mockFollowUp(page, { status: 401 });
    await completeReading(page);
    await openFollowUpModal(page);

    const suggestionList = page.getByRole('list', { name: /suggested questions/i });
    await suggestionList.getByRole('button').first().click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Please sign in to ask follow-up questions.');
    await expect(page.getByRole('log', { name: /conversation history/i })).toHaveCount(0);
  });

  test('SSE error events display error message to user', async ({ page }) => {
    await mockAuth(page);
    await mockTarotReading(page);

    // Mock SSE response with an error event
    await page.route('**/api/reading-followup', async (route) => {
      const metaEvent = `event: meta\ndata: ${JSON.stringify({ turn: 1, provider: 'mock' })}\n\n`;
      const errorEvent = `event: error\ndata: ${JSON.stringify({ message: 'Service temporarily unavailable' })}\n\n`;

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: metaEvent + errorEvent
      });
    });

    await completeReading(page);
    await openFollowUpModal(page);

    const input = page.getByRole('textbox', { name: 'Follow-up question' });
    await input.fill('Test SSE error handling');
    await input.press('Enter');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Service temporarily unavailable');
  });

  test('a late limit-response body cannot lock a new reading', async ({ page }) => {
    await mockAuth(page, 'pro');
    await mockTarotReading(page);
    await completeReading(page);
    // Hold only the response body after headers resolve. An aborted JSON read
    // also passes through the component's parsing fallback before this guard.
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.fetch = async (resource, options) => {
        if (resource !== '/api/reading-followup') return originalFetch(resource, options);
        window.__oldFollowupSignal = options.signal;
        return {
          ok: false,
          status: 403,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: () => new Promise(resolve => { window.__finishOldFollowup = resolve; })
        };
      };
    });
    await openFollowUpModal(page);
    const input = page.getByRole('textbox', { name: 'Follow-up question' });
    await input.fill('A question for the first reading');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => typeof window.__finishOldFollowup)).toBe('function');
    await page.getByRole('button', { name: 'Close follow-up chat' }).click();
    await page.getByRole('button', { name: 'Start a new reading and reset this spread' }).click();
    await page.getByRole('button', { name: /^Deal spread/ }).click();
    await page.getByRole('button', { name: /^Reveal next:/ }).click();
    await page.getByRole('button', { name: /^Create Personal Narrative$|^Create narrative/ }).click();
    await expect(page.locator('.narrative-stream')).toContainText(MOCK_READING_RESPONSE.reading);
    await expect.poll(() => page.evaluate(() => window.__oldFollowupSignal.aborted)).toBe(true);
    await page.evaluate(() => window.__finishOldFollowup({ message: 'The previous reading reached its limit.' }));
    await openFollowUpModal(page);
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue('');
    await expect(page.getByText('0/10 used', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('non-OK SSE response shows error from stream', async ({ page }) => {
    await mockAuth(page);
    await mockTarotReading(page);

    // Mock non-OK status but with SSE content-type containing error
    await page.route('**/api/reading-followup', async (route) => {
      const errorEvent = `event: error\ndata: ${JSON.stringify({ message: 'Rate limit exceeded, please wait' })}\n\n`;

      await route.fulfill({
        status: 503,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache' },
        body: errorEvent
      });
    });

    await completeReading(page);
    await openFollowUpModal(page);

    const input = page.getByRole('textbox', { name: 'Follow-up question' });
    await input.fill('Test non-OK SSE response');
    await input.press('Enter');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Rate limit exceeded');
  });
});

test.describe('Follow-up questions - Mobile @mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('follow-up UI remains usable on mobile', async ({ page }) => {
    await mockAuth(page);
    await mockTarotReading(page);
    await completeReading(page, 'Mobile follow-up test');

    await openFollowUpDrawer(page);

    await expect(page.getByRole('list', { name: /suggested questions/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Follow-up question' })).toBeVisible();
  });
});
