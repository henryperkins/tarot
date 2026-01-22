// Token estimation heuristics.
// We intentionally over-estimate to avoid under-counting markdown-heavy or
// Unicode-rich prompts that tend to tokenize more densely than plain ASCII.
//
// Calibration notes (2026-01):
// - GPT-4o/GPT-5: ~3.5-4.0 chars/token for English prose, ~2.5-3.0 for code/markdown
// - Claude 3.5: Similar tokenization efficiency
// - Using 3.25 as conservative middle-ground that errs toward over-estimation
//
// A/B testing: Set TOKEN_ESTIMATE_DIVISOR_OVERRIDE in env to test alternate divisors
// Calibration: Use compareEstimateWithActual() to validate against llmUsage.input_tokens
export const TOKEN_ESTIMATE_DIVISOR = 3.25; // Conservative divisor: ~3.25 characters per token

// Allow runtime override for A/B testing different divisor values
// This enables empirical validation without code changes
export function getEffectiveDivisor(env = null) {
  const effectiveEnv = env || (typeof process !== 'undefined' && process.env ? process.env : {});
  const override = effectiveEnv?.TOKEN_ESTIMATE_DIVISOR_OVERRIDE;
  if (override) {
    const parsed = parseFloat(override);
    if (Number.isFinite(parsed) && parsed > 1.0 && parsed < 10.0) {
      return parsed;
    }
  }
  return TOKEN_ESTIMATE_DIVISOR;
}

function readEnvNumber(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Estimate token count for a text string.
 * Uses heuristics tuned for GPT-4/Claude tokenization patterns.
 *
 * @param {string} text - Text to estimate tokens for
 * @param {Object} [options] - Estimation options
 * @param {Object} [options.env] - Environment for divisor override
 * @param {boolean} [options.detailed] - Return detailed breakdown for calibration
 * @returns {number|Object} Token count estimate, or detailed breakdown if requested
 */
export function estimateTokenCount(text = '', options = {}) {
  const safe = typeof text === 'string' ? text : String(text || '');
  const divisor = getEffectiveDivisor(options.env);

  // Count Unicode code points (handles surrogate pairs) and raw bytes to
  // provide a conservative estimate for dense markdown or emoji-rich text.
  const codePoints = Array.from(safe).length;
  const bytes = typeof Buffer !== 'undefined' ? Buffer.byteLength(safe, 'utf8') : safe.length;

  // Markdown symbols tend to inflate token counts relative to character length.
  const markdownSymbols = (safe.match(/[#>*_`~[\]()]/g) || []).length;
  const markdownPenalty = Math.ceil(markdownSymbols * 0.25);
  const headingCount = (safe.match(/^#{1,6}\s+/gm) || []).length;
  const headingPenalty = headingCount * 6;

  const codePointEstimate = Math.ceil(codePoints / divisor);
  const byteEstimate = Math.ceil(bytes / 3); // ~3 bytes per token for UTF-8 heavy text
  const baseEstimate = Math.max(codePointEstimate, byteEstimate);

  // Add an 8% safety buffer plus markdown penalty to reduce under-counting.
  const safetyBuffer = Math.ceil(baseEstimate * 0.08);
  const adjustmentPenalty = Math.max(markdownPenalty, safetyBuffer);
  const total = baseEstimate + adjustmentPenalty + headingPenalty;

  if (options.detailed) {
    return {
      total,
      breakdown: {
        codePoints,
        bytes,
        codePointEstimate,
        byteEstimate,
        baseEstimate,
        markdownSymbols,
        markdownPenalty,
        headingCount,
        headingPenalty,
        safetyBuffer,
        adjustmentPenalty,
        divisorUsed: divisor
      }
    };
  }

  return total;
}

// Default token budgets per provider - used if no env var is set
// These are conservative estimates based on typical context windows
const DEFAULT_BUDGETS = {
  azure: 12000,   // GPT-5 has ~128k context, but we keep prompts reasonable
  claude: 16000,  // Claude has ~200k context, allow slightly larger prompts
  default: 8000   // Fallback for unknown providers
};

// Hard caps - prompts will be truncated if they exceed these after all slimming
const HARD_CAP_BUDGETS = {
  azure: 20000,
  claude: 25000,
  default: 15000
};

export function getPromptBudgetForTarget(target = 'default', options = {}) {
  const env = options.env || (typeof process !== 'undefined' && process.env ? process.env : {});
  const normalizedTarget = (target || 'default').toLowerCase();

  let raw = null;
  if (normalizedTarget === 'azure') {
    raw = env.PROMPT_BUDGET_AZURE ?? env.PROMPT_BUDGET_DEFAULT;
  } else if (normalizedTarget === 'claude') {
    raw = env.PROMPT_BUDGET_CLAUDE ?? env.PROMPT_BUDGET_DEFAULT;
  } else {
    raw = env.PROMPT_BUDGET_DEFAULT;
  }

  const envBudget = readEnvNumber(raw);

  // If no env budget is set, use sensible defaults
  if (!envBudget) {
    return DEFAULT_BUDGETS[normalizedTarget] || DEFAULT_BUDGETS.default;
  }

  return envBudget;
}

export function getHardCapBudget(target = 'default') {
  const normalizedTarget = (target || 'default').toLowerCase();
  return HARD_CAP_BUDGETS[normalizedTarget] || HARD_CAP_BUDGETS.default;
}

/**
 * Compare estimated tokens with actual usage for calibration.
 * Use this to validate estimation accuracy against llmUsage.input_tokens from API responses.
 *
 * @param {number} estimated - Our estimated token count
 * @param {number} actual - Actual token count from API (llmUsage.input_tokens)
 * @param {Object} [options] - Comparison options
 * @param {string} [options.label] - Label for logging context
 * @returns {Object} Calibration metrics
 *
 * @example
 * const calibration = compareEstimateWithActual(
 *   promptMeta.estimatedTokens?.total,
 *   llmUsage?.input_tokens,
 *   { label: 'celtic-cross-reading' }
 * );
 * // Returns: { estimated, actual, difference, percentError, overEstimated, ... }
 */
export function compareEstimateWithActual(estimated, actual, options = {}) {
  const { label = 'unknown' } = options;

  if (typeof estimated !== 'number' || typeof actual !== 'number') {
    return {
      label,
      valid: false,
      reason: 'missing_values',
      estimated: estimated ?? null,
      actual: actual ?? null
    };
  }

  if (actual === 0) {
    return {
      label,
      valid: false,
      reason: 'actual_is_zero',
      estimated,
      actual
    };
  }

  const difference = estimated - actual;
  const percentError = ((difference / actual) * 100);
  const overEstimated = difference > 0;
  const accuracy = 100 - Math.abs(percentError);

  // Calculate suggested divisor adjustment for future calibration
  // If we over-estimated, divisor should be higher; if under-estimated, lower
  const impliedDivisor = overEstimated
    ? TOKEN_ESTIMATE_DIVISOR * (estimated / actual)
    : TOKEN_ESTIMATE_DIVISOR * (estimated / actual);

  return {
    label,
    valid: true,
    estimated,
    actual,
    difference,
    percentError: Math.round(percentError * 100) / 100,
    overEstimated,
    accuracy: Math.round(accuracy * 100) / 100,
    impliedDivisor: Math.round(impliedDivisor * 100) / 100,
    currentDivisor: TOKEN_ESTIMATE_DIVISOR,
    recommendation: Math.abs(percentError) > 20
      ? `Consider adjusting divisor to ~${Math.round(impliedDivisor * 10) / 10}`
      : 'Estimation within acceptable range'
  };
}
