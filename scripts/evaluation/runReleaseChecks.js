#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadVisionDataset } from './lib/visionEvaluationDataset.js';
import { CLAUDE_SUBSCRIPTION_BACKEND } from './lib/claudeSubscriptionTransport.js';
import { verifySubscriptionLogin } from '../../services/claude-code/runner.mjs';

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
  // The primary claude-api request, billed to the owner's Claude Code subscription.
  const backend = process.env.NARRATIVE_EVAL_BACKEND || CLAUDE_SUBSCRIPTION_BACKEND;
  if (![CLAUDE_SUBSCRIPTION_BACKEND, 'claude-api', 'modal-qwen', 'azure-gpt5'].includes(backend)) {
    throw new Error('Release narrative QA requires a live configured provider; local-composer is diagnostic only.');
  }
  if (backend === CLAUDE_SUBSCRIPTION_BACKEND) {
    // Fail before the code checks rather than after them.
    try {
      await verifySubscriptionLogin();
    } catch (error) {
      throw new Error(`Release narrative QA runs on this host's Claude Code subscription. ${error.message} Paid API QA requires an explicit NARRATIVE_EVAL_BACKEND=claude-api override.`);
    }
  }
  if (backend === 'claude-api' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('NARRATIVE_EVAL_BACKEND=claude-api requires ANTHROPIC_API_KEY.');
  }
  const env = { ...process.env, NARRATIVE_EVAL_BACKEND: backend };
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
