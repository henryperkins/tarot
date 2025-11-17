#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { parseCsv } from './lib/csv.js';

const DEFAULT_QUEUE = 'data/evaluations/vision-review-queue.csv';
const DEFAULT_OUTPUT = 'data/evaluations/vision-review-summary.json';

const POSITIVE_VERDICTS = new Set(['correct', 'match', 'accept', 'accepted', 'ok', 'true']);
const NEGATIVE_VERDICTS = new Set(['incorrect', 'reject', 'mismatch', 'fail', 'false']);
const NEUTRAL_VERDICTS = new Set(['needs_review', 'uncertain', 'pending', 'skip']);

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
    output: DEFAULT_OUTPUT
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--queue') {
      options.queue = args[i + 1] || options.queue;
      i += 1;
    } else if (arg === '--out') {
      options.output = args[i + 1] || options.output;
      i += 1;
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
  console.log('Review summary written to', outputPath);
  console.log(`Reviewed ${reviewedCount} rows. Acceptance rate: ${(summary.acceptanceRate * 100).toFixed(2)}%`);
}

main().catch((err) => {
  console.error('Processing vision reviews failed:', err.message);
  process.exit(1);
});
