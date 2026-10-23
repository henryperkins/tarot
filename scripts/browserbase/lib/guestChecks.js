import { expect } from '@playwright/test';

function publicUrl(value) {
  try {
    const url = new URL(value);
    const pathname = url.pathname.startsWith('/cdn-cgi/challenge-platform/')
      ? '/cdn-cgi/challenge-platform/[redacted]' : url.pathname;
    return `${url.origin}${pathname}`;
  }
  catch { return '[invalid URL]'; }
}

export async function checkGuestUi(context, run, { targetUrl, guard, signal, log }) {
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => run.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const url = publicUrl(message.location().url);
    const expected = run.blockedRequests.some(request => request.url === url)
      || (url === `${targetUrl}/api/auth/me` && /^Failed to load resource:.*\b401\b/.test(text));
    run.consoleErrors.push({ text, url, expected });
  });
  page.on('requestfailed', request => {
    if (!guard.isBlocked(request)) run.failedRequests.push({ url: publicUrl(request.url()), failure: request.failure()?.errorText });
  });

  const steps = [
    ['onboarding and exit', async () => {
      const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), 'App document should load').toBe(200);
      expect(new URL(page.url()).origin).toBe(targetUrl);
      run.assets = await page.locator('script[type="module"][src], link[rel="stylesheet"][href]').evaluateAll(nodes =>
        nodes.map(node => {
          const url = new URL(node.src || node.href);
          return `${url.origin}${url.pathname}`;
        })
      );
      await expect(page.getByRole('dialog', { name: 'Welcome to Tableu', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
      if (run.viewport.width < 640) await page.getByRole('button', { name: 'Skip now', exact: true }).click();
      await expect(page.getByRole('radiogroup', { name: 'Spread selection', exact: true })).toBeVisible();
    }],
    ['deck and spread selection', async () => {
      const handset = run.viewport.width < 640;
      if (handset) {
        await page.getByRole('button', { name: 'Reading settings', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Prepare your reading', exact: true })).toBeVisible();
      }
      const decks = page.getByRole('radiogroup', { name: 'Choose your deck style', exact: true });
      const choices = decks.getByRole('radio');
      await expect(choices).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        await choices.nth(i).press('Space');
        await expect(choices.nth(i)).toHaveAttribute('aria-checked', 'true');
      }
      await choices.first().press('Space');
      if (handset) await page.getByRole('button', { name: 'Close reading preparation', exact: true }).click();
      const spread = page.getByRole('radio', { name: /Three-Card Story/ });
      await spread.click();
      await expect(spread).toHaveAttribute('aria-checked', 'true');
    }],
    ['guest sign-in dialog opens and closes', async () => {
      const direct = page.locator('[data-app-header]').getByRole('button', { name: 'Sign In', exact: true });
      if (await direct.count()) await direct.click();
      else {
        await page.locator('summary[aria-label="Account options"]').click();
        await page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first().click();
      }
      const dialog = page.getByRole('dialog').filter({ visible: true });
      await expect(dialog.locator('#auth-email')).toBeVisible();
      await expect(dialog.locator('#auth-password')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
    }],
    ['draw, deal, and reveal three cards', async () => {
      await page.locator('#question-input, #quick-intention').filter({ visible: true }).first()
        .fill('What should I reflect on today?');
      await page.getByRole('button', { name: 'Draw cards', exact: true }).filter({ visible: true }).first().click();
      await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
      await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
      await expect(page.getByRole('status').filter({ hasText: '3 of 3 cards revealed' })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first()).toBeVisible();
      const size = await page.evaluate(() => ({ width: globalThis.innerWidth, content: globalThis.document.documentElement.scrollWidth }));
      expect(size.content, 'Guest UI should fit the viewport').toBeLessThanOrEqual(size.width + 1);
    }]
  ];
  for (let i = 0; i < steps.length; i++) {
    const [name, check] = steps[i];
    signal?.throwIfAborted();
    log(`${run.name}: ${name}`);
    try {
      await check();
      run.checks.push({ name, status: 'passed' });
    } catch (error) {
      run.checks.push({ name, status: 'failed' });
      run.checks.push(...steps.slice(i + 1).map(([next]) => ({ name: next, status: 'skipped' })));
      throw error;
    }
  }
}
