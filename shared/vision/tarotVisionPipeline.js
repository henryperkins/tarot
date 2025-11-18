import {
  AutoTokenizer,
  AutoProcessor,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  Tensor
} from '@xenova/transformers';

import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { SYMBOL_ANNOTATIONS } from '../symbols/symbolAnnotations.js';
import { getMinorSymbolAnnotation } from './minorSymbolLexicon.js';
import { getDeckProfile } from './deckProfiles.js';
import { SymbolDetector } from './symbolDetector.js';
import { loadFineTunedPrototypes } from './fineTuneCache.js';

const DEFAULT_MODEL = 'Xenova/clip-vit-base-patch32';
const DEFAULT_SCOPE = 'major';
const DEFAULT_MAX_RESULTS = 5;
const IS_BROWSER = typeof window !== 'undefined';
const NODE_BASE_URL = !IS_BROWSER && typeof process !== 'undefined'
  ? (() => {
      const cwdNormalized = process.cwd().replace(/\\/g, '/');
      const ensured = cwdNormalized.endsWith('/') ? cwdNormalized : `${cwdNormalized}/`;
      return new URL(`file://${encodeURI(ensured)}`);
    })()
  : null;

const POSITION_KEYWORDS = {
  top: ['top', 'upper', 'crown'],
  bottom: ['bottom', 'lower', 'base'],
  left: ['left', 'west'],
  right: ['right', 'east'],
  center: ['center', 'middle', 'mid']
};

const CARD_LOOKUP = (() => {
  const map = new Map();
  [...MAJOR_ARCANA, ...MINOR_ARCANA].forEach((card) => {
    if (!card?.name) return;
    map.set(card.name.toLowerCase(), card);
  });
  return map;
})();

function normalizeAssetPath(pathCandidate) {
  if (!pathCandidate) return null;
  if (IS_BROWSER) {
    return pathCandidate;
  }
  if (pathCandidate.startsWith('public/')) {
    return pathCandidate;
  }
  const sanitized = pathCandidate.startsWith('/') ? pathCandidate.slice(1) : pathCandidate;
  return `public/${sanitized}`;
}

function resolveCardImageSource(card, deckProfile) {
  if (!card) return null;
  const override = deckProfile?.imageOverrides?.[card.name];
  const imageByDeck = deckProfile?.id && card?.images ? card.images[deckProfile.id] : null;
  const candidate =
    deckProfile?.imageResolver?.(card) ||
    override?.path ||
    imageByDeck ||
    card?.image ||
    override ||
    null;
  return normalizeAssetPath(candidate);
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

function buildPrompt(card, deckProfile, aliasName) {
  const annotation = getAnnotation(card);
  const symbolSnippets = annotation?.symbols
    ?.map((symbol) => {
      const color = symbol.color ? `${symbol.color} ` : '';
      return `${color}${symbol.object} (${symbol.meaning})`;
    })
    .slice(0, 4)
    .join(', ');

  const dominantColors = annotation?.dominantColors
    ?.map((entry) => `${entry.color}: ${entry.meaning}`)
    .slice(0, 3)
    .join(', ');

  const displaySuit = card.suit ? (deckProfile?.suitAliasResolver?.(card.suit) || card.suit) : null;
  const suitDescriptor = displaySuit ? `Suit: ${displaySuit}.` : '';
  const displayRank = card.rank ? (deckProfile?.courtAliasResolver?.(card.rank) || card.rank) : null;
  const rankDescriptor = displayRank ? `Rank: ${displayRank}.` : '';
  const keywords = card.upright || card.meaning || '';

  const visualNotes = [symbolSnippets, dominantColors]
    .filter(Boolean)
    .join(' | ');

  const deckCue = deckProfile?.promptCue
    ? `${deckProfile.promptCue} Palette cues: ${deckProfile.palette.join(', ')}. Texture: ${deckProfile.texture}`
    : '';

  const presentedName = aliasName || card.name;
  const aliasNote =
    aliasName && aliasName !== card.name ? ` (RWS base: ${card.name})` : '';

  return `${deckCue} Card: ${presentedName}${aliasNote}. ${suitDescriptor} ${rankDescriptor} Keywords: ${keywords}. Visual motifs: ${visualNotes}.`;
}

function buildCardLibrary(scope = DEFAULT_SCOPE, deckProfile) {
  const baseCards = scope === 'all' ? [...MAJOR_ARCANA, ...MINOR_ARCANA] : MAJOR_ARCANA;
  return baseCards.map((card, index) => {
    const alias = deckProfile?.aliasResolver?.(card);
    return {
      id: card.number != null ? card.number : `${card.suit}-${card.rank}-${index}`,
      label: alias || card.name,
      canonicalName: card.name,
      sourceCard: card,
      prompt: buildPrompt(card, deckProfile, alias),
      imageSource: resolveCardImageSource(card, deckProfile)
    };
  });
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function selectBestScore({ imageScore, textScore, adapterScore }) {
  let bestValue = -Infinity;
  let basis = 'text';
  const candidates = [
    ['adapter', adapterScore],
    ['image', imageScore],
    ['text', textScore]
  ];
  candidates.forEach(([label, value]) => {
    if (typeof value === 'number' && Number.isFinite(value) && value > bestValue) {
      bestValue = value;
      basis = label;
    }
  });
  if (!Number.isFinite(bestValue)) {
    return { score: 0, basis: 'text' };
  }
  return { score: bestValue, basis };
}

function toArray(bufferLike) {
  if (!bufferLike) return [];
  if (Array.isArray(bufferLike)) return bufferLike;
  if (ArrayBuffer.isView(bufferLike)) return Array.from(bufferLike);
  return Array.from(bufferLike);
}

function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm || Number.isNaN(norm)) return vector;
  return vector.map((value) => value / norm);
}

