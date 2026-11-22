import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FEATURE_IDS, CATALOG_VERSION, getFeature, listConnections, specialistInventory } from '../functions/lib/aiConfigCatalog.js';

const base = '/api/admin/ai-configuration';
const fixtureEnv = {
  AI_CONFIG_ENVIRONMENT: 'preview', AI_CONFIG_ENABLED: 'true',
  AI: { run() {} }, OPENAI_API_KEY: 'fixture-only', OPENAI_MODEL: 'gpt-6.1-sol', OPENAI_REASONING_EFFORT: 'high',
  ANTHROPIC_API_KEY: 'fixture-only', MODAL_ENDPOINT_URL: 'https://example.test/v1', MODAL_PROXY_TOKEN: 'fixture-only'
};

async function checkAccessibility(page) {
  const results = await new AxeBuilder({ page }).include('.admin-workspace')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.target) }))).toEqual([]);
}

async function openEditor(page, { deferSave, deferReceipt, conflictOnce = false, history = [], signIn = false } = {}) {
  const catalog = {
    environment: 'preview', writable: true, catalogVersion: CATALOG_VERSION, specialistInventory: specialistInventory(fixtureEnv),
    features: FEATURE_IDS.map(id => ({ ...getFeature(fixtureEnv, id), revision: 0, baseToken: 'base-0' }))
  };
  const entries = [...history];
  const runs = new Map();
  if (!signIn) await page.addInitScript(() => sessionStorage.setItem('admin_api_key', 'local-browser-fixture'));
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { error: 'Guest' } }));
  await page.route('**/api/admin/local-access', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/admin/ai-configuration**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.slice(base.length);
    if (req.headers().authorization !== 'Bearer local-browser-fixture') return route.fulfill({ status: 401 });
    if (!path) return route.fulfill({ json: catalog });
    if (path === '/connections') return route.fulfill({ json: { connections: listConnections(fixtureEnv) } });
    if (path === '/history') {
      const filter = url.searchParams.get('feature');
      const offset = Number(url.searchParams.get('cursor'));
      const rows = entries.filter(entry => !filter || entry.featureId === filter);
      return route.fulfill({ json: {
        entries: rows.slice(offset, offset + 25), nextCursor: rows.length > offset + 25 ? String(offset + 25) : null
      } });
    }
    const [, , id, samples, runId] = path.split('/');
    const feature = catalog.features.find(item => item.id === id);
    if (!samples && req.method() === 'PUT') {
      const input = req.postDataJSON();
      if (conflictOnce) {
        conflictOnce = false;
        feature.policy.primary.reasoningEffort = 'xhigh';
        const [first, second, local] = feature.policy.fallbacks;
        feature.policy.fallbacks = [second, first, local];
        Object.assign(feature, { revision: 1, baseToken: 'base-1' });
        return route.fulfill({ status: 409, json: { error: 'A newer revision exists.' } });
      }
      await deferSave?.();
      const before = feature.policy.primary.reasoningEffort;
      feature.policy = input.policy;
      feature.revision += 1;
      feature.baseToken = 'base-' + feature.revision;
      entries.unshift({ featureId: id, revision: feature.revision, environment: 'preview', createdAt: '2026-11-19T12:34:00Z', actor: 'Shared admin credential',
        diff: [{ field: 'primary.reasoningEffort', before, after: feature.policy.primary.reasoningEffort }] });
      await deferReceipt?.();
      return route.fulfill({ json: { policy: feature.policy, baseToken: feature.baseToken, revision: feature.revision } });
    }
    if (samples === 'samples' && req.method() === 'POST') {
      const input = req.postDataJSON();
      runs.set(input.runId, {
        featureId: id, environment: 'preview', runId: input.runId, fixtureVersion: feature.fixtureVersion, status: 'completed',
        outcome: 'primary_accepted', excerpt: 'The Hermit invites you to clarify what matters before choosing a direction. The Two of Wands opens the next possibility, and the Eight of Pentacles brings it into reach through steady, deliberate practice.',
        attempts: [{ slot: 0, ...input.policy.primary, outcome: 'accepted', modelSource: 'reported', effortSent: input.policy.primary.reasoningEffort }]
      });
      return route.fulfill({ status: 202, json: { runId: input.runId } });
    }
    if (runs.has(runId)) return route.fulfill({ json: runs.get(runId) });
    return route.fulfill({ status: 404 });
  });
  await page.goto('/admin/ai-configuration');
  if (signIn) {
    await expect(page.getByLabel('Admin API Key')).toBeVisible();
    return;
  }
  await expect(page.getByRole('heading', { name: 'AI models' })).toBeVisible();
  return entries;
}

