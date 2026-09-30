#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { createVisionBackend } from '../../shared/vision/visionBackends.js';
import { loadVisionDataset, visionSourceState } from './lib/visionEvaluationDataset.js';

function parseArgs(rawArgs) {
  const options = {
    scope: 'all',
    manifestPath: null,
    deckStyle: 'rws-1909',
    backendId: 'clip-default',
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
    } else if (arg === '--manifest') {
      options.manifestPath = rawArgs[++i];
      if (!options.manifestPath) throw new Error('--manifest requires a local path');
    } else if (arg === '--backend-id') {
      options.backendId = rawArgs[i + 1] || options.backendId;
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
  if (!options.manifestPath && process.env.VISION_EVAL_MANIFEST_DIR) {
    options.manifestPath = path.resolve(process.env.VISION_EVAL_MANIFEST_DIR, `${options.deckStyle}.json`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { inputs: imageInputs, provenance: datasetProvenance } = await loadVisionDataset(options);
  const sourceState = visionSourceState();
  if (imageInputs.length === 0) {
    console.error('No card images found in public/images/cards');
    process.exitCode = 1;
    return;
  }

  const backend = await createVisionBackend({
    backendId: options.backendId,
    cardScope: options.scope,
    deckStyle: options.deckStyle,
    maxResults: 5
  });

  console.log(`Dataset kind: ${datasetProvenance.datasetKind}. Reference art and synthetic inputs are diagnostic only.`);
  console.log(`Evaluating ${imageInputs.length} images with deck style ${options.deckStyle} using ${options.backendId}...`);
  await backend.warmup();
  const analyses = await backend.analyzeImages(imageInputs, {
    includeAttention: true,
    includeSymbols: true
  });

  if (analyses.length !== imageInputs.length) throw new Error('Inference did not return every dataset sample');
  const report = {
    schemaVersion: 2,
    provenance: {
      ...datasetProvenance, ...sourceState, backendId: backend.id,
      recognitionModel: backend.instance.model || backend.instance.clipPipeline?.model || null,
      symbolModel: analyses.find(entry => entry.symbolVerification?.model)?.symbolVerification.model || null,
      symbolThreshold: analyses.find(entry => Number.isFinite(entry.symbolVerification?.threshold))?.symbolVerification.threshold ?? null
    },
    generatedAt: new Date().toISOString(),
    deckStyle: options.deckStyle,
    scope: options.scope,
    sampleSize: analyses.length,
    results: analyses.map((entry, index) => ({
      expected: imageInputs[index].expected,
      imageSha256: imageInputs[index].sha256,
      image: entry.label || entry.imagePath,
      topMatch: entry.topMatch,
      confidence: entry.confidence,
      matches: entry.matches,
      attention: entry.attention || null,
      symbolVerification: entry.symbolVerification || null,
      routerFeatures: entry.routerFeatures || null,
      calibratedConfidence: entry.calibratedConfidence ?? null,
      decisionReason: entry.decisionReason || null,
      abstain: Boolean(entry.abstain),
      imageQuality: entry.imageQuality || null
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