function lookupCardByName(name) {
  if (!name || typeof name !== 'string') return null;
  return CARD_LOOKUP.get(name.trim().toLowerCase()) || null;
}

function positionStringToCell(position, gridSize) {
  const fallback = Math.floor(gridSize / 2);
  if (!position || typeof position !== 'string') {
    return { x: fallback, y: fallback };
  }
  const lower = position.toLowerCase();
  let x = fallback;
  let y = fallback;
  if (POSITION_KEYWORDS.left.some((token) => lower.includes(token))) {
    x = 0;
  } else if (POSITION_KEYWORDS.right.some((token) => lower.includes(token))) {
    x = gridSize - 1;
  }

  if (POSITION_KEYWORDS.top.some((token) => lower.includes(token))) {
    y = 0;
  } else if (POSITION_KEYWORDS.bottom.some((token) => lower.includes(token))) {
    y = gridSize - 1;
  } else if (POSITION_KEYWORDS.center.some((token) => lower.includes(token))) {
    y = fallback;
  }

  return {
    x: Math.max(0, Math.min(gridSize - 1, x)),
    y: Math.max(0, Math.min(gridSize - 1, y))
  };
}

function reshapeHeatmap(values, gridSize) {
  const rows = [];
  for (let y = 0; y < gridSize; y += 1) {
    const rowStart = y * gridSize;
    rows.push(values.slice(rowStart, rowStart + gridSize));
  }
  return rows;
}

function normalizeHeatmap(heatmap) {
  const flat = heatmap.flat();
  const max = Math.max(...flat, 0);
  if (!max) {
    return {
      normalized: heatmap.map((row) => row.map(() => 0)),
      max,
      min: 0
    };
  }
  const min = Math.min(...flat, 0);
  return {
    normalized: heatmap.map((row) => row.map((value) => Number((value / max).toFixed(4)))),
    max,
    min
  };
}

function deriveFocusRegions(heatmap, threshold = 0.65) {
  const normalized = heatmap;
  const regions = [];
  normalized.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value >= threshold) {
        regions.push({ x, y, intensity: Number(value.toFixed(4)) });
      }
    });
  });
  return regions.sort((a, b) => b.intensity - a.intensity).slice(0, 8);
}

function alignSymbolsToHeatmap(symbols = [], heatmap, gridSize) {
  if (!Array.isArray(symbols) || symbols.length === 0) return null;
  const flatMax = Math.max(...heatmap.flat(), 0) || 1;
  return symbols.map((symbol) => {
    const cell = positionStringToCell(symbol.position || '', gridSize);
    const score = heatmap[cell.y]?.[cell.x] ?? 0;
    return {
      object: symbol.object,
      position: symbol.position,
      attentionScore: Number((score / flatMax).toFixed(4)),
      isModelFocused: score / flatMax >= 0.65
    };
  });
}

