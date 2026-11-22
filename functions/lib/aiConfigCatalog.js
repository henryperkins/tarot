import { OPENAI_DEFAULT_MODEL, getReasoningEffort } from './openaiResponses.js';
import { ANTHROPIC_DEFAULT_MODEL, resolveAnthropicSettings, isAnthropicConfigured } from './anthropicMessages.js';
import { MODAL_DEFAULT_MODEL, isModalConfigured } from './modalChatCompletions.js';
import { READING_CONFIG_FIXTURE } from '../../shared/contracts/aiConfigSample.js';
import { PRODUCTION_READING_OVERRIDES } from '../../shared/contracts/aiConfigRelease.js';
import { STORY_ART_MODEL } from './storyArtPrompts.js';
import { getVisualCueReadiness, visualCueReadinessErrors } from './visualCueProvider.js';
import { EMBEDDING_MODEL, isEmbeddingProviderAvailable } from './embeddings.js';
import { getNarrationConfiguration } from './narrationConfig.js';
import { getPersonalTextProvider } from './personalTextProvider.js';
import { getEvalGateFailureMode } from './evalGatePolicy.js';
import { normalizeBooleanFlag, isEvalGateEnabled } from './readingTelemetry.js';
import { getVisionBackendConfiguration } from '../../shared/vision/visionBackends.js';
import { effectiveWorkersEffort, GLM_MODEL as glm, GLM_FLASH_MODEL as flash, GLM_EFFORTS, GLM_EFFORT_ALIASES } from './workersAiReasoning.js';

export const CATALOG_VERSION = '2';
const OPENAI = 'openai-native';
const CLAUDE = 'claude-api';
const MODAL = 'modal-qwen';
const WORKERS = 'workers-ai';
const effortModels = {
  [OPENAI]: new Set([OPENAI_DEFAULT_MODEL, 'gpt-6.1-sol']),
  [CLAUDE]: new Set([ANTHROPIC_DEFAULT_MODEL]),
  [MODAL]: new Set([MODAL_DEFAULT_MODEL]),
  [WORKERS]: new Set([glm, flash])
};
const labels = {
  [OPENAI]: 'OpenAI', [CLAUDE]: 'Anthropic', [MODAL]: 'Modal', [WORKERS]: 'Workers AI',
  'local-composer': 'Local composer', 'local-template': 'Local template', 'local-heuristic': 'Local summary'
};
const definitions = [
  { id: 'readings', label: 'Readings', description: 'Applies to initial and regenerated readings', order: [OPENAI, CLAUDE, MODAL, 'local-composer'], fixtureVersion: 'three-card-story-v1' },
  { id: 'guided-questions', label: 'Guided coach', description: 'Question suggestions before a reading', order: [WORKERS, 'local-template'], modelKey: 'QUESTION_MODEL', effortKey: 'QUESTION_REASONING_EFFORT', defaultModel: glm, effort: 'high' },
  { id: 'reading-followups', label: 'Reading follow-ups', description: 'Conversation after a reading', order: [CLAUDE, OPENAI, MODAL] },
  { id: 'journal-summaries', label: 'Journal summaries', description: 'Patterns across saved readings', order: [CLAUDE, OPENAI, 'local-heuristic'] },
  { id: 'coach-action-extraction', label: 'Coach action extraction', description: 'Extracts actions from eligible journal entries', order: [WORKERS], defaultModel: flash, effort: 'low' },
  { id: 'reading-evaluation', label: 'Reading evaluation', description: 'Grades completed readings in the background', order: [WORKERS], modelKey: 'EVAL_MODEL', effortKey: 'EVAL_REASONING_EFFORT', defaultModel: glm, effort: 'low' },
  { id: 'quality-gate', label: 'Quality gate', description: 'Checks reading quality before delivery', order: [WORKERS], modelKey: 'EVAL_GATE_MODEL', effortKey: 'EVAL_GATE_REASONING_EFFORT', defaultModel: flash, effort: 'low' }
];
export const FEATURE_IDS = definitions.map(feature => feature.id);

export class ConfigError extends Error {
  constructor(status, code, message, field) {
    super(message);
    Object.assign(this, { status, code, field });
  }
}

export function configEnvironment(env) {
  const name = env.AI_CONFIG_ENVIRONMENT;
  return ['local', 'preview', 'production'].includes(name) ? name : 'unconfigured';
}

export function configEnabled(env) {
  return ['true', true].includes(env?.AI_CONFIG_ENABLED) && configEnvironment(env) !== 'unconfigured';
}

function connection(id, env) {
  const missing = [];
  let configured = true;
  if (id === MODAL) {
    configured = isModalConfigured(env);
    if (!env.MODAL_ENDPOINT_URL) missing.push('MODAL_ENDPOINT_URL');
    const usesPair = env.MODAL_PROXY_TOKEN_ID !== undefined || env.MODAL_PROXY_TOKEN_SECRET !== undefined;
    if (usesPair || !env.MODAL_PROXY_TOKEN) {
      missing.push(...['MODAL_PROXY_TOKEN_ID', 'MODAL_PROXY_TOKEN_SECRET'].filter(key => !env[key]?.trim()));
    }
  } else if (id === WORKERS) {
    configured = typeof env.AI?.run === 'function';
    if (!configured) missing.push('AI');
  } else if (id === CLAUDE || id === OPENAI) {
    const key = id === OPENAI ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    configured = id === CLAUDE ? isAnthropicConfigured(env) : Boolean(env[key]?.trim());
    if (!configured) missing.push(key);
  }
  return { id, label: labels[id], configured, missing };
}

