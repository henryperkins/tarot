/**
 * Reading Telemetry and Logging Utilities
 *
 * Provides conditional logging for LLM prompts, narrative enhancements,
 * and enhancement telemetry. Includes security-aware PII redaction.
 *
 * Extracted from tarot-reading.js to maintain <900 line limit.
 */

import { redactPII } from './promptEngineering.js';
import { isProductionEnvironment } from './environment.js';

// ============================================================================
// Boolean Flag Normalization
// ============================================================================

/**
 * Normalize various truthy representations to boolean.
 *
 * Handles:
 * - Boolean values (passthrough)
 * - String 'true'/'false' (case-insensitive)
 * - null/undefined (returns false)
 *
 * @param {*} value - Value to normalize
 * @returns {boolean} Normalized boolean
 */
export function normalizeBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  return String(value).toLowerCase() === 'true';
}

// ============================================================================
// Environment Feature Detection
// ============================================================================

/**
 * Check if the evaluation gate is enabled.
 *
 * Requires both EVAL_ENABLED and EVAL_GATE_ENABLED to be true.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {boolean} Whether eval gate is enabled
 */
export function isEvalGateEnabled(env) {
  return normalizeBooleanFlag(env?.EVAL_ENABLED) && normalizeBooleanFlag(env?.EVAL_GATE_ENABLED);
}

/**
 * Check if Azure token streaming is enabled.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {boolean} Whether Azure streaming is enabled
 */
export function isAzureTokenStreamingEnabled(env) {
  if (!env) return false;
  if (env.AZURE_OPENAI_STREAMING_ENABLED !== undefined) {
    return normalizeBooleanFlag(env.AZURE_OPENAI_STREAMING_ENABLED);
  }
  if (env.ENABLE_AZURE_TOKEN_STREAMING !== undefined) {
    return normalizeBooleanFlag(env.ENABLE_AZURE_TOKEN_STREAMING);
  }
  return false;
}

/**
 * Check if streaming is allowed when eval gate is enabled.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {boolean} Whether streaming can bypass eval gate
 */
export function allowStreamingWithEvalGate(env) {
  if (!env) return false;
  if (env.ALLOW_STREAMING_WITH_EVAL_GATE !== undefined) {
    return normalizeBooleanFlag(env.ALLOW_STREAMING_WITH_EVAL_GATE);
  }
  if (env.ALLOW_UNGATED_STREAMING !== undefined) {
    return normalizeBooleanFlag(env.ALLOW_UNGATED_STREAMING);
  }
  return false;
}

/**
 * Determine if semantic scoring should be enabled for GraphRAG retrieval.
 *
 * Semantic scoring is enabled by default when the embeddings API is configured
 * (AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY). This function only handles
 * explicit env var overrides; auto-detection happens in the calling code.
 *
 * @param {Object} env - Environment variables
 * @returns {boolean|null} - true/false for explicit env var config, null for auto-detect
 */
export function getSemanticScoringConfig(env) {
  if (!env) return null;

  // Check explicit override via environment variables
  // These allow operators to force-enable or force-disable semantic scoring
  if (env.ENABLE_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.ENABLE_SEMANTIC_SCORING);
  }
  if (env.GRAPHRAG_SEMANTIC_SCORING !== undefined) {
    return normalizeBooleanFlag(env.GRAPHRAG_SEMANTIC_SCORING);
  }

  // Return null to enable auto-detection based on API availability
  // Auto-detection logic: if AZURE_OPENAI_ENDPOINT + API_KEY are set, semantic scoring is enabled
  return null;
}

/**
 * Resolve semantic scoring enablement with fallback.
 *
 * Priority order:
 * 1. Explicit env var config (ENABLE_SEMANTIC_SCORING or GRAPHRAG_SEMANTIC_SCORING)
 * 2. Provided fallback value (e.g., from graphRAGPayload.enableSemanticScoring)
 * 3. null (triggers auto-detection in graphRAG.js)
 *
 * @param {Object} env - Environment variables
 * @param {boolean|null} fallback - Fallback value if env config is null
 * @returns {boolean|null} Resolved semantic scoring setting
 */
