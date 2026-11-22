import { sha256Hex } from './crypto.js';
import { resolveOpenAITimeoutMs, getReasoningEffort } from './openaiResponses.js';
import { resolveAnthropicSettings } from './anthropicMessages.js';
import { READING_BUFFERED_ATTEMPT_MAX_MS, getTaskTimeoutMs } from './requestDeadline.js';
import { isOpenAITokenStreamingEnabled } from './readingTelemetry.js';

export function productionOpenAIDeadline(env = {}) {
  const deadlines = [resolveOpenAITimeoutMs(env), getTaskTimeoutMs(env, 'reading')];
  if (!isOpenAITokenStreamingEnabled(env)) deadlines.push(READING_BUFFERED_ATTEMPT_MAX_MS);
  return Math.min(...deadlines);
}

export async function describeReleaseReading(env, feature) {
  const { providerId, modelId, reasoningEffort } = feature.policy.primary;
  const openai = providerId === 'openai-native';
  const anthropic = resolveAnthropicSettings(env);
  const effort = reasoningEffort || (openai ? getReasoningEffort(env, modelId) : anthropic.effort);
  const deadlineMs = openai ? productionOpenAIDeadline(env)
    : Math.min(anthropic.timeoutMs, getTaskTimeoutMs(env, 'reading'), READING_BUFFERED_ATTEMPT_MAX_MS);
  const settings = { environment: 'production', revision: feature.revision, providerId, modelId, reasoningEffort: effort, deadlineMs };
  return { ...settings, fingerprint: await sha256Hex(JSON.stringify(settings)) };
}
