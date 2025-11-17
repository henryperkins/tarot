#!/usr/bin/env node
/**
 * Quick CLI to exercise the TarotVisionPipeline against one or more images.
 * Usage:
 *   node scripts/vision/runVisionPrototype.js <image paths...>
 */
import path from 'node:path';

import { createVisionBackend } from '../../shared/vision/visionBackends.js';

function parseArgs(rawArgs) {
  const args = [];
  const options = {
    scope: 'major',
    maxResults: 5,
    deckStyle: 'rws-1909'
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--all-cards') {
      options.scope = 'all';
    } else if (arg === '--max-results') {
      const value = Number(rawArgs[i + 1]);
      if (!Number.isNaN(value)) {
        options.maxResults = value;
        i += 1;
      }
    } else if (arg === '--deck-style') {
      const value = rawArgs[i + 1];
      if (value) {
        options.deckStyle = value;
        i += 1;
      }
    } else {
      args.push(arg);
    }
  }

  return { imageArgs: args, options };
}

async function main() {
  const { imageArgs, options } = parseArgs(process.argv.slice(2));
  if (imageArgs.length === 0) {
    console.error('Usage: node scripts/vision/runVisionPrototype.js [--all-cards] [--max-results N] [--deck-style id] <image paths...>');
    process.exitCode = 1;
    return;
  }

  const imageInputs = imageArgs.map((relativePath) => {
    const resolved = path.resolve(process.cwd(), relativePath).replace(/\\/g, '/');
    return { source: resolved, label: relativePath };
  });

  const backend = createVisionBackend({
    backendId: 'clip-default',
    cardScope: options.scope,
    maxResults: options.maxResults,
    deckStyle: options.deckStyle
  });

  console.log('Downloading CLIP model (if not cached) and building card embeddings...');
  await backend.warmup();
  const analyses = await backend.analyzeImages(imageInputs);

  analyses.forEach((result) => {
    console.log('\nImage:', result.label || result.imagePath);
    console.log('Top match:', result.topMatch?.cardName ?? 'n/a', 'confidence:', result.confidence?.toFixed(3));
    console.table(result.matches.map((match) => ({
      card: match.cardName,
      score: Number(match.score.toFixed(4))
    })));
  });
}

main().catch((err) => {
  console.error('Vision prototype failed:', err);
  process.exitCode = 1;
});
