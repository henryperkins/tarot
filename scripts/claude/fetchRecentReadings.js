#!/usr/bin/env node
/**
 * Fetch recent tarot readings for Claude Code live evaluation.
 *
 * This script pulls the last N readings from METRICS_DB (KV) or R2 archives
 * and formats them for Claude to analyze interactively.
 *
 * Usage:
 *   node scripts/claude/fetchRecentReadings.js [--count=5] [--source=kv|r2]
 *
 * Environment variables (for R2):
 *   CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const DEFAULT_COUNT = 5;
const DEFAULT_SOURCE = 'kv';

function parseArgs(argv) {
  const options = { count: DEFAULT_COUNT, source: DEFAULT_SOURCE };

  for (const arg of argv) {
    if (arg.startsWith('--count=')) {
      options.count = parseInt(arg.split('=')[1], 10) || DEFAULT_COUNT;
    } else if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1].toLowerCase();
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/claude/fetchRecentReadings.js [--count=5] [--source=kv|r2]`);
      process.exit(0);
    }
  }

  return options;
}

async function loadWranglerConfig() {
  try {
    const configPath = path.resolve(process.cwd(), 'wrangler.jsonc');
    const content = await fs.readFile(configPath, 'utf-8');
    // Strip comments
    const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed: ${stderr || stdout}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function fetchFromKV(namespaceId, count) {
  // List keys
  const listArgs = [
    'wrangler', 'kv', 'key', 'list',
    '--namespace-id', namespaceId,
    '--prefix', 'reading:',
    '--remote'
  ];

  const listOutput = await runCommand('npx', listArgs);
  let keys;
  try {
    keys = JSON.parse(listOutput);
  } catch {
    console.error('Failed to parse KV key list');
    return [];
  }

  // Sort by name (which includes timestamp) descending, take first N
  const sortedKeys = keys
    .filter(k => k?.name)
    .sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    .slice(0, count);

  const readings = [];
  for (const entry of sortedKeys) {
    const getArgs = [
      'wrangler', 'kv', 'key', 'get',
      entry.name,
      '--namespace-id', namespaceId,
      '--remote'
    ];

    try {
      const value = await runCommand('npx', getArgs);
      const data = JSON.parse(value);
      readings.push(data);
    } catch (err) {
      console.error(`Failed to fetch ${entry.name}: ${err.message}`);
    }
  }

  return readings;
}

async function fetchFromR2(count) {
  // Dynamic import to avoid requiring @aws-sdk when not needed
  const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3');

  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET || 'tarot-logs';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error('Missing R2 credentials. Set CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
    return [];
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });

  // List recent archives
  const listCmd = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: 'archives/metrics/',
    MaxKeys: 100
  });

  const listed = await client.send(listCmd);
  const objects = (listed.Contents || [])
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
    .slice(0, count);

  const readings = [];
  for (const obj of objects) {
    const getCmd = new GetObjectCommand({ Bucket: bucket, Key: obj.Key });
    const response = await client.send(getCmd);
    const body = await response.Body.transformToString();
    try {
      readings.push(JSON.parse(body));
    } catch {
      console.error(`Failed to parse ${obj.Key}`);
    }
  }

  return readings;
}

function formatReadingForClaude(reading, index) {
  const cards = reading.cardsInfo || reading.context?.cards || [];
  const cardsList = cards.map(c =>
    `  - ${c.position}: ${c.card} (${c.orientation})`
  ).join('\n');

  const evalScores = reading.eval?.scores;
  const evalSection = evalScores ? `
**Automated Eval Scores:**
  - Personalization: ${evalScores.personalization}/5
  - Tarot Coherence: ${evalScores.tarot_coherence}/5
  - Tone: ${evalScores.tone}/5
  - Safety: ${evalScores.safety}/5
  - Overall: ${evalScores.overall}/5
  - Safety Flag: ${evalScores.safety_flag ? 'YES' : 'No'}
  - Notes: ${evalScores.notes || 'N/A'}` : `
**Automated Eval:** Not available`;

  const narrativeMetrics = reading.narrative;
  const metricsSection = narrativeMetrics ? `
**Narrative Metrics:**
  - Card Coverage: ${(narrativeMetrics.cardCoverage * 100).toFixed(0)}%
  - Hallucinated Cards: ${narrativeMetrics.hallucinatedCards?.length || 0}` : '';

  // Try to get the actual reading text from various possible locations
  const readingText = reading.readingText ||
    reading.narrative?.reading ||
    reading.reading ||
    '(Reading text not captured in metrics)';

  return `
---
## Reading ${index + 1} (${reading.requestId || 'unknown'})

**Timestamp:** ${reading.timestamp || 'N/A'}
**Spread:** ${reading.spreadKey || 'N/A'}
**Provider:** ${reading.provider || 'N/A'}

**User Question:**
${reading.context?.question || reading.userQuestion || '(No question)'}

**Cards:**
${cardsList || '(No cards data)'}

**Reading:**
${typeof readingText === 'string' ? readingText.slice(0, 2000) : '(No reading text)'}
${readingText?.length > 2000 ? '...[truncated]' : ''}
${evalSection}
${metricsSection}
`;
}

async function main() {
  const { count, source } = parseArgs(process.argv.slice(2));

  console.error(`Fetching last ${count} readings from ${source.toUpperCase()}...`);

  let readings = [];

  if (source === 'kv') {
    const config = await loadWranglerConfig();
    const metricsNs = config?.kv_namespaces?.find(ns => ns.binding === 'METRICS_DB');
    if (!metricsNs?.id) {
      console.error('METRICS_DB namespace not found in wrangler.jsonc');
      process.exit(1);
    }
    readings = await fetchFromKV(metricsNs.id, count);
  } else if (source === 'r2') {
    readings = await fetchFromR2(count);
  } else {
    console.error(`Unknown source: ${source}. Use 'kv' or 'r2'.`);
    process.exit(1);
  }

  if (readings.length === 0) {
    console.log('No readings found.');
    return;
  }

  // Output formatted readings
  console.log(`# Recent Tarot Readings for Evaluation

Found ${readings.length} reading(s). Each includes the spread, cards, reading text, and automated evaluation scores.

Use this context to:
1. **Review quality** - Are the readings personalized? Do they address the question?
2. **Check safety** - Any concerning language, doom predictions, or inappropriate advice?
3. **Validate eval scores** - Do the automated scores match your assessment?
4. **Identify patterns** - Common issues across readings?
`);

  readings.forEach((reading, index) => {
    console.log(formatReadingForClaude(reading, index));
  });

  console.log(`
---
## Your Analysis

Now that you've seen these readings, you can ask me to:
- Evaluate specific readings in more depth
- Compare the automated eval scores to my assessment
- Identify patterns or issues across the readings
- Suggest prompt improvements based on common problems
- Flag any safety concerns I notice
`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