export function listConnections(env) {
  return Object.keys(labels).map(id => ({
    ...connection(id, env), features: definitions.filter(item => item.order.includes(id)).map(item => item.id)
  }));
}

function stepFor(id, feature, env) {
  if (id.startsWith('local-')) return { providerId: id };
  let modelId, reasoningEffort;
  if (id === OPENAI) {
    modelId = env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
    if (feature.id === 'readings') reasoningEffort = getReasoningEffort(env, modelId);
    if (feature.id === 'journal-summaries') reasoningEffort = 'medium';
    // Follow-ups have different inherited effort for JSON, streaming and tool continuations.
  } else if (id === CLAUDE) {
    const settings = resolveAnthropicSettings(env);
    modelId = settings.model;
    reasoningEffort = feature.id === 'readings' ? settings.effort : 'medium';
  } else if (id === MODAL) {
    modelId = env.MODAL_MODEL || MODAL_DEFAULT_MODEL;
    reasoningEffort = env.MODAL_REASONING_EFFORT || 'high';
  } else {
    modelId = env[feature.modelKey] || feature.defaultModel;
    reasoningEffort = effectiveWorkersEffort(modelId, env[feature.effortKey] || feature.effort);
    if (!GLM_EFFORTS.includes(reasoningEffort)) reasoningEffort = feature.id === 'guided-questions' ? feature.effort : null;
  }
  // A custom deployment model remains usable through its adapter's task
  // defaults. Expose effort choices only for models in the capability catalog.
  return { providerId: id, modelId, ...(effortModels[id].has(modelId) && reasoningEffort && { reasoningEffort }) };
}

function modelsFor(id, step) {
  if (!step.modelId) return [];
  const ids = [step.modelId];
  let efforts = ['low', 'medium', 'high', 'xhigh'];
  if (id === OPENAI) {
    ids.push(OPENAI_DEFAULT_MODEL, 'gpt-6.1-sol');
  } else if (id === CLAUDE) {
    efforts.push('max');
  } else if (id === WORKERS) {
    ids.push(glm, flash);
    efforts = GLM_EFFORTS;
  }
  if (id !== WORKERS && step.reasoningEffort && !efforts.includes(step.reasoningEffort)) efforts.push(step.reasoningEffort);
  const names = { [glm]: 'GLM-5.3', [flash]: 'GLM-5.3-Flash', 'claude-opus-5-5': 'Claude Opus 5.5', [MODAL_DEFAULT_MODEL]: 'Qwen3.8-Max-VL-Thinking' };
  return [...new Set(ids)].map(model => ({
    id: model, label: names[model] || model, efforts: effortModels[id].has(model) ? efforts : [],
    ...(id === WORKERS && effortModels[id].has(model) && { effortAliases: GLM_EFFORT_ALIASES })
  }));
}

export function publicTextRestriction(env) {
  try {
    return getPersonalTextProvider(env) ? 'This deployment uses an owner subscription for this feature.' : null;
  } catch {
    return 'Invalid TEXT_PROVIDER setting. Configure a supported text provider for this deployment.';
  }
}

export function getFeature(env, id) {
  const def = definitions.find(item => item.id === id);
  if (!def) throw new ConfigError(404, 'unknown_feature', 'Unknown feature.');
  const steps = def.order.map(provider => stepFor(provider, def, env));
  const deploymentAlias = def.order[0] === WORKERS && effortAlias(
    { providerId: WORKERS, modelId: glm }, env[def.effortKey], 'deployment'
  );
  const providers = steps.map(step => {
    const provider = step.providerId;
    const primaryEligible = !provider.startsWith('local-') && (provider !== MODAL || (id === 'readings' && configEnvironment(env) !== 'production'));
    return { ...connection(provider, env), primaryEligible, models: modelsFor(provider, step) };
  });
  let description = def.description;
  const gatePolicy = id === 'quality-gate' && {
    globalEnabled: isEvalGateEnabled(env), gradingEnabled: normalizeBooleanFlag(env.EVAL_ENABLED),
    failureMode: getEvalGateFailureMode(env)
  };
  if (gatePolicy) description += gatePolicy.globalEnabled ? ' · Global gate enabled' : ' · Selective';
  const publicText = [OPENAI, CLAUDE].includes(def.order[0]);
  let readOnlyReason = publicText && publicTextRestriction(env);
  if (!configEnabled(env)) readOnlyReason = 'Configuration editing is disabled for this deployment.';
  else if (!readOnlyReason && !featureOverridesAllowed(env, id)) readOnlyReason = 'Production Readings uses the deployed release settings.';
  return {
    id, label: def.label, description, group: FEATURE_IDS.indexOf(id) < 4 ? 'reader' : 'background',
    fixtureVersion: def.fixtureVersion || id + '-v1', providers, ...(gatePolicy && { gatePolicy }),
    ...(id === 'readings' && { fixture: { question: READING_CONFIG_FIXTURE.question, spread: 'Three-Card Story · All upright', cards: READING_CONFIG_FIXTURE.cards } }),
    writable: !readOnlyReason, ...(readOnlyReason && { readOnlyReason }),
    effortAlias: effortAlias(steps[0], env[def.effortKey], 'deployment'),
    ...(deploymentAlias && { deploymentEffortAlias: deploymentAlias }),
    policy: { primary: steps[0], fallbacks: steps.slice(1) }
  };
}

