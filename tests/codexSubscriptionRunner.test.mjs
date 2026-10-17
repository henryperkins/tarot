import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const input = { task: 'reading', systemPrompt: 'Interpret the spread.', messages: [{ role: 'user', content: 'A personal question' }] };

async function fixture(t, { status = 'Logged in using ChatGPT', block = false, output } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'codex-runner-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const executable = path.join(dir, 'codex.mjs');
  const record = path.join(dir, 'record.json');
  const events = output || [
    { type: 'thread.started', thread_id: 'test' }, { type: 'turn.started' },
    { type: 'item.completed', item: { id: 'one', type: 'agent_message', text: 'A thoughtful reading.' } },
    { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 5 } }
  ];
  await writeFile(executable, `#!${process.execPath}\nimport fs from 'node:fs';
const args=process.argv.slice(2);let prompt='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
if(args.includes('--version')) { console.log('codex-cli 0.162.0'); }
else if(args.includes('status')) { process.stderr.write(${JSON.stringify(status)}); }
else if(args.includes('models')) { console.log(JSON.stringify({models:[{slug:'gpt-6.1-sol',shell_type:'unified_exec',apply_patch_tool_type:'freeform',experimental_supported_tools:['clock'],base_instructions:'Host instructions'}]})); }
else {const setting=(key)=>JSON.parse(args.find(x=>x.startsWith(key+'=')).slice(key.length+1));
const catalog=JSON.parse(fs.readFileSync(setting('model_catalog_json'),'utf8'));const system=fs.readFileSync(setting('model_instructions_file'),'utf8');
fs.writeFileSync(${JSON.stringify(record)},JSON.stringify({args,env:process.env,cwd:process.cwd(),prompt,catalog,system,pid:process.pid}));
${block ? "setInterval(()=>{},1000);" : `for(const event of ${JSON.stringify(events)})console.log(JSON.stringify(event));`}}
});`, { mode: 0o700 });
  return { record, hostEnv: { HOME: process.env.HOME, PATH: process.env.PATH, CODEX_SUBSCRIPTION_EXECUTABLE: executable, OPENAI_API_KEY: 'must-not-pass', CODEX_API_KEY: 'must-not-pass', NODE_OPTIONS: '--bad-option', CODEX_HOME: '/must-not-override', CODEX_BASE_URL: 'https://must-not-pass' } };
}

test('subscription runner exists and enforces isolated, tool-free ChatGPT execution', async t => {
  const module = await import('../services/codex-subscription/runner.mjs').catch(() => null);
  assert.ok(module?.runCodexSubscription, 'Codex subscription provider must be implemented');
  const f = await fixture(t);
  const result = await module.runCodexSubscription(input, { hostEnv: f.hostEnv });
  assert.equal(result.text, 'A thoughtful reading.');
  assert.equal(result.provider, 'codex-subscription');
  assert.equal(result.modelSource, 'configured');
  const seen = JSON.parse(await readFile(f.record, 'utf8'));
  assert.equal(seen.system, input.systemPrompt);
  assert.equal(seen.prompt, input.messages[0].content);
  for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'NODE_OPTIONS', 'CODEX_HOME', 'CODEX_BASE_URL']) assert.equal(seen.env[key], undefined);
  assert.ok(seen.args.includes('--ignore-user-config'));
  assert.ok(seen.args.includes('--ephemeral'));
  assert.ok(seen.args.includes('forced_login_method="chatgpt"'));
  assert.ok(seen.args.includes('web_search="disabled"'));
  assert.equal(seen.catalog.models[0].shell_type, 'disabled');
  assert.equal(seen.catalog.models[0].apply_patch_tool_type, null);
  assert.deepEqual(seen.catalog.models[0].experimental_supported_tools, []);
  await assert.rejects(access(seen.cwd));
});

test('API-key sign-in is rejected before any generation begins', async t => {
  const { runCodexSubscription } = await import('../services/codex-subscription/runner.mjs');
  const f = await fixture(t, { status: 'Logged in using an API key' });
  await assert.rejects(runCodexSubscription(input, { hostEnv: f.hostEnv }), /ChatGPT subscription/);
  await assert.rejects(access(f.record));
});

test('structured output is parsed and validated, with no invented model confirmation', async () => {
  const { parseCodexOutput } = await import('../services/codex-subscription/runner.mjs');
  const output = [{ type: 'turn.started' }, { type: 'item.completed', item: { type: 'agent_message', text: '{"answer":"yes"}' } }, { type: 'turn.completed', usage: { output_tokens: 3 } }].map(JSON.stringify).join('\n');
  const schema = { type: 'object', required: ['answer'], properties: { answer: { type: 'string' } }, additionalProperties: false };
  assert.equal(parseCodexOutput(output, schema, 'gpt-6.1-sol').structured.answer, 'yes');
  assert.throws(() => parseCodexOutput(output, { type: 'object', required: ['missing'] }, 'gpt-6.1-sol'), /structured/);
  assert.throws(() => parseCodexOutput(output.replace('turn.completed', 'turn.failed'), schema, 'gpt-6.1-sol'), /incomplete|failed/);
});

test('unexpected tools or incomplete turns cannot become successful readings', async () => {
  const { parseCodexOutput } = await import('../services/codex-subscription/runner.mjs');
  for (const item of [{ type: 'command_execution', command: 'cat secret' }, { type: 'web_search' }]) {
    assert.throws(() => parseCodexOutput(JSON.stringify({ type: 'item.started', item }), undefined, 'gpt-6.1-sol'), /tool|unexpected|incomplete/i);
  }
  assert.throws(() => parseCodexOutput('{broken', undefined, 'gpt-6.1-sol'), /incomplete/);
});

test('unsupported inference token limits cannot be silently accepted', async () => {
  const { validateCodexRequest } = await import('../shared/inference/codexSubscription.js');
  assert.throws(() => validateCodexRequest({ ...input, maxOutputTokens: 500 }), /unsupported|settings/);
});

test('cancellation terminates the runner and removes private request files', async t => {
  const { runCodexSubscription } = await import('../services/codex-subscription/runner.mjs');
  const f = await fixture(t, { block: true });
  const controller = new AbortController();
  const running = runCodexSubscription(input, { hostEnv: f.hostEnv, signal: controller.signal });
  const rejection = assert.rejects(running, /cancelled/);
  let seen;
  for (let i = 0; i < 100; i++) {
    try { seen = JSON.parse(await readFile(f.record, 'utf8')); break; } catch { await new Promise(r => setTimeout(r, 20)); }
  }
  assert.ok(seen, 'generation starts');
  controller.abort();
  await rejection;
  await assert.rejects(access(seen.cwd));
  assert.throws(() => process.kill(seen.pid, 0));
});
