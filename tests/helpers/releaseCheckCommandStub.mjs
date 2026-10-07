import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

// Only downstream npm jobs are replaced. The release entrypoint and manifest
// validation execute normally; no live inference, nested suite or deploy runs.
childProcess.spawnSync = (_command, args, options) => {
  const script = args[args.indexOf('run') + 1];
  process.stdout.write(`CHECK:${JSON.stringify({ script, backend: options.env.NARRATIVE_EVAL_BACKEND, textProvider: options.env.TEXT_PROVIDER })}\n`);
  return { status: script === process.env.TEST_RELEASE_CHECK_FAIL ? 7 : 0, stdout: '', stderr: '' };
};
syncBuiltinESMExports();
