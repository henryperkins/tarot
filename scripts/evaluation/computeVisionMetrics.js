#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { getDeckImagePath } from '../../shared/vision/deckAssets.js';
import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
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
  const register = (card) => {
    const potential = [];
    if (card?.image) potential.push(card.image);
    const deckSpecific = getDeckImagePath(card, deckStyle);
    if (deckSpecific && deckSpecific !== card?.image) {
      potential.push(deckSpecific);
    }
    const canonical = card?.name || 'Unknown card';

    potential.forEach((location) => {
      const basename = path.basename(location);
      if (basename && !imageMap.has(basename)) {
        imageMap.set(basename, canonical);
      }
    });
  };
  MAJOR_ARCANA.forEach(register);
  MINOR_ARCANA.forEach(register);
  return { imageMap };
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

function buildReviewKey(row) {
  return `${row.image}||${row.expected}||${row.predicted}`;
}

function resolveExpected(entry, imageNameMap) {
  if (entry?.expected) return entry.expected;
  const image = entry?.image || entry?.label || entry?.imagePath;
  const basename = path.basename(image || '');
  return imageNameMap?.get?.(basename) || null;
}

function confidenceFor(entry) {
  const value = entry?.calibratedConfidence ?? entry?.topMatch?.calibratedConfidence ?? entry?.topMatch?.score ?? entry?.confidence;
  return Number.isFinite(value) ? value : 0;
}

function computeExpectedCalibrationError(rows, binCount = 10) {
  if (!rows.length) return 0;
  let ece = 0;
  for (let bin = 0; bin < binCount; bin += 1) {
    const lower = bin / binCount;
    const upper = (bin + 1) / binCount;
    const bucket = rows.filter((row) => (
      bin === binCount - 1
        ? row.confidence >= lower && row.confidence <= upper
        : row.confidence >= lower && row.confidence < upper
    ));
    if (!bucket.length) continue;
    const avgConfidence = bucket.reduce((sum, row) => sum + row.confidence, 0) / bucket.length;
    const accuracy = bucket.filter((row) => row.correct).length / bucket.length;
    ece += (bucket.length / rows.length) * Math.abs(avgConfidence - accuracy);
  }
  return Number(ece.toFixed(4));
}

