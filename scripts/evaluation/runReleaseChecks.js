#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseJsoncConfig } from '../deploy.js';
import { loadVisionDataset } from './lib/visionEvaluationDataset.js';
import { OPENAI_EVAL_KEY_VARIABLE, UNIT_SUITE_CREDENTIAL_ENV_KEYS, resolveReleaseNarrativeBackend, verifyNarrativeSubscription } from './lib/subscriptionNarrative.js';
import { productionOpenAIDeadline } from '../../functions/lib/aiConfigRelease.js';
import { PRODUCTION_READING_OVERRIDES } from '../../shared/contracts/aiConfigRelease.js';

/**
 * How long production lets one OpenAI reading run: the OpenAI request deadline
 * (OPENAI_TIMEOUT_MS) inside the reading task budget, and inside the buffered
 * attempt cap when token streaming is off. Readings run as reading jobs, which
 * always request the stream.
 */
export const resolveProductionOpenAIReadingDeadlineMs = productionOpenAIDeadline;

export async function fetchReleaseSettings(key, fetcher = fetch) {
  if (!key) throw new Error('Production reading qualification requires the production ADMIN_API_KEY.');
  const response = await fetcher('https://tarot.lakefrontdev.com/api/admin/ai-configuration/release-settings', {
    headers: { Authorization: 'Bearer ' + key }, redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Could not resolve production reading settings.');
  const settings = await response.json();
  if (settings.environment !== 'production' || !['openai-native', 'claude-api'].includes(settings.providerId)
    || !settings.modelId || !settings.reasoningEffort || !Number.isInteger(settings.deadlineMs) || settings.deadlineMs <= 0
    || !/^[a-f0-9]{64}$/.test(settings.fingerprint) || !Number.isInteger(settings.revision)) {
    throw new Error('Unexpected production reading settings.');
  }
  return settings;
}

async function readProductionVars() {
  const config = parseJsoncConfig(await fs.readFile(path.resolve(process.cwd(), 'wrangler.jsonc'), 'utf-8'));
  return config.vars || {};
}

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
  const live = PRODUCTION_READING_OVERRIDES ? await fetchReleaseSettings(process.env.ADMIN_API_KEY) : null;
  const backend = resolveReleaseNarrativeBackend(process.env.NARRATIVE_EVAL_BACKEND, live ? [live.providerId] : undefined);
  // Provider credentials never reach the unit suites or the offline prompt
  // verifier, which refuses to run while any of them is present; the narrative
  // check alone receives the OpenAI key, under its evaluation-only name.
  const { [OPENAI_EVAL_KEY_VARIABLE]: evalOpenAIKey, ...hostEnv } = process.env;
  const shellOpenAIKey = hostEnv.OPENAI_API_KEY;
  delete hostEnv.ADMIN_API_KEY;
  for (const name of UNIT_SUITE_CREDENTIAL_ENV_KEYS) delete hostEnv[name];
  let narrativeCredentials = {};
  if (backend === 'openai-native') {
    const key = String(evalOpenAIKey || shellOpenAIKey || '').trim();
    if (!key) {
      throw new Error(`The release gate grades OpenAI readings and needs OPENAI_API_KEY or ${OPENAI_EVAL_KEY_VARIABLE}; it never falls back to another provider.`);
    }
    // Samples are buffered, but each gets the deadline a production reading
    // gets, so the gate cannot pass a reading that production would cut off.
    // A shell OPENAI_TIMEOUT_MS cannot loosen it; change wrangler.jsonc and the
    // live variable together instead.
    const deadlineMs = live?.deadlineMs ?? resolveProductionOpenAIReadingDeadlineMs(await readProductionVars());
    narrativeCredentials = { [OPENAI_EVAL_KEY_VARIABLE]: key, OPENAI_TIMEOUT_MS: String(deadlineMs) };
    console.log(`Release narrative gate: grading openai-native readings through the paid OpenAI Responses API, with production's ${deadlineMs / 1000} s deadline for each.`);
  } else {
    await verifyNarrativeSubscription(process.env);
  }
  if (live) {
    const settings = backend === 'openai-native'
      ? { OPENAI_MODEL: live.modelId, OPENAI_REASONING_EFFORT: live.reasoningEffort }
      : { ANTHROPIC_MODEL: live.modelId, ANTHROPIC_EFFORT: live.reasoningEffort, ANTHROPIC_TIMEOUT_MS: String(live.deadlineMs) };
    Object.assign(narrativeCredentials, settings, { NARRATIVE_CONFIG_FINGERPRINT: live.fingerprint, NARRATIVE_CONFIG_REVISION: String(live.revision) });
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
  if (live && live.fingerprint !== (await fetchReleaseSettings(process.env.ADMIN_API_KEY)).fingerprint) {
    throw new Error('Production reading settings changed during qualification. Rerun the release check.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
