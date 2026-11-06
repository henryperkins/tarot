import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { resolveBackendId } from '../scripts/evaluation/runNarrativeSamples.js';
import {
  applyOpenAIEvalCredentials,
  resolveReleaseNarrativeBackend,
  runSubscriptionNarrative
} from '../scripts/evaluation/lib/subscriptionNarrative.js';
import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { buildOpenAIResponsesPrompts } from '../functions/lib/narrativeBackends.js';
import { createClaudeCodeServer } from '../services/claude-code/server.mjs';
import { parseClaudeOutput } from '../services/claude-code/runner.mjs';
import { once } from 'node:events';

const apiSettings = {
  TEXT_PROVIDER: 'legacy', ANTHROPIC_API_KEY: 'must-not-use', OPENAI_API_KEY: 'must-not-use',
  MODAL_PROXY_TOKEN_ID: 'must-not-use', MODAL_PROXY_TOKEN_SECRET: 'must-not-use'
};

test('automatic narrative evaluation chooses the subscription even with every paid provider configured', () => {
  for (const requested of [undefined, '', 'auto', 'claude-code']) {
    assert.equal(resolveBackendId(requested, apiSettings), 'claude-code');
  }
});

test('narrative evaluation accepts only the explicit production OpenAI backend among paid providers', () => {
  assert.equal(resolveBackendId('openai-native', apiSettings), 'openai-native');
  for (const requested of ['claude-api', 'modal-qwen']) {
    assert.throws(() => resolveBackendId(requested, apiSettings), /paid API backends are disabled/i);
  }
  assert.equal(resolveBackendId('local', {}), 'local-composer');
  assert.equal(resolveBackendId('local-composer', {}), 'local-composer');
  assert.throws(() => resolveBackendId('unknown', {}), /Unknown backend/);
});

test('the release gate grades the production primary provider', () => {
  for (const requested of [undefined, '', 'auto', 'openai-native']) {
    assert.equal(resolveReleaseNarrativeBackend(requested), 'openai-native');
  }
  assert.throws(() => resolveReleaseNarrativeBackend('claude-code'), /production primary provider \(openai-native\).*would not qualify it/);
  assert.throws(() => resolveReleaseNarrativeBackend('claude-api'), /paid API backends are disabled/);
  assert.throws(() => resolveReleaseNarrativeBackend('local-composer'), /local-composer is diagnostic only/);
  const claudeFirst = ['claude-api', 'modal-qwen', 'openai-native', 'local-composer'];
  assert.equal(resolveReleaseNarrativeBackend('', claudeFirst), 'claude-code');
  assert.throws(() => resolveReleaseNarrativeBackend('openai-native', claudeFirst), /would not qualify it/);
  assert.throws(() => resolveReleaseNarrativeBackend('', ['modal-qwen', 'local-composer']), /No release narrative gate/);
});

test('OpenAI grading maps only the evaluation key onto the production variable', () => {
  assert.throws(() => applyOpenAIEvalCredentials({ OPENAI_API_KEY: 'shell-key' }),
    /needs NARRATIVE_EVAL_OPENAI_API_KEY; the gate never falls back/);
  const env = applyOpenAIEvalCredentials({ NARRATIVE_EVAL_OPENAI_API_KEY: ' eval-key ', TEXT_PROVIDER: 'claude-code', OPENAI_MODEL: 'gpt-5.6-sol' });
  assert.equal(env.OPENAI_API_KEY, 'eval-key');
  assert.equal(env.TEXT_PROVIDER, 'legacy');
  assert.equal(Object.hasOwn(env, 'NARRATIVE_EVAL_OPENAI_API_KEY'), false);
  assert.equal(env.OPENAI_MODEL, 'gpt-5.6-sol');
});

