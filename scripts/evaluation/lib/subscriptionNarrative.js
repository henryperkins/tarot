import { generateWithClaudeApi, generateWithOpenAIResponses, CLAUDE_API_READING_MAX_TOKENS, NARRATIVE_BACKEND_ORDER } from '../../../functions/lib/narrativeBackends.js';
import { resolveAnthropicSettings } from '../../../functions/lib/anthropicMessages.js';
import { OPENAI_DEFAULT_MODEL, getReasoningEffort, getTextVerbosity, resolveOpenAITimeoutMs } from '../../../functions/lib/openaiResponses.js';
import { callClaudeCode, ensureClaudeCodeConfig } from '../../../functions/lib/claudeCode.js';
import { runClaudeCode, verifySubscriptionLogin } from '../../../services/claude-code/runner.mjs';
import { runCodexSubscription, verifyCodexSubscriptionLogin } from '../../../services/codex-subscription/runner.mjs';

// The owner authorized paid OpenAI generation to grade OpenAI readings. Its key
// travels under this name so OPENAI_API_KEY never reaches the unit suites or the
// offline prompt verifier, which refuse provider credentials.
export const OPENAI_EVAL_KEY_VARIABLE = 'NARRATIVE_EVAL_OPENAI_API_KEY';

// Provider credentials that must never reach the unit suites or the offline
// prompt verifier. The deterministic qualification gate refuses to run while
// any of these is present, so release QA strips the full set (not only the
// OpenAI keys) from every check except the narrative generation that uses one.
export const UNIT_SUITE_CREDENTIAL_ENV_KEYS = Object.freeze([
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN',
  'MODAL_PROXY_TOKEN', 'WANDB_API_KEY', 'AZURE_OPENAI_API_KEY'
]);

export function resolveNarrativeEvalBackend(value, { requireLive = false } = {}) {
  const backend = String(value || 'claude-code').trim().toLowerCase();
  if (['', 'auto', 'claude-code'].includes(backend)) return 'claude-code';
  if (['codex-subscription', 'openai-native'].includes(backend)) return backend;
  if (['local', 'local-composer'].includes(backend) && !requireLive) return 'local-composer';
  if (!['local', 'local-composer', 'claude-api', 'modal-qwen'].includes(backend)) {
    throw new Error(`Unknown backend "${value}"`);
  }
  throw new Error('Narrative qualification supports Claude Code, the ChatGPT subscription and the OpenAI Responses API; other paid API backends are disabled and local-composer is diagnostic only.');
}

// A subscription must serve the same provider family as the production primary.
export function resolveReleaseNarrativeBackend(value, order = NARRATIVE_BACKEND_ORDER) {
  const primary = order[0];
  const expected = { 'openai-native': 'openai-native', 'claude-api': 'claude-code' }[primary];
  if (!expected) throw new Error(`No release narrative gate is defined for the primary provider ${primary}.`);
  const requested = String(value || '').trim().toLowerCase();
  if (['', 'auto'].includes(requested)) return expected;
  const backend = resolveNarrativeEvalBackend(requested, { requireLive: true });
  if (primary === 'openai-native' && backend === 'codex-subscription') return backend;
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

export function describeOpenAINarrativeConfig(env, backend = 'openai-native') {
  const model = env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  const transport = backend === 'codex-subscription'
    ? { authentication: 'personal-subscription', transport: 'codex-app-server', modelSource: 'configured' }
    : { authentication: 'api-key', transport: 'openai-responses' };
  return { provider: backend, model, ...transport, deadlineMs: resolveOpenAITimeoutMs(env),
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

export async function verifyNarrativeSubscription(env, backend = 'claude-code') {
  if (backend === 'codex-subscription') {
    await verifyCodexSubscriptionLogin({ hostEnv: env, signal: AbortSignal.timeout(30000) });
    return;
  }
  if (usesGateway(env)) {
    ensureClaudeCodeConfig(env);
    return;
  }
  await verifySubscriptionLogin({ hostEnv: env, signal: AbortSignal.timeout(30000) });
}

async function withSubscriptionDeadline(signal, timeoutMs, run) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const timer = setTimeout(cancel, timeoutMs);
  timer.unref();
  if (signal?.aborted) cancel();
  try {
    const result = await run(controller.signal);
    if (controller.signal.aborted) throw new Error('Subscription request was cancelled.');
    return result;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

export function runCodexSubscriptionNarrative(env, payload, requestId, run = runCodexSubscription) {
  const model = env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL;
  return generateWithOpenAIResponses(env, payload, requestId, {
    provider: 'codex-subscription',
    send: (_env, { instructions, input, reasoningEffort, verbosity, signal }) =>
      withSubscriptionDeadline(signal, resolveOpenAITimeoutMs(env), async deadlineSignal => {
        const result = await run({
          task: 'reading', systemPrompt: instructions, messages: [{ role: 'user', content: input }],
          model, effort: reasoningEffort
        }, {
          hostEnv: env, signal: deadlineSignal, verbosity,
          // App-server verifies the selected model and rejects rerouting. The gate grades the complete text.
          onDelta: () => {}
        });
        if (result.provider !== 'codex-subscription' || result.model !== model) {
          throw new Error('The ChatGPT subscription did not return the selected production model.');
        }
        return result;
      })
  });
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
      return withSubscriptionDeadline(signal, timeoutMs, async deadlineSignal => {
        const completion = usesGateway(env)
          ? await callClaudeCode(env, { ...input, signal: deadlineSignal })
          : await runClaudeCode(input, { signal: deadlineSignal, hostEnv: env });
        if (completion.model !== settings.model) {
          throw new Error(`Claude subscription answered with ${completion.model || 'an unknown model'} instead of ${settings.model}.`);
        }
        return { text: completion.text, model: completion.model, usage: completion.usage };
      });
    }
  });
}
