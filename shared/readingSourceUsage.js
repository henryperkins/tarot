import { MAXIMUM_CARD_COUNT } from './contracts/readingRequestLimits.js';

// A bounded, text-free snapshot for the reading UI and personal journal.
// Do not copy prompts, user text, image URLs or arbitrary telemetry into it.
export const USER_INPUT_KEYS = Object.freeze([
  'question', 'reflections', 'pathA', 'pathB', 'cardReflections', 'callerInterpretations', 'focusAreas', 'displayName',
  'experience', 'tone', 'frame', 'depth'
]);

export const USAGE_REASON_COPY = Object.freeze({
  unverified_reference_provenance: 'Reference provenance could not be verified.',
  projection_rejected: 'References could not be verified for the selected deck.',
  explicit_topic_exclusion: 'This topic was explicitly excluded from reference matching.',
  topic_projection: 'Only relevant parts were used for reference matching.',
  query_budget: 'Excerpted for reference matching; the reading may include more of your note.',
  source_char_limit: 'Shortened for reference matching.',
  duplicate: 'Included once for reference matching.',
  unrelated_to_current_topic: 'Not used for reference matching for this topic.',
  removed_for_budget: 'Left out to keep the reading within its length limit.',
  input_limit: 'Shortened to fit the input limit.',
  sanitized_empty: 'Could not be included after preparing the text.',
  unsupported_value: 'This preference could not be applied.',
  current_context_priority: 'Your current question took priority over saved focus areas.',
  deduped_against_card_reflection: 'Included with your card notes.',
  deduplicated: 'Included once with matching notes.',
  default_profile: 'The standard depth was applied.',
  card_mismatch: 'The uploaded image did not match a card in this reading.',
  no_usable_evidence: 'The image could not be read clearly enough to include.',
  diagnostics_disabled: 'Image details were not included in this reading.',
  not_used_by_backend: 'This reading method did not include this input.',
  disabled_by_request: 'You chose not to use saved memories in this reading.',
  disabled_by_env: 'This additional source was unavailable.',
  retrieval_failed_or_empty: 'No additional reference passages were available.',
  no_patterns_detected: 'No additional reference passages were needed.',
  not_relevant: 'Not needed for this reading.',
  unavailable: 'This source was unavailable.',
  not_requested: 'Not added to this reading.',
  not_provided: 'Not provided for this reading.',
  safe_fallback: 'A general reflection was provided instead.',
  provided_but_not_used: 'This input was not included in the reading.',
  not_used: 'This input was not included in the reading.'
});

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const reasonCode = value => typeof value === 'string' && Object.hasOwn(USAGE_REASON_COPY, value) ? value : 'not_used';
const sourceKeys = ['spreadCards', 'vision', 'userContext', 'graphRAG', 'patterns', 'ephemeris', 'forecast', 'memories'];
const countKeys = ['eligibleUploads', 'telemetryOnlyUploads', 'evidencePacketsUsed', 'passagesProvided', 'passagesUsedInPrompt', 'patternsProvided', 'patternsUsedInPrompt'];
const fieldCounts = ['originalLength', 'sanitizedLength', 'eligibleLength', 'includedLength', 'representedLength'];
const fieldFlags = ['representationTruncated', 'sanitizationChanged', 'sanitizationTruncated', 'limitApplied', 'budgetTruncated', 'omitted', 'representedByDuplicate'];

export const GRAPH_RAG_FALLBACK_REASONS = Object.freeze(['embeddings-failed', 'embeddings-not-configured', 'embeddings-partial-failure', 'embeddings-timeout', 'embeddings-invalid-response', 'embeddings-cancelled', 'embeddings-registry-overflow', 'no-passages', 'no-query', 'quality-filtering-disabled', 'not-prefetched', 'graphrag-disabled', 'no-graph-patterns', 'retrieval-skipped', 'projection-rejected']);
const GRAPH_RAG_COUNT_KEYS = ['registryPassageCount', 'candidatesDiscovered', 'candidatesProjected', 'projectionRejected', 'candidatesScored', 'patternsRepresented', 'variantsRemoved', 'deduplicatedCandidates', 'thresholdRejected', 'finalSelectedCount', 'retainedPassageCount', 'embeddingBatchCount', 'embeddingCacheHits', 'embeddingInputCount', 'embeddingInputCharacters', 'embeddingCacheSizeBefore', 'embeddingCacheSizeAfter', 'embeddingCacheMaxSize', 'embeddingPeakConcurrency', 'retrievalElapsedMs', 'budgetTrimmedTo', 'intermediateBudgetPassageCount'];
const DECK_STYLES = ['rws-1909', 'thoth-a1', 'marseille-classic'];

