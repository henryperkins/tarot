#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { getDeckImagePath, getDeckAlias } from '../../shared/vision/deckAssets.js';
import { parseCsv, stringifyRow } from './lib/csv.js';

function usage() {
  console.log('Usage: node scripts/evaluation/computeVisionMetrics.js [--in data/evaluations/vision-confidence.json]');
}

function parseArgs(rawArgs) {
const options = {
  input: 'data/evaluations/vision-confidence.json',
  reviewOut: 'data/evaluations/vision-review-queue.csv',
  metricsOut: 'data/evaluations/vision-metrics.json',
  deckStyle: null
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--in') {
      options.input = rawArgs[i + 1] || options.input;
      i += 1;
    } else if (arg === '--review-out') {
      options.reviewOut = rawArgs[i + 1] || options.reviewOut;
      i += 1;
    } else if (arg === '--metrics-out') {
      options.metricsOut = rawArgs[i + 1] || options.metricsOut;
      i += 1;
    } else if (arg === '--deck-style') {
      options.deckStyle = rawArgs[i + 1] || null;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
  }

  return options;
}

function buildDeckLookups(deckStyle) {
  const imageMap = new Map();
  const aliasMap = new Map();
  const register = (card) => {
    const potential = [];
    if (card?.image) potential.push(card.image);
    const deckSpecific = getDeckImagePath(card, deckStyle);
    if (deckSpecific && deckSpecific !== card?.image) {
      potential.push(deckSpecific);
    }
    const canonical = card?.name || 'Unknown card';
    const canonicalKey = normalizeName(canonical);
    if (canonicalKey) {
      aliasMap.set(canonicalKey, canonicalKey);
    }
    const alias = getDeckAlias(card, deckStyle);
    const aliasKey = normalizeName(alias);
    if (alias && aliasKey && !aliasMap.has(aliasKey)) {
      aliasMap.set(aliasKey, canonicalKey);
    }

    potential.forEach((location) => {
      const basename = path.basename(location);
      if (basename && !imageMap.has(basename)) {
        imageMap.set(basename, canonical);
      }
    });
  };
  MAJOR_ARCANA.forEach(register);
  MINOR_ARCANA.forEach(register);
  return { imageMap, aliasMap };
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function buildReviewKey(row) {
  return `${row.image}||${row.expected}||${row.predicted}`;
}

async function readExistingAnnotations(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { header, rows } = parseCsv(content);
    const imageIdx = header.indexOf('image');
    const expectedIdx = header.indexOf('expected');
    const predictedIdx = header.indexOf('predicted');
    const verdictIdx = header.indexOf('human_verdict');
    const notesIdx = header.indexOf('human_notes');
    if (imageIdx === -1 || expectedIdx === -1 || predictedIdx === -1 || verdictIdx === -1) {
      return new Map();
    }

    const map = new Map();
    rows.forEach((cols) => {
      const key = `${cols[imageIdx]}||${cols[expectedIdx]}||${cols[predictedIdx]}`;
      map.set(key, {
        human_verdict: verdictIdx >= 0 ? cols[verdictIdx] : '',
        human_notes: notesIdx >= 0 ? cols[notesIdx] : ''
      });
    });
    return map;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return new Map();
    }
    throw err;
  }
}

