import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

// Exercise the real preflight and subscription validation without a host login.
childProcess.spawn = (_command, args) => {
  if (!args.includes('auth') || !args.includes('status')) throw new Error('Unexpected inference during preflight');
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  queueMicrotask(() => {
    process.stdout.write('LOGIN_CHECK\n');
    child.stdout.end(JSON.stringify({ loggedIn: !process.env.TEST_RELEASE_LOGIN_FAIL,
      authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max' }));
    child.emit('close', 0);
  });
  return child;
};

// Only downstream npm jobs are replaced. The release entrypoint and manifest
// validation execute normally; no live inference, nested suite or deploy runs.
childProcess.spawnSync = (_command, args, options) => {
  const script = args[args.indexOf('run') + 1];
  process.stdout.write(`CHECK:${JSON.stringify({ script, backend: options.env.NARRATIVE_EVAL_BACKEND, textProvider: options.env.TEXT_PROVIDER })}\n`);
  return { status: script === process.env.TEST_RELEASE_CHECK_FAIL ? 7 : 0, stdout: '', stderr: '' };
};
syncBuiltinESMExports();
