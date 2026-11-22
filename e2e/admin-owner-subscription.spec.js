import { expect, test } from '@playwright/test';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from '../tests/helpers/aiConfigWorker.mjs';

test('links a reader and shows owner sample provenance for each subscription', async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const email = 'owner@example.test';
  const password = 'isolated reader fixture';
  const calls = [];
  let codexReady = false;
  const worker = await createAiConfigWorker({
    bindings: { AI_CONFIG_ENVIRONMENT: 'local', LOCAL_OWNER_HOST_SECRET: 'x'.repeat(32), OWNER_HOST_INSTANCE: crypto.randomUUID(),
      AUTH0_DOMAIN: 'https://fixture-identity.invalid', AUTH0_CLIENT_ID: 'synthetic-client', APP_URL: 'https://fixture-hosted.invalid',
      OWNER_HOST_CODEX_URL: 'http://127.0.0.1:12345', OWNER_HOST_CLAUDE_URL: 'http://127.0.0.1:12346' },
    ownerGatewayStub: (request, provider) => {
      const codex = provider === 'codex-subscription';
      if (new URL(request.url).pathname === '/v1/subscription-status') {
        return Response.json({ provider, ready: !codex || codexReady, ...(!codexReady && codex && { reason: 'login_required' }) });
      }
      calls.push(provider);
      return Response.json({ provider, text: 'A fixed ' + provider + ' fixture reading reflects on each card.',
        model: codex ? 'gpt-6.1-sol' : 'claude-opus-5-5', modelSource: codex ? 'configured' : 'reported', structured: null, usage: {} });
    }
  });
  try {
    // Use the browser's real Origin, Tableu login endpoints, and session cookie
    // against the disposable Worker. Only frontend assets come from Vite.
    await page.route('**/*', async route => {
      const { origin, pathname, search } = new URL(route.request().url());
      if (origin !== worker.url) return route.abort();
      if (pathname.startsWith('/api/')) return route.continue();
      const response = await route.fetch({ url: new URL(pathname + search, baseURL).href });
      return route.fulfill({ response });
    });
    await page.addInitScript(key => sessionStorage.setItem('admin_api_key', key), ADMIN_FIXTURE_KEY);
    const dashboard = worker.url + '/admin/ai-configuration';
    await page.goto(dashboard);
    await page.getByLabel('Reasoning effort').selectOption('low');
    const connections = page.getByRole('tab', { name: 'Provider connections' });
    await connections.click();
    const panel = page.getByRole('region', { name: 'Owner subscription', exact: true });
    const button = (name) => panel.getByRole('button', { name, exact: true });
    await button('Create reader account').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Google/ }).click();
    await expect(dialog.getByRole('alert')).toContainText('Social sign-in is configured for a different site');
    await expect(page).toHaveURL(dashboard);
    await dialog.getByLabel('Email', { exact: true }).fill(email);
    await dialog.getByLabel('Username', { exact: true }).fill('fixture_owner');
    await dialog.getByLabel('Password', { exact: true }).fill(password);
    await dialog.getByLabel('Confirm Password', { exact: true }).fill(password);
    await dialog.getByRole('button', { name: 'Create Account', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByText(email, { exact: false })).toBeVisible();
    await panel.getByRole('radio', { name: /Codex/ }).check();
    await button('Link reader account').click();
    await expect(button('Run owner sample')).toBeDisabled();
    await expect(panel.getByText(/codex login/)).toBeVisible();
    expect(calls).toEqual([]);

    codexReady = true;
    await button('Refresh subscription status').click();
    await button('Run owner sample').click();
    await expect(panel.getByText('Codex / ChatGPT answered')).toBeVisible();
    await expect(panel.getByText(/did not report the answering model/)).toContainText('Configured model · gpt-6.1-sol');
    await page.getByRole('tab', { name: 'Feature models' }).click();
    await expect(page.getByLabel('Reasoning effort')).toHaveValue('low');
    await expect(page.getByRole('button', { name: 'Save changes to Readings' })).toBeEnabled();
    await connections.click();
    await expect(panel.getByText('Codex / ChatGPT answered')).toBeVisible();
    await panel.getByRole('radio', { name: /Claude Code/ }).check();
    await expect(button('Run owner sample')).toBeDisabled();
    await button('Save provider').click();
    await expect(panel.getByText('Codex / ChatGPT answered')).toHaveCount(0);
    await button('Run owner sample').click();
    await expect(panel.getByText('Reported model · claude-opus-5-5')).toBeVisible();
    await expect(panel.getByText(/A fixed claude-code fixture reading/)).toBeVisible();

    // Reopen through the same return URL as social sign-in, with an unrelated
    // reader's cookie. Their view must not disclose the owner's sample.
    const other = await page.request.post(worker.url + '/api/auth/register', {
      data: { email: 'other@example.test', username: 'fixture_other', password }
    });
    expect(other.status()).toBe(201);
    await page.goto(dashboard + '?tab=connections');
    await expect(connections).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByText(/A different reader is linked/)).toBeVisible();
    await expect(button('Run owner sample')).toHaveCount(0);
    await expect(panel.getByText(email)).toHaveCount(0);
    await expect(panel.getByText(/fixture reading/)).toHaveCount(0);
    await button('Sign in with another reader account').click();
    await dialog.getByLabel('Email', { exact: true }).fill(email);
    await dialog.getByLabel('Password', { exact: true }).fill(password);
    await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByText('Reported model · claude-opus-5-5')).toBeVisible();
    await button('Unlink account').click();
    await button('Confirm unlink').click();
    await expect(button('Link reader account')).toBeVisible();
    await expect(button('Run owner sample')).toHaveCount(0);
    expect(calls).toEqual(['codex-subscription', 'claude-code']);
    expect(worker.outboundOrigins).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await worker.close();
  }
});
