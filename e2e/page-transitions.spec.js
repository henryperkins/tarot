import { test, expect } from '@playwright/test';

// The shared suite defaults to reduced motion. Exercise real entrance animations
// here: Playwright's toBeVisible() alone also passes for an opacity-zero ancestor.
async function expectPainted(locator, minimumOpacity = 0.99) {
  await expect(locator).toBeVisible();
  await expect.poll(() => locator.evaluate(element => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  })).toBeGreaterThanOrEqual(minimumOpacity);
}

async function expectSettled(page) {
  await expectPainted(page.locator('main'));
  await expect.poll(() => page.locator('main').evaluate(main =>
    document.getAnimations().filter(animation => {
      const target = animation.effect?.target;
      return target instanceof Element && target.contains(main)
        && animation.playState !== 'finished'
        && animation.effect.getKeyframes().some(frame => frame.opacity !== undefined);
    }).length
  )).toBe(0);
}

function interruptNextPageFade(page, method) {
  return page.waitForFunction(action => {
    const main = document.querySelector('main');
    if (!main) return false;
    const fades = document.getAnimations().filter(animation => {
      const target = animation.effect?.target;
      return target instanceof Element && target.contains(main)
        && animation.playState === 'running'
        && animation.effect.getKeyframes().some(frame => frame.opacity !== undefined);
    });
    if (!fades.length) return false;
    fades.forEach(animation => animation[action]());
    return fades.length;
  }, method);
}

for (const size of [
  { name: 'desktop', viewport: { width: 1365, height: 900 } },
  { name: 'phone @mobile', viewport: { width: 390, height: 844 } }
]) {
  test.describe(`Page visibility - ${size.name}`, () => {
    test.use({ viewport: size.viewport, reducedMotion: 'no-preference', serviceWorkers: 'block' });

    test.beforeEach(async ({ page }) => {
      // These are frontend navigation tests; no account or backend is required.
      await page.route('**/api/**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}'
      }));
      await page.addInitScript(() => {
        localStorage.setItem('tarot-onboarding-complete', 'true');
        localStorage.setItem('tarot-nudge-state', JSON.stringify({
          readingCount: 1,
          hasSeenRitualNudge: true,
          hasSeenGestureCoach: true,
          hasSeenJournalNudge: true,
          journalSaveCount: 0,
          hasDismissedAccountNudge: false
        }));
      });
    });

    for (const reducedMotion of ['no-preference', 'reduce']) {
      test(`fresh load and keyboard route round trip with ${reducedMotion}`, async ({ page }, testInfo) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.emulateMedia({ reducedMotion });
        await page.goto('/');
        await expectPainted(page.getByRole('radiogroup', { name: 'Spread selection' }));
        const journal = page.getByRole('button', { name: 'Journal', exact: true });
        await journal.focus();
        await expect(journal).toBeFocused();
        await journal.press('Enter');
        await expectPainted(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true }));
        await page.getByRole('button', { name: 'Reading', exact: true }).press('Enter');
        await expectPainted(page.getByRole('radiogroup', { name: 'Spread selection' }));
        await expectSettled(page);
        await page.screenshot({ path: testInfo.outputPath(`reading-${reducedMotion}.png`) });
        expect(errors).toEqual([]);
      });
    }

    for (const interruption of ['cancel', 'pause']) {
      test(`a ${interruption === 'cancel' ? 'cancelled' : 'paused'} fade cannot hide or block the destination`, async ({ page }, testInfo) => {
        await page.goto('/');
        await expectSettled(page);
        const interrupted = interruptNextPageFade(page, interruption);
        await page.getByRole('button', { name: 'Journal', exact: true }).click();
        await interrupted;
        await expect(page).toHaveURL(/\/journal$/);
        await expectPainted(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true }), 0.95);
        await page.screenshot({ path: testInfo.outputPath(`journal-${interruption}.png`) });
        const galleryInterrupted = interruptNextPageFade(page, interruption);
        await page.getByRole('button', { name: 'Card Gallery', exact: true }).click();
        await galleryInterrupted;
        await expectPainted(page.getByRole('heading', { name: 'Card Collection', exact: true }), 0.95);
        // Even a paused decorative effect must leave navigation usable.
        await page.getByRole('button', { name: 'Reading', exact: true }).click();
        await expectPainted(page.getByRole('radiogroup', { name: 'Spread selection' }));
        await expectSettled(page);
      });
    }

    test('switching to reduced motion clears an interrupted entrance', async ({ page }) => {
      await page.goto('/');
      await expectSettled(page);
      const interrupted = interruptNextPageFade(page, 'pause');
      await page.getByRole('button', { name: 'Journal', exact: true }).click();
      await interrupted;
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expectPainted(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true }));
      await expectSettled(page);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.getByRole('button', { name: 'Reading', exact: true }).click();
      await expectPainted(page.getByRole('radiogroup', { name: 'Spread selection' }));
      await expectSettled(page);
    });

    test('rapid back and forward navigation settles on the latest route', async ({ page }) => {
      await page.goto('/');
      await expectSettled(page);
      await page.getByRole('button', { name: 'Journal', exact: true }).click();
      await expect(page).toHaveURL(/\/journal$/);
      await page.goBack();
      await page.goForward();
      await page.goBack();
      await expectPainted(page.getByRole('radiogroup', { name: 'Spread selection' }));
      await expectSettled(page);
      await page.goForward();
      await expectPainted(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true }));
      await expectSettled(page);
    });

    test('a suspended tab returns to a painted reading', async ({ page, context, browserName }, testInfo) => {
      test.skip(browserName !== 'chromium', 'Page lifecycle suspension uses Chromium CDP; other cases remain cross-browser.');
      await page.goto('/');
      await expectSettled(page);
      const session = await context.newCDPSession(page);
      const interrupted = interruptNextPageFade(page, 'pause');
      await page.getByRole('button', { name: 'Journal', exact: true }).click();
      await interrupted;
      try {
        // Playwright forces visibility, so use the actual lifecycle suspension
        // API rather than pretending a second test tab backgrounds this one.
        await session.send('Page.setWebLifecycleState', { state: 'frozen' });
        await session.send('Page.setWebLifecycleState', { state: 'active' });
        await expectPainted(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true }), 0.95);
        await page.screenshot({ path: testInfo.outputPath('journal-resumed.png') });
        await page.getByRole('button', { name: 'Reading', exact: true }).click();
        await expectPainted(page.getByRole('radiogroup', { name: 'Spread selection' }));
      } finally {
        await session.send('Page.setWebLifecycleState', { state: 'active' });
        await session.detach();
      }
    });
  });
}