test('shows saved, tested and edited reading settings and saves only the draft', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 853 });
  await openEditor(page);
  const effort = page.getByLabel(/^Reasoning effort/);
  const save = page.getByRole('button', { name: 'Save changes to Readings' });
  await expect(save).toBeDisabled();
  await expect(page.getByText('Three-Card Story · All upright')).toBeVisible();
  await effort.selectOption('medium');
  await page.getByRole('button', { name: 'Run sample reading' }).click();
  await expect(page.getByText('Current draft', { exact: true })).toBeVisible();
  await effort.selectOption('low');
  await expect(page.getByText('From an earlier draft')).toBeVisible();
  await expect(page.getByText('Tested with Medium reasoning · Current draft uses Low')).toBeVisible();
  await expect(page.getByText('Readings · Reasoning effort changed from High to Low')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('earlier-draft-desktop.png') });
  await checkAccessibility(page);
  await page.getByRole('tab', { name: 'Provider connections' }).click();
  await expect(page.getByText('Configured', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Feature models' }).click();
  await effort.selectOption('medium');
  await expect(page.getByText('Current draft', { exact: true })).toBeVisible();
  await effort.selectOption('low');
  await save.click();
  await expect(save).toBeDisabled();
  await expect(page.getByText('All changes saved')).toBeVisible();
  await page.getByRole('tab', { name: 'Change history' }).click();
  await expect(page.getByText('Revision 1')).toBeVisible();
  await expect(page.getByText('Reasoning effort · High → Low')).toBeVisible();
});

test('supports 320px, keyboard reordering, guarded navigation and returning focus', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openEditor(page);
  await page.evaluate(() => document.documentElement.classList.add('light'));
  const toggle = page.getByRole('button', { name: 'Edit order' });
  await toggle.click();
  const move = page.getByRole('button', { name: 'Move Modal up' });
  await move.focus();
  await move.press('Enter');
  await expect(page.locator('.ai-fallbacks li').first()).toContainText('Modal');
  await page.getByRole('button', { name: 'Move Modal down' }).press('Escape');
  await expect(toggle).toBeFocused();
  await page.getByRole('button', { name: /Guided coach/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('article', { name: 'Readings settings' })).toBeVisible();
  const save = page.getByRole('button', { name: 'Save changes to Readings' });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath('narrow-light.png') });
  await checkAccessibility(page);
  await page.getByRole('button', { name: /Guided coach/ }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Guided coach settings' })).toBeVisible();
});

test('preserves edits made during a save and reconciles a conflicting baseline', async ({ page }) => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  await openEditor(page, { conflictOnce: true, deferSave: () => pending });
  const effort = page.getByLabel(/^Reasoning effort/);
  const save = page.getByRole('button', { name: 'Save changes to Readings' });
  await effort.selectOption('medium');
  await save.click();
  await expect(page.getByText(/Saved settings changed elsewhere/)).toContainText('High to Xhigh');
  await page.getByRole('button', { name: 'Review my draft' }).click();
  await expect(effort).toHaveValue('medium');
  await expect(page.locator('.ai-fallbacks li').first()).toContainText('Modal');
  await save.click();
  await effort.selectOption('low');
  finish();
  await expect(page.getByText('Readings · Reasoning effort changed from Medium to Low')).toBeVisible();
  await expect(save).toBeEnabled();
});

