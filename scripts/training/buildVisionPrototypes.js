#!/usr/bin/env node
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from '@xenova/transformers';

const DEFAULT_DATASET = 'training/multimodal-dataset.jsonl';
const DEFAULT_OUTPUT = 'data/vision/fine-tuned/prototypes.json';
const DEFAULT_MODEL = 'Xenova/clip-vit-base-patch32';

function parseArgs(argv = []) {
  const options = {
    dataset: DEFAULT_DATASET,
    output: DEFAULT_OUTPUT,
    model: DEFAULT_MODEL,
    deckStyle: null,
    limit: null,
    perCardLimit: 50,
    quantized: false,
    verbose: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--dataset':
        options.dataset = argv[i + 1] || options.dataset;
        i += 1;
        break;
      case '--output':
        options.output = argv[i + 1] || options.output;
        i += 1;
        break;
      case '--model':
        options.model = argv[i + 1] || options.model;
        i += 1;
        break;
      case '--deck-style':
        options.deckStyle = argv[i + 1] || null;
        i += 1;
        break;
      case '--limit':
        options.limit = Number.parseInt(argv[i + 1] || '0', 10) || null;
        i += 1;
        break;
      case '--per-card-limit':
        options.perCardLimit = Number.parseInt(argv[i + 1] || '0', 10) || options.perCardLimit;
        i += 1;
        break;
      case '--quantized':
        options.quantized = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function normalizeVector(values = []) {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!norm || Number.isNaN(norm)) {
    return values.slice();
  }
  return values.map((value) => value / norm);
}

async function embedImage(imagePath, processor, model) {
  const rawImage = await RawImage.read(imagePath);
  const processed = await processor(rawImage);
  const { image_embeds } = await model(processed);
  return normalizeVector(Array.from(image_embeds.data));
}

function resolveImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }
  if (/^https?:/i.test(imagePath) || imagePath.startsWith('data:')) {
    return imagePath;
  }
  const trimmed = imagePath.replace(/^\/+/, '');
  if (trimmed.startsWith('public/')) {
    return path.resolve(process.cwd(), trimmed);
  }
  return path.resolve(process.cwd(), 'public', trimmed);
}

function accumulate(stats, deckStyle, cardName, vector, perCardLimit = null) {
  if (!deckStyle || !cardName || !Array.isArray(vector)) {
    return false;
  }
  if (!stats.has(deckStyle)) {
    stats.set(deckStyle, new Map());
  }
  const deckMap = stats.get(deckStyle);
  if (!deckMap.has(cardName)) {
    deckMap.set(cardName, {
      count: 0,
      sum: new Array(vector.length).fill(0)
    });
  }
  const entry = deckMap.get(cardName);
  if (perCardLimit && entry.count >= perCardLimit) {
    return false;
  }
  entry.count += 1;
  for (let i = 0; i < vector.length; i += 1) {
    entry.sum[i] += vector[i];
  }
  return true;
}

async function ingestRecord(record, context) {
  const deckStyle = record.deckStyle || context.defaultDeck || 'rws-1909';
  const cards = Array.isArray(record.cards) ? record.cards : [];
  for (const card of cards) {
    const cardName = card.card || card.name || card.position || 'Unknown';
    const resolved = resolveImagePath(card.imagePath);
    if (!resolved) {
      continue;
    }
    try {
      const vector = await embedImage(resolved, context.processor, context.model);
      accumulate(context.stats, deckStyle, cardName, vector, context.perCardLimit);
    } catch (err) {
      if (context.verbose) {
        console.warn(`[fineTuneVision] Skipping ${cardName}:`, err.message || err);
      }
    }
  }
}

async function writeOutput(stats, outputPath, modelName) {
  const payload = {
    model: modelName,
    generatedAt: new Date().toISOString(),
    deckStyles: {}
  };

  stats.forEach((cardMap, deckStyle) => {
    const cards = {};
    cardMap.forEach((entry, cardName) => {
      if (!entry.count || !entry.sum) {
        return;
      }
      const averaged = entry.sum.map((value) => value / entry.count);
      cards[cardName] = {
        count: entry.count,
        embedding: normalizeVector(averaged)
      };
    });
    payload.deckStyles[deckStyle] = {
      cardCount: Object.keys(cards).length,
      cards
    };
  });

  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });
  await fsPromises.writeFile(outputPath, JSON.stringify(payload, null, 2));
  console.log('[fineTuneVision] Saved fine-tuned embeddings to', outputPath);
}

async function loadVisionModel(modelName, quantized) {
  const processor = await AutoProcessor.from_pretrained(modelName);
  const model = await CLIPVisionModelWithProjection.from_pretrained(modelName, {
    quantized: Boolean(quantized),
    progress_callback: null
  });
  return { processor, model };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const datasetPath = path.resolve(process.cwd(), options.dataset);
  if (!fs.existsSync(datasetPath)) {
    console.error('[fineTuneVision] Dataset not found at', datasetPath);
    process.exit(1);
  }

  const stats = new Map();
  const { processor, model } = await loadVisionModel(options.model, options.quantized);
  const input = fs.createReadStream(datasetPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let processed = 0;
  for await (const line of rl) {
    if (!line || !line.trim()) {
      continue;
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch (err) {
      console.warn('[fineTuneVision] Skipping malformed line:', err.message);
      continue;
    }
    if (options.deckStyle && record.deckStyle !== options.deckStyle) {
      continue;
    }
    await ingestRecord(record, {
      stats,
      processor,
      model,
      perCardLimit: options.perCardLimit,
      defaultDeck: options.deckStyle,
      verbose: options.verbose
    });
    processed += 1;
    if (options.limit && processed >= options.limit) {
      break;
    }
    if (processed % 25 === 0) {
      console.log(`[fineTuneVision] Processed ${processed} examples...`);
    }
  }

  if (!processed) {
    console.warn('[fineTuneVision] No records were processed. Output will be empty.');
  }

  const outputPath = path.resolve(process.cwd(), options.output);
  await writeOutput(stats, outputPath, options.model);
}

main().catch((err) => {
  console.error('[fineTuneVision] Training failed:', err);
  process.exit(1);
});
