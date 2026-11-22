import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { overview, assignment, samples, receipt } from '../functions/api/admin/ai-configuration.js';
import { resolveFeatureConfig } from '../functions/lib/aiConfigStore.js';
import { CATALOG_VERSION, getFeature, normalizePolicy } from '../functions/lib/aiConfigCatalog.js';
import { sha256Hex } from '../functions/lib/crypto.js';
import { generateQuestionWithWorkersAI } from '../functions/api/generate-question.js';
import { runTextFeatureSample } from '../functions/lib/aiFeatureSamples.js';
import { fetchReleaseSettings } from '../scripts/evaluation/runReleaseChecks.js';

const origin = 'https://test.invalid/api/admin/ai-configuration';
async function environment() {
  return { DB: await createD1(), AI_CONFIG_ENVIRONMENT: 'local', AI_CONFIG_ENABLED: 'true',
    ADMIN_API_KEY: 'fixture-admin', OPENAI_API_KEY: 'fixture-provider', OPENAI_MODEL: 'gpt-6.1-sol', OPENAI_REASONING_EFFORT: 'high' };
}
function request(handler, env, { method = 'GET', path = '', params = {}, body, auth = 'fixture-admin' } = {}) {
  return handler({ env, params, request: new Request(origin + path, {
    method, headers: { Authorization: 'Bearer ' + auth }, ...(body && { body: JSON.stringify(body) })
  }) });
}
function save(env, body) {
  return request(assignment.onRequestPut, env, { method: 'PUT', path: '/features/readings', params: { id: 'readings' }, body });
}
function mutation(feature, effort, id = crypto.randomUUID()) {
  return { mutationId: id, baseRevision: feature.revision, baseToken: feature.baseToken,
    policy: { ...feature.policy, primary: { ...feature.policy.primary, reasoningEffort: effort } } };
}
async function getReading(env) {
  const res = await request(overview.onRequestGet, env);
  assert.equal(res.status, 200);
  const view = await res.json();
  assert.equal(view.features.length, 7);
  return view.features.find(feature => feature.id === 'readings');
}

