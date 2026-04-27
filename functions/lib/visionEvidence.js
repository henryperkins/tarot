import {
  getRwsCardEvidence,
  getRwsSymbolEvidence,
  normalizeRwsSymbolName
} from '../../shared/vision/rwsEvidenceOntology.js';
import { canonicalCardKey, canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
import { resolveVisionPromptThresholds } from './readingQuality.js';
import { sanitizeText } from './utils.js';

function sanitizeDetail(value) {
  return sanitizeText(String(value || ''), {
    maxLength: 120,
    stripMarkdown: true,
    stripControlChars: true,
    filterInstructions: true
  }).trim();
}

function drawnKeySet(cardsInfo, deckStyle) {
  return new Set((cardsInfo || [])
    .map((card) => canonicalCardKey(card?.canonicalName || card?.card || card?.name, deckStyle))
    .filter(Boolean));
}

function mapVerifiedSymbols(entry) {
  const matches = Array.isArray(entry?.symbolVerification?.matches)
    ? entry.symbolVerification.matches
    : [];
  return matches
    .filter((match) => match?.found === true)
    .map((match) => {
      const ontology = getRwsSymbolEvidence(entry.predictedCard, match.object);
      const symbol = ontology?.symbol || normalizeRwsSymbolName(match.object);
      return {
        symbol,
        symbolId: ontology?.symbolId || match.symbolId || null,
        label: ontology?.label || match.object,
        location: ontology?.location || match.expectedPosition || null,
        salience: ontology?.salience ?? match.salience ?? null,
        expectedRegion: ontology?.expectedRegion || match.expectedRegion || null,
        literalObservation: ontology?.literalObservation || `${match.object} was detected in the uploaded image.`,
        symbolicMeaning: ontology?.symbolicMeaning || [],
        detectorConfidence: typeof match.confidence === 'number' ? match.confidence : null
      };
    });
}

function mapVisualDetails(entry, verifiedSymbols = []) {
  const verified = new Set(verifiedSymbols.map((item) => item.symbol));
  return (entry.visualDetails || [])
    .map(sanitizeDetail)
    .filter(Boolean)
    .filter((detail) => !verified.has(normalizeRwsSymbolName(detail)))
    .slice(0, 6)
    .map((detail) => ({
      symbol: normalizeRwsSymbolName(detail),
      label: detail,
      location: null,
      literalObservation: detail,
      symbolicMeaning: [],
      detectorConfidence: null
    }));
}

function buildExpectedRiderSymbols(ontology) {
  return (ontology?.visualSymbols || []).slice(0, 8).map((symbol) => ({
    symbol: symbol.symbol,
    symbolId: symbol.symbolId || null,
    label: symbol.label,
    location: symbol.location || null,
    salience: symbol.salience ?? null,
    expectedRegion: symbol.expectedRegion || null,
    aliases: symbol.aliases || [],
    literalObservation: symbol.literalObservation,
    symbolicMeaning: symbol.symbolicMeaning || []
  }));
}

function resolveVisualClaimMode(entry, threshold) {
  if (entry?.matchesDrawnCard !== true) return 'ask_for_confirmation';
  const confidence = typeof entry.confidence === 'number' ? entry.confidence : null;
  const symbolScore = typeof entry.symbolVerification?.weightedMatchRate === 'number'
    ? entry.symbolVerification.weightedMatchRate
    : (typeof entry.symbolVerification?.matchRate === 'number' ? entry.symbolVerification.matchRate : null);

  if (confidence !== null && confidence < 0.7) return 'ask_for_confirmation';
  if (confidence !== null && confidence >= 0.85 && symbolScore !== null && symbolScore >= threshold) {
    return 'verified_visual_evidence';
  }
  if (confidence !== null && confidence >= 0.85 && (symbolScore === null || symbolScore < threshold)) {
    return 'card_level_only';
  }
  return 'limited_visual_evidence';
}

function buildForbiddenClaims(visualClaimMode) {
  const claims = ['Do not say "I see" for symbols outside Verified uploaded-image evidence.'];
  if (visualClaimMode !== 'verified_visual_evidence') {
    claims.push('Do not describe uploaded-image details as verified visual evidence.');
  }
  if (visualClaimMode === 'card_level_only') {
    claims.push('Use traditional card meaning and expected Rider symbolism only; keep upload-specific claims out of the reading.');
  }
  return claims;
}

export function buildVisionEvidencePackets(insights = [], cardsInfo = [], deckStyle = 'rws-1909', options = {}) {
  const allowedKeys = drawnKeySet(cardsInfo, deckStyle);
  const { weightedSymbolMatchFloor } = resolveVisionPromptThresholds(options);

  return (Array.isArray(insights) ? insights : [])
    .filter(Boolean)
    .slice(0, 10)
    .map((entry) => {
      const card = canonicalizeCardName(entry.predictedCard || entry.card, deckStyle);
      const cardKey = canonicalCardKey(card, deckStyle);
      const matchesSpread = entry.matchesDrawnCard === true || (cardKey && allowedKeys.has(cardKey));
      const promptEligible = matchesSpread && entry.promptEligible === true;
      const ontology = card ? getRwsCardEvidence(card) : null;
      const evidenceMode = promptEligible ? 'uploaded_image' : 'telemetry_only';
      const visualClaimMode = resolveVisualClaimMode(entry, weightedSymbolMatchFloor);
      const verifiedUploadedEvidence = promptEligible && visualClaimMode === 'verified_visual_evidence'
        ? mapVerifiedSymbols({ ...entry, predictedCard: card })
        : [];
      const uncertainSymbols = mapVisualDetails(entry, verifiedUploadedEvidence);
      const visibleEvidence = verifiedUploadedEvidence.length
        ? [...verifiedUploadedEvidence]
          .filter((item, index, list) => list.findIndex((other) => other.symbol === item.symbol) === index)
          .slice(0, 8)
        : [];

      return {
        label: entry.label || 'uploaded-image',
        card,
        stableId: ontology?.stableId || null,
        deck: 'Rider-Waite-Smith',
        orientation: entry.orientation || null,
        confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
        evidenceMode,
        visualClaimMode,
        cardKnowledge: {
          card,
          stableId: ontology?.stableId || null,
          coreThemes: ontology?.coreThemes || [],
          avoidClaims: ontology?.avoidClaims || []
        },
        expectedRiderSymbols: buildExpectedRiderSymbols(ontology),
        verifiedUploadedEvidence,
        uncertainSymbols,
        forbiddenClaims: buildForbiddenClaims(visualClaimMode),
        visibleEvidence,
        coreThemes: ontology?.coreThemes || [],
        avoidClaims: ontology?.avoidClaims || [],
        symbolMatchRate: typeof entry.symbolVerification?.matchRate === 'number'
          ? entry.symbolVerification.matchRate
          : null,
        weightedSymbolMatchRate: typeof entry.symbolVerification?.weightedMatchRate === 'number'
          ? entry.symbolVerification.weightedMatchRate
          : null,
        highSalienceMissing: Array.isArray(entry.symbolVerification?.highSalienceMissing)
          ? entry.symbolVerification.highSalienceMissing
          : [],
        absentSymbolFalsePositive: Boolean(entry.symbolVerification?.absentSymbolFalsePositive),
        suppressionReason: promptEligible
          ? null
          : (entry.suppressionReason || (matchesSpread ? 'telemetry_only' : 'card_mismatch'))
      };
    });
}
