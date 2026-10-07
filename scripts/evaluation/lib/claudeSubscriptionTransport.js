import { resolveAnthropicSettings } from '../../../functions/lib/anthropicMessages.js';
import { CLAUDE_API_READING_MAX_TOKENS } from '../../../functions/lib/narrativeBackends.js';
import { runClaudeCode } from '../../../services/claude-code/runner.mjs';

// Release QA backend: the claude-api reading request, sent through the owner's
// Claude Code subscription login instead of the per-token API key.
export const CLAUDE_SUBSCRIPTION_BACKEND = 'claude-subscription';

/**
 * Drop-in for callClaudeMessages. Model, effort and deadline come from the same
 * ANTHROPIC_* settings the API path reads, and maxTokens becomes the CLI's
 * output ceiling, so only billing differs from a production Claude reading.
 */
export function createClaudeSubscriptionSend({ hostEnv = process.env, run = runClaudeCode } = {}) {
  return async (env, { system, messages, maxTokens, effort, tools, signal }) => {
    if (Array.isArray(tools) && tools.length) {
      throw new Error('Claude subscription QA does not support client tools.');
    }
    const settings = resolveAnthropicSettings(env);
    const deadline = AbortSignal.timeout(settings.timeoutMs);
    const result = await run({
      task: 'reading',
      systemPrompt: system,
      messages,
      model: settings.model,
      effort: effort || settings.effort,
      maxOutputTokens: maxTokens
    }, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline, hostEnv });
    // A silent model fallback would qualify the wrong model.
    if (result.model !== settings.model) {
      throw new Error(`Claude Code answered with ${result.model || 'an unknown model'} instead of ${settings.model}.`);
    }
    return { text: result.text, model: result.model, usage: result.usage };
  };
}

export function describeClaudeSubscriptionConfig(env) {
  const { model, effort } = resolveAnthropicSettings(env);
  return {
    provider: 'claude-code',
    authentication: 'personal-subscription',
    parityWith: 'claude-api',
    model,
    reasoningEffort: effort,
    maxTokens: CLAUDE_API_READING_MAX_TOKENS,
    verbosity: null
  };
}
