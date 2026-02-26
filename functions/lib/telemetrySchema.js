/**
 * Telemetry Schema Module
 *
 * Defines the canonical structure for reading metrics payloads.
 * Eliminates data duplication by providing a single source of truth
 * for each piece of telemetry data.
 *
 * Schema Version History:
 * - v1: Original structure with duplicated fields (implicit, no version field)
 * - v2: Deduplicated structure with logical groupings
 */

export const SCHEMA_VERSION = 2;

/**
 * Build the prompt telemetry section from promptMeta.
 *
 * @param {Object} promptMeta - Raw promptMeta from buildEnhancedClaudePrompt
 * @returns {Object|null} Normalized prompt telemetry
 */
export function buildPromptTelemetry(promptMeta) {
  if (!promptMeta) return null;

  const normalizeTruncation = (truncation) => {
    if (!truncation || typeof truncation !== 'object') return null;

    const normalizeField = (field) => {
      if (!field || typeof field !== 'object') return { truncated: false };
      const normalized = { truncated: Boolean(field.truncated) };
      if (Number.isFinite(field.originalLength)) normalized.originalLength = field.originalLength;
      if (Number.isFinite(field.finalLength)) normalized.finalLength = field.finalLength;
      return normalized;
    };

    const normalized = {};
    if (truncation.question !== undefined) normalized.question = normalizeField(truncation.question);
    if (truncation.reading !== undefined) normalized.reading = normalizeField(truncation.reading);
    if (truncation.cards !== undefined) normalized.cards = normalizeField(truncation.cards);

    return Object.keys(normalized).length > 0 ? normalized : null;
  };

  const truncation = normalizeTruncation(promptMeta.truncation || promptMeta.truncationDetails || null);

  // Note: prompt.version removed - use experiment.promptVersion (single source of truth)
  // Note: prompt.tokens.truncated removed - use prompt.truncation !== null (single source of truth)
  // Note: prompt.options.includeGraphRAG removed - use graphRAG.includedInPrompt (single source of truth)
  return {
    tokens: promptMeta.estimatedTokens ? {
      system: promptMeta.estimatedTokens.system,
      user: promptMeta.estimatedTokens.user,
      total: promptMeta.estimatedTokens.total,
      budget: promptMeta.estimatedTokens.budget,
      hardCap: promptMeta.estimatedTokens.hardCap,
      budgetTarget: promptMeta.estimatedTokens.budgetTarget,
      overBudget: promptMeta.estimatedTokens.overBudget || false
    } : null,
    slimming: {
      enabled: promptMeta.slimmingEnabled || false,
      steps: promptMeta.slimmingSteps || []
    },
    options: promptMeta.appliedOptions ? {
      omitLowWeightImagery: promptMeta.appliedOptions.omitLowWeightImagery || false,
      includeForecast: promptMeta.appliedOptions.includeForecast || false,
      includeEphemeris: promptMeta.appliedOptions.includeEphemeris || false,
      includeDeckContext: promptMeta.appliedOptions.includeDeckContext || false,
      includeDiagnostics: promptMeta.appliedOptions.includeDiagnostics || false
    } : null,
    truncation,
    hardCap: promptMeta.hardCap || null,
    context: promptMeta.context || null,
    sourceUsage: promptMeta.sourceUsage || null,
    ephemeris: promptMeta.ephemeris || null,
    forecast: promptMeta.forecast || null
  };
}

/**
 * Build the GraphRAG telemetry section.
 * Single source of truth - no more 4x duplication.
 *
 * @param {Object} graphRAGStats - Resolved GraphRAG stats
 * @returns {Object|null} Normalized GraphRAG telemetry
 */
