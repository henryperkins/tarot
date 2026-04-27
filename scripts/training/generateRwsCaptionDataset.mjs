#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { getRwsCardEvidence } from '../../shared/vision/rwsEvidenceOntology.js';

const DEFAULT_OUT = 'data/training/rws_multimodal_captions.jsonl';
const DEFAULT_IMAGE_ROOT = 'data/raw_images/rws';
const ALL_CARDS = Object.freeze([...MAJOR_ARCANA, ...MINOR_ARCANA]);

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    out: DEFAULT_OUT,
    imageRoot: DEFAULT_IMAGE_ROOT,
    orientation: 'upright',
    limit: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        args.out = argv[++i] || args.out;
        break;
      case '--image-root':
        args.imageRoot = argv[++i] || args.imageRoot;
        break;
      case '--orientation':
        args.orientation = argv[++i] || args.orientation;
        break;
      case '--limit':
        args.limit = Number.parseInt(argv[++i] || '', 10);
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['upright', 'reversed', 'both'].includes(args.orientation)) {
    throw new Error('--orientation must be upright, reversed, or both');
  }
  if (args.limit != null && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }

  return args;
}

function formatSymbolLabel(symbol) {
  return String(symbol?.label || symbol?.symbol || '').trim();
}

function topSymbols(card) {
  return [...(card.visualSymbols || [])]
    .sort((a, b) => (b.salience ?? 0.6) - (a.salience ?? 0.6))
    .slice(0, 6);
}

function captionSymbolList(symbols) {
  return symbols.map(formatSymbolLabel).filter(Boolean).join(', ');
}

function captionThemeList(card) {
  return (card.coreThemes || []).slice(0, 4).join(', ');
}

function buildHardNegativeCaptions(card) {
  return (card.hardNegatives || []).map((entry) => ({
    card: entry.card,
    caption: `${card.card} can be confused with ${entry.card}; distinguish it by ${entry.distinguishingFeatures.join(', ')}.`
  }));
}

export function buildRwsCaptionRecord(cardInput, options = {}) {
  const cardName = typeof cardInput === 'string' ? cardInput : cardInput?.name;
  const orientation = options.orientation || 'upright';
  const imageRoot = options.imageRoot || DEFAULT_IMAGE_ROOT;
  const card = getRwsCardEvidence(cardName);
  if (!card) {
    throw new Error(`Unknown RWS card: ${cardName}`);
  }

  const symbols = topSymbols(card);
  const symbolList = captionSymbolList(symbols);
  const themeList = captionThemeList(card);
  const topSymbolList = captionSymbolList(symbols.slice(0, 4));

  return {
    image_id: `${card.stableId}_${orientation}`,
    image: `${imageRoot.replace(/\/+$/g, '')}/${card.stableId}.jpg`,
    deck: 'rider_waite_smith',
    card: card.card,
    stable_id: card.stableId,
    orientation,
    positive_captions: [
      `Rider-Waite-Smith ${card.card}, ${orientation}: ${symbolList}.`,
      `${card.card} shows ${themeList} through ${topSymbolList}.`,
      `A RWS tarot card grounded visually by ${topSymbolList}.`
    ],
    hard_negative_captions: buildHardNegativeCaptions(card),
    symbols: symbols.map((symbol) => ({
      symbol: symbol.symbol,
      symbolId: symbol.symbolId,
      label: symbol.label,
      salience: symbol.salience,
      expectedRegion: symbol.expectedRegion,
      aliases: symbol.aliases || [],
      literalObservation: symbol.literalObservation,
      symbolicMeaning: symbol.symbolicMeaning || []
    }))
  };
}

export function buildRwsCaptionDataset(options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : ALL_CARDS.length;
  const cards = ALL_CARDS.slice(0, limit);
  const orientations = options.orientation === 'both'
    ? ['upright', 'reversed']
    : [options.orientation || 'upright'];

  return cards.flatMap((card) => orientations.map((orientation) => buildRwsCaptionRecord(card, {
    ...options,
    orientation
  })));
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log('Usage: node scripts/training/generateRwsCaptionDataset.mjs [--out path] [--image-root path] [--orientation upright|reversed|both] [--limit n]');
    return;
  }

  const out = path.resolve(process.cwd(), args.out);
  const records = buildRwsCaptionDataset(args);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
  console.log(`Wrote ${records.length} RWS caption records to ${out}`);
}

const entry = process.argv[1] ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) : false;
if (entry) {
  main().catch((error) => {
    console.error('RWS caption dataset generation failed:', error.message);
    process.exit(1);
  });
}
