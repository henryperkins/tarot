import { buildAzureGPT5Prompts, runNarrativeBackend } from '../../../functions/lib/narrativeBackends.js';
import { runClaudeCode } from '../../../services/claude-code/runner.mjs';

export function resolveNarrativeEvalBackend(value, { requireLive = false } = {}) {
  const backend = String(value || 'claude-code').trim().toLowerCase();
  if (['', 'auto', 'claude-code'].includes(backend)) return 'claude-code';
  if (['local', 'local-composer'].includes(backend) && !requireLive) return 'local-composer';
  if (!['local', 'local-composer', 'claude-api', 'modal-qwen', 'azure-gpt5'].includes(backend)) {
    throw new Error(`Unknown backend "${value}"`);
  }
  throw new Error('Narrative qualification requires the Claude subscription (claude-code); paid API backends are disabled and local-composer is diagnostic only.');
}

// Node-only evaluation uses the host's verified login directly. Remote build
// runners can instead use the existing private subscription gateway. An invalid
// or unavailable configured gateway never switches to another inference path.
export async function runSubscriptionNarrative(env, payload, requestId) {
  const subscriptionEnv = { ...env, TEXT_PROVIDER: 'claude-code' };
  if (env.CLAUDE_CODE_GATEWAY_URL || env.CLAUDE_CODE_GATEWAY_TOKEN) {
    return runNarrativeBackend('claude-code', subscriptionEnv, payload, requestId);
  }
  const { systemPrompt, userPrompt, promptMeta } = buildAzureGPT5Prompts(subscriptionEnv, payload, requestId, {
    backendId: 'claude-code', providerLabel: 'Claude Code subscription', budgetTarget: 'claude'
  });
  const configuredTimeout = Number(env.CLAUDE_CODE_TIMEOUT_MS || 300000);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(600000, Math.max(1000, configuredTimeout)) : 300000;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  payload.signal?.addEventListener('abort', cancel, { once: true });
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const timer = setTimeout(cancel, timeoutMs);
  timer.unref();
  if (payload.signal?.aborted) cancel();
  try {
    const completion = await runClaudeCode({
      task: 'reading', systemPrompt, messages: [{ role: 'user', content: userPrompt }]
    }, { signal: controller.signal, hostEnv: env });
    if (controller.signal.aborted) throw new Error('Claude subscription request was cancelled.');
    promptMeta.inference = { provider: 'claude-code', model: completion.model };
    return { reading: completion.text, model: completion.model, usage: completion.usage,
      prompts: { system: systemPrompt, user: userPrompt }, promptMeta };
  } finally {
    clearTimeout(timer);
    payload.signal?.removeEventListener('abort', cancel);
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}
