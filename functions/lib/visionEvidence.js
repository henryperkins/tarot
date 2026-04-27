import {
  getRwsCardEvidence,
  getRwsSymbolEvidence,
  normalizeRwsSymbolName
} from '../../shared/vision/rwsEvidenceOntology.js';
import { canonicalCardKey, canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
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
        label: ontology?.label || match.object,
        location: ontology?.location || match.expectedPosition || null,
        literalObservation: ontology?.literalObservation || `${match.object} was detected in the uploaded image.`,
        symbolicMeaning: ontology?.symbolicMeaning || [],
        detectorConfidence: typeof match.confidence === 'number' ? match.confidence : null
      };
    });
}

function mapVisualDetails(entry) {
  return (entry.visualDetails || [])
    .map(sanitizeDetail)
    .filter(Boolean)
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

export function buildVisionEvidencePackets(insights = [], cardsInfo = [], deckStyle = 'rws-1909') {
  const allowedKeys = drawnKeySet(cardsInfo, deckStyle);
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
      const visibleEvidence = promptEligible
        ? [...mapVerifiedSymbols({ ...entry, predictedCard: card }), ...mapVisualDetails(entry)]
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
        visibleEvidence,
        coreThemes: ontology?.coreThemes || [],
        avoidClaims: ontology?.avoidClaims || [],
        symbolMatchRate: typeof entry.symbolVerification?.matchRate === 'number'
          ? entry.symbolVerification.matchRate
          : null,
        suppressionReason: promptEligible ? null : (entry.suppressionReason || (matchesSpread ? 'telemetry_only' : 'card_mismatch'))
      };
    });
}