export function buildGraphRAGTelemetry(graphRAGStats) {
  if (!graphRAGStats) return null;

  const numberOrDefault = (value, fallback = 0) =>
    typeof value === 'number' ? value : fallback;
  const optionalNumber = (value) =>
    typeof value === 'number' ? value : null;
  const optionalBoolean = (value) =>
    typeof value === 'boolean' ? value : null;

  return {
    includedInPrompt: graphRAGStats.includedInPrompt || false,
    disabledByEnv: graphRAGStats.disabledByEnv || false,
    passagesProvided: numberOrDefault(graphRAGStats.passagesProvided, 0),
    passagesUsedInPrompt: optionalNumber(graphRAGStats.passagesUsedInPrompt),
    truncatedPassages: optionalNumber(graphRAGStats.truncatedPassages),
    parseStatus: graphRAGStats.parseStatus || null,
    referenceBlockClosed: optionalBoolean(graphRAGStats.referenceBlockClosed),
    skippedReason: graphRAGStats.skippedReason || null,
    semanticScoring: {
      requested: graphRAGStats.semanticScoringRequested || false,
      used: graphRAGStats.semanticScoringUsed || false,
      attempted: graphRAGStats.semanticScoringAttempted || false,
      fallback: graphRAGStats.semanticScoringFallback || false
    },
    patterns: graphRAGStats.patternsDetected ? {
      completeTriads: graphRAGStats.patternsDetected.completeTriads || 0,
      partialTriads: graphRAGStats.patternsDetected.partialTriads || 0,
      foolsJourneyStage: graphRAGStats.patternsDetected.foolsJourneyStage || null,
      totalMajors: graphRAGStats.patternsDetected.totalMajors || 0,
      highDyads: graphRAGStats.patternsDetected.highDyads || 0,
      mediumHighDyads: graphRAGStats.patternsDetected.mediumHighDyads || 0,
      strongSuitProgressions: graphRAGStats.patternsDetected.strongSuitProgressions || 0,
      emergingSuitProgressions: graphRAGStats.patternsDetected.emergingSuitProgressions || 0
    } : null,
    budgetTrimming: graphRAGStats.truncatedForBudget ? {
      trimmed: true,
      from: graphRAGStats.budgetTrimmedFrom,
      to: graphRAGStats.budgetTrimmedTo,
      strategy: graphRAGStats.budgetTrimmedStrategy || null
    } : null
  };
}

/**
 * Build the narrative quality telemetry section.
 * Contains only spine validation and card coverage - no duplicated fields.
 *
 * @param {Object} narrativeMetrics - Raw narrative metrics
 * @returns {Object} Normalized narrative telemetry
 */
export function buildNarrativeTelemetry(narrativeMetrics) {
  if (!narrativeMetrics) {
    return {
      spine: null,
      coverage: null
    };
  }

  return {
    spine: narrativeMetrics.spine ? {
      isValid: narrativeMetrics.spine.isValid,
      totalSections: narrativeMetrics.spine.totalSections || 0,
      completeSections: narrativeMetrics.spine.completeSections || 0,
      incompleteSections: narrativeMetrics.spine.incompleteSections || 0,
      cardSections: narrativeMetrics.spine.cardSections || 0,
      cardComplete: narrativeMetrics.spine.cardComplete || 0,
      cardIncomplete: narrativeMetrics.spine.cardIncomplete || 0,
      structuralSections: narrativeMetrics.spine.structuralSections || 0,
      suggestions: narrativeMetrics.spine.suggestions || []
    } : null,
    coverage: {
      cardCount: narrativeMetrics.cardCount || 0,
      percentage: narrativeMetrics.cardCoverage || 0,
      missingCards: narrativeMetrics.missingCards || [],
      hallucinatedCards: narrativeMetrics.hallucinatedCards || []
    }
  };
}

/**
 * Build the experiment tracking section.
 *
 * @param {Object} promptMeta - Prompt metadata
 * @param {Object} abAssignment - A/B test assignment
 * @returns {Object} Experiment telemetry
 */
export function buildExperimentTelemetry(promptMeta, abAssignment) {
  return {
    promptVersion: promptMeta?.readingPromptVersion || null,
    variantId: abAssignment?.variantId || null,
    experimentId: abAssignment?.experimentId || null
  };
}

/**
 * Build the LLM usage telemetry section.
 *
 * @param {Object} capturedUsage - Usage from API response
 * @returns {Object|null} LLM usage telemetry
 */
export function buildLLMUsageTelemetry(capturedUsage) {
  if (!capturedUsage) return null;

  return {
    inputTokens: capturedUsage.input_tokens,
    outputTokens: capturedUsage.output_tokens,
    totalTokens: capturedUsage.total_tokens || (capturedUsage.input_tokens + capturedUsage.output_tokens),
    source: 'api'
  };
}

/**
 * Build the evaluation gate telemetry section.
 *
 * @param {Object} evalGateResult - Evaluation gate result
 * @param {boolean} wasGateBlocked - Whether gate blocked the response
 * @returns {Object} Eval gate telemetry
 */
