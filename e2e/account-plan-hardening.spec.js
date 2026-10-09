import { test, expect } from './helpers/frontendTest.js';

// These account and billing states are scoped API fixtures, not real authentication.
async function prepare(page, { tier = null, status = 'active' } = {}) {
  const checkoutRequests = [];
  await page.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
  await page.addInitScript(() => {
    localStorage.setItem('tarot-theme', 'light');
    localStorage.setItem('tarot-onboarding-complete', 'true');
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({ status: tier ? 200 : 401, json: { user: tier ? {
        id: 'plan-hardening-fixture', username: 'Reader', email: 'reader@example.invalid',
        email_verified: true, subscription_tier: tier, subscription_status: status,
        subscription_provider: 'stripe'
      } : null } });
    }
    if (path === '/api/create-checkout-session') {
      checkoutRequests.push(route.request().postDataJSON());
      return route.fulfill({ status: 503, json: { error: 'Mock checkout stopped before billing.' } });
    }
    if (path === '/api/subscription') {
      return route.fulfill({ json: { subscription: { tier, status, provider: 'stripe' } } });
    }
    if (path === '/api/usage') {
      return route.fulfill({ json: {
        trackingAvailable: true, resetAt: '2026-11-01T00:00:00Z',
        readings: { source: 'fixture', used: 0, unlimited: true },
        tts: { used: 0, unlimited: true },
        apiCalls: { used: 0, limit: 1000, remaining: 1000 }
      } });
    }
    return route.fulfill({ json: { entries: [], memories: [], cards: [], enabled: false } });
  });
  return checkoutRequests;
}

async function enlargeText(page) {
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.evaluate(() => document.fonts.ready);
}