for (const phase of ['before commit', 'after commit']) {
  test('guards pending saves ' + phase + ' even when the draft returns to the old baseline', async ({ page }) => {
    const hold = Promise.withResolvers();
    const entered = Promise.withResolvers();
    function delay() { entered.resolve(); return hold.promise; }
    const entries = await openEditor(page, phase === 'before commit' ? { deferSave: delay } : { deferReceipt: delay });
    const effort = page.getByLabel(/^Reasoning effort/);
    await effort.selectOption('medium');
    await page.getByRole('button', { name: 'Save changes to Readings' }).click();
    try {
      await entered.promise;
      expect(entries.length).toBe(phase === 'after commit' ? 1 : 0);
      await effort.selectOption('high');
      await page.getByRole('button', { name: /Guided coach/ }).click();
      await page.getByRole('link', { name: 'Quality dashboard' }).click();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.evaluate(() => window.history.back());
      await expect(page.getByRole('article', { name: 'Readings settings' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText(/Saving changes to Readings/).first()).toBeVisible();
      await page.getByRole('tab', { name: 'Provider connections' }).click();
      await expect(page.getByText('Saving changes to Readings…', { exact: true })).toBeVisible();
      await page.getByRole('tab', { name: 'Change history' }).click();
      await expect(page.getByText('Saving changes to Readings…', { exact: true })).toBeVisible();
      await page.getByRole('tab', { name: 'Feature models' }).click();
    } finally { hold.resolve(); }
    await expect(page.getByText('Readings · Reasoning effort changed from Medium to High')).toBeVisible();
    expect(entries).toHaveLength(1);
  });
}

test('confirms Back to a previous document once and protects an ordinary reload', async ({ page }) => {
  await page.route('**/previous-document', route => route.fulfill({ contentType: 'text/html', body: '<h1>Previous document</h1>' }));
  await page.goto('/previous-document');
  await openEditor(page);
  await page.getByLabel(/^Reasoning effort/).selectOption('low');
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.type()); await dialog.dismiss(); });
  await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
  await expect.poll(() => dialogs.length).toBe(1);
  await page.evaluate(() => history.back());
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel(/^Reasoning effort/)).toHaveValue('low');
  await page.evaluate(() => history.back());
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Previous document' })).toBeVisible();
  expect(dialogs).toEqual(['beforeunload']);
});

