#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { parseCsv } from './lib/csv.js';

const DEFAULT_QUEUE = 'data/evaluations/vision-review-queue.csv';
const DEFAULT_OUTPUT = 'data/evaluations/vision-review-summary.json';
const DEFAULT_ACTIVE_LEARNING_OUT = 'data/evaluations/vision-active-learning.jsonl';

const POSITIVE_VERDICTS = new Set(['correct', 'match', 'accept', 'accepted', 'ok', 'true']);
const NEGATIVE_VERDICTS = new Set(['incorrect', 'reject', 'mismatch', 'fail', 'false']);
const NEUTRAL_VERDICTS = new Set(['needs_review', 'uncertain', 'pending', 'skip']);
export const ACCEPTED_FAILURE_LABELS = new Set([
  'bad_crop',
  'reversed_orientation_missed',
  'similar_card_confusion',
  'symbol_hallucination',
  'deck_variant_unsupported',
  'low_light_or_blur',
  'absence_false_positive',
  'calibration_overconfidence'
]);

function usage() {
  console.log('Usage: node scripts/evaluation/processVisionReviews.js [--queue path] [--out path] [--active-learning-out path]');
  console.log(`Accepted failure labels: ${Array.from(ACCEPTED_FAILURE_LABELS).join(', ')}`);
}

function normalizeVerdict(value = '') {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';
  if (POSITIVE_VERDICTS.has(normalized)) return 'accepted';
  if (NEGATIVE_VERDICTS.has(normalized)) return 'rejected';
  if (NEUTRAL_VERDICTS.has(normalized)) return 'needs_review';
  return normalized;
}

function parseArgs(args) {
  const options = {
    queue: DEFAULT_QUEUE,
    output: DEFAULT_OUTPUT,
    activeLearningOut: DEFAULT_ACTIVE_LEARNING_OUT
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--queue') {
      options.queue = args[i + 1] || options.queue;
      i += 1;
    } else if (arg === '--out') {
      options.output = args[i + 1] || options.output;
      i += 1;
    } else if (arg === '--active-learning-out') {
      options.activeLearningOut = args[i + 1] || options.activeLearningOut;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
  }

  return options;
}

function extractIndex(header, key) {
  const idx = header.indexOf(key);
  if (idx === -1) {
    throw new Error(`Missing "${key}" column in review queue.`);
  }
  return idx;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const queuePath = path.resolve(process.cwd(), options.queue);
  let csvContent;
  try {
    csvContent = await fs.readFile(queuePath, 'utf-8');
  } catch (err) {
    console.error(`Unable to read ${queuePath}:`, err.message);
    process.exit(1);
    return;
  }

  const { header, rows } = parseCsv(csvContent);
  if (!header.length) {
    console.error('Review queue is empty.');
    process.exit(1);
    return;
  }

  const verdictIdx = extractIndex(header, 'human_verdict');
  const notesIdx = header.indexOf('human_notes');
  const imageIdx = extractIndex(header, 'image');
  const expectedIdx = extractIndex(header, 'expected');
  const predictedIdx = extractIndex(header, 'predicted');
  const confidenceIdx = header.indexOf('confidence');
  const weightedScoreIdx = header.indexOf('weighted_score');
  const hallucinatedSymbolsIdx = header.indexOf('hallucinated_symbols');
  const visibleSymbolsIdx = header.indexOf('visible_symbols');
  const actionIdx = header.indexOf('action');
  const failureLabelIdx = header.indexOf('failure_label');

  const verdictCounts = {};
  const reviewedRows = [];

  rows.forEach((cols) => {
    const verdictRaw = cols[verdictIdx] || '';
    const normalizedVerdict = normalizeVerdict(verdictRaw);
    if (!normalizedVerdict) {
      return;
    }
    verdictCounts[normalizedVerdict] = (verdictCounts[normalizedVerdict] || 0) + 1;
    reviewedRows.push({
      image: cols[imageIdx],
      expected: cols[expectedIdx],
      predicted: cols[predictedIdx],
      confidence: confidenceIdx >= 0 ? cols[confidenceIdx] : '',
      weightedScore: weightedScoreIdx >= 0 ? cols[weightedScoreIdx] : '',
      hallucinatedSymbols: hallucinatedSymbolsIdx >= 0 ? cols[hallucinatedSymbolsIdx] : '',
      visibleSymbols: visibleSymbolsIdx >= 0 ? cols[visibleSymbolsIdx] : '',
      action: actionIdx >= 0 ? cols[actionIdx] : '',
      failureLabel: failureLabelIdx >= 0 && ACCEPTED_FAILURE_LABELS.has((cols[failureLabelIdx] || '').trim())
        ? cols[failureLabelIdx].trim()
        : '',
      verdict: normalizedVerdict,
      notes: notesIdx >= 0 ? cols[notesIdx] : ''
    });
  });

  const reviewedCount = reviewedRows.length;
  if (!reviewedCount) {
    console.log('No human verdicts recorded yet.');
    process.exit(0);
    return;
  }

  const acceptedCount = verdictCounts.accepted ?? 0;
  const rejectedCount = verdictCounts.rejected ?? 0;
  const needsReviewCount = verdictCounts['needs_review'] ?? 0;

  const summary = {
    generatedAt: new Date().toISOString(),
    queueFile: path.relative(process.cwd(), queuePath),
    reviewedCount,
    verdictCounts,
    acceptanceRate: acceptedCount / reviewedCount,
    rejectionRate: rejectedCount / reviewedCount,
    needsReviewRate: needsReviewCount / reviewedCount,
    acceptedSamples: reviewedRows.filter((row) => row.verdict === 'accepted').slice(0, 10),
    rejectedSamples: reviewedRows.filter((row) => row.verdict === 'rejected').slice(0, 10)
  };

  const outputPath = path.resolve(process.cwd(), options.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

  const activeLearningRows = reviewedRows
    .filter((row) => row.verdict === 'rejected' || row.failureLabel)
    .map((row) => ({
      image: row.image,
      expected_card: row.expected,
      predicted_card: row.predicted,
      confidence: row.confidence ? Number(row.confidence) : null,
      weighted_score: row.weightedScore ? Number(row.weightedScore) : null,
      failure_label: row.failureLabel || (row.verdict === 'rejected' ? 'similar_card_confusion' : ''),
      hallucinated_symbols: row.hallucinatedSymbols ? row.hallucinatedSymbols.split(/;\s*/g).filter(Boolean) : [],
      visible_symbols: row.visibleSymbols ? row.visibleSymbols.split(/;\s*/g).filter(Boolean) : [],
      action: row.action || 'review_training_example',
      notes: row.notes || ''
    }));

  const activeLearningPath = path.resolve(process.cwd(), options.activeLearningOut);
  await fs.mkdir(path.dirname(activeLearningPath), { recursive: true });
  await fs.writeFile(activeLearningPath, activeLearningRows.map((row) => JSON.stringify(row)).join('\n') + (activeLearningRows.length ? '\n' : ''));

  console.log('Review summary written to', outputPath);
  console.log('Active-learning failures written to', activeLearningPath);
  console.log(`Reviewed ${reviewedCount} rows. Acceptance rate: ${(summary.acceptanceRate * 100).toFixed(2)}%`);
}

main().catch((err) => {
  console.error('Processing vision reviews failed:', err.message);
  process.exit(1);
});