export function buildEvalGateTelemetry(evalGateResult, wasGateBlocked) {
  if (!evalGateResult) {
    return { ran: false };
  }

  const reason = evalGateResult.gateResult?.reason || evalGateResult.reason || null;
  const reasons = evalGateResult.gateResult?.reasons || evalGateResult.reasons || (reason ? [reason] : []);
  const evalSource = evalGateResult.eval_source || evalGateResult.evalSource || null;
  const thresholdsSnapshot = evalGateResult.thresholds_snapshot || evalGateResult.thresholdsSnapshot || null;
  const deterministicOverrides = evalGateResult.evalResult?.deterministic_overrides || evalGateResult.deterministic_overrides || null;
  const heuristicTriggers = evalGateResult.evalResult?.heuristic_triggers || evalGateResult.heuristic_triggers || null;

  return {
    ran: true,
    passed: evalGateResult.passed,
    reason,
    reasons,
    eval_source: evalSource,
    thresholds_snapshot: thresholdsSnapshot,
    heuristic_triggers: heuristicTriggers,
    deterministic_overrides: deterministicOverrides,
    latencyMs: evalGateResult.latencyMs ?? null,
    blocked: wasGateBlocked || false
  };
}

/**
 * Build the complete metrics payload with schema version 2.
 * Single source of truth for all telemetry data.
 *
 * @param {Object} params - All telemetry inputs
 * @returns {Object} Complete metrics payload
 */
export function buildMetricsPayload({
  requestId,
  timestamp,
  provider,
  spreadKey,
  deckStyle,
  promptMeta,
  graphRAGStats,
  narrativeMetrics,
  visionMetrics,
  abAssignment,
  capturedUsage,
  evalGateResult,
  wasGateBlocked,
  backendErrors,
  enhancementTelemetry,
  diagnostics
}) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    requestId,
    timestamp,

    // Routing (context removed - use prompt.context instead)
    provider,
    spreadKey,
    deckStyle,

    // Experiment tracking (single source for promptVersion)
    experiment: buildExperimentTelemetry(promptMeta, abAssignment),

    // Prompt construction telemetry
    prompt: buildPromptTelemetry(promptMeta),

    // GraphRAG (single source - includedInPrompt is the authoritative flag)
    graphRAG: buildGraphRAGTelemetry(graphRAGStats),

    // Narrative quality (spine + coverage only)
    narrative: buildNarrativeTelemetry(narrativeMetrics),

    // Vision metrics (if applicable)
    vision: visionMetrics || null,

    // LLM usage from API
    llmUsage: buildLLMUsageTelemetry(capturedUsage),

    // Diagnostics
    diagnostics: diagnostics ? {
      messages: diagnostics.messages || diagnostics,
      count: Array.isArray(diagnostics.messages) ? diagnostics.messages.length : (Array.isArray(diagnostics) ? diagnostics.length : 0)
    } : null,

    // Evaluation gate
    evalGate: buildEvalGateTelemetry(evalGateResult, wasGateBlocked)
  };

  // Conditional fields
  if (backendErrors && backendErrors.length > 0) {
    payload.backendErrors = backendErrors;
  }

  if (enhancementTelemetry) {
    payload.enhancementTelemetry = enhancementTelemetry;
  }

  return payload;
}

// ============================================================================
// Backward Compatibility Helpers
// ============================================================================

/**
 * Get GraphRAG stats from a payload, handling both schema versions.
 *
 * @param {Object} payload - Metrics payload (v1 or v2)
 * @returns {Object|null} GraphRAG stats
 */
export function getGraphRAGStats(payload) {
  if (!payload) return null;

  // v2: direct access
  if (payload.schemaVersion >= 2) {
    return payload.graphRAG;
  }

  // v1 fallback: try multiple locations
  return payload.promptMeta?.graphRAG ||
    payload.graphRAG ||
    payload.narrative?.graphRAG ||
    null;
}

/**
 * Get prompt version from a payload, handling both schema versions.
 *
 * @param {Object} payload - Metrics payload (v1 or v2)
 * @returns {string|null} Prompt version
 */
export function getPromptVersion(payload) {
  if (!payload) return null;

  // v2: direct access
  if (payload.schemaVersion >= 2) {
    return payload.experiment?.promptVersion;
  }

  // v1 fallback
  return payload.readingPromptVersion ||
    payload.promptMeta?.readingPromptVersion ||
    null;
}

