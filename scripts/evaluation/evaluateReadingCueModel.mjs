#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { runReadingCueEvaluation, createWorkersAiRestAdapter } from './lib/visualCueEvaluationHarness.mjs';

export function parseCueEvaluationArgs(args) {
  const options = { live: false };
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--dry-run') options.live = false;
    else if (name === '--live') options.live = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}.`);
      const key = { '--phase': 'phase', '--output': 'outputDir', '--repeats': 'repeats', '--max-calls': 'maxCalls',
        '--max-estimated-usd': 'maxEstimatedUsd', '--round-budget': 'roundBudgetPath', '--round-id': 'roundId',
        '--concurrency': 'concurrency', '--candidate': 'candidates', '--manifest': 'manifest' }[name];
      if (!key) throw new Error(`Unknown option ${name}.`);
      if (key === 'candidates') options[key] = value.split(',');
      else options[key] = ['repeats', 'maxCalls', 'maxEstimatedUsd', 'concurrency'].includes(key) ? Number(value) : value;
    }
  }
  if (args.includes('--live') && args.includes('--dry-run')) throw new Error('Choose either --live or --dry-run.');
  return options;
}

export async function main(args = process.argv.slice(2), explicitLiveConfiguration = null) {
  const options = parseCueEvaluationArgs(args);
  if (options.live) {
    // No process.env/.dev.vars/dotenv discovery. Programmatic caller owns secret loading.
    if (!explicitLiveConfiguration) throw new Error('Explicit live configuration required; invoke main(args, configuration) from a private caller.');
    options.initialAdmission = explicitLiveConfiguration.initialAdmission;
    options.aiAdapter = createWorkersAiRestAdapter({ ...explicitLiveConfiguration, live: true });
  }
  const report = await runReadingCueEvaluation(options);
  process.stdout.write(`${JSON.stringify({ runId: report.runId, mode: report.mode, plannedSemanticCalls: report.plan.semantic.length,
    modelCalls: report.modelCalls, fakeDispatches: report.fakeDispatches, qualified: report.qualified, incompleteReasons: report.incompleteReasons }, null, 2)}\n`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { process.stderr.write('Cue evaluation failed; check explicit configuration and immutable output/round paths.\n'); process.exitCode = 1; });
}
