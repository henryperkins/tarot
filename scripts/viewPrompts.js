#!/usr/bin/env node
/**
 * View Prompts and Readings from D1 eval_metrics
 * 
 * This script retrieves prompt engineering data stored in the D1 eval_metrics
 * table, allowing you to analyze prompts, readings, and their correlations.
 * 
 * Usage:
 *   node scripts/viewPrompts.js                  # List recent readings
 *   node scripts/viewPrompts.js --id <requestId> # View specific reading
 *   node scripts/viewPrompts.js --export         # Export all to JSONL
 *   node scripts/viewPrompts.js --stats          # Show aggregated statistics
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_EXPORT_PATH = 'data/prompt-engineering-export.jsonl';

function parseArgs(args) {
  const options = {
    id: null,
    export: false,
    stats: false,
    limit: 20,
    local: false,
    verbose: false,
    output: DEFAULT_EXPORT_PATH
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--id' && args[i + 1]) {
      options.id = args[++i];
    } else if (arg === '--export') {
      options.export = true;
    } else if (arg === '--stats') {
      options.stats = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (arg === '--local') {
      options.local = true;
    } else if (arg === '--out' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

function printUsage() {
  console.log(`
Usage: node scripts/viewPrompts.js [options]

Options:
  --id <requestId>    View a specific reading by request ID
  --export            Export all readings to JSONL file
  --stats             Show aggregated statistics
  --limit <n>         Limit number of results (default: 20)
  --local             Use local KV (for development)
  --out <file>        Output file for export (default: ${DEFAULT_EXPORT_PATH})
  --verbose, -v       Show detailed output
  --help, -h          Show this help message

Examples:
  node scripts/viewPrompts.js                     # List recent readings
  node scripts/viewPrompts.js --id abc123         # View specific reading
  node scripts/viewPrompts.js --stats             # Show statistics
  node scripts/viewPrompts.js --export --out prompts.jsonl
  node scripts/viewPrompts.js --local             # Use local D1 (miniflare)
`);
}

/**
 * Strip comments from JSONC while preserving strings containing "//".
 * Processes character-by-character to avoid corrupting URLs.
 */
function stripJsonComments(content) {
  let stripped = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (escapeNext) {
      stripped += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      stripped += char;
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      stripped += char;
      continue;
    }

    if (!inString) {
      // Single-line comment
      if (char === '/' && next === '/') {
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        if (content[i] === '\n') {
          stripped += '\n';
        }
        continue;
      }
      // Multi-line comment
      if (char === '/' && next === '*') {
        i += 2;
        while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) {
          i++;
        }
        i++;
        continue;
      }
    }

    stripped += char;
  }

  return stripped;
}

async function loadWranglerConfig() {
  try {
    const configPath = path.resolve(process.cwd(), 'wrangler.jsonc');
    const content = await fs.readFile(configPath, 'utf-8');
    const cleaned = stripJsonComments(content);
    return JSON.parse(cleaned);
  } catch (_err) {
    console.warn('Could not load wrangler.jsonc:', _err.message);
    return null;
  }
}


function getD1Database(config) {
  if (!config?.d1_databases?.length) return null;
  // Prefer binding "DB" (primary app database)
  const db = config.d1_databases.find(db => db.binding === 'DB') || config.d1_databases[0];
  return db || null;
}

async function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['wrangler', ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Wrangler exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function escapeSqlString(str) {
  return String(str || '').replace(/'/g, "''");
}

async function runD1Query(dbNameOrId, sql, options) {
  const args = ['d1', 'execute', dbNameOrId, '--command', sql, '--json'];

  if (options.local) {
    args.push('--local');
  }

  const output = await runWrangler(args);
  // Wrangler returns JSON array or an object with results; normalize both
  const parsed = JSON.parse(output);
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.result?.results) return parsed.result.results;
  if (parsed?.result) return parsed.result;
  if (parsed?.results) return parsed.results;
  return parsed;
}

function normalizeRecord(row) {
  let payload = row?.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (_err) {
      payload = null;
    }
  }

  const record = payload && typeof payload === 'object' ? { ...payload } : {};
  record.requestId = record.requestId || row?.request_id || row?.REQUEST_ID;
  record.provider = record.provider || row?.provider || row?.PROVIDER;
  record.spreadKey = record.spreadKey || row?.spread_key || row?.SPREAD_KEY;
  record.deckStyle = record.deckStyle || row?.deck_style || row?.DECK_STYLE;
  record.timestamp = record.timestamp || row?.created_at || row?.CREATED_AT;

  return record;
}