/** Fixed diagnostics only; missing historical measurements remain absent. */
export function sanitizeGraphRAGDiagnostics(input) {
  if (!isRecord(input)) return {};
  const clean = {};
  for (const key of GRAPH_RAG_COUNT_KEYS) {
    if (Number.isFinite(input[key]) && input[key] >= 0) clean[key] = Math.min(100000000, Math.floor(input[key]));
  }
  if (['disabled', 'bypassed', 'semantic', 'keyword', 'priority'].includes(input.retrievalMode)) clean.retrievalMode = input.retrievalMode;
  if (['keyword', 'semantic', 'priority', 'bypassed', 'mixed'].includes(input.scoringMethod)) clean.scoringMethod = input.scoringMethod;
  if (GRAPH_RAG_FALLBACK_REASONS.includes(input.semanticScoringFallbackReason)) clean.semanticScoringFallbackReason = input.semanticScoringFallbackReason;
  if (['complete', 'partial', 'absent'].includes(input.parseStatus)) clean.parseStatus = input.parseStatus;
  if (DECK_STYLES.includes(input.selectedDeck)) clean.selectedDeck = input.selectedDeck;
  if (Array.isArray(input.sourceDecks)) clean.sourceDecks = [...new Set(input.sourceDecks.filter(deck => DECK_STYLES.includes(deck)))];
  if (isRecord(input.projectionRejectedReasons)) {
    clean.projectionRejectedReasons = {};
    for (const reason of ['unknown_deck', 'unverified_registry_content', 'unverified_matched_subset', 'missing_or_unapproved_meaning_projection', 'projection_unavailable']) {
      const count = input.projectionRejectedReasons[reason];
      if (Number.isFinite(count) && count >= 0) clean.projectionRejectedReasons[reason] = Math.min(100000000, Math.floor(count));
    }
  }
  return clean;
}

function copyCounts(target, input, keys) {
  for (const key of keys) {
    if (Number.isFinite(input[key]) && input[key] >= 0) target[key] = Math.min(100000, Math.floor(input[key]));
  }
}

function copyFlags(target, input, keys) {
  for (const key of keys) {
    if (typeof input[key] === 'boolean') target[key] = input[key];
  }
}

export function sanitizeSourceUsage(value) {
  if (!isRecord(value)) return null;
  const result = {};
  for (const key of sourceKeys) {
    const input = value[key];
    if (!isRecord(input) || typeof input.used !== 'boolean') continue;
    const entry = { used: input.used };
    copyFlags(entry, input, ['requested', 'diagnosticsIncluded', 'cardCuesUsed', 'imageDetailsUsed']);
    if (input.skippedReason !== undefined) entry.skippedReason = input.skippedReason === null ? null : reasonCode(input.skippedReason);
    copyCounts(entry, input, countKeys);
    if (['full', 'summary', 'none'].includes(input.mode)) entry.mode = input.mode;
    if (key === 'memories') {
      for (const [name, cap] of [['candidatesProvided', 100], ['memoriesSelected', 3], ['memoriesUsedInPrompt', 3]]) {
        if (Number.isInteger(input[name]) && input[name] >= 0) entry[name] = Math.min(cap, input[name]);
      }
      if (entry.memoriesSelected !== undefined && entry.memoriesUsedInPrompt !== undefined) entry.memoriesUsedInPrompt = Math.min(entry.memoriesUsedInPrompt, entry.memoriesSelected);
    }
    if (key === 'graphRAG' && Array.isArray(input.passageIndices)) {
      entry.passageIndices = [...new Set(input.passageIndices
        .filter(index => Number.isInteger(index) && index >= 0 && index < 100))].slice(0, 30);
    }
    if (key === 'graphRAG') Object.assign(entry, sanitizeGraphRAGDiagnostics(input));
    if (key === 'userContext') {
      copyFlags(entry, input, USER_INPUT_KEYS.flatMap(name => [`${name}Provided`, `${name}Used`]));
      for (const list of ['usedInputs', 'providedInputs']) {
        if (Array.isArray(input[list])) entry[list] = [...new Set(input[list].filter(name => USER_INPUT_KEYS.includes(name)))];
      }
      if (isRecord(input.skippedInputs)) {
        entry.skippedInputs = Object.fromEntries(USER_INPUT_KEYS
          .filter(name => Object.hasOwn(input.skippedInputs, name))
          .map(name => [name, reasonCode(input.skippedInputs[name])]));
      }
      if (isRecord(input.fields)) {
        entry.fields = {};
        for (const name of ['question', 'reflections', 'pathA', 'pathB', ...Array.from({ length: MAXIMUM_CARD_COUNT }, (_, index) => `card-${index}`), ...Array.from({ length: MAXIMUM_CARD_COUNT }, (_, index) => `interpretation-${index}`)]) {
          const field = input.fields[name];
          if (!isRecord(field)) continue;
          const clean = {};
          copyCounts(clean, field, fieldCounts);
          copyFlags(clean, field, fieldFlags);
          if (field.reason != null) clean.reason = reasonCode(field.reason);
          entry.fields[name] = clean;
        }
      }
    }
    result[key] = entry;
  }
  return Object.keys(result).length ? result : null;
}

