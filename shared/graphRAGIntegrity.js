// Shared by prompt enforcement and bounded client/journal telemetry. Never
// serialize arbitrary parser messages or reference text as removal reasons.
export const GRAPHRAG_INTEGRITY_REMOVAL_REASONS = Object.freeze([
  'unclosed_reference',
  'missing_envelope_end',
  'missing_security_note',
  'missing_card_guardrail',
  'missing_partial_guardrail',
  'missing_weak_guardrail',
  'incomplete_summary',
  'invalid_envelope'
]);
