import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATALOG_VERSION, getFeature } from '../functions/lib/aiConfigCatalog.js';
import { getAvailableNarrativeBackends } from '../functions/lib/narrativeBackends.js';
import { withReadingPolicy } from '../functions/lib/readingConfigPolicy.js';
import { startReadingJob } from '../functions/lib/readingJobs.js';
import { onRequestPost as readingPost } from '../functions/api/tarot-reading.js';
import { createFakeReadingJobs, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { modalSseResponse } from './helpers/modalSse.mjs';

const payload = {
  spreadInfo: { name: 'One-Card Insight', key: 'single' },
  cardsInfo: [{ card: 'The Fool', position: 'Theme', orientation: 'Upright', meaning: 'Beginnings' }],
  userQuestion: 'What could I learn today?'
};

test('job admissions and restarts retain independent credential-free reading and gate policies', async () => {
  const env = { AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'preview', OPENAI_API_KEY: 'private-fixture-key', OPENAI_MODEL: 'gpt-6.1-sol' };
  const rows = new Map();
  const calls = [];
  const jobs = createFakeReadingJobs({ runReading: readingRunner({ calls }) });
  env.READING_JOBS = jobs.namespace;
  env.DB = { prepare: () => ({ bind: (environment, id) => ({ first: () => rows.get(id) }) }) };
  function save(id, revision, effort) {
    const policy = getFeature(env, id).policy;
    policy.primary.reasoningEffort = effort;
    rows.set(id, { revision, catalog_version: CATALOG_VERSION, policy_json: JSON.stringify(policy) });
  }
  save('readings', 2, 'medium');
  save('quality-gate', 1, 'high');
  const original = await startReadingJob({ env, payload: { ...payload, readingPolicies: { readings: { revision: 999 } } } });
  await jobs.settle();
  assert.equal(original.ok, true);
  assert.equal(calls[0].readingPolicies.readings.revision, 2);
  assert.equal(calls[0].readingPolicies['quality-gate'].policy.primary.reasoningEffort, 'high');
  assert.equal(calls[0].readingPolicies['reading-evaluation'], null);
  save('readings', 3, 'low');
  save('quality-gate', 2, 'low');
  const reloaded = await jobs.restart(original.jobId);
  const pinned = reloaded.job.readingPolicies;
  assert.equal(pinned.readings.policy.primary.reasoningEffort, 'medium');
  assert.equal(pinned['quality-gate'].revision, 1);
  assert.ok(!JSON.stringify(pinned).includes(env.OPENAI_API_KEY));
  assert.equal(withReadingPolicy({ ...env, OPENAI_MODEL: 'later-deployment' }, null, pinned.defaults).OPENAI_MODEL, 'gpt-6.1-sol');
  const next = await startReadingJob({ env, payload });
  await jobs.settle();
  assert.equal(next.ok, true);
  assert.equal(calls[1].readingPolicies.readings.revision, 3);
  assert.equal(calls[1].readingPolicies['quality-gate'].revision, 2);
});

test('reading adapter overrides are request-scoped and owner routing wins', () => {
  const env = { OPENAI_API_KEY: 'dummy', OPENAI_MODEL: 'original', ANTHROPIC_API_KEY: 'dummy' };
  const policy = { primary: { providerId: 'claude-api', modelId: 'target-claude', reasoningEffort: 'high' },
    fallbacks: [{ providerId: 'openai-native', modelId: 'target-openai', reasoningEffort: 'low' }, { providerId: 'local-composer' }] };
  const scoped = withReadingPolicy(env, policy);
  assert.equal(scoped.OPENAI_REASONING_EFFORT, 'low');
  assert.equal(scoped.ANTHROPIC_MODEL, 'target-claude');
  assert.equal(env.OPENAI_MODEL, 'original');
  assert.equal(env.ANTHROPIC_MODEL, undefined);
  assert.deepEqual(getAvailableNarrativeBackends(scoped, policy).map(step => step.id), ['claude-api', 'openai-native', 'local-composer']);
  const ownerEnv = { ...env, TEXT_PROVIDER: 'codex-subscription' };
  assert.equal(withReadingPolicy(ownerEnv, policy), ownerEnv);
  assert.deepEqual(getAvailableNarrativeBackends(ownerEnv, policy).map(step => step.id), ['codex-subscription', 'local-composer']);
});

test('an enabled configuration lookup failure leaves crisis support reachable and ordinary readings uncharged', async (t) => {
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {});
  const env = { AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'preview' };
  async function read(userQuestion) {
    return readingPost({ env, request: new Request('https://test/api/tarot-reading', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, userQuestion })
    }) });
  }
  const failed = await read('What could I try today?');
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).code, 'reading_configuration_unavailable');
  const crisis = await read('I want to kill myself');
  assert.equal((await crisis.json()).provider, 'safety-gate');
});

test('the direct reading API loads its saved remote primary, independently of client policy fields', async (t) => {
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {});
  const env = {
    AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'preview', OPENAI_API_KEY: 'dummy',
    OPENAI_STREAMING_ENABLED: 'true', EVAL_ENABLED: 'false', GRAPHRAG_ENABLED: 'false',
    MODAL_ENDPOINT_URL: 'https://model.test', MODAL_PROXY_TOKEN: 'synthetic'
  };
  const initial = getFeature(env, 'readings').policy;
  const policy = { primary: { ...initial.fallbacks[1], reasoningEffort: 'low' },
    fallbacks: [initial.fallbacks[0], initial.primary, initial.fallbacks[2]] };
  env.DB = { prepare: sql => ({
    bind: (_environment, featureId) => ({
      all: () => { assert.match(sql, /FROM ai_provider_connections/); return { results: [] }; },
      first: () => featureId === 'readings' ? { revision: 6, catalog_version: CATALOG_VERSION, policy_json: JSON.stringify(policy) } : null,
      run: () => ({ success: true, meta: { changes: 1 } })
    })
  }) };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return modalSseResponse('### The Fool — Theme\n\nThe Fool invites a fresh start. Because a small step can teach you something, consider what you could try today. Take one manageable action and note what you learn.\n\n### Guidance\n\nBegin with curiosity and leave room to change your mind.');
  });
  const response = await readingPost({ env, request: new Request('https://app/api/tarot-reading', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, policy: initial, readingPolicies: null })
  }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, 'modal-qwen');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://model.test/v1/chat/completions');
  assert.equal(calls[0].body.model, policy.primary.modelId);
  assert.equal(calls[0].body.reasoning_effort, 'low');
});
