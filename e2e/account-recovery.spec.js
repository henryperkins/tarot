import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

const PASSWORD = 'Grounded🌿أمان安心42';

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Account recovery — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page, { signedOut: true });
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    async function fillReset(page, confirmation = PASSWORD) {
      await page.goto('/reset-password?token=local-recovery-fixture');
      await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Confirm password', { exact: true }).fill(confirmation);
    }

    test('mismatched passwords identify and focus the field that needs correction', async ({ page }) => {
      const requests = [];
      await page.route('**/api/auth/reset-password', route => {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ json: { success: true } });
      });
      await fillReset(page, 'DifferentPassword42');
      await page.getByRole('button', { name: 'Update password', exact: true }).click();

      const confirm = page.getByLabel('Confirm password', { exact: true });
      await expect(page.getByRole('alert')).toContainText(/match/i);
      await expect(confirm).toHaveAttribute('aria-invalid', 'true');
      await expect(confirm).toHaveAccessibleDescription(/match/i);
      await expect(confirm).toBeFocused();
      expect(requests).toHaveLength(0);

      await confirm.fill(PASSWORD);
      await expect(confirm).not.toHaveAttribute('aria-invalid', 'true');
      await confirm.press('Enter');
      await expect(page.getByRole('status').filter({ hasText: 'Password reset' })).toBeVisible();
      expect(requests).toEqual([{ token: 'local-recovery-fixture', password: PASSWORD }]);
    });

    for (const scenario of [
      { name: 'rate limit', status: 429, error: 'rate_limited', message: /wait.*try again/i },
      { name: 'service failure', status: 503, error: 'Database not initialized', message: /try again/i },
      { name: 'network failure', abort: true, message: /connection.*try again/i }
    ]) {
      test(`${scenario.name} is announced and a retry preserves the password`, async ({ page }) => {
        const requests = [];
        await page.route('**/api/auth/reset-password', route => {
          requests.push(route.request().postDataJSON());
          if (requests.length > 1) return route.fulfill({ json: { success: true } });
          if (scenario.abort) return route.abort('failed');
          return route.fulfill({ status: scenario.status, json: { error: scenario.error } });
        });
        await fillReset(page);
        await page.getByRole('button', { name: 'Update password', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText(scenario.message);
        await expect(page.getByLabel('New password', { exact: true })).toHaveValue(PASSWORD);
        await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue(PASSWORD);
        await page.getByRole('button', { name: 'Update password', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Password reset' })).toBeVisible();
        await expect(page.getByLabel('New password', { exact: true })).toHaveValue('');
        await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('');
        expect(requests).toEqual([
          { token: 'local-recovery-fixture', password: PASSWORD },
          { token: 'local-recovery-fixture', password: PASSWORD }
        ]);
      });
    }

    test('an expired link announces how to recover and keeps account navigation available', async ({ page }) => {
      await page.route('**/api/auth/reset-password', route => route.fulfill({
        status: 400, json: { error: 'invalid_or_expired_token' }
      }));
      await fillReset(page);
      await page.getByRole('button', { name: 'Update password', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText(/expired.*new link/i);
      await page.getByRole('link', { name: 'Continue to account', exact: true }).click();
      await expect(page).toHaveURL(/\/account$/);
    });

    test('a pending reset sends one request and completion prevents reusing the link', async ({ page }) => {
      let release;
      let requestCount = 0;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/api/auth/reset-password', async route => {
        requestCount += 1;
        await gate;
        await route.fulfill({ json: { success: true } });
      });
      try {
        await fillReset(page);
        await page.getByRole('button', { name: 'Update password', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Updating password...' })).toBeDisabled();
        await expect(page.getByLabel('New password', { exact: true })).toBeDisabled();
        // A held Enter key must not submit again while a response is pending.
        for (let i = 0; i < 10; i += 1) await page.keyboard.press('Enter');
        await expect.poll(() => requestCount).toBe(1);
        release();
        await expect(page.getByRole('status').filter({ hasText: 'Password reset' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Update password', exact: true })).toBeDisabled();
        await page.getByRole('link', { name: 'Continue to account', exact: true }).click();
        await expect(page).toHaveURL(/\/account$/);
        expect(requestCount).toBe(1);
      } finally {
        release();
      }
    });
  });
}
