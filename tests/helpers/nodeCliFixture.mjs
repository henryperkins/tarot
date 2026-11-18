import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const scripts = new Set();
let restoreSpawn;

// Intercept only the fixture executable. The runner still owns the real
// subprocess, its arguments, I/O, environment and cancellation.
export function installNodeCliFixture(executable) {
  if (scripts.size === 0) {
    const spawn = childProcess.spawn;
    childProcess.spawn = (command, args, options) => scripts.has(command)
      ? spawn(process.execPath, [command, ...args], options)
      : spawn(command, args, options);
    restoreSpawn = () => {
      childProcess.spawn = spawn;
      syncBuiltinESMExports();
    };
    syncBuiltinESMExports();
  }
  scripts.add(executable);
  return () => {
    scripts.delete(executable);
    if (scripts.size === 0) restoreSpawn();
  };
}

export function nodeCliPreload(executable) {
  return `import { installNodeCliFixture } from ${JSON.stringify(import.meta.url)};
installNodeCliFixture(${JSON.stringify(executable)});`;
}
