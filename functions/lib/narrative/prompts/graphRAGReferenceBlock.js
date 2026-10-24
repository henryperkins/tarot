import { projectPassageForDeck } from '../../graphRAGProjection.js';
import { collectPassageCandidates } from '../../graphRAGCandidates.js';
import { summarizeProjectedPatterns } from '../../graphRAGPatternSummary.js';
import {
  formatPassagesForPrompt,
  getPassageCountForSpread,
  isGraphRAGEnabled
} from '../../graphRAG.js';
import {
  GRAPHRAG_FULL_START_MARKER,
  GRAPHRAG_FULL_END_MARKER,
  GRAPHRAG_SUMMARY_START_MARKER,
  GRAPHRAG_SUMMARY_END_MARKER,
  GRAPHRAG_FULL_HEADER,
  GRAPHRAG_SUMMARY_HEADER,
  GRAPHRAG_FULL_SECURITY_NOTE,
  GRAPHRAG_FULL_ATTRIBUTION_NOTE,
  GRAPHRAG_FULL_CARD_GUARDRAIL,
  GRAPHRAG_PARTIAL_PATTERN_GUARDRAIL,
  GRAPHRAG_WEAK_MATCH_GUARDRAIL,
  GRAPHRAG_SUMMARY_INTRO_NOTE,
  GRAPHRAG_SUMMARY_SECURITY_NOTE,
  GRAPHRAG_SUMMARY_CARD_GUARDRAIL,
  neutralizeReferenceDelimiters
} from './graphRAGPromptIntegrity.js';

// Only registry-backed graph patterns can establish summary facts. Payload
// retrieval summaries and nominal scores carry no authority to supply prose.
function summarizeDetectedPatterns(graphKeys, deckStyle) {
  const candidates = collectPassageCandidates(graphKeys, { deckStyle });
  return summarizeProjectedPatterns(candidates).segments;
}

function buildGraphRAGSummaryBlock(graphKeys, deckStyle) {
  const patternSegments = summarizeDetectedPatterns(graphKeys, deckStyle);
  if (!patternSegments.length) return '';
  return [
    GRAPHRAG_SUMMARY_START_MARKER,
    GRAPHRAG_SUMMARY_HEADER,
    GRAPHRAG_SUMMARY_INTRO_NOTE,
    GRAPHRAG_SUMMARY_SECURITY_NOTE,
    `Signals: ${neutralizeReferenceDelimiters(patternSegments.join('; '))}`,
    GRAPHRAG_SUMMARY_CARD_GUARDRAIL,
    GRAPHRAG_SUMMARY_END_MARKER
  ].join('\n');
}

export function buildGraphRAGReferenceBlock(spreadKey, themes, options = {}) {
  const includeGraphRAG = options.includeGraphRAG !== false;
  const includeGraphRAGSummaryOnly = options.graphRAGSummaryOnly === true;
  if (!includeGraphRAG && !includeGraphRAGSummaryOnly) {
    return '';
  }

  const graphKeys = themes?.knowledgeGraph?.graphKeys;
  const hasGraphKeys =
    graphKeys &&
    typeof graphKeys === 'object' &&
    Object.keys(graphKeys).length > 0;
  const payload = options.graphRAGPayload || themes?.knowledgeGraph?.graphRAGPayload || null;

  // Allow payload-driven GraphRAG injection even when graphKeys are absent.
  if (!payload && !hasGraphKeys) {
    return '';
  }

  const envForGraphBlock = options.env ?? (typeof process !== 'undefined' ? process.env : {});
  const graphragAllowed = isGraphRAGEnabled(envForGraphBlock) || (!options.env && (Boolean(payload) || Boolean(hasGraphKeys)));
  if (!graphragAllowed) {
    return '';
  }

  try {
    if (includeGraphRAGSummaryOnly) {
      return buildGraphRAGSummaryBlock(graphKeys, options.deckStyle || themes?.deckStyle || 'rws-1909');
    }

    let retrievedPassages = Array.isArray(payload?.passages) && payload.passages.length
      ? payload.passages.map((passage) => projectPassageForDeck(passage, options.deckStyle || themes?.deckStyle || 'rws-1909', { cardsInfo: options.cardsInfo })).filter(Boolean)
      : null;
    let formattedPassages = null;

    if (retrievedPassages && retrievedPassages.length > 0) {
      const effectiveSpreadKey = spreadKey || 'general';
      const maxPassages = payload?.maxPassages ?? getPassageCountForSpread(effectiveSpreadKey, options.subscriptionTier);
      if (!Number.isInteger(maxPassages) || maxPassages <= 0) return '';

      if (retrievedPassages.length > maxPassages) {
        retrievedPassages = retrievedPassages.slice(0, maxPassages);
      }

      const hasRelevanceScores = retrievedPassages.some((passage) => typeof passage.relevanceScore === 'number');
      if (hasRelevanceScores) {
        const avgRelevance = retrievedPassages.reduce((sum, passage) => sum + (passage.relevanceScore || 0), 0) / retrievedPassages.length;
        console.log(`[GraphRAG] Injecting ${retrievedPassages.length} passages (avg relevance: ${(avgRelevance * 100).toFixed(1)}%)`);
      }

      formattedPassages = formatPassagesForPrompt(retrievedPassages, {
        deckStyle: options.deckStyle || themes?.deckStyle || 'rws-1909',
        includeSource: true,
        markdown: true
      });
    } else if (typeof payload?.formattedBlock === 'string' && payload.formattedBlock.trim()) {
      // Opaque historical quotes remain displayable, but cannot establish prompt provenance.
      return buildGraphRAGSummaryBlock(graphKeys, options.deckStyle || themes?.deckStyle || 'rws-1909');
    }

    formattedPassages = neutralizeReferenceDelimiters(formattedPassages);

    if (!formattedPassages) {
      return '';
    }

    const hasPartialPattern = Array.isArray(retrievedPassages) &&
      retrievedPassages.some((passage) => passage?.isPartialPattern === true);
    const hasWeakQuestionMatch = Array.isArray(retrievedPassages) &&
      retrievedPassages.some((passage) => passage?.belowRelevanceThreshold === true);

    return [
      GRAPHRAG_FULL_START_MARKER,
      GRAPHRAG_FULL_HEADER,
      GRAPHRAG_FULL_SECURITY_NOTE,
      '<reference>',
      formattedPassages,
      '</reference>',
      GRAPHRAG_FULL_ATTRIBUTION_NOTE,
      GRAPHRAG_FULL_CARD_GUARDRAIL,
      ...(hasPartialPattern
        ? [GRAPHRAG_PARTIAL_PATTERN_GUARDRAIL]
        : []),
      ...(hasWeakQuestionMatch
        ? [GRAPHRAG_WEAK_MATCH_GUARDRAIL]
        : []),
      GRAPHRAG_FULL_END_MARKER
    ].join('\n');
  } catch (err) {
    // GraphRAG failure should not break readings; log and continue
    console.error('[GraphRAG] Passage injection failed:', err.message);
    return '';
  }
}
