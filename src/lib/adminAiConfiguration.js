export const AI_ADMIN_PATH = '/api/admin/ai-configuration';

export function hasRetiredModel(feature, policy) {
  return [policy.primary, ...policy.fallbacks].some(step =>
    step.modelId && !feature.providers.find(provider => provider.id === step.providerId)?.models.some(model => model.id === step.modelId)
  );
}

export function displayValue(value) {
  if (value == null || value === '') return 'Task default';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function providerLabel(feature, id) {
  const localLabels = {
    'local-composer': 'Local composer',
    'local-heuristic': 'Local heuristic',
    'local-template': 'Local template'
  };
  return feature.providers.find(provider => provider.id === id)?.label || localLabels[id] || id;
}

export function modelLabel(feature, step) {
  return feature.providers.find(provider => provider.id === step.providerId)
    ?.models.find(model => model.id === step.modelId)?.label || step.modelId;
}

// Canonicalize only the fields in the editable policy. The server can serialize
// the same policy in a different property order and omit inherited settings.
export function policyKey(policy) {
  const stepKey = step => [step.providerId, step.modelId || null, step.reasoningEffort || null];
  return JSON.stringify([stepKey(policy.primary), ...policy.fallbacks.map(stepKey)]);
}

export function changePrimary(policy, provider) {
  const existing = policy.fallbacks.find(step => step.providerId === provider.id);
  const primary = existing || { providerId: provider.id, modelId: provider.models[0].id };
  return {
    primary,
    fallbacks: policy.fallbacks.map(step => step === existing ? policy.primary : step)
  };
}

// Keep the latest provider order and adapter settings unless this editor changed them.
// A primary swap alone has no intent to reorder the other remote fallbacks.
export function reapplyPolicyEdits(original, edited, latest, feature) {
  const originalSteps = [original.primary, ...original.fallbacks];
  const editedSteps = [edited.primary, ...edited.fallbacks];
  function withPrimary(policy) {
    if (original.primary.providerId === edited.primary.providerId) return policy;
    const target = policy.fallbacks.find(step => step.providerId === edited.primary.providerId);
    if (!target) return policy;
    return { primary: target, fallbacks: policy.fallbacks.map(step => step === target ? policy.primary : step) };
  }
  const rebased = withPrimary(latest);
  const ids = steps => steps.map(step => step.providerId).join('/');
  let fallbacks = rebased.fallbacks;
  if (ids(withPrimary(original).fallbacks) !== ids(edited.fallbacks)) {
    const common = edited.fallbacks.map(step => fallbacks.find(item => item.providerId === step.providerId)).filter(Boolean);
    const movable = new Set(common.map(item => item.providerId));
    let index = 0;
    fallbacks = fallbacks.map(step => movable.has(step.providerId) ? common[index++] : step);
  }
  function mergeStep(step) {
    const before = originalSteps.find(item => item.providerId === step.providerId);
    const after = editedSteps.find(item => item.providerId === step.providerId);
    if (!before || !after) return step;
    const merged = { ...step };
    for (const field of ['modelId', 'reasoningEffort']) {
      if (before[field] === after[field]) continue;
      if (after[field] == null) delete merged[field];
      else merged[field] = after[field];
    }
    const model = feature?.providers.find(provider => provider.id === merged.providerId)?.models.find(item => item.id === merged.modelId);
    if (model?.effortAliases && Object.hasOwn(model.effortAliases, merged.reasoningEffort)) {
      merged.reasoningEffort = model.effortAliases[merged.reasoningEffort];
    }
    return merged;
  }
  return { primary: mergeStep(rebased.primary), fallbacks: fallbacks.map(mergeStep) };
}

export function policyChanges(feature, saved, draft) {
  const changes = [];
  if (saved.primary.providerId !== draft.primary.providerId) {
    changes.push('Provider changed from ' + providerLabel(feature, saved.primary.providerId) + ' to ' + providerLabel(feature, draft.primary.providerId));
  }
  if (saved.primary.modelId !== draft.primary.modelId) {
    changes.push('Model changed from ' + modelLabel(feature, saved.primary) + ' to ' + modelLabel(feature, draft.primary));
  }
  if (saved.primary.reasoningEffort !== draft.primary.reasoningEffort) {
    changes.push('Reasoning effort changed from ' + displayValue(saved.primary.reasoningEffort) + ' to ' + displayValue(draft.primary.reasoningEffort));
  }
  if (saved.fallbacks.map(step => step.providerId).join('/') !== draft.fallbacks.map(step => step.providerId).join('/')) {
    changes.push('Fallback order changed');
  }
  for (const step of draft.fallbacks) {
    const before = [saved.primary, ...saved.fallbacks].find(item => item.providerId === step.providerId);
    if (!before) continue;
    const name = providerLabel(feature, step.providerId);
    if (before.modelId !== step.modelId) changes.push(name + ' fallback model changed to ' + modelLabel(feature, step));
    if (before.reasoningEffort !== step.reasoningEffort) changes.push(name + ' fallback effort changed to ' + displayValue(step.reasoningEffort));
  }
  return changes;
}

export async function requestAiConfig(apiKey, path = '', { signal, method = 'GET', body } = {}) {
  const response = await fetch(AI_ADMIN_PATH + path, {
    signal, method, cache: 'no-store', redirect: 'error', credentials: 'same-origin',
    headers: { Authorization: 'Bearer ' + apiKey, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed (' + response.status + ').');
    error.status = response.status;
    error.code = payload.code;
    error.field = payload.field;
    throw error;
  }
  return payload;
}
