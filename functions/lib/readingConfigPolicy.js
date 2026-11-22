import { resolveFeatureConfig } from './aiConfigStore.js';
import { configEnabled } from './aiConfigCatalog.js';
import { isPersonalTextProviderEnabled } from './personalTextProvider.js';

const ADAPTER_KEYS = {
  'openai-native': ['OPENAI_MODEL', 'OPENAI_REASONING_EFFORT'],
  'claude-api': ['ANTHROPIC_MODEL', 'ANTHROPIC_EFFORT'],
  'modal-qwen': ['MODAL_MODEL', 'MODAL_REASONING_EFFORT']
};
const DEFAULT_KEYS = [
  ...Object.values(ADAPTER_KEYS).flat(),
  'EVAL_MODEL', 'EVAL_REASONING_EFFORT', 'EVAL_GATE_MODEL', 'EVAL_GATE_REASONING_EFFORT'
];

// The only configuration carried in a job is its resolved, non-secret policy.
// A failed admission read is remembered so crisis support can still take
// precedence. Never retry the lookup against a newer revision during the job.
export async function snapshotFeature(env, featureId) {
  try {
    const config = await resolveFeatureConfig(env, featureId);
    return config ? { revision: config.revision, policy: config.policy } : null;
  } catch {
    return { unavailable: true };
  }
}

export async function snapshotReadingPolicies(env, readingOverride) {
  const [readings, evaluation, gate] = await Promise.all([
    readingOverride !== undefined ? readingOverride
      : isPersonalTextProviderEnabled(env) ? null : snapshotFeature(env, 'readings'),
    snapshotFeature(env, 'reading-evaluation'),
    snapshotFeature(env, 'quality-gate')
  ]);
  // Task-default fields still inherit deployment bindings. Snapshot those
  // allowlisted values too, so a later deployment cannot change an admitted
  // job's model while its stored feature revision remains the same.
  const defaults = configEnabled(env) ? Object.fromEntries(DEFAULT_KEYS.map(key => [key, env[key] ?? null])) : null;
  return { readings, 'reading-evaluation': evaluation, 'quality-gate': gate, defaults };
}

export function withReadingPolicy(env, policy, defaults = null) {
  if (defaults) {
    env = { ...env };
    for (const key of DEFAULT_KEYS) env[key] = defaults[key] ?? undefined;
  }
  if (!policy || isPersonalTextProviderEnabled(env)) return env;
  const scoped = { ...env };
  for (const step of [policy.primary, ...policy.fallbacks]) {
    const keys = ADAPTER_KEYS[step.providerId];
    if (!keys) continue;
    scoped[keys[0]] = step.modelId;
    if (step.reasoningEffort) scoped[keys[1]] = step.reasoningEffort;
  }
  return scoped;
}
