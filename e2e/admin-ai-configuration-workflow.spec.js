import { expect, test } from '@playwright/test';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from '../tests/helpers/aiConfigWorker.mjs';

const reading = [
  '### Opening', 'There is time to consider a new direction.',
  '### Past — The Hermit', 'The Hermit asks you to pause. Give yourself space to reflect on what you have learned. Choose one insight to carry forward.',
  '### Present — Two of Wands', 'The Two of Wands invites you to weigh two possibilities. Consider each against your values. Choose a small step to explore.',
  '### Future — Eight of Pentacles', 'The Eight of Pentacles offers a way to deepen a skill. Give your practice time to develop. Notice what it teaches you.',
  '### Synthesis', 'Reflection can guide a deliberate next step. Consider what practice you want to begin.'
].join('\n\n');
const groundedAnswer = 'The Hermit invites a quiet moment to identify one small step.';
const scores = { personalization: 4, tarot_coherence: 4, tone: 4, safety: 5, overall: 4, safety_flag: false };
const base = '/api/admin/ai-configuration';

test('saves, samples, reloads and audits all seven features against the local Worker', async ({ page, baseURL }, testInfo) => {
  test.setTimeout(180000);
  let featureId = 'readings';
  let failExtraction = false;
  const efforts = [];
  const worker = await createAiConfigWorker({
    openAIStub: async request => {
      const body = await request.json();
      const repair = body.instructions?.includes('card-set grounding compliance');
      efforts.push([featureId, body.reasoning?.effort]);
      let text = groundedAnswer;
      if (featureId === 'readings') text = JSON.stringify({ format: 'card-scenes-v1', blocks: [{ type: 'prose', text: reading }] });
      if (featureId === 'reading-followups' && !repair) text = 'The Tower invites a quiet moment to consider a change.';
      return Response.json({ status: 'completed', model: repair ? 'repair-model' : 'generation-model', output_text: text });
    },
    workersAiStub: async request => {
      const { model, input } = await request.json();
      efforts.push([featureId, input.reasoning_effort]);
      if (failExtraction) return new Response(null, { status: 503 });
      const response = input.response_format ? JSON.stringify(scores)
        : input.temperature === 0.1 ? ['Write down one step.'] : 'What can I learn from writing down one idea?';
      return Response.json({ response, model });
    }
  });
  const headers = { Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY, 'Content-Type': 'application/json' };
  const catalog = async () => (await fetch(worker.url + base, { headers })).json();
  const rows = page.locator('.ai-records:visible .ai-record-list > li');
  const button = name => page.getByRole('button', { name, exact: true });
  const tab = name => page.getByRole('tab', { name });
  const current = () => page.getByRole('article');
  const effort = () => current().getByLabel(/^Reasoning effort/);
  const dbCount = table => worker.db.prepare('SELECT COUNT(*) AS n FROM ' + table).first('n');
  let barrier = null;
  try {
    const origin = new URL(baseURL).origin;
    await page.route('**/*', async route => {
      const { origin: target, pathname, search } = new URL(route.request().url());
      if (target !== origin) return route.abort();
      if (!pathname.startsWith('/api/')) return route.continue();
      const pending = pathname === base + '/features/readings' && route.request().method() === 'PUT' && barrier;
      if (pending?.phase === 'before') { pending.entered.resolve(); await pending.release.promise; }
      const response = await route.fetch({ url: worker.url + pathname + search });
      if (pending?.phase === 'after') { pending.entered.resolve(); await pending.release.promise; }
      return route.fulfill({ response });
    });
    await page.setViewportSize({ width: 1280, height: 853 });
    await page.goto('/admin/ai-configuration');
    await page.getByLabel('Admin API Key', { exact: true }).fill(ADMIN_FIXTURE_KEY);
    await button('Access Dashboard').click();
    await expect(current()).toBeVisible();
    const { features } = await catalog();
    expect(features).toHaveLength(7);
    const saved = new Map();
    async function selectFeature(feature) {
      const select = page.getByRole('button', { name: new RegExp('^' + feature.label + '(?: |$)') });
      if (feature.group === 'background' && !await select.isVisible()) {
        await page.locator('summary').filter({ hasText: 'Background tasks' }).click();
      }
      await select.click();
      await expect(current()).toHaveAccessibleName(feature.label + ' settings');
    }
    for (const feature of features) {
      featureId = feature.id;
      await selectFeature(feature);
      if (['reading-followups', 'journal-summaries'].includes(featureId)) {
        await current().getByLabel(/^Provider/).selectOption('openai-native');
        await effort().selectOption('high');
      } else if (featureId === 'readings') await effort().selectOption('medium');
      else {
        await expect(effort().locator('option')).toHaveText(['Task default', 'Low', 'High', 'Max']);
        await effort().selectOption('max');
      }
      await current().getByRole('button', { name: /^Run sample/ }).click();
      await expect(current().getByText('Primary model answered')).toBeVisible({ timeout: 20000 });
      if (featureId === 'reading-followups') {
        await expect(current().getByText('Repaired by OpenAI / repair-model')).toBeVisible();
        await expect(current().getByText('Repair used Low reasoning')).toBeVisible();
        await expect(current().getByText(groundedAnswer, { exact: true })).toBeVisible();
        expect(efforts.filter(([id]) => id === featureId).map(call => call[1])).toEqual(['high', 'low']);
      }
      if (featureId === 'readings') {
        await effort().selectOption('low');
        await expect(current().getByText('Tested with Medium reasoning · Current draft uses Low')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('earlier-draft-desktop.png') });
      }
      if (featureId === 'coach-action-extraction') {
        failExtraction = true;
        await button('Run again').click();
        await expect(current().getByText('Sample failed', { exact: true })).toBeVisible();
        failExtraction = false;
      }
      saved.set(featureId, await effort().inputValue());
      await button('Save changes to ' + feature.label).click();
      await expect(current().getByText('All changes saved')).toBeVisible();
    }
    await page.reload();
    const reloaded = await catalog();
    for (const feature of reloaded.features) {
      expect(feature.revision).toBe(1);
      expect(feature.policy.primary.reasoningEffort).toBe(saved.get(feature.id));
      await selectFeature(feature);
      await expect(effort()).toHaveValue(saved.get(feature.id));
    }
    await selectFeature(features[0]);
    let expectedRows = 7;
    for (const phase of ['before', 'after']) {
      const baseline = await effort().inputValue();
      const target = baseline === 'low' ? 'medium' : 'high';
      await effort().selectOption(target);
      barrier = { phase, entered: Promise.withResolvers(), release: Promise.withResolvers() };
      await button('Save changes to Readings').click();
      await barrier.entered.promise;
      expect(await dbCount('ai_feature_config_revisions')).toBe(expectedRows + (phase === 'after' ? 1 : 0));
      await page.getByRole('button', { name: /^Guided coach/ }).click();
      await page.getByRole('link', { name: 'Quality dashboard' }).click();
      await button('Sign out').click();
      await page.evaluate(() => history.back());
      await expect(page.getByText('Saving changes to Readings…', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(current()).toHaveAccessibleName('Readings settings');
      await effort().selectOption(baseline);
      barrier.release.resolve();
      barrier = null;
      await expect(button('Save changes to Readings')).toBeEnabled();
      await expect(effort()).toHaveValue(baseline);
      await button('Discard').click();
      await expect(effort()).toHaveValue(target);
      expect(await dbCount('ai_feature_config_revisions')).toBe(++expectedRows);
    }
    // Seed enough interleaved revisions to reach the second filtered page.
    for (let index = 0; index < 46; index++) {
      const id = index % 2 ? 'readings' : 'reading-followups';
      const feature = (await catalog()).features.find(item => item.id === id);
      const policy = structuredClone(feature.policy);
      policy.primary.reasoningEffort = policy.primary.reasoningEffort === 'low' ? 'high' : 'low';
      const response = await fetch(worker.url + base + '/features/' + id, { method: 'PUT', headers,
        body: JSON.stringify({ policy, baseToken: feature.baseToken, baseRevision: feature.revision, mutationId: 'history-' + index }) });
      expect(response.status).toBe(200);
    }
    await tab('Change history').click();
    const filter = page.getByRole('combobox', { name: 'Feature', exact: true });
    for (const feature of features) {
      await filter.selectOption(feature.id);
      if (feature.id === 'readings') {
        await expect(rows).toHaveCount(25);
        await button('Load more changes').click();
      }
      const count = feature.id === 'readings' ? 26 : feature.id === 'reading-followups' ? 24 : 1;
      await expect(rows.locator('.ai-chip')).toHaveText(Array.from({ length: count }, (_, i) => 'Revision ' + (count - i)));
      await expect(rows.first()).toContainText('Preview');
      await expect(rows.first().locator('time')).toContainText('UTC');
    }
    await button('Sign out').click();
    await expect(page.getByLabel('Admin API Key', { exact: true })).toHaveValue('');
    expect(await page.evaluate(() => sessionStorage.getItem('admin_api_key'))).toBeNull();
    for (const table of ['usage_tracking', 'inference_attempts', 'eval_metrics', 'journal_entries']) expect(await dbCount(table)).toBe(0);
    expect(worker.outboundOrigins).toEqual([]);
  } finally {
    barrier?.release.resolve();
    await worker.close();
  }
});
