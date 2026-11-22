import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeFeature, savePolicy } from '../functions/lib/aiConfigStore.js';
import { getFeature } from '../functions/lib/aiConfigCatalog.js';
import { runTextFeatureSample } from '../functions/lib/aiFeatureSamples.js';
import { onRequestPost as ask } from '../functions/api/generate-question.js';
import { onRequestPost as followUp } from '../functions/api/reading-followup.js';
import { onRequestPost as summarize } from '../functions/api/journal-summary.js';
import { extractNextStepsWithAI } from '../functions/lib/coachSuggestion.js';
import { runEvaluation } from '../functions/lib/evaluation.js';
import { withGradingPolicies } from '../functions/lib/textFeaturePolicy.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser, jsonRequest } from './helpers/journalFixtures.mjs';
import { claudeSseResponse } from './helpers/claudeSse.mjs';

const full = '@cf/zai-org/glm-5.3';
const flash = '@cf/zai-org/glm-5.3-flash';
const scores = { personalization: 4, tarot_coherence: 4, tone: 4, safety: 5, overall: 4, safety_flag: false };
const answer = 'The Hermit invites you to set aside a few quiet minutes to work on one idea.';
const request = (path, body) => jsonRequest('https://tableu.test/api/' + path, {
  body, headers: { Cookie: 'session=session-1' }
});

async function setup(t) {
  const DB = await createD1();
  t.after(() => DB.sqlite.close());
  await seedUser(DB, { tier: 'plus' });
  await seedSession(DB);
  await seedEntry(DB);
  return { DB, AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'local', EVAL_ENABLED: 'true' };
}

async function publish(env, id, update) {
  const feature = await describeFeature(env, id);
  update(feature.policy);
  return savePolicy(env, id, {
    policy: feature.policy, baseRevision: feature.revision, baseToken: feature.baseToken, mutationId: crypto.randomUUID()
  }, 'Test publisher');
}

test('published Workers assignments reach guided questions, extraction and independently pinned graders', async t => {
  const env = await setup(t);
  const calls = [];
  env.AI = { run: async (model, body) => {
    calls.push([model, body.reasoning_effort]);
    if (body.response_format) return { response: JSON.stringify(scores) };
    if (body.temperature === 0.1) return { response: ['Make a sketch'] };
    return { response: 'What helps me begin my creative project?' };
  } };
  const change = (modelId, reasoningEffort) => policy => Object.assign(policy.primary, { modelId, reasoningEffort });
  await publish(env, 'guided-questions', change(flash, 'low'));
  await publish(env, 'coach-action-extraction', change(full, 'high'));
  const firstGrade = await publish(env, 'reading-evaluation', change(flash, 'high'));
  const firstGate = await publish(env, 'quality-gate', change(full, 'high'));
  const oldJobEnv = withGradingPolicies(env, { 'reading-evaluation': firstGrade, 'quality-gate': firstGate });
  await publish(env, 'reading-evaluation', change(full, 'low'));
  await publish(env, 'quality-gate', change(flash, 'low'));
  const question = await ask({ env, request: request('generate-question', {
    prompt: 'Help me phrase a question about a creative project', metadata: { spreadKey: 'threeCard' }
  }) });
  assert.equal((await question.json()).provider, 'workers-ai');
  assert.deepEqual((await extractNextStepsWithAI(env, answer)).steps, ['Make a sketch']);
  for (const [context, gate] of [[oldJobEnv, false], [oldJobEnv, true], [env, false], [env, true]]) {
    const evaluated = await runEvaluation(context, { spreadKey: 'single', reading: answer, gate });
    assert.equal(evaluated.scores.overall, 4);
  }
  assert.deepEqual(calls, [[flash, 'low'], [full, 'high'], [flash, 'high'], [full, 'high'], [full, 'low'], [flash, 'low']]);
  assert.equal(env.QUESTION_MODEL, undefined);
});

