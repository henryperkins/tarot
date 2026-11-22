export const GLM_MODEL = '@cf/zai-org/glm-5.3';
export const GLM_FLASH_MODEL = '@cf/zai-org/glm-5.3-flash';
export const GLM_EFFORTS = ['low', 'high', 'max'];

// Workers AI implements these OpenAI-compatible spellings as maximum effort.
export const GLM_EFFORT_ALIASES = Object.freeze({ minimal: 'max', none: 'max', medium: 'max', xhigh: 'max' });

export function effectiveWorkersEffort(model, effort) {
  if (model !== GLM_MODEL && model !== GLM_FLASH_MODEL) return effort;
  const normalized = typeof effort === 'string' ? effort.trim().toLowerCase() : effort;
  return Object.hasOwn(GLM_EFFORT_ALIASES, normalized) ? GLM_EFFORT_ALIASES[normalized] : normalized;
}