test('returns to the previous app route after discarding on browser Back', async ({ page }) => {
  await page.route('**/api/admin/quality-stats?*', route => route.fulfill({
    status: route.request().url().endsWith('days=1') ? 200 : 503, json: { error: 'Fixture' }
  }));
  await openEditor(page);
  await page.getByRole('link', { name: 'Quality dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Quality Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'AI configuration' }).click();
  await page.getByLabel(/^Reasoning effort/).selectOption('medium');
  await page.evaluate(() => history.back());
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('retries the submitted mutation after a lost response and retains newer edits', async ({ page }) => {
  const entries = await openEditor(page);
  const hold = Promise.withResolvers();
  const persisted = Promise.withResolvers();
  const submissions = [];
  let receipt;
  await page.route('**/api/admin/ai-configuration/features/readings', async route => {
    const submission = route.request().postDataJSON();
    submissions.push(submission);
    if (submissions.length === 1) {
      receipt = { revision: 1, baseToken: 'new-token', policy: submission.policy };
      entries.push({ featureId: 'readings', revision: 1 });
      persisted.resolve();
      await hold.promise;
      return route.abort('failed');
    }
    return route.fulfill({ json: receipt });
  });
  const effort = page.getByLabel(/^Reasoning effort/);
  await effort.selectOption('medium');
  await page.getByRole('button', { name: 'Save changes to Readings' }).click();
  await persisted.promise;
  await effort.selectOption('high');
  hold.resolve();
  await page.getByRole('button', { name: 'Retry submitted save' }).click();
  await expect(page.getByText('Readings · Reasoning effort changed from Medium to High')).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[1]).toEqual(submissions[0]);
  expect(entries).toHaveLength(1);
});

test('focuses main and the selected foreground or background editor', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('link', { name: 'Skip to main content' }).press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('button', { name: /Guided coach/ }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Guided coach' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: /^Model/ })).toBeFocused();
  await page.getByText('Background tasks', { exact: false }).first().click();
  await page.getByRole('button', { name: /Quality gate/ }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Quality gate' })).toBeFocused();
});

test('returns focus to the mobile navigation link when leaving is canceled @mobile', async ({ page }) => {
  await openEditor(page);
  await page.getByLabel(/^Reasoning effort/).selectOption('low');
  await page.getByRole('button', { name: 'Admin navigation' }).click();
  const back = page.getByRole('link', { name: 'Back to app' });
  await back.click();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(back).toBeFocused();
  await back.press('Enter');
  await page.keyboard.press('Escape');
  await expect(back).toBeFocused();
});

for (const height of [256, 380]) {
  test('keeps long summaries and conflicts reachable at 320 by ' + height, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height });
    await openEditor(page, { conflictOnce: true });
    await page.getByRole('combobox', { name: /^Provider/ }).selectOption('modal-qwen');
    await page.getByLabel(/^Reasoning effort/).selectOption('low');
    await page.getByRole('button', { name: 'Edit order' }).click();
    await page.getByRole('button', { name: /Move OpenAI up/ }).click();
    const run = page.getByRole('button', { name: 'Run sample reading' });
    await page.getByRole('button', { name: /Move OpenAI down/ }).press('Escape');
    await page.getByRole('button', { name: 'Edit order' }).press('Tab');
    await expect(run).toBeFocused();
    await run.scrollIntoViewIfNeeded();
    expect(await run.evaluate(button => {
      const bounds = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('sample-focus-320x' + height + '.png') });
    await run.click();
    await expect(page.getByText('Current draft', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save changes to Readings' }).click();
    await page.getByRole('button', { name: 'Run again' }).click();
    await page.getByRole('button', { name: 'Review my draft' }).press('Enter');
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
  });
}

test('masks the next key after sign-out and expiration', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('admin_api_key', 'expired-local-fixture'));
  await openEditor(page, { signIn: true });
  const key = page.getByLabel('Admin API Key');
  for (const reason of ['logout', 'expiry']) {
    await page.getByRole('link', { name: 'Skip to main content' }).press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await expect(key).toHaveValue('');
    await expect(key).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show key' }).click();
    await key.fill('local-browser-fixture');
    await page.getByRole('button', { name: 'Access Dashboard' }).click();
    if (reason === 'logout') await page.getByRole('button', { name: 'Sign out' }).click();
    else {
      await page.route('**/api/admin/ai-configuration/history*', route => route.fulfill({ status: 401 }));
      await page.getByRole('tab', { name: 'Change history' }).click();
    }
    await expect(key).toHaveValue('');
    await expect(key).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Show key' })).toBeVisible();
  }
});

async function verifyHistory(page) {
  const history = [];
  for (let revision = 28; revision > 0; revision -= 1) {
    for (const featureId of ['readings', 'journal-summaries']) {
      history.push({ featureId, revision, environment: 'preview', createdAt: '2026-11-19T12:34:00Z',
        actor: 'Shared admin credential', diff: [{ field: 'fallbacks.order', before: ['claude-api', 'modal-qwen'], after: ['modal-qwen', 'claude-api'] }] });
    }
  }
  await openEditor(page, { history });
  const historyPath = '**/api/admin/ai-configuration/history*';
  const unavailable = route => route.fulfill({
    status: 503, json: { error: 'History is temporarily unavailable.' }
  });
  await page.route(historyPath, unavailable);
  await page.getByRole('tab', { name: 'Change history' }).click();
  await expect(page.getByRole('alert')).toContainText('History is temporarily unavailable');
  await page.unroute(historyPath, unavailable);
  await page.getByRole('button', { name: 'Try again' }).click();
  const filter = page.getByRole('combobox', { name: 'Feature' });
  await filter.selectOption('readings');
  const rows = page.locator('.ai-record-list > li');
  await expect(rows).toHaveCount(25);
  await expect(rows.first().getByRole('list', { name: 'Before' }).getByRole('listitem')).toHaveText(['Anthropic', 'Modal']);
  await expect(rows.first().getByRole('list', { name: 'After' }).getByRole('listitem')).toHaveText(['Modal', 'Anthropic']);
  await expect(rows.first()).toContainText('Preview');
  await expect(rows.first().locator('time')).toHaveText('2026-11-19 12:34:00 UTC');
  await page.getByRole('button', { name: 'Load more changes' }).click();
  await expect(rows).toHaveCount(28);
  await expect(rows.locator('.ai-chip')).toHaveText(Array.from({ length: 28 }, (_, i) => 'Revision ' + (28 - i)));
  await filter.selectOption('journal-summaries');
  await expect(rows).toHaveCount(25);
  for (const id of FEATURE_IDS.filter(id => !['readings', 'journal-summaries'].includes(id))) {
    await filter.selectOption(id);
    await expect(page.getByText('No saved changes yet.')).toBeVisible();
  }
}

for (const timezoneId of ['America/Chicago', 'Australia/Adelaide']) {
  test.describe('History in ' + timezoneId, () => {
    test.use({ timezoneId });
    test('labels each fallback order and its UTC revision across pages and filters', async ({ page }) => {
      await verifyHistory(page);
    });
  });
}

test('attributes a follow-up excerpt to its repair and labels older receipts accurately', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: /Reading follow-ups/ }).click();
  const effort = page.getByLabel(/^Reasoning effort/);
  await effort.selectOption('high');
  let legacy = false;
  await page.route('**/features/reading-followups/samples/*', route => {
    const runId = new URL(route.request().url()).pathname.split('/').at(-1);
    const first = { slot: 0, providerId: 'claude-api', modelId: 'generation-model', modelSource: 'reported', effortSent: 'high' };
    return route.fulfill({ json: {
      runId, featureId: 'reading-followups', environment: 'preview', fixtureVersion: 'reading-followups-v1',
      status: 'completed', outcome: 'primary_accepted', excerpt: 'The Hermit invites a pause.',
      attempts: legacy ? [{ ...first, outcome: 'accepted' }] : [
        { ...first, phase: 'generation', outcome: 'superseded' },
        { ...first, phase: 'repair', outcome: 'accepted', modelId: 'repair-model', effortSent: 'low' }
      ]
    } });
  });
  await page.getByRole('button', { name: 'Run sample', exact: true }).click();
  await expect(page.getByText('Repaired by Anthropic / repair-model')).toBeVisible();
  await expect(page.getByText('Repair used Low reasoning')).toBeVisible();
  await expect(page.getByText('The Hermit invites a pause.')).toBeVisible();
  await effort.selectOption('medium');
  await expect(page.getByText('From an earlier draft')).toBeVisible();
  await expect(page.getByText(/Primary draft requested High · Current draft uses Medium/)).toBeVisible();
  legacy = true;
  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(page.getByText('Recorded generation Anthropic / generation-model')).toBeVisible();
  await expect(page.getByText('Delivery details are unavailable for this earlier run.')).toBeVisible();
  await expect(page.getByText(/Repaired by|Answered by/)).toHaveCount(0);
});

test('explains unavailable sample storage beside its disabled action', async ({ page }) => {
  await openEditor(page);
  const reason = 'Admin sample storage is unavailable. Bind ADMIN_AI_SAMPLES to this deployment.';
  await page.route('**/api/admin/ai-configuration', route => route.fulfill({ json: {
    catalogVersion: CATALOG_VERSION, environment: 'preview', writable: true, specialistInventory: [],
    features: [{ ...getFeature(fixtureEnv, 'readings'), revision: 0, baseToken: 'base-0',
      sampleAvailable: false, sampleUnavailableReason: reason }]
  } }));
  await page.reload();
  const run = page.getByRole('button', { name: 'Run sample reading' });
  await expect(run).toBeDisabled();
  await expect(run).toHaveAccessibleDescription(reason);
  await expect(page.getByText(reason)).toBeVisible();
});
