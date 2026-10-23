const USER_CONTEXT_FIELD_CONFIG = Object.freeze({
  question: Object.freeze({
    providedProp: 'questionProvided',
    usedProp: 'questionUsed'
  }),
  reflections: Object.freeze({
    providedProp: 'reflectionsProvided',
    usedProp: 'reflectionsUsed'
  }),
  cardReflections: Object.freeze({
    providedProp: 'cardReflectionsProvided',
    usedProp: 'cardReflectionsUsed'
  }),
  callerInterpretations: Object.freeze({ providedProp: 'callerInterpretationsProvided', usedProp: 'callerInterpretationsUsed' }),
  pathA: Object.freeze({ providedProp: 'pathAProvided', usedProp: 'pathAUsed' }),
  pathB: Object.freeze({ providedProp: 'pathBProvided', usedProp: 'pathBUsed' }),
  focusAreas: Object.freeze({
    providedProp: 'focusAreasProvided',
    usedProp: 'focusAreasUsed'
  }),
  displayName: Object.freeze({
    providedProp: 'displayNameProvided',
    usedProp: 'displayNameUsed'
  }),
  experience: Object.freeze({
    providedProp: 'experienceProvided',
    usedProp: 'experienceUsed'
  }),
  tone: Object.freeze({
    providedProp: 'toneProvided',
    usedProp: 'toneUsed'
  }),
  frame: Object.freeze({
    providedProp: 'frameProvided',
    usedProp: 'frameUsed'
  }),
  depth: Object.freeze({
    providedProp: 'depthProvided',
    usedProp: 'depthUsed'
  })
});

export const USER_CONTEXT_FIELDS = Object.freeze(Object.keys(USER_CONTEXT_FIELD_CONFIG));

export function buildUserContextSourceUsage(fieldStates = {}, options = {}) {
  const result = {
    requested: false
  };
  const providedInputs = [];
  const usedInputs = [];
  const skippedInputs = {};

  USER_CONTEXT_FIELDS.forEach((fieldKey) => {
    const config = USER_CONTEXT_FIELD_CONFIG[fieldKey];
    const state = fieldStates?.[fieldKey] || {};
    const provided = Boolean(state.provided);
    const used = provided && Boolean(state.used);

    result[config.providedProp] = provided;
    result[config.usedProp] = used;

    if (provided) {
      providedInputs.push(fieldKey);
      if (used) {
        usedInputs.push(fieldKey);
      } else {
        skippedInputs[fieldKey] = state.skippedReason || 'not_used';
      }
    }
  });

  result.used = usedInputs.length > 0;
  result.requested = typeof options.requested === 'boolean'
    ? options.requested
    : providedInputs.length > 0;
  result.skippedReason = result.used
    ? null
    : (providedInputs.length > 0 ? 'provided_but_not_used' : 'not_provided');
  result.providedInputs = providedInputs;
  result.usedInputs = usedInputs;
  if (Object.keys(skippedInputs).length > 0) {
    result.skippedInputs = skippedInputs;
  }

  return result;
}

/** Public counts only. Memory identities remain in private memoryRetention. */
export function buildMemorySourceUsage(candidateCount = 0, selectedCount = 0, retainedCount = 0, skippedReason = 'removed_for_budget') {
  const count = (value, cap) => Number.isInteger(value) && value >= 0 ? Math.min(value, cap) : 0;
  const candidatesProvided = count(candidateCount, 100);
  const memoriesSelected = count(selectedCount, 3);
  const memoriesUsedInPrompt = Math.min(count(retainedCount, 3), memoriesSelected);
  return {
    requested: candidatesProvided > 0, used: memoriesUsedInPrompt > 0,
    candidatesProvided, memoriesSelected, memoriesUsedInPrompt,
    skippedReason: memoriesUsedInPrompt ? null : !candidatesProvided ? 'not_provided' : memoriesSelected ? skippedReason : 'not_relevant'
  };
}
