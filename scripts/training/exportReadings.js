#!/usr/bin/env node
/**
 * Export structured tarot readings for training/evaluation.
 *
 * Aggregates data from:
 * - journal_entries (D1 or JSON backup)
 * - feedback (Workers KV or JSON backup)
 * - reading metrics (KV or JSONL backup)
 *
 * Usage examples:
 *   node scripts/training/exportReadings.js
 *   node scripts/training/exportReadings.js --out tmp/readings.jsonl --limit 200
 *   node scripts/training/exportReadings.js --journal-source file --journal-file data/journal/export.json
 *
 * Requires Wrangler for live D1/KV exports. Configure bindings in wrangler.jsonc (or legacy
 * wrangler.toml) or use --feedback-namespace / --metrics-namespace flags to override.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createR2Client,
  listJsonFromR2,
  fetchKvJsonRecords,
  executeD1Query,
  runWranglerCommand
} from '../lib/dataAccess.js';

const DEFAULT_OUTPUT = 'training/readings.jsonl';
const DEFAULT_JOURNAL_FILE = 'data/journal/export.json';
const DEFAULT_FEEDBACK_FILE = 'data/feedback/export.json';
const DEFAULT_METRICS_FILE = 'data/evaluations/reading-metrics.jsonl';

async function main() {
  const wranglerConfig = await loadWranglerConfig();
  const options = parseArgs(process.argv.slice(2), wranglerConfig);

  if (options.verbose) {
    console.log('[export] options:', options);
  }

  const journalEntries = await loadJournalEntries(options);
  if (!journalEntries.length) {
    console.warn('[export] No journal entries found; output will be empty unless other sources add records.');
  }

  const feedbackRecords = options.feedbackSource === 'none'
    ? []
    : await loadFeedbackRecords(options);

  const metricsRecords = options.metricsSource === 'none'
    ? []
    : await loadMetricsRecords(options);

  const dataset = mergeReadings(journalEntries, feedbackRecords, metricsRecords, options);
  await writeJsonl(dataset, options.output);

  console.log(`[export] Wrote ${dataset.length} reading(s) to ${options.output}`);
}

function parseArgs(argv, wranglerConfig) {
  const defaults = {
    output: DEFAULT_OUTPUT,
    journalSource: 'd1',
    journalFile: DEFAULT_JOURNAL_FILE,
    feedbackSource: 'kv',
    feedbackFile: DEFAULT_FEEDBACK_FILE,
    metricsSource: 'kv',
    metricsFile: DEFAULT_METRICS_FILE,
    limit: null,
    wranglerTarget: 'remote',
    verbose: false,
    includeEval: true,
    requireEval: false,
    metricsDays: 7,
    r2Bucket: process.env.R2_BUCKET || 'tarot-logs',
    d1Name: wranglerConfig?.d1?.[0]?.database_name || 'mystic-tarot-db',
    feedbackNamespace: getNamespaceId(wranglerConfig, 'FEEDBACK_KV') || null,
    metricsNamespace: getNamespaceId(wranglerConfig, 'METRICS_DB') || null
  };

  const options = { ...defaults };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
      case '--output':
        options.output = argv[++i] || defaults.output;
        break;
      case '--journal-source':
        options.journalSource = (argv[++i] || defaults.journalSource).toLowerCase();
        break;
      case '--journal-file':
        options.journalFile = argv[++i] || defaults.journalFile;
        break;
      case '--feedback-source':
        options.feedbackSource = (argv[++i] || defaults.feedbackSource).toLowerCase();
        break;
      case '--feedback-file':
        options.feedbackFile = argv[++i] || defaults.feedbackFile;
        break;
      case '--metrics-source':
        options.metricsSource = (argv[++i] || defaults.metricsSource).toLowerCase();
        break;
      case '--metrics-file':
        options.metricsFile = argv[++i] || defaults.metricsFile;
        break;
      case '--limit':
        options.limit = Number(argv[++i]);
        break;
      case '--wrangler-target':
        options.wranglerTarget = (argv[++i] || defaults.wranglerTarget).toLowerCase();
        break;
      case '--d1-name':
        options.d1Name = argv[++i] || defaults.d1Name;
        break;
      case '--feedback-namespace':
        options.feedbackNamespace = argv[++i] || null;
        break;
      case '--metrics-namespace':
        options.metricsNamespace = argv[++i] || null;
        break;
      case '--metrics-days':
        options.metricsDays = Number(argv[++i]);
        break;
      case '--r2-bucket':
        options.r2Bucket = argv[++i] || options.r2Bucket;
        break;
      case '--include-eval':
        options.includeEval = true;
        break;
      case '--no-eval':
        options.includeEval = false;
        break;
      case '--require-eval':
        options.requireEval = true;
        options.includeEval = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        console.warn(`[export] Unknown argument ignored: ${arg}`);
        break;
    }
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/training/exportReadings.js [options]

Options:
  --out <file>                 Output JSONL path (default: ${DEFAULT_OUTPUT})
  --limit <number>             Limit journal rows when using D1 source
  --journal-source <d1|file>   Source for journal entries (default: d1)
  --journal-file <path>        JSON file to read journal entries when using file source
  --feedback-source <kv|file|none>  Source for feedback records (default: kv)
  --feedback-file <path>       JSON file for feedback when using file source
  --metrics-source <kv|file|none>   Source for metrics (default: kv)
  --metrics-file <path>        JSONL/JSON file for metrics when using file source
  --metrics-days <number>      When metrics-source=r2, include archives from the last N days (default: 7)
  --r2-bucket <name>           R2 bucket for metrics archives (default: env R2_BUCKET or tarot-logs)
  --include-eval               Include eval payloads when present in metrics (default: on)
  --no-eval                    Exclude eval payloads from export
  --require-eval               Only include records that contain eval payloads
  --wrangler-target <local|remote>  Use local or remote Wrangler bindings (default: remote)
  --d1-name <name>             D1 database binding name (default: from wrangler.jsonc/wrangler.toml)
  --feedback-namespace <id>    Override FEEDBACK_KV namespace id
  --metrics-namespace <id>     Override METRICS_DB namespace id
  --verbose                    Enable debug logging
`);
}

async function loadJournalEntries(options) {
  if (options.journalSource === 'file') {
    return readJournalFromFile(options.journalFile);
  }
  return fetchJournalFromD1(options);
}

async function loadFeedbackRecords(options) {
  if (options.feedbackSource === 'file') {
    return readFeedbackFromFile(options.feedbackFile);
  }

  if (!options.feedbackNamespace) {
    console.warn('[export] FEEDBACK_KV namespace id missing; pass --feedback-namespace or add FEEDBACK_KV binding to wrangler.jsonc/wrangler.toml. Falling back to file source.');
    return readFeedbackFromFile(options.feedbackFile, { optional: true });
  }

  return fetchFeedbackFromKv({
    namespaceId: options.feedbackNamespace,
    target: options.wranglerTarget
  });
}

async function loadMetricsRecords(options) {
  if (options.metricsSource === 'file') {
    return readMetricsFromFile(options.metricsFile);
  }

  if (options.metricsSource === 'r2') {
    return fetchMetricsFromR2(options);
  }

  if (!options.metricsNamespace) {
    console.warn('[export] METRICS_DB namespace id missing; pass --metrics-namespace or set METRICS_DB in wrangler.jsonc/wrangler.toml. Metrics will be skipped.');
    return [];
  }

  return fetchMetricsFromKv({
    namespaceId: options.metricsNamespace,
    target: options.wranglerTarget
  });
}

async function readJournalFromFile(filePath, { optional = false } = {}) {
  try {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.entries)) return data.entries;
    return [];
  } catch (err) {
    if (optional && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function readFeedbackFromFile(filePath, { optional = false } = {}) {
  try {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.records)) return data.records;
    return [];
  } catch (err) {
    if (optional && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function readMetricsFromFile(filePath, { optional = true } = {}) {
  try {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(absPath, 'utf-8');
    // Accept JSON Lines or plain JSON array
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      const data = JSON.parse(content);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.records)) return data.records;
      return data?.perSample || [];
    }
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  } catch (err) {
    if (optional && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function fetchJournalFromD1(options) {
  const limitClause = Number.isFinite(options.limit) ? ` LIMIT ${options.limit}` : '';

  // Check if request_id column exists (added in migration 0007)
  // We must detect this dynamically because referencing a non-existent column
  // in SQLite throws "no such column" even inside COALESCE.
  const pragmaArgs = [
    'wrangler',
    'd1',
    'execute',
    options.d1Name,
    '--command',
    'PRAGMA table_info(journal_entries);',
    '--json'
  ];
  if (options.wranglerTarget === 'local') {
    pragmaArgs.push('--local');
  } else if (options.wranglerTarget === 'remote') {
    pragmaArgs.push('--remote');
  }

  let hasRequestIdColumn = false;
  try {
    const pragmaResult = await runWranglerCommand(pragmaArgs);
    const pragmaParsed = JSON.parse(pragmaResult);
    const columns = Array.isArray(pragmaParsed)
      ? pragmaParsed.flatMap((entry) => entry?.results || [])
      : pragmaParsed?.results || [];
    hasRequestIdColumn = columns.some((col) => col.name === 'request_id');
  } catch {
    // If PRAGMA fails, assume column doesn't exist
    hasRequestIdColumn = false;
  }

  const requestIdSelect = hasRequestIdColumn ? ',\n      request_id' : '';
  const sql = `
    SELECT
      id,
      created_at,
      spread_key,
      spread_name,
      question,
      cards_json,
      narrative,
      themes_json,
      reflections_json,
      context,
      provider,
      session_seed${requestIdSelect}
    FROM journal_entries
    ORDER BY created_at DESC${limitClause};
  `.trim();

  const rows = await executeD1Query({
    dbName: options.d1Name,
    sql,
    target: options.wranglerTarget
  });

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.created_at ? new Date(row.created_at * 1000).toISOString() : null,
    spreadKey: row.spread_key,
    spreadName: row.spread_name,
    question: row.question || '',
    cards: safeParseJson(row.cards_json, []),
    readingText: row.narrative || '',
    themes: safeParseJson(row.themes_json, null),
    reflections: safeParseJson(row.reflections_json, {}),
    context: row.context || null,
    provider: row.provider || null,
    sessionSeed: row.session_seed || null,
    requestId: row.request_id || null
  }));
}

async function fetchFeedbackFromKv({ namespaceId, target }) {
  return fetchKvJsonRecords({ namespaceId, prefix: 'feedback:', target });
}

async function fetchMetricsFromKv({ namespaceId, target }) {
  return fetchKvJsonRecords({ namespaceId, prefix: 'reading:', target });
}

async function fetchMetricsFromR2(options) {
  const bucket = options.r2Bucket || process.env.R2_BUCKET || 'tarot-logs';
  let client;
  try {
    client = createR2Client();
  } catch (err) {
    console.warn(`[export] ${err.message}`);
    return [];
  }

  const days = Number.isFinite(options.metricsDays) ? options.metricsDays : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  try {
    const objects = await listJsonFromR2(client, {
      bucket,
      prefix: 'archives/metrics/',
      cutoffDate: cutoff
    });
    return objects.map((item) => item.data).filter(Boolean);
  } catch (err) {
    console.warn(`[export] Failed to fetch metrics from R2: ${err.message}`);
    return [];
  }
}

function mergeReadings(journalEntries, feedbackRecords, metricsRecords, options = {}) {
  const feedbackByRequest = new Map();
  const feedbackBySignature = new Map();
  feedbackRecords.forEach((record) => {
    if (record?.requestId) {
      feedbackByRequest.set(record.requestId, record);
    }
    const sig = buildSignature(record?.spreadKey, record?.userQuestion, record?.cards);
    if (sig) {
      feedbackBySignature.set(sig, record);
    }
  });

  const metricsByRequest = new Map();
  metricsRecords.forEach((record) => {
    if (record?.requestId) {
      metricsByRequest.set(record.requestId, record);
    }
  });

  const records = journalEntries.map((entry) => {
    const signature = buildSignature(entry.spreadKey, entry.question, entry.cards);
    const primaryFeedback = entry.requestId
      ? feedbackByRequest.get(entry.requestId)
      : null;
    const fallbackFeedback = !primaryFeedback && signature
      ? feedbackBySignature.get(signature)
      : null;
    const feedback = primaryFeedback || fallbackFeedback || null;

    const requestId = entry.requestId || feedback?.requestId || null;
    const metrics = requestId ? metricsByRequest.get(requestId) || null : null;

    if (options.requireEval && !metrics?.eval) {
      return null;
    }

    const feedbackStats = feedback ? deriveFeedbackStats(feedback.ratings) : null;
    const evalPayload = options.includeEval ? metrics?.eval || null : null;
    const evalScores = evalPayload?.scores || null;
    const evalSafetyFlag = evalScores?.safety_flag ?? null;

    return {
      requestId,
      journalId: entry.id,
      timestamp: entry.timestamp,
      spreadKey: entry.spreadKey,
      spreadName: entry.spreadName,
      deckStyle: feedback?.deckStyle || metrics?.deckStyle || null,
      context: entry.context,
      question: entry.question,
      cards: normalizeCards(entry.cards),
      readingText: entry.readingText,
      spreadAnalysis: entry.spreadAnalysis || null,
      themes: entry.themes,
      reflections: entry.reflections,
      provider: entry.provider,
      sessionSeed: entry.sessionSeed,
      visionSummary: feedback?.visionSummary || metrics?.vision?.summary || null,
      deckVisionMetrics: metrics?.vision || null,
      feedbackLabel: feedbackStats?.label || null,
      feedbackAverage: feedbackStats?.average || null,
      evalScores,
      evalSafetyFlag,
      eval: evalPayload,
      feedback: feedback
        ? {
            ratings: feedback.ratings,
            notes: feedback.notes || null,
            submittedAt: feedback.submittedAt,
            visionSummary: feedback.visionSummary || null,
            label: feedbackStats?.label || null,
            averageScore: feedbackStats?.average || null
          }
        : null,
      metrics: metrics
        ? {
            vision: metrics.vision || null,
            narrative: metrics.narrative || null,
            spreadKey: metrics.spreadKey,
            provider: metrics.provider,
            timestamp: metrics.timestamp,
            eval: evalPayload
          }
        : null
    };
  });

  return records.filter(Boolean);
}

function normalizeCards(cards = []) {
  if (!Array.isArray(cards)) return [];
  return cards.map((card, index) => {
    // Infer rankValue from rank name if missing (for legacy data)
    let rankValue = card.rankValue ?? null;
    if (rankValue === null && card.rank) {
      const RANK_VALUES = {
        Ace: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7,
        Eight: 8, Nine: 9, Ten: 10, Page: 11, Knight: 12, Queen: 13, King: 14
      };
      rankValue = RANK_VALUES[card.rank] ?? null;
    }

    return {
      position: card.position || `Position ${index + 1}`,
      name: card.name || card.card || card.title || null,
      card: card.card || card.name || null,
      orientation: card.orientation || card.status || 'Upright',
      // Major Arcana: number (0-21), Minor Arcana: null
      number: card.number ?? card.value ?? null,
      suit: card.suit || null,
      rank: card.rank || null,
      // Minor Arcana: rankValue (1-14), Major Arcana: null
      rankValue
    };
  });
}

function deriveFeedbackStats(ratings) {
  if (!ratings || typeof ratings !== 'object') {
    return null;
  }
  const values = Object.values(ratings)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!values.length) {
    return null;
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  let label = 'neutral';
  if (average >= 4.5) {
    label = 'strong-positive';
  } else if (average >= 3.5) {
    label = 'positive';
  } else if (average <= 2) {
    label = 'negative';
  } else if (average <= 3) {
    label = 'mixed';
  }
  return { average, label };
}

function buildSignature(spreadKey, question, cards = []) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }
  const normalizedCards = cards
    .map((card) => `${card.position || ''}|${card.card || card.name || ''}|${card.orientation || ''}`)
    .join('||');
  return `${spreadKey || 'general'}::${question || ''}::${normalizedCards}`;
}

async function writeJsonl(records, outputPath) {
  const absPath = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record));
  await fs.writeFile(absPath, `${lines.join('\n')}\n`);
}

function safeParseJson(value, fallback = null) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Load wrangler config from wrangler.jsonc (preferred) or wrangler.toml (legacy).
 * Supports optional configPath override for either format.
 */
