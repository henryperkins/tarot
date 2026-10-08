import { test, expect } from '@playwright/test';

const READER = {
  id: 'effect-state-reader', username: 'Reader', email: 'reader@example.invalid',
  email_verified: false, subscription_tier: 'pro', subscription_status: 'active'
};

async function prepare(page, user = null, entries = []) {
  let currentUser = user;
  await page.addInitScript(entries => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot_journal', JSON.stringify(entries));
  }, entries);
  await page.route(/https:\/\/[^/]*sentry\.io\//, route => route.fulfill({ json: {} }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: currentUser ? 200 : 401, json: { user: currentUser } });
    if (path === '/api/subscription') return route.fulfill({ json: { subscription: { tier: currentUser?.subscription_tier, status: 'active' } } });
    if (path === '/api/archetype-journey/preferences') return route.fulfill({ json: { preferences: { archetype_journey_enabled: false } } });
    if (path === '/api/usage') return route.fulfill({ json: { trackingAvailable: true, readings: { used: 2, limit: 10, source: 'fixture' } } });
    return route.fulfill({ json: { success: true, entries: [], cards: [], items: [] } });
  });
  return { setUser: user => { currentUser = user; } };
}

function journalEntries(count = 15) {
  return Array.from({ length: count }, (_, index) => ({
    id: `effect-entry-${index}`, ts: Date.now() - index * 60000,
    spread: 'Single Card', spreadKey: 'single', question: `Reflection ${index + 1}`,
    cards: [{ name: 'The Fool', position: 'Present', orientation: 'Upright' }],
    personalReading: `Reflection ${index + 1}`
  }));
}

async function changeQuery(page, path) {
  await page.evaluate(path => {
    history.pushState(history.state, '', path);
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }, path);
}

