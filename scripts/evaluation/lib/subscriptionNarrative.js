import { generateWithClaudeApi, CLAUDE_API_READING_MAX_TOKENS } from '../../../functions/lib/narrativeBackends.js';
import { resolveAnthropicSettings } from '../../../functions/lib/anthropicMessages.js';
import { callClaudeCode, ensureClaudeCodeConfig } from '../../../functions/lib/claudeCode.js';
import { runClaudeCode, verifySubscriptionLogin } from '../../../services/claude-code/runner.mjs';

export function resolveNarrativeEvalBackend(value, { requireLive = false } = {}) {
  const backend = String(value || 'claude-code').trim().toLowerCase();
  if (['', 'auto', 'claude-code'].includes(backend)) return 'claude-code';
  if (['local', 'local-composer'].includes(backend) && !requireLive) return 'local-composer';
  if (!['local', 'local-composer', 'claude-api', 'modal-qwen', 'azure-gpt5'].includes(backend)) {
    throw new Error(`Unknown backend "${value}"`);
  }
  throw new Error('Narrative qualification requires the Claude subscription (claude-code); paid API backends are disabled and local-composer is diagnostic only.');
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
