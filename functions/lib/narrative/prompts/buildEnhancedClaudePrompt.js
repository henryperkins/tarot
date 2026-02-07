import { normalizeContext } from '../helpers.js';
import {
  buildRetrievalSummary,
  getPassageCountForSpread,
  isGraphRAGEnabled,
  rankPassagesForPrompt,
  retrievePassages
} from '../../graphRAG.js';
import { inferGraphRAGContext } from '../../contextDetection.js';
import { getReadingPromptVersion } from '../../promptVersioning.js';
import { getSpreadKey } from '../../readingQuality.js';
import { shouldIncludeAstroInsights } from './astro.js';
import { DEFAULT_REVERSAL_DESCRIPTION } from './constants.js';
import { estimateTokenCount, getHardCapBudget, getPromptBudgetForTarget } from './budgeting.js';
import { truncateSystemPromptSafely, truncateToTokenBudget, truncateUserPromptSafely } from './truncation.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { buildUserPrompt } from './userPrompt.js';

function resolveDeckStyle({ deckStyle, spreadInfo, themes, cardsInfo, diagnostics = [] }) {
  const candidates = [];

  const addCandidate = (value, source) => {
    if (value) {
      candidates.push({ value, source });
    }
  };

  addCandidate(themes?.deckStyle, 'themes');
  addCandidate(spreadInfo?.deckStyle, 'spreadInfo');
  addCandidate(deckStyle, 'options');
  addCandidate(cardsInfo?.find((c) => c?.deckStyle)?.deckStyle, 'cards');

  const resolved = candidates.length > 0 ? candidates[0].value : 'rws-1909';
  const uniqueValues = Array.from(new Set(candidates.map((c) => c.value)));

  if (uniqueValues.length > 1) {
    diagnostics.push(
      `[deck-style] Conflicting deckStyle values (${candidates.map((c) => `${c.source}:${c.value}`).join(', ')}). Using "${resolved}".`
    );
  }

  return resolved;
}

function resolveGraphEnv(promptBudgetEnv) {
  if (!promptBudgetEnv || typeof promptBudgetEnv !== 'object') {
    return null;
  }
  const hasGraphRAGFlag =
    Object.prototype.hasOwnProperty.call(promptBudgetEnv, 'GRAPHRAG_ENABLED') ||
    Object.prototype.hasOwnProperty.call(promptBudgetEnv, 'KNOWLEDGE_GRAPH_ENABLED');
  return hasGraphRAGFlag ? promptBudgetEnv : null;
}

function readBooleanFlag(value) {
  if (value === true || value === false) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return null;
}

export function countGraphRAGPassagesInPrompt(promptText) {
  const parsed = parseGraphRAGReferenceBlock(promptText);
  if (parsed.status !== 'complete') {
    return 0;
  }
  return parsed.passageCount;
}

export function parseGraphRAGReferenceBlock(promptText) {
  if (!promptText || typeof promptText !== 'string') {
    return {
      status: 'absent',
      headerPresent: false,
      referenceTagPresent: false,
      referenceBlockClosed: false,
      passageCount: 0
    };
  }

  const header = '## TRADITIONAL WISDOM (GraphRAG)';
  const headerIdx = promptText.indexOf(header);
  if (headerIdx === -1) {
    return {
      status: 'absent',
      headerPresent: false,
      referenceTagPresent: false,
      referenceBlockClosed: false,
      passageCount: 0
    };
  }

  const referenceStart = promptText.indexOf('<reference>', headerIdx);
  if (referenceStart === -1) {
    return {
      status: 'partial',
      headerPresent: true,
      referenceTagPresent: false,
      referenceBlockClosed: false,
      passageCount: 0
    };
  }

  const contentStart = referenceStart + '<reference>'.length;
  const referenceEnd = promptText.indexOf('</reference>', contentStart);
  const referenceBlockClosed = referenceEnd !== -1;
  const referenceBody = referenceEnd === -1
    ? promptText.slice(contentStart)
    : promptText.slice(contentStart, referenceEnd);

  if (!referenceBody) {
    return {
      status: referenceBlockClosed ? 'complete' : 'partial',
      headerPresent: true,
      referenceTagPresent: true,
      referenceBlockClosed,
      passageCount: 0
    };
  }

  const passageCount = referenceBody
    .split('\n')
    .filter((line) => /^\s*\d+\.\s+/.test(line.trim()))
    .length;

  return {
    status: referenceBlockClosed ? 'complete' : 'partial',
    headerPresent: true,
    referenceTagPresent: true,
    referenceBlockClosed,
    passageCount
  };
}

