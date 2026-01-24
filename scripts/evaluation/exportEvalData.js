#!/usr/bin/env node
/**
 * Export evaluation data from D1 for analysis
 *
 * Usage: node scripts/evaluation/exportEvalData.js --days=7 [--output eval-data.jsonl]
 */

import fs from 'node:fs/promises';
import { executeD1Query } from '../lib/dataAccess.js';

function parseArgs(rawArgs = []) {
  const options = { days: 7, output: null, d1Name: 'mystic-tarot-db', target: 'remote' };

  rawArgs.forEach((arg, index) => {
    if (arg.startsWith('--days=')) {
      options.days = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--days') {
      options.days = parseInt(rawArgs[index + 1], 10);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1];
    } else if (arg === '--output') {
      options.output = rawArgs[index + 1];
    } else if (arg.startsWith('--d1-name=')) {
      options.d1Name = arg.split('=')[1];
    } else if (arg === '--d1-name') {
      options.d1Name = rawArgs[index + 1];
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/evaluation/exportEvalData.js --days=7 [--output eval-data.jsonl]

Options:
  --days=N        Export records from the last N days (default: 7)
  --output=FILE   Write to file instead of stdout
  --d1-name=NAME  D1 database name (default: mystic-tarot-db)
  --local         Use local D1 database
  --remote        Use remote D1 database (default)
`);
      process.exit(0);
    }
  });

  if (!Number.isFinite(options.days) || options.days <= 0) {
    options.days = 7;
  }

  return options;
}

async function exportEvalData(options) {
  const { days, d1Name, target } = options;

  // Calculate cutoff date
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().replace('T', ' ').split('.')[0];

  const sql = `
    SELECT
      request_id,
      created_at,
      spread_key,
      provider,
      eval_mode,
      overall_score,
      safety_flag,
      card_coverage,
      reading_prompt_version,
      variant_id,
      payload
    FROM eval_metrics
    WHERE created_at >= '${cutoffStr}'
    ORDER BY created_at DESC
  `;

  const rows = await executeD1Query({ dbName: d1Name, sql, target });

  const records = rows.map((row) => {
    let payload = {};
    try {
      payload = JSON.parse(row.payload || '{}');
    } catch {
      // ignore parse errors
    }

      // Handle both v1 and v2 schema payloads
      let cardCoverage, hallucinatedCardsCount;
      if (payload.schemaVersion >= 2) {
        cardCoverage = row.card_coverage ?? payload.narrative?.coverage?.percentage;
        hallucinatedCardsCount = payload.narrative?.coverage?.hallucinatedCards?.length || 0;
      } else {
        cardCoverage = row.card_coverage ?? payload.narrative?.cardCoverage;
        hallucinatedCardsCount = payload.narrative?.hallucinatedCards?.length || 0;
      }

      return {
        requestId: row.request_id,
        timestamp: row.created_at,
        provider: row.provider,
        spreadKey: row.spread_key,
        eval: payload.eval || {
          scores: {
            overall: row.overall_score,
            safety_flag: row.safety_flag === 1
          },
          mode: row.eval_mode
        },
        cardCoverage,
        hallucinatedCards: hallucinatedCardsCount,
        readingPromptVersion: row.reading_prompt_version,
        variantId: row.variant_id,
        schemaVersion: payload.schemaVersion || 1
      };
    });

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
  const options = parseArgs(process.argv.slice(2));
  const records = await exportEvalData(options);
  await writeOutput(records, options.output, options.days);
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
