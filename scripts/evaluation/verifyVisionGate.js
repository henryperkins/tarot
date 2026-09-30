#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { visionSourceState } from './lib/visionEvaluationDataset.js';

const DEFAULT_FILE = 'data/evaluations/vision-metrics.json';
const ACC_THRESHOLD = parseFloat(process.env.VISION_MIN_ACCURACY || '0.9');
const COVERAGE_THRESHOLD = parseFloat(process.env.VISION_MIN_HIGH_CONFIDENCE_COVERAGE || '0.75');
const COVERAGE_ACC_THRESHOLD = parseFloat(process.env.VISION_MIN_HIGH_CONFIDENCE_ACCURACY || '0.9');
const SYMBOL_COVERAGE_THRESHOLD = parseFloat(process.env.VISION_MIN_SYMBOL_COVERAGE || '0.6');
const WEIGHTED_SYMBOL_COVERAGE_THRESHOLD = parseFloat(process.env.VISION_MIN_WEIGHTED_SYMBOL_COVERAGE || '0.65');
const HIGH_SALIENCE_RECALL_THRESHOLD = parseFloat(process.env.VISION_MIN_HIGH_SALIENCE_RECALL || '0.8');
const ABSENT_SYMBOL_FALSE_POSITIVE_MAX = parseFloat(process.env.VISION_MAX_ABSENT_SYMBOL_FALSE_POSITIVE_RATE || '0.02');
const HIGH_CONFIDENCE_ERROR_MAX = parseFloat(process.env.VISION_MAX_HIGH_CONFIDENCE_ERROR_RATE || '0.05');

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

  const metrics = payload?.metricsByDeck?.[args.deckStyle];

  if (!metrics) {
    console.error(`No metrics found for deck style ${args.deckStyle}.`);
    process.exitCode = 1;
    return;
  }

  const accuracy = metrics.accuracy;
  const coverage = metrics.highConfidenceCoverage;
  const coverageAccuracy = metrics.highConfidenceAccuracy;
  const symbolCoverage = metrics.symbolCoverageRate;
  const weightedSymbolCoverage = metrics.weightedSymbolCoverageRate;
  const highSalienceRecall = metrics.highSalienceSymbolRecall;
  const absentSymbolFalsePositiveRate = metrics.absentSymbolFalsePositiveRate;
  const highConfidenceErrorRate = metrics.highConfidenceErrorRate;

  const failures = [];
  const requiredRates = { accuracy, coverage, coverageAccuracy, symbolCoverage, weightedSymbolCoverage, highSalienceRecall, absentSymbolFalsePositiveRate, highConfidenceErrorRate };
  for (const [name, value] of Object.entries(requiredRates)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) failures.push(`${name} is missing or invalid`);
  }
  for (const value of [ACC_THRESHOLD, COVERAGE_THRESHOLD, COVERAGE_ACC_THRESHOLD, SYMBOL_COVERAGE_THRESHOLD, WEIGHTED_SYMBOL_COVERAGE_THRESHOLD, HIGH_SALIENCE_RECALL_THRESHOLD, ABSENT_SYMBOL_FALSE_POSITIVE_MAX, HIGH_CONFIDENCE_ERROR_MAX]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) failures.push('invalid threshold configuration');
  }
  if (metrics.schemaVersion !== 2 || metrics.deckStyle !== args.deckStyle) failures.push('missing/current-schema deck evidence required');
  const age = Date.now() - Date.parse(metrics.sourceGeneratedAt);
  if (!Number.isFinite(age) || age < -300000 || age > 24 * 60 * 60 * 1000) failures.push('inference evidence must be less than 24 hours old and not in the future');
  const currentSource = visionSourceState();
  const provenance = metrics.provenance;
  if (provenance?.sourceRevision !== currentSource.sourceRevision || provenance?.sourceDirty !== false || currentSource.sourceDirty) failures.push('inference must use this exact committed source and the current checkout must be clean');
  if (provenance?.datasetKind !== 'held-out-photos' || provenance?.labelSource !== 'independent-human'
    || provenance?.referenceOverlapCount !== 0 || !/^[a-f0-9]{64}$/.test(provenance?.manifestSha256 || '')) {
    failures.push('independently labeled held-out photos with no reference-image overlap required; reference/synthetic checks are diagnostic only');
  }
  if (!Number.isInteger(metrics.sampleSize) || metrics.sampleSize < 78 || metrics.uniqueCardCount !== 78
    || metrics.unmappedSampleCount !== 0 || metrics.inputSampleSize !== metrics.sampleSize
    || metrics.sourceSampleSize !== metrics.inputSampleSize || provenance?.datasetSampleSize !== metrics.inputSampleSize) failures.push('complete labeled corpus and 78-card coverage required; skipped inputs are not permitted');
  if (metrics.symbolScoredSampleCount !== metrics.sampleSize || metrics.symbolAnnotationCoverage !== 1) failures.push('verified symbol annotations and scores required for every evaluated image');
  if (metrics.absenceAnnotationCoverage !== 1 || metrics.absenceAnnotatedSampleCount !== metrics.sampleSize) failures.push('absence-negative tests required for every evaluated image');
  if (metrics.highSalienceAnnotationCoverage !== 1 || !Number.isInteger(metrics.highSalienceExpectedCount) || metrics.highSalienceExpectedCount <= 0) failures.push('measured high-salience symbols and complete annotation coverage required');
  if (Number.isFinite(accuracy) && accuracy < ACC_THRESHOLD) {
    failures.push(`accuracy ${formatPct(accuracy)} < threshold ${formatPct(ACC_THRESHOLD)}`);
  }
  if (Number.isFinite(coverage) && coverage < COVERAGE_THRESHOLD) {
    failures.push(`high-confidence coverage ${formatPct(coverage)} < threshold ${formatPct(COVERAGE_THRESHOLD)}`);
  }
  if (Number.isFinite(coverageAccuracy) && coverageAccuracy < COVERAGE_ACC_THRESHOLD) {
    failures.push(`high-confidence accuracy ${formatPct(coverageAccuracy)} < threshold ${formatPct(COVERAGE_ACC_THRESHOLD)}`);
  }
  if (Number.isFinite(symbolCoverage) && symbolCoverage < SYMBOL_COVERAGE_THRESHOLD) {
    failures.push(`symbol coverage ${formatPct(symbolCoverage)} < threshold ${formatPct(SYMBOL_COVERAGE_THRESHOLD)}`);
  }
  if (Number.isFinite(weightedSymbolCoverage) && weightedSymbolCoverage < WEIGHTED_SYMBOL_COVERAGE_THRESHOLD) {
    failures.push(`weighted symbol coverage ${formatPct(weightedSymbolCoverage)} < threshold ${formatPct(WEIGHTED_SYMBOL_COVERAGE_THRESHOLD)}`);
  }
  if (Number.isFinite(highSalienceRecall) && highSalienceRecall < HIGH_SALIENCE_RECALL_THRESHOLD) {
    failures.push(`high-salience recall ${formatPct(highSalienceRecall)} < threshold ${formatPct(HIGH_SALIENCE_RECALL_THRESHOLD)}`);
  }
  if (Number.isFinite(absentSymbolFalsePositiveRate) && absentSymbolFalsePositiveRate > ABSENT_SYMBOL_FALSE_POSITIVE_MAX) {
    failures.push(`absent-symbol false-positive rate ${formatPct(absentSymbolFalsePositiveRate)} > threshold ${formatPct(ABSENT_SYMBOL_FALSE_POSITIVE_MAX)}`);
  }
  if (Number.isFinite(highConfidenceErrorRate) && highConfidenceErrorRate > HIGH_CONFIDENCE_ERROR_MAX) {
    failures.push(`high-confidence error rate ${formatPct(highConfidenceErrorRate)} > threshold ${formatPct(HIGH_CONFIDENCE_ERROR_MAX)}`);
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
    symbolCoverage: formatPct(symbolCoverage),
    weightedSymbolCoverage: formatPct(weightedSymbolCoverage),
    highSalienceRecall: formatPct(highSalienceRecall),
    absentSymbolFalsePositiveRate: formatPct(absentSymbolFalsePositiveRate),
    highConfidenceErrorRate: formatPct(highConfidenceErrorRate)
  });
}

main().catch((err) => {
  console.error('Vision gate check failed:', err.message);
  process.exit(1);
});