function extractAttentionSummary(attentions) {
  if (!attentions || !Array.isArray(attentions) || !attentions.length) return null;
  const lastLayer = attentions[attentions.length - 1];
  if (!(lastLayer instanceof Tensor)) {
    return null;
  }
  const [batch, heads, tokens] = lastLayer.dims || [];
  if (!batch || !heads || !tokens || tokens <= 1) {
    return null;
  }
  const patchCount = tokens - 1;
  const gridSize = Math.max(1, Math.round(Math.sqrt(patchCount)));
  const denom = batch * heads || 1;
  const patchScores = new Array(patchCount).fill(0);
  for (let b = 0; b < batch; b += 1) {
    for (let h = 0; h < heads; h += 1) {
      for (let patch = 0; patch < patchCount; patch += 1) {
        const tokenIdx = patch + 1; // skip CLS token
        const idx = (((b * heads) + h) * tokens + 0) * tokens + tokenIdx;
        patchScores[patch] += lastLayer.data[idx] || 0;
      }
    }
  }
  const averaged = patchScores.map((value) => value / denom);
  while (averaged.length < gridSize * gridSize) {
    averaged.push(0);
  }
  const heatmap = reshapeHeatmap(averaged.slice(0, gridSize * gridSize), gridSize);
  const { normalized, max, min } = normalizeHeatmap(heatmap);
  const focusRegions = deriveFocusRegions(normalized);
  return {
    gridSize,
    heatmap: normalized,
    stats: {
      max: Number(max.toFixed(4)),
      min: Number(min.toFixed(4))
    },
    focusRegions
  };
}

function decorateAttentionWithSymbols(attentionSummary, card) {
  if (!attentionSummary || !card) return attentionSummary;
  const annotation = getAnnotation(card);
  if (!annotation) return attentionSummary;
  const symbolAlignment = alignSymbolsToHeatmap(annotation.symbols, attentionSummary.heatmap, attentionSummary.gridSize);
  return {
    ...attentionSummary,
    symbolAlignment
  };
}

export class TarotVisionPipeline {
  constructor({
    model = DEFAULT_MODEL,
    quantized = true,
    cardScope = DEFAULT_SCOPE,
    maxResults = DEFAULT_MAX_RESULTS,
    deckStyle = 'rws-1909'
  } = {}) {
    this.model = model;
    this.quantized = quantized;
    this.cardScope = cardScope;
    this.maxResults = maxResults;
    this.deckProfile = getDeckProfile(deckStyle);

    this.cardLibrary = buildCardLibrary(cardScope, this.deckProfile);
    this._cardEmbeddingsPromise = null;
    this._textStackPromise = null;
    this._visionStackPromise = null;
    this._symbolDetectorPromise = null;
  }

  async _getTextStack() {
    if (!this._textStackPromise) {
      this._textStackPromise = (async () => {
        const tokenizer = await AutoTokenizer.from_pretrained(this.model);
        const model = await CLIPTextModelWithProjection.from_pretrained(this.model, {
          quantized: this.quantized,
          progress_callback: null
        });
        return { tokenizer, model };
      })();
    }
    return this._textStackPromise;
  }

  async _getVisionStack() {
    if (!this._visionStackPromise) {
      this._visionStackPromise = (async () => {
        const processor = await AutoProcessor.from_pretrained(this.model);
        const model = await CLIPVisionModelWithProjection.from_pretrained(this.model, {
          quantized: this.quantized,
          progress_callback: null
        });
        return { processor, model };
      })();
    }
    return this._visionStackPromise;
  }

  async _getSymbolDetector() {
    if (!this._symbolDetectorPromise) {
      this._symbolDetectorPromise = Promise.resolve(new SymbolDetector());
    }
    return this._symbolDetectorPromise;
  }

  async _embedPrompt(prompt) {
    const { tokenizer, model } = await this._getTextStack();
    const tokenized = tokenizer(prompt, { padding: true, truncation: true });
    const { text_embeds } = await model(tokenized);
    return normalizeVector(toArray(text_embeds.data));
  }

  async _embedImage(imageSource, { includeAttention = false } = {}) {
    const normalizedSource = normalizeImageSource(imageSource);
    const rawImage = await RawImage.read(normalizedSource);
    const { processor, model } = await this._getVisionStack();
    const processed = await processor(rawImage);
    const visionInputs = {
      ...processed,
      output_attentions: includeAttention
    };
    const { image_embeds, attentions } = await model(visionInputs);
    return {
      resolvedPath: normalizedSource,
      vector: normalizeVector(toArray(image_embeds.data)),
      attention: includeAttention ? extractAttentionSummary(attentions) : null
    };
  }

