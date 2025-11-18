#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SPREADS } from '../../src/data/spreads.js';
import { getDeckImagePath } from '../../shared/vision/deckAssets.js';
import { buildGraphContext } from '../../functions/lib/graphContext.js';
import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';

const DEFAULT_INPUT = 'training/readings.jsonl';
const DEFAULT_OUTPUT = 'training/multimodal-dataset.jsonl';
const DEFAULT_VISION_METRICS = 'data/evaluations/vision-metrics.json';
const DEFAULT_DECK_STYLE = 'rws-1909';

const CARD_INDEX = buildCardIndex();

function buildCardIndex() {
  const map = new Map();
  [...MAJOR_ARCANA, ...MINOR_ARCANA].forEach((card) => {
    if (card && card.name) {
      map.set(card.name, card);
    }
  });
  return map;
}

function getDeckLineage(deckStyle) {
  if (!deckStyle) return null;
  if (deckStyle.startsWith('thoth')) return 'thoth';
  if (deckStyle.startsWith('marseille')) return 'marseille';
  if (deckStyle.startsWith('rws')) return 'rws-like';
  return 'indie';
}

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    visionMetricsFile: DEFAULT_VISION_METRICS,
    defaultDeckStyle: DEFAULT_DECK_STYLE,
    verbose: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--in':
      case '--input':
        options.input = argv[++i] || options.input;
        break;
      case '--out':
      case '--output':
        options.output = argv[++i] || options.output;
        break;
      case '--vision-metrics':
        options.visionMetricsFile = argv[++i] || options.visionMetricsFile;
        break;
      case '--default-deck-style':
        options.defaultDeckStyle = argv[++i] || options.defaultDeckStyle;
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
        // Ignore unknown args to keep script flexible.
        break;
    }
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/training/buildMultimodalDataset.js [options]

Options:
  --in | --input <file>            Input readings JSONL (default: ${DEFAULT_INPUT})
  --out | --output <file>          Output multimodal JSONL (default: ${DEFAULT_OUTPUT})
  --vision-metrics <file>          Vision metrics JSON file (default: ${DEFAULT_VISION_METRICS})
  --default-deck-style <deckId>    Fallback deck style when missing (default: ${DEFAULT_DECK_STYLE})
  --verbose                        Enable debug logging
`);
}

async function loadJsonl(filePath) {
  const absPath = path.resolve(process.cwd(), filePath);
  let content;
  try {
    content = await fs.readFile(absPath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Input file not found: ${filePath}`);
    }
    throw err;
  }

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        console.warn(`[buildMultimodalDataset] Skipping invalid JSON on line ${index + 1}:`, err.message);
        return null;
      }
    })
    .filter(Boolean);
}

