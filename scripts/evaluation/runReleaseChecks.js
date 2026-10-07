#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadVisionDataset } from './lib/visionEvaluationDataset.js';
import { resolveNarrativeEvalBackend, verifyNarrativeSubscription } from './lib/subscriptionNarrative.js';

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
  const backend = resolveNarrativeEvalBackend(process.env.NARRATIVE_EVAL_BACKEND, { requireLive: true });
  await verifyNarrativeSubscription(process.env);
  const env = { ...process.env, NARRATIVE_EVAL_BACKEND: backend, TEXT_PROVIDER: 'claude-code' };
  const checks = ['test', 'test:deploy', 'lint:cloudflare', 'docs:check'];
  if (directory) checks.push('ci:vision-check');
  checks.push('ci:narrative-check');
  for (const script of checks) {
    const args = ['run', script];
    const result = process.platform === 'win32'
      ? spawnSync(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], { stdio: 'inherit', env })
      : spawnSync('npm', args, { stdio: 'inherit', env });
    if (result.status !== 0) throw new Error(`Release check ${script} failed or could not run.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
