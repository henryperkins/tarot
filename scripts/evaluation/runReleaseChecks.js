#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadVisionDataset } from './lib/visionEvaluationDataset.js';
import { OPENAI_EVAL_KEY_VARIABLE, UNIT_SUITE_CREDENTIAL_ENV_KEYS, resolveReleaseNarrativeBackend, verifyNarrativeSubscription } from './lib/subscriptionNarrative.js';

export async function main() {
  const directory = process.env.VISION_EVAL_MANIFEST_DIR;
  if (directory) {
    for (const deckStyle of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
      const dataset = await loadVisionDataset({ deckStyle, manifestPath: path.resolve(directory, `${deckStyle}.json`) });
      if (dataset.provenance.datasetKind !== 'held-out-photos' || new Set(dataset.inputs.map(input => input.expected)).size !== 78) {
        throw new Error(`Release corpus for ${deckStyle} must contain independent photos covering all 78 cards.`);
      }
    }
  } else {
    console.log('Vision qualification not run: VISION_EVAL_MANIFEST_DIR is unset. Photo recognition and symbol quality remain unverified.');
  }
  // The narrative gate grades readings from the production primary provider.
  const backend = resolveReleaseNarrativeBackend(process.env.NARRATIVE_EVAL_BACKEND);
  // Provider credentials never reach the unit suites or the offline prompt
  // verifier, which refuses to run while any of them is present; the narrative
  // check alone receives the OpenAI key, under its evaluation-only name.
  const { [OPENAI_EVAL_KEY_VARIABLE]: evalOpenAIKey, ...hostEnv } = process.env;
  const shellOpenAIKey = hostEnv.OPENAI_API_KEY;
  for (const name of UNIT_SUITE_CREDENTIAL_ENV_KEYS) delete hostEnv[name];
  let narrativeCredentials = {};
  if (backend === 'openai-native') {
    const key = String(evalOpenAIKey || shellOpenAIKey || '').trim();
    if (!key) {
      throw new Error(`The release gate grades OpenAI readings and needs OPENAI_API_KEY or ${OPENAI_EVAL_KEY_VARIABLE}; it never falls back to another provider.`);
    }
    // Batch qualification samples are non-streaming with unlimited output; the
    // per-request production deadline (120s) is too short for the largest
    // spreads, so the gate gets the bounded maximum unless the shell set one.
    narrativeCredentials = { [OPENAI_EVAL_KEY_VARIABLE]: key, OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS || '600000' };
    console.log('Release narrative gate: grading openai-native readings through the paid OpenAI Responses API.');
  } else {
    await verifyNarrativeSubscription(process.env);
  }
  const env = { ...hostEnv, NARRATIVE_EVAL_BACKEND: backend, TEXT_PROVIDER: backend === 'claude-code' ? 'claude-code' : 'legacy' };
  const checks = ['test', 'test:deploy', 'lint:cloudflare', 'docs:check'];
  if (directory) checks.push('ci:vision-check');
  checks.push('ci:narrative-check');
  for (const script of checks) {
    const args = ['run', script];
    const scriptEnv = script === 'ci:narrative-check' ? { ...env, ...narrativeCredentials } : env;
    const result = process.platform === 'win32'
      ? spawnSync(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], { stdio: 'inherit', env: scriptEnv })
      : spawnSync('npm', args, { stdio: 'inherit', env: scriptEnv });
    if (result.status !== 0) throw new Error(`Release check ${script} failed or could not run.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