export function buildEnhancedClaudePrompt({
  spreadInfo,
  cardsInfo,
  userQuestion,
  reflectionsText,
  themes,
  spreadAnalysis,
  context,
  visionInsights,
  deckStyle = 'rws-1909',
  graphRAGPayload = null,
  ephemerisContext = null,
  ephemerisForecast = null,
  transitResonances = [],
  budgetTarget = 'claude',
  contextDiagnostics = [],
  promptBudgetEnv = null,
  personalization = null,
  enableSemanticScoring = null,
  subscriptionTier = null,
  variantOverrides = null
}) {
  // Fast guard: validate cardsInfo before branching into spread-specific builders.
  // Without this, callers receive unhelpful TypeErrors deep in spread builders
  // (e.g., "Cannot read properties of undefined (reading '0')").
  if (!Array.isArray(cardsInfo) || cardsInfo.length === 0) {
    const received = cardsInfo === null ? 'null' : cardsInfo === undefined ? 'undefined' : `${typeof cardsInfo} (length: ${cardsInfo?.length ?? 'N/A'})`;
    throw new TypeError(
      `buildEnhancedClaudePrompt: cardsInfo must be a non-empty array of card objects. Received: ${received}. ` +
      `Ensure payload validation (e.g., validatePayload()) runs before calling this function.`
    );
  }

  const baseThemes = typeof themes === 'object' && themes !== null ? themes : {};
  const activeThemes = baseThemes.reversalDescription
    ? { ...baseThemes }
    : { ...baseThemes, reversalDescription: { ...DEFAULT_REVERSAL_DESCRIPTION } };

  const spreadKey = getSpreadKey(spreadInfo?.name, spreadInfo?.key);
  const diagnostics = Array.isArray(contextDiagnostics) ? contextDiagnostics : [];

  const normalizedContextValue = normalizeContext(context, {
    onUnknown: (message) => diagnostics.push(message),
    allowFallback: true,
    fallback: 'general'
  });
  const normalizedContext = normalizedContextValue || 'general';
  const contextFallbackApplied =
    Boolean(context) &&
    normalizedContextValue !== null &&
    normalizedContextValue !== (typeof context === 'string' ? context.trim().toLowerCase() : context);

  const resolvedDeckStyle = resolveDeckStyle({
    deckStyle,
    spreadInfo,
    themes: activeThemes,
    cardsInfo,
    diagnostics
  });
  if (!activeThemes.deckStyle && resolvedDeckStyle) {
    activeThemes.deckStyle = resolvedDeckStyle;
  }

  const promptBudget = getPromptBudgetForTarget(budgetTarget, { env: promptBudgetEnv });

  // Determine if astro context is relevant enough to surface
  // Pass ephemeris context for moon phase weighting in relevance scoring
  const astroRelevant = shouldIncludeAstroInsights(cardsInfo, activeThemes, userQuestion, ephemerisContext);
  const astroContext = astroRelevant ? ephemerisContext : null;
  const astroForecast = astroRelevant ? ephemerisForecast : null;
  const astroTransits = astroRelevant ? transitResonances : [];

  // Pre-fetch GraphRAG payload if not already provided
  // This ensures a single retrieval even across slimming passes
  let effectiveGraphRAGPayload =
    graphRAGPayload ||
    activeThemes?.knowledgeGraph?.graphRAGPayload ||
    null;
  let graphRAGInjectionDisabled = false;
  const graphEnv = resolveGraphEnv(promptBudgetEnv);
  if (!effectiveGraphRAGPayload && isGraphRAGEnabled(graphEnv) && activeThemes?.knowledgeGraph?.graphKeys) {
    const effectiveSpreadKey = spreadKey || 'general';
    const maxPassages = getPassageCountForSpread(effectiveSpreadKey, subscriptionTier);
    const questionContext = inferGraphRAGContext(userQuestion, spreadKey);

    // Check if semantic scoring was requested
    // If enableSemanticScoring is explicitly true but we're doing sync retrieval,
    // log a warning since async retrieval is required for embeddings
    const requestedSemanticScoring = enableSemanticScoring === true;

    const buildKeywordPayload = ({ semanticRequested = false, reason = null } = {}) => {
      try {
        // Keyword-only synchronous retrieval
        // Semantic scoring requires async retrievePassagesWithQuality() which should
        // be called in performSpreadAnalysis() and passed via graphRAGPayload
        const retrievedPassages = retrievePassages(activeThemes.knowledgeGraph.graphKeys, {
          maxPassages,
          userQuery: userQuestion,
          questionContext
        });

        const retrievalSummary = buildRetrievalSummary(activeThemes.knowledgeGraph.graphKeys, retrievedPassages);
        const semanticScoringUsed = Boolean(retrievalSummary?.qualityMetrics?.semanticScoringUsed);
        const semanticScoringFallback = semanticRequested && !semanticScoringUsed;
        const summary = {
          ...retrievalSummary,
          semanticScoringRequested: semanticRequested,
          semanticScoringUsed,
          semanticScoringFallback
        };

        if (reason) {
          summary.reason = reason;
        }

        return {
          passages: retrievedPassages,
          initialPassageCount: retrievedPassages.length,
          formattedBlock: null,
          retrievalSummary: summary,
          maxPassages,
          enableSemanticScoring: semanticRequested,
          rankingStrategy: 'keyword',
          semanticScoringRequested: semanticRequested,
          semanticScoringUsed,
          semanticScoringFallback
        };
      } catch (err) {
        console.error('[GraphRAG] Pre-fetch failed:', err.message);
        return null;
      }
    };

    if (requestedSemanticScoring) {
      const message = '[GraphRAG] Semantic scoring requested but graphRAGPayload not pre-computed. Falling back to keyword retrieval; pre-compute with retrievePassagesWithQuality() in performSpreadAnalysis() for embeddings.';
      console.warn(message);
      diagnostics.push(message);

      effectiveGraphRAGPayload = buildKeywordPayload({
        semanticRequested: true,
        reason: 'semantic-scoring-not-prefetched'
      });

      if (!effectiveGraphRAGPayload) {
        effectiveGraphRAGPayload = {
          passages: [],
          initialPassageCount: 0,
          formattedBlock: null,
          retrievalSummary: {
            semanticScoringRequested: true,
            semanticScoringUsed: false,
            semanticScoringFallback: true,
            reason: 'semantic-scoring-not-prefetched'
          },
          maxPassages,
          enableSemanticScoring: true,
          rankingStrategy: 'semantic',
          semanticScoringRequested: true,
          semanticScoringUsed: false,
          semanticScoringFallback: true
        };
        graphRAGInjectionDisabled = true;
      }
    } else {
      effectiveGraphRAGPayload = buildKeywordPayload({ semanticRequested: false });
    }
  }

  const baseControls = {
    graphRAGPayload: effectiveGraphRAGPayload,
    ephemerisContext: astroContext,
    ephemerisForecast: astroForecast,
    transitResonances: astroTransits,
    includeGraphRAG: !graphRAGInjectionDisabled,
    includeEphemeris: astroRelevant,
    includeForecast: astroRelevant,
    includeDeckContext: true,
    includeDiagnostics: true,
    omitLowWeightImagery: false,
    enableSemanticScoring,
    subscriptionTier,
    env: graphEnv,
    variantOverrides
  };

  const buildWithControls = (controls) => {
    const systemPrompt = buildSystemPrompt(
      spreadKey,
      activeThemes,
      normalizedContext,
      resolvedDeckStyle,
      userQuestion,
      {
        ...controls,
        personalization,
        maxTokenBudget: promptBudget
      }
    );

    const userPrompt = buildUserPrompt(
      spreadKey,
      cardsInfo,
      userQuestion,
      reflectionsText,
      activeThemes,
      spreadAnalysis,
      normalizedContext,
      visionInsights,
      resolvedDeckStyle,
      {
        ...controls,
        personalization,
        contextDiagnostics: diagnostics
      }
    );

    // Always estimate tokens to enforce hard caps even when slimming is disabled
    const systemTokens = estimateTokenCount(systemPrompt);
    const userTokens = estimateTokenCount(userPrompt);
    return {
      systemPrompt,
      userPrompt,
      systemTokens,
      userTokens,
      totalTokens: systemTokens + userTokens
    };
  };

  let controls = { ...baseControls };
  let built = buildWithControls(controls);
  const slimmingSteps = [];

  // Prompt slimming is DISABLED by default to preserve full-context prompts.
  // Opt in via ENABLE_PROMPT_SLIMMING=true.
  // DISABLE_PROMPT_SLIMMING=true always wins and forces slimming off.
  const enableSlimmingFlag = readBooleanFlag(promptBudgetEnv?.ENABLE_PROMPT_SLIMMING);
  const disableSlimmingFlag = readBooleanFlag(promptBudgetEnv?.DISABLE_PROMPT_SLIMMING);
  const disableSlimming = disableSlimmingFlag === true || enableSlimmingFlag !== true;

  const maybeSlim = (label, updater) => {
    if (disableSlimming) return; // Skip all slimming when disabled
    if (!promptBudget) return;
    if (built.totalTokens <= promptBudget) return;
    updater();
    built = buildWithControls(controls);
    slimmingSteps.push(label);
  };

  const trimGraphRAGPassages = () => {
    if (controls.includeGraphRAG === false) return false;
    const payload = controls.graphRAGPayload;
    if (!payload?.passages || payload.passages.length <= 1) return false;

    const effectiveSpreadKey = spreadKey || 'general';
    const baselineMax = payload.maxPassages || getPassageCountForSpread(effectiveSpreadKey, subscriptionTier);
    const currentCount = payload.passages.length;
    const targetCount = Math.max(
      1,
      Math.min(currentCount - 1, Math.ceil(baselineMax / 2))
    );

    if (targetCount >= currentCount) return false;

    const { passages: rankedPassages, strategy } = rankPassagesForPrompt(payload.passages, {
      limit: targetCount
    });

    if (!rankedPassages || rankedPassages.length >= currentCount) return false;

    const trimmedCount = currentCount - rankedPassages.length;
    const initialPassageCount =
      typeof payload.initialPassageCount === 'number'
        ? payload.initialPassageCount
        : currentCount;

    controls = {
      ...controls,
      graphRAGPayload: {
        ...payload,
        passages: rankedPassages,
        formattedBlock: null,
        initialPassageCount,
        budgetTrimmed: true,
        budgetTrimmedCount: (payload.budgetTrimmedCount || 0) + trimmedCount,
        budgetTrimmedFrom:
          typeof payload.budgetTrimmedFrom === 'number'
            ? payload.budgetTrimmedFrom
            : initialPassageCount,
        budgetTrimmedTo: rankedPassages.length,
        rankingStrategy: strategy || payload.rankingStrategy || null
      }
    };

    return true;
  };

  // Step 1: Drop imagery/vision sub-points for lower-weight cards
  maybeSlim('drop-low-weight-imagery', () => {
    controls = { ...controls, omitLowWeightImagery: true };
  });

  // Step 2: Remove forecast (future events) if over budget
  maybeSlim('drop-forecast', () => {
    controls = { ...controls, includeForecast: false };
  });

  // Step 3: Remove ephemeris/astrological context if over budget
  maybeSlim('drop-ephemeris', () => {
    controls = { ...controls, includeEphemeris: false };
  });

  // Step 3.5: Trim GraphRAG passages before dropping the block entirely
  maybeSlim('trim-graphrag-passages', () => {
    trimGraphRAGPassages();
  });

  // Step 4: Remove GraphRAG block if still over budget
  maybeSlim('drop-graphrag-block', () => {
    controls = { ...controls, includeGraphRAG: false };
  });

  // Step 5: Remove deck geometry/context tables (Thoth/Marseille)
  maybeSlim('drop-deck-geometry', () => {
    controls = { ...controls, includeDeckContext: false };
  });

  // Step 6: Remove diagnostics (vision validation, verbose notes)
  maybeSlim('drop-diagnostics', () => {
    controls = { ...controls, includeDiagnostics: false };
  });

  // Step 7: HARD CAP - Always enforce context window limits even when slimming is disabled
  const hardCap = getHardCapBudget(budgetTarget);
  let finalSystem = built.systemPrompt;
  let finalUser = built.userPrompt;
  let systemTruncated = false;
  let userTruncated = false;

  const applyHardCapTrim = (label, updater) => {
    if (built.totalTokens <= hardCap) return false;
    const didUpdate = updater();
    if (!didUpdate) return false;
    built = buildWithControls(controls);
    slimmingSteps.push(label);
    return true;
  };

  if (built.totalTokens > hardCap) {
    console.warn(`[Prompt Budget] Exceeded hard cap after slimming: ${built.totalTokens} > ${hardCap} tokens`);

    applyHardCapTrim('hard-cap-drop-low-weight-imagery', () => {
      if (controls.omitLowWeightImagery) return false;
      controls = { ...controls, omitLowWeightImagery: true };
      return true;
    });

    applyHardCapTrim('hard-cap-drop-forecast', () => {
      if (controls.includeForecast === false) return false;
      controls = { ...controls, includeForecast: false };
      return true;
    });

    applyHardCapTrim('hard-cap-drop-ephemeris', () => {
      if (controls.includeEphemeris === false) return false;
      controls = { ...controls, includeEphemeris: false };
      return true;
    });

    applyHardCapTrim('hard-cap-trim-graphrag-passages', () => trimGraphRAGPassages());

    applyHardCapTrim('hard-cap-drop-graphrag-block', () => {
      if (controls.includeGraphRAG === false) return false;
      controls = { ...controls, includeGraphRAG: false };
      return true;
    });

    applyHardCapTrim('hard-cap-drop-deck-geometry', () => {
      if (controls.includeDeckContext === false) return false;
      controls = { ...controls, includeDeckContext: false };
      return true;
    });

    applyHardCapTrim('hard-cap-drop-diagnostics', () => {
      if (controls.includeDiagnostics === false) return false;
      controls = { ...controls, includeDiagnostics: false };
      return true;
    });
  }

  finalSystem = built.systemPrompt;
  finalUser = built.userPrompt;

  if (built.totalTokens > hardCap) {
    // Calculate how many tokens we need to shed
    const excessTokens = built.totalTokens - hardCap;

    // Prefer truncating user prompt first (system prompt has core instructions)
    const userTargetTokens = Math.max(
      built.userTokens - excessTokens,
      Math.floor(hardCap * 0.3) // Keep at least 30% of budget for user prompt
    );

    const userResult = truncateUserPromptSafely(
      built.userPrompt,
      userTargetTokens,
      { spreadKey }
    );
    finalUser = userResult.text;
    userTruncated = userResult.truncated;
    if (userResult.preservedSections?.length > 0) {
      slimmingSteps.push(`user-preserved-sections:${userResult.preservedSections.join(',')}`);
    }

    // If user truncation wasn't enough, truncate system prompt too
    // Use section-aware truncation to preserve ETHICS/CORE PRINCIPLES/MODEL DIRECTIVES
    const newUserTokens = estimateTokenCount(finalUser);
    const remainingBudget = hardCap - newUserTokens;

    if (built.systemTokens > remainingBudget) {
      let systemResult;
      try {
        systemResult = truncateSystemPromptSafely(built.systemPrompt, remainingBudget);
      } catch (err) {
        console.warn(`[Prompt Budget] Section-aware truncation failed: ${err.message}; falling back to simple truncation.`);
        systemResult = truncateToTokenBudget(built.systemPrompt, remainingBudget);
      }
      finalSystem = systemResult.text;
      systemTruncated = systemResult.truncated;
      if (systemResult.preservedSections?.length > 0) {
        slimmingSteps.push(`preserved-sections:${systemResult.preservedSections.join(',')}`);
      }
    }

    slimmingSteps.push('hard-cap-truncation');
  }

  const hardCapSteps = slimmingSteps.filter(step => step.startsWith('hard-cap-'));
  const hardCapApplied = hardCapSteps.length > 0;

  // Only include token estimates when slimming is enabled or a hard-cap adjustment occurred.
  // Actual token counts come from llmUsage in API response (authoritative).
  const slimmingEnabled = !disableSlimming;
  const truncationApplied = systemTruncated || userTruncated;
  const shouldEstimateTokens = slimmingEnabled || truncationApplied || hardCapApplied;
  let estimatedTokens = null;

  if (shouldEstimateTokens) {
    const finalSystemTokens = estimateTokenCount(finalSystem);
    const finalUserTokens = estimateTokenCount(finalUser);
    const finalTotalTokens = finalSystemTokens + finalUserTokens;
    estimatedTokens = {
      system: finalSystemTokens,
      user: finalUserTokens,
      total: finalTotalTokens,
      budget: promptBudget,
      hardCap,
      budgetTarget,
      overBudget: Boolean(promptBudget && finalTotalTokens > promptBudget),
      truncated: truncationApplied
    };
  }

  const promptMeta = {
    // Reading prompt version for quality tracking and A/B testing correlation
    readingPromptVersion: getReadingPromptVersion(),
    // Spread key used for prompt structure selection (from getSpreadKey)
    spreadKey,
    deckStyle: resolvedDeckStyle,
    context: {
      provided: context || null,
      normalized: normalizedContext,
      fallbackApplied: contextFallbackApplied
    },
    // Token estimates present when slimming is enabled or hard-cap adjustments occur.
    // Use llmUsage.input_tokens from API response for actual token counts.
    estimatedTokens,
    slimmingEnabled,
    slimmingSteps,
    hardCap: hardCapApplied ? { steps: hardCapSteps } : null,
    appliedOptions: {
      omitLowWeightImagery: Boolean(controls.omitLowWeightImagery),
      includeForecast: Boolean(controls.includeForecast),
      includeEphemeris: Boolean(controls.includeEphemeris),
      includeDeckContext: Boolean(controls.includeDeckContext),
      includeDiagnostics: Boolean(controls.includeDiagnostics)
    },
    truncation: (systemTruncated || userTruncated) ? {
      systemTruncated,
      userTruncated,
      originalSystemTokens: built.systemTokens,
      originalUserTokens: built.userTokens,
      originalTotalTokens: built.totalTokens
    } : null
  };

  if (controls.graphRAGPayload?.retrievalSummary) {
    const payload = controls.graphRAGPayload;
    const retrievalSummary = { ...payload.retrievalSummary };
    const envForGraph = controls.env ?? (typeof process !== 'undefined' ? process.env : {});
    const graphragEnabled = isGraphRAGEnabled(envForGraph) || (!controls.env && Boolean(payload));
    const passagesAfterSlimming = Array.isArray(payload.passages)
      ? payload.passages.length
      : 0;
    const initialPassageCount = typeof payload.initialPassageCount === 'number'
      ? payload.initialPassageCount
      : passagesAfterSlimming;
    const graphRAGParse = parseGraphRAGReferenceBlock(finalUser);
    const graphRAGBlockPresent = graphRAGParse.status !== 'absent';
    const passagesInPrompt = graphRAGParse.status === 'complete'
      ? graphRAGParse.passageCount
      : null;
    const graphRAGIncluded = graphragEnabled &&
      controls.includeGraphRAG !== false &&
      graphRAGParse.status === 'complete' &&
      typeof passagesInPrompt === 'number' &&
      passagesInPrompt > 0 &&
      graphRAGBlockPresent;
    const passagesUsed = graphRAGParse.status === 'complete'
      ? (graphRAGIncluded ? passagesInPrompt : 0)
      : null;
    const trimmedCount = typeof passagesUsed === 'number'
      ? Math.max(0, initialPassageCount - passagesUsed)
      : null;

    const semanticScoringUsed = Boolean(
      retrievalSummary.qualityMetrics?.semanticScoringUsed ||
      retrievalSummary.semanticScoringUsed
    );
    const semanticScoringRequested = Boolean(
      controls.graphRAGPayload.semanticScoringRequested ||
      retrievalSummary.semanticScoringRequested ||
      controls.enableSemanticScoring === true ||
      controls.graphRAGPayload.enableSemanticScoring === true
    );
    const semanticScoringFallback =
      controls.graphRAGPayload.semanticScoringFallback === true ||
      retrievalSummary.semanticScoringFallback === true ||
      (semanticScoringRequested && semanticScoringUsed === false);
    const semanticScoringAttempted = Boolean(
      retrievalSummary.qualityMetrics?.semanticScoringAttempted ||
      controls.graphRAGPayload.semanticScoringAttempted ||
      semanticScoringUsed // If it was used, it was attempted
    );

    retrievalSummary.semanticScoringRequested = semanticScoringRequested;
    retrievalSummary.semanticScoringUsed = semanticScoringUsed;
    retrievalSummary.semanticScoringAttempted = semanticScoringAttempted;
    if (semanticScoringFallback) {
      retrievalSummary.semanticScoringFallback = true;
    }

    retrievalSummary.passagesProvided = initialPassageCount;
    retrievalSummary.passagesUsedInPrompt = passagesUsed;
    retrievalSummary.parseStatus = graphRAGParse.status;
    retrievalSummary.referenceBlockClosed = graphRAGParse.referenceBlockClosed;
    if (typeof trimmedCount === 'number' && trimmedCount > 0) {
      retrievalSummary.truncatedPassages = trimmedCount;
    }
    if (payload.budgetTrimmedCount) {
      retrievalSummary.truncatedForBudget = true;
      retrievalSummary.budgetTrimmedFrom = payload.budgetTrimmedFrom ?? initialPassageCount;
      retrievalSummary.budgetTrimmedTo = payload.budgetTrimmedTo ?? passagesUsed;
      if (payload.rankingStrategy) {
        retrievalSummary.budgetTrimmedStrategy = payload.rankingStrategy;
      }
    }
    retrievalSummary.disabledByEnv = !graphragEnabled;
    retrievalSummary.includedInPrompt = graphRAGIncluded;

    promptMeta.graphRAG = retrievalSummary;
  } else if (
    themes?.knowledgeGraph?.graphKeys &&
    typeof themes.knowledgeGraph.graphKeys === 'object' &&
    Object.keys(themes.knowledgeGraph.graphKeys).length > 0
  ) {
    // Emit stub telemetry when graphKeys exist but retrieval was skipped/failed
    const envForGraph = controls.env ?? (typeof process !== 'undefined' ? process.env : {});
    const graphragEnabled = isGraphRAGEnabled(envForGraph) || (!controls.env && Boolean(controls.graphRAGPayload));
    promptMeta.graphRAG = {
      includedInPrompt: false,
      disabledByEnv: !graphragEnabled,
      passagesProvided: 0,
      passagesUsedInPrompt: 0,
      skippedReason: graphragEnabled ? 'retrieval_failed_or_empty' : 'disabled_by_env'
    };
  }

  if (controls.ephemerisContext?.available) {
    const locationContext = controls.ephemerisContext.locationContext || {};
    promptMeta.ephemeris = {
      available: true,
      moonPhase: controls.ephemerisContext.moonPhase?.phaseName,
      retrogradeCount: controls.ephemerisContext.retrogrades?.length || 0,
      transitResonances: controls.transitResonances?.length || 0,
      locationUsed: Boolean(locationContext.locationUsed),
      timezone: locationContext.timezone || 'UTC'
    };
  }

  if (controls.ephemerisForecast?.available) {
    promptMeta.forecast = {
      available: true,
      days: controls.ephemerisForecast.forecastDays,
      eventCount: controls.ephemerisForecast.events?.length || 0
    };
  }

  // Return final prompts (potentially truncated to fit hard cap)
  return { systemPrompt: finalSystem, userPrompt: finalUser, promptMeta, contextDiagnostics: diagnostics };
}
