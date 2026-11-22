import { resolveFeatureConfig } from './aiConfigStore.js';
import { resolveProviderEnvironment } from './providerConnections.js';
import { isAnthropicConfigured } from './anthropicMessages.js';
import { isModalConfigured } from './modalChatCompletions.js';
import { inferAttemptReason } from './inferenceAttempts.js';

// Internal, request-local state. A null entry pins legacy behavior as well.
const PINNED = Symbol('text-feature-policies');
const WORKERS_SETTINGS = {
  'guided-questions': ['QUESTION_MODEL', 'QUESTION_REASONING_EFFORT'],
  'reading-evaluation': ['EVAL_MODEL', 'EVAL_REASONING_EFFORT'],
  'quality-gate': ['EVAL_GATE_MODEL', 'EVAL_GATE_REASONING_EFFORT']
};

export function withTextPolicy(env, featureId, policy) {
  const scoped = { ...env, [PINNED]: { ...env[PINNED], [featureId]: policy } };
  if (!policy) return scoped;
  const fields = WORKERS_SETTINGS[featureId];
  if (fields) {
    scoped[fields[0]] = policy.primary.modelId;
    if (policy.primary.reasoningEffort) scoped[fields[1]] = policy.primary.reasoningEffort;
  }
  for (const step of [policy.primary, ...policy.fallbacks]) {
    if (step.providerId === 'openai-native') scoped.OPENAI_MODEL = step.modelId;
    if (step.providerId === 'claude-api') scoped.ANTHROPIC_MODEL = step.modelId;
    if (step.providerId === 'modal-qwen') scoped.MODAL_MODEL = step.modelId;
  }
  return scoped;
}

export async function loadTextPolicy(env, featureId) {
  if (Object.hasOwn(env[PINNED] || {}, featureId)) return env;
  if (featureId === 'reading-followups' || featureId === 'journal-summaries') {
    env = await resolveProviderEnvironment(env);
  }
  const snapshot = await resolveFeatureConfig(env, featureId);
  return withTextPolicy(env, featureId, snapshot?.policy ?? null);
}

export function withGradingPolicies(env, snapshots) {
  for (const id of ['reading-evaluation', 'quality-gate']) {
    env = withTextPolicy(env, id, snapshots[id]?.policy ?? null);
  }
  return env;
}

export function policyStep(env, featureId, providerId) {
  const policy = env[PINNED]?.[featureId];
  return policy && [policy.primary, ...policy.fallbacks].find(step => step.providerId === providerId);
}

/** Remote public text candidates only. Local delivery and owner routing belong to each feature. */
export async function runRemoteTextChain(env, { featureId, adapters, signal, onAttempt }) {
  const policy = env[PINNED]?.[featureId];
  const providers = policy ? [policy.primary, ...policy.fallbacks].map(step => step.providerId) : Object.keys(adapters);
  let lastError;
  for (const [slot, provider] of providers.entries()) {
    const generate = adapters[provider];
    if (!generate) continue;
    signal?.throwIfAborted();
    const available = provider === 'claude-api' ? isAnthropicConfigured(env)
      : provider === 'modal-qwen' ? isModalConfigured(env) : Boolean(env.OPENAI_API_KEY?.trim());
    if (!available) {
      onAttempt?.({ slot, providerId: provider, outcome: 'skipped', reason: 'unconfigured' });
      continue;
    }
    try {
      const answer = await generate();
      const result = typeof answer === 'string' ? { text: answer } : answer;
      if (!result?.text?.trim()) throw new Error('Empty provider response');
      onAttempt?.({ slot, providerId: provider, outcome: 'accepted', reportedModel: result.model, effortSent: result.effortSent });
      return { ...result, provider };
    } catch (error) {
      onAttempt?.({ slot, providerId: provider, outcome: 'failed', reason: inferAttemptReason(error, signal) });
      signal?.throwIfAborted();
      lastError = error;
    }
  }
  throw lastError || new Error('No configured provider could answer.');
}
