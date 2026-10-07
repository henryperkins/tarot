/**
 * Claude Messages API client (Anthropic API, billed per token).
 *
 * Serves every user once ANTHROPIC_API_KEY is set. The personal-subscription
 * gateway in claudeCode.js is a separate, owner-only mode.
 */

import Anthropic from '@anthropic-ai/sdk';
import { observeInferenceAttempt } from './inferenceAttempts.js';

export const CLAUDE_API_PROVIDER = 'claude-api';
export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5';
export const ANTHROPIC_DEFAULT_EFFORT = 'xhigh';

const ANTHROPIC_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const DEFAULT_TIMEOUT_MS = 300000;
const MAX_TIMEOUT_MS = 600000;
// A classifier decline is retried server-side on the model Anthropic
// recommends for that category, inside the same call.
const REFUSAL_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export class ClaudeApiError extends Error {}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveEffort(value, fallback) {
  const normalized = clean(value).toLowerCase();
  return ANTHROPIC_EFFORTS.has(normalized) ? normalized : fallback;
}

export function isAnthropicConfigured(env) {
  return Boolean(clean(env?.ANTHROPIC_API_KEY));
}

export function ensureAnthropicConfig(env) {
  const apiKey = clean(env?.ANTHROPIC_API_KEY);
  if (!apiKey) {
    throw new ClaudeApiError('Claude API configuration is missing ANTHROPIC_API_KEY.');
  }
  const timeout = Number.parseInt(env?.ANTHROPIC_TIMEOUT_MS, 10);
  return {
    apiKey,
    model: clean(env?.ANTHROPIC_MODEL) || ANTHROPIC_DEFAULT_MODEL,
    effort: resolveEffort(env?.ANTHROPIC_EFFORT, ANTHROPIC_DEFAULT_EFFORT),
    timeoutMs: Number.isFinite(timeout) ? Math.min(MAX_TIMEOUT_MS, Math.max(1000, timeout)) : DEFAULT_TIMEOUT_MS
  };
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const input = Number.isFinite(usage.input_tokens) ? usage.input_tokens : 0;
  const output = Number.isFinite(usage.output_tokens) ? usage.output_tokens : 0;
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
    ...(Number.isFinite(usage.cache_read_input_tokens) ? { cache_read_input_tokens: usage.cache_read_input_tokens } : {}),
    ...(Number.isFinite(usage.cache_creation_input_tokens) ? { cache_creation_input_tokens: usage.cache_creation_input_tokens } : {})
  };
}

/**
 * Send one Messages API request and wait for the complete answer.
 *
 * Streams under the hood so long thinking turns don't hit HTTP timeouts.
 * Thinking is always on for Opus 5.5; `effort` controls how much it thinks,
 * and `maxTokens` must leave room for that thinking as well as the reply.
 *
 * @param {Object} env - Worker environment
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {Array} options.messages - Messages API conversation
 * @param {number} options.maxTokens - Output ceiling, thinking included
 * @param {string} [options.effort] - Defaults to ANTHROPIC_EFFORT
 * @param {Array} [options.tools] - Client tool definitions
 * @param {AbortSignal} [options.signal] - Caller cancellation
 * @param {string} [options.requestId] - For logs
 * @returns {Promise<{ text: string, message: Object, model: string, usage: Object|null, stopReason: string }>}
 */
async function callClaudeMessagesInternal(env, {
  system,
  messages,
  maxTokens,
  effort,
  tools,
  signal,
  requestId = 'unknown'
}) {
  const config = ensureAnthropicConfig(env);
  if (!Number.isSafeInteger(maxTokens) || maxTokens <= 0) {
    throw new ClaudeApiError('Claude maxTokens must be a positive integer.');
  }
  const selectedEffort = resolveEffort(effort, config.effort);
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 2, timeout: config.timeoutMs });

  // One deadline covers retries and the whole streamed body.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  const startedAt = Date.now();
  try {
    console.log(`[${requestId}] [claude-api] Requesting Messages API`, {
      model: config.model,
      effort: selectedEffort,
      maxTokens,
      toolCount: Array.isArray(tools) ? tools.length : 0
    });
    const stream = client.beta.messages.stream({
      model: config.model,
      max_tokens: maxTokens,
      system,
      messages,
      output_config: { effort: selectedEffort },
      ...(Array.isArray(tools) && tools.length ? { tools } : {}),
      betas: [REFUSAL_FALLBACK_BETA],
      fallbacks: 'default'
    }, { signal: controller.signal });
    const message = await stream.finalMessage();

    const usage = normalizeUsage(message.usage);
    console.log(`[${requestId}] [claude-api] Completion received`, {
      model: message.model,
      stopReason: message.stop_reason,
      latencyMs: Date.now() - startedAt,
      inputTokens: usage?.input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null
    });

    // Branch on stop_reason before reading content.
    if (message.stop_reason === 'refusal') {
      throw Object.assign(new ClaudeApiError(`Claude declined the request (${message.stop_details?.category || 'uncategorized'}).`), { model: message.model, usage, code: 'provider_refusal' });
    }
    if (message.stop_reason === 'max_tokens' || message.stop_reason === 'model_context_window_exceeded') {
      throw Object.assign(new ClaudeApiError(`Claude response was cut off (${message.stop_reason}).`), { model: message.model, usage, code: 'provider_incomplete' });
    }

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    return { text, message, model: message.model, usage, stopReason: message.stop_reason };
  } catch (error) {
    if (signal?.aborted) throw new ClaudeApiError('Claude request was cancelled.');
    if (controller.signal.aborted) throw new ClaudeApiError('Claude request timed out.');
    if (error instanceof ClaudeApiError) throw error;
    // SDK errors can carry upstream response bodies; keep only the status.
    const status = Number.isInteger(error?.status) ? ` (HTTP ${error.status})` : '';
    throw new ClaudeApiError(`Claude API request failed${status}.`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * Convenience wrapper for single-turn text tasks.
 */
export async function generateClaudeText(env, { system, prompt, maxTokens, effort, signal, requestId, telemetry }) {
  const result = await callClaudeMessages(env, {
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    effort,
    signal,
    requestId,
    telemetry
  });
  if (!result.text) throw Object.assign(new ClaudeApiError('Claude returned no text content.'), { model: result.model, usage: result.usage });
  return result;
}

/** Opt-in task telemetry; reading orchestration records quality acceptance itself. */
export async function callClaudeMessages(env, options) {
  if (!options?.telemetry) return callClaudeMessagesInternal(env, options);
  return observeInferenceAttempt(env, {
    ...options.telemetry, provider: CLAUDE_API_PROVIDER,
    requestedModel: env?.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL, signal: options.signal
  }, () => callClaudeMessagesInternal(env, options));
}
