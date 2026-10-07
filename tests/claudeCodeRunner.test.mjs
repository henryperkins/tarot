import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runClaudeCode, verifySubscriptionLogin } from '../services/claude-code/runner.mjs';

const input = { task: 'question', systemPrompt: 'Ask a question.', messages: [{ role: 'user', content: 'Career' }] };
const authenticated = { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max' };

async function waitFor(check, message) {
  for (let attempt = 0; attempt < 250; attempt++) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

async function exists(filename) {
  try { await access(filename); return true; } catch { return false; }
}

async function running(pid) {
  try {
    process.kill(pid, 0);
    // An orphaned child may briefly await reaping after SIGKILL on Linux.
    if (process.platform === 'linux') return !/\) Z /.test(await readFile(`/proc/${pid}/stat`, 'utf8'));
    return true;
  } catch { return false; }
}

async function fakeCli(t, { status = authenticated, block = false, descendant = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'tableu-cli-test-'));
  const executable = path.join(directory, 'claude.mjs');
  const startedPath = path.join(directory, 'started.json');
  const authPath = path.join(directory, 'auth');
  const childSource = "process.on('SIGTERM', () => {}); process.send('ready'); setInterval(() => {}, 1000);";
  await writeFile(executable, `#!${process.execPath}
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
process.stdin.resume();
if (process.argv.includes('status')) {
  writeFileSync(${JSON.stringify(authPath)}, 'checked');
  console.log(${JSON.stringify(JSON.stringify(status))});
} else {
  const started = extra => writeFileSync(${JSON.stringify(startedPath)}, JSON.stringify({ pid: process.pid, cwd: process.cwd(), args: process.argv.slice(2), maxOutputTokens: process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS ?? null, advisorDisabled: process.env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL ?? null, ...extra }));
  if (${descendant}) {
    const child = spawn(process.execPath, ['-e', ${JSON.stringify(childSource)}], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    child.once('message', () => { child.disconnect(); started({ descendant: child.pid }); });
    setInterval(() => {}, 1000);
  } else if (${block}) {
    process.on('SIGTERM', () => {});
    started({});
    setInterval(() => {}, 1000);
  } else {
    started({});
    console.log(JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-fixture' }));
    console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, stop_reason: 'end_turn', result: 'What matters to you?', usage: {} }));
  }
}
`, { mode: 0o700 });
  t.after(async () => {
    if (await exists(startedPath)) {
      const data = JSON.parse(await readFile(startedPath, 'utf8'));
      try { process.kill(-data.pid, 'SIGKILL'); } catch { /* Already stopped. */ }
      await rm(data.cwd, { recursive: true, force: true });
    }
    await rm(directory, { recursive: true, force: true });
  });
  return {
    hostEnv: { HOME: directory, PATH: process.env.PATH, CLAUDE_CODE_EXECUTABLE: executable },
    authPath,
    startedPath,
    started: () => waitFor(async () => (await exists(startedPath)) && JSON.parse(await readFile(startedPath, 'utf8')), 'CLI inference did not start')
  };
}

test('runner rejects setup-token overrides before invoking the CLI', async t => {
  const fixture = await fakeCli(t);
  await assert.rejects(runClaudeCode(input, {
    hostEnv: { ...fixture.hostEnv, CLAUDE_CODE_OAUTH_TOKEN: 'test-token' }
  }), /CLAUDE_CODE_OAUTH_TOKEN.*unsupported/i);
  assert.equal(await exists(fixture.authPath), false);
  assert.equal(await exists(fixture.startedPath), false);
});

