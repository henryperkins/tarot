import { TarotVisionPipeline } from './tarotVisionPipeline.js';
import { LlamaVisionPipeline } from './llamaVisionPipeline.js';

function extractConfidence(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.confidence === 'number' && Number.isFinite(entry.confidence)) {
    return entry.confidence;
  }
  if (typeof entry.topMatch?.score === 'number' && Number.isFinite(entry.topMatch.score)) {
    return entry.topMatch.score;
  }
  return null;
}

function extractCardName(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return entry.topMatch?.canonicalName || entry.topMatch?.cardName || entry.predictedCard || null;
}

function buildComponentScores(clipConfidence, llamaConfidence) {
  if (clipConfidence == null && llamaConfidence == null) return null;
  return {
    clip: clipConfidence ?? null,
    llama: llamaConfidence ?? null
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

function scoreGap(entry) {
  const matches = Array.isArray(entry?.matches) ? entry.matches : [];
  const first = extractConfidence(matches[0]) ?? extractConfidence(entry);
  const second = extractConfidence(matches[1]) ?? 0;
  if (!Number.isFinite(first)) return 0;
  return Number(Math.max(0, first - second).toFixed(4));
}

export function buildVisionRouterFeatures(clipResult, llamaResult) {
  const clipScore = extractConfidence(clipResult);
  const llamaScore = extractConfidence(llamaResult);
  const llamaStatus = llamaResult?.analysisStatus || (llamaResult ? 'ok' : null);
  const llamaOk = llamaStatus === 'ok';
  const clipCard = extractCardName(clipResult);
  const llamaCard = llamaOk ? extractCardName(llamaResult) : null;
  const symbolWeightedMatch = Number.isFinite(clipResult?.symbolVerification?.weightedMatchRate)
    ? clipResult.symbolVerification.weightedMatchRate
    : (Number.isFinite(clipResult?.symbolVerification?.matchRate) ? clipResult.symbolVerification.matchRate : 0);

  return {
    clipScore: clipScore ?? 0,
    llamaScore: llamaScore ?? 0,
    llamaOk,
    clipScoreGap: scoreGap(clipResult),
    llamaAgrees: Boolean(clipCard && llamaCard && clipCard === llamaCard),
    symbolWeightedMatch,
    orientationKnown: Boolean(llamaOk && llamaResult?.orientation && llamaResult.orientation !== 'unknown'),
    imageQualityScore: Number.isFinite(clipResult?.imageQuality?.usableForSymbolDetectionScore)
      ? clipResult.imageQuality.usableForSymbolDetectionScore
      : (clipResult?.imageQuality?.usableForSymbolDetection === false ? 0 : 1)
  };
}

export function routeVisionDecision(features = {}) {
  const clipScore = features.clipScore ?? 0;
  const llamaScore = features.llamaScore ?? 0;
  const symbolWeightedMatch = features.symbolWeightedMatch ?? 0;

  if (features.llamaAgrees && symbolWeightedMatch >= 0.65) {
    return {
      source: 'agreement',
      calibratedConfidence: clamp01(Math.max(clipScore, llamaScore) + 0.08),
      decisionReason: 'clip_llama_agree_symbol_grounded',
      abstain: false,
      needsReview: false
    };
  }

  if (!features.llamaAgrees && symbolWeightedMatch >= 0.75 && (features.clipScoreGap ?? 0) >= 0.12) {
    return {
      source: 'clip',
      calibratedConfidence: clamp01(clipScore),
      decisionReason: 'clip_symbol_grounded_disagreement',
      abstain: false,
      needsReview: true
    };
  }

  if (features.llamaOk && !features.llamaAgrees && llamaScore >= 0.9 && clipScore < 0.65) {
    return {
      source: 'llama',
      calibratedConfidence: clamp01(llamaScore),
      decisionReason: 'llama_high_confidence_clip_weak',
      abstain: false,
      needsReview: true
    };
  }

  if (!features.llamaOk) {
    return {
      source: 'clip',
      calibratedConfidence: clamp01(clipScore),
      decisionReason: 'llama_fallback',
      abstain: false,
      needsReview: false
    };
  }

  return {
    source: 'clip',
    calibratedConfidence: clamp01(Math.max(0, clipScore - 0.1)),
    decisionReason: 'clip_default_lowered_for_disagreement',
    abstain: false,
    needsReview: true
  };
}

function routedSymbolVerification(symbolVerification, routedCard, clipCard) {
  if (!symbolVerification) return null;
  const verifiedCard = symbolVerification.verifiedCard || clipCard || null;
  if (verifiedCard && routedCard && verifiedCard !== routedCard) {
    return {
      ...symbolVerification,
      telemetryOnly: true,
      appliesToRoutedCard: false,
      suppressionReason: 'symbol_proof_card_mismatch'
    };
  }
  return {
    ...symbolVerification,
    verifiedCard,
    telemetryOnly: false,
    appliesToRoutedCard: true
  };
}

export function mergeVisionAnalyses(clipResult, llamaResult) {
  const features = buildVisionRouterFeatures(clipResult, llamaResult);
  const decision = routeVisionDecision(features);
  const clipConfidence = features.clipScore;
  const llamaConfidence = features.llamaScore;
  const llamaOk = features.llamaOk;
  const clipCard = extractCardName(clipResult);
  const llamaCard = llamaOk ? extractCardName(llamaResult) : null;

  const useLlama = decision.source === 'llama'
    || (decision.source === 'agreement' && llamaCard && llamaConfidence >= clipConfidence);

  const cardSource = useLlama ? 'llama' : 'clip';
  const topMatch = useLlama ? (llamaResult?.topMatch || null) : (clipResult?.topMatch || null);
  const confidence = useLlama ? (llamaConfidence ?? clipConfidence) : (clipConfidence ?? llamaConfidence);
  const routedCard = useLlama ? llamaCard : clipCard;

  const matches = Array.isArray(clipResult?.matches) && clipResult.matches.length
    ? clipResult.matches
    : (Array.isArray(llamaResult?.matches) ? llamaResult.matches : []);

  return {
    imagePath: clipResult?.imagePath || llamaResult?.imagePath || null,
    label: clipResult?.label || llamaResult?.label || null,
    matches,
    topMatch,
    confidence,
    calibratedConfidence: decision.calibratedConfidence,
    attention: clipResult?.attention || null,
    symbolVerification: routedSymbolVerification(clipResult?.symbolVerification, routedCard, clipCard),
    visualProfile: clipResult?.visualProfile || null,
    imageQuality: clipResult?.imageQuality || llamaResult?.imageQuality || null,
    orientation: llamaOk ? (llamaResult?.orientation || null) : null,
    reasoning: llamaOk ? (llamaResult?.reasoning || null) : null,
    visualDetails: llamaOk ? (llamaResult?.visualDetails || null) : null,
    mergeSource: cardSource,
    componentScores: buildComponentScores(clipConfidence, llamaConfidence),
    routerFeatures: features,
    decisionReason: decision.decisionReason,
    abstain: decision.abstain,
    needsReview: decision.needsReview
  };
}

export class HybridVisionPipeline {
  constructor(options = {}) {
    this.clipPipeline = new TarotVisionPipeline(options);
    this.llamaPipeline = new LlamaVisionPipeline(options);
    this.deckProfile = this.clipPipeline.deckProfile || this.llamaPipeline.deckProfile;
  }

  async _ensureCardEmbeddings() {
    if (typeof this.clipPipeline?._ensureCardEmbeddings === 'function') {
      await this.clipPipeline._ensureCardEmbeddings();
    }
  }

  async analyzeImages(imageInputs = [], options = {}) {
    if (!Array.isArray(imageInputs) || imageInputs.length === 0) {
      throw new Error('analyzeImages requires at least one image source');
    }

    const [clipResults, llamaResults] = await Promise.all([
      this.clipPipeline.analyzeImages(imageInputs, options),
      this.llamaPipeline.analyzeImages(imageInputs, { ...options, allowFailures: true })
    ]);

    return imageInputs.map((_, index) => mergeVisionAnalyses(clipResults[index], llamaResults[index]));
  }
}

export default HybridVisionPipeline;
