import { isEvalGateEnabled } from './readingTelemetry.js';
import { isProductionEnvironment } from './environment.js';

const RESTRICTED_INPUT_PATTERNS = Object.freeze([
  {
    reason: 'restricted_medical',
    pattern: /\b(?:medical|doctor|hospital|diagnos(?:e|is)|medicat(?:e|ion)|medicine|treatment|therapy|therapist|anxiety|depression|burnout|illness|disease|symptom|self[-\s]?harm)\b/i
  },
  {
    reason: 'restricted_financial',
    pattern: /\b(?:financial|finance|finances|invest|investment|stocks?|crypto|cryptocurrency|bitcoin|loan|debt|mortgage|bankruptcy|retirement|savings?)\b/i
  },
  {
    reason: 'restricted_legal',
    pattern: /\b(?:legal|lawsuit|court|trial|judge|attorney|lawyer|settlement|custody|police|authorities|restraining\s+order)\b/i
  },
  {
    reason: 'restricted_abuse_safety',
    pattern: /\b(?:abuse|abusive|violence|violent|assault|unsafe|threat|threaten|stalking|coerc(?:e|ion))\b/i
  }
]);

function collectRestrictedInputReasons(inputText) {
  if (!inputText || typeof inputText !== 'string') return [];

  const reasons = [];
  for (const { reason, pattern } of RESTRICTED_INPUT_PATTERNS) {
    if (pattern.test(inputText)) {
      reasons.push(reason);
    }
  }
  return reasons;
}

export function getEvalGateFailureMode(env) {
  const rawMode = env?.EVAL_GATE_FAILURE_MODE;
  const defaultMode = isProductionEnvironment(env) ? 'closed' : 'open';

  // Log deprecation warnings for legacy variables without honoring them
  if (env?.EVAL_GATE_FAIL_MODE !== undefined) {
    console.warn('[eval] DEPRECATED: EVAL_GATE_FAIL_MODE is deprecated. Use EVAL_GATE_FAILURE_MODE=open|closed');
  }
  if (env?.EVAL_GATE_FAIL_OPEN !== undefined) {
    console.warn('[eval] DEPRECATED: EVAL_GATE_FAIL_OPEN is deprecated. Use EVAL_GATE_FAILURE_MODE=open|closed');
  }
  if (env?.EVAL_GATE_FAIL_CLOSED !== undefined) {
    console.warn('[eval] DEPRECATED: EVAL_GATE_FAIL_CLOSED is deprecated. Use EVAL_GATE_FAILURE_MODE=open|closed');
  }

  if (typeof rawMode === 'string') {
    const normalized = rawMode.trim().toLowerCase();
    if (normalized === 'open') return 'open';
    if (normalized === 'closed') return 'closed';
    console.warn(`[eval] Invalid EVAL_GATE_FAILURE_MODE value: "${rawMode}". Valid values: open, closed. Defaulting to ${defaultMode}.`);
  }

  return defaultMode;
}

export function buildSelectiveEvalGatePolicy({
  env,
  languageSupport,
  userQuestion,
  reflectionsText,
  decisionPaths
} = {}) {
  const reasons = [];

  if (languageSupport && languageSupport.supported === false) {
    reasons.push(`language_${languageSupport.language || 'unsupported'}`);
  }

  const combinedInput = [userQuestion, reflectionsText, ...Object.values(decisionPaths || {})]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n');
  reasons.push(...collectRestrictedInputReasons(combinedInput));

  const uniqueReasons = Array.from(new Set(reasons));
  const requested = uniqueReasons.length > 0;
  const globalGateEnabled = isEvalGateEnabled(env);
  const forced = requested && !globalGateEnabled;

  // A wellbeing topic alone is not medical intent. Restricted input and languages
  // beyond the deterministic checks still require a complete model assessment.
  // Disabling evaluation must not silently convert these requests into safe ones.

  const effectiveEnv = requested
    ? {
      ...env,
      EVAL_GATE_ENABLED: 'true',
      EVAL_GATE_FAILURE_MODE: 'closed',
      EVAL_GATE_REQUIRED: 'true'
    }
    : (env || {});

  return {
    requested,
    forced,
    reasons: uniqueReasons,
    effectiveEnv,
    effectiveEvalGateEnabled: globalGateEnabled || forced
  };
}
