import assert from 'node:assert/strict';
import { it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function deploy(args = [], qaExit = 0, overrides = {}) {
  const result = spawnSync(process.execPath, ['--import', './tests/helpers/deployCommandStub.mjs', 'scripts/deploy.js', ...args], { encoding: 'utf8', env: { ...process.env, TEST_RELEASE_QA_EXIT: String(qaExit), ...overrides } });
  const commands = result.stdout.split('\n').filter(line => line.startsWith('COMMAND:')).map(line => JSON.parse(line.slice(8)));
  const configs = result.stdout.split('\n').filter(line => line.startsWith('CONFIG:')).map(line => JSON.parse(line.slice(7)));
  const requests = result.stdout.split('\n').filter(line => line.startsWith('REQUEST:')).map(line => JSON.parse(line.slice(8)));
  return { ...result, commands, configs, requests };
}

it('stops failed QA before any remote migration or Worker deployment', () => {
  const result = deploy([], 7);
  assert.equal(result.status, 1);
  assert.deepEqual(result.commands, [{ command: 'npm', args: ['run', 'ci:release-check'] }]);
});

it('runs fresh QA before migrations and deployment', () => {
  const result = deploy();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.commands[0], { command: 'npm', args: ['run', 'ci:release-check'] });
  assert.ok(result.commands.some(call => call.args.includes('d1')));
  assert.ok(result.commands.some(call => call.args.includes('deploy')));
});

it('keeps explicit migration-only operations separate from application QA', () => {
  const result = deploy(['--migrations-only']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.commands.some(call => call.args.includes('ci:release-check')), false);
  assert.equal(result.commands.some(call => call.args.includes('deploy')), false);
});

it('preserves QA when migrations are explicitly skipped', () => {
  const result = deploy(['--skip-migrations']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.commands[0], { command: 'npm', args: ['run', 'ci:release-check'] });
  assert.equal(result.commands.some(call => call.args.includes('d1')), false);
  assert.ok(result.commands.some(call => call.args.includes('deploy')));
});

it('inherits dashboard variables and secrets instead of uploading conflicting local defaults', () => {
  const before = readFileSync('wrangler.jsonc', 'utf8');
  const result = deploy();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.configs[0].keepVars, true);
  for (const name of ['LOG_LLM_PROMPTS', 'MODAL_TEMPERATURE', 'OPENAI_MODEL', 'TEXT_PROVIDER']) {
    assert.equal(result.configs[0].vars.includes(name), false, name);
  }
  assert.ok(result.configs[0].vars.includes('ANTHROPIC_MODEL'), 'new defaults are still deployed');
  assert.equal(result.configs[0].observability.issues.enabled, true);
  assert.equal(result.configs[0].observability.head_sampling_rate, 0.25);
  assert.equal(result.configs[0].observability.logs.persist, false);
  assert.ok(result.requests.length >= 3, 'preflight, refresh, and post-deploy verification');
  assert.ok(result.requests.every(request => request.method === 'GET'));
  assert.equal(result.configs[0].mode, 0o600);
  assert.equal(existsSync(result.configs[0].configPath), false, 'temporary config removed');
  assert.equal(readFileSync('wrangler.jsonc', 'utf8'), before);
  assert.doesNotMatch(result.stdout + result.stderr, /credential-canary|dashboard-canary-value/);
});

it('preserves an explicitly disabled dashboard Issues setting', () => {
  const result = deploy([], 0, { TEST_ISSUES_DISABLED: 'true' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.configs[0].observability.issues.enabled, false);
});

for (const scenario of ['TEST_AUTH_FAIL', 'TEST_SETTINGS_READ_FAIL', 'TEST_SETTINGS_MALFORMED']) {
  it(`stops ${scenario} before migrations or upload and does not print private responses`, () => {
    const result = deploy([], 0, { [scenario]: 'true' });
    assert.equal(result.status, 1);
    assert.equal(result.commands.some(call => call.args.includes('d1') || call.args.includes('deploy')), false);
    assert.doesNotMatch(result.stdout + result.stderr, /private-auth-canary|private-error-canary|credential-canary/);
  });
}

for (const drift of ['vars', 'issues']) {
  it(`reports a failed release when the uploaded ${drift} do not match the snapshot`, () => {
    const result = deploy([], 0, { TEST_DRIFT: drift });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /Deployment complete!/);
    assert.equal(result.commands.filter(call => call.args.includes('deploy')).length, 1, 'verification failure must not re-upload');
    assert.equal(existsSync(result.configs[0].configPath), false);
  });
}

it('cleans up temporary config after an upload failure', () => {
  const result = deploy([], 0, { TEST_UPLOAD_FAIL: 'true' });
  assert.equal(result.status, 1);
  assert.equal(existsSync(result.configs[0].configPath), false);
});

it('fails without another upload if settings cannot be verified after deployment', () => {
  const result = deploy([], 0, { TEST_POST_READ_FAIL: 'true' });
  assert.equal(result.status, 1);
  assert.equal(result.commands.filter(call => call.args.includes('deploy')).length, 1);
  assert.doesNotMatch(result.stdout, /Deployment complete!/);
  assert.equal(existsSync(result.configs[0].configPath), false);
});

it('uses checked-in defaults and enables Issues for a genuinely new Worker', () => {
  const result = deploy([], 0, { TEST_SETTINGS_MISSING: 'true' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.configs[0].vars.includes('OPENAI_MODEL'));
  assert.equal(result.configs[0].observability.issues.enabled, true);
});

it('keeps dry runs and migration-only commands free of settings requests', () => {
  for (const args of [['--dry-run', '--skip-migrations'], ['--migrations-only']]) {
    const result = deploy(args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.requests.length, 0);
    assert.equal(result.commands.some(call => call.args.includes('auth')), false);
  }
});

it('rejects dashboard variable collisions with configured bindings before migrations', () => {
  const result = deploy([], 0, { TEST_BINDING_COLLISION: 'true' });
  assert.equal(result.status, 1);
  assert.equal(result.commands.some(call => call.args.includes('d1') || call.args.includes('deploy')), false);
});

it('refuses to upload to a changed Worker target after build', () => {
  const result = deploy([], 0, { TEST_CONFIG_TARGET_CHANGE: 'true' });
  assert.equal(result.status, 1);
  assert.equal(result.commands.some(call => call.args.includes('deploy')), false);
});

it('refreshes dashboard variables after build and before retrying an upload', () => {
  const afterBuild = deploy([], 0, { TEST_CHANGE_DURING_BUILD: 'true' });
  assert.equal(afterBuild.status, 0, afterBuild.stderr);
  assert.equal(afterBuild.configs[0].vars.includes('ANTHROPIC_MODEL'), false);
  const retry = deploy([], 0, { TEST_RETRY_ONCE: 'true', DEPLOY_RETRY_MAX_DELAY_MS: '1000' });
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.configs.length, 2);
  assert.equal(retry.configs[0].vars.includes('ANTHROPIC_MODEL'), true);
  assert.equal(retry.configs[1].vars.includes('ANTHROPIC_MODEL'), false);
  assert.ok(retry.configs.every(config => !existsSync(config.configPath)));
});
