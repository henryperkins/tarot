import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, startReading } from './helpers/narrativeFixtures.js';

// Phone overlays, gestures and safe areas (2026-10-19 mobile verification):
// Back (the Android button or gesture, the iOS edge swipe) closes the open
// layer instead of leaving the reading, a page opened from a dialog takes the
// dialog's place in history, card swipes leave scrolling alone, toasts clear
// the safe areas and carousels keep their swipes.

const studio = page => page.locator('[role="dialog"][aria-labelledby="visual-companion-modal-title"]');
const cardDetail = page => page.locator('[role="dialog"][aria-labelledby^="card-modal-title"]');

// A second entry stands in for wherever the reader came from: Back past the
// reading lands there, so an overlay's Back must not.
async function readingWithHistory(page, fixture, options = {}) {
  await openSetup(page);
  await page.goto('/?from=back-test');
  await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
  await startReading(page, fixture, { setup: false, ...options });
}

async function openStudio(page) {
  const explore = page.locator('summary', { hasText: 'Explore this reading' });
  if (await explore.locator('xpath=..').getAttribute('open') === null) await explore.click();
  const opener = page.getByRole('button', { name: 'Open visual studio', exact: true });
  await opener.click();
  await expect(studio(page)).toBeVisible();
  return opener;
}

// Whether the current history entry belongs to open overlays. Closing the
// last one removes it a moment later; Back closing an inner layer restores it.
const overlayEntryIsCurrent = page => page.evaluate(() => Boolean(history.state?.tableuOverlayGuard));

async function openSymbolSheet(page) {
  await page.getByRole('button', { name: /^Past — .*Open card$/ }).click();
  await expect(cardDetail(page)).toBeVisible();
  await cardDetail(page).getByRole('button', { name: /^Symbols/ }).click();
  const opener = cardDetail(page).getByRole('button', { name: 'Card symbols', exact: true });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Card symbol insights' });
  await expect(sheet).toBeVisible();
  return { sheet, opener };
}

