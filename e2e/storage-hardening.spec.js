import { test, expect } from '@playwright/test';

async function stubLocalApis(page) {
  await page.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    return pathname === '/api/auth/me'
      ? route.fulfill({ status: 401, json: { user: null } })
      : route.fulfill({ json: { entries: [], items: [], memories: [] } });
  });
}

for (const fault of ['getItem-denied', 'setItem-full', 'localStorage-getter-denied', 'sessionStorage-getter-denied']) {
  test(`optional storage failure preserves settings and a usable reading: ${fault}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await stubLocalApis(page);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(storageFault => {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      localStorage.setItem('tarot-nudge-state', JSON.stringify({
        readingCount: 2, hasSeenGestureCoach: true, hasSeenRitualNudge: true
      }));
      if (storageFault === 'getItem-denied') {
        Object.defineProperty(Storage.prototype, 'getItem', {
          configurable: true,
          value() { throw new DOMException('Test storage access denied', 'SecurityError'); }
        });
      } else if (storageFault === 'setItem-full') {
        Object.defineProperty(Storage.prototype, 'setItem', {
          configurable: true,
          value() { throw new DOMException('Test storage quota exhausted', 'QuotaExceededError'); }
        });
      } else {
        const property = storageFault.startsWith('local') ? 'localStorage' : 'sessionStorage';
        Object.defineProperty(window, property, {
          configurable: true,
          get() { throw new DOMException('Test storage property access denied', 'SecurityError'); }
        });
      }
    }, fault);

    await page.goto('/account');
    const theme = page.getByRole('radiogroup', { name: 'Theme', exact: true });
    await expect(theme).toBeVisible();
    await theme.getByText('Light', { exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    // A route change keeps the live preference even when no storage read/write
    // can retain it. A full page reload intentionally falls back to defaults.
    await page.getByRole('button', { name: 'Reading', exact: true }).first().click();
    if (fault === 'getItem-denied' || fault === 'localStorage-getter-denied') {
      await page.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
    }
    await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    const question = 'How can I make room for rest?';
    await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(question);
    await page.getByRole('button', { name: 'Draw cards', exact: true }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: 'Reveal all cards', exact: true }).filter({ visible: true }).first().click();
    await expect(page.locator('.reading-table__meaning')).toBeVisible();
    await expect(page.locator('.reading-table__question')).toHaveText(question);
    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    expect(pageErrors).toEqual([]);
  });
}

test('quota-failed personalization survives same-owner auth refresh and reloads for a new owner', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install();
  let owner = 'storage-owner-a';
  let authRequests = 0;
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route(/https:\/\/[^/]*sentry\.io\//, route => route.fulfill({ json: {} }));
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/me') {
      authRequests += 1;
      return route.fulfill({ json: { user: {
        id: owner, username: owner, email: `${owner}@example.invalid`,
        email_verified: true, subscription_tier: 'pro', subscription_status: 'active'
      } } });
    }
    if (pathname === '/api/subscription') {
      return route.fulfill({ json: { subscription: { tier: 'pro', status: 'active', provider: 'stripe' } } });
    }
    return route.fulfill({ json: { entries: [], memories: [], cards: [], enabled: false, usage: {} } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-personalization:storage-owner-a', JSON.stringify({ displayName: 'Stored Reader', readingTone: 'gentle' }));
    localStorage.setItem('tarot-personalization:storage-owner-b', JSON.stringify({ displayName: 'Other Reader', readingTone: 'balanced' }));
    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      value() { throw new DOMException('Test storage quota exhausted', 'QuotaExceededError'); }
    });
  });

  const replayTutorial = async () => {
    await page.getByRole('button', { name: 'Replay Tutorial', exact: true }).click();
    await page.getByRole('dialog', { name: 'Replay tutorial?', exact: true })
      .getByRole('button', { name: 'Replay tutorial', exact: true }).click();
    await expect(page.locator('#welcome-name')).toBeVisible();
  };
  const returnToAccount = async () => {
    await page.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
    await page.getByRole('button', { name: `User menu for ${owner}`, exact: true }).filter({ visible: true }).first().click();
    await page.getByRole('link', { name: 'Account & Settings', exact: true }).click();
    await expect(page.locator('#profile')).toBeVisible();
  };
  const refreshAuth = async () => {
    const previousRequests = authRequests;
    // Exercise AccountPage's real periodic checkAuth without waiting a minute.
    await page.clock.fastForward(61000);
    await expect.poll(() => authRequests).toBeGreaterThan(previousRequests);
    await expect(page.locator('#profile')).toContainText(owner);
  };

  await page.goto('/account');
  await expect(page.locator('#profile')).toContainText(owner);
  await replayTutorial();
  await expect(page.locator('#welcome-name')).toHaveValue('Stored Reader');
  const liveName = 'Live Reader 安心';
  await page.locator('#welcome-name').fill(liveName);
  await page.getByRole('button', { name: /^Blunt\b/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await returnToAccount();
  await refreshAuth();
  await replayTutorial();
  await expect(page.locator('#welcome-name')).toHaveValue(liveName);
  await expect(page.getByRole('button', { name: /^Blunt\b/ })).toHaveAttribute('aria-pressed', 'true');

  await returnToAccount();
  owner = 'storage-owner-b';
  await refreshAuth();
  await replayTutorial();
  await expect(page.locator('#welcome-name')).toHaveValue('Other Reader');
  await expect(page.getByRole('button', { name: /^Balanced\b/ })).toHaveAttribute('aria-pressed', 'true');
  expect(pageErrors).toEqual([]);
});
