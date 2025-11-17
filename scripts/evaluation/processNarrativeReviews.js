#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { parseCsv } from './lib/csv.js';

const DEFAULT_QUEUE = 'data/evaluations/narrative-review-queue.csv';
const DEFAULT_SUMMARY = 'data/evaluations/narrative-review-summary.json';

function usage() {
  console.log('Usage: node scripts/evaluation/processNarrativeReviews.js [queueFile] [summaryFile]');
}

function normalizeVerdict(value = '') {
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : '';
}

function extractColumns(header) {
  return {
    sampleId: header.indexOf('sample_id'),
    spread: header.indexOf('spread'),
    issues: header.indexOf('issues'),
    notes: header.indexOf('automated_notes'),
    verdict: header.indexOf('human_verdict'),
    humanNotes: header.indexOf('human_notes')
  };
}

async function main() {
  const queuePath = path.resolve(process.cwd(), process.argv[2] || DEFAULT_QUEUE);
  const summaryPath = path.resolve(process.cwd(), process.argv[3] || DEFAULT_SUMMARY);

  let csvContent;
  try {
    csvContent = await fs.readFile(queuePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Review queue not found at ${queuePath}. Run 'npm run eval:narrative' first.`);
      process.exit(1);
    }
    throw err;
  }

  const { header, rows } = parseCsv(csvContent);
  if (header.length === 0) {
    console.error('Narrative review queue is empty.');
    process.exit(1);
  }

  const columns = extractColumns(header);
  if (columns.sampleId === -1 || columns.verdict === -1) {
    console.error('Narrative review queue is missing required columns.');
    process.exit(1);
  }

  const annotatedRows = rows
    .map((cols) => ({
      sampleId: cols[columns.sampleId] || '',
      spread: columns.spread >= 0 ? cols[columns.spread] : '',
      issues: columns.issues >= 0 ? cols[columns.issues] : '',
      notes: columns.notes >= 0 ? cols[columns.notes] : '',
      verdict: columns.verdict >= 0 ? cols[columns.verdict] : '',
      humanNotes: columns.humanNotes >= 0 ? cols[columns.humanNotes] : ''
    }))
    .filter((entry) => entry.sampleId);

  const responded = annotatedRows.filter((entry) => normalizeVerdict(entry.verdict));
  const verdictCounts = responded.reduce((acc, entry) => {
    const key = normalizeVerdict(entry.verdict) || 'unspecified';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), queuePath),
    totalRows: annotatedRows.length,
    respondedRows: responded.length,
    verdictCounts,
    samples: responded.slice(0, 5).map((entry) => ({
      sampleId: entry.sampleId,
      spread: entry.spread,
      issues: entry.issues,
      verdict: entry.verdict,
      reviewerNotes: entry.humanNotes
    }))
  };

  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Narrative review summary written to ${path.relative(process.cwd(), summaryPath)}.`);
}

main().catch((err) => {
  console.error('Failed to process narrative reviews:', err.message);
  process.exit(1);
});