export function computeVisionMetricEntry(samples = [], options = {}) {
  const deckStyle = options.deckStyle || 'rws-1909';
  const rows = [];
  const mismatches = [];
  const reviewQueue = [];
  const perLabelCounts = new Map();
  const symbolMatchRates = [];
  const weightedSymbolRates = [];
  let symbolExpectedTotal = 0;
  let symbolDetectedTotal = 0;
  let highConfidenceCorrect = 0;
  let highConfidenceTotal = 0;
  let absentSymbolFalsePositiveCount = 0;
  let symbolVerifiedSampleCount = 0;
  let absenceAnnotatedSampleCount = 0;
  let highSalienceExpectedCount = 0;
  let highSalienceDetectedCount = 0;
  let highSalienceAnnotatedSampleCount = 0;
  let symbolScoredSampleCount = 0;
  let unmappedSampleCount = 0;
  const missingSymbolTally = new Map();

  for (const entry of samples) {
    const expected = resolveExpected(entry, options.imageNameMap);
    if (!expected) {
      unmappedSampleCount += 1;
      reviewQueue.push({ image: entry.image || entry.label || entry.imagePath || '', expected: '', predicted: entry.topMatch?.cardName || '', action: 'review_missing_label' });
      continue;
    }
    const predicted = entry.topMatch?.cardName || entry.predictedCard || entry.card;
    const confidence = confidenceFor(entry);
    const normalizedExpected = normalizeName(expected);
    const normalizedPredicted = normalizeName(canonicalizeCardName(predicted, deckStyle) || predicted);
    const correct = normalizedPredicted === normalizedExpected;
    rows.push({ expected, predicted, confidence, correct });

    if (correct) {
      if (confidence >= 0.9) highConfidenceCorrect += 1;
    } else {
      mismatches.push({
        image: path.basename(entry.image || entry.label || entry.imagePath || ''),
        expected,
        predicted: predicted || 'n/a',
        confidence,
        basis: entry.topMatch?.basis
      });
    }
    if (confidence >= 0.9) highConfidenceTotal += 1;

    const labelStats = perLabelCounts.get(expected) || { total: 0, correct: 0 };
    labelStats.total += 1;
    if (correct) labelStats.correct += 1;
    perLabelCounts.set(expected, labelStats);

    const symbolVerification = entry.symbolVerification;
    if (symbolVerification && typeof symbolVerification === 'object') {
      if (symbolVerification.annotationStatus === 'verified') symbolVerifiedSampleCount += 1;
      if (Number.isFinite(symbolVerification.matchRate)) {
        symbolMatchRates.push(symbolVerification.matchRate);
      }
      if (Number.isFinite(symbolVerification.weightedMatchRate)) {
        weightedSymbolRates.push(symbolVerification.weightedMatchRate);
      }
      if ([symbolVerification.matchRate, symbolVerification.weightedMatchRate].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
        symbolScoredSampleCount += 1;
      }
      if (typeof symbolVerification.expectedCount === 'number') {
        symbolExpectedTotal += symbolVerification.expectedCount;
      }
      if (typeof symbolVerification.detectedCount === 'number') {
        symbolDetectedTotal += symbolVerification.detectedCount;
      }
      if (Array.isArray(symbolVerification.missingSymbols)) {
        symbolVerification.missingSymbols.forEach((symbol) => {
          if (!symbol) return;
          missingSymbolTally.set(symbol, (missingSymbolTally.get(symbol) || 0) + 1);
        });
      }
      const highExpected = symbolVerification.highSalienceExpectedCount;
      const highDetected = symbolVerification.highSalienceDetectedCount;
      if (symbolVerification.annotationStatus !== 'unsupported' && Number.isInteger(highExpected) && highExpected >= 0 && Number.isInteger(highDetected) && highDetected >= 0 && highDetected <= highExpected) {
        highSalienceAnnotatedSampleCount += 1;
        highSalienceExpectedCount += highExpected;
        highSalienceDetectedCount += highDetected;
      }
      if (Number.isInteger(symbolVerification.absenceExpectedCount) && symbolVerification.absenceExpectedCount > 0
        && typeof symbolVerification.absentSymbolFalsePositive === 'boolean') {
        absenceAnnotatedSampleCount += 1;
        if (symbolVerification.absentSymbolFalsePositive) absentSymbolFalsePositiveCount += 1;
      }
    }
    const reasons = [];
    if (!correct) reasons.push('review_prediction');
    if (symbolVerification?.annotationStatus !== 'verified') reasons.push('review_annotations');
    if (!Number.isFinite(symbolVerification?.weightedMatchRate) || symbolVerification.weightedMatchRate < 0.65) reasons.push('review_weak_symbols');
    if (symbolVerification?.absentSymbolFalsePositive) reasons.push('review_absence_false_positive');
    if (symbolVerification?.highSalienceExpectedCount > symbolVerification?.highSalienceDetectedCount) reasons.push('review_high_salience_missing');
    if (reasons.length) reviewQueue.push({
      image: entry.image || entry.label || entry.imagePath || '', expected, predicted: predicted || 'n/a', confidence,
      basis: entry.topMatch?.basis,
      weightedScore: symbolVerification?.weightedMatchRate,
      hallucinatedSymbols: (symbolVerification?.absenceDetections || []).map((det) => det.label).filter(Boolean),
      visibleSymbols: (symbolVerification?.matches || []).filter((match) => match.found).map((match) => match.object).filter(Boolean),
      action: reasons.join('; ')
    });
  }

  const total = rows.length;
  const correct = rows.filter((row) => row.correct).length;
  const accuracy = total ? correct / total : 0;
  const highConfidenceAccuracy = highConfidenceTotal ? highConfidenceCorrect / highConfidenceTotal : 0;
  const highConfidenceErrorRate = highConfidenceTotal
    ? (highConfidenceTotal - highConfidenceCorrect) / highConfidenceTotal
    : 0;
  const brierScore = total
    ? rows.reduce((sum, row) => sum + ((row.confidence - (row.correct ? 1 : 0)) ** 2), 0) / total
    : 0;

  return {
    schemaVersion: 2,
    deckStyle,
    sourceGeneratedAt: options.sourceGeneratedAt || null,
    provenance: options.provenance || null,
    inputSampleSize: samples.length,
    sourceSampleSize: options.sourceSampleSize ?? samples.length,
    unmappedSampleCount,
    uniqueCardCount: perLabelCounts.size,
    symbolScoredSampleCount,
    symbolVerifiedSampleCount,
    symbolAnnotationCoverage: samples.length ? symbolVerifiedSampleCount / samples.length : 0,
    absenceAnnotatedSampleCount,
    absenceAnnotationCoverage: samples.length ? absenceAnnotatedSampleCount / samples.length : 0,
    highSalienceExpectedCount,
    highSalienceDetectedCount,
    highSalienceAnnotatedSampleCount,
    highSalienceAnnotationCoverage: samples.length ? highSalienceAnnotatedSampleCount / samples.length : 0,
    generatedAt: new Date().toISOString(),
    sourceFile: options.sourceFile || null,
    sampleSize: total,
    accuracy,
    microPrecision: accuracy,
    microRecall: accuracy,
    microF1: accuracy,
    highConfidenceCoverage: highConfidenceTotal / (total || 1),
    highConfidenceAccuracy,
    highConfidenceErrorRate,
    symbolCoverageRate: symbolMatchRates.length
      ? symbolMatchRates.reduce((sum, value) => sum + value, 0) / symbolMatchRates.length
      : null,
    symbolDetectionRate: symbolExpectedTotal ? symbolDetectedTotal / symbolExpectedTotal : null,
    weightedSymbolCoverageRate: weightedSymbolRates.length
      ? Number((weightedSymbolRates.reduce((sum, value) => sum + value, 0) / weightedSymbolRates.length).toFixed(4))
      : null,
    highSalienceSymbolRecall: highSalienceExpectedCount
      ? Number((highSalienceDetectedCount / highSalienceExpectedCount).toFixed(4))
      : null,
    absentSymbolFalsePositiveRate: absenceAnnotatedSampleCount
      ? Number((absentSymbolFalsePositiveCount / absenceAnnotatedSampleCount).toFixed(4))
      : null,
    symbolHallucinationRate: absenceAnnotatedSampleCount
      ? Number((absentSymbolFalsePositiveCount / absenceAnnotatedSampleCount).toFixed(4))
      : null,
    brierScore: Number(brierScore.toFixed(4)),
    expectedCalibrationError: computeExpectedCalibrationError(rows),
    symbolMissingLeaders: Array.from(missingSymbolTally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symbol, count]) => ({ symbol, count })),
    perLabelAccuracy: Array.from(perLabelCounts.entries()).map(([label, stats]) => ({
      label,
      accuracy: stats.total ? stats.correct / stats.total : 0,
      total: stats.total
    })).sort((a, b) => a.label.localeCompare(b.label)),
    mismatches,
    reviewQueue
  };
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
    const failureLabelIdx = header.indexOf('failure_label');
    if (imageIdx === -1 || expectedIdx === -1 || predictedIdx === -1 || verdictIdx === -1) {
      return new Map();
    }

    const map = new Map();
    rows.forEach((cols) => {
      const key = `${cols[imageIdx]}||${cols[expectedIdx]}||${cols[predictedIdx]}`;
      map.set(key, {
        human_verdict: verdictIdx >= 0 ? cols[verdictIdx] : '',
        human_notes: notesIdx >= 0 ? cols[notesIdx] : '',
        failure_label: failureLabelIdx >= 0 ? cols[failureLabelIdx] : ''
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
  const header = [
    'image',
    'expected',
    'predicted',
    'confidence',
    'basis',
    'weighted_score',
    'hallucinated_symbols',
    'visible_symbols',
    'action',
    'failure_label',
    'human_verdict',
    'human_notes'
  ];
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
        typeof row.weightedScore === 'number' ? row.weightedScore.toFixed(4) : '',
        Array.isArray(row.hallucinatedSymbols) ? row.hallucinatedSymbols.join('; ') : '',
        Array.isArray(row.visibleSymbols) ? row.visibleSymbols.join('; ') : '',
        row.action || '',
        annotation.failure_label || '',
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
  if (!Number.isInteger(payload.sampleSize) || payload.sampleSize !== samples.length) {
    throw new Error('Inference sample count does not match the declared report sampleSize');
  }

  const deckStyle = options.deckStyle || payload?.deckStyle || 'rws-1909';
  const { imageMap: imageNameMap } = buildDeckLookups(deckStyle);
  if (options.deckStyle && payload.deckStyle && options.deckStyle !== payload.deckStyle) {
    throw new Error('Requested deck does not match the inference report');
  }
  const metricsEntry = computeVisionMetricEntry(samples, {
    deckStyle,
    sourceFile: path.relative(process.cwd(), inputPath),
    sourceGeneratedAt: payload.generatedAt,
    sourceSampleSize: payload.sampleSize,
    provenance: payload.provenance,
    imageNameMap
  });
  const reviewQueue = metricsEntry.reviewQueue;
  delete metricsEntry.reviewQueue;

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
  await fs.mkdir(path.dirname(reviewPath), { recursive: true });
  await writeReviewCsv(reviewQueue, reviewPath, existingAnnotations);

  console.log('Vision metrics written to', metricsPath);
  console.log('Review queue written to', reviewPath);
  console.log(`Overall accuracy: ${(metricsEntry.accuracy * 100).toFixed(2)}% (${metricsEntry.sampleSize} labeled inputs; ${metricsEntry.unmappedSampleCount} unlabeled)`);
  console.log(`Symbol annotation coverage: ${(metricsEntry.symbolAnnotationCoverage * 100).toFixed(2)}%; ${reviewQueue.length} samples queued for review`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error('Vision metrics computation failed:', err);
    process.exit(1);
  });
}
