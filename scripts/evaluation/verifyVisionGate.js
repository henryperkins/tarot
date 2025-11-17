#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_FILE = 'data/evaluations/vision-metrics.json';
const ACC_THRESHOLD = parseFloat(process.env.VISION_MIN_ACCURACY || '0.9');
const COVERAGE_THRESHOLD = parseFloat(process.env.VISION_MIN_HIGH_CONFIDENCE_COVERAGE || '0.75');
const COVERAGE_ACC_THRESHOLD = parseFloat(process.env.VISION_MIN_HIGH_CONFIDENCE_ACCURACY || '0.9');
const SYMBOL_COVERAGE_THRESHOLD = parseFloat(process.env.VISION_MIN_SYMBOL_COVERAGE || '0.6');

function formatPct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function parseCli(rawArgs) {
  const options = {
    file: DEFAULT_FILE,
    deckStyle: 'rws-1909'
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--deck-style') {
      options.deckStyle = rawArgs[i + 1] || options.deckStyle;
      i += 1;
    } else if (!arg.startsWith('--')) {
      options.file = arg;
    }
  }

  return options;
}

async function main() {
  const args = parseCli(process.argv.slice(2));
  const metricsPath = path.resolve(process.cwd(), args.file || DEFAULT_FILE);
  let payload;
  try {
    payload = JSON.parse(await fs.readFile(metricsPath, 'utf-8'));
  } catch (err) {
    console.error(`Unable to read ${metricsPath}. Run 'npm run eval:vision' first.`);
    throw err;
  }

  const metrics =
    payload?.metricsByDeck?.[args.deckStyle] ||
    payload?.metricsByDeck?.[Object.keys(payload?.metricsByDeck || {})[0]] ||
    payload;

  if (!metrics) {
    console.error(`No metrics found for deck style ${args.deckStyle}.`);
    process.exitCode = 1;
    return;
  }

  const accuracy = metrics?.accuracy ?? 0;
  const coverage = metrics?.highConfidenceCoverage ?? 0;
  const coverageAccuracy = metrics?.highConfidenceAccuracy ?? 0;
  const symbolCoverage = metrics?.symbolCoverageRate ?? 0;

  const failures = [];
  if (accuracy < ACC_THRESHOLD) {
    failures.push(`accuracy ${formatPct(accuracy)} < threshold ${formatPct(ACC_THRESHOLD)}`);
  }
  if (coverage < COVERAGE_THRESHOLD) {
    failures.push(`high-confidence coverage ${formatPct(coverage)} < threshold ${formatPct(COVERAGE_THRESHOLD)}`);
  }
  if (coverageAccuracy < COVERAGE_ACC_THRESHOLD) {
    failures.push(`high-confidence accuracy ${formatPct(coverageAccuracy)} < threshold ${formatPct(COVERAGE_ACC_THRESHOLD)}`);
  }
  if (symbolCoverage < SYMBOL_COVERAGE_THRESHOLD) {
    failures.push(`symbol coverage ${formatPct(symbolCoverage)} < threshold ${formatPct(SYMBOL_COVERAGE_THRESHOLD)}`);
  }

  if (failures.length) {
    console.error('Vision gate failed:', failures.join('; '));
    process.exitCode = 1;
    return;
  }

  console.log(`Vision metrics meet thresholds for ${args.deckStyle}:`, {
    accuracy: formatPct(accuracy),
    highConfidenceCoverage: formatPct(coverage),
    highConfidenceAccuracy: formatPct(coverageAccuracy),
    symbolCoverage: formatPct(symbolCoverage)
  });
}

main().catch((err) => {
  console.error('Vision gate check failed:', err.message);
  process.exit(1);
});