async function expectNoHorizontalOverflow(page, width) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test.describe('Account and plan hardening', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

  test('guest section navigation only offers existing settings targets', async ({ page }) => {
    await prepare(page);
    await page.goto('/account');
    const sections = page.getByRole('navigation', { name: 'Jump to section' });
    await expect(sections).toBeVisible();
    await expect(sections.getByRole('link', { name: 'Profile', exact: true })).toHaveCount(0);
    const links = await sections.getByRole('link').all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const target = page.locator(await link.getAttribute('href'));
      await expect(target).toHaveCount(1);
      await link.click();
      await expect(target.locator('[data-section-heading]')).toBeFocused();
    }
  });

  test('theme radio arrows select and focus one tab stop, including wrap and endpoints', async ({ page }) => {
    await prepare(page);
    await page.goto('/account');
    const light = page.getByRole('radio', { name: 'Light', exact: true });
    const dark = page.getByRole('radio', { name: 'Dark', exact: true });
    await light.focus();
    for (const [key, selected, other] of [
      ['ArrowRight', dark, light], ['ArrowDown', light, dark],
      ['ArrowLeft', dark, light], ['Home', light, dark], ['End', dark, light]
    ]) {
      await page.keyboard.press(key);
      await expect(selected).toBeFocused();
      await expect(selected).toHaveAttribute('aria-checked', 'true');
      await expect(selected).toHaveAttribute('tabindex', '0');
      await expect(other).toHaveAttribute('aria-checked', 'false');
      await expect(other).toHaveAttribute('tabindex', '-1');
    }
    await page.keyboard.press('Tab');
    expect(await page.getByRole('radiogroup', { name: 'Theme' }).evaluate(element => element.contains(document.activeElement))).toBe(false);
  });

  for (const width of [320, 390]) {
    test(`Pro subscription text remains inside its card at ${width}px and 200% root text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page, { tier: 'pro' });
      await page.goto('/account');
      const subscription = page.locator('#subscription');
      await expect(subscription.getByText('Unlimited AI readings/month', { exact: true })).toBeVisible();
      await enlargeText(page);
      await expectNoHorizontalOverflow(page, width);
      const clippedText = await subscription.evaluate(card => {
        const bounds = card.getBoundingClientRect();
        return [...card.querySelectorAll('p, li, span')].filter(element => {
          if (!element.textContent.trim()) return false;
          const rect = element.getBoundingClientRect();
          return rect.right > bounds.right + 1 || rect.left < bounds.left - 1
            || element.scrollWidth > element.clientWidth + 1;
        }).map(element => element.textContent.trim());
      });
      expect(clippedText, 'Plan labels, limits and usage must remain readable, even when the card hides overflow').toEqual([]);
    });

    test(`gallery filters fit and remain operable at ${width}px and 200% root text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page, { tier: 'pro' });
      await page.goto('/journal/gallery');
      await expect(page.getByRole('heading', { name: 'Your collection starts with a saved reading', exact: true })).toBeVisible();
      await enlargeText(page);
      await expectNoHorizontalOverflow(page, width);
      const title = page.getByRole('heading', { name: 'Card Collection', exact: true });
      expect(await title.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const cards = page.locator('[aria-label$="(not yet discovered)"]');
      await expect(cards.first()).toBeVisible();
      const clippedLabels = await cards.evaluateAll(elements => elements.flatMap(card => {
        const bounds = card.getBoundingClientRect();
        const frameOverflows = card.scrollWidth > card.clientWidth + 1 || card.scrollHeight > card.clientHeight + 1;
        const outsideFrame = rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1
          || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1;
        return [...card.querySelectorAll('p')].filter(label => {
          const text = document.createRange();
          text.selectNodeContents(label);
          return frameOverflows || outsideFrame(label.getBoundingClientRect())
            || [...text.getClientRects()].some(outsideFrame);
        }).map(label => label.textContent.trim());
      }));
      expect(clippedLabels, 'Card names must stay fully readable inside their frames').toEqual([]);
      const missing = page.getByRole('button', { name: 'Missing', exact: true });
      for (const control of [missing, page.getByLabel('Sort cards by', { exact: true })]) {
        const rect = await control.boundingBox();
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      }
      await missing.focus();
      await missing.press('Enter');
      await expect(missing).toHaveAttribute('aria-pressed', 'true');
    });

    test(`pricing fits at ${width}px and 200% root text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page, { tier: 'pro' });
      await page.goto('/pricing');
      await enlargeText(page);
      await expectNoHorizontalOverflow(page, width);
    });
  }

  test('mock active Pro offers management, and lower plans never dispatch checkout', async ({ page }) => {
    const checkout = await prepare(page, { tier: 'pro' });
    const proCard = page.locator('#plans > .grid > div').filter({ has: page.getByText('Mystic', { exact: true }) });
    const openPricing = async () => {
      await page.goto('/pricing');
      await expect(proCard.getByRole('button', { name: 'Current plan', exact: true })).toBeDisabled();
      await page.evaluate(() => document.fonts.ready);
    };
    await openPricing();
    await expect(page.getByRole('button', { name: 'Upgrade to Plus', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /stay on the Seeker/i })).toHaveCount(0);
    await page.getByRole('link', { name: 'Manage current plan', exact: true }).click();
    await expect(page).toHaveURL(/\/account#subscription$/);
    for (const tier of ['Plus', 'Free']) {
      await openPricing();
      const action = page.getByRole('button', { name: `Manage downgrade to ${tier}`, exact: true }).last();
      await expect(action).toBeEnabled();
      await action.scrollIntoViewIfNeeded();
      await action.click();
      await expect(page).toHaveURL(/\/account#subscription$/);
    }
    expect(checkout).toEqual([]);
  });

  for (const [tier, status, label, target] of [
    [null, 'active', 'Upgrade to Plus', null],
    ['free', 'active', 'Upgrade to Plus', 'plus'],
    ['plus', 'active', 'Upgrade to Pro', 'pro'],
    ['pro', 'expired', 'Renew Pro', 'pro']
  ]) {
    test(`mock ${tier || 'guest'}/${status} keeps its supported plan path`, async ({ page }) => {
      const checkout = await prepare(page, { tier, status });
      await page.goto('/pricing');
      await expect(page.getByRole('heading', { name: 'Keep every reading grounded and growing', exact: true })).toBeVisible();
      await page.getByRole('button', { name: label, exact: true }).first().click();
      if (target) {
        await expect.poll(() => checkout.length).toBe(1);
        expect(checkout[0].tier).toBe(target);
        await expect(page.getByText('Mock checkout stopped before billing.', { exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole('dialog', { name: 'Welcome Back' })).toBeVisible();
        expect(checkout).toEqual([]);
      }
    });
  }
});
