import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../../src/data/minorArcana.js';
import { canonicalizeCardName } from './cardNameMapping.js';
import { getDeckProfile } from './deckProfiles.js';
import { runLlamaVisionAnalysis, LLAMA_VISION_DEFAULT_MODEL } from '../../functions/lib/llamaVision.js';

const DEFAULT_SCOPE = 'major';
const DEFAULT_MAX_RESULTS = 5;

function clampConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

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

function buildAllowedCardList(cardScope, deckProfile) {
  const cards = cardScope === 'all' ? [...MAJOR_ARCANA, ...MINOR_ARCANA] : MAJOR_ARCANA;
  return cards.map((card) => {
    const alias = deckProfile?.aliasResolver?.(card);
    if (alias && alias !== card.name) {
      return `${card.name} (aka ${alias})`;
    }
    return card.name;
  });
}

function normalizeMatches(matches, deckStyle, maxResults, predictedCard, predictedScore) {
  const normalized = Array.isArray(matches)
    ? matches
      .map((match) => {
        if (!match || typeof match !== 'object') return null;
        const card = canonicalizeCardName(match.card, deckStyle);
        if (!card) return null;
        return {
          cardName: card,
          canonicalName: card,
          score: clampConfidence(match.confidence ?? match.score ?? null),
          basis: 'llama'
        };
      })
      .filter(Boolean)
    : [];

  if (predictedCard && !normalized.some((entry) => entry.cardName === predictedCard)) {
    normalized.unshift({
      cardName: predictedCard,
      canonicalName: predictedCard,
      score: clampConfidence(predictedScore),
      basis: 'llama'
    });
  }

  return normalized.slice(0, maxResults);
}

export class LlamaVisionPipeline {
  constructor(options = {}) {
    this.env = options.env || null;
    this.cardScope = options.cardScope || DEFAULT_SCOPE;
    this.maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
    this.model = options.model || LLAMA_VISION_DEFAULT_MODEL;
    this.timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : null;
    this.deckProfile = getDeckProfile(options.deckStyle);
    this.allowedCards = buildAllowedCardList(this.cardScope, this.deckProfile);
  }

  async analyzeImages(imageInputs = [], options = {}) {
    if (!Array.isArray(imageInputs) || imageInputs.length === 0) {
      throw new Error('analyzeImages requires at least one image source');
    }
    if (!this.env?.AI?.run) {
      throw new Error('Workers AI binding is not available for Llama Vision.');
    }

    const allowFailures = options.allowFailures === true;

    const analyses = await Promise.all(
      imageInputs.map(async (input) => {
        const normalized = normalizeInput(input);
        const result = await runLlamaVisionAnalysis(this.env, {
          image: normalized.source,
          label: normalized.label,
          allowedCards: this.allowedCards,
          deckProfile: this.deckProfile,
          cardScope: this.cardScope,
          timeoutMs: this.timeoutMs || options.timeoutMs,
          model: this.model,
          maxTokens: options.maxTokens
        });

        const predictedCard = canonicalizeCardName(result.card, this.deckProfile.id);
        const confidence = clampConfidence(result.confidence ?? null);
        const matches = normalizeMatches(result.matches, this.deckProfile.id, this.maxResults, predictedCard, confidence);
        const topMatch = predictedCard
          ? {
            cardName: predictedCard,
            canonicalName: predictedCard,
            score: clampConfidence(confidence ?? matches[0]?.score ?? null),
            basis: 'llama'
          }
          : null;

        return {
          imagePath: normalized.source,
          label: normalized.label,
          matches,
          topMatch,
          confidence: clampConfidence(confidence ?? topMatch?.score ?? null),
          attention: null,
          symbolVerification: null,
          visualProfile: null,
          orientation: result.orientation || null,
          reasoning: result.reasoning || null,
          visualDetails: result.visualDetails || null,
          analysisStatus: result.status
        };
      })
    );

    if (!allowFailures) {
      const failure = analyses.find((entry) => entry.analysisStatus && entry.analysisStatus !== 'ok');
      if (failure) {
        throw new Error(`Llama vision failed with status: ${failure.analysisStatus}`);
      }
    }

    return analyses;
  }
}

export default LlamaVisionPipeline;
