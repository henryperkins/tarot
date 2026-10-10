/** Persistent round allowance: all callers reserve before dispatch, including failed calls. */
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { normalizeInferenceUsage, normalizeInferenceIdentifier } from '../../../functions/lib/inferenceAttempts.js';
import { createVisualCueAdmissionError, readVisualCueUsageEvidence, isVisualCueUndispatchedReservation } from '../../../functions/lib/visualCueAdmission.js';
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

function reservationCost(candidate, pricing, verifiedInputBound = null) {
  if (verifiedInputBound !== null) throw new Error('Verified provider-compatible full-request tokenizer unavailable; conservative bound required.');
  const rate = pricing.models[candidate?.model];
  if (!rate || !Number.isSafeInteger(rate.contextWindowTokens) || rate.contextWindowTokens <= 0
    || ![rate.inputUsdPerMillion, rate.outputUsdPerMillion, rate.cachedInputUsdPerMillion].every(n => Number.isFinite(n) && n >= 0)) {
    throw new Error('Unknown conservative pricing/context bound; dispatch stopped.');
  }
  // Character length is intentionally irrelevant to the input-token bound.
  return (rate.contextWindowTokens * rate.inputUsdPerMillion + 8192 * rate.outputUsdPerMillion) / 1e6;
}

/** Lock directories serialize separate processes. Crash locks fail closed; never reclaim them silently. */
export async function openCueRoundBudget({ path, roundId, maxCalls = 600, maxEstimatedUsd = 15, mode = 'offline', pricing = CUE_PRICING_SNAPSHOT, requireExisting = false } = {}) {
  if (!path || !roundId) throw new Error('Explicit persistent round path/id required.');
  if (['live-20261010-task6', 'reading-cue-qualification-20261010-task6'].includes(roundId)) throw new Error('Historical 183-attempt round is closed; new round required.');
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 600
    || !Number.isFinite(maxEstimatedUsd) || maxEstimatedUsd <= 0 || maxEstimatedUsd > 15
    || !['offline', 'live'].includes(mode)) throw new Error('Invalid round budget configuration.');
  path = resolve(path);
  pricing = structuredClone(pricing);
  if (!requireExisting) await mkdir(dirname(path), { recursive: true });
  const configuration = { roundId, maxCalls, maxEstimatedUsd, mode, pricingSha256: cueDigest(pricing) };
  async function mutate(callback, write = false) {
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
        // A caller that needs the shared round ledger never receives a fresh allowance.
        if (requireExisting) throw new Error('Round budget ledger is absent.');
        state = { version: 2, ...configuration, attempts: [], admissions: [], corrections: [], phases: [], definitionSha256: null, halted: false, closed: false };
        write = true;
      }
      if (canonicalVisualCueJSON(Object.fromEntries(Object.keys(configuration).map(key => [key, state[key]])))
        !== canonicalVisualCueJSON(configuration)) throw new Error('Round budget configuration mismatch.');
      if (![1, 2].includes(state.version) || !Array.isArray(state.attempts)
        || state.attempts.some(a => !Number.isFinite(a.heldUsd) || a.heldUsd < 0 || !Number.isFinite(a.reservedUsd) || a.reservedUsd < 0)
        || (state.version === 2 && (![state.admissions, state.corrections, state.phases].every(Array.isArray)))) throw new Error('Unsupported/corrupt round budget ledger.');
      if (state.version === 1 && write) throw new Error('Historical version 1 ledger is read-only; new round required.');
      const result = await callback(state);
      if (!write) return structuredClone(result);
      const temp = `${path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
      await rename(temp, path);
      return structuredClone(result);
    } finally { await rm(lock, { recursive: true }); }
  }
  await mutate(state => state);
  const effectiveAttempts = state => state.attempts.map(attempt => {
    const correction = state.corrections?.filter(event => event.attemptId === attempt.id).at(-1);
    return correction ? { ...attempt, usage: correction.usage, estimatedUsd: correction.estimatedUsd,
      heldUsd: correction.estimatedUsd, returnedModel: correction.returnedModel, costMethod: correction.costMethod } : attempt;
  });
  const snapshot = state => {
    const currentAttempts = effectiveAttempts(state);
    return { ...state, currentAttempts, heldUsd: currentAttempts.reduce((sum, a) => sum + a.heldUsd, 0),
      estimatedUsd: currentAttempts.reduce((sum, a) => sum + (a.estimatedUsd ?? 0), 0),
      unresolvedAttemptIds: currentAttempts.filter(a => a.estimatedUsd === null || a.outcome === 'reserved').map(a => a.id),
      measuredCostComplete: currentAttempts.every(a => a.estimatedUsd !== null && a.outcome !== 'reserved') };
  };
  const admission = (state, candidate, verifiedInputBound) => {
    const remainingUsd = Math.max(0, maxEstimatedUsd - snapshot(state).heldUsd);
    let reservedUsd;
    try { reservedUsd = reservationCost(candidate, pricing, verifiedInputBound); }
    catch { return { allowed: false, reservedUsd: null, remainingUsd, reason: 'configuration' }; }
    const reason = state.halted || state.closed ? 'round-halted' : state.attempts.length >= maxCalls ? 'call-cap'
      : reservedUsd > remainingUsd + 1e-12 ? 'candidate-cost-bound' : null;
    return { allowed: reason === null, reservedUsd, remainingUsd, reason };
  };
  const safeRegistration = registration => Object.fromEntries(['runId', 'caseId', 'trialId', 'phase', 'readingResultId', 'sourceSha256', 'bindingSha256', 'artworkEdition', 'analyzedEnd', 'analyzedHash', 'requestSequence', 'batchId', 'sourceRevision'].flatMap(key => {
    const value = registration[key];
    return (typeof value === 'string' && /^[A-Za-z0-9@._:/-]{1,180}$/.test(value)) || (Number.isSafeInteger(value) && value >= 0) ? [[key, value]] : [];
  }));
  return {
    path, roundId, mode,
    snapshot: () => mutate(snapshot),
    canReserve: ({ candidate, verifiedInputBound = null }) => mutate(state => admission(state, candidate, verifiedInputBound)),
    recordAdmission: ({ candidate, registration = {}, request = {}, reason = 'configuration' }) => mutate(state => {
      const error = createVisualCueAdmissionError(reason);
      const record = { id: randomUUID(), candidateId: normalizeInferenceIdentifier(candidate?.id), requestedModel: normalizeInferenceIdentifier(candidate?.model),
        registration: safeRegistration(registration), requestSha256: cueDigest(request), allowed: false, reason: error.reason,
        reservedUsd: null, remainingUsd: Math.max(0, maxEstimatedUsd - snapshot(state).heldUsd), atMs: Date.now() };
      state.admissions.push(record);
      state.halted ||= error.reason === 'configuration';
      return record;
    }, true),
    withdrawUndispatched: (id, evidence) => mutate(state => {
      const attempt = state.attempts.find(a => a.id === id);
      if (!attempt || attempt.outcome !== 'reserved' || !isVisualCueUndispatchedReservation(evidence, id)) throw new Error('Trusted pre-dispatch withdrawal evidence required.');
      state.attempts = state.attempts.filter(a => a.id !== id);
      const original = state.admissions.find(a => a.id === attempt.admissionId);
      // Keep admission history, appending the withdrawal rather than relabeling it.
      const record = { id: randomUUID(), originalAdmissionId: original.id, reservationId: id, candidateId: attempt.candidateId,
        requestedModel: attempt.requestedModel, registration: attempt.registration, requestSha256: attempt.requestSha256,
        allowed: false, reason: 'cancelled-before-dispatch', atMs: Date.now(), releasedUsd: attempt.reservedUsd };
      state.admissions.push(record);
      return record;
    }, true),
    async reserve({ candidate, registration = {}, request = {}, verifiedInputBound = null, signal } = {}) {
      const result = await mutate(state => {
        const decision = signal?.aborted ? { ...admission(state, candidate, verifiedInputBound), allowed: false, reason: 'cancelled-before-dispatch' }
          : admission(state, candidate, verifiedInputBound);
        const record = { id: randomUUID(), candidateId: normalizeInferenceIdentifier(candidate?.id),
          requestedModel: normalizeInferenceIdentifier(candidate?.model), registration: safeRegistration(registration),
          requestSha256: cueDigest(request), atMs: Date.now(), ...decision,
          inputBoundMethod: 'documented-context-window', inputBoundEvidence: verifiedInputBound === null ? null : 'unsupported-verifier' };
        state.admissions.push(record);
        state.halted ||= decision.reason === 'configuration';
        if (!decision.allowed) return { rejected: decision.reason };
        const reservedAtMs = Date.now();
        const attempt = { id: randomUUID(), admissionId: record.id, candidateId: candidate.id, requestedModel: candidate.model,
          reasoningEffort: candidate.effort, registration: record.registration, requestSha256: record.requestSha256,
          reservedUsd: decision.reservedUsd, heldUsd: decision.reservedUsd, estimatedUsd: null, usage: null, returnedModel: null,
          // Preserve the legacy field, explicitly labeling its reservation
          // clock. Provider/D1 latency starts at actual transport invocation.
          reservedAtMs, startedAtMs: reservedAtMs, startedAtMsMeaning: 'reservation', finishedAtMs: null, outcome: 'reserved', reason: null };
        record.attemptId = attempt.id;
        state.attempts.push(attempt);
        return { attempt };
      }, true);
      if (result.rejected) throw createVisualCueAdmissionError(result.rejected);
      return result.attempt;
    },
    settle: (id, { outcome = 'failed', reason = null, usage = null, returnedModel = null, fatal = false } = {}) => mutate(state => {
      const attempt = state.attempts.find(a => a.id === id);
      if (!attempt) throw new Error('Unknown budget reservation.');
      // A later fatal transport outcome must still stop new admissions.
      state.halted ||= fatal;
      if (attempt.outcome !== 'reserved') return attempt;
      const cost = estimateCueUsageCost(usage, pricing.models[attempt.requestedModel]);
      Object.assign(attempt, { outcome, reason: ['provider_error', 'cancelled', 'timeout', 'quality_rejected', 'authorization', 'configuration'].includes(reason) ? reason : null,
        returnedModel: normalizeInferenceIdentifier(returnedModel), usage: cost.usage, estimatedUsd: cost.estimatedUsd,
        heldUsd: cost.complete ? cost.estimatedUsd : attempt.reservedUsd, costMethod: cost.method, finishedAtMs: Date.now() });
      return attempt;
    }, true),
    annotate: (id, { outcome, reason }) => mutate(state => {
      const attempt = state.attempts.find(a => a.id === id);
      if (!attempt) throw new Error('Unknown budget reservation.');
      if (['accepted', 'rejected', 'failed'].includes(outcome)) attempt.outcome = outcome;
      if (['provider_error', 'timeout', 'cancelled', 'quality_rejected'].includes(reason)) attempt.reason = reason;
      return attempt;
    }, true),
    appendUsageEvidence: (id, { evidence, evidenceId } = {}) => mutate(state => {
      const attempt = state.attempts.find(a => a.id === id);
      const captured = readVisualCueUsageEvidence(evidence);
      if (!captured || !attempt || attempt.outcome === 'reserved' || captured.requestSha256 !== attempt.requestSha256
        || captured.requestedModel !== attempt.requestedModel
        || !normalizeInferenceIdentifier(evidenceId)) throw new Error('Matched authoritative usage evidence required.');
      const cost = estimateCueUsageCost(captured.usage, pricing.models[attempt.requestedModel]);
      if (!cost.complete) throw new Error('Complete consistent provider usage evidence required.');
      const current = effectiveAttempts(state).find(a => a.id === id);
      if (current.estimatedUsd !== null) throw new Error('Known usage cannot be replaced.');
      const correction = { id: randomUUID(), attemptId: id, evidenceId, requestSha256: captured.requestSha256, atMs: Date.now(),
        usage: cost.usage, estimatedUsd: cost.estimatedUsd, returnedModel: normalizeInferenceIdentifier(captured.returnedModel), costMethod: cost.method };
      state.corrections.push(correction);
      return correction;
    }, true),
    bindDefinition: definitionSha256 => mutate(state => {
      if (!/^[a-f0-9]{64}$/.test(definitionSha256) || (state.definitionSha256 && state.definitionSha256 !== definitionSha256)) throw new Error('Frozen round definition mismatch.');
      state.definitionSha256 = definitionSha256;
      return definitionSha256;
    }, true),
    registerPhase: ({ phaseId, definitionSha256 }) => mutate(state => {
      if (!normalizeInferenceIdentifier(phaseId) || state.definitionSha256 !== definitionSha256 || state.phases.some(p => p.phaseId === phaseId)) throw new Error('Immutable round phase identity mismatch or duplicate.');
      const record = { phaseId, definitionSha256, atMs: Date.now() };
      state.phases.push(record);
      return record;
    }, true),
    halt: () => mutate(state => { state.halted = true; return snapshot(state); }, true)
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
    let envelope = null;
    try { envelope = await response.json(); } catch { /* Non-JSON errors carry no trustworthy usage. */ }
    if (!response.ok || !envelope || envelope.success === false) {
      const error = new Error('Visual annotation request failed.');
      error.code = [401, 403].includes(response.status) ? 'authorization' : [400, 404].includes(response.status) || envelope?.success === false ? 'configuration' : 'provider_error';
      const result = envelope?.result ?? envelope;
      error.usage = normalizeInferenceUsage(result?.usage);
      error.model = normalizeInferenceIdentifier(result?.model);
      throw error;
    }
    return envelope.result ?? envelope;
  } };
}
