import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overview, samples } from '../functions/api/admin/ai-configuration.js';
import { onRequestGet as ttsStatus } from '../functions/api/tts.js';
import { getFeature, specialistInventory } from '../functions/lib/aiConfigCatalog.js';
import { buildSelectiveEvalGatePolicy } from '../functions/lib/evalGatePolicy.js';
import { runSyncEvaluationGate } from '../functions/lib/evaluation.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const defaults = { AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'preview', ADMIN_API_KEY: 'fixture',
  OPENAI_API_KEY: 'fixture-provider' };
async function admin(env, path = '', options) {
  const request = new Request('https://fixture.invalid/api/admin/ai-configuration' + path, {
    headers: { Authorization: 'Bearer fixture' }, ...options
  });
  return options ? samples.onRequestPost({ env, request, params: { id: 'readings' } })
    : overview.onRequestGet({ env, request, params: {} });
}

test('the catalog and release endpoint use the same public provider selection as the runtime', async () => {
  const env = { ...defaults, DB: await createD1(), ADMIN_AI_SAMPLES: { idFromName() {}, get() {} } };
  for (const [value, publicRouting] of [[' Legacy ', true], ['claude-code', false], ['codex-subscription', false], ['bad-provider', false]]) {
    const config = { ...env, TEXT_PROVIDER: value };
    const catalog = await (await admin(config)).json();
    assert.equal(catalog.features.length, 7);
    const readings = catalog.features.find(feature => feature.id === 'readings');
    assert.equal(readings.writable, publicRouting);
    assert.equal(readings.sampleAvailable, publicRouting);
    if (!publicRouting) {
      assert.match(readings.sampleUnavailableReason, value === 'bad-provider' ? /invalid/i : /owner subscription/i);
      const denied = await admin(config, '/features/readings/samples', { method: 'POST',
        body: JSON.stringify({ runId: 'isolated', catalogVersion: catalog.catalogVersion, policy: readings.policy }) });
      assert.equal(denied.status, 403);
    }
    assert.equal(catalog.features.find(feature => feature.id === 'guided-questions').writable, true);
    assert.equal((await admin({ ...config, AI_CONFIG_ENVIRONMENT: 'production' }, '/release-settings')).status, publicRouting ? 200 : 503);
  }
  const missing = await (await admin({ ...env, ADMIN_AI_SAMPLES: undefined })).json();
  assert.match(missing.features[0].sampleUnavailableReason, /sample storage/i);
  assert.equal(missing.features[0].writable, true);
  const broken = await (await admin({ ...env, ADMIN_AI_SAMPLES: {} })).json();
  assert.equal(broken.features[0].sampleAvailable, false);
});

test('specialist inventory uses runtime readiness and keeps credentials private', async () => {
  const env = { AI: { run() {} }, VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/zai-org/glm-5.3',
    VISUAL_CUE_REASONING_EFFORT: 'medium', ELEVENLABS_API_KEY: '  ', FEATURE_STORY_ART: 'true' };
  const lookup = (config, label) => specialistInventory(config).find(row => row.label === label);
  const cue = lookup(env, 'Visual cues');
  assert.equal(lookup({ ...env, VISION_BACKEND_DEFAULT: 'unregistered' }, 'Card recognition').value, 'clip-default');
  assert.match(lookup({ VISION_BACKEND_DEFAULT: 'llama-vision', AI: {} }, 'Card recognition').status, /unavailable/i);
  assert.equal(cue.value, env.VISUAL_CUE_MODEL);
  assert.match(cue.status, /invalid.*reasoning/i);
  assert.equal(lookup({ ...env, VISUAL_CUE_REASONING_EFFORT: 'low' }, 'Visual cues').status, 'Ready');
  for (const ai of [env.AI, { run: true }, null]) {
    const config = { ...env, AI: ai };
    const ready = typeof ai?.run === 'function';
    const providers = (await (await ttsStatus({ env: config })).json()).providers;
    for (const [id, label] of [['elevenlabs', 'ElevenLabs'], ['deepgram', 'Deepgram']]) {
      const actual = providers.find(row => row.id === id);
      const display = lookup(config, 'Narration · ' + label);
      assert.equal(display.value, actual.model);
      assert.equal(display.status === 'Ready', actual.available);
      assert.equal(actual.available, id === 'deepgram' && ready);
    }
    assert.equal(lookup(config, 'Semantic embeddings').status === 'Ready', ready);
    assert.equal(lookup(config, 'Story illustrations').status === 'Ready', ready);
  }
  const connected = specialistInventory({ ...env, ELEVENLABS_API_KEY: 'private-test-value' });
  assert.equal(connected.find(row => row.label.endsWith('ElevenLabs')).status, 'Ready');
  assert.doesNotMatch(JSON.stringify(connected), /private-test-value/);
});

test('gate details follow ordinary, restricted and unsupported-language delivery rules', async () => {
  assert.equal(getFeature({ ...defaults, ENVIRONMENT: 'production' }, 'quality-gate').gatePolicy.failureMode, 'closed');
  for (const [evaluation, global, mode] of [[true, 'TRUE', 'open'], ['true', true, 'closed'], ['true', false, 'open'], [false, true, 'open']]) {
    const env = { ...defaults, EVAL_ENABLED: evaluation, EVAL_GATE_ENABLED: global, EVAL_GATE_FAILURE_MODE: mode };
    const summary = getFeature(env, 'quality-gate').gatePolicy;
    const ordinary = buildSelectiveEvalGatePolicy({ env, userQuestion: 'What comes next?' });
    assert.equal(summary.globalEnabled, ordinary.effectiveEvalGateEnabled);
    assert.equal(summary.gradingEnabled, Boolean(evaluation));
    assert.equal(summary.failureMode, mode);
    if (ordinary.effectiveEvalGateEnabled) {
      const result = await runSyncEvaluationGate(ordinary.effectiveEnv, { reading: 'A reflective reading.', cardsInfo: [] });
      assert.equal(result.passed, mode === 'open');
    }
    for (const inputs of [{ userQuestion: 'Help with my medication' }, { languageSupport: { supported: false, language: 'es' } }]) {
      const required = buildSelectiveEvalGatePolicy({ env, ...inputs });
      assert.equal(required.effectiveEnv.EVAL_GATE_FAILURE_MODE, 'closed');
      const result = await runSyncEvaluationGate(required.effectiveEnv, { reading: 'A reflective reading.', cardsInfo: [] });
      assert.equal(result.passed, false);
    }
  }
});