async function loadVisionMetrics(filePath, { verbose } = {}) {
  if (!filePath) return null;
  const absPath = path.resolve(process.cwd(), filePath);
  try {
    const content = await fs.readFile(absPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (verbose) {
      console.log('[buildMultimodalDataset] Loaded vision metrics from', filePath);
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn('[buildMultimodalDataset] Vision metrics file not found; deckVisionMetrics will be omitted.');
      return null;
    }
    console.warn('[buildMultimodalDataset] Failed to read vision metrics:', err.message);
    return null;
  }
}

function pickDeckVisionMetrics(allMetrics, deckStyle) {
  if (!allMetrics || !deckStyle) return null;
  const metricsByDeck = allMetrics.metricsByDeck || {};
  const entry = metricsByDeck[deckStyle];
  return entry || null;
}

function enrichCard(baseCard, deckStyle) {
  if (!baseCard || typeof baseCard !== 'object') {
    return null;
  }

  const rawName = baseCard.card || baseCard.name || null;
  const canonicalName = rawName ? canonicalizeCardName(rawName, deckStyle) : null;
  const key = canonicalName || rawName || null;
  const canonical = key ? CARD_INDEX.get(key) || {} : {};
  const name = canonicalName || canonical.name || rawName || null;

  const merged = {
    position: baseCard.position || null,
    name,
    card: name,
    orientation: baseCard.orientation || 'Upright',
    number: baseCard.number ?? canonical.number ?? null,
    suit: baseCard.suit || canonical.suit || null,
    rank: baseCard.rank || canonical.rank || null,
    rankValue: baseCard.rankValue ?? canonical.rankValue ?? null
  };

  const imageCard = { ...canonical, ...merged };
  const imagePath = getDeckImagePath(imageCard, deckStyle);

  return {
    ...merged,
    imagePath: imagePath || null,
    isReversed: String(merged.orientation || '').toLowerCase() === 'reversed'
  };
}

function toMultimodalExample(reading, deckMetrics, options) {
  const deckStyle = reading.deckStyle || options.defaultDeckStyle || DEFAULT_DECK_STYLE;
  const deckLineage = getDeckLineage(deckStyle);
  const cards = Array.isArray(reading.cards) ? reading.cards : [];
  const spreadDef = reading.spreadKey ? SPREADS[reading.spreadKey] : null;
  const roleKeys = Array.isArray(spreadDef?.roleKeys) ? spreadDef.roleKeys : [];

  const enrichedCards = cards
    .map((card, index) => {
      const enriched = enrichCard(card, deckStyle);
      if (!enriched) return null;
      const slotIndex = index;
      const slot = index + 1;
      const positionRole = roleKeys[index] || null;
      return {
        ...enriched,
        slotIndex,
        slot,
        positionRole
      };
    })
    .filter(Boolean);

  const imagePaths = enrichedCards
    .map((card) => card.imagePath)
    .filter((p) => typeof p === 'string' && p.length > 0);

  const visionDeckMetrics = reading.deckVisionMetrics || pickDeckVisionMetrics(deckMetrics, deckStyle);

  let graphContext = null;
  try {
    graphContext = buildGraphContext(enrichedCards, { deckStyle });
  } catch (err) {
    if (options.verbose) {
      console.warn('[buildMultimodalDataset] Graph context detection failed:', err.message);
    }
    graphContext = null;
  }

  const knowledgeGraph = graphContext
    ? {
        patterns: graphContext.patterns || null,
        narrativeHighlights: graphContext.narrativeHighlights || [],
        graphKeys: graphContext.graphKeys || null
      }
    : {
        patterns: null,
        narrativeHighlights: [],
        graphKeys: null
      };

  const spreadSchema = spreadDef
    ? {
        key: reading.spreadKey || null,
        name: spreadDef.name || reading.spreadName || null,
        count: spreadDef.count || (Array.isArray(cards) ? cards.length : null),
        positions: Array.isArray(spreadDef.positions) ? spreadDef.positions : null,
        roleKeys: Array.isArray(spreadDef.roleKeys) ? spreadDef.roleKeys : null
      }
    : null;

  return {
    id: reading.requestId || reading.journalId || null,
    requestId: reading.requestId || null,
    journalId: reading.journalId || null,
    timestamp: reading.timestamp || null,
    deckStyle,
    deckLineage,
    spreadKey: reading.spreadKey || null,
    spreadName: reading.spreadName || spreadDef?.name || null,
    spreadSchema,
    question: reading.question || '',
    context: reading.context || null,
    provider: reading.provider || null,
    cards: enrichedCards,
    imagePaths,
    readingText: reading.readingText || '',
    spreadAnalysis: reading.spreadAnalysis || null,
    themes: reading.themes || null,
    reflections: reading.reflections || {},
    feedback: reading.feedback || null,
    metrics: reading.metrics || null,
    visionSummary: reading.visionSummary || reading.feedback?.visionSummary || null,
    feedbackLabel: reading.feedbackLabel || reading.feedback?.label || null,
    feedbackAverage: reading.feedbackAverage ?? reading.feedback?.averageScore ?? null,
    deckVisionMetrics: visionDeckMetrics || null,
    knowledgeGraph
  };
}

async function writeJsonl(records, outputPath) {
  const absPath = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record));
  await fs.writeFile(absPath, `${lines.join('\n')}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  try {
    const readings = await loadJsonl(options.input);
    if (!readings.length) {
      console.error('[buildMultimodalDataset] No readings found in input file.');
      process.exit(1);
    }

    const deckMetrics = await loadVisionMetrics(options.visionMetricsFile, options);

    const dataset = readings.map((reading) => toMultimodalExample(reading, deckMetrics, options));
    await writeJsonl(dataset, options.output);

    console.log(`[buildMultimodalDataset] Wrote ${dataset.length} example(s) to ${options.output}`);
  } catch (err) {
    console.error('[buildMultimodalDataset] Failed to build multimodal dataset:', err.message);
    process.exit(1);
  }
}

main();
