import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runVisualCueAnnotation } from '../functions/lib/visualCueProvider.js';

const prompt = { systemPrompt: 'Independent visual instructions.', userPrompt: 'Exact reading-only prose.' };
const configured = run => ({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/model', AI: { run } });

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
