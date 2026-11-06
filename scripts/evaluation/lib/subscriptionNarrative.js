import { generateWithClaudeApi, CLAUDE_API_READING_MAX_TOKENS, NARRATIVE_BACKEND_ORDER } from '../../../functions/lib/narrativeBackends.js';
import { resolveAnthropicSettings } from '../../../functions/lib/anthropicMessages.js';
import { OPENAI_DEFAULT_MODEL, getReasoningEffort, getTextVerbosity } from '../../../functions/lib/openaiResponses.js';
import { callClaudeCode, ensureClaudeCodeConfig } from '../../../functions/lib/claudeCode.js';
import { runClaudeCode, verifySubscriptionLogin } from '../../../services/claude-code/runner.mjs';

// The owner authorized paid OpenAI generation to grade OpenAI readings. Its key
// travels under this name so OPENAI_API_KEY never reaches the unit suites or the
// offline prompt verifier, which refuse provider credentials.
export const OPENAI_EVAL_KEY_VARIABLE = 'NARRATIVE_EVAL_OPENAI_API_KEY';

export function resolveNarrativeEvalBackend(value, { requireLive = false } = {}) {
  const backend = String(value || 'claude-code').trim().toLowerCase();
  if (['', 'auto', 'claude-code'].includes(backend)) return 'claude-code';
  if (backend === 'openai-native') return 'openai-native';
  if (['local', 'local-composer'].includes(backend) && !requireLive) return 'local-composer';
  if (!['local', 'local-composer', 'claude-api', 'modal-qwen'].includes(backend)) {
    throw new Error(`Unknown backend "${value}"`);
  }
  throw new Error('Narrative qualification uses the Claude subscription (claude-code) or the explicitly selected production OpenAI backend (openai-native); other paid API backends are disabled and local-composer is diagnostic only.');
}

// The release gate grades readings from the production primary provider. The
// subscription stands in for claude-api; openai-native is called directly.
export function resolveReleaseNarrativeBackend(value, order = NARRATIVE_BACKEND_ORDER) {
  const primary = order[0];
  const expected = { 'openai-native': 'openai-native', 'claude-api': 'claude-code' }[primary];
  if (!expected) throw new Error(`No release narrative gate is defined for the primary provider ${primary}.`);
  const requested = String(value || '').trim().toLowerCase();
  if (['', 'auto'].includes(requested)) return expected;
  const backend = resolveNarrativeEvalBackend(requested, { requireLive: true });
  if (backend !== expected) {
    throw new Error(`The release gate grades readings from the production primary provider (${primary}); NARRATIVE_EVAL_BACKEND=${requested} would not qualify it.`);
  }
  return backend;
}

// Generation alone receives the key, as the production variable, in this process.
export function applyOpenAIEvalCredentials(env) {
  const { [OPENAI_EVAL_KEY_VARIABLE]: rawKey, ...rest } = env;
  const key = String(rawKey || '').trim();
  if (!key) throw new Error(`Grading OpenAI readings needs ${OPENAI_EVAL_KEY_VARIABLE}; the gate never falls back to another provider.`);
  return { ...rest, OPENAI_API_KEY: key, TEXT_PROVIDER: 'legacy' };
}

export function describeOpenAINarrativeConfig(env) {
  const model = env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  return { provider: 'openai-native', model, authentication: 'api-key', transport: 'openai-responses',
    parityWith: 'openai-native', reasoningEffort: getReasoningEffort(env, model) ?? null,
    verbosity: getTextVerbosity(env, model) ?? null };
}

function usesGateway(env) {
  return Boolean(env.CLAUDE_CODE_GATEWAY_URL || env.CLAUDE_CODE_GATEWAY_TOKEN);
}

export function describeSubscriptionNarrativeConfig(env) {
  const { model, effort } = resolveAnthropicSettings(env);
  return { provider: 'claude-code', model, authentication: 'personal-subscription',
    transport: usesGateway(env) ? 'gateway' : 'local-cli', parityWith: 'claude-api',
    reasoningEffort: effort, maxTokens: CLAUDE_API_READING_MAX_TOKENS };
}

export async function verifyNarrativeSubscription(env) {
  if (usesGateway(env)) {
    ensureClaudeCodeConfig(env);
    return;
  }
  await verifySubscriptionLogin({ hostEnv: env, signal: AbortSignal.timeout(30000) });
}

// Reuse the production Claude reading request. Only its transport changes;
// an unavailable configured gateway never falls back to local or paid inference.
export async function runSubscriptionNarrative(env, payload, requestId) {
  return generateWithClaudeApi(env, payload, requestId, {
    provider: 'claude-code',
    send: async (_env, { system, messages, maxTokens, effort, signal }) => {
      const settings = resolveAnthropicSettings(env);
      const input = { task: 'reading', systemPrompt: system, messages,
        model: settings.model, effort: effort || settings.effort, maxOutputTokens: maxTokens };
      const configuredTimeout = Number(env.CLAUDE_CODE_TIMEOUT_MS || settings.timeoutMs);
      const timeoutMs = Number.isFinite(configuredTimeout)
        ? Math.min(settings.timeoutMs, Math.max(1000, configuredTimeout)) : settings.timeoutMs;
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      process.once('SIGINT', cancel);
      process.once('SIGTERM', cancel);
      const timer = setTimeout(cancel, timeoutMs);
      timer.unref();
      if (signal?.aborted) cancel();
      try {
        const completion = usesGateway(env)
          ? await callClaudeCode(env, { ...input, signal: controller.signal })
          : await runClaudeCode(input, { signal: controller.signal, hostEnv: env });
        if (controller.signal.aborted) throw new Error('Claude subscription request was cancelled.');
        if (completion.model !== settings.model) {
          throw new Error(`Claude subscription answered with ${completion.model || 'an unknown model'} instead of ${settings.model}.`);
        }
        return { text: completion.text, model: completion.model, usage: completion.usage };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
      }
    }
  });
}
