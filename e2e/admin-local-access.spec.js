import { test, expect } from '@playwright/test';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from '../tests/helpers/aiConfigWorker.mjs';

for (const enrollment of ['launch proof', 'existing admin key']) {
  test('manages a local admin password through the portal using ' + enrollment, async ({ page, baseURL }) => {
    test.setTimeout(90000);
    const setupToken = 'isolated-launch-fixture';
    const password = 'isolated initial password';
    const changed = 'isolated replacement password';
    const worker = await createAiConfigWorker({ bindings: { AI_CONFIG_ENVIRONMENT: 'local', LOCAL_ADMIN_SETUP_TOKEN: setupToken } });
    try {
      // Serve the app on the fixture Worker origin so that its normal, strict
      // browser Origin check runs on every local sign-in mutation.
      await page.route('**/*', async route => {
        const { origin, pathname, search } = new URL(route.request().url());
        if (origin !== worker.url) return route.abort();
        if (pathname.startsWith('/api/')) return route.continue();
        const response = await route.fetch({ url: new URL(pathname + search, baseURL).href });
        return route.fulfill({ response });
      });
      const dashboard = worker.url + '/admin/ai-configuration';
      await page.goto(dashboard + (enrollment === 'launch proof' ? '#setup=' + setupToken : ''));
      if (enrollment === 'existing admin key') {
        await page.getByLabel('Admin API Key', { exact: true }).fill(ADMIN_FIXTURE_KEY);
        await page.getByRole('button', { name: 'Access Dashboard' }).click();
        await page.getByRole('button', { name: 'Local admin access' }).click();
      }
      await expect(page.getByRole('heading', { name: 'Create local admin password' })).toBeVisible();
      await expect(page).toHaveURL(dashboard);
      const button = name => page.getByRole('button', { name, exact: true });
      const newPassword = page.getByLabel('New password', { exact: true });
      const confirm = page.getByLabel('Confirm new password', { exact: true });
      await newPassword.fill(password);
      await confirm.fill(password);
      await button('Create password').click();
      await expect(page.getByRole('heading', { name: 'Readings', exact: true })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.reload();
      await button('Local admin access').click();
      await page.getByLabel('Current password', { exact: true }).fill(password);
      await newPassword.fill(changed);
      await confirm.fill(changed);
      await button('Save password').click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await button('Sign out').click();
      const login = page.getByLabel('Local admin password', { exact: true });
      await login.fill(password);
      await button('Sign in').click();
      await expect(page.getByRole('alert')).toHaveText('Incorrect local admin password.');
      await login.fill(changed);
      await button('Sign in').click();
      await expect(page.getByRole('heading', { name: 'Readings', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Quality dashboard' }).click();
      await expect(button('Local admin access')).toBeVisible();
      await button('Sign out').click();
      await expect(login).toBeVisible();
    } finally {
      await page.unrouteAll({ behavior: 'wait' });
      await worker.close();
    }
  });
}
