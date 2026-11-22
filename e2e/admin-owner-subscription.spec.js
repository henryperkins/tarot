import { expect, test } from '@playwright/test';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from '../tests/helpers/aiConfigWorker.mjs';

test('links a reader and shows owner sample provenance for each subscription', async ({ page, baseURL }) => {
  test.setTimeout(120000);
  const email = 'owner@example.test';
  const password = 'isolated reader fixture';
  const calls = [];
  let modelReads = 0;
  let codexReady = false;
  const worker = await createAiConfigWorker({
    bindings: { AI_CONFIG_ENVIRONMENT: 'local', LOCAL_OWNER_HOST_SECRET: 'x'.repeat(32), OWNER_HOST_INSTANCE: crypto.randomUUID(),
      AUTH0_DOMAIN: 'https://fixture-identity.invalid', AUTH0_CLIENT_ID: 'synthetic-client', APP_URL: 'https://fixture-hosted.invalid',
      OWNER_HOST_CODEX_URL: 'http://127.0.0.1:12345', OWNER_HOST_CLAUDE_URL: 'http://127.0.0.1:12346' },
    ownerGatewayStub: async (request, provider) => {
      const codex = provider === 'codex-subscription';
      if (new URL(request.url).pathname === '/v1/subscription-status') {
        return Response.json({ provider, ready: !codex || codexReady, ...(!codexReady && codex && { reason: 'login_required' }) });
      }
      if (new URL(request.url).pathname === '/v1/models') {
        expect(provider).toBe('codex-subscription');
        modelReads += 1;
        return Response.json({ provider, models: [{ id: 'owner-model', label: 'Owner model' }] });
      }
      calls.push(provider);
      const { model } = await request.json();
      expect(model).toBe(codex ? 'owner-model' : undefined);
      return Response.json({ provider, text: 'A fixed ' + provider + ' fixture reading reflects on each card.',
        model: codex ? model : 'claude-opus-5-5', modelSource: codex ? 'configured' : 'reported', structured: null, usage: {} });
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
    // The panel rechecks the reader whenever its browser tab becomes visible.
    const statusUrl = worker.url + '/api/admin/ai-configuration/owner-subscription';
    const becomeVisible = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const returnToTab = async () => {
      const rechecked = page.waitForResponse(response => response.url() === statusUrl && response.request().method() === 'GET');
      await becomeVisible();
      await (await rechecked).finished();
    };
    await expect(page.getByRole('button', { name: 'Fetch models' })).toHaveCount(0);
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
    await button('Fetch models').click();
    const personalModel = panel.getByLabel('Personal Readings model');
    await expect(personalModel.getByRole('option', { name: 'Owner model · owner-model' })).toHaveCount(1);
    await personalModel.selectOption('owner-model');
    // Leaving and returning to the tab keeps the fetched list and the unsaved choice.
    await returnToTab();
    await expect(personalModel).toHaveValue('owner-model');
    await button('Save personal model').click();
    await expect(panel.getByText('Personal Readings model saved.')).toBeVisible();
    await button('Refresh models').click();
    await expect(personalModel).toHaveValue('owner-model');
    await button('Run owner sample').click();
    await expect(panel.getByText('Codex / ChatGPT answered')).toBeVisible();
    await expect(panel.getByText(/did not report the answering model/)).toContainText('Configured model · owner-model');
    await personalModel.selectOption('');
    await button('Save personal model').click();
    await expect(panel.getByText('Personal Readings will use the subscription default.')).toBeVisible();
    await page.getByRole('tab', { name: 'Feature models' }).click();
    await expect(page.getByLabel('Reasoning effort')).toHaveValue('low');
    await expect(page.getByRole('button', { name: 'Save changes to Readings' })).toBeEnabled();
    await connections.click();
    await expect(panel.getByText('Codex / ChatGPT answered')).toBeVisible();
    const claudeChoice = panel.getByRole('radio', { name: /Claude Code/ });
    await claudeChoice.check();
    await expect(button('Fetch models')).toHaveCount(0);
    await expect(button('Run owner sample')).toBeDisabled();
    await returnToTab();
    await expect(claudeChoice).toBeChecked();

    // A recheck that read the link before a save must not replace the saved view.
    const staleRead = Promise.withResolvers();
    const saved = Promise.withResolvers();
    const delivered = Promise.withResolvers();
    await page.route(statusUrl, async route => {
      if (route.request().method() !== 'GET') return route.fallback();
      const response = await route.fetch();
      staleRead.resolve();
      await saved.promise;
      // The page may already have cancelled the recheck that the save superseded.
      await route.fulfill({ response }).catch(() => {});
      delivered.resolve();
    });
    await becomeVisible();
    await staleRead.promise;
    await button('Save provider').click();
    await expect(panel.getByText('Owner subscription saved.')).toBeVisible();
    saved.resolve();
    await delivered.promise;
    await page.unroute(statusUrl);
    await expect(claudeChoice).toBeChecked();
    await expect(button('Save provider')).toHaveCount(0);
    await expect(panel.getByText('Codex / ChatGPT answered')).toHaveCount(0);
    await button('Run owner sample').click();
    await expect(panel.getByText('Reported model · claude-opus-5-5')).toBeVisible();
    await expect(panel.getByText(/A fixed claude-code fixture reading/)).toBeVisible();

    // The reader can sign out or change in another tab. Returning to this one
    // must replace the owner's settings and sample without a page load.
    await page.context().clearCookies();
    await returnToTab();
    await expect(button('Sign in as reader')).toBeVisible();
    await expect(button('Unlink account')).toHaveCount(0);
    await expect(panel.getByText(/fixture reading/)).toHaveCount(0);

    // Reopen through the same return URL as social sign-in, with an unrelated
    // reader's cookie. Their view must not disclose the owner's sample.
    const other = await page.request.post(worker.url + '/api/auth/register', {
      data: { email: 'other@example.test', username: 'fixture_other', password }
    });
    expect(other.status()).toBe(201);
    await returnToTab();
    await expect(panel.getByText(/A different reader is linked/)).toBeVisible();
    await expect(button('Sign in as reader')).toHaveCount(0);
    await expect(button('Unlink account')).toHaveCount(0);
    await expect(panel.getByText(email)).toHaveCount(0);
    await page.goto(dashboard + '?tab=connections');
    await expect(connections).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByText(/A different reader is linked/)).toBeVisible();
    await expect(button('Run owner sample')).toHaveCount(0);
    await expect(panel.getByText('owner-model')).toHaveCount(0);
    await expect(button('Fetch models')).toHaveCount(0);
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
    expect(modelReads).toBeGreaterThanOrEqual(2);
    expect(worker.outboundOrigins).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await worker.close();
  }
});