export function resolveSemanticScoring(env, fallback = null) {
  const config = getSemanticScoringConfig(env);
  return config !== null ? config : fallback;
}

// ============================================================================
// Logging Configuration
// ============================================================================

/**
 * Check if LLM prompt logging is enabled.
 *
 * SECURITY: Prompt logging is blocked in production to prevent PII leaks.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {boolean} Whether prompt logging is enabled
 */
export function shouldLogLLMPrompts(env) {
  if (!env) return false;

  // SECURITY: Block prompt logging in production to prevent PII leaks
  if (isProductionEnvironment(env)) {
    return false;
  }

  if (env.LOG_LLM_PROMPTS !== undefined) return normalizeBooleanFlag(env.LOG_LLM_PROMPTS);
  if (env.DEBUG_LLM_PROMPTS !== undefined) return normalizeBooleanFlag(env.DEBUG_LLM_PROMPTS);
  if (env.DEBUG_PROMPTS !== undefined) return normalizeBooleanFlag(env.DEBUG_PROMPTS);
  return false;
}

/**
 * Check if narrative enhancement logging is enabled.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {boolean} Whether enhancement logging is enabled
 */
export function shouldLogNarrativeEnhancements(env) {
  if (!env) return false;
  if (env.LOG_NARRATIVE_ENHANCEMENTS !== undefined) {
    return normalizeBooleanFlag(env.LOG_NARRATIVE_ENHANCEMENTS);
  }
  if (env.DEBUG_NARRATIVE_ENHANCEMENTS !== undefined) {
    return normalizeBooleanFlag(env.DEBUG_NARRATIVE_ENHANCEMENTS);
  }
  return false;
}

/**
 * Check if enhancement telemetry logging is enabled.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @returns {boolean} Whether telemetry logging is enabled
 */
export function shouldLogEnhancementTelemetry(env) {
  if (!env) return false;
  if (env.LOG_ENHANCEMENT_TELEMETRY !== undefined) {
    return normalizeBooleanFlag(env.LOG_ENHANCEMENT_TELEMETRY);
  }
  if (env.DEBUG_ENHANCEMENT_TELEMETRY !== undefined) {
    return normalizeBooleanFlag(env.DEBUG_ENHANCEMENT_TELEMETRY);
  }
  return false;
}

// ============================================================================
// Narrative Enhancement Summarization
// ============================================================================

/**
 * Summarize narrative enhancement data for telemetry.
 *
 * @param {Array} sections - Array of enhanced sections with metadata/validation
 * @returns {Object|null} Summary object or null if no sections
 */
export function summarizeNarrativeEnhancements(sections = []) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  const summary = {
    totalSections: sections.length,
    enhancedSections: 0,
    enhancementCounts: {},
    sectionTypes: {},
    sectionNames: [],
    missingCounts: {},
    totalEnhancements: 0,
    sections: []
  };

  sections.forEach((section, index) => {
    const metadata = section?.metadata || {};
    const validation = section?.validation || {};
    const type =
      metadata.type ||
      metadata.section ||
      `section-${index + 1}`;
    const name =
      metadata.name ||
      metadata.label ||
      metadata.title ||
      type;

    const enhanced = Boolean(validation?.enhanced);
    const enhancements = Array.isArray(validation?.enhancements)
      ? validation.enhancements
      : [];
    const missing = Array.isArray(validation?.missing)
      ? validation.missing
      : [];
    const present = validation?.present || {};

    if (!summary.sectionTypes[type]) {
      summary.sectionTypes[type] = { total: 0, enhanced: 0 };
    }
    summary.sectionTypes[type].total += 1;
    if (enhanced) {
      summary.enhancedSections += 1;
      summary.sectionTypes[type].enhanced += 1;
    }

    enhancements.forEach((tag) => {
      if (!tag) return;
      summary.enhancementCounts[tag] =
        (summary.enhancementCounts[tag] || 0) + 1;
    });

    summary.totalEnhancements += enhancements.length;
    summary.sectionNames.push(name);

    missing.forEach((key) => {
      if (!key) return;
      summary.missingCounts[key] = (summary.missingCounts[key] || 0) + 1;
    });

    summary.sections.push({
      type,
      name,
      enhanced,
      enhancements,
      missing,
      present
    });
  });

  return summary;
}