  async _ensureCardEmbeddings() {
    if (!this._cardEmbeddingsPromise) {
      this._cardEmbeddingsPromise = (async () => {
        const embeddings = [];
        const adapterData = await loadFineTunedPrototypes(this.deckProfile.id);
        const adapterCards = adapterData?.cards || {};
        for (const card of this.cardLibrary) {
          const textVector = await this._embedPrompt(card.prompt);
          let imageVector = null;
          if (card.imageSource) {
            try {
              const embeddedImage = await this._embedImage(card.imageSource);
              imageVector = embeddedImage.vector;
            } catch (err) {
              console.warn(`Failed to embed reference image for ${card.label}:`, err.message);
            }
          }

          const canonicalKey = card.canonicalName || card.cardName;
          const adapterEntry = adapterCards[canonicalKey] || adapterCards[card.cardName];
          const adapterVector = adapterEntry?.embedding ? normalizeVector(adapterEntry.embedding) : null;

          embeddings.push({
            cardId: card.id,
            cardName: card.label,
            canonicalName: card.canonicalName,
            cardMetadata: card.sourceCard,
            textVector,
            imageVector,
            adapterVector,
            adapterMeta: adapterEntry ? { count: adapterEntry.count || 0 } : null
          });
        }
        return embeddings;
      })();
    }
    return this._cardEmbeddingsPromise;
  }

  async analyzeImages(imageInputs = [], options = {}) {
    if (!Array.isArray(imageInputs) || imageInputs.length === 0) {
      throw new Error('analyzeImages requires at least one image source');
    }

    const cardEmbeddings = await this._ensureCardEmbeddings();
    const analyses = [];
    const includeAttention = Boolean(options.includeAttention);
    const includeSymbols = Boolean(options.includeSymbols);
    const deckStyle = this.deckProfile.id;
    const symbolDetector = includeSymbols ? await this._getSymbolDetector() : null;

    for (const input of imageInputs) {
      const normalized = normalizeInput(input);
      const { resolvedPath, vector: imageVector, attention: rawAttention } = await this._embedImage(normalized.source, {
        includeAttention
      });
      const matches = cardEmbeddings
        .map((card) => {
          const imageScore = card.imageVector ? cosineSimilarity(imageVector, card.imageVector) : null;
          const textScore = card.textVector ? cosineSimilarity(imageVector, card.textVector) : null;
          const adapterScore = card.adapterVector ? cosineSimilarity(imageVector, card.adapterVector) : null;
          const { score, basis } = selectBestScore({ imageScore, textScore, adapterScore });
          return {
            cardId: card.cardId,
            cardName: card.cardName,
            canonicalName: card.canonicalName,
            score,
            basis,
            components: {
              imageScore,
              textScore,
              adapterScore
            },
            cardMetadata: card.cardMetadata,
            adapterMeta: card.adapterMeta || null
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxResults);

      let attention = rawAttention;
      if (includeAttention && attention && matches[0]?.canonicalName) {
        const card = lookupCardByName(matches[0].canonicalName) || lookupCardByName(matches[0].cardName);
        attention = decorateAttentionWithSymbols(attention, card);
      }

      let symbolVerification = null;
      if (includeSymbols && symbolDetector && matches[0]?.cardMetadata) {
        try {
          symbolVerification = await symbolDetector.verifySymbols(resolvedPath, matches[0].cardMetadata, {
            deckStyle
          });
        } catch (err) {
          console.warn('Symbol detection failed:', err);
        }
      }

      if ((!attention || !attention.heatmap) && symbolVerification?.heatmap && matches[0]?.cardMetadata) {
        attention = decorateAttentionWithSymbols(symbolVerification.heatmap, matches[0].cardMetadata);
      }

      analyses.push({
        imagePath: resolvedPath,
        label: normalized.label,
        matches,
        topMatch: matches[0] || null,
        confidence: matches[0]?.score ?? 0,
        attention,
        symbolVerification
      });
    }

    return analyses;
  }
}

export default TarotVisionPipeline;

function normalizeInput(input) {
  if (typeof input === 'string') {
    return { source: input, label: input };
  }
  if (input && typeof input === 'object') {
    const label = input.label || input.name || input.source || 'uploaded-image';
    const source = input.source || input.dataUrl || input.url;
    if (!source) {
      throw new Error('Image input objects must include a source/dataUrl/url property.');
    }
    return { source, label };
  }
  throw new Error('Unsupported image input type.');
}

function normalizeImageSource(source) {
  if (typeof source === 'string') {
    if (!IS_BROWSER) {
      if (source.startsWith('http') || source.startsWith('data:')) {
        return source;
      }
      if (!NODE_BASE_URL) {
        return source;
      }
      const resolved = new URL(source, NODE_BASE_URL);
      let filePath = decodeURIComponent(resolved.pathname);
      if (/^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1);
      }
      return filePath;
    }
    return source;
  }
  throw new Error('Image source must be a string path, URL, or data URL.');
}