test('one saved follow-up primary can change providers without changing journal summaries', async t => {
  const env = Object.assign(await setup(t), {
    OPENAI_API_KEY: 'fixture', ANTHROPIC_API_KEY: 'fixture', OPENAI_BASE_URL: 'https://openai.test',
    FEATURE_FOLLOW_UP_ENABLED: 'true', FEATURE_FOLLOW_UP_MEMORY: 'false'
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).startsWith('https://openai.test/')) {
      calls.push(['openai', body.model, body.reasoning.effort]);
      return Response.json({ status: 'completed', output_text: answer, output: [{ type: 'message', content: [{ type: 'output_text', text: answer }] }] });
    }
    calls.push(['claude', body.model, body.output_config.effort]);
    return claudeSseResponse(answer);
  });
  await publish(env, 'reading-followups', policy => {
    [policy.primary, policy.fallbacks[0]] = [policy.fallbacks[0], policy.primary];
    Object.assign(policy.primary, { modelId: 'gpt-6.1-sol', reasoningEffort: 'high' });
  });
  await publish(env, 'journal-summaries', policy => { policy.primary.reasoningEffort = 'low'; });
  const result = await followUp({ env, request: request('reading-followup', {
    requestId: 'fixture-reading', followUpQuestion: 'How should I begin my practice?',
    readingContext: { narrative: answer, cardsInfo: [{ card: 'The Hermit', position: 'Focus' }] }, options: { stream: false }
  }) });
  assert.equal((await result.json()).meta.provider, 'openai-native');
  assert.equal((await (await summarize({ env, request: request('journal-summary', {}) })).json()).meta.provider, 'claude-api');
  assert.deepEqual(calls, [['openai', 'gpt-6.1-sol', 'high'], ['claude', 'claude-opus-5-5', 'low']]);
});

test('all six synthetic previews exercise the chosen adapter or report its fallback without any reader data access', async t => {
  let touchedReaderData = false;
  const env = {
    DB: { prepare() { touchedReaderData = true; throw new Error('Reader storage accessed'); } },
    AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'preview', EVAL_ENABLED: 'true',
    ANTHROPIC_API_KEY: 'fixture', OPENAI_API_KEY: 'fixture', OPENAI_BASE_URL: 'https://openai.test',
    AI: { run: async (_, body) => {
      if (body.response_format) return { response: JSON.stringify(scores), model: 'reported-grader' };
      if (body.temperature === 0.1) return { response: ['Set aside ten minutes'], model: 'reported-extractor' };
      return { response: 'What can I learn from writing down the first idea?' };
    } }
  };
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).startsWith('https://openai.test/')) return new Response('', { status: 401 });
    return claudeSseResponse(answer);
  });
  const sample = async featureId => {
    const { policy } = getFeature(env, featureId);
    return runTextFeatureSample({ env, featureId, policy, requestId: 'fixed-sample' });
  };
  for (const id of ['guided-questions', 'coach-action-extraction', 'reading-evaluation', 'quality-gate', 'journal-summaries', 'reading-followups']) {
    const result = await sample(id);
    assert.equal(result.outcome, 'primary_accepted', id + ': ' + result.excerpt);
    assert.ok(result.excerpt);
    assert.equal(result.attempts[0].slot, 0);
    assert.equal(result.attempts[0].modelSource, id === 'guided-questions' ? 'configured' : 'reported');
  }
  const promoted = getFeature(env, 'reading-followups').policy;
  [promoted.primary, promoted.fallbacks[0]] = [promoted.fallbacks[0], promoted.primary];
  const fallback = await runTextFeatureSample({ env, featureId: 'reading-followups', policy: promoted, requestId: 'draft-fallback' });
  assert.equal(fallback.outcome, 'fallback_accepted');
  assert.deepEqual(fallback.attempts.map(step => [step.slot, step.providerId, step.outcome]),
    [[0, 'openai-native', 'failed'], [1, 'claude-api', 'accepted']]);
  env.AI = null;
  assert.equal((await sample('guided-questions')).outcome, 'local_fallback');
  assert.equal((await sample('coach-action-extraction')).outcome, 'failed');
  delete env.ANTHROPIC_API_KEY;
  const journal = await sample('journal-summaries');
  assert.equal(journal.outcome, 'local_fallback');
  assert.deepEqual(journal.attempts.map(step => [step.slot, step.outcome]), [[0, 'skipped'], [1, 'failed'], [2, 'accepted']]);
  env.TEXT_PROVIDER = 'codex-subscription';
  assert.deepEqual((await sample('reading-followups')).attempts, []);
  assert.equal(touchedReaderData, false);
});