async function openAIFixture(t, env) {
  const directory = await mkdtemp(path.join(tmpdir(), 'openai-gate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const guard = path.join(directory, 'guard.mjs');
  const capture = path.join(directory, 'requests.json');
  const output = path.join(directory, 'samples.json');
  await writeFile(guard, `import { writeFileSync } from 'node:fs';
const requests = [];
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  requests.push({ url: target, authorization: new Headers(options.headers || {}).get('authorization'),
    body: typeof options.body === 'string' ? JSON.parse(options.body) : null });
  writeFileSync(${JSON.stringify(capture)}, JSON.stringify(requests));
  if (target !== 'https://api.openai.com/v1/responses') throw new Error('UNEXPECTED_NETWORK ' + target);
  const text = '### Opening\\n\\nThe Star invites renewal in this new role.\\n\\n### Closing\\n\\nYou choose the pace.';
  return new Response(JSON.stringify({ id: 'resp_offline', object: 'response', status: 'completed', model: 'gpt-5.6-sol',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } }), { status: 200, headers: { 'content-type': 'application/json' } });
};
`);
  const result = spawnSync(process.execPath, [
    '--import', guard, 'scripts/evaluation/runNarrativeSamples.js',
    '--backend', 'openai-native', '--env-profile', 'production', '--sample', 'single-new-role', '--out', output
  ], { encoding: 'utf8', timeout: 60000, env: { HOME: directory, PATH: process.env.PATH, ...env } });
  const requests = await readFile(capture, 'utf8').then(JSON.parse, () => []);
  return { ...result, output, requests };
}

test('the narrative CLI grades OpenAI readings through the production Responses request', async t => {
  const result = await openAIFixture(t, { NARRATIVE_EVAL_OPENAI_API_KEY: 'eval-test-key' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests.length, 1);
  const [request] = result.requests;
  assert.equal(request.authorization, 'Bearer eval-test-key');
  assert.equal(request.body.model, 'gpt-5.6-sol');
  assert.equal(request.body.reasoning?.effort, 'xhigh');
  const payload = JSON.parse(await readFile(result.output, 'utf8'));
  assert.equal(payload.model, 'openai-native');
  assert.equal(payload.config.backend, 'openai-native');
  assert.equal(payload.config.provider, 'openai-native');
  assert.equal(payload.config.model, 'gpt-5.6-sol');
  assert.equal(payload.config.reasoningEffort, 'xhigh');
  assert.equal(payload.config.parityWith, 'openai-native');
  assert.equal(payload.config.servingPath, 'direct-backend');
  assert.match(payload.samples[0].reading, /The Star invites renewal/);
  assert.doesNotMatch(JSON.stringify(payload), /eval-test-key/, 'the key is never written to evidence');
});

test('the narrative CLI refuses OpenAI grading without the evaluation key, even with OPENAI_API_KEY', async t => {
  const result = await openAIFixture(t, { OPENAI_API_KEY: 'shell-test-key' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs NARRATIVE_EVAL_OPENAI_API_KEY/);
  assert.deepEqual(result.requests, []);
});

async function cliFixture(t, { authenticated = true, authMethod = 'claude.ai', failGeneration = false, block = false, returnedModel = 'claude-opus-5-5', mixedModels = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'subscription-gate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'claude.mjs');
  const capture = path.join(directory, 'capture.json');
  const output = path.join(directory, 'samples.json');
  const network = path.join(directory, 'network.txt');
  const guard = path.join(directory, 'guard.mjs');
  await writeFile(guard, `import { writeFileSync } from 'node:fs';
globalThis.fetch = () => { writeFileSync(${JSON.stringify(network)}, 'attempted'); throw new Error('PAID_NETWORK_DISABLED'); };
`);
  await writeFile(executable, `#!${process.execPath}
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args.includes('status')) {
  console.log(JSON.stringify({ loggedIn: ${authenticated}, authMethod: ${JSON.stringify(authMethod)}, apiProvider: 'firstParty', subscriptionType: 'max' }));
} else {
  let prompt = '';
  for await (const chunk of process.stdin) prompt += chunk;
  writeFileSync(${JSON.stringify(capture)}, JSON.stringify({ args, prompt, env: process.env }));
  if (${block}) setInterval(() => {}, 1000);
  else if (${failGeneration}) process.exitCode = 1;
  else {
    console.log(JSON.stringify({ type: 'system', subtype: 'init', model: ${JSON.stringify(returnedModel)} }));
    if (${mixedModels}) console.log(JSON.stringify({ type: 'assistant', message: { model: 'claude-wrong-model' } }));
    console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, stop_reason: 'end_turn', result: 'The Fool invites a curious first step into leadership.', usage: {},
      modelUsage: ${JSON.stringify(mixedModels ? { 'claude-opus-5-5': {}, 'claude-wrong-model': {} } : {})} }));
  }
}
`, { mode: 0o700 });
  const env = { HOME: directory, PATH: process.env.PATH, CLAUDE_CODE_EXECUTABLE: executable,
    CLAUDE_CODE_TIMEOUT_MS: block ? '1000' : '30000', ...apiSettings };
  const result = spawnSync(process.execPath, [
    '--import', guard, 'scripts/evaluation/runNarrativeSamples.js',
    '--env-profile', 'shell', '--sample', 'single-new-role', '--out', output
  ], {
    encoding: 'utf8', timeout: 30000,
    env
  });
  return { ...result, output, capture, network, env };
}

test('the narrative CLI uses the existing subscription without a gateway or API credentials', async t => {
  const result = await cliFixture(t);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(await readFile(result.output, 'utf8'));
  assert.equal(payload.model, 'claude-code');
  assert.equal(payload.config.authentication, 'personal-subscription');
  assert.equal(payload.config.parityWith, 'claude-api');
  assert.equal(payload.config.model, 'claude-opus-5-5');
  assert.equal(payload.config.maxTokens, 32000);
  assert.equal(payload.samples[0].inference.model, 'claude-opus-5-5');
  assert.equal(payload.samples[0].reading, 'The Fool invites a curious first step into leadership.');
  const { args, prompt, env } = JSON.parse(await readFile(result.capture, 'utf8'));
  assert.equal(args[args.indexOf('--effort') + 1], 'xhigh');
  assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-5-5');
  assert.equal(env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL, '1');
  assert.equal(env.CLAUDE_CODE_MAX_OUTPUT_TOKENS, '32000');
  assert.match(prompt, /new leadership role/);
  for (const key of Object.keys(apiSettings)) assert.equal(env[key], undefined, key);
  await assert.rejects(readFile(result.network), { code: 'ENOENT' });
});

for (const [name, options] of [
  ['subscription login is missing', { authenticated: false }],
  ['CLI authentication uses API billing', { authMethod: 'api_key' }],
  ['subscription generation fails', { failGeneration: true }]
]) {
  test(`the narrative CLI fails without API fallback when ${name}`, async t => {
    const result = await cliFixture(t, options);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /subscription/i);
    await assert.rejects(readFile(result.output), { code: 'ENOENT' });
    await assert.rejects(readFile(result.network), { code: 'ENOENT' });
  });
}

test('the narrative CLI refuses samples answered by a different model', async t => {
  const result = await cliFixture(t, { returnedModel: 'claude-wrong-model' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /claude-wrong-model.*instead of claude-opus-5-5/);
  await assert.rejects(readFile(result.output), { code: 'ENOENT' });
  await assert.rejects(readFile(result.network), { code: 'ENOENT' });
});

test('the narrative CLI refuses mixed-model samples instead of trusting initialization', async t => {
  const result = await cliFixture(t, { mixedModels: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /multiple models/i);
  await assert.rejects(readFile(result.output), { code: 'ENOENT' });
  await assert.rejects(readFile(result.network), { code: 'ENOENT' });
});

test('subscription evaluation timeout cancels the CLI and removes temporary prompts', async t => {
  const result = await cliFixture(t, { block: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cancelled/i);
  const { args } = JSON.parse(await readFile(result.capture, 'utf8'));
  await assert.rejects(readFile(args[args.indexOf('--system-prompt-file') + 1]), { code: 'ENOENT' });
  await assert.rejects(readFile(result.output), { code: 'ENOENT' });
  await assert.rejects(readFile(result.network), { code: 'ENOENT' });
});

async function narrativePayload() {
  const cardsInfo = [{ card: 'The Star', name: 'The Star', number: 17, position: 'Theme', orientation: 'Upright', meaning: 'Hope and renewal' }];
  return {
    spreadInfo: { name: 'One-Card Insight', key: 'single' }, cardsInfo, userQuestion: 'How can I make time for painting?',
    analysis: { themes: await analyzeSpreadThemes(cardsInfo), spreadKey: 'single', spreadAnalysis: null }, context: 'creative'
  };
}

test('cancellation during CLI cleanup cannot qualify a completed response', async t => {
  const fixture = await cliFixture(t);
  assert.equal(fixture.status, 0, fixture.stderr);
  const controller = new AbortController();
  const originalRm = fs.rm;
  t.mock.method(fs, 'rm', async (directory, options) => {
    if (path.basename(directory).startsWith('tableu-claude-')) controller.abort();
    return originalRm(directory, options);
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await assert.rejects(runSubscriptionNarrative(fixture.env, {
    ...await narrativePayload(), signal: controller.signal
  }, 'test'), /cancelled/i);
});

test('remote evaluation uses only the configured subscription gateway and records the actual model', async t => {
  const payload = await narrativePayload();
  const expected = buildOpenAIResponsesPrompts(apiSettings, payload, 'test', {
    backendId: 'claude-api', providerLabel: 'Claude Messages API', budgetTarget: 'claude'
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://claude.example.test/v1/generate');
    assert.equal(options.headers.Authorization, 'Bearer test-gateway-token');
    const sent = JSON.parse(options.body);
    assert.equal(sent.task, 'reading');
    assert.equal(sent.model, 'claude-opus-5-5');
    assert.equal(sent.effort, 'xhigh');
    assert.equal(sent.maxOutputTokens, 32000);
    assert.equal(sent.systemPrompt, expected.systemPrompt);
    assert.deepEqual(sent.messages, [{ role: 'user', content: expected.userPrompt }]);
    return Response.json({ provider: 'claude-code', model: 'claude-opus-5-5', text: 'Make space for a small painting practice.', usage: {} });
  });
  const result = await runSubscriptionNarrative({ ...apiSettings,
    CLAUDE_CODE_GATEWAY_URL: 'https://claude.example.test', CLAUDE_CODE_GATEWAY_TOKEN: 'test-gateway-token'
  }, payload, 'test');
  assert.equal(result.model, 'claude-opus-5-5');
  assert.equal(result.reading, 'Make space for a small painting practice.');
});

test('gateway evaluation pins the production settings and rejects model substitution', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const sent = JSON.parse(options.body);
    assert.equal(sent.model, 'claude-pinned-model');
    assert.equal(sent.effort, 'high');
    assert.equal(sent.maxOutputTokens, 32000);
    return Response.json({ provider: 'claude-code', model: 'claude-wrong-model', text: 'A reading.', usage: {} });
  });
  await assert.rejects(runSubscriptionNarrative({ ...apiSettings,
    ANTHROPIC_MODEL: 'claude-pinned-model', ANTHROPIC_EFFORT: 'high',
    CLAUDE_CODE_MODEL: 'host-model', CLAUDE_CODE_EFFORT: 'low',
    CLAUDE_CODE_GATEWAY_URL: 'https://claude.example.test', CLAUDE_CODE_GATEWAY_TOKEN: 'test-gateway-token'
  }, await narrativePayload(), 'test'), /claude-wrong-model.*instead of claude-pinned-model/);
});

test('mixed-model CLI output fails qualification through the private gateway', async t => {
  const token = 'test-gateway-token-'.repeat(3);
  const output = [
    { type: 'system', subtype: 'init', model: 'claude-opus-5-5' },
    { type: 'assistant', message: { model: 'claude-wrong-model' } },
    { type: 'result', subtype: 'success', is_error: false, stop_reason: 'end_turn', result: 'An answer.', usage: {},
      modelUsage: { 'claude-opus-5-5': {}, 'claude-wrong-model': {} } }
  ].map(event => JSON.stringify(event)).join('\n');
  let captured;
  const server = createClaudeCodeServer({ token, run: async input => {
    captured = input;
    return parseClaudeOutput(output);
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  await assert.rejects(runSubscriptionNarrative({ ...apiSettings,
    CLAUDE_CODE_GATEWAY_URL: `http://127.0.0.1:${server.address().port}`, CLAUDE_CODE_GATEWAY_TOKEN: token
  }, await narrativePayload(), 'test'), /Claude inference unavailable \(503\)/);
  assert.equal(captured.model, 'claude-opus-5-5');
  assert.equal(captured.maxOutputTokens, 32000);
});

test('a failed configured subscription gateway never falls back to local CLI or a paid API', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    assert.equal(url, 'https://claude.example.test/v1/generate');
    return new Response(null, { status: 503 });
  });
  await assert.rejects(runSubscriptionNarrative({ ...apiSettings,
    CLAUDE_CODE_GATEWAY_URL: 'https://claude.example.test', CLAUDE_CODE_GATEWAY_TOKEN: 'test-gateway-token',
    CLAUDE_CODE_EXECUTABLE: '/missing-do-not-run'
  }, await narrativePayload(), 'test'), /Claude inference unavailable \(503\)/);
  assert.equal(calls, 1);
});
