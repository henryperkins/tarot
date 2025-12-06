#!/usr/bin/env node
/**
 * Export evaluation data from R2 archives for analysis
 *
 * Usage: node scripts/evaluation/exportEvalData.js --days=7 [--output eval-data.jsonl]
 */

import fs from 'node:fs/promises';
import { createR2Client, listJsonFromR2 } from '../lib/dataAccess.js';

const R2_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET || 'tarot-logs';

function parseArgs(rawArgs = []) {
  const options = { days: 7, output: null };

  rawArgs.forEach((arg, index) => {
    if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--days') {
      options.days = parseInt(rawArgs[index + 1], 10);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg === '--output') {
      options.output = rawArgs[index + 1];
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/evaluation/exportEvalData.js --days=7 [--output eval-data.jsonl]');
      process.exit(0);
    }
  });

  if (!Number.isFinite(options.days) || options.days <= 0) {
    options.days = 7;
  }

  return options;
}

async function exportEvalData(days = 7) {
  const client = createR2Client({
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY
  });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const records = [];
  const objects = await listJsonFromR2(client, {
    bucket: BUCKET,
    prefix: 'archives/metrics/',
    cutoffDate: cutoff
  });

  for (const obj of objects) {
    const data = obj?.data;
    if (data?.eval) {
      records.push({
        requestId: data.requestId,
        timestamp: data.timestamp,
        provider: data.provider,
        spreadKey: data.spreadKey,
        eval: data.eval,
        cardCoverage: data.narrative?.cardCoverage,
        hallucinatedCards: data.narrative?.hallucinatedCards?.length || 0
      });
    }
  }

  return records;
}

async function writeOutput(records, output, days) {
  if (output) {
    await fs.writeFile(output, records.map((r) => JSON.stringify(r)).join('\n'));
  } else {
    records.forEach((r) => console.log(JSON.stringify(r)));
  }

  console.error(`Exported ${records.length} evaluation records from last ${days} days`);
}

async function main() {
  const { days, output } = parseArgs(process.argv.slice(2));
  const records = await exportEvalData(days);
  await writeOutput(records, output, days);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
