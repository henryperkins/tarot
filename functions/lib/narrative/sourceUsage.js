const USER_CONTEXT_FIELD_CONFIG = Object.freeze({
  question: Object.freeze({
    providedProp: 'questionProvided',
    usedProp: 'questionUsed'
  }),
  reflections: Object.freeze({
    providedProp: 'reflectionsProvided',
    usedProp: 'reflectionsUsed'
  }),
  focusAreas: Object.freeze({
    providedProp: 'focusAreasProvided',
    usedProp: 'focusAreasUsed'
  }),
  displayName: Object.freeze({
    providedProp: 'displayNameProvided',
    usedProp: 'displayNameUsed'
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
  const requested = options.requested !== false;
  const result = {
    requested
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
