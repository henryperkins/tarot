import { pipeline, RawImage } from '@xenova/transformers';
import { SYMBOL_ANNOTATIONS } from '../../functions/lib/symbolAnnotations.js';
import { getMinorSymbolAnnotation } from './minorSymbolLexicon.js';

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
const SYMBOL_SYNONYMS = {
  sun: ['sun', 'solar disk', 'sunlight', 'sunrise'],
  moon: ['moon', 'luna', 'crescent'],
  dog: ['dog', 'canine', 'wolf', 'hound'],
  cat: ['cat', 'feline'],
  lion: ['lion', 'big cat'],
  horse: ['horse', 'steed'],
  crown: ['crown', 'tiara', 'coronet'],
  wand: ['wand', 'staff', 'rod'],
  cup: ['cup', 'chalice', 'goblet'],
  sword: ['sword', 'blade'],
  pentacle: ['pentacle', 'coin', 'disk', 'disc'],
  coin: ['coin', 'pentacle', 'disk', 'disc'],
  star: ['star', 'pentagram'],
  tower: ['tower', 'castle'],
  throne: ['throne', 'chair'],
  wing: ['wing', 'angel wing'],
  angel: ['angel', 'archangel'],
  bird: ['bird', 'dove', 'eagle'],
  flower: ['flower', 'rose', 'lily', 'sunflower'],
  tree: ['tree', 'branch', 'trunk'],
  pillar: ['pillar', 'column'],
  mountain: ['mountain', 'cliff', 'peak'],
  river: ['river', 'stream', 'waterfall'],
  water: ['water', 'stream', 'river'],
  boat: ['boat', 'ship', 'canoe'],
  angelwing: ['angel wing', 'wing'],
  shield: ['shield', 'emblem'],
  scale: ['scale', 'balance'],
  torch: ['torch', 'lantern', 'lamp'],
  hand: ['hand', 'palm'],
  figure: ['figure', 'person', 'human'],
  child: ['child', 'kid', 'youth'],
  fish: ['fish', 'koi'],
  snake: ['snake', 'serpent'],
  banner: ['banner', 'flag'],
  bundle: ['bundle', 'knapsack', 'satchel', 'bag'],
  feather: ['feather', 'plume'],
  rose: ['rose', 'flower'],
  cliff: ['cliff', 'ledge', 'precipice'],
  sunflowers: ['sunflower', 'flower'],
  grapes: ['grape', 'fruit'],
  scales: ['scales', 'balance'],
  wheel: ['wheel', 'circle', 'mandala']
};

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'with',
  'and',
  'or',
  'of',
  'on',
  'in',
  'at',
  'over',
  'under',
  'around',
  'through',
  'for',
  'near',
  'by',
  'to',
  'from',
  'up',
  'down',
  'scene',
  'background',
  'foreground',
  'center',
  'left',
  'right',
  'top',
  'bottom'
]);

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

const POSITION_KEYWORDS = {
  top: ['top', 'upper', 'sky', 'crown'],
  bottom: ['bottom', 'ground', 'base', 'earth'],
  left: ['left', 'west'],
  right: ['right', 'east'],
  center: ['center', 'middle', 'mid']
};