test('runner requires verified subscription metadata before generating', async t => {
  for (const status of [
    { ...authenticated, loggedIn: false },
    { ...authenticated, authMethod: 'api_key' },
    { ...authenticated, apiProvider: 'bedrock' },
    { ...authenticated, subscriptionType: null },
    { loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty' }
  ]) {
    const fixture = await fakeCli(t, { status });
    await assert.rejects(runClaudeCode(input, { hostEnv: fixture.hostEnv }), /subscription login/);
    assert.equal(await exists(fixture.startedPath), false);
  }
  const fixture = await fakeCli(t);
  const result = await runClaudeCode(input, { hostEnv: fixture.hostEnv });
  assert.equal(result.model, 'claude-fixture');
  assert.equal(await exists((await fixture.started()).cwd), false);
});

test('every subscription task launches Opus 5.5 with xhigh effort by default', async t => {
  for (const task of ['reading', 'followup', 'followup-repair', 'question', 'journal-summary']) {
    const fixture = await fakeCli(t);
    await runClaudeCode({ ...input, task }, { hostEnv: fixture.hostEnv });
    const { args } = await fixture.started();
    assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-5-5', task);
    assert.equal(args[args.indexOf('--effort') + 1], 'xhigh', task);
  }
});

test('explicit model overrides retain the selected thinking effort', async t => {
  for (const [settings, model, effort] of [
    [{ CLAUDE_CODE_MODEL: 'global-model', CLAUDE_CODE_EFFORT: 'high' }, 'global-model', 'high'],
    [{ CLAUDE_CODE_MODEL: 'global-model', CLAUDE_CODE_QUESTION_MODEL: 'task-model' }, 'task-model', 'xhigh']
  ]) {
    const fixture = await fakeCli(t);
    await runClaudeCode(input, { hostEnv: { ...fixture.hostEnv, ...settings } });
    const { args } = await fixture.started();
    assert.equal(args[args.indexOf('--model') + 1], model);
    assert.equal(args[args.indexOf('--effort') + 1], effort);
  }
});

test('request pins override host model, effort and output defaults', async t => {
  const fixture = await fakeCli(t);
  await runClaudeCode({ ...input, task: 'reading', model: 'claude-opus-5-5', effort: 'max', maxOutputTokens: 32000 }, {
    hostEnv: { ...fixture.hostEnv, CLAUDE_CODE_MODEL: 'host-model', CLAUDE_CODE_READING_MODEL: 'task-model', CLAUDE_CODE_EFFORT: 'low' }
  });
  const { args, maxOutputTokens } = await fixture.started();
  assert.equal(args[args.indexOf('--model') + 1], 'claude-opus-5-5');
  assert.equal(args[args.indexOf('--effort') + 1], 'max');
  assert.equal(maxOutputTokens, '32000');
});

test('every task runs without the server-side advisor tool', async t => {
  const fixture = await fakeCli(t);
  await runClaudeCode(input, { hostEnv: fixture.hostEnv });
  assert.equal((await fixture.started()).advisorDisabled, '1');
});

test('unpinned requests leave the CLI output ceiling at its default', async t => {
  const fixture = await fakeCli(t);
  await runClaudeCode(input, { hostEnv: { ...fixture.hostEnv, CLAUDE_CODE_MAX_OUTPUT_TOKENS: '999' } });
  assert.equal((await fixture.started()).maxOutputTokens, null);
});

test('invalid request pins are rejected before invoking the CLI', async t => {
  const fixture = await fakeCli(t);
  for (const pins of [{ model: '--dangerously-skip-permissions' }, { model: '' }, { effort: 'unlimited' }, { maxOutputTokens: 0 }, { maxOutputTokens: 1.5 }, { maxOutputTokens: '32000' }]) {
    await assert.rejects(runClaudeCode({ ...input, ...pins }, { hostEnv: fixture.hostEnv }), /Invalid Claude request settings/, JSON.stringify(pins));
  }
  assert.equal(await exists(fixture.authPath), false);
  assert.equal(await exists(fixture.startedPath), false);
});

test('subscription login verification stands alone for release preflight', async t => {
  const fixture = await fakeCli(t);
  await verifySubscriptionLogin({ hostEnv: fixture.hostEnv });
  assert.equal(await exists(fixture.authPath), true);
  assert.equal(await exists(fixture.startedPath), false);
  const apiBilled = await fakeCli(t, { status: { ...authenticated, authMethod: 'api_key' } });
  await assert.rejects(verifySubscriptionLogin({ hostEnv: apiBilled.hostEnv }), /API billing is disabled/);
  await assert.rejects(verifySubscriptionLogin({ hostEnv: { ...fixture.hostEnv, CLAUDE_CODE_OAUTH_TOKEN: 'x' } }), /unsupported/);
});

test('invalid effort is rejected before invoking the CLI', async t => {
  const fixture = await fakeCli(t);
  await assert.rejects(runClaudeCode(input, {
    hostEnv: { ...fixture.hostEnv, CLAUDE_CODE_EFFORT: 'unlimited' }
  }), /Invalid CLAUDE_CODE_EFFORT/);
  assert.equal(await exists(fixture.authPath), false);
  assert.equal(await exists(fixture.startedPath), false);
});

test('cancellation kills descendants even when the CLI parent exits before them', { skip: process.platform === 'win32' }, async t => {
  const fixture = await fakeCli(t, { descendant: true });
  const controller = new AbortController();
  const request = runClaudeCode(input, { signal: controller.signal, hostEnv: fixture.hostEnv });
  request.catch(() => {});
  const started = await fixture.started();
  controller.abort();
  await assert.rejects(request, /cancelled/);
  await waitFor(async () => !(await running(started.descendant)), 'CLI descendant survived cancellation');
  assert.equal(await running(started.pid), false);
  assert.equal(await exists(started.cwd), false);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`gateway ${signal} drains active CLI work and removes temporary prompts`, { skip: process.platform === 'win32', timeout: 15000 }, async t => {
    const fixture = await fakeCli(t, { block: true });
    const token = 'test-only-token-'.repeat(3);
    const reservation = net.createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const service = spawn(process.execPath, [fileURLToPath(new URL('../services/claude-code/server.mjs', import.meta.url))], {
      env: { ...fixture.hostEnv, CLAUDE_CODE_GATEWAY_TOKEN: token, CLAUDE_CODE_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const closed = once(service, 'close');
    let stdout = '';
    service.stdout.setEncoding('utf8');
    service.stdout.on('data', value => { stdout += value; });
    service.stderr.resume();
    t.after(async () => { if (service.exitCode === null && service.signalCode === null) service.kill('SIGKILL'); await closed; });
    await waitFor(() => stdout.includes(`127.0.0.1:${port}`), 'Gateway did not report its listening port');
    const response = fetch(`http://127.0.0.1:${port}/v1/generate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    }).catch(() => null);
    const started = await fixture.started();
    service.kill(signal);
    const [code, exitSignal] = await closed;
    await response;
    assert.equal(await running(started.pid), false, 'CLI survived service shutdown');
    assert.equal(await exists(started.cwd), false, 'Temporary prompt directory survived service shutdown');
    assert.equal(code, 0);
    assert.equal(exitSignal, null);
  });
}