async function expectPageScrolls(page) {
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed');
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => window.scrollBy(0, 200));
  await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(before);
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Phone overlays and Back — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page, { signedOut: true });
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    test('Back closes the visual studio and keeps the reading', async ({ page }) => {
      await readingWithHistory(page, fixture);
      const opener = await openStudio(page);
      await page.goBack();
      await expect(studio(page)).toBeHidden();
      await expect(page).toHaveURL(/from=back-test/);
      await expect(page.locator('.narrative-stream')).toBeVisible();

      // Closed with its own button, it leaves no Back press behind.
      await opener.click();
      await expect(studio(page)).toBeVisible();
      await page.getByRole('button', { name: 'Close visual companion studio' }).click();
      await expect(studio(page)).toBeHidden();
      await expect.poll(() => overlayEntryIsCurrent(page)).toBe(false);
      await page.goBack();
      await expect(page).not.toHaveURL(/from=back-test/);
    });

    test('Back closes "Your question and notes" on the error screen', async ({ page }) => {
      await readingWithHistory(page, fixture, { complete: false });
      await fixture.emit('reading', 'error', { message: 'The reading provider failed. Please try again.' });
      const opener = page.getByRole('button', { name: 'Your question and notes', exact: true });
      const dialog = page.getByRole('dialog', { name: 'Your question and notes', exact: true });
      await opener.click();
      await expect(dialog).toBeVisible();
      await page.goBack();
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/from=back-test/);

      // The backdrop still closes it, without leaving a Back press behind.
      await opener.click();
      await expect(dialog).toBeVisible();
      await page.mouse.click(4, 4);
      await expect(dialog).toBeHidden();
      await expect.poll(() => overlayEntryIsCurrent(page)).toBe(false);
      await page.goBack();
      await expect(page).not.toHaveURL(/from=back-test/);
    });

    test('Back closes the symbol sheet before its card, and the reading still scrolls', async ({ page }) => {
      await readingWithHistory(page, fixture);
      const { sheet } = await openSymbolSheet(page);

      await page.goBack();
      await expect(sheet).toBeHidden();
      await expect(cardDetail(page)).toBeVisible();
      await expect.poll(() => overlayEntryIsCurrent(page)).toBe(true);
      await page.goBack();
      await expect(cardDetail(page)).toBeHidden();
      await expect(page).toHaveURL(/from=back-test/);
      await expectPageScrolls(page);
    });

    test('Escape closes the symbol sheet before its card, and the reading still scrolls', async ({ page }) => {
      await startReading(page, fixture);
      const { sheet, opener } = await openSymbolSheet(page);
      await expect(sheet).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(cardDetail(page)).toBeVisible();
      await expect(opener).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(cardDetail(page)).toBeHidden();
      await expectPageScrolls(page);
    });

    test('Back closes the template library before the coach', async ({ page }) => {
      await openSetup(page);
      await page.goto('/?from=back-test');
      await page.getByRole('button', { name: /^Open guided (?:intention )?coach/ }).filter({ visible: true }).first().click();
      const coach = page.getByRole('dialog', { name: 'Shape a question with clarity' });
      await expect(coach).toBeVisible();
      await coach.getByRole('button', { name: 'Templates', exact: true }).click();
      const library = page.getByRole('dialog', { name: 'Template library' });
      await expect(library).toBeVisible();

      await page.goBack();
      await expect(library).toHaveCount(0);
      await expect(coach).toBeVisible();
      await expect.poll(() => overlayEntryIsCurrent(page)).toBe(true);
      await page.goBack();
      await expect(coach).toBeHidden();
      await expect(page).toHaveURL(/from=back-test/);
      // The coach replaced its loading placeholder without stranding an entry.
      await page.goBack();
      await expect(page).not.toHaveURL(/from=back-test/);
    });

    test('Back from a page opened inside a dialog returns to the page behind it', async ({ page }) => {
      const question = 'What is asking for my attention this week?';
      await page.addInitScript(seed => {
        localStorage.setItem('tarot_coach_history_anon', JSON.stringify([{ id: 'question-back-test', question: seed, createdAt: Date.now() }]));
      }, question);
      await openSetup(page, { url: '/?from=back-test' });
      await page.goto('/journal');
      const journal = page.getByRole('heading', { name: 'Your Tarot Journal', level: 1 });
      await expect(journal).toBeVisible();

      // Saved Intentions, then its confirmation, then a new reading.
      await page.getByRole('button', { name: 'Saved Intentions', exact: true }).click();
      await page.getByRole('button', { name: `Use suggestion: ${question}` }).click();
      await page.getByRole('dialog', { name: 'Use this intention?' }).getByRole('button', { name: 'Start Reading' }).click();
      await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();

      await page.goBack();
      await expect(journal).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/from=back-test/);
    });

    test('Back from a sign-in provider returns to the page behind the dialog', async ({ page }) => {
      // The provider is any other document; the static privacy page stands in.
      await page.route('**/api/auth/oauth-start', route => route.fulfill({ json: { authorizeUrl: '/privacy.html?from=oauth-test' } }));
      await openSetup(page);
      await page.goto('/?from=back-test');
      await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
      await page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Continue with Google', exact: true }).click();
      await expect(page).toHaveURL(/from=oauth-test/);

      await page.goBack();
      await expect(page).toHaveURL(/from=back-test/);
      await page.goBack();
      await expect(page).not.toHaveURL(/from=back-test/);
    });

    test('carousels keep a swipe that runs past their ends', async ({ page }) => {
      await openSetup(page);
      await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toHaveCSS('overscroll-behavior-x', 'contain');
      await expect(page.getByRole('navigation', { name: 'Tarot reading progress' }).getByRole('list'))
        .toHaveCSS('overscroll-behavior-x', 'contain');
    });

    test.describe('in landscape', () => {
      test.use({ hasTouch: true, isMobile: true });

      test('Back closes a card on a phone held sideways', async ({ page }) => {
        await readingWithHistory(page, fixture);
        // Sideways, a phone is wider than the small-screen breakpoint but is
        // still a handset with a Back gesture.
        await page.setViewportSize({ width: 844, height: 390 });
        await page.getByRole('button', { name: /^Past — .*Open card$/ }).click();
        await expect(cardDetail(page)).toBeVisible();
        await page.goBack();
        await expect(cardDetail(page)).toBeHidden();
        await expect(page).toHaveURL(/from=back-test/);
      });
    });
  });
}

test.describe('Phone card gestures and safe areas — Chromium', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  let fixture;

  test.beforeEach(async ({ page }) => {
    fixture = await createNarrativeFixture(page, { signedOut: true });
  });

  test.afterEach(async () => {
    await fixture.close();
  });

  test('scrolling a card never changes it; a deliberate swipe does', async ({ page }) => {
    await startReading(page, fixture);
    await page.getByRole('button', { name: /^Present — .*Open card$/ }).click();
    const title = cardDetail(page).locator('[id^="card-modal-title"]');
    const first = await title.textContent();
    const cdp = await page.context().newCDPSession(page);
    const flick = async (x, y, dx, dy, duration = 90) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 6; step += 1) {
        await page.waitForTimeout(duration / 6);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(400);
    };

    // A quick scroll that drifts sideways, either way.
    await flick(260, 560, -70, -260);
    await expect(title).toHaveText(first);
    await flick(150, 300, 60, 240, 120);
    await expect(title).toHaveText(first);
    // A swipe from the screen edge (on the card, inside the edge zone) belongs
    // to the browser's Back gesture.
    await flick(20, 420, 140, 0);
    await expect(title).toHaveText(first);
    await flick(300, 420, -140, -10);
    await expect(title).not.toHaveText(first);
  });

  test('toasts clear the status bar and notch', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } });
    await openSetup(page);
    const stack = page.locator('div.pointer-events-none.z-toast');
    await expect(stack).toHaveCSS('top', '59px');

    await page.getByRole('button', { name: 'Open reading preparation', exact: true }).click();
    await page.getByRole('tab', { name: /Ritual/ }).or(page.getByRole('button', { name: /^Ritual/ })).first().click();
    await page.getByRole('button', { name: /^Confirm cut at position/ }).click();
    const toast = stack.getByText('Cut confirmed');
    await expect(toast).toBeVisible();
    expect((await toast.boundingBox()).y).toBeGreaterThanOrEqual(59);
  });
});