async function writeReviewCsv(rows, filePath, existingAnnotations) {
  const header = ['image', 'expected', 'predicted', 'confidence', 'basis', 'human_verdict', 'human_notes'];
  const lines = [stringifyRow(header)];

  rows.forEach((row) => {
    const key = buildReviewKey(row);
    const annotation = existingAnnotations.get(key) || {};
    lines.push(
      stringifyRow([
        row.image,
        row.expected,
        row.predicted,
        row.confidence?.toFixed(4) ?? '',
        row.basis || '',
        annotation.human_verdict || '',
        annotation.human_notes || ''
      ])
    );
  });

  await fs.writeFile(filePath, lines.join('\n'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.input);
  let payload;
  try {
    payload = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
  } catch (err) {
    console.error(`Unable to read ${inputPath}:`, err.message);
    process.exit(1);
  }

  const samples = Array.isArray(payload?.results) ? payload.results : [];
  if (samples.length === 0) {
    console.error('No results found in vision confidence file.');
    process.exit(1);
  }

  const deckStyle = options.deckStyle || payload?.deckStyle || 'rws-1909';
  const { imageMap: imageNameMap, aliasMap } = buildDeckLookups(deckStyle);
  let total = 0;
  let correct = 0;
  let highConfidenceCorrect = 0;
  let highConfidenceTotal = 0;
  const mismatches = [];
  const perLabelCounts = new Map();
  let symbolTotal = 0;
  let symbolFocused = 0;
  const symbolStats = new Map();
  const symbolMatchRates = [];
  let symbolExpectedTotal = 0;
  let symbolDetectedTotal = 0;
  const missingSymbolTally = new Map();

  for (const entry of samples) {
    const image = entry.image || entry.label || entry.imagePath;
    const basename = path.basename(image);
    const expected = imageNameMap.get(basename);
    if (!expected) {
      console.warn(`No expected mapping for ${basename}; skipping.`);
      continue;
    }
    total += 1;
    const predicted = entry.topMatch?.cardName;
    const confidence = entry.topMatch?.score ?? 0;
    const normalizedExpected = aliasMap.get(normalizeName(expected)) || normalizeName(expected);
    const normalizedPredicted = aliasMap.get(normalizeName(predicted)) || normalizeName(predicted);
    const isCorrect = normalizedPredicted === normalizedExpected;
    if (isCorrect) {
      correct += 1;
      if (confidence >= 0.9) highConfidenceCorrect += 1;
    } else {
      mismatches.push({ image: basename, expected, predicted: predicted || 'n/a', confidence, basis: entry.topMatch?.basis });
    }
    if (confidence >= 0.9) highConfidenceTotal += 1;

    const labelStats = perLabelCounts.get(expected) || { total: 0, correct: 0 };
    labelStats.total += 1;
    if (isCorrect) labelStats.correct += 1;
    perLabelCounts.set(expected, labelStats);

    const symbolVerification = entry.symbolVerification;
    if (symbolVerification && typeof symbolVerification.matchRate === 'number') {
      symbolMatchRates.push(symbolVerification.matchRate);
      if (typeof symbolVerification.expectedCount === 'number') {
        symbolExpectedTotal += symbolVerification.expectedCount;
      }
      if (typeof symbolVerification.detectedCount === 'number') {
        symbolDetectedTotal += symbolVerification.detectedCount;
      }
      if (Array.isArray(symbolVerification.missingSymbols)) {
        symbolVerification.missingSymbols.forEach((symbol) => {
          if (!symbol) return;
          const current = missingSymbolTally.get(symbol) || 0;
          missingSymbolTally.set(symbol, current + 1);
        });
      }
    }

    const symbolAlignment = entry.attention?.symbolAlignment;
    if (Array.isArray(symbolAlignment)) {
      symbolAlignment.forEach((symbol) => {
        if (typeof symbol.attentionScore !== 'number') {
          return;
        }
        symbolTotal += 1;
        const isFocused = symbol.isModelFocused || symbol.attentionScore >= 0.65;
        if (isFocused) {
          symbolFocused += 1;
        }
        const key = symbol.object || 'symbol';
        const stats = symbolStats.get(key) || { total: 0, focused: 0 };
        stats.total += 1;
        if (isFocused) {
          stats.focused += 1;
        }
        symbolStats.set(key, stats);
      });
    }
  }

  const accuracy = total ? correct / total : 0;
  const highConfidenceAccuracy = highConfidenceTotal ? highConfidenceCorrect / highConfidenceTotal : 0;
  let symbolCoverageRate = null;

  if (symbolMatchRates.length > 0) {
    symbolCoverageRate = symbolMatchRates.reduce((sum, value) => sum + value, 0) / symbolMatchRates.length;
  } else if (symbolTotal) {
    symbolCoverageRate = symbolFocused / symbolTotal;
  }

  const symbolDetectionRate = symbolExpectedTotal
    ? symbolDetectedTotal / symbolExpectedTotal
    : null;

  // Micro precision/recall/f1 collapses to accuracy for single-label classification.
  const precisionMicro = accuracy;
  const recallMicro = accuracy;
  const f1Micro = accuracy;

  const perLabelAccuracy = Array.from(perLabelCounts.entries()).map(([label, stats]) => ({
    label,
    accuracy: stats.total ? stats.correct / stats.total : 0,
    total: stats.total
  })).sort((a, b) => a.label.localeCompare(b.label));

  const metricsEntry = {
    deckStyle,
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(process.cwd(), inputPath),
    sampleSize: total,
    accuracy,
    microPrecision: precisionMicro,
    microRecall: recallMicro,
    microF1: f1Micro,
    highConfidenceCoverage: highConfidenceTotal / (total || 1),
    highConfidenceAccuracy,
    symbolCoverageRate,
    symbolDetectionRate,
    symbolMissingLeaders: Array.from(missingSymbolTally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symbol, count]) => ({ symbol, count })),
    symbolBreakdown: Array.from(symbolStats.entries()).map(([object, stats]) => ({
      object,
      coverage: stats.total ? stats.focused / stats.total : 0,
      total: stats.total
    })).sort((a, b) => b.coverage - a.coverage),
    perLabelAccuracy
  };

  const metricsPath = path.resolve(process.cwd(), options.metricsOut);
  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(metricsPath, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  const metricsByDeck = existing.metricsByDeck || {};
  metricsByDeck[deckStyle] = metricsEntry;
  const finalPayload = {
    updatedAt: new Date().toISOString(),
    metricsByDeck
  };
  await fs.writeFile(metricsPath, JSON.stringify(finalPayload, null, 2));

  const reviewPath = path.resolve(process.cwd(), options.reviewOut);
  const existingAnnotations = await readExistingAnnotations(reviewPath);
  await writeReviewCsv(mismatches, reviewPath, existingAnnotations);

  console.log('Vision metrics written to', metricsPath);
  console.log('Review queue written to', reviewPath);
  console.log(`Overall accuracy: ${(accuracy * 100).toFixed(2)}% (${correct}/${total})`);
  if (highConfidenceTotal) {
    console.log(`High-confidence accuracy (>=0.9): ${(highConfidenceAccuracy * 100).toFixed(2)}% (${highConfidenceCorrect}/${highConfidenceTotal})`);
  }
}

main().catch((err) => {
  console.error('Vision metrics computation failed:', err);
  process.exit(1);
});
