import { MAXIMUM_CARD_COUNT } from './contracts/readingRequestLimits.js';

// A bounded, text-free snapshot for the reading UI and personal journal.
// Do not copy prompts, user text, image URLs or arbitrary telemetry into it.
export const USER_INPUT_KEYS = Object.freeze([
  'question', 'reflections', 'pathA', 'pathB', 'cardReflections', 'focusAreas', 'displayName',
  'experience', 'tone', 'frame', 'depth'
]);

export const USAGE_REASON_COPY = Object.freeze({
  unverified_reference_provenance: 'Reference provenance could not be verified.',
  projection_rejected: 'References could not be verified for the selected deck.',
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
        for (const name of ['question', 'reflections', 'pathA', 'pathB', ...Array.from({ length: MAXIMUM_CARD_COUNT }, (_, index) => `card-${index}`)]) {
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
  const known = new Set(['question', 'reflections', 'pathA', 'pathB', ...Array.from({ length: MAXIMUM_CARD_COUNT }, (_, i) => `card-${i}`), ...Array.from({ length: 6 }, (_, i) => `focus-${i}`)]);
  const seen = new Set();
  return value.flatMap(field => {
    if (!isRecord(field) || !known.has(field.id) || seen.has(field.id)) return [];
    seen.add(field.id);
    const entry = { id: field.id };
    copyCounts(entry, field, ['originalLength', 'sanitizedLength', 'eligibleLength', 'includedLength']);
    copyFlags(entry, field, ['included', 'truncated']);
    if (field.reason != null) entry.reason = reasonCode(field.reason);
    return [entry];
  });
}
