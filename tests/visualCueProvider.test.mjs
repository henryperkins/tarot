import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runVisualCueAnnotation } from '../functions/lib/visualCueProvider.js';
import * as visualCueProvider from '../functions/lib/visualCueProvider.js';

const prompt = { systemPrompt: 'Independent visual instructions.', userPrompt: 'Exact reading-only prose.' };
const configured = run => ({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/model', AI: { run } });

test('ordinary provider cannot spoof no-dispatch admission with string fields', async () => {
  const env = configured(async () => { throw Object.assign(new Error('private-error'), { code: 'cue_admission_rejected', dispatched: false }); });
  await assert.rejects(visualCueProvider.runVisualCueAnnotationWithMetadata({ env, prompt }), error => {
    assert.equal(error.visualCueAttempt.outcome, 'failed');
    assert.equal(error.visualCueAttempt.usage.status, 'unknown');
    return true;
  });
});

const readinessCases = [
  ['missing provider', { VISUAL_CUE_PROVIDER: undefined }, 'missing_provider'],
  ['blank provider', { VISUAL_CUE_PROVIDER: '  ' }, 'missing_provider'],
  ['non-string provider', { VISUAL_CUE_PROVIDER: 7 }, 'missing_provider'],
  ['missing model', { VISUAL_CUE_MODEL: undefined }, 'missing_model'],
  ['blank model', { VISUAL_CUE_MODEL: '  ' }, 'missing_model'],
  ['non-string model', { VISUAL_CUE_MODEL: {} }, 'missing_model'],
  ['unsupported provider', { VISUAL_CUE_PROVIDER: 'narrative' }, 'unsupported_provider'],
  ['missing AI binding', { AI: undefined }, 'missing_ai_binding'],
  ['non-callable AI binding', { AI: { run: true } }, 'missing_ai_binding'],
  ['invalid GLM effort', { VISUAL_CUE_REASONING_EFFORT: 'medium' }, 'invalid_effort'],
  ['non-string GLM effort', { VISUAL_CUE_REASONING_EFFORT: 7 }, 'invalid_effort'],
  ['default low effort', {}, null],
  ['blank effort uses existing default', { VISUAL_CUE_REASONING_EFFORT: '  ' }, null],
  ['explicit high effort', { VISUAL_CUE_REASONING_EFFORT: 'high' }, null],
  ['explicit max effort', { VISUAL_CUE_REASONING_EFFORT: 'max' }, null],
  ['whitespace around valid config', { VISUAL_CUE_PROVIDER: ' workers-ai ', VISUAL_CUE_MODEL: ' @cf/zai-org/glm-5.3-flash ', VISUAL_CUE_REASONING_EFFORT: ' high ' }, null],
  ['non-GLM effort is not a GLM setting', { VISUAL_CUE_MODEL: '@cf/controlled/model', VISUAL_CUE_REASONING_EFFORT: 'medium' }, null]
];

for (const [name, overrides, reason] of readinessCases) {
  test(`visual readiness: ${name}`, () => {
    let calls = 0;
    const env = { ...configured(() => { calls++; }), VISUAL_CUE_MODEL: '@cf/zai-org/glm-5.3-flash', ...overrides };
    assert.equal(typeof visualCueProvider.getVisualCueReadiness, 'function');
    assert.deepEqual(visualCueProvider.getVisualCueReadiness(env), { ready: reason === null, reason });
    assert.equal(calls, 0, 'Readiness never probes inference');
  });
}

test('visual readiness is unavailable without an environment or independent config', () => {
  assert.equal(typeof visualCueProvider.getVisualCueReadiness, 'function');
  for (const env of [undefined, null, {}, { OPENAI_API_KEY: 'unused', ANTHROPIC_API_KEY: 'unused' }]) {
    assert.deepEqual(visualCueProvider.getVisualCueReadiness(env), { ready: false, reason: 'missing_provider' });
  }
});

test('explicit Workers AI configuration sends only the independent prompt to the selected model', async () => {
  const calls = [];
  const response = await runVisualCueAnnotation({ prompt, env: configured(async (...args) => {
    calls.push(args);
    return { response: '{"proposals":[]}' };
  }) });
  assert.deepEqual(response, { proposals: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '@cf/controlled/model');
  assert.deepEqual(calls[0][1].messages, [
    { role: 'system', content: prompt.systemPrompt }, { role: 'user', content: prompt.userPrompt }
  ]);
  const format = calls[0][1].response_format;
  assert.equal(format.type, 'json_schema');
  assert.equal(format.json_schema.additionalProperties, false);
  assert.deepEqual(format.json_schema.required, ['proposals']);
  assert.equal(format.json_schema.properties.proposals.items.additionalProperties, false);
  assert.deepEqual(format.json_schema.properties.proposals.items.properties.kind.enum,
    ['identity', 'literal', 'interpretation', 'balance', 'relationship']);
  assert.ok(calls[0][2].signal instanceof AbortSignal);
});

test('missing or unsupported config makes no provider call and never falls back to narrative credentials', async () => {
  let calls = 0;
  const base = configured(async () => { calls++; });
  for (const overrides of [
    { VISUAL_CUE_PROVIDER: undefined }, { VISUAL_CUE_MODEL: undefined },
    { VISUAL_CUE_PROVIDER: 'narrative' }, { AI: undefined }
  ]) {
    await assert.rejects(runVisualCueAnnotation({ prompt,
      env: { ...base, OPENAI_API_KEY: 'never-used-test-value', ...overrides } }));
  }
  assert.equal(calls, 0);
});

test('GLM annotation uses its named schema envelope and explicit bounded reasoning settings', async () => {
  let request;
  const env = { ...configured(async (_model, input) => {
    request = input;
    return { choices: [{ message: { content: '{"proposals":[]}' }, finish_reason: 'stop' }] };
  }), VISUAL_CUE_MODEL: '@cf/zai-org/glm-5.3-flash' };
  await runVisualCueAnnotation({ env, prompt });
  assert.equal(request.reasoning_effort, 'low');
  assert.equal(request.max_completion_tokens, 8192);
  assert.equal(request.response_format.json_schema.name, 'visual_cues');
  assert.equal(request.response_format.json_schema.schema.additionalProperties, false);
  await assert.rejects(runVisualCueAnnotation({ env: { ...env, VISUAL_CUE_REASONING_EFFORT: 'medium' }, prompt }), /reasoning/i);
});

test('invalid JSON or wrong envelope fails closed; parsed JSON and OpenAI-style content are accepted', async () => {
  for (const response of [{ response: '```json\n{"proposals":[]}\n```' }, { response: { cues: [] } }, { response: { proposals: [], reading: 'changed prose' } }]) {
    await assert.rejects(runVisualCueAnnotation({ prompt, env: configured(async () => response) }));
  }
  for (const response of [{ response: { proposals: [] } }, { choices: [{ message: { content: '{"proposals":[]}' } }] }]) {
    assert.deepEqual(await runVisualCueAnnotation({ prompt, env: configured(async () => response) }), { proposals: [] });
  }
});

test('abort and timeout bound an unresponsive binding and suppress late output', async () => {
  const controller = new AbortController();
  let providerSignal;
  let release;
  const operation = runVisualCueAnnotation({ prompt, signal: controller.signal,
    env: configured((_model, _input, options) => {
      providerSignal = options.signal;
      return new Promise(resolve => { release = resolve; });
    }) });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(operation, { name: 'AbortError' });
  assert.equal(providerSignal.aborted, true);
  release({ response: { proposals: [] } });
  await assert.rejects(runVisualCueAnnotation({ prompt,
    env: { ...configured(() => new Promise(() => {})), VISUAL_CUE_TIMEOUT_MS: '5' } }), { name: 'TimeoutError' });
});

test('metadata wrapper retains model usage and timing outside the strict proposal envelope', async () => {
  assert.equal(typeof visualCueProvider.runVisualCueAnnotationWithMetadata, 'function');
  const before = Date.now();
  const result = await visualCueProvider.runVisualCueAnnotationWithMetadata({ prompt, env: {
    ...configured(async () => ({ response: { proposals: [] }, model: '@cf/returned/model',
      usage: { prompt_tokens: 12, completion_tokens: 8, prompt_tokens_details: { cached_tokens: 4 }, completion_tokens_details: { reasoning_tokens: 6 } } })),
    VISUAL_CUE_MODEL: '@cf/zai-org/glm-5.3-flash', VISUAL_CUE_REASONING_EFFORT: 'high'
  } });
  assert.deepEqual(result.response, { proposals: [] });
  assert.deepEqual(Object.keys(result.metadata).sort(), ['provider', 'requestedModel', 'returnedModel', 'reasoningEffort', 'usage', 'startedAtMs', 'finishedAtMs', 'outcome', 'reason'].sort());
  assert.equal(result.metadata.provider, 'workers-ai');
  assert.equal(result.metadata.requestedModel, '@cf/zai-org/glm-5.3-flash');
  assert.equal(result.metadata.returnedModel, '@cf/returned/model');
  assert.equal(result.metadata.reasoningEffort, 'high');
  assert.deepEqual(result.metadata.usage, { status: 'known', inputTokens: 12, outputTokens: 8, totalTokens: 20,
    cacheReadInputTokens: 4, cacheCreationInputTokens: null, reasoningTokens: 6 });
  assert.equal(result.metadata.outcome, 'accepted');
  assert.equal(result.metadata.reason, null);
  assert.ok(result.metadata.startedAtMs >= before);
  assert.ok(result.metadata.finishedAtMs >= result.metadata.startedAtMs);
  assert.ok(result.metadata.finishedAtMs <= Date.now());
});

test('metadata never fabricates returned model, usage or irrelevant reasoning effort', async () => {
  assert.equal(typeof visualCueProvider.runVisualCueAnnotationWithMetadata, 'function');
  const { response, metadata } = await visualCueProvider.runVisualCueAnnotationWithMetadata({ prompt,
    env: { ...configured(async () => ({ response: { proposals: [] } })), VISUAL_CUE_REASONING_EFFORT: 'high' } });
  assert.deepEqual(response, { proposals: [] });
  assert.equal(metadata.returnedModel, null);
  assert.equal(metadata.reasoningEffort, null);
  assert.deepEqual(metadata.usage, { status: 'unknown', inputTokens: null, outputTokens: null, totalTokens: null,
    cacheReadInputTokens: null, cacheCreationInputTokens: null, reasoningTokens: null });
});

for (const [name, raw] of [['malformed JSON', 'private user@example.com malformed output'], ['wrong envelope', { proposals: [], usage: { secret: 'private' } }]]) {
  test(`billed ${name} retains sanitized rejection metadata`, async () => {
    assert.equal(typeof visualCueProvider.runVisualCueAnnotationWithMetadata, 'function');
    await assert.rejects(visualCueProvider.runVisualCueAnnotationWithMetadata({ prompt,
      env: configured(async () => ({ response: raw, model: 'private user@example.com', usage: { input_tokens: 12, output_tokens: 8, secret: 'private' } })) }), error => {
      assert.equal(error.visualCueAttempt.outcome, 'rejected');
      assert.equal(error.visualCueAttempt.reason, 'quality_rejected');
      assert.equal(error.visualCueAttempt.returnedModel, null);
      assert.equal(error.visualCueAttempt.usage.totalTokens, 20);
      assert.ok(!JSON.stringify(error.visualCueAttempt).includes('private'));
      assert.ok(!JSON.stringify(error.visualCueAttempt).includes('user@example.com'));
      assert.ok(!JSON.stringify(error.visualCueAttempt).includes('secret'));
      return true;
    });
  });
}

test('provider failures retain safe counts without retaining upstream error text', async () => {
  assert.equal(typeof visualCueProvider.runVisualCueAnnotationWithMetadata, 'function');
  const upstream = Object.assign(new Error('private user@example.com credential'), {
    model: '@cf/returned/model', usage: { input_tokens: 12, cached_input_tokens: 4 }, secret: 'private'
  });
  await assert.rejects(visualCueProvider.runVisualCueAnnotationWithMetadata({ prompt,
    env: configured(async () => { throw upstream; }) }), error => {
    assert.equal(error.visualCueAttempt.outcome, 'failed');
    assert.equal(error.visualCueAttempt.reason, 'provider_error');
    assert.equal(error.visualCueAttempt.returnedModel, '@cf/returned/model');
    assert.equal(error.visualCueAttempt.usage.status, 'partial');
    assert.equal(error.visualCueAttempt.usage.cacheReadInputTokens, 4);
    assert.ok(!JSON.stringify(error.visualCueAttempt).includes('private'));
    return true;
  });
});

for (const reason of ['timeout', 'cancelled']) {
  test(`${reason} after dispatch retains one failed attempt with unknown usage`, async () => {
    assert.equal(typeof visualCueProvider.runVisualCueAnnotationWithMetadata, 'function');
    const controller = new AbortController();
    let started;
    const operation = visualCueProvider.runVisualCueAnnotationWithMetadata({ prompt, signal: controller.signal,
      env: { ...configured(() => { started = true; return new Promise(() => {}); }), VISUAL_CUE_TIMEOUT_MS: '5' } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(started, true);
    if (reason === 'cancelled') controller.abort();
    await assert.rejects(operation, error => {
      assert.equal(error.visualCueAttempt.outcome, 'failed');
      assert.equal(error.visualCueAttempt.reason, reason);
      assert.equal(error.visualCueAttempt.usage.status, 'unknown');
      assert.equal(error.visualCueAttempt.usage.totalTokens, null);
      return true;
    });
  });
}

test('configuration failure and pre-dispatch cancellation attach no fictitious attempt', async () => {
  assert.equal(typeof visualCueProvider.runVisualCueAnnotationWithMetadata, 'function');
  const controller = new AbortController();
  controller.abort();
  for (const options of [{ env: {} }, { env: configured(() => assert.fail('No dispatch expected')), signal: controller.signal }]) {
    await assert.rejects(visualCueProvider.runVisualCueAnnotationWithMetadata({ prompt, ...options }), error => {
      assert.equal(error.visualCueAttempt, undefined);
      return true;
    });
  }
});