async function listReadings(dbNameOrId, options) {
  const sql = `
    SELECT request_id, provider, spread_key, deck_style, payload, created_at, updated_at
    FROM eval_metrics
    ORDER BY updated_at DESC
    LIMIT ${options.limit};
  `;
  const results = await runD1Query(dbNameOrId, sql, options);
  return (results || []).map(normalizeRecord);
}

async function fetchReading(dbNameOrId, requestId, options) {
  const safeId = escapeSqlString(requestId.replace(/^reading:/, ''));
  const sql = `
    SELECT request_id, provider, spread_key, deck_style, payload, created_at, updated_at
    FROM eval_metrics
    WHERE request_id = '${safeId}'
    LIMIT 1;
  `;
  const results = await runD1Query(dbNameOrId, sql, options);
  if (!Array.isArray(results) || results.length === 0) return null;
  return normalizeRecord(results[0]);
}

async function exportReadings(dbNameOrId, options) {
  const sql = `
    SELECT request_id, payload
    FROM eval_metrics
    ORDER BY updated_at DESC;
  `;
  const results = await runD1Query(dbNameOrId, sql, options);
  return (results || []).map(normalizeRecord);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function _formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

async function showSingleReading(record, options) {
  console.log('\n' + '='.repeat(80));
  console.log(`REQUEST: ${record.requestId}`);
  console.log('='.repeat(80));
  
  console.log(`\nTimestamp:  ${record.timestamp}`);
  console.log(`Provider:   ${record.provider}`);
  console.log(`Spread:     ${record.spreadKey}`);
  console.log(`Deck:       ${record.deckStyle}`);
  console.log(`Context:    ${record.context}`);

  if (record.narrative) {
    console.log('\n--- NARRATIVE METRICS ---');
    console.log(`Card Coverage:      ${(record.narrative.cardCoverage * 100).toFixed(1)}%`);
    console.log(`Missing Cards:      ${record.narrative.missingCards?.join(', ') || 'None'}`);
    console.log(`Hallucinated Cards: ${record.narrative.hallucinatedCards?.join(', ') || 'None'}`);
    if (record.narrative.spine) {
      console.log(`Spine Valid:        ${record.narrative.spine.isValid}`);
      console.log(`Total Sections:     ${record.narrative.spine.totalSections}`);
    }
  }

  if (record.llmUsage) {
    console.log('\n--- LLM USAGE ---');
    console.log(`Input Tokens:       ${record.llmUsage.input_tokens || 'N/A'}`);
    console.log(`Output Tokens:      ${record.llmUsage.output_tokens || 'N/A'}`);
    console.log(`Total Tokens:       ${record.llmUsage.total_tokens || 'N/A'}`);
  }

  if (record.promptEngineering) {
    const pe = record.promptEngineering;
    console.log('\n--- PROMPT ENGINEERING ---');
    console.log(`Combined Hash:      ${pe.hashes?.combined?.slice(0, 16)}...`);
    console.log(`System Fingerprint: ${pe.hashes?.system}`);
    console.log(`User Fingerprint:   ${pe.hashes?.user}`);
    console.log(`Response Fingerprint: ${pe.hashes?.response}`);
    
    if (pe.lengths) {
      console.log(`\nSystem Prompt:      ${formatBytes(pe.lengths.systemPrompt)}`);
      console.log(`User Prompt:        ${formatBytes(pe.lengths.userPrompt)}`);
      console.log(`Response:           ${formatBytes(pe.lengths.response)}`);
      console.log(`Total:              ${formatBytes(pe.lengths.total)}`);
    }

    if (pe.structure?.system) {
      console.log('\n--- SYSTEM PROMPT STRUCTURE ---');
      console.log(`Words:              ${pe.structure.system.wordCount}`);
      console.log(`Lines:              ${pe.structure.system.lineCount}`);
      console.log(`Sections:           ${pe.structure.system.sectionCount}`);
      console.log(`Has Markdown:       ${pe.structure.system.hasMarkdown}`);
      console.log(`Has Lists:          ${pe.structure.system.hasListItems}`);
    }

    if (options.verbose && pe.redacted) {
      console.log('\n--- REDACTED SYSTEM PROMPT ---');
      console.log(pe.redacted.systemPrompt?.slice(0, 2000) || '(empty)');
      if (pe.redacted.systemPrompt?.length > 2000) {
        console.log(`\n... (truncated, full length: ${pe.redacted.systemPrompt.length})`);
      }

      console.log('\n--- REDACTED USER PROMPT ---');
      console.log(pe.redacted.userPrompt?.slice(0, 1000) || '(empty)');
      if (pe.redacted.userPrompt?.length > 1000) {
        console.log(`\n... (truncated, full length: ${pe.redacted.userPrompt.length})`);
      }

      console.log('\n--- REDACTED RESPONSE ---');
      console.log(pe.redacted.response?.slice(0, 2000) || '(empty)');
      if (pe.redacted.response?.length > 2000) {
        console.log(`\n... (truncated, full length: ${pe.redacted.response.length})`);
      }
    }
  } else {
    console.log('\n(No prompt engineering data - may be local-composer or older record)');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

async function showStats(records) {
  console.log('\n' + '='.repeat(60));
  console.log('PROMPT ENGINEERING STATISTICS');
  console.log('='.repeat(60));

  const total = records.length;
  const withPrompts = records.filter(r => r.promptEngineering).length;
  const byProvider = {};
  const bySpread = {};
  const byDeck = {};
  
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCoverage = 0;
  let coverageCount = 0;
  let hallucinationCount = 0;
  
  const promptHashes = new Set();
  const uniquePrompts = new Set();

  for (const r of records) {
    // Count by provider
    byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
    bySpread[r.spreadKey] = (bySpread[r.spreadKey] || 0) + 1;
    byDeck[r.deckStyle] = (byDeck[r.deckStyle] || 0) + 1;

    // Token usage
    if (r.llmUsage) {
      totalInputTokens += r.llmUsage.input_tokens || 0;
      totalOutputTokens += r.llmUsage.output_tokens || 0;
    }

    // Quality metrics
    if (r.narrative?.cardCoverage != null) {
      totalCoverage += r.narrative.cardCoverage;
      coverageCount++;
    }
    if (r.narrative?.hallucinatedCards?.length > 0) {
      hallucinationCount++;
    }

    // Prompt uniqueness
    if (r.promptEngineering?.hashes?.combined) {
      promptHashes.add(r.promptEngineering.hashes.combined);
    }
    if (r.promptEngineering?.hashes?.system) {
      uniquePrompts.add(r.promptEngineering.hashes.system);
    }
  }

  console.log(`\nTotal Readings:           ${total}`);
  console.log(`With Prompt Data:         ${withPrompts} (${((withPrompts/total)*100).toFixed(1)}%)`);
  console.log(`Unique Prompt Combos:     ${promptHashes.size}`);
  console.log(`Unique System Prompts:    ${uniquePrompts.size}`);

  console.log('\n--- BY PROVIDER ---');
  for (const [provider, count] of Object.entries(byProvider).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${provider.padEnd(20)} ${count}`);
  }

  console.log('\n--- BY SPREAD ---');
  for (const [spread, count] of Object.entries(bySpread).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${spread.padEnd(20)} ${count}`);
  }

  console.log('\n--- BY DECK ---');
  for (const [deck, count] of Object.entries(byDeck).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${deck.padEnd(20)} ${count}`);
  }

  console.log('\n--- QUALITY ---');
  console.log(`  Avg Card Coverage:      ${coverageCount ? ((totalCoverage/coverageCount)*100).toFixed(1) : 'N/A'}%`);
  console.log(`  Readings w/ Hallucinations: ${hallucinationCount} (${((hallucinationCount/total)*100).toFixed(1)}%)`);

  console.log('\n--- TOKEN USAGE ---');
  console.log(`  Total Input Tokens:     ${totalInputTokens.toLocaleString()}`);
  console.log(`  Total Output Tokens:    ${totalOutputTokens.toLocaleString()}`);
  console.log(`  Avg Input per Reading:  ${Math.round(totalInputTokens / (withPrompts || 1)).toLocaleString()}`);
  console.log(`  Avg Output per Reading: ${Math.round(totalOutputTokens / (withPrompts || 1)).toLocaleString()}`);

  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  
  console.log('Loading Wrangler configuration...');
  const config = await loadWranglerConfig();
  const dbConfig = getD1Database(config);

  if (!dbConfig) {
    console.error('Error: D1 database binding not found in wrangler.jsonc (expected binding "DB").');
    process.exit(1);
  }

  const dbNameOrId = dbConfig.database_name || dbConfig.database_id || dbConfig.name;
  console.log(`Using D1 database: ${dbNameOrId}`);
  console.log(`Target: ${options.local ? 'local' : 'remote'}\n`);

  // View single reading
  if (options.id) {
    try {
      const record = await fetchReading(dbNameOrId, options.id, options);
      if (!record) {
        console.error(`No reading found with request ID ${options.id}`);
        process.exit(1);
      }
      await showSingleReading(record, options);
    } catch (_err) {
      console.error(`Error fetching reading: ${_err.message}`);
      process.exit(1);
    }
    return;
  }

  // List readings
  console.log('Fetching readings from D1 eval_metrics...');
  let records = [];
  try {
    records = await listReadings(dbNameOrId, options);
  } catch (_err) {
    console.error(`Error querying D1: ${_err.message}`);
    process.exit(1);
  }

  if (records.length === 0) {
    console.log('No readings found in eval_metrics.');
    console.log('Readings are stored when using Azure GPT-5 or Claude backends.');
    return;
  }

  // Show stats
  if (options.stats) {
    await showStats(records);
    return;
  }

  // Export
  if (options.export) {
    console.log('Exporting readings from D1 eval_metrics...');
    const exportRecords = await exportReadings(dbNameOrId, options);
    const outputPath = path.resolve(process.cwd(), options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    const lines = exportRecords.map(r => JSON.stringify(r));
    await fs.writeFile(outputPath, lines.join('\n') + '\n');
    
    console.log(`\nExported ${exportRecords.length} readings to ${outputPath}`);
    return;
  }

  // List view (default)
  console.log('\n' + '-'.repeat(100));
  console.log('REQUEST ID'.padEnd(40) + 'PROVIDER'.padEnd(15) + 'SPREAD'.padEnd(12) + 'COVERAGE'.padEnd(10) + 'HAS PROMPTS');
  console.log('-'.repeat(100));
  
  for (const r of records) {
    const coverage = r.narrative?.cardCoverage != null 
      ? `${(r.narrative.cardCoverage * 100).toFixed(0)}%`
      : 'N/A';
    const hasPrompts = r.promptEngineering ? '✓' : '-';
    
    console.log(
      (r.requestId || 'unknown').slice(0, 36).padEnd(40) +
      (r.provider || 'unknown').padEnd(15) +
      (r.spreadKey || 'unknown').padEnd(12) +
      coverage.padEnd(10) +
      hasPrompts
    );
  }
  
  console.log('-'.repeat(100));
  console.log(`\nShowing ${records.length} recent readings from eval_metrics`);
  console.log('Use --id <requestId> to view full details');
  console.log('Use --export to export all readings');
  console.log('Use --stats to see aggregated statistics');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});