// Retrieval coverage describes a bounded query excerpt, separately from final
// narrative inclusion. Only fixed field identities may cross this boundary.
export function sanitizeQueryCoverage(value) {
  if (!Array.isArray(value)) return [];
  const known = new Set(['question', 'reflections', 'pathA', 'pathB', ...Array.from({ length: MAXIMUM_CARD_COUNT }, (_, i) => `card-${i}`), ...Array.from({ length: 12 }, (_, i) => `focus-${i}`)]);
  const seen = new Set();
  return value.flatMap(field => {
    if (!isRecord(field) || !known.has(field.id) || seen.has(field.id)) return [];
    seen.add(field.id);
    const entry = { id: field.id };
    copyCounts(entry, field, ['originalLength', 'sanitizedLength', 'classifiedLength', 'eligibleLength', 'topicEligibleLength', 'includedLength']);
    copyFlags(entry, field, ['included', 'truncated', 'mixed']);
    if (['keyword', 'limited'].includes(field.classificationSupport)) entry.classificationSupport = field.classificationSupport;
    if (Object.hasOwn(field, 'reason')) entry.reason = field.reason === null ? null : reasonCode(field.reason);
    return [entry];
  });
}

/** Text-free projection of a private server context decision. */
export function sanitizeContextSelection(value) {
  if (!isRecord(value) || value.version !== 1) return null;
  const contexts = ['general', 'love', 'career', 'self', 'spiritual', 'wellbeing', 'decision', 'relationship'];
  const graphContexts = ['general', 'grief', 'relationship', 'career', 'health', 'spiritual', 'transition', 'shadow', 'creative', 'manifestation', 'personal', 'leadership', 'parenting', 'legal', 'calling', 'boundaries', 'clarity', 'acceptance', 'values', 'life-cycle'];
  const sources = ['question', 'reflections', 'decisionPaths', 'focusAreas', 'spread', 'none'];
  const ids = new Set(['question', 'reflections', 'pathA', 'pathB', ...Array.from({ length: MAXIMUM_CARD_COUNT }, (_, i) => `card-${i}`), ...Array.from({ length: 12 }, (_, i) => `focus-${i}`)]);
  return {
    version: 1,
    context: contexts.includes(value.context) ? value.context : 'general',
    graphRAGContext: graphContexts.includes(value.graphRAGContext) ? value.graphRAGContext : 'general',
    source: sources.includes(value.source) ? value.source : 'none',
    clarifiedBy: sources.includes(value.clarifiedBy) ? value.clarifiedBy : null,
    selectedSourceIds: Array.isArray(value.selectedSourceIds) ? [...new Set(value.selectedSourceIds.filter(id => ids.has(id)))] : []
  };
}