async function loadWranglerConfig(configPath = null) {
  // If explicit path provided, use that
  if (configPath) {
    return loadWranglerConfigFromPath(configPath);
  }

  // Try wrangler.jsonc first (new Workers format), then fall back to wrangler.toml
  const jsoncResult = await loadWranglerConfigFromPath('wrangler.jsonc');
  if (jsoncResult) return jsoncResult;

  return loadWranglerConfigFromPath('wrangler.toml');
}

async function loadWranglerConfigFromPath(configPath) {
  try {
    const absPath = path.resolve(process.cwd(), configPath);
    const content = await fs.readFile(absPath, 'utf-8');

    // Detect format based on extension
    if (configPath.endsWith('.jsonc') || configPath.endsWith('.json')) {
      return parseJsoncConfig(content);
    }

    // Legacy TOML format
    return {
      d1: parseTomlBlocks(content, 'd1_databases'),
      kv: parseTomlBlocks(content, 'kv_namespaces')
    };
  } catch {
    return null;
  }
}

/**
 * Parse JSONC (JSON with comments) wrangler config.
 * Strips comments while preserving URLs and other strings containing "//".
 */
function parseJsoncConfig(content) {
  // Strip comments while respecting string literals.
  // Process character-by-character to avoid stripping "//" inside strings.
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
      // Check for single-line comment
      if (char === '/' && next === '/') {
        // Skip to end of line
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        // Include the newline to preserve line structure
        if (content[i] === '\n') {
          stripped += '\n';
        }
        continue;
      }
      // Check for multi-line comment
      if (char === '/' && next === '*') {
        i += 2; // Skip /*
        while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) {
          i++;
        }
        i++; // Skip closing */
        continue;
      }
    }

    stripped += char;
  }

  try {
    const config = JSON.parse(stripped);
    return {
      d1: config.d1_databases || [],
      kv: config.kv_namespaces || []
    };
  } catch {
    return null;
  }
}

function parseTomlBlocks(content, blockName) {
  const lines = content.split('\n');
  const blocks = [];
  let current = null;
  const header = `[[${blockName}]]`;

  for (const rawLine of lines) {
    const noComment = rawLine.split('#')[0];
    const line = noComment.trim();
    if (!line) continue;
    if (line === header) {
      if (current) blocks.push(current);
      current = {};
      continue;
    }
    if (line.startsWith('[[') || line.startsWith('[')) {
      if (current) {
        blocks.push(current);
        current = null;
      }
      continue;
    }
    if (!current) continue;
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    current[match[1]] = value;
  }

  if (current) blocks.push(current);
  return blocks;
}

function getNamespaceId(config, bindingName) {
  if (!config?.kv || !bindingName) return null;
  const entry = config.kv.find((ns) => ns.binding === bindingName);
  return entry?.id || null;
}

main().catch((err) => {
  console.error('[export] Failed to build reading export:', err);
  process.exit(1);
});
