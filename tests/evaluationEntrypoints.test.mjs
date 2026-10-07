import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('importing evaluation entrypoints with credentials performs no inference or output writes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'evaluation-import-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sampleUrl = new URL('../scripts/evaluation/runNarrativeSamples.js', import.meta.url).href;
  const releaseUrl = new URL('../scripts/evaluation/runReleaseChecks.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.fetch = () => { throw new Error('INFERENCE_ON_IMPORT'); };
    await import(${JSON.stringify(sampleUrl)});
    await import(${JSON.stringify(releaseUrl)});
    console.log('imports-complete');
  `], {
    cwd: directory, encoding: 'utf8', timeout: 5000,
    env: { PATH: process.env.PATH, OPENAI_API_KEY: 'dummy-never-valid', ANTHROPIC_API_KEY: 'dummy-never-valid', NARRATIVE_EVAL_ENV_PROFILE: 'shell' }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'imports-complete');
  assert.deepEqual(await readdir(directory), []);
});
