import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runReadingConfigSample } from '../functions/lib/readingConfigSample.js';
import { getFeature } from '../functions/lib/aiConfigCatalog.js';
import { READING_CONFIG_FIXTURE } from '../shared/contracts/aiConfigSample.js';

const ENV = { GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false', OPENAI_MODEL: 'gpt-6.1-sol' };
const output = [
  '### Opening', 'A change of chapter calls for a new intention.',
  '### Past — The Hermit', 'The Hermit asks you to pause and clarify your priorities. Give yourself time to reflect on what you have learned. Choose one insight to carry forward.',
  '### Present — Two of Wands', 'The Two of Wands invites you to consider where to go next. Weigh two possibilities against your values. Choose a small step to explore.',
  '### Future — Eight of Pentacles', 'The Eight of Pentacles offers a way to deepen a skill. Give a simple practice time to develop. Notice what it teaches you.',
  '### Synthesis', 'Reflection can inform a deliberate next step. Consider what practice you want to begin.'
].join('\n\n');

function quiet(t) {
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {});
}

function sceneEnvelope(text) {
  return JSON.stringify({ format: 'card-scenes-v1', blocks: [{ type: 'prose', text }] });
}

test('fixed reading fixture tests the actual draft, reports the response model, and writes no reader data', async (t) => {
  quiet(t);
  const writes = [];
  const env = {
    ...ENV, OPENAI_API_KEY: 'dummy', OPENAI_REASONING_EFFORT: 'high', AB_TESTING_ENABLED: 'true', PERSIST_PROMPTS: 'true',
    DB: { prepare(sql) { writes.push(sql); throw new Error('Unexpected reader storage'); } },
    RATELIMIT: { put() { writes.push('quota'); } }
  };
  const policy = getFeature(env, 'readings').policy;
  policy.primary.reasoningEffort = 'low';
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    sent = JSON.parse(options.body);
    return Response.json({ model: 'gpt-6.1-sol-reported', status: 'completed', output_text: sceneEnvelope(output) });
  });
  const result = await runReadingConfigSample(env, policy);
  assert.equal(result.outcome, 'primary_accepted', JSON.stringify(result));
  assert.equal(result.attempts[0].modelId, 'gpt-6.1-sol-reported');
  assert.equal(result.attempts[0].modelSource, 'reported');
  assert.equal(result.attempts[0].effortSent, 'low');
  assert.equal(sent.model, policy.primary.modelId);
  assert.equal(sent.reasoning.effort, 'low');
  assert.equal(env.OPENAI_REASONING_EFFORT, 'high');
  for (const card of READING_CONFIG_FIXTURE.cards) assert.ok(JSON.stringify(sent.input).includes(card));
  assert.ok(JSON.stringify(sent.input).includes(READING_CONFIG_FIXTURE.question));
  assert.deepEqual(writes, []);
});

test('an unavailable primary and rejected fallback are distinct from the delivered local composer', async (t) => {
  quiet(t);
  const env = { ...ENV, OPENAI_API_KEY: 'dummy' };
  const { primary, fallbacks } = getFeature(env, 'readings').policy;
  const policy = { primary: fallbacks[0], fallbacks: [primary, ...fallbacks.slice(1)] };
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ status: 'completed', output_text: sceneEnvelope('The Fool speaks.') }));
  const result = await runReadingConfigSample(env, policy);
  assert.equal(result.outcome, 'local_fallback', JSON.stringify(result));
  assert.deepEqual(result.attempts.map(({ slot, outcome }) => [slot, outcome]), [
    [0, 'skipped'], [1, 'rejected'], [2, 'skipped'], [3, 'accepted']
  ]);
  assert.equal(result.attempts[1].reason, 'quality_rejected');
  assert.equal(result.attempts[1].modelSource, 'configured');
  assert.equal(result.attempts[3].providerId, 'local-composer');
  assert.equal(result.attempts[3].modelId, undefined);
  assert.ok(result.excerpt.trim());
});

test('a public draft cannot route samples through an owner subscription', async (t) => {
  const env = { ...ENV, TEXT_PROVIDER: 'claude-code' };
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected call'); });
  await assert.rejects(runReadingConfigSample(env, getFeature(env, 'readings').policy), /personal subscription/);
  assert.equal(fetch.mock.callCount(), 0);
});

for (const blocked of [false, true]) {
  test(`streamed sample uses the draft and reports ${blocked ? 'safety replacement' : 'accepted output'}`, async (t) => {
    quiet(t);
    const env = { ...ENV, OPENAI_API_KEY: 'dummy', OPENAI_STREAMING_ENABLED: 'true', ALLOW_STREAMING_WITH_EVAL_GATE: 'true' };
    const policy = getFeature(env, 'readings').policy;
    policy.primary.reasoningEffort = 'medium';
    let sent;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      sent = JSON.parse(options.body);
      const text = blocked ? output + '\n\nStop taking your medication.' : output;
      const completed = { type: 'response.completed', response: { status: 'completed', output_text: sceneEnvelope(text) } };
      return new Response(`event: response.completed\ndata: ${JSON.stringify(completed)}\n\n`, {
        headers: { 'Content-Type': 'text/event-stream' }
      });
    });
    const receipt = await runReadingConfigSample(env, policy);
    assert.equal(sent.stream, true);
    assert.equal(sent.reasoning.effort, 'medium');
    assert.equal(receipt.outcome, blocked ? 'safety_replaced' : 'primary_accepted');
    assert.doesNotMatch(receipt.excerpt, /Stop taking your medication/);
    assert.deepEqual(receipt.attempts[0], {
      slot: 0, providerId: 'openai-native', outcome: 'accepted', modelId: 'gpt-6.1-sol', modelSource: 'configured', effortSent: 'medium'
    });
  });
}
