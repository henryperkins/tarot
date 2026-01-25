#!/usr/bin/env node
/**
 * Log tarot training data to Weights & Biases (W&B) Weave.
 *
 * Reads exported readings from JSONL and logs them as a Weave dataset
 * for experiment tracking, evaluation, and model training.
 *
 * Prerequisites:
 *   - W&B account and API key (https://wandb.ai/authorize)
 *   - Set WANDB_API_KEY environment variable or run `wandb login`
 *
 * Usage examples:
 *   node scripts/training/logToWandB.js
 *   node scripts/training/logToWandB.js --input training/readings.jsonl
 *   node scripts/training/logToWandB.js --project lakefront-digital/Tarot --limit 100
 *   node scripts/training/logToWandB.js --dataset-name tarot-readings-v2
 *
 * The script will:
 *   1. Read exported readings from JSONL (produced by exportReadings.js)
 *   2. Initialize Weave with the specified project
 *   3. Log readings as a versioned Weave dataset
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import weave from 'weave';

const DEFAULT_INPUT = 'training/readings.jsonl';
const DEFAULT_PROJECT = 'lakefront-digital/Tarot';
const DEFAULT_DATASET_NAME = 'tarot-readings';

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  // Check for API key
  if (!process.env.WANDB_API_KEY) {
    console.error('[wandb] WANDB_API_KEY environment variable not set.');
    console.error('       Get your API key at: https://wandb.ai/authorize');
    console.error('       Then set it: export WANDB_API_KEY=your_key_here');
    process.exit(1);
  }

  console.log(`[wandb] Reading training data from: ${options.input}`);
  const readings = await loadReadings(options.input, options.limit);

  if (!readings.length) {
    console.warn('[wandb] No readings found. Run exportReadings.js first to generate training data.');
    process.exit(1);
  }

  console.log(`[wandb] Loaded ${readings.length} reading(s)`);

  // Transform readings to W&B-friendly format
  const dataset = readings.map(transformReading);

  // Initialize Weave
  console.log(`[wandb] Initializing Weave project: ${options.project}`);
  await weave.init(options.project);

  // Create and publish dataset
  console.log(`[wandb] Publishing dataset: ${options.datasetName}`);
  const weaveDataset = new weave.Dataset({
    name: options.datasetName,
    rows: dataset
  });

  await weaveDataset.save();

  console.log(`[wandb] Successfully logged ${dataset.length} reading(s) to W&B`);
  console.log(`[wandb] View at: https://wandb.ai/${options.project}`);
}

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    project: DEFAULT_PROJECT,
    datasetName: DEFAULT_DATASET_NAME,
    limit: null,
    verbose: false,
    help: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--input':
      case '--in':
        options.input = argv[++i] || options.input;
        break;
      case '--project':
        options.project = argv[++i] || options.project;
        break;
      case '--dataset-name':
      case '--name':
        options.datasetName = argv[++i] || options.datasetName;
        break;
      case '--limit':
        options.limit = parseInt(argv[++i], 10) || null;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          // Positional argument - treat as input file
          options.input = arg;
        } else {
          console.warn(`[wandb] Unknown argument: ${arg}`);
        }
        break;
    }
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/training/logToWandB.js [options]

Log tarot training data to Weights & Biases Weave.

Options:
  --input <file>        Input JSONL file (default: ${DEFAULT_INPUT})
  --project <name>      W&B project (default: ${DEFAULT_PROJECT})
  --dataset-name <name> Dataset name in W&B (default: ${DEFAULT_DATASET_NAME})
  --limit <n>           Limit number of readings to log
  --verbose             Enable debug logging
  --help, -h            Show this help message

Environment:
  WANDB_API_KEY         Your W&B API key (required)
                        Get it at: https://wandb.ai/authorize

Examples:
  # Log all readings to default project
  node scripts/training/logToWandB.js

  # Log with custom dataset name
  node scripts/training/logToWandB.js --dataset-name readings-2026-01

  # Log first 50 readings for testing
  node scripts/training/logToWandB.js --limit 50

Workflow:
  1. Export readings:  node scripts/training/exportReadings.js
  2. Log to W&B:       node scripts/training/logToWandB.js
`);
}

async function loadReadings(inputPath, limit = null) {
  const absPath = path.resolve(process.cwd(), inputPath);

  try {
    const content = await fs.readFile(absPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    let readings = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (limit && limit > 0) {
      readings = readings.slice(0, limit);
    }

    return readings;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`[wandb] Input file not found: ${absPath}`);
      console.error('       Run: node scripts/training/exportReadings.js');
      return [];
    }
    throw err;
  }
}

/**
 * Transform a reading record to W&B-friendly format.
 * Flattens nested structures and ensures consistent types.
 */
function transformReading(reading) {
  // Extract eval scores with defaults
  const evalScores = reading.evalScores || {};

  // Extract card info
  const cards = (reading.cards || []).map((card) => ({
    name: card.name || card.card || null,
    position: card.position || null,
    orientation: card.orientation || 'Upright',
    suit: card.suit || null,
    rank: card.rank || null,
    number: card.number ?? null
  }));

  // Build card names list for easier querying
  const cardNames = cards.map((c) => c.name).filter(Boolean);
  const reversedCount = cards.filter((c) => c.orientation === 'Reversed').length;

  return {
    // Identifiers
    id: reading.requestId || reading.journalId || null,
    timestamp: reading.timestamp || null,

    // Reading content
    spread_key: reading.spreadKey || null,
    spread_name: reading.spreadName || null,
    deck_style: reading.deckStyle || 'rws-1909',
    question: reading.question || '',
    narrative: reading.readingText || '',
    themes: Array.isArray(reading.themes) ? reading.themes.join(', ') : (reading.themes || null),

    // Card data
    cards: JSON.stringify(cards),
    card_names: cardNames.join(', '),
    card_count: cards.length,
    reversed_count: reversedCount,

    // Provider info
    provider: reading.provider || null,

    // Evaluation scores (1-5 scale)
    eval_personalization: evalScores.personalization ?? null,
    eval_tarot_coherence: evalScores.tarot_coherence ?? null,
    eval_tone: evalScores.tone ?? null,
    eval_safety: evalScores.safety ?? null,
    eval_overall: evalScores.overall ?? null,
    eval_safety_flag: reading.evalSafetyFlag ?? null,

    // User feedback
    feedback_label: reading.feedbackLabel || null,
    feedback_average: reading.feedbackAverage ?? null,

    // Vision data (if available)
    vision_summary: reading.visionSummary || null,

    // Reflections (user input during reading)
    has_reflections: Boolean(reading.reflections && Object.keys(reading.reflections).length > 0)
  };
}

main().catch((err) => {
  console.error('[wandb] Error:', err.message);
  process.exit(1);
});
