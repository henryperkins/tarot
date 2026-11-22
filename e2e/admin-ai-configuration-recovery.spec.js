import { expect, test } from '@playwright/test';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from '../tests/helpers/aiConfigWorker.mjs';

test('repairs retired primary and fallback models and reads legacy GLM settings using real storage', async ({ page }) => {
  test.setTimeout(90000);
  const worker = await createAiConfigWorker();
  try {
    const api = worker.url + '/api/admin/ai-configuration';
    const headers = { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY };
    const initial = await (await fetch(api, { headers })).json();
    const reading = initial.features.find(item => item.id === 'readings');
    const guided = initial.features.find(item => item.id === 'guided-questions');
    const primaryModel = reading.policy.primary.modelId;
    const fallbackModel = reading.policy.fallbacks[0].modelId;
    reading.policy.primary.modelId = 'old-primary-model';
    reading.policy.fallbacks[0].modelId = 'old-fallback-model';
    guided.policy.primary.reasoningEffort = 'medium';
    for (const feature of [reading, guided]) {
      await worker.db.prepare(`INSERT INTO ai_feature_config_revisions
        (environment,feature_id,revision,catalog_version,policy_json,diff_json,issued_token,mutation_id,request_digest,request_id,actor,created_at)
        VALUES ('preview',?,1,'1',?,'[]',?,'fixture','fixture','fixture','Admin',?)`)
        .bind(feature.id, JSON.stringify(feature.policy), feature.baseToken, new Date().toISOString()).run();
    }
    await page.addInitScript(key => sessionStorage.setItem('admin_api_key', key), ADMIN_FIXTURE_KEY);
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: 'Guest' } }));
    // Only the disposable loopback Worker receives this fixture credential.
    await page.route('**/api/admin/ai-configuration**', async route => {
      const { pathname, search } = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: worker.url + pathname + search }) });
    });
    await page.goto('/admin/ai-configuration');
    const editor = page.getByRole('article', { name: 'Readings settings' });
    const save = editor.getByRole('button', { name: 'Save changes to Readings' });
    const sample = editor.getByRole('button', { name: 'Run sample reading' });
    const primary = editor.getByRole('combobox', { name: /^Model/ });
    const fallback = editor.getByRole('combobox', { name: /^Anthropic fallback model/ });
    await expect(primary).toHaveValue('old-primary-model');
    await expect(fallback).toHaveValue('old-fallback-model');
    await expect(sample).toBeDisabled();
    await primary.selectOption(primaryModel);
    await expect(save).toBeDisabled();
    await fallback.selectOption(fallbackModel);
    await expect(sample).toBeEnabled();
    await save.click();
    await expect(editor.getByText('All changes saved')).toBeVisible();
    await page.reload();
    await expect(primary).toHaveValue(primaryModel);
    await expect(fallback).toHaveCount(0);
    await expect(sample).toBeEnabled();
    const repaired = (await (await fetch(api, { headers })).json()).features.find(item => item.id === 'readings');
    expect(repaired.revision).toBe(2);
    expect(repaired.policy.fallbacks[0].modelId).toBe(fallbackModel);
    await page.getByRole('button', { name: /Guided coach/ }).click();
    const effort = page.getByLabel(/^Reasoning effort/);
    await expect(effort).toHaveValue('max');
    await expect(page.getByText('Saved as Medium · effective Max')).toBeVisible();
    await expect(effort.locator('option')).toHaveText(['Task default', 'Low', 'High', 'Max']);
    await expect(page.getByRole('button', { name: 'Save changes to Guided coach' })).toBeDisabled();
    expect(await worker.db.prepare('SELECT COUNT(*) AS count FROM ai_feature_config_revisions').first('count')).toBe(3);
    expect(worker.outboundOrigins).toEqual([]);
  } finally {
    await worker.close();
  }
});