test.describe('State ownership through effects', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });

  test('filter changes reset an expanded journal batch and clearing restores the first batch', async ({ page }) => {
    await prepare(page, null, journalEntries());
    await page.goto('/journal');
    const entries = page.locator('[id^="journal-entry-effect-entry-"]');
    await expect(entries).toHaveCount(10);
    await page.getByRole('button', { name: 'Load 5 more', exact: true }).click();
    await expect(entries).toHaveCount(15);
    const search = page.getByPlaceholder('Search readings...');
    await search.fill('Reflection 15');
    await expect(entries).toHaveCount(1);
    await search.fill('');
    await expect(entries).toHaveCount(10);
  });

  test('a deep-linked entry beyond the first batch stays rendered after its highlight expires', async ({ page }) => {
    await prepare(page, null, journalEntries());
    await page.addInitScript(() => {
      history.replaceState({ usr: { highlightEntryId: 'effect-entry-14' }, key: 'entry-highlight', idx: 0 }, '');
    });
    await page.goto('/journal');
    const entry = page.locator('#journal-entry-effect-entry-14');
    await expect(entry).toBeInViewport();
    await expect(entry).toHaveClass(/ring-primary\/35/);
    await expect(page.locator('[id^="journal-entry-effect-entry-"]')).toHaveCount(15);
    await expect.poll(() => page.evaluate(() => history.state?.usr ?? null)).toBe(null);
    // The highlight's existing 3.2s expiry must not shrink its retained batch.
    await expect(entry).not.toHaveClass(/ring-primary\/35/, { timeout: 5000 });
    await expect(entry).toBeAttached();
  });

  test('account preference and usage errors retry explicitly without restarting failed requests', async ({ page }) => {
    await prepare(page, READER);
    let preferenceRequests = 0;
    let usageRequests = 0;
    let preferencesRecover = false;
    let usageRecovers = false;
    await page.route('**/api/archetype-journey/preferences', route => {
      preferenceRequests += 1;
      return route.fulfill(!preferencesRecover
        ? { status: 503, json: { error: 'Unavailable' } }
        : { json: { preferences: { archetype_journey_enabled: true } } });
    });
    await page.route('**/api/usage', route => {
      usageRequests += 1;
      return route.fulfill(!usageRecovers
        ? { status: 503, json: { error: 'Usage unavailable' } }
        : { json: { trackingAvailable: true, readings: { used: 2, limit: 10, source: 'fixture' } } });
    });
    await page.goto('/account');
    await expect(page.locator('#analytics')).toContainText('Could not load preference. Retry.');
    await expect(page.locator('#subscription')).toContainText('Usage unavailable');
    // StrictMode may start and cancel an initial request. Failed responses must
    // settle instead of triggering another automatic fetch on every render.
    const initialPreferenceRequests = preferenceRequests;
    const initialUsageRequests = usageRequests;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(preferenceRequests).toBe(initialPreferenceRequests);
    expect(usageRequests).toBe(initialUsageRequests);
    preferencesRecover = true;
    await page.locator('#analytics').getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Toggle Archetype Journey', exact: true })).toHaveAttribute('aria-checked', 'true');
    usageRecovers = true;
    await page.locator('#subscription').getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.locator('#subscription')).not.toContainText('Usage unavailable');
    expect(preferenceRequests).toBe(initialPreferenceRequests + 1);
    expect(usageRequests).toBe(initialUsageRequests + 1);
  });

  test('profile refresh updates its form and verification resend uses the refreshed email once', async ({ page }) => {
    const auth = await prepare(page, READER);
    await page.route('**/api/account/profile', route => {
      const updates = route.request().postDataJSON();
      auth.setUser({ ...READER, ...updates });
      return route.fulfill({ json: { success: true } });
    });
    const resendRequests = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/auth/verify-email/resend', async route => {
      resendRequests.push(route.request().postDataJSON());
      await gate;
      await route.fulfill({ json: { success: true } });
    });
    try {
      await page.goto('/account');
      await page.locator('#profile').getByRole('button', { name: 'Edit', exact: true }).click();
      await page.getByLabel('Email', { exact: true }).fill('refreshed@example.invalid');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(page.getByLabel('Email', { exact: true })).toHaveValue('refreshed@example.invalid');
      await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Resend verification', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Sending...', exact: true })).toBeDisabled();
      expect(resendRequests).toEqual([{ email: 'refreshed@example.invalid' }]);
      release();
      await expect(page.getByText('Check refreshed@example.invalid for a fresh link.', { exact: true })).toBeVisible();
      expect(resendRequests).toHaveLength(1);
    } finally {
      release();
    }
  });

  test('obsolete gallery statistics cannot overwrite the next account collection', async ({ page }) => {
    const auth = await prepare(page, READER);
    let release;
    let oldRequested = false;
    let oldCompleted = false;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/archetype-journey/card-frequency', async route => {
      if (!oldRequested) {
        oldRequested = true;
        await gate;
        await route.fulfill({ json: { cards: [{ card_name: 'The Fool', total_count: 99 }] } }).catch(() => {});
        oldCompleted = true;
        return;
      }
      await route.fulfill({ json: { cards: [{ card_name: 'The Magician', total_count: 2 }] } });
    });
    try {
      await page.goto('/journal/gallery');
      await expect.poll(() => oldRequested).toBe(true);
      auth.setUser({ ...READER, id: 'next-reader', email: 'next@example.invalid' });
      // Exercise AuthProvider's normal auth-check transition without remounting
      // this route, so the old collection request remains the competing work.
      await page.evaluate(async () => {
        dispatchEvent(new CustomEvent('tableau:route-change', { detail: { pathname: '/design' } }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        dispatchEvent(new CustomEvent('tableau:route-change', { detail: { pathname: '/journal/gallery' } }));
      });
      await expect(page.locator('[aria-label="Card The Magician"]')).toContainText('2x');
      release();
      await expect.poll(() => oldCompleted).toBe(true);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(page.locator('[aria-label="Card The Fool"]')).toHaveCount(0);
      await expect(page.locator('[aria-label="Card The Magician"]')).toContainText('2x');
    } finally {
      release();
    }
  });

  test('missing tokens fail immediately and obsolete verification responses cannot replace a newer result', async ({ page }) => {
    await prepare(page);
    let release;
    let oldRequested = false;
    let oldCompleted = false;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/auth/verify-email?token=*', async route => {
      const token = new URL(route.request().url()).searchParams.get('token');
      if (token === 'old-link') {
        oldRequested = true;
        await gate;
        await route.fulfill({ status: 400, json: { error: 'invalid_or_expired_token' } }).catch(() => {});
        oldCompleted = true;
      } else {
        await route.fulfill({ json: { success: true } });
      }
    });
    try {
      await page.goto('/verify-email');
      const status = page.locator('main').getByRole('status');
      await expect(status).toContainText('Verification link is missing a token.');
      expect(oldRequested).toBe(false);
      await changeQuery(page, '/verify-email?token=old-link');
      await expect.poll(() => oldRequested).toBe(true);
      await expect(status).toContainText('Checking your link...');
      await changeQuery(page, '/verify-email?token=new-link');
      await expect(status).toContainText('Email verified');
      release();
      await expect.poll(() => oldCompleted).toBe(true);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(status).toContainText('Email verified');
      await expect(status).not.toContainText('expired');
    } finally {
      release();
    }
  });
});