test('follow-up receipts identify the call that supplied the delivered excerpt', async t => {
  const original = 'The Tower asks you to consider a fresh approach.';
  const unsafe = 'The Hermit says you will die.';
  const cases = [
    { name: 'clean answer', texts: [answer], outcomes: ['accepted'], excerpt: answer },
    { name: 'grounded repair', texts: [original, answer], outcomes: ['superseded', 'accepted'], excerpt: answer },
    { name: 'repair on a fallback', texts: [original, answer], fallback: true, outcomes: ['superseded', 'accepted'], excerpt: answer },
    { name: 'repair without a reported model', texts: [original, answer], omitModel: true, outcomes: ['superseded', 'accepted'], excerpt: answer },
    { name: 'ungrounded repair', texts: [original, original], outcomes: ['accepted', 'rejected'], excerpt: original },
    { name: 'failed repair', texts: [original, null], outcomes: ['accepted', 'failed'], excerpt: original },
    { name: 'unsafe generation', texts: [unsafe], outcomes: ['rejected'], safety: true },
    { name: 'unsafe repair', texts: [original, unsafe], outcomes: ['rejected', 'rejected'], safety: true }
  ];
  for (const fixture of cases) await t.test(fixture.name, async t => {
    const env = { OPENAI_API_KEY: 'fixture', OPENAI_BASE_URL: 'https://followup.test', OPENAI_MODEL: 'gpt-6.1-sol' };
    const { policy } = getFeature(env, 'reading-followups');
    const openAI = policy.fallbacks[0];
    openAI.reasoningEffort = 'high';
    if (!fixture.fallback) [policy.primary, policy.fallbacks[0]] = [openAI, policy.primary];
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.ok(String(url).startsWith('https://followup.test/'));
      const body = JSON.parse(options.body);
      calls.push(body.reasoning.effort);
      const response = fixture.texts[calls.length - 1];
      if (response == null) return new Response('', { status: 401 });
      return Response.json({ status: 'completed', output_text: response,
        model: fixture.omitModel && calls.length === 2 ? undefined : 'actual-' + calls.length });
    });
    const result = await runTextFeatureSample({ env, featureId: 'reading-followups', policy, requestId: 'test-followup' });
    assert.deepEqual(calls, fixture.texts.length === 1 ? ['high'] : ['high', 'low']);
    const attempts = result.attempts.filter(item => item.providerId === 'openai-native');
    assert.deepEqual(attempts.map(item => item.phase), fixture.texts.length === 1 ? ['generation'] : ['generation', 'repair']);
    assert.deepEqual(attempts.map(item => item.outcome), fixture.outcomes);
    assert.ok(attempts.every(item => item.slot === (fixture.fallback ? 1 : 0)));
    assert.equal(attempts[0].modelId, 'actual-1');
    assert.equal(attempts[0].effortSent, 'high');
    if (attempts[1] && fixture.texts[1]) {
      assert.equal(attempts[1].modelId, fixture.omitModel ? openAI.modelId : 'actual-2');
      assert.equal(attempts[1].modelSource, fixture.omitModel ? 'configured' : 'reported');
      assert.equal(attempts[1].effortSent, 'low');
    }
    if (fixture.safety) {
      assert.equal(result.outcome, 'safety_replaced');
      assert.ok(result.excerpt && !result.excerpt.includes(unsafe));
    } else {
      assert.equal(result.outcome, fixture.fallback ? 'fallback_accepted' : 'primary_accepted');
      assert.equal(result.excerpt, fixture.excerpt);
    }
  });
});

test('Claude and Modal repairs report the effort actually sent by their own adapters', async t => {
  for (const provider of ['claude-api', 'modal-qwen']) await t.test(provider, async t => {
    const env = provider === 'claude-api' ? { ANTHROPIC_API_KEY: 'fixture' } : {
      MODAL_PROXY_TOKEN: 'fixture', MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_REASONING_EFFORT: 'high'
    };
    const { policy } = getFeature(env, 'reading-followups');
    const steps = [policy.primary, ...policy.fallbacks];
    const slot = steps.findIndex(step => step.providerId === provider);
    steps[slot].reasoningEffort = 'medium';
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.equal(new URL(url).hostname, provider === 'claude-api' ? 'api.anthropic.com' : 'modal.test');
      const body = JSON.parse(options.body);
      calls.push(body.output_config?.effort || body.reasoning_effort);
      const text = calls.length === 1 ? 'The Tower asks for quiet reflection.' : answer;
      const model = provider + '-' + calls.length;
      return provider === 'claude-api' ? claudeSseResponse(text, { model })
        : Response.json({ model, choices: [{ index: 0, message: { content: text }, finish_reason: 'stop' }] });
    });
    const result = await runTextFeatureSample({ env, featureId: 'reading-followups', policy, requestId: 'test-repair' });
    assert.equal(result.excerpt, answer);
    assert.deepEqual(calls, ['medium', provider === 'claude-api' ? 'low' : 'high']);
    const recorded = result.attempts.filter(attempt => attempt.providerId === provider);
    assert.deepEqual(recorded.map(attempt => attempt.effortSent), calls);
    assert.deepEqual(recorded.map(attempt => attempt.modelId), [provider + '-1', provider + '-2']);
    assert.deepEqual(recorded.map(attempt => [attempt.slot, attempt.phase, attempt.outcome]),
      [[slot, 'generation', 'superseded'], [slot, 'repair', 'accepted']]);
  });
});
