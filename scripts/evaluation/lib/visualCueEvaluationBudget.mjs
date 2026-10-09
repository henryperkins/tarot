/** Persistent round allowance: all callers reserve before dispatch, including failed calls. */
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { normalizeInferenceUsage, normalizeInferenceIdentifier } from '../../../functions/lib/inferenceAttempts.js';
import { canonicalVisualCueJSON } from '../../../shared/contracts/visualCueBatches.js';

export const CUE_PRICING_SNAPSHOT = JSON.parse(await readFile(new URL('../fixtures/readingCuePricing.json', import.meta.url), 'utf8'));
export const cueDigest = value => createHash('sha256').update(typeof value === 'string' || value instanceof Uint8Array ? value : canonicalVisualCueJSON(value)).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const validCount = n => Number.isSafeInteger(n) && n >= 0;

export function estimateCueUsageCost(source, pricing) {
  const usage = normalizeInferenceUsage(source);
  const invalid = source && [source.cacheReadInputTokens, source.cached_input_tokens,
    source.cacheCreationInputTokens, source.cache_creation_input_tokens, source.cache_read_input_tokens,
    source.input_tokens_details?.cached_tokens, source.prompt_tokens_details?.cached_tokens,
    source.output_tokens_details?.reasoning_tokens, source.completion_tokens_details?.reasoning_tokens,
    source.reasoningTokens, source.reasoning_output_tokens].some(n => n != null && !validCount(n));
  const complete = !invalid && usage.status === 'known'
    && (usage.cacheReadInputTokens ?? 0) <= usage.inputTokens
    && (usage.cacheCreationInputTokens ?? 0) <= usage.inputTokens
    && (usage.cacheReadInputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0) <= usage.inputTokens
    && (usage.reasoningTokens ?? 0) <= usage.outputTokens
    && (usage.totalTokens === usage.inputTokens + usage.outputTokens)
    && usage.inputTokens <= pricing.contextWindowTokens && usage.outputTokens <= 8192;
  if (!complete) return { complete: false, estimatedUsd: null, usage, method: 'unknown-or-inconsistent-usage' };
  const cached = usage.cacheReadInputTokens ?? 0;
  return { complete: true, usage, estimatedUsd: ((usage.inputTokens - cached) * pricing.inputUsdPerMillion
    + cached * pricing.cachedInputUsdPerMillion + usage.outputTokens * pricing.outputUsdPerMillion) / 1e6,
  method: usage.cacheReadInputTokens === null ? 'uncached-upper-estimate' : 'reported-cache-subset' };
}

function reservationCost(candidate, pricing) {
  const rate = pricing.models[candidate?.model];
  if (!rate || !Number.isSafeInteger(rate.contextWindowTokens) || rate.contextWindowTokens <= 0
    || ![rate.inputUsdPerMillion, rate.outputUsdPerMillion, rate.cachedInputUsdPerMillion].every(n => Number.isFinite(n) && n >= 0)) {
    throw new Error('Unknown conservative pricing/context bound; dispatch stopped.');
  }
  // Character length is intentionally irrelevant to the input-token bound.
  return (rate.contextWindowTokens * rate.inputUsdPerMillion + 8192 * rate.outputUsdPerMillion) / 1e6;
}

