import { pipeline, RawImage } from '@xenova/transformers';
import { getRwsCardEvidence, normalizeRwsSymbolName } from './rwsEvidenceOntology.js';

function getEnvValue(key) {
  if (typeof process !== 'undefined' && process?.env?.[key]) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
    return import.meta.env[key];
  }
  return null;
}

const MODEL_OVERRIDE =
  getEnvValue('SYMBOL_DETECTOR_MODEL') ||
  getEnvValue('VITE_SYMBOL_DETECTOR_MODEL');
const MODEL_PRESET = (getEnvValue('SYMBOL_DETECTOR_PRESET') || '').toLowerCase();

const DEFAULT_MODEL = MODEL_OVERRIDE
  || (MODEL_PRESET === 'fast' ? 'Xenova/owlvit-base-patch32' : 'Xenova/owlvit-large-patch14');
const DEFAULT_THRESHOLD = Number.parseFloat(getEnvValue('SYMBOL_DETECTOR_THRESHOLD')) || 0.05;
const DEFAULT_HEATMAP_GRID = Number.parseInt(getEnvValue('SYMBOL_HEATMAP_GRID') || '7', 10);
const HEATMAP_FOCUS_THRESHOLD = 0.75;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function buildDetectionHeatmap(detections = [], gridSize = DEFAULT_HEATMAP_GRID || 7) {
  const effectiveGrid = Number.isFinite(gridSize) && gridSize > 1 ? gridSize : 7;
  if (!Array.isArray(detections) || detections.length === 0) {
    return null;
  }

  const grid = Array.from({ length: effectiveGrid }, () => Array(effectiveGrid).fill(0));

  detections.forEach((det) => {
    if (!det?.box || typeof det.score !== 'number') return;
    const startX = Math.max(0, Math.min(effectiveGrid - 1, Math.floor(det.box.xmin * effectiveGrid)));
    const endX = Math.max(0, Math.min(effectiveGrid - 1, Math.floor(det.box.xmax * effectiveGrid)));
    const startY = Math.max(0, Math.min(effectiveGrid - 1, Math.floor(det.box.ymin * effectiveGrid)));
    const endY = Math.max(0, Math.min(effectiveGrid - 1, Math.floor(det.box.ymax * effectiveGrid)));
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        grid[y][x] += det.score;
      }
    }
  });

  const flat = grid.flat();
  const max = Math.max(...flat, 0);
  const normalized = max
    ? grid.map((row) => row.map((value) => Number((value / max).toFixed(4))))
    : grid.map((row) => row.map(() => 0));

  const focusRegions = [];
  normalized.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value >= HEATMAP_FOCUS_THRESHOLD) {
        focusRegions.push({ x, y, intensity: value });
      }
    });
  });

  return {
    gridSize: effectiveGrid,
    heatmap: normalized,
    stats: {
      max: Number(max.toFixed(4)),
      min: 0
    },
    focusRegions
  };
}

