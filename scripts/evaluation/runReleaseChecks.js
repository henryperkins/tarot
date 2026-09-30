#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadVisionDataset } from './lib/visionEvaluationDataset.js';

async function main() {
  const directory = process.env.VISION_EVAL_MANIFEST_DIR;
  if (!directory) throw new Error('VISION_EVAL_MANIFEST_DIR is required: release QA needs independently labeled held-out photos for all three decks.');
  for (const deckStyle of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
    const dataset = await loadVisionDataset({ deckStyle, manifestPath: path.resolve(directory, `${deckStyle}.json`) });
    if (dataset.provenance.datasetKind !== 'held-out-photos' || new Set(dataset.inputs.map(input => input.expected)).size !== 78) {
      throw new Error(`Release corpus for ${deckStyle} must contain independent photos covering all 78 cards.`);
    }
  }
  const backend = process.env.NARRATIVE_EVAL_BACKEND || 'modal-qwen';
  if (!['modal-qwen', 'azure-gpt5', 'claude-opus45'].includes(backend)) {
    throw new Error('Release narrative QA requires a live configured provider; local-composer is diagnostic only.');
  }
  const env = { ...process.env, NARRATIVE_EVAL_BACKEND: backend };
  for (const script of ['test', 'test:deploy', 'lint:cloudflare', 'docs:check', 'ci:vision-check', 'ci:narrative-check']) {
    const args = ['run', script];
    const result = process.platform === 'win32'
      ? spawnSync(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], { stdio: 'inherit', env })
      : spawnSync('npm', args, { stdio: 'inherit', env });
    if (result.status !== 0) throw new Error(`Release check ${script} failed or could not run.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