/** Lock directories serialize separate processes. Crash locks fail closed; never reclaim them silently. */
export async function openCueRoundBudget({ path, roundId, maxCalls = 600, maxEstimatedUsd = 15, mode = 'offline', pricing = CUE_PRICING_SNAPSHOT } = {}) {
  if (!path || !roundId) throw new Error('Explicit persistent round path/id required.');
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 600
    || !Number.isFinite(maxEstimatedUsd) || maxEstimatedUsd <= 0 || maxEstimatedUsd > 15
    || !['offline', 'live'].includes(mode)) throw new Error('Invalid round budget configuration.');
  path = resolve(path);
  await mkdir(dirname(path), { recursive: true });
  const configuration = { roundId, maxCalls, maxEstimatedUsd, mode, pricingSha256: cueDigest(pricing) };
  async function mutate(callback) {
    const lock = `${path}.lock`;
    const started = Date.now();
    for (;;) {
      try { await mkdir(lock); break; } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() - started > 10000) throw new Error('Round budget lock unavailable; dispatch stopped.');
        await delay(10);
      }
    }
    try {
      let state;
      try { state = JSON.parse(await readFile(path, 'utf8')); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        state = { version: 1, ...configuration, attempts: [], halted: false };
      }
      if (canonicalVisualCueJSON(Object.fromEntries(Object.keys(configuration).map(key => [key, state[key]])))
        !== canonicalVisualCueJSON(configuration)) throw new Error('Round budget configuration mismatch.');
      const result = await callback(state);
      const temp = `${path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
      await rename(temp, path);
      return structuredClone(result);
    } finally { await rm(lock, { recursive: true }); }
  }
  await mutate(state => state);
  return {
    path, roundId, mode,
    snapshot: () => mutate(state => ({ ...state, heldUsd: state.attempts.reduce((sum, a) => sum + a.heldUsd, 0),
      estimatedUsd: state.attempts.reduce((sum, a) => sum + (a.estimatedUsd ?? 0), 0),
      measuredCostComplete: state.attempts.every(a => a.estimatedUsd !== null && a.outcome !== 'reserved') })),
    reserve: ({ candidate, registration = {}, request = {} }) => mutate(state => {
      const reservedUsd = reservationCost(candidate, pricing);
      const held = state.attempts.reduce((sum, a) => sum + a.heldUsd, 0);
      if (state.halted || state.attempts.length >= maxCalls || held + reservedUsd > maxEstimatedUsd + 1e-12) {
        const error = new Error('Round budget exhausted; dispatch stopped.'); error.code = 'budget_exhausted'; throw error;
      }
      // Registration is explicitly sanitized: caller-owned fresh payloads never persist here.
      const safeRegistration = Object.fromEntries(['runId', 'caseId', 'trialId', 'readingResultId', 'sourceSha256', 'bindingSha256', 'analyzedEnd', 'analyzedHash', 'requestSequence', 'batchId', 'sourceRevision'].flatMap(key => {
        const value = registration[key];
        return (typeof value === 'string' && /^[A-Za-z0-9@._:/-]{1,180}$/.test(value)) || (Number.isSafeInteger(value) && value >= 0) ? [[key, value]] : [];
      }));
      const attempt = { id: randomUUID(), candidateId: candidate.id, requestedModel: candidate.model,
        reasoningEffort: candidate.effort, registration: safeRegistration, requestSha256: cueDigest(request),
        reservedUsd, heldUsd: reservedUsd, estimatedUsd: null, usage: null, returnedModel: null,
        startedAtMs: Date.now(), finishedAtMs: null, outcome: 'reserved', reason: null };
      state.attempts.push(attempt);
      return attempt;
    }),
    settle: (id, { outcome = 'failed', reason = null, usage = null, returnedModel = null, fatal = false } = {}) => mutate(state => {
      const attempt = state.attempts.find(a => a.id === id);
      if (!attempt) throw new Error('Unknown budget reservation.');
      if (attempt.outcome !== 'reserved') return attempt;
      const cost = estimateCueUsageCost(usage, pricing.models[attempt.requestedModel]);
      Object.assign(attempt, { outcome, reason: ['provider_error', 'cancelled', 'timeout', 'quality_rejected', 'authorization', 'configuration'].includes(reason) ? reason : null,
        returnedModel: normalizeInferenceIdentifier(returnedModel), usage: cost.usage, estimatedUsd: cost.estimatedUsd,
        heldUsd: cost.complete ? cost.estimatedUsd : attempt.reservedUsd, costMethod: cost.method, finishedAtMs: Date.now() });
      state.halted ||= fatal;
      return attempt;
    }),
    annotate: (id, { outcome, reason }) => mutate(state => {
      const attempt = state.attempts.find(a => a.id === id);
      if (!attempt) throw new Error('Unknown budget reservation.');
      if (['accepted', 'rejected', 'failed'].includes(outcome)) attempt.outcome = outcome;
      if (['provider_error', 'timeout', 'cancelled', 'quality_rejected'].includes(reason)) attempt.reason = reason;
      return attempt;
    })
  };
}

/** Credentials/config are passed explicitly; this factory never reads env or files. */
export function createWorkersAiRestAdapter({ live, accountId, apiToken, availableModels, fetchImpl = globalThis.fetch } = {}) {
  if (live !== true) throw new Error('REST inference requires explicit live: true.');
  if (!/^[a-f0-9]{32}$/i.test(accountId || '') || typeof apiToken !== 'string' || !apiToken
    || !Array.isArray(availableModels) || !availableModels.length) throw new Error('Explicit live account/token/model catalog required.');
  return { liveConfigured: true, availableModels: [...availableModels], async run(model, input, { signal } = {}) {
    if (!availableModels.includes(model)) { const error = new Error('Unavailable model configuration.'); error.code = 'configuration'; throw error; }
    const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    });
    if (!response.ok) {
      const error = new Error('Visual annotation request failed.');
      error.code = [401, 403].includes(response.status) ? 'authorization' : [400, 404].includes(response.status) ? 'configuration' : 'provider_error';
      throw error;
    }
    const envelope = await response.json();
    if (envelope.success === false) { const error = new Error('Visual annotation request failed.'); error.code = 'configuration'; throw error; }
    return envelope.result ?? envelope;
  } };
}
