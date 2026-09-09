import { test, expect } from '@playwright/test';

/**
 * Reading Visual Modals E2E Tests
 *
 * The Visual Companion Studio and the Recent media gallery are collapsed into
 * compact trigger cards on the completed reading page. Each opens a dialog so
 * the reading surface stays uncluttered.
 */

const MOCK_NARRATIVE_RESPONSE = {
  reading: 'Mock narrative response for visual modal checks.',
  provider: 'mock',
  requestId: 'mock-visual-modal-request',
  themes: {
    elementCounts: { fire: 1, water: 1, air: 1, earth: 1 },
    reversalCount: 0
  }
};

const MOCK_MEDIA_ITEMS = [
  {
    id: 'media-1',
    mediaType: 'image',
    source: 'story-art',
    title: 'Story illustration',
    styleId: 'watercolor',
    createdAt: 1757376000000,
    contentUrl: 'https://example.invalid/media/story-art.jpg',
    downloadUrl: 'https://example.invalid/media/story-art.jpg'
  }
];

function getTestSetupScript() {
  return () => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 1,
      hasSeenRitualNudge: true,
      hasSeenGestureCoach: true,
      hasSeenJournalNudge: true,
      journalSaveCount: 0,
      hasDismissedAccountNudge: false
    }));
    sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
      intention: false,
      experience: false,
      ritual: true,
      audio: false
    }));
  };
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

async function mockMediaLibrary(page, items = MOCK_MEDIA_ITEMS) {
  await page.route(/\/api\/media(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        media: items,
        pagination: {
          limit: items.length,
          offset: 0,
          total: items.length,
          hasMore: false,
          nextOffset: items.length
        }
      })
    });
  });
}

async function mockTarotReading(page, overrides = {}) {
  const responseBody = { ...MOCK_NARRATIVE_RESPONSE, ...overrides };
  const jobId = 'mock-reading-job';
  const jobToken = 'mock-reading-token';
  const { provider, requestId, themes } = responseBody;
  const readingText = responseBody.reading;

  await page.route(/\/api\/tarot-reading\/jobs$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobId, jobToken })
    });
  });

  await page.route(/\/api\/tarot-reading\/jobs\/[^/?]+\/stream(?:\?.*)?$/, async (route) => {
    const metaEvent = `event: meta\ndata: ${JSON.stringify({ provider, requestId, themes, eventId: 1 })}\n\n`;
    const doneEvent = `event: done\ndata: ${JSON.stringify({ fullText: readingText, provider, requestId, eventId: 2 })}\n\n`;
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
      body: `${metaEvent}${doneEvent}`
    });
  });

  await page.route(/\/api\/tarot-reading\/jobs\/[^/?]+\/cancel(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'cancelled' })
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
  await spreadButton.scrollIntoViewIfNeeded();
  await spreadButton.click({ force: true });
  await expect(spreadButton).toHaveAttribute('aria-checked', 'true');
}

async function drawCards(page) {
  // Preparation panel hands off to the reading stage...
  const drawButton = page.getByRole('button', { name: /^draw cards$/i }).first();
  await expect(drawButton).toBeVisible({ timeout: 15000 });
  await drawButton.scrollIntoViewIfNeeded();
  await drawButton.click({ force: true });

  // ...where the ritual deck deals the spread.
  const dealButton = page.getByRole('button', { name: /deal the cards/i }).first();
  await expect(dealButton).toBeVisible({ timeout: 15000 });
  await dealButton.click({ force: true });
}

async function waitForCardsDealt(page) {
  const revealPrompt = page.locator('[aria-label*="Tap to reveal"], [aria-label*="Click to reveal"]');
  const revealedCard = page.locator('[aria-label*="position. Click to view details" i]');

  await expect(async () => {
    const pending = await revealPrompt.count();
    const revealed = await revealedCard.count();
    expect(pending + revealed).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 15000 });

  // Some builds deal face-down; reveal anything still waiting on a tap.
  const pending = await revealPrompt.count();
  for (let index = 0; index < pending; index += 1) {
    await revealPrompt.nth(index).click({ force: true });
    await page.waitForTimeout(300);
  }
}

async function generateNarrative(page) {
  const generateButton = page
    .getByRole('button', { name: /generate|create.*narrative|get.*reading|receive.*reading/i })
    .first();
  await expect(generateButton).toBeVisible({ timeout: 15000 });
  await generateButton.click({ force: true });
}

async function waitForNarrativeComplete(page) {
  await expect(async () => {
    const skeleton = page.locator('[aria-label="Generating your personalized narrative"]');
    expect(await skeleton.isVisible().catch(() => false)).toBe(false);
  }).toPass({ timeout: 30000 });

  const skipButton = page.getByRole('button', { name: /show all now/i });
  if (await skipButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await skipButton.click({ force: true });
  }

  await expect(page.locator('.narrative-stream').first()).toBeVisible({ timeout: 5000 });
}

async function completeReading(page) {
  await selectSpread(page, 'One-Card');
  const questionInput = page.locator('textarea').first();
  await questionInput.fill('What should I notice this week?');
  await drawCards(page);
  await waitForCardsDealt(page);
  await mockTarotReading(page);
  await generateNarrative(page);
  await waitForNarrativeComplete(page);
}

test.describe('Reading visual modals @desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(getTestSetupScript());
  });

  test('visual companion collapses to a trigger that opens a dialog', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await completeReading(page);

    const trigger = page.getByRole('button', { name: /open visual studio/i });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // A CSS locator, not getByRole: getByRole never matches inside an
    // aria-hidden subtree, so it would report "hidden" even if the panel were
    // painted and clickable. This asserts real CSS visibility.
    const dialog = page.locator('[role="dialog"][aria-labelledby="visual-companion-modal-title"]');
    await expect(dialog).toHaveCount(1);
    await expect(dialog).toBeHidden();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The studio's actual content, not just the dialog shell's own title.
    await expect(dialog.getByRole('heading', { name: /narrative illustration/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('studio keeps its focus trap after a nested prompt is dismissed', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await completeReading(page);

    const dialog = page.locator('[role="dialog"][aria-labelledby="visual-companion-modal-title"]');
    await page.getByRole('button', { name: /open visual studio/i }).click();
    await expect(dialog).toBeVisible();

    // Free tier: the illustration module renders a tier upsell whose button
    // raises StoryIllustration's showUpgrade. That must not make the studio
    // stand down unless an upgrade dialog is actually on screen.
    const upgradeCta = dialog.getByRole('button', { name: /upgrade to plus/i });
    await expect(upgradeCta).toBeVisible();
    await upgradeCta.click();
    // Nothing visible changes when this is correct, so settle before asserting;
    // otherwise toHaveAttribute passes on its first check, before any
    // nested-overlay state could have propagated.
    await page.waitForTimeout(500);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Escape must still close the studio.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Reopening must not come back degraded.
    await page.getByRole('button', { name: /open visual studio/i }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('recent media collapses to a trigger that opens a dialog', async ({ page }) => {
    await mockAuth(page, 'plus');
    await mockMediaLibrary(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await completeReading(page);

    const trigger = page.getByRole('button', { name: /view recent media/i });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    // The gallery list must not be on the page until the dialog is opened.
    await expect(page.getByRole('link', { name: /open story illustration/i })).toHaveCount(0);

    await trigger.click();
    const dialog = page.locator('[role="dialog"][aria-labelledby="reading-media-modal-title"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: /open story illustration/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /refresh/i })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