describe('admin AI configuration', () => {
  it('authenticates every endpoint and exposes only configuration metadata', async () => {
    const env = await environment();
    for (const [handler, method, path, params] of [
      [overview.onRequestGet, 'GET', '/connections'], [overview.onRequestGet, 'GET', '/history'],
      [assignment.onRequestPut, 'PUT', '/features/readings', { id: 'readings' }],
      [samples.onRequestPost, 'POST', '/features/readings/samples', { id: 'readings' }],
      [receipt.onRequestGet, 'GET', '/features/readings/samples/example', { id: 'readings', runId: 'example' }]
    ]) {
      const res = await request(handler, env, { method, path, params, auth: 'ordinary-user' });
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
    }
    env.MODAL_PROXY_TOKEN_ID = 'private-test-value';
    for (const path of ['', '/connections']) {
      const res = await request(overview.onRequestGet, env, { path });
      const text = await res.text();
      assert.doesNotMatch(text, /private-test-value|fixture-admin|fixture-provider/);
      assert.match(text, /MODAL_PROXY_TOKEN_SECRET/);
    }
  });

  it('publishes one immutable revision, handles lost responses and isolates feature and environment', async () => {
    const env = await environment();
    const initial = await getReading(env);
    const first = mutation(initial, 'medium');
    const results = await Promise.all([save(env, first), save(env, first)]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    const [a, b] = await Promise.all(results.map(r => r.json()));
    assert.deepEqual(a, b);
    assert.equal(a.revision, 1);
    const second = mutation(a, 'low');
    assert.equal((await save(env, second)).status, 200);
    assert.deepEqual(await (await save(env, first)).json(), a);
    assert.equal((await save(env, { ...second, mutationId: first.mutationId })).status, 409);
    assert.equal((await save(env, mutation(initial, 'low'))).status, 409);
    const history = await (await request(overview.onRequestGet, env, { path: '/history?feature=readings' })).json();
    assert.deepEqual(history.entries.map(item => item.revision), [2, 1]);
    assert.equal(history.entries[0].actor, 'Shared admin credential');
    assert.deepEqual(history.entries[0].diff, [{ field: 'primary.reasoningEffort', before: 'medium', after: 'low' }]);
    assert.equal((await resolveFeatureConfig(env, 'readings')).policy.primary.reasoningEffort, 'low');
    assert.equal(await resolveFeatureConfig(env, 'reading-followups'), null);
    assert.equal(await resolveFeatureConfig({ ...env, AI_CONFIG_ENVIRONMENT: 'preview' }, 'readings'), null);
  });

  it('rejects incompatible controls, a changed base, an unconfigured promotion and competing edits', async () => {
    const env = await environment();
    const feature = await getReading(env);
    function edit(fn) {
      const body = mutation(structuredClone(feature), 'medium');
      fn(body.policy);
      return save(env, body);
    }
    assert.equal((await edit(p => { p.primary.endpoint = 'https://example.invalid'; })).status, 422);
    assert.equal((await edit(p => { p.primary.modelId = 'arbitrary'; })).status, 422);
    assert.equal((await edit(p => { [p.fallbacks[0], p.fallbacks[2]] = [p.fallbacks[2], p.fallbacks[0]]; })).status, 422);
    assert.equal((await edit(p => { [p.primary, p.fallbacks[0]] = [p.fallbacks[0], p.primary]; })).status, 422);
    assert.equal((await save(env, mutation(feature, 'high'))).status, 422);
    assert.equal((await save({ ...env, OPENAI_MODEL: 'gpt-5.6-sol' }, mutation(feature, 'medium'))).status, 409);
    const concurrent = await Promise.all([save(env, mutation(feature, 'medium')), save(env, mutation(feature, 'low'))]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  });

  it('submits an immutable sample separately from history and keeps credential and reader inputs off the job', async () => {
    const env = await environment();
    let submission;
    env.ADMIN_AI_SAMPLES = { idFromName: name => name, get: name => ({ fetch: async (_url, init) => {
      assert.equal(name, 'local');
      submission = JSON.parse(init.body);
      return Response.json({}, { status: 202 });
    } }) };
    const feature = await getReading(env);
    const body = { catalogVersion: CATALOG_VERSION, runId: 'try-medium', policy: mutation(feature, 'medium').policy };
    const submit = input => request(samples.onRequestPost, env, { method: 'POST', params: { id: 'readings' }, path: '/features/readings/samples', body: input });
    assert.equal((await submit({ ...body, userQuestion: 'custom' })).status, 422);
    const res = await submit(body);
    assert.equal(res.status, 202);
    assert.match((await res.json()).pollUrl, /\/try-medium$/);
    assert.equal(submission.policy.primary.reasoningEffort, 'medium');
    assert.match(submission.policyFingerprint, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(submission), /fixture-provider|fixture-admin/);
    assert.equal(await resolveFeatureConfig(env, 'readings'), null);
  });

  it('inherits adapter defaults for a deployment model with unlisted capabilities', async () => {
    const env = { ...await environment(), EVAL_MODEL: 'deployment-specific-model' };
    const catalog = await (await request(overview.onRequestGet, env)).json();
    const grader = catalog.features.find(item => item.id === 'reading-evaluation');
    assert.equal(grader.policy.primary.modelId, env.EVAL_MODEL);
    assert.equal(grader.policy.primary.reasoningEffort, undefined);
    assert.deepEqual(grader.providers[0].models.find(model => model.id === env.EVAL_MODEL).efforts, []);
    const response = await request(assignment.onRequestPut, env, {
      method: 'PUT', path: '/features/reading-evaluation', params: { id: 'reading-evaluation' }, body: mutation(grader, 'high')
    });
    assert.equal(response.status, 422);
  });

  it('ties the release contract to production and fails closed on an unusable response', async () => {
    const env = await environment();
    const fetchRelease = source => fetchReleaseSettings('fixture-admin', (_url, init) => {
      assert.equal(init.redirect, 'error');
      return request(overview.onRequestGet, source, { path: '/release-settings' });
    });
    await assert.rejects(fetchRelease(env));
    await assert.rejects(fetchRelease({ ...env, AI_CONFIG_ENVIRONMENT: 'production', OPENAI_API_KEY: '' }));
    await assert.rejects(fetchRelease({ ...env, AI_CONFIG_ENVIRONMENT: 'production', TEXT_PROVIDER: 'claude-code' }));
    const actual = await fetchRelease({ ...env, AI_CONFIG_ENVIRONMENT: 'production' });
    assert.equal(actual.providerId, 'openai-native');
    assert.equal(actual.modelId, 'gpt-6.1-sol');
    assert.equal(actual.reasoningEffort, 'high');
    assert.equal(actual.revision, 0);
    assert.match(actual.fingerprint, /^[a-f0-9]{64}$/);
  });

  for (const slot of [0, 1]) {
    it('isolates and repairs a retired deployment model in slot ' + slot, async () => {
      const env = { ...await environment(), OPENAI_MODEL: 'retiring-openai-model', ANTHROPIC_API_KEY: 'fixture' };
      const initial = await getReading(env);
      const policy = structuredClone(initial.policy);
      if (slot) [policy.primary, policy.fallbacks[0]] = [policy.fallbacks[0], policy.primary];
      else [policy.fallbacks[0], policy.fallbacks[1]] = [policy.fallbacks[1], policy.fallbacks[0]];
      const first = { policy, mutationId: 'first', baseRevision: 0, baseToken: initial.baseToken };
      const firstReceipt = await (await save(env, first)).json();
      env.OPENAI_MODEL = 'replacement-openai-model';
      const overviewResult = await request(overview.onRequestGet, env);
      assert.equal(overviewResult.status, 200);
      const catalog = await overviewResult.json();
      const repair = catalog.features.find(f => f.id === 'readings');
      assert.equal(catalog.features.filter(f => f.policyStatus === 'ready').length, 6);
      assert.equal(repair.policyStatus, 'repair_required');
      assert.deepEqual(repair.retiredModels, [{ providerId: 'openai-native', modelId: 'retiring-openai-model', slot }]);
      assert.deepEqual(repair.policy, policy);
      assert.equal(repair.revision, 1);
      assert.notEqual(repair.baseToken, firstReceipt.baseToken);
      await assert.rejects(resolveFeatureConfig(env, 'readings'), { code: 'retired_model' });
      assert.deepEqual(await (await save(env, first)).json(), firstReceipt);
      const updated = structuredClone(repair.policy);
      [updated.primary, ...updated.fallbacks][slot].modelId = env.OPENAI_MODEL;
      const second = { mutationId: 'repair', baseRevision: 1, baseToken: repair.baseToken, policy: updated };
      const saved = await save(env, second);
      assert.equal(saved.status, 200);
      assert.deepEqual(await (await save(env, second)).json(), await saved.json());
      assert.equal((await save(env, { ...second, mutationId: 'another-writer' })).status, 409);
      assert.equal((await getReading(env)).policyStatus, 'ready');
      assert.deepEqual((await resolveFeatureConfig(env, 'readings')).policy, updated);
      const history = await (await request(overview.onRequestGet, env, { path: '/history?feature=readings' })).json();
      assert.deepEqual(history.entries.map(row => row.revision), [2, 1]);
      assert.equal(history.entries[0].diff[0].before, 'retiring-openai-model');
    });
  }

  it('reports a changed deployment catalog before validating the model in an already-open draft', async () => {
    const env = { ...await environment(), OPENAI_MODEL: 'old-deployment' };
    const feature = await getReading(env);
    const draft = { baseRevision: feature.revision, baseToken: feature.baseToken, mutationId: 'open-draft', policy: feature.policy };
    const fallbacks = draft.policy.fallbacks;
    [fallbacks[0], fallbacks[1]] = [fallbacks[1], fallbacks[0]];
    env.OPENAI_MODEL = 'new-deployment';
    const response = await save(env, draft);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'stale_base');
    const current = await getReading(env);
    assert.equal(current.policy.primary.modelId, env.OPENAI_MODEL);
    assert.equal(current.revision, 0);
  });

  it('isolates a newer schema and refuses to overwrite it, while D1 failure remains a service error', async () => {
    const env = await environment();
    const baseline = await getReading(env);
    await save(env, mutation(baseline, 'medium'));
    await env.DB.prepare("UPDATE ai_feature_config_revisions SET catalog_version='future'").run();
    const feature = await getReading(env);
    assert.equal(feature.policyStatus, 'migration_required');
    assert.equal(feature.writable, false);
    assert.match(feature.readOnlyReason, /migration/i);
    assert.equal(feature.revision, 1);
    assert.equal((await save(env, mutation(feature, 'low'))).status, 503);
    await assert.rejects(resolveFeatureConfig(env, 'readings'), { code: 'incompatible_revision' });
    assert.equal((await request(overview.onRequestGet, { ...env, DB: null })).status, 503);
  });

  it('preserves historical GLM efforts and replays their original digest while rejecting a new Medium', async () => {
    const env = { ...await environment(), QUESTION_REASONING_EFFORT: 'medium' };
    const features = (await (await request(overview.onRequestGet, env)).json()).features;
    const guided = features.find(f => f.id === 'guided-questions');
    for (const feature of features.filter(f => f.policy.primary.providerId === 'workers-ai')) {
      for (const model of feature.providers[0].models) assert.deepEqual(model.efforts, ['low', 'high', 'max']);
    }
    assert.equal(guided.policy.primary.reasoningEffort, 'max');
    assert.equal(guided.effortAlias.source, 'deployment');
    const oldDefault = structuredClone(guided);
    oldDefault.policy.primary.reasoningEffort = 'high';
    oldDefault.baseToken = await sha256Hex(JSON.stringify(['local', '1', guided.id, oldDefault.policy, 0]));
    const legacy = mutation(oldDefault, 'medium', 'legacy-write');
    const digest = await sha256Hex(JSON.stringify([0, legacy.baseToken, legacy.policy]));
    await env.DB.prepare(`INSERT INTO ai_feature_config_revisions
      (environment,feature_id,revision,catalog_version,policy_json,diff_json,issued_token,mutation_id,request_digest,request_id,actor,created_at)
      VALUES ('local','guided-questions',1,'1',?,?,?,'legacy-write',?,'test','Admin','2026-11-19')`)
      .bind(JSON.stringify(legacy.policy), JSON.stringify([{ field: 'primary.reasoningEffort', before: 'high', after: 'medium' }]),
        'a'.repeat(64), digest).run();
    const change = body => request(assignment.onRequestPut, env, { method: 'PUT', params: { id: guided.id }, body });
    const { features: stored } = await (await request(overview.onRequestGet, env)).json();
    const viewed = stored.find(f => f.id === guided.id);
    assert.equal(viewed.policyStatus, 'ready');
    assert.equal(viewed.policy.primary.reasoningEffort, 'max');
    assert.deepEqual(viewed.effortAlias, { source: 'revision', original: 'medium', effective: 'max' });
    assert.equal((await resolveFeatureConfig(env, guided.id)).policy.primary.reasoningEffort, 'max');
    const replay = await change(legacy);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).policy.primary.reasoningEffort, 'medium');
    assert.equal((await change(mutation(viewed, 'medium'))).status, 422);
    assert.equal((await change(mutation(viewed, 'max'))).status, 422);
    assert.equal((await request(samples.onRequestPost, env, { method: 'POST', params: { id: guided.id },
      body: { catalogVersion: CATALOG_VERSION, policy: legacy.policy, runId: 'invalid' } })).status, 422);
    const calls = [];
    await generateQuestionWithWorkersAI({ ...env, AI: { async run(model, body) {
      calls.push([model, body.reasoning_effort]); return { response: 'What can I practice today?' };
    } } }, 'Learning a craft', { focus: 'creativity' });
    assert.equal(calls[0][1], 'max');
    assert.equal((await change(mutation(viewed, 'low'))).status, 200);
    const history = await (await request(overview.onRequestGet, env, { path: '/history?feature=guided-questions' })).json();
    assert.equal(history.entries[0].diff[0].before, 'medium');
    assert.deepEqual(history.entries[1].diff[0], { field: 'primary.reasoningEffort', before: 'high', after: 'medium' });
  });

  it('applies the three GLM effort levels in all four Workers editors and reports actual sample payloads', async () => {
    const calls = [];
    const env = { ...await environment(), EVAL_ENABLED: 'true', AI: { async run(model, body) {
      calls.push([model, body.reasoning_effort]);
      if (body.response_format) return { response: JSON.stringify({
        personalization: 4, tarot_coherence: 4, tone: 4, safety: 5, overall: 4, safety_flag: false
      }) };
      if (body.temperature === 0.1) return { response: ['Practice a small step'] };
      return { response: 'What small step can I practice today?' };
    } } };
    for (const id of ['guided-questions', 'coach-action-extraction', 'reading-evaluation', 'quality-gate']) {
      const feature = getFeature(env, id);
      for (const model of feature.providers[0].models) {
        const policy = structuredClone(feature.policy);
        policy.primary.modelId = model.id;
        policy.primary.reasoningEffort = 'medium';
        assert.throws(() => normalizePolicy(feature, policy), { code: 'invalid_policy' });
        policy.primary.reasoningEffort = 'max';
        const result = await runTextFeatureSample({ env, featureId: id, policy: normalizePolicy(feature, policy), requestId: 'model-fixture' });
        assert.equal(result.outcome, 'primary_accepted', id);
        assert.deepEqual(calls.at(-1), [model.id, 'max']);
        assert.equal(result.attempts[0].effortSent, 'max');
      }
    }
  });
});
