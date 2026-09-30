import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { basename } from 'node:path';

// Loaded only in the subprocess integration test. No child command, network
// operation, migration, build or deployment is actually executed.
childProcess.spawnSync = (command, args) => {
  process.stdout.write(`COMMAND:${JSON.stringify({ command: basename(command), args })}\n`);
  const isQualityCheck = args.includes('ci:release-check');
  return { status: isQualityCheck ? Number(process.env.TEST_RELEASE_QA_EXIT || 0) : 0, stdout: '[]', stderr: '' };
};
syncBuiltinESMExports();
