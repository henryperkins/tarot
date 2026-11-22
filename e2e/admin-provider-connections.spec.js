import { test, expect } from '@playwright/test';
import { createAiConfigWorker, ADMIN_FIXTURE_KEY } from '../tests/helpers/aiConfigWorker.mjs';

const base = '/api/admin/ai-configuration';

test('manages provider credentials while preserving the open assignment draft', async ({ page, baseURL }) => {
  test.setTimeout(150000);
  const worker = await createAiConfigWorker({ bindings: {
    AI_CONNECTIONS_ENCRYPTION_KEY: '37'.repeat(32), OPENAI_API_KEY: 'deployment-fixture'
  } });
  const headers = { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY, 'Content-Type': 'application/json' };
  const featureTab = page.getByRole('tab', { name: 'Feature models' });
  const connectionTab = page.getByRole('tab', { name: 'Provider connections' });
  const row = name => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const button = (parent, name) => parent.getByRole('button', { name, exact: true });
  const open = provider => row(provider).getByRole('button', { name: /^(?:Manage connection|Connect provider) for / }).click();

  try {
    const origin = new URL(baseURL).origin;
    let loseReply = false;
    await page.route('**/*', async route => {
      const { pathname, search, origin: target } = new URL(route.request().url());
      if (target !== origin) return route.abort();
      if (!pathname.startsWith('/api/')) return route.continue();
      const response = await route.fetch({ url: worker.url + pathname + search });
      if (loseReply && route.request().method() === 'PUT' && pathname === base + '/connections/elevenlabs') {
        loseReply = false;
        return route.abort('failed');
      }
      return route.fulfill({ response });
    });
    await page.addInitScript(key => sessionStorage.setItem('admin_api_key', key), ADMIN_FIXTURE_KEY);
    await page.goto('/admin/ai-configuration');
    const effort = page.getByLabel(/^Reasoning effort/);
    await effort.selectOption('low');
    const provider = page.getByRole('region', { name: 'Primary model' }).getByLabel(/^Provider/);
    const claudeOption = provider.locator('option[value="claude-api"]');
    await expect(claudeOption).toHaveJSProperty('disabled', true);

    await connectionTab.click();
    const claude = row('Anthropic');
    await open('Anthropic');
    await claude.locator('input[name="apiKey"]').fill('portal-anthropic-fixture');
    await button(claude, 'Save credentials').click();
    await expect(claude.getByRole('status')).toContainText('credentials saved');
    await expect(claude).toContainText('Portal settings');
    await featureTab.click();
    await expect(effort).toHaveValue('low');
    await expect(claudeOption).toHaveJSProperty('disabled', false);
    await expect(button(page, 'Save changes to Readings')).toBeEnabled();

    await connectionTab.click();
    await open('Anthropic');
    await expect(claude.locator('input[name="apiKey"]')).toBeEmpty();
    // A second admin saves after the first opened the form.
    const competing = await fetch(worker.url + base + '/connections/claude-api', { method: 'PUT', headers,
      body: JSON.stringify({ baseRevision: 1, action: 'replace', values: { apiKey: 'competing-fixture' } }) });
    expect(competing.status).toBe(200);
    await claude.locator('input[name="apiKey"]').fill('stale-fixture');
    await button(claude, 'Save credentials').click();
    await expect(claude.getByRole('alert')).toContainText('changed elsewhere');
    await open('Anthropic');
    await expect(claude.locator('input[name="apiKey"]')).toBeEmpty();
    await button(claude, 'Use deployment settings').click();
    await button(claude, 'Restore deployment settings').click();
    await expect(claude).toContainText('Unconfigured');

    const openai = row('OpenAI');
    await open('OpenAI');
    await button(openai, 'Disconnect').click();
    await button(openai, 'Confirm disconnect').click();
    await expect(openai).toContainText('Disconnected in portal');
    await expect(openai).toContainText('Unconfigured');
    await open('OpenAI');
    await button(openai, 'Use deployment settings').click();
    await button(openai, 'Restore deployment settings').click();
    await expect(openai.getByText('Configured', { exact: true })).toBeVisible();

    const modal = row('Modal');
    for (const method of ['pair', 'single']) {
      await open('Modal');
      await modal.getByLabel('Authentication method').selectOption(method);
      await modal.locator('input[name="endpointUrl"]').fill('https://tableu-fixture.modal.run');
      if (method === 'pair') {
        await modal.locator('input[name="tokenId"]').fill('fixture-id');
        await modal.locator('input[name="tokenSecret"]').fill('fixture-secret');
      } else {
        await modal.locator('input[name="token"]').fill('fixture-single-token');
        await expect(modal.locator('input[name="tokenSecret"]')).toHaveCount(0);
      }
      await button(modal, 'Save credentials').click();
      await expect(modal.getByRole('status')).toContainText('credentials saved');
    }
    const eleven = row('ElevenLabs');
    await page.setViewportSize({ width: 320, height: 500 });
    await open('ElevenLabs');
    await eleven.locator('input[name="apiKey"]').fill('narration-fixture');
    loseReply = true;
    await button(eleven, 'Save credentials').click();
    await expect(eleven.getByRole('alert')).toContainText('save could not be confirmed');
    await expect(eleven.getByText('Configured', { exact: true })).toBeVisible();
    await open('ElevenLabs');
    await expect(eleven.locator('input[name="apiKey"]')).toBeEmpty();
    await button(eleven, 'Cancel').click();
    await expect(eleven.getByRole('button', { name: 'Manage connection for ElevenLabs' })).toBeFocused();
    await expect(row('Workers AI').getByRole('button')).toHaveCount(0);
    await expect(row('Local composer').getByRole('button')).toHaveCount(0);

    await featureTab.click();
    await expect(effort).toHaveValue('low');
    await expect(claudeOption).toHaveJSProperty('disabled', true);
    await page.locator('summary').filter({ hasText: 'Vision, embeddings & media' }).click();
    await expect(page.locator('dl div').filter({ has: page.getByText('Narration · ElevenLabs', { exact: true }) })).toContainText('Ready');
    await expect(button(page, 'Save changes to Readings')).toBeEnabled();
    expect(worker.outboundOrigins).toEqual([]);
  } finally {
    await worker.close();
  }
});