function normalizeLabel(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function singularize(token = '') {
  if (token.endsWith('ies')) {
    return token.slice(0, -3) + 'y';
  }
  if (token.endsWith('ves')) {
    return token.slice(0, -3) + 'f';
  }
  if (token.endsWith('s') && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function buildSymbolTerms(symbolObject = '') {
  const normalized = normalizeLabel(symbolObject);
  if (!normalized) return [];
  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token && !STOPWORDS.has(token));

  const terms = new Set();
  if (symbolObject) {
    terms.add(symbolObject.toLowerCase());
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const singular = singularize(token);
    terms.add(token);
    terms.add(singular);
    const synonyms = SYMBOL_SYNONYMS[singular] || SYMBOL_SYNONYMS[token] || [];
    synonyms.forEach((syn) => terms.add(syn));

    if (i < tokens.length - 1) {
      terms.add(`${token} ${tokens[i + 1]}`);
    }
  }

  return Array.from(terms).filter(Boolean);
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

function getAnnotation(card) {
  if (typeof card?.number === 'number' && SYMBOL_ANNOTATIONS?.[card.number]) {
    return SYMBOL_ANNOTATIONS[card.number];
  }
  if (card?.suit && card?.rank) {
    return getMinorSymbolAnnotation(card);
  }
  return null;
}

function getExpectedSymbols(card) {
  const annotation = getAnnotation(card);
  if (!annotation?.symbols || !annotation.symbols.length) {
    return null;
  }
  return annotation.symbols;
}

function centerFromBox(box = {}) {
  const x = box.xmin != null && box.xmax != null ? (box.xmin + box.xmax) / 2 : null;
  const y = box.ymin != null && box.ymax != null ? (box.ymin + box.ymax) / 2 : null;
  return { x, y };
}

function resolvePositionKeyword(position = '') {
  const lower = position.toLowerCase();
  if (POSITION_KEYWORDS.top.some((token) => lower.includes(token))) return 'top';
  if (POSITION_KEYWORDS.bottom.some((token) => lower.includes(token))) return 'bottom';
  if (POSITION_KEYWORDS.left.some((token) => lower.includes(token))) return 'left';
  if (POSITION_KEYWORDS.right.some((token) => lower.includes(token))) return 'right';
  if (POSITION_KEYWORDS.center.some((token) => lower.includes(token))) return 'center';
  return null;
}

function positionMatches(box, symbolPosition) {
  if (!symbolPosition || !box) return true;
  const keyword = resolvePositionKeyword(symbolPosition);
  if (!keyword) return true;
  const { x, y } = centerFromBox(box);
  if (x == null || y == null) return true;
  switch (keyword) {
    case 'top':
      return y <= 0.4;
    case 'bottom':
      return y >= 0.6;
    case 'left':
      return x <= 0.4;
    case 'right':
      return x >= 0.6;
    case 'center':
      return y > 0.35 && y < 0.65 && x > 0.35 && x < 0.65;
    default:
      return true;
  }
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

  async verifySymbols(imageSource, card) {
    const expectedSymbols = getExpectedSymbols(card);
    if (!expectedSymbols || expectedSymbols.length === 0) {
      return null;
    }

    const detector = await this._getDetector();
    const rawImage = await RawImage.read(imageSource);
    const { candidateLabels, labelLookup } = this._buildCandidateLabels(expectedSymbols);

    if (!candidateLabels.length) {
      return {
        expectedCount: expectedSymbols.length,
        detectedCount: 0,
        matchRate: 0,
        matches: expectedSymbols.map((symbol) => ({
          object: symbol.object,
          expectedPosition: symbol.position || null,
          found: false,
          confidence: 0,
          detectionLabel: null
        })),
        missingSymbols: expectedSymbols.map((symbol) => symbol.object),
        unexpectedDetections: []
      };
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
            id: `${det.label || 'object'}-${index}`
          }))
          .sort((a, b) => b.score - a.score)
      : [];

    const heatmap = buildDetectionHeatmap(normalizedDetections, this.heatmapGridSize);

    const matchedDetectionIds = new Set();

    const matches = expectedSymbols.map((symbol, symbolIndex) => {
      const detection = normalizedDetections.find((det) => {
        const candidates = labelLookup.get(det.label) || [];
        const isCandidate = candidates.includes(symbolIndex);
        if (!isCandidate) return false;
        return positionMatches(det.box, symbol.position);
      });

      if (detection) {
        matchedDetectionIds.add(detection.id);
      }

      return {
        object: symbol.object,
        expectedPosition: symbol.position || null,
        found: Boolean(detection),
        confidence: detection?.score ?? 0,
        detectionLabel: detection?.label || null,
        box: detection?.box || null
      };
    });

    const foundCount = matches.filter((match) => match.found).length;
    const matchRate = Number((foundCount / expectedSymbols.length).toFixed(4));
    const missingSymbols = matches
      .filter((match) => !match.found)
      .map((match) => match.object);

    const unexpectedDetections = normalizedDetections
      .filter((det) => !matchedDetectionIds.has(det.id))
      .slice(0, 5)
      .map((det) => ({ label: det.label, confidence: det.score, box: det.box }));

    return {
      expectedCount: expectedSymbols.length,
      detectedCount: foundCount,
      matchRate,
      matches: matches.slice(0, 8),
      missingSymbols: missingSymbols.slice(0, 5),
      unexpectedDetections,
      heatmap
    };
  }
  _buildCandidateLabels(symbols = []) {
    const labelLookup = new Map();
    const orderedLabels = [];

    symbols.forEach((symbol, index) => {
      const terms = buildSymbolTerms(symbol.object);
      if (!terms.length) return;
      terms.forEach((term) => {
        const prompt = formatPrompt(term);
        if (!prompt) return;
        orderedLabels.push(prompt);
        const mapping = labelLookup.get(prompt) || [];
        mapping.push(index);
        labelLookup.set(prompt, mapping);
      });
    });

    const uniqueLabels = Array.from(new Set(orderedLabels));
    return { candidateLabels: uniqueLabels, labelLookup };
  }
}

export async function analyzeSymbolVerification(imageSource, card, options = {}) {
  const detector = new SymbolDetector(options);
  return detector.verifySymbols(imageSource, card);
}
