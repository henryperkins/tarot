/** Safe operational provenance for logical provider calls, never a billing estimate. */
const REASONS = new Set(['provider_error', 'timeout', 'cancelled', 'incomplete', 'refusal', 'quality_rejected', 'empty_response', 'safety_blocked', 'unknown']);
function identifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9@._:/-]{1,160}$/.test(value) ? value : null;
}
const tokenCount = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function normalizeInferenceUsage(usage) {
  const inputTokens = tokenCount(usage?.input_tokens ?? usage?.prompt_tokens);
  const outputTokens = tokenCount(usage?.output_tokens ?? usage?.completion_tokens);
  const totalTokens = tokenCount(usage?.total_tokens) ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null);
  const cacheReadInputTokens = tokenCount(usage?.cache_read_input_tokens);
  const cacheCreationInputTokens = tokenCount(usage?.cache_creation_input_tokens);
  const reasoningTokens = tokenCount(usage?.output_tokens_details?.reasoning_tokens ?? usage?.completion_tokens_details?.reasoning_tokens);
  const counts = [inputTokens, outputTokens, totalTokens, cacheReadInputTokens, cacheCreationInputTokens, reasoningTokens];
  return { status: inputTokens !== null && outputTokens !== null ? 'known' : counts.some((count) => count !== null) ? 'partial' : 'unknown', inputTokens, outputTokens, totalTokens, cacheReadInputTokens, cacheCreationInputTokens, reasoningTokens };
}

export function inferAttemptReason(error, signal) {
  if (error?.qualityIssues) return 'quality_rejected';
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (code.includes('incomplete') || /cut off|incomplete/.test(message)) return 'incomplete';
  if (code.includes('refusal') || /declined|refusal/.test(message)) return 'refusal';
  if (code.includes('timeout') || /timed out|deadline|timeout/.test(message) || signal?.reason?.code === 'deadline_exceeded') return 'timeout';
  if (signal?.aborted || error?.name === 'AbortError' || /cancelled|canceled/.test(message)) return 'cancelled';
  if (/empty|no text content/.test(message)) return 'empty_response';
  return 'provider_error';
}

export async function recordInferenceAttempt(env, attempt) {
  if (!env?.DB?.prepare) return false;
  try {
    const usage = normalizeInferenceUsage(attempt.usage);
    const started = Number.isFinite(attempt.startedAtMs) ? attempt.startedAtMs : Date.now();
    const finished = Number.isFinite(attempt.finishedAtMs) ? attempt.finishedAtMs : Date.now();
    const state = ['accepted', 'rejected', 'failed'].includes(attempt.state) ? attempt.state : 'failed';
    const result = await env.DB.prepare(`
      INSERT INTO inference_attempts (
        id, request_id, task, provider, requested_model, model, state, reason,
        usage_status, input_tokens, output_tokens, total_tokens,
        cache_read_input_tokens, cache_creation_input_tokens, reasoning_tokens,
        started_at, finished_at, latency_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).bind(identifier(attempt.id) || crypto.randomUUID(), identifier(attempt.requestId) || 'unknown',
      identifier(attempt.task) || 'unknown', identifier(attempt.provider) || 'unknown',
      identifier(attempt.requestedModel), identifier(attempt.model), state,
      attempt.reason ? (REASONS.has(attempt.reason) ? attempt.reason : 'unknown') : null,
      usage.status, usage.inputTokens, usage.outputTokens, usage.totalTokens,
      usage.cacheReadInputTokens, usage.cacheCreationInputTokens, usage.reasoningTokens,
      started, finished, Math.max(0, finished - started)).run();
    return result?.success !== false;
  } catch {
    console.warn('[inferenceAttempts] Unable to record inference attempt.');
    return false;
  }
}

/** Short tasks record provider completion; reading quality acceptance is separate. */
export async function observeInferenceAttempt(env, metadata, operation) {
  const startedAtMs = Date.now();
  try {
    const result = await operation();
    await recordInferenceAttempt(env, { ...metadata, startedAtMs, finishedAtMs: Date.now(), state: 'accepted', model: result?.model ?? null, usage: result?.usage ?? null });
    return result;
  } catch (error) {
    await recordInferenceAttempt(env, { ...metadata, startedAtMs, finishedAtMs: Date.now(), state: 'failed', reason: inferAttemptReason(error, metadata.signal), model: error?.model ?? null, usage: error?.usage ?? null });
    throw error;
  }
}