// ============================================================================
// Conditional Logging Functions
// ============================================================================

/**
 * Log narrative enhancements if enabled.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} requestId - Request ID for log correlation
 * @param {string} provider - Narrative provider name
 * @param {Object} summary - Enhancement summary from summarizeNarrativeEnhancements
 */
export function maybeLogNarrativeEnhancements(env, requestId, provider, summary) {
  if (!shouldLogNarrativeEnhancements(env) || !summary) return;
  console.log(`[${requestId}] [${provider}] Narrative enhancement summary:`, summary);
}

/**
 * Log LLM prompt payload if enabled.
 *
 * SECURITY: Uses PII redaction for all prompt logging.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} requestId - Request ID for log correlation
 * @param {string} backendLabel - Backend identifier
 * @param {string} systemPrompt - System prompt text
 * @param {string} userPrompt - User prompt text
 * @param {Object} promptMeta - Prompt metadata (tokens, slimming steps)
 * @param {Object} options - Additional options
 * @param {Object} options.personalization - User personalization data
 */
export function maybeLogPromptPayload(env, requestId, backendLabel, systemPrompt, userPrompt, promptMeta, options = {}) {
  if (!shouldLogLLMPrompts(env)) return;

  // SECURITY: Use comprehensive PII redaction for all prompt logging
  // This includes email, phone, SSN, credit card, dates, URLs, IP addresses,
  // and any user-provided display name
  const personalization = options.personalization || null;
  const redactionOptions = {
    displayName: personalization?.displayName
  };

  const redactedSystem = redactPII(systemPrompt, redactionOptions);
  const redactedUser = redactPII(userPrompt, redactionOptions);

  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT BEGIN ===`);
  console.log(redactedSystem);
  console.log(`[${requestId}] [${backendLabel}] === SYSTEM PROMPT END ===`);

  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT BEGIN ===`);
  console.log(redactedUser);
  console.log(`[${requestId}] [${backendLabel}] === USER PROMPT END ===`);

  // Only log estimated tokens when slimming is enabled (estimation is skipped otherwise)
  // Actual token counts are logged from llmUsage after API response
  if (promptMeta?.estimatedTokens) {
    const { total, system, user, budget } = promptMeta.estimatedTokens;
    const budgetNote = budget ? ` / budget ${budget}` : '';
    console.log(`[${requestId}] [${backendLabel}] Estimated tokens (slimming enabled): total ${total} (system ${system} + user ${user})${budgetNote}`);
  }
}

/**
 * Log enhancement telemetry if enabled.
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} requestId - Request ID for log correlation
 * @param {Object} telemetry - Telemetry object with summary
 */
export function maybeLogEnhancementTelemetry(env, requestId, telemetry) {
  if (!shouldLogEnhancementTelemetry(env)) return;
  if (!telemetry) return;

  const summary = telemetry.summary || telemetry;
  console.log(
    `[${requestId}] [enhancement-telemetry] sections=${summary.totalSections || 0}, enhanced=${summary.enhancedSections || 0}, tags=${summary.totalEnhancements || 0}`
  );

  if (summary.enhancementCounts && Object.keys(summary.enhancementCounts).length > 0) {
    console.log(`[${requestId}] [enhancement-telemetry] enhancementCounts`, summary.enhancementCounts);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Trim text for telemetry storage (prevents oversized payloads).
 *
 * @param {string} text - Text to trim
 * @param {number} limit - Maximum character length
 * @returns {string} Trimmed text with ellipsis if truncated
 */
export function trimForTelemetry(text = '', limit = 500) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}
