import { normalizeBooleanFlag } from './readingTelemetry.js';

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

export function buildSelectiveEvalGatePolicy({
  env,
  languageSupport,
  userQuestion,
  reflectionsText
} = {}) {
  const reasons = [];

  if (languageSupport && languageSupport.supported === false) {
    reasons.push(`language_${languageSupport.language || 'unsupported'}`);
  }

  const combinedInput = [userQuestion, reflectionsText]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n');
  reasons.push(...collectRestrictedInputReasons(combinedInput));

  const uniqueReasons = Array.from(new Set(reasons));
  const requested = uniqueReasons.length > 0;
  const evalEnabled = normalizeBooleanFlag(env?.EVAL_ENABLED);
  const globalGateEnabled = evalEnabled && normalizeBooleanFlag(env?.EVAL_GATE_ENABLED);
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
