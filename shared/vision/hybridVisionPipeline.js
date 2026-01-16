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

export function mergeVisionAnalyses(clipResult, llamaResult) {
  const clipConfidence = extractConfidence(clipResult);
  const llamaConfidence = extractConfidence(llamaResult);
  const llamaStatus = llamaResult?.analysisStatus || (llamaResult ? 'ok' : null);
  const llamaOk = llamaStatus === 'ok';

  const clipCard = extractCardName(clipResult);
  const llamaCard = llamaOk ? extractCardName(llamaResult) : null;

  const useLlama = Boolean(
    llamaCard && (!clipCard || (llamaConfidence ?? -1) >= (clipConfidence ?? -1))
  );

  const cardSource = useLlama ? 'llama' : 'clip';
  const topMatch = useLlama ? (llamaResult?.topMatch || null) : (clipResult?.topMatch || null);
  const confidence = useLlama ? (llamaConfidence ?? clipConfidence) : (clipConfidence ?? llamaConfidence);

  const matches = Array.isArray(clipResult?.matches) && clipResult.matches.length
    ? clipResult.matches
    : (Array.isArray(llamaResult?.matches) ? llamaResult.matches : []);

  return {
    imagePath: clipResult?.imagePath || llamaResult?.imagePath || null,
    label: clipResult?.label || llamaResult?.label || null,
    matches,
    topMatch,
    confidence,
    attention: clipResult?.attention || null,
    symbolVerification: clipResult?.symbolVerification || null,
    visualProfile: clipResult?.visualProfile || null,
    orientation: llamaOk ? (llamaResult?.orientation || null) : null,
    reasoning: llamaOk ? (llamaResult?.reasoning || null) : null,
    visualDetails: llamaOk ? (llamaResult?.visualDetails || null) : null,
    mergeSource: cardSource,
    componentScores: buildComponentScores(clipConfidence, llamaConfidence)
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
