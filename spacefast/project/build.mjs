import { cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const projectRoot = fileURLToPath(new URL('./', import.meta.url));
const result = spawnSync(process.execPath, [resolve(repositoryRoot, 'scripts/spacefast-build.mjs')], {
  cwd: repositoryRoot,
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
if (result.status !== 0) {
  console.error(`Tableu Spacefast build failed${result.signal ? ` (${result.signal})` : ''}.`);
  process.exit(result.status || 1);
}

// Spacefast output directories are relative to the selected app root.
const output = resolve(projectRoot, 'dist');
await rm(output, { recursive: true, force: true });
await cp(resolve(repositoryRoot, 'dist-spacefast'), output, { recursive: true });
console.log(`Spacefast repository output: ${output}`);
