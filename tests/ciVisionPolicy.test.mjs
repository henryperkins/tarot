import assert from 'node:assert/strict';
import { it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import yaml from 'js-yaml';

// GitHub runs this shell on Ubuntu. Native Windows release-policy coverage is
// provided by releaseChecks.test.mjs without adding a Bash prerequisite.
const shellTestOptions = { skip: process.platform === 'win32' ? 'Ubuntu workflow shell test' : false };

async function runWorkflowStep(t, stepName, manifestDirectory = '') {
  const workflow = yaml.load(await readFile('.github/workflows/ci.yml', 'utf8'));
  const step = workflow.jobs.build.steps.find(entry => entry.name === stepName);
  const directory = await mkdtemp(join(tmpdir(), 'ci-vision-policy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const commandLog = join(directory, 'commands.txt');
  // Execute the actual workflow shell body; stub only the expensive npm job.
  await writeFile(join(directory, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_COMMAND_LOG"\nexit 7\n', { mode: 0o755 });
  await writeFile(join(directory, 'node'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_COMMAND_LOG"\nexit 0\n', { mode: 0o755 });
  const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', step.run], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH}`, VISION_EVAL_MANIFEST_DIR: manifestDirectory, TEST_COMMAND_LOG: commandLog }
  });
  const command = await readFile(commandLog, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return { ...result, command };
}

it('CI does not require photo data when the corpus variable is unset', shellTestOptions, async (t) => {
  const result = await runWorkflowStep(t, 'Vision QA gate');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.command, null);
  assert.match(result.stdout, /vision qualification not run/i);
});

it('CI propagates vision qualification failure when a corpus is configured', shellTestOptions, async (t) => {
  const result = await runWorkflowStep(t, 'Vision QA gate', '/private/photo corpus');
  assert.equal(result.status, 7, result.stderr);
  assert.equal(result.command, 'run ci:vision-check\n');
});

it('CI recomputes saved narrative metrics without starting paid generation and propagates gate failure', shellTestOptions, async (t) => {
  const result = await runWorkflowStep(t, 'Saved narrative regression gate (offline)');
  assert.equal(result.status, 7, result.stderr);
  assert.equal(result.command, 'scripts/evaluation/computeNarrativeMetrics.js\nrun gate:narrative\n');
  assert.match(result.stdout, /fresh primary-provider qualification runs before deployment/);
});

it('hosted workflows never receive the paid Claude key and fresh gate evidence survives failure', async () => {
  const ci = yaml.load(await readFile('.github/workflows/ci.yml', 'utf8'));
  const deploy = yaml.load(await readFile('.github/workflows/deploy.yml', 'utf8'));
  const ciSteps = Object.values(ci.jobs).flatMap(job => job.steps || []);
  const rolloutSteps = deploy.jobs.deploy.steps;
  // Release QA runs on the owner's Claude Code subscription, not the API key.
  assert.ok([...ciSteps, ...rolloutSteps].every(step => !step.env?.ANTHROPIC_API_KEY && !step.env?.NARRATIVE_EVAL_BACKEND));
  assert.ok(ciSteps.every(step => !step.run?.includes('ci:narrative-check')));
  assert.ok(rolloutSteps.some(step => /node scripts\/deploy\.js/.test(step.run || '')));
  const evidence = rolloutSteps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(evidence.if, '${{ always() }}');
  assert.equal(evidence.with.path, 'data/evaluations/runs/');
});
