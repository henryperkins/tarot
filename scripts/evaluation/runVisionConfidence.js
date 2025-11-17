#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { TarotVisionPipeline } from '../../shared/vision/tarotVisionPipeline.js';
import { getDeckProfile } from '../../shared/vision/deckProfiles.js';

function parseArgs(rawArgs) {
  const options = {
    scope: 'all',
    deckStyle: 'rws-1909',
    out: 'data/evaluations/vision-confidence.json',
    limit: null,
    outProvided: false
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--scope') {
      options.scope = rawArgs[i + 1] || options.scope;
      i += 1;
    } else if (arg === '--deck-style') {
      options.deckStyle = rawArgs[i + 1] || options.deckStyle;
      i += 1;
    } else if (arg === '--out') {
      options.out = rawArgs[i + 1] || options.out;
      options.outProvided = true;
      i += 1;
    } else if (arg === '--limit') {
      const value = Number(rawArgs[i + 1]);
      if (!Number.isNaN(value)) {
        options.limit = value;
      }
      i += 1;
    }
  }
  if (!options.outProvided && options.deckStyle && options.deckStyle !== 'rws-1909') {
    options.out = `data/evaluations/vision-confidence.${options.deckStyle}.json`;
  }
  delete options.outProvided;

  return options;
}

async function collectImagePaths(deckProfile, limit) {
  const cardsDir = path.resolve(process.cwd(), 'public/images/cards');
  const deckDir =
    deckProfile?.assetScanDir && deckProfile.assetScanDir !== '.'
      ? path.join(cardsDir, deckProfile.assetScanDir)
      : cardsDir;

  let searchDir = deckDir;
  try {
    await fs.access(deckDir);
  } catch {
    searchDir = cardsDir;
  }

  const entries = await fs.readdir(searchDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name))
    .map((entry) => ({
      source: path.join(searchDir, entry.name).replace(/\\/g, '/'),
      label: entry.name
    }));

  const targets = typeof limit === 'number' ? files.slice(0, limit) : files;
  return targets;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const deckProfile = getDeckProfile(options.deckStyle);
  const imageInputs = await collectImagePaths(deckProfile, options.limit);
  if (imageInputs.length === 0) {
    console.error('No card images found in public/images/cards');
    process.exitCode = 1;
    return;
  }

  const pipeline = new TarotVisionPipeline({
    cardScope: options.scope,
    deckStyle: options.deckStyle,
    maxResults: 5
  });

  console.log(`Evaluating ${imageInputs.length} images with deck style ${options.deckStyle}...`);
  const analyses = await pipeline.analyzeImages(imageInputs, {
    includeAttention: true,
    includeSymbols: true
  });

  const report = {
    generatedAt: new Date().toISOString(),
    deckStyle: options.deckStyle,
    scope: options.scope,
    sampleSize: analyses.length,
    results: analyses.map((entry) => ({
      image: entry.label || entry.imagePath,
      topMatch: entry.topMatch,
      confidence: entry.confidence,
      matches: entry.matches,
      attention: entry.attention || null,
      symbolVerification: entry.symbolVerification || null
    }))
  };

  const outputPath = path.resolve(process.cwd(), options.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(`Vision confidence report written to ${outputPath}`);
}

main().catch((err) => {
  console.error('Vision confidence evaluation failed:', err);
  process.exitCode = 1;
});
