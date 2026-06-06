import { normalizeBooleanFlag } from './readingTelemetry.js';

const RESTRICTED_CONTEXTS = new Set(['wellbeing']);

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
  context,
  languageSupport,
  userQuestion,
  reflectionsText
} = {}) {
  const reasons = [];
  const normalizedContext = typeof context === 'string' ? context.trim().toLowerCase() : '';

  if (languageSupport && languageSupport.supported === false) {
    reasons.push(`language_${languageSupport.language || 'unsupported'}`);
  }

  if (RESTRICTED_CONTEXTS.has(normalizedContext)) {
    reasons.push(`context_${normalizedContext}`);
  }

  const combinedInput = [userQuestion, reflectionsText]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n');
  reasons.push(...collectRestrictedInputReasons(combinedInput));

  const uniqueReasons = Array.from(new Set(reasons));
  const requested = uniqueReasons.length > 0;
  const evalEnabled = normalizeBooleanFlag(env?.EVAL_ENABLED);
  const globalGateEnabled = evalEnabled && normalizeBooleanFlag(env?.EVAL_GATE_ENABLED);
  const forced = requested && evalEnabled && !globalGateEnabled;

  // Safety-driven reasons must fail closed (block when the eval is unavailable).
  // A reading forced ONLY because it is non-English is a quality/UX driver, not a
  // safety one — fail it OPEN so a transient eval outage doesn't black-hole the
  // non-English reader behind the English-only fallback. Any safety reason in the
  // mix (restricted_* or context_*) keeps the gate failing closed.
  const hasSafetyReason = uniqueReasons.some(
    (reason) => reason.startsWith('restricted_') || reason.startsWith('context_')
  );
  const forcedFailureMode = hasSafetyReason
    ? (env?.EVAL_GATE_FAILURE_MODE || 'closed')
    : 'open';

  const effectiveEnv = forced
    ? {
      ...env,
      EVAL_GATE_ENABLED: 'true',
      EVAL_GATE_FAILURE_MODE: forcedFailureMode
    }
    : (env || {});

  return {
    requested,
    forced,
    reasons: uniqueReasons,
    effectiveEnv,
    effectiveEvalGateEnabled: evalEnabled && (globalGateEnabled || forced)
  };
}
