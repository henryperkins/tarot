import assert from 'node:assert/strict';
import { it } from 'node:test';
import { spawnSync } from 'node:child_process';

function deploy(args = [], qaExit = 0) {
  const result = spawnSync(process.execPath, ['--import', './tests/helpers/deployCommandStub.mjs', 'scripts/deploy.js', ...args], { encoding: 'utf8', env: { ...process.env, TEST_RELEASE_QA_EXIT: String(qaExit) } });
  const commands = result.stdout.split('\n').filter(line => line.startsWith('COMMAND:')).map(line => JSON.parse(line.slice(8)));
  return { ...result, commands };
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