export function featureOverridesAllowed(env, id) {
  return id !== 'readings' || configEnvironment(env) !== 'production' || PRODUCTION_READING_OVERRIDES;
}

export function checkFields(value, allowed, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new ConfigError(422, 'invalid_fields', 'Unexpected or invalid configuration fields.', field);
  }
}

function invalid(message, field) {
  throw new ConfigError(422, 'invalid_policy', message, field);
}

export function effortAlias(step, original, source) {
  if (step.providerId !== WORKERS || typeof original !== 'string') return null;
  const effective = effectiveWorkersEffort(step.modelId, original);
  return effective === 'max' && original.trim().toLowerCase() !== effective
    ? { source, original, effective } : null;
}

export function normalizePolicy(feature, policy, { legacy = false, retiredModels } = {}) {
  checkFields(policy, ['primary', 'fallbacks'], 'policy');
  if (!Array.isArray(policy.fallbacks) || policy.fallbacks.length !== feature.providers.length - 1) invalid('Include each fallback exactly once.', 'fallbacks');
  const steps = [policy.primary, ...policy.fallbacks].map((step, index) => {
    const path = index ? 'fallbacks.' + (index - 1) : 'primary';
    checkFields(step, ['providerId', 'modelId', 'reasoningEffort'], path);
    const adapter = feature.providers.find(item => item.id === step.providerId);
    if (!adapter || (!index && !adapter.primaryEligible)) invalid('Unsupported provider for this position.', path + '.providerId');
    if (!adapter.models.length) {
      if (step.modelId !== undefined || step.reasoningEffort !== undefined) invalid('Local fallback has no model options.', path);
      return { providerId: adapter.id };
    }
    const model = adapter.models.find(item => item.id === step.modelId);
    if (!model) {
      if (!retiredModels || typeof step.modelId !== 'string' || !step.modelId) invalid('Choose a supported model.', path + '.modelId');
      if (step.reasoningEffort !== undefined && typeof step.reasoningEffort !== 'string') invalid('Invalid saved effort.', path);
      retiredModels.push({ providerId: adapter.id, modelId: step.modelId, slot: index });
      return { ...step };
    }
    const effort = legacy && adapter.id === WORKERS ? effectiveWorkersEffort(model.id, step.reasoningEffort) : step.reasoningEffort;
    if (effort !== undefined && !model.efforts.includes(effort)) invalid('Unsupported reasoning effort.', path + '.reasoningEffort');
    return { providerId: adapter.id, modelId: model.id, ...(effort && { reasoningEffort: effort }) };
  });
  const ids = steps.map(step => step.providerId);
  if (new Set(ids).size !== ids.length) invalid('Each provider can appear only once.', 'fallbacks');
  const terminal = feature.providers.at(-1);
  if (!terminal.primaryEligible && ids.at(-1) !== terminal.id) invalid('The final fallback is fixed.', 'fallbacks');
  return { primary: steps[0], fallbacks: steps.slice(1) };
}

export function specialistInventory(env) {
  const vision = getVisionBackendConfiguration(env.VISION_BACKEND_DEFAULT, env);
  const visual = getVisualCueReadiness(env);
  const workersAvailable = typeof env.AI?.run === 'function';
  const bindingStatus = 'Workers AI binding unavailable';
  const artStatus = env.FEATURE_STORY_ART === 'true' ? (workersAvailable ? 'Ready' : bindingStatus) : 'Disabled';
  function narration(id, name) {
    const provider = getNarrationConfiguration(env, id);
    return { label: 'Narration · ' + name, value: provider.model, status: provider.available ? 'Ready' : 'Unavailable' };
  }
  return [
    { label: 'Card recognition', value: vision.id, status: vision.missing.length ? bindingStatus : 'Configured backend' },
    { label: 'Visual cues', value: (typeof env.VISUAL_CUE_MODEL === 'string' && env.VISUAL_CUE_MODEL.trim()) || 'No model selected',
      status: visual.ready ? 'Ready' : visualCueReadinessErrors[visual.reason] },
    { label: 'Semantic embeddings', value: EMBEDDING_MODEL, status: isEmbeddingProviderAvailable(env) ? 'Ready' : bindingStatus },
    { label: 'Story illustrations', value: STORY_ART_MODEL, status: artStatus },
    narration('deepgram', 'Deepgram'),
    narration('elevenlabs', 'ElevenLabs')
  ];
}