function normalizeLabel(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function formatPrompt(term) {
  const trimmed = term.trim();
  if (!trimmed) return null;
  if (/^(a|an|the)\s/i.test(trimmed)) {
    return trimmed;
  }
  const article = /^[aeiou]/i.test(trimmed) ? 'an' : 'a';
  return `${article} ${trimmed}`;
}

function getExpectedSymbols(card, deckStyle) {
  if (deckStyle !== 'rws-1909') return null;
  const ontology = getRwsCardEvidence(card?.canonicalName || card?.name || card?.cardName || card?.card);
  // Minor Arcana templates describe interpretive suit/rank themes, not the
  // objects in a particular image. Keep them out of visual verification.
  if (ontology?.arcana !== 'Major' || !ontology.visualSymbols?.length) return null;
  return ontology.visualSymbols.map((symbol) => ({ ...symbol, object: symbol.label || symbol.symbol }));
}

function symbolLabel(symbol) {
  return symbol?.label || symbol?.object || symbol?.symbol || '';
}

function normalizeDetectionLabel(label = '') {
  return normalizeLabel(label).replace(/^(a|an|the)\s+/, '');
}

function normalizedTermSet(values = []) {
  const terms = new Set();
  values.forEach((value) => {
    const normalized = normalizeDetectionLabel(value);
    if (normalized) terms.add(normalized);
    const slug = normalizeRwsSymbolName(value);
    if (slug) terms.add(slug.replace(/_/g, ' '));
  });
  return terms;
}

function findMatchForSymbol(symbol, matches, index) {
  if (matches[index]) return matches[index];
  const expectedTerms = normalizedTermSet([
    symbolLabel(symbol),
    symbol?.object,
    symbol?.symbol,
    ...(symbol?.aliases || [])
  ]);
  return matches.find((match) => {
    const matchTerms = normalizedTermSet([match?.object, match?.label, match?.symbol, match?.detectionLabel]);
    return Array.from(matchTerms).some((term) => expectedTerms.has(term));
  }) || null;
}

export function computeSymbolVerificationScores(expectedSymbols = [], matches = [], detections = []) {
  const expected = Array.isArray(expectedSymbols) ? expectedSymbols.filter(Boolean) : [];
  const safeMatches = Array.isArray(matches) ? matches.filter(Boolean) : [];
  const safeDetections = Array.isArray(detections) ? detections.filter(Boolean) : [];

  const enrichedMatches = expected.map((symbol, index) => {
    const match = findMatchForSymbol(symbol, safeMatches, index);
    return {
      object: symbolLabel(symbol),
      symbolId: symbol.symbolId || null,
      salience: Number.isFinite(symbol.salience) ? symbol.salience : 0.6,
      expectedRegion: symbol.expectedRegion || null,
      aliases: symbol.aliases || [],
      absenceNegatives: symbol.absenceNegatives || [],
      expectedPosition: match?.expectedPosition || symbol.location || symbol.position || null,
      found: Boolean(match?.found),
      confidence: Number.isFinite(match?.confidence) ? match.confidence : 0,
      detectionLabel: match?.detectionLabel || null,
      box: match?.box || null
    };
  });

  const foundCount = enrichedMatches.filter((match) => match.found).length;
  const expectedCount = expected.length;
  const matchRate = expectedCount ? Number((foundCount / expectedCount).toFixed(4)) : 0;
  const salienceTotal = enrichedMatches.reduce((sum, match) => sum + match.salience, 0);
  const weightedTotal = enrichedMatches.reduce((sum, match) => (
    sum + (match.found ? match.confidence * match.salience : 0)
  ), 0);
  const weightedMatchRate = salienceTotal > 0 ? Number((weightedTotal / salienceTotal).toFixed(4)) : 0;
  const missing = enrichedMatches.filter((match) => !match.found);

  const absenceDetections = safeDetections
    .filter((det) => det?.absenceNegative === true || det?.kind === 'absence_negative')
    .map((det) => ({
      label: det.label,
      confidence: Number.isFinite(det.confidence) ? det.confidence : (Number.isFinite(det.score) ? det.score : null),
      box: det.box || null
    }))
    .slice(0, 5);

  const unexpectedDetections = safeDetections
    .filter((det) => !(det?.absenceNegative === true || det?.kind === 'absence_negative'))
    .map((det) => ({
      label: det.label,
      confidence: Number.isFinite(det.confidence) ? det.confidence : (Number.isFinite(det.score) ? det.score : null),
      box: det.box || null
    }))
    .slice(0, 5);

  return {
    highSalienceExpectedCount: enrichedMatches.filter((match) => match.salience >= 0.75).length,
    highSalienceDetectedCount: enrichedMatches.filter((match) => match.salience >= 0.75 && match.found).length,
    absenceExpectedCount: new Set(expected.flatMap((symbol) => symbol.absenceNegatives || []).map(normalizeDetectionLabel)).size,
    absenceDetectionCount: safeDetections.filter((det) => det.absenceNegative === true || det.kind === 'absence_negative').length,
    expectedCount,
    detectedCount: foundCount,
    matchRate,
    weightedMatchRate,
    matches: enrichedMatches,
    missingSymbols: missing.map((match) => match.object).slice(0, 5),
    highSalienceMissing: missing
      .filter((match) => match.salience >= 0.75)
      .map((match) => match.object)
      .slice(0, 5),
    lowSalienceMissing: missing
      .filter((match) => match.salience < 0.75)
      .map((match) => match.object)
      .slice(0, 5),
    absentSymbolFalsePositive: absenceDetections.length > 0,
    absenceDetections,
    unexpectedDetections
  };
}

function normalizeBox(box = {}, dimensions = { width: 1, height: 1 }) {
  const width = dimensions.width || 1;
  const height = dimensions.height || 1;
  return {
    xmin: Number(clamp01((box.xmin ?? 0) / width).toFixed(3)),
    ymin: Number(clamp01((box.ymin ?? 0) / height).toFixed(3)),
    xmax: Number(clamp01((box.xmax ?? 0) / width).toFixed(3)),
    ymax: Number(clamp01((box.ymax ?? 0) / height).toFixed(3))
  };
}

export class SymbolDetector {
  constructor({ model = DEFAULT_MODEL, threshold = DEFAULT_THRESHOLD, heatmapGridSize = DEFAULT_HEATMAP_GRID, preset = null } = {}) {
    const resolvedModel = (!MODEL_OVERRIDE && preset === 'fast') ? 'Xenova/owlvit-base-patch32' : model;
    this.model = resolvedModel;
    this.preset = preset;
    this.threshold = threshold;
    this.heatmapGridSize = Number.isFinite(heatmapGridSize) && heatmapGridSize > 1 ? heatmapGridSize : (DEFAULT_HEATMAP_GRID || 7);
    this._detectorPromise = null;
  }

  async _getDetector() {
    if (!this._detectorPromise) {
      this._detectorPromise = pipeline('zero-shot-object-detection', this.model);
    }
    return this._detectorPromise;
  }

  async verifySymbols(imageSource, card, { deckStyle = 'rws-1909' } = {}) {
    const provenance = {
      model: this.model,
      threshold: this.threshold,
      deckStyle,
      verifiedCard: card?.canonicalName || card?.name || card?.cardName || card?.card || null,
      verificationSource: 'symbol-detector',
      annotationStatus: 'unverified',
      annotationSource: 'rws-ontology-draft',
      spatialVerification: 'unverified'
    };
    const expectedSymbols = getExpectedSymbols(card, deckStyle);
    if (!expectedSymbols || expectedSymbols.length === 0) {
      return {
        ...provenance,
        annotationStatus: 'unsupported',
        annotationSource: null,
        matchRate: null,
        weightedMatchRate: null,
        expectedCount: 0,
        detectedCount: 0,
        highSalienceExpectedCount: 0,
        highSalienceDetectedCount: 0,
        absenceExpectedCount: 0,
        absenceDetectionCount: 0,
        absentSymbolFalsePositive: null,
        matches: [],
        absenceDetections: []
      };
    }

    const detector = await this._getDetector();
    const rawImage = await RawImage.read(imageSource);
    const { candidateLabels, labelLookup, absenceLabels } = this._buildCandidateLabels(expectedSymbols);

    if (!candidateLabels.length) {
      return { ...computeSymbolVerificationScores(expectedSymbols, [], []), ...provenance };
    }

    const detections = await detector(rawImage, candidateLabels, {
      threshold: this.threshold
    });

    const normalizedDetections = Array.isArray(detections)
      ? detections
          .map((det, index) => ({
            label: det.label,
            score: Number(det.score?.toFixed?.(4) ?? 0),
            box: normalizeBox(det.box || {}, { width: rawImage.width, height: rawImage.height }),
            id: `${det.label || 'object'}-${index}`,
            absenceNegative: absenceLabels.has(det.label)
          }))
          .sort((a, b) => b.score - a.score)
      : [];

    const heatmap = buildDetectionHeatmap(normalizedDetections, this.heatmapGridSize);

    const matchedDetectionIds = new Set();

    const matches = expectedSymbols.map((symbol, symbolIndex) => {
      const detection = normalizedDetections.find((det) => {
        if (det.absenceNegative) return false;
        const candidates = labelLookup.get(det.label) || [];
        const isCandidate = candidates.includes(symbolIndex);
        if (!isCandidate) return false;
        // Legacy locations/regions have not been checked against these images.
        // Do not pretend to enforce them or use them as verified spatial proof.
        return true;
      });

      if (detection) {
        matchedDetectionIds.add(detection.id);
      }

      return {
        object: symbolLabel(symbol),
        symbolId: symbol.symbolId || null,
        salience: symbol.salience ?? 0.6,
        expectedRegion: symbol.expectedRegion || null,
        aliases: symbol.aliases || [],
        absenceNegatives: symbol.absenceNegatives || [],
        expectedPosition: symbol.location || symbol.position || null,
        found: Boolean(detection),
        confidence: detection?.score ?? 0,
        detectionLabel: detection?.label || null,
        box: detection?.box || null
      };
    });

    const unexpectedDetections = normalizedDetections
      .filter((det) => !matchedDetectionIds.has(det.id))
      .map((det) => ({
        label: det.label,
        confidence: det.score,
        box: det.box,
        absenceNegative: det.absenceNegative
      }));

    const scores = computeSymbolVerificationScores(expectedSymbols, matches, unexpectedDetections);

    return {
      ...scores,
      ...provenance,
      matches: scores.matches.slice(0, 8),
      heatmap
    };
  }
  _buildCandidateLabels(symbols = []) {
    const labelLookup = new Map();
    const orderedLabels = [];
    const absenceLabelSet = new Set();

    symbols.forEach((symbol, index) => {
      const terms = Array.from(new Set([
        symbolLabel(symbol),
        ...(symbol.aliases || [])
      ]));
      if (!terms.length) return;
      terms.forEach((term) => {
        const prompt = formatPrompt(normalizeDetectionLabel(term));
        if (!prompt) return;
        orderedLabels.push(prompt);
        const mapping = labelLookup.get(prompt) || [];
        mapping.push(index);
        labelLookup.set(prompt, mapping);
      });

      (symbol.absenceNegatives || []).forEach((negative) => {
        // A counted/qualified negative is one concept: "eight swords" must
        // never become the positive "sword", nor "white rose" a sunflower.
        const prompt = formatPrompt(normalizeDetectionLabel(negative));
        if (!prompt) return;
        orderedLabels.push(prompt);
        absenceLabelSet.add(prompt);
      });
    });

    for (const label of absenceLabelSet) {
      if (labelLookup.has(label)) throw new Error(`Conflicting positive/negative symbol annotation: ${label}`);
    }

    const uniqueLabels = Array.from(new Set(orderedLabels));
    return { candidateLabels: uniqueLabels, labelLookup, absenceLabels: absenceLabelSet };
  }
}

export async function analyzeSymbolVerification(imageSource, card, options = {}) {
  const detector = new SymbolDetector(options);
  return detector.verifySymbols(imageSource, card, options);
}