/**
 * Get token estimates from a payload, handling both schema versions.
 *
 * @param {Object} payload - Metrics payload (v1 or v2)
 * @returns {Object|null} Token estimates
 */
export function getTokenEstimates(payload) {
  if (!payload) return null;

  // v2: direct access
  if (payload.schemaVersion >= 2) {
    return payload.prompt?.tokens;
  }

  // v1 fallback
  return payload.promptMeta?.estimatedTokens ||
    payload.narrative?.promptTokens ||
    null;
}

/**
 * Get slimming steps from a payload, handling both schema versions.
 *
 * @param {Object} payload - Metrics payload (v1 or v2)
 * @returns {Array} Slimming steps
 */
export function getSlimmingSteps(payload) {
  if (!payload) return [];

  // v2: direct access
  if (payload.schemaVersion >= 2) {
    return payload.prompt?.slimming?.steps || [];
  }

  // v1 fallback
  return payload.promptMeta?.slimmingSteps ||
    payload.narrative?.promptSlimming ||
    [];
}

/**
 * Get narrative coverage from a payload, handling both schema versions.
 *
 * @param {Object} payload - Metrics payload (v1 or v2)
 * @returns {Object|null} Coverage data
 */
export function getNarrativeCoverage(payload) {
  if (!payload) return null;

  // v2: direct access
  if (payload.schemaVersion >= 2) {
    return payload.narrative?.coverage;
  }

  // v1 fallback
  const narrative = payload.narrativeOriginal || payload.narrative;
  if (!narrative) return null;

  return {
    cardCount: narrative.cardCount,
    percentage: narrative.cardCoverage,
    missingCards: narrative.missingCards,
    hallucinatedCards: narrative.hallucinatedCards
  };
}

/**
 * Check if a payload uses the new schema.
 *
 * @param {Object} payload - Metrics payload
 * @returns {boolean} True if v2 schema
 */
export function isSchemaV2(payload) {
  return payload?.schemaVersion >= 2;
}

// ============================================================================
// Migration Helper
// ============================================================================

/**
 * Transform a v1 payload to v2 schema.
 * Used for historical data migration.
 *
 * @param {Object} v1Payload - Original v1 payload
 * @returns {Object} Transformed v2 payload
 */
export function migratePayloadToV2(v1Payload) {
  if (!v1Payload) return null;

  // Already v2
  if (v1Payload.schemaVersion >= 2) {
    return v1Payload;
  }

  // Extract data from v1 locations
  const promptMeta = v1Payload.promptMeta || {};
  const graphRAGStats = v1Payload.promptMeta?.graphRAG ||
    v1Payload.graphRAG ||
    v1Payload.narrative?.graphRAG ||
    null;
  const narrativeMetrics = v1Payload.narrativeOriginal || v1Payload.narrative || {};

  return {
    schemaVersion: SCHEMA_VERSION,
    requestId: v1Payload.requestId,
    timestamp: v1Payload.timestamp,

    // Routing (context moved to prompt.context)
    provider: v1Payload.provider,
    spreadKey: v1Payload.spreadKey,
    deckStyle: v1Payload.deckStyle,

    // Experiment
    experiment: {
      promptVersion: v1Payload.readingPromptVersion || promptMeta.readingPromptVersion || null,
      variantId: v1Payload.variantId || null,
      experimentId: v1Payload.experimentId || null
    },

    // Prompt
    prompt: buildPromptTelemetry(promptMeta),

    // GraphRAG (deduplicated)
    graphRAG: buildGraphRAGTelemetry(graphRAGStats),

    // Narrative (cleaned)
    narrative: buildNarrativeTelemetry(narrativeMetrics),

    // Vision (passthrough)
    vision: v1Payload.vision || null,

    // LLM Usage
    llmUsage: v1Payload.llmUsage || (v1Payload.tokens ? {
      inputTokens: v1Payload.tokens.input,
      outputTokens: v1Payload.tokens.output,
      totalTokens: v1Payload.tokens.total,
      source: v1Payload.tokens.source || 'api'
    } : null),

    // Diagnostics
    diagnostics: v1Payload.contextDiagnostics || null,

    // Eval gate
    evalGate: v1Payload.evalGate || { ran: false },

    // Conditional
    ...(v1Payload.backendErrors?.length > 0 ? { backendErrors: v1Payload.backendErrors } : {}),
    ...(v1Payload.enhancementTelemetry ? { enhancementTelemetry: v1Payload.enhancementTelemetry } : {})
  };
}
