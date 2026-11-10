/** Independent cue qualification through production provider, prompt, job scheduler and ledger. */
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { createVisualCueAdmissionError, isVisualCueAdmissionError, createTrustedVisualCueBinding, captureVisualCueUsageEvidence, captureVisualCueUndispatchedReservation } from '../../../functions/lib/visualCueAdmission.js';
import { getVisualInitialLimits } from '../../../functions/lib/readingVisualAdmission.js';
import { normalizeInferenceUsage, normalizeInferenceIdentifier } from '../../../functions/lib/inferenceAttempts.js';
import { ReadingVisualJob } from '../../../src/worker/readingVisualJob.js';
import { getVectorGestureDetails } from '../../../src/data/cardGestureArtwork.js';
import { buildVisualCuePrompt } from '../../../shared/generation/visualCuePrompt.js';
import { visualCueProposalSchema, visualCueResponseSchema, canonicalVisualCueJSON } from '../../../shared/contracts/visualCueBatches.js';
import { createD1 } from '../../../tests/helpers/d1Sqlite.mjs';
import { createReadingJobState } from '../../../tests/helpers/fakeReadingJobs.mjs';
import { loadReadingCueCases, scoreReadingCueRun, rankReadingCueCandidates } from './readingCueQualification.mjs';
import { CUE_PRICING_SNAPSHOT, cueDigest, openCueRoundBudget } from './visualCueEvaluationBudget.mjs';
export { CUE_PRICING_SNAPSHOT, openCueRoundBudget, estimateCueUsageCost, createWorkersAiRestAdapter } from './visualCueEvaluationBudget.mjs';
export { createReadingCueRelay } from './visualCueEvaluationRelay.mjs';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const execute = promisify(execFile);
export const DEFAULT_CUE_CANDIDATES = Object.freeze([
  Object.freeze({ id: 'glm-5.3-flash-low', model: '@cf/zai-org/glm-5.3-flash', effort: 'low' }),
  Object.freeze({ id: 'glm-5.3-flash-high', model: '@cf/zai-org/glm-5.3-flash', effort: 'high' }),
  Object.freeze({ id: 'glm-5.3-high', model: '@cf/zai-org/glm-5.3', effort: 'high' })
]);
const schema = z.toJSONSchema(z.object({ proposals: z.array(visualCueProposalSchema).max(240) }).strict(), { target: 'draft-7' });
const responseFormat = { type: 'json_schema', json_schema: { name: 'visual_cues', schema, strict: true } };
// The builder owns edition-specific instructions. Freeze the exact system
// prompt for each trusted registered edition rather than one global string.
const systemPromptFor = artworkEdition => buildVisualCuePrompt({ artworkEdition }).systemPrompt;
// The user prompt opens by naming its edition; it must name the registered one too.
const editionLineFor = artworkEdition => buildVisualCuePrompt({ artworkEdition }).userPrompt.split('\n', 1)[0];
const systemPrompt = systemPromptFor(undefined);
export const OFFLINE_CUE_ADAPTER = Object.freeze({ offline: true, async run() {
  return { response: '{"proposals":[]}', usage: { prompt_tokens: 0, completion_tokens: 0 } };
} });

/** Fake dispatches exercise the real original-job admission gate. These finite
 * fixture units are artificial, never pricing or authorization for live AI.
 * Live callers must supply every pinned bound and a private hashed scope. */
export function resolveCueInitialAdmission({ live = false, aiAdapter, candidates = DEFAULT_CUE_CANDIDATES, initialAdmission } = {}) {
  if (!live && aiAdapter?.offline !== true) throw new Error('Explicit offline adapter required.');
  const offlineBounds = { rateLimit: 600, windowMs: 60000, totalLimit: 600, globalRateLimit: 600, globalTotalLimit: 600,
    maxDispatchCostMicrousd: 1, scopeCostLimitMicrousd: 600, globalCostLimitMicrousd: 600 };
  const input = live ? initialAdmission : { aggregateScope: `guest-edge:${cueDigest('controlled-offline-cue-fixture')}`,
    limitsByModel: Object.fromEntries(candidates.map(candidate => [candidate.model, { provider: 'workers-ai', model: candidate.model, ...offlineBounds }])) };
  if (!input || !/^guest-edge:[a-f0-9]{64}$/.test(input.aggregateScope || '')) throw new Error('Explicit valid initial admission limits and private hashed scope required.');
  const limitsByModel = {};
  const models = live ? Object.keys(input.limitsByModel || {}) : candidates.map(candidate => candidate.model);
  if (candidates.some(candidate => !models.includes(candidate.model))) throw new Error('Explicit valid initial admission limits and model pins required.');
  for (const model of models) {
    const configured = input.limitsByModel?.[model];
    const limits = getVisualInitialLimits({ VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: model,
      VISUAL_INITIAL_LIMITS: JSON.stringify(configured) });
    if (!limits) throw new Error('Explicit valid initial admission limits and model pins required.');
    limitsByModel[model] = Object.fromEntries(['provider', 'model', ...Object.keys(offlineBounds)].map(key => [key, limits[key]]));
  }
  return { mode: live ? 'explicit private operator admission' : 'offline fixture only; artificial finite units',
    aggregateScope: input.aggregateScope, limitsByModel };
}

/** Reusable AI.run seam for recovery-only Workers: sessions must be explicitly registered. */
export function createBoundedCueAdapter({ live = false, aiAdapter, budget, candidate } = {}) {
  if (!live && aiAdapter?.offline !== true) throw new Error('Explicit offline adapter required; credentials/network are never inherited.');
  if (live && (aiAdapter?.liveConfigured !== true || budget?.mode !== 'live'
    || !aiAdapter.availableModels?.includes(candidate?.model))) throw new Error('Explicit live adapter/catalog and persistent live round budget required.');
  if (!DEFAULT_CUE_CANDIDATES.some(c => canonicalVisualCueJSON(c) === canonicalVisualCueJSON(candidate))) throw new Error('Unknown candidate configuration.');
  candidate = structuredClone(candidate);
  const registrations = new Map();
  const attempts = [];
  const admissions = [];
  const ownedWork = new Set();
  let fatalReason = null;
  const requestTemplate = { messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: editionLineFor(undefined) }], stream: false,
    max_completion_tokens: 8192, reasoning_effort: candidate.effort, temperature: 0, response_format: structuredClone(responseFormat) };
  const { messages: _fixedMessages, ...fixedConfiguration } = requestTemplate;
  const expectedConfiguration = canonicalVisualCueJSON(fixedConfiguration);
  async function executeRequest(model, input, { signal, registration, requestMetadata = {}, dispatchObserver, initialReservationId } = {}) {
    const rejectAdmission = async reason => {
      if (reason === 'configuration') fatalReason = reason;
      const record = budget?.recordAdmission ? await budget.recordAdmission({ candidate, registration: registration || {}, request: input || {}, reason })
        : { candidateId: candidate.id, reason };
      admissions.push(record);
      throw createVisualCueAdmissionError(reason);
    };
    const key = registration && `${registration.runId}:${registration.caseId}:${registration.trialId || 'default'}`;
    if (!key || !registrations.has(key) || canonicalVisualCueJSON(registrations.get(key)) !== canonicalVisualCueJSON(registration)) {
      return rejectAdmission('configuration');
    }
    const { messages, ...configuration } = input || {};
    if (model !== candidate.model || canonicalVisualCueJSON(configuration) !== expectedConfiguration
      || !Array.isArray(messages) || messages.length !== 2 || messages[0]?.role !== 'system'
      || messages[0].content !== systemPromptFor(registration.artworkEdition) || messages[1]?.role !== 'user' || typeof messages[1].content !== 'string'
      || messages[1].content.split('\n', 1)[0] !== editionLineFor(registration.artworkEdition)) {
      return rejectAdmission('configuration');
    }
    if (fatalReason) return rejectAdmission('round-halted');
    if (signal?.aborted) return rejectAdmission('cancelled-before-dispatch');
    if (!budget) return rejectAdmission('configuration');
    let reserved;
    try { reserved = await budget.reserve({ candidate, registration: { ...registration, ...requestMetadata }, request: input, signal, initialReservationId }); }
    catch (error) {
      const reason = isVisualCueAdmissionError(error) ? error.reason : 'configuration';
      admissions.push({ candidateId: candidate.id, registration: structuredClone(registration), reason });
      if (['call-cap', 'round-halted', 'configuration'].includes(reason)) fatalReason = reason;
      throw isVisualCueAdmissionError(error) ? error : createVisualCueAdmissionError(reason);
    }
    if (signal?.aborted) {
      const record = await budget.withdrawUndispatched(reserved.id, captureVisualCueUndispatchedReservation(reserved.id));
      admissions.push(record);
      throw createVisualCueAdmissionError('cancelled-before-dispatch');
    }
    const attempt = { ...reserved, schemaSha256: cueDigest(responseFormat), inputMessagesSha256: cueDigest(messages) };
    attempts.push(attempt);
    // Hold unknown outcomes immediately on provider deadline/cancellation, even
    // when a remote operation ignores AbortSignal and resolves later.
    let abort;
    let captured = null;
    let evidence = null;
    let correctionStarted = false;
    const appendCorrection = () => {
      if (!evidence || correctionStarted || attempt.outcome === 'reserved' || attempt.estimatedUsd !== null || captured.usage.status !== 'known') return;
      correctionStarted = true;
      const work = budget.appendUsageEvidence(reserved.id, { evidence, evidenceId: `provider-capture:${reserved.id}` });
      ownedWork.add(work);
      work.then(() => ownedWork.delete(work), () => ownedWork.delete(work));
    };
    const capture = value => {
      captured = { model: normalizeInferenceIdentifier(value?.model), usage: normalizeInferenceUsage(value?.usage) };
      evidence = captureVisualCueUsageEvidence({ requestSha256: reserved.requestSha256, requestedModel: model,
        usage: captured.usage, returnedModel: captured.model });
      dispatchObserver?.provenance(captured);
      appendCorrection();
    };
    try {
      const operation = (async () => {
        dispatchObserver?.dispatched();
        return aiAdapter.run(model, input, { signal });
      })().then(result => { capture(result); return result; }, error => {
        // A losing transport can reject after cancellation already finalized
        // the attempt. Its terminal classification still owns a round halt.
        if (['authorization', 'configuration'].includes(error?.code)) {
          fatalReason ||= error.code;
          const work = budget.halt();
          ownedWork.add(work);
          work.then(() => ownedWork.delete(work), () => ownedWork.delete(work));
        }
        capture(error);
        throw error;
      });
      const cancelled = new Promise((_, reject) => {
        abort = () => reject(Object.assign(new Error('Visual annotation cancelled.'), { code: signal?.reason?.name === 'TimeoutError' || signal?.reason?.code === 'deadline_exceeded' ? 'timeout' : 'cancelled' }));
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      });
      const result = await Promise.race([operation, cancelled]);
      let outcome = 'accepted';
      try {
        const raw = result?.response ?? result?.choices?.[0]?.message?.content;
        visualCueResponseSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
      } catch { outcome = 'rejected'; }
      const settled = await budget.settle(reserved.id, { outcome, reason: outcome === 'rejected' ? 'quality_rejected' : null, usage: result?.usage, returnedModel: result?.model });
      Object.assign(attempt, settled);
      if (signal?.aborted) {
        const reason = signal.reason?.code === 'deadline_exceeded' ? 'timeout' : 'cancelled';
        Object.assign(attempt, await budget.annotate(reserved.id, { outcome: 'failed', reason }));
        const error = new Error('Visual annotation cancelled.'); error.code = reason; throw error;
      }
      return result;
    } catch (error) {
      const reason = ['authorization', 'configuration', 'cancelled', 'timeout'].includes(error?.code) ? error.code : 'provider_error';
      const fatal = ['authorization', 'configuration'].includes(reason);
      if (fatal) fatalReason = reason;
      Object.assign(attempt, await budget.settle(reserved.id, { outcome: 'failed', reason, usage: captured?.usage ?? error?.usage,
        returnedModel: captured?.model ?? error?.model, fatal }));
      appendCorrection();
      const safe = new Error('Visual annotation failed.'); safe.code = reason;
      safe.usage = captured?.usage ?? normalizeInferenceUsage(error?.usage);
      safe.model = captured?.model ?? normalizeInferenceIdentifier(error?.model);
      if (reason === 'cancelled') safe.name = 'AbortError';
      throw safe;
    } finally { signal?.removeEventListener('abort', abort); }
  }
  const adapter = {
    attempts, admissions, requestTemplate, get fatalReason() { return fatalReason; },
    registerSession(registration) {
      if (!registration?.runId || !registration?.caseId) throw new Error('Explicit run/case registration required.');
      const key = `${registration.runId}:${registration.caseId}:${registration.trialId || 'default'}`;
      if (registrations.has(key)) throw new Error('Duplicate session registration.');
      const record = structuredClone(registration);
      registrations.set(key, record);
      return createTrustedVisualCueBinding((model, input, options = {}) => adapter.run(model, input, { ...options, registration: record }));
    },
    run(model, input, options) {
      const work = executeRequest(model, input, options);
      ownedWork.add(work);
      work.then(() => ownedWork.delete(work), () => ownedWork.delete(work));
      return work;
    },
    async drainSettlements() {
      while (ownedWork.size) await Promise.allSettled([...ownedWork]);
    },

  };
  return adapter;
}

export function createCueMemoryState() {
  // Use the same serialized, rollback-capable storage as the real ReadingJob
  // tests: terminal completion atomically commits the job and private receipt.
  const { storage } = createReadingJobState();
  const work = [];
  return { storage,
    blockConcurrencyWhile: callback => callback(), waitUntil: promise => { work.push(promise); }, work,
    async drain() { for (let offset = 0; offset < work.length;) { const batch = work.slice(offset); offset = work.length; await Promise.allSettled(batch); } } };
}

export function cueValidationContext(caseData) {
  return { cards: caseData.cards.map((card, index) => ({ ...card, index: card.spreadIndex ?? index,
    detailIds: caseData.artworkEdition === 'rws-immanuelle-vector' ? getVectorGestureDetails(card.canonicalName).map(detail => detail.id) : [] })),
  question: caseData.question || '', reflections: caseData.reflections || '' };
}

/** The live harness keeps the production D1 SQL gate, adding a durable round
 * hold before its INSERT. No case-store disposal, SQL failure, cancellation or
 * configuration rejection can lose that conservative original reservation. */
function persistentInitialAdmissionDatabase(db, budget, candidate, onReserved) {
  const persistent = Object.create(db);
  persistent.prepare = sql => {
    const statement = db.prepare(sql);
    if (!/^INSERT INTO visual_initial_reservations\b/.test(sql)) {
      if (/\bvisual_initial_reservations\b/.test(sql)) throw new Error('Unsupported original reservation statement.');
      return statement;
    }
    onReserved(null);
    const wrap = (prepared, params = null) => {
      const bridged = Object.create(prepared);
      bridged.bind = (...values) => wrap(prepared.bind(...values), values);
      bridged.run = async () => {
        if (!params) throw new Error('Bound original admission reservation required.');
        const held = await budget.reserveInitialOriginal({ id: params[0], candidate,
          readingResultId: params[3], reservedCostMicrousd: params[1] });
        if (!held.allowed) return { success: true, meta: { changes: 0 } };
        onReserved(held.reservation.id);
        return prepared.run();
      };
      return bridged;
    };
    return wrap(statement);
  };
  return persistent;
}

export async function createVisualCueSession({ caseData, candidate = DEFAULT_CUE_CANDIDATES[0], aiAdapter = OFFLINE_CUE_ADAPTER,
  live = false, budget, db, runId = 'offline-session', trialId = 'default', initialAdmission } = {}) {
  if (!caseData?.raw || !Array.isArray(caseData.cards)) throw new Error('Exact selected cue case required.');
  const initialConfiguration = resolveCueInitialAdmission({ live, aiAdapter, candidates: [candidate], initialAdmission });
  if (live) {
    if (typeof budget?.bindInitialAdmission !== 'function' || typeof budget?.reserveInitialOriginal !== 'function') throw new Error('Persistent initial round admission required.');
    await budget.bindInitialAdmission(initialConfiguration);
  }
  budget ??= await openCueRoundBudget({ path: join(await mkdtemp(join(tmpdir(), 'cue-session-')), 'round.json'), roundId: runId });
  db ??= await createD1();
  const state = createCueMemoryState();
  const binding = { readingResultId: `cue:${cueDigest({ runId, caseId: caseData.id, trialId, candidate }).slice(0, 48)}`,
    sourceRevision: 0, spreadHash: cueDigest(caseData.cards), contextHash: cueDigest({ question: caseData.question, reflections: caseData.reflections }),
    artworkEdition: caseData.artworkEdition || `identity:${caseData.deckStyle}`, catalogVersion: 'v1' };
  const token = `local:${binding.readingResultId}`;
  const bounded = createBoundedCueAdapter({ aiAdapter, live, budget, candidate });
  const registration = { runId, caseId: caseData.id, trialId, readingResultId: binding.readingResultId,
    sourceSha256: cueDigest(caseData.raw), bindingSha256: cueDigest(binding), artworkEdition: binding.artworkEdition };
  const registered = bounded.registerSession(registration);
  let initialReservationId = null;
  const admissionDB = live ? persistentInitialAdmissionDatabase(db, budget, candidate, id => { initialReservationId = id; }) : db;
  const env = { DB: admissionDB, VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: candidate.model,
    VISUAL_INITIAL_LIMITS: JSON.stringify(initialConfiguration.limitsByModel[candidate.model]),
    VISUAL_CUE_REASONING_EFFORT: candidate.effort, VISUAL_CUE_TIMEOUT_MS: 60000,
    AI: createTrustedVisualCueBinding((model, input, options) => {
      if (live && !initialReservationId) throw createVisualCueAdmissionError('configuration');
      return registered.run(model, input, { ...options, initialReservationId,
      requestMetadata: job?.inFlightRequest ? { ...Object.fromEntries(['analyzedEnd', 'analyzedHash', 'requestSequence', 'batchId'].map(key => [key, job.inFlightRequest[key]])),
        bindingSha256: cueDigest(job.inFlightRequest.binding), sourceRevision: job.inFlightRequest.binding.sourceRevision } : {} });
    }) };
  const job = new ReadingVisualJob(state, env);
  await job.initialized;
  const initialized = await job.fetch(new Request('https://cue-local/init', { method: 'POST', body: JSON.stringify({ binding,
    visualToken: token, validationContext: cueValidationContext(caseData),
    initialAdmission: { userId: null, aggregateScope: initialConfiguration.aggregateScope } }) }));
  if (!initialized.ok) throw new Error('Isolated visual job initialization failed.');
  const observations = [];
  let eventId = 0;
  let finished = false;
  const session = { job, env, db, state, budget, bounded, binding, token, initialConfiguration,
    async observe(raw, { complete = false, deliveredEventId = ++eventId, availableAt = Date.now(), sourceBinding = job.binding } = {}) {
      const response = await job.fetch(new Request('https://cue-local/observe', { method: 'POST', body: JSON.stringify({
        binding: sourceBinding, raw, complete, deliveredEventId, availableAt }) }));
      const result = await response.json();
      observations.push({ deliveredEventId, sourceRevision: sourceBinding.sourceRevision, rawSha256: cueDigest(raw), rawLength: raw.length,
        complete, availableAt, receivedAt: Date.now(), outcome: response.ok ? result.status : 'rejected', httpStatus: response.status });
      return result;
    },
    replace(raw, options = {}) { return session.observe(raw, { ...options, sourceBinding: { ...job.binding, sourceRevision: job.binding.sourceRevision + 1 } }); },
    drain: () => state.drain(),
    async cancel() {
      await job.fetch(new Request('https://cue-local/cancel', { method: 'POST', headers: { 'X-Visual-Token': token } }));
    },
    async finish() {
      await state.drain();
      // Production deadlines can finish the job before adapter accounting I/O.
      // Drain only the bounded race/settlement, never the losing remote promise.
      await bounded.drainSettlements();
      await state.drain();
      finished = true;
      const inferenceAttempts = db.rows('SELECT * FROM inference_attempts WHERE request_id = ? ORDER BY started_at, rowid', [binding.readingResultId]);
      const initialAdmissions = live ? (await budget.snapshot()).admissions.filter(admission =>
        admission.allowed === false && admission.initialLimit && admission.registration?.readingResultId === binding.readingResultId) : [];
      // D1 rows lack requestSequence and may finish out of order (or share a
      // millisecond). Compare metadata multisets rather than relabeling requests
      // by row order; the reservation owns each exact request's outcome.
      const signature = value => canonicalVisualCueJSON({ model: value.model, returnedModel: value.returnedModel,
        outcome: value.outcome, inputTokens: value.inputTokens, outputTokens: value.outputTokens,
        cachedTokens: value.cachedTokens, reasoningTokens: value.reasoningTokens });
      const recorded = inferenceAttempts.map(row => signature({ model: row.requested_model, returnedModel: row.model,
        outcome: row.state, inputTokens: row.input_tokens, outputTokens: row.output_tokens,
        cachedTokens: row.cache_read_input_tokens, reasoningTokens: row.reasoning_tokens })).sort();
      const dispatched = bounded.attempts.map(attempt => signature({ model: attempt.requestedModel, returnedModel: attempt.returnedModel,
        outcome: attempt.outcome, inputTokens: attempt.usage?.inputTokens ?? null, outputTokens: attempt.usage?.outputTokens ?? null,
        cachedTokens: attempt.usage?.cacheReadInputTokens ?? null, reasoningTokens: attempt.usage?.reasoningTokens ?? null })).sort();
      const jobAttemptRowsComplete = canonicalVisualCueJSON(recorded) === canonicalVisualCueJSON(dispatched);
      return structuredClone({ caseId: caseData.id, candidateId: candidate.id, trialId, runId, binding: job.binding, status: job.status,
        ledger: job.ledger, requests: job.requestRegistry, observations, attempts: bounded.attempts,
        admissions: [...bounded.admissions, ...initialAdmissions], inferenceAttempts,
        initialAdmission: initialConfiguration,
        admissionComplete: bounded.admissions.length === 0 && initialAdmissions.length === 0,
        jobAttemptRowsComplete, accountingComplete: jobAttemptRowsComplete && bounded.attempts.every(a => a.estimatedUsd !== null),
        inferenceReconciliation: 'per-job metadata multiset; no unsafe ordinal request pairing',
        authoritativeRawSha256: cueDigest(job.authoritativeRaw), authoritativeRawLength: job.authoritativeRaw.length,
        sourceMatchesCase: job.authoritativeRaw === caseData.raw, analysisComplete: job.status === 'complete' && job.ledger.raw === job.authoritativeRaw,
        fatalReason: bounded.fatalReason, clockDomain: 'server Date.now', finished });
    }
  };
  return session;
}

/** Exact raw slices: no trimming/Markdown projection/UTF-16 normalization. */
export function buildCueDeliverySchedule(raw, scenario = 'paced') {
  if (!['paced', 'burst', 'final-only'].includes(scenario)) throw new Error('Unknown cue delivery schedule.');
  if (scenario === 'final-only') return [{ type: 'done', fullText: raw, end: raw.length, atMs: 0 }];
  const chunks = raw.match(/[\s\S]*?[.!?](?=\s|$)[\t \r\n]*|[\s\S]+$/g) || [raw];
  let words = 0;
  let end = 0;
  const events = chunks.map(text => {
    words += (text.match(/\S+/g) || []).length;
    end += text.length;
    return { type: 'delta', text, end, atMs: scenario === 'paced' ? words * 1000 / 25 : 0 };
  });
  return [...events, { type: 'done', fullText: raw, end: raw.length, atMs: events.at(-1)?.atMs || 0 }];
}

const relevantFiles = [
  'scripts/evaluation/runReadingCueQualificationRound.mjs',
  'scripts/evaluation/lib/visualCueEvaluationHarness.mjs', 'scripts/evaluation/lib/visualCueEvaluationBudget.mjs',
  'scripts/evaluation/lib/visualCueEvaluationRelay.mjs', 'scripts/evaluation/evaluateReadingCueModel.mjs',
  'functions/lib/visualCueProvider.js', 'functions/lib/inferenceAttempts.js', 'src/worker/readingVisualJob.js',
  'src/worker/readingJob.js', 'shared/generation/visualCuePrompt.js', 'shared/contracts/visualCueBatches.js',
  'shared/contracts/generatedPassageAnnotations.js', 'shared/reading/visualCueLedger.js',
  'scripts/evaluation/lib/readingCueQualification.mjs', 'scripts/evaluation/fixtures/readingCuePricing.json',
  'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json', 'src/data/cardGestureArtwork.js',
  'src/data/cardGestureDetails/majors.js', 'src/data/cardGestureDetails/cupsPentacles.js', 'src/data/cardGestureDetails/wandsSwords.js',
  'package.json', 'package-lock.json', 'tests/helpers/d1Sqlite.mjs'
];
/** Pin transitive local ESM imports/re-exports, including literal dynamic imports.
 * Package versions are pinned separately by the package lock; runtime D1 SQL
 * files are explicit roots because the existing helper loads them by directory.
 */
async function runtimeFileDigests(root, seedPaths) {
  const pending = seedPaths.map(path => resolve(root, path));
  const digests = new Map();
  while (pending.length) {
    const path = pending.pop();
    if (digests.has(path)) continue;
    const bytes = await readFile(path);
    digests.set(path, cueDigest(bytes));
    if (!/\.(?:[cm]?js|jsx|tsx?|json)$/.test(path)) continue;
    const source = bytes.toString('utf8');
    const imports = [
      ...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]/g),
      ...source.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)
    ];
    for (const match of imports) {
      const dependency = resolve(dirname(path), match[1]);
      if (!relative(root, dependency).startsWith('..')) pending.push(dependency);
    }
  }
  return Object.fromEntries([...digests].map(([path, digest]) => {
    const local = relative(root, path);
    return [local.startsWith('..') ? path : local, digest];
  }).sort(([left], [right]) => left.localeCompare(right)));
}
export async function createCueRunIdentity({ cases, phase, candidates = DEFAULT_CUE_CANDIDATES, repeats = 2, live = false,
  root = repositoryRoot, relevantPaths = relevantFiles, dispatchConfiguration = {}, catalog = [] } = {}) {
  const head = (await execute('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
  const seedPaths = [...relevantPaths];
  if (relevantPaths === relevantFiles) seedPaths.push(...(await readdir(resolve(root, 'migrations'))).filter(name => name.endsWith('.sql')).map(name => `migrations/${name}`));
  const fileDigests = await runtimeFileDigests(root, seedPaths);
  const dirtyPaths = (await execute('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root })).stdout.split('\n')
    .filter(line => line && Object.hasOwn(fileDigests, line.slice(3))).map(line => line.slice(3)).sort();
  const promptHashes = Object.fromEntries(cases.map(c => [c.id, cueDigest(buildVisualCuePrompt({ ...cueValidationContext(c), rawPrefix: c.raw, artworkEdition: c.artworkEdition || `identity:${c.deckStyle}` }))]));
  const identity = { head, dirtyPaths, fileDigests, phase, repeats, live, candidates, dispatchConfiguration, catalogSha256: cueDigest(catalog),
    manifestSha256: cases[0]?.labelProvenance?.manifestSha256 ?? null, pricingSha256: cueDigest(CUE_PRICING_SNAPSHOT),
    // systemPromptSha256 is the default (RWS vector) edition; the map beside it covers each case edition.
    schemaSha256: cueDigest(responseFormat), systemPromptSha256: cueDigest(systemPrompt), promptHashes,
    systemPromptSha256ByEdition: Object.fromEntries([...new Set(cases.map(c => c.artworkEdition || `identity:${c.deckStyle}`))].sort()
      .map(edition => [edition, cueDigest(systemPromptFor(edition))])),
    sources: cases.map(c => ({ caseId: c.id, rawSha256: cueDigest(c.raw), cardsSha256: cueDigest(c.cards),
      contextSha256: cueDigest({ question: c.question, reflections: c.reflections }), provenance: c.provenance })) };
  return { ...identity, digest: cueDigest(identity) };
}

export async function runReadingCueEvaluation({ manifest, phase = 'all', live = false, candidates = DEFAULT_CUE_CANDIDATES,
  repeats = 2, maxCalls = 600, maxEstimatedUsd = 15, outputDir, aiAdapter, budget, roundBudgetPath, roundId,
  concurrency = 1, initialAdmission } = {}) {
  if (!['semantic', 'timing', 'all'].includes(phase) || repeats !== 2 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new Error('Invalid frozen cue evaluation configuration.');
  candidates = candidates.map(c => typeof c === 'string' ? DEFAULT_CUE_CANDIDATES.find(item => item.id === c) : c);
  if (!candidates.length || candidates.some(c => !c || !DEFAULT_CUE_CANDIDATES.some(item => canonicalVisualCueJSON(item) === canonicalVisualCueJSON(c)))
    || new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('Unknown/duplicate cue candidate configuration.');
  candidates = structuredClone(candidates);
  if (manifest && typeof manifest === 'object') manifest = structuredClone(manifest);
  if (live && (!aiAdapter?.liveConfigured || (!budget && (!roundBudgetPath || !roundId)))) throw new Error('Explicit live adapter and shared round budget required.');
  if (!live && aiAdapter && !aiAdapter.offline) throw new Error('Explicit offline adapter required.');
  aiAdapter ??= OFFLINE_CUE_ADAPTER;
  const initialConfiguration = resolveCueInitialAdmission({ live, aiAdapter, candidates, initialAdmission });
  const cases = await loadReadingCueCases({ manifest });
  const frozenManifest = manifest && typeof manifest === 'object' ? manifest : JSON.parse(await readFile(manifest || resolve(repositoryRoot, 'scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json'), 'utf8'));
  candidates.sort((a, b) => frozenManifest.candidateOrder.indexOf(a.id) - frozenManifest.candidateOrder.indexOf(b.id));
  const expectedTrials = [{ trialId: 'repeat-1', caseIds: cases.map(c => c.id) },
    { trialId: 'repeat-2', caseIds: cases.filter(c => ['recorded-reading', 'recorded-excerpt'].includes(c.provenance.sourceKind)).map(c => c.id) }];
  const semanticPlan = candidates.flatMap(candidate => expectedTrials.flatMap(trial => trial.caseIds.map(caseId => ({ candidateId: candidate.id, caseId, trialId: trial.trialId }))));
  const timingPlan = phase === 'semantic' ? [] : candidates.flatMap(c => ['star-2347-excerpt', 'five-card-creative-project'].flatMap(caseId => ['paced', 'burst', 'final-only'].map(scenario => ({ candidateId: c.id, caseId, scenario,
    ...(cases.some(item => item.id === caseId) ? { schedule: buildCueDeliverySchedule(cases.find(item => item.id === caseId).raw, scenario).map(({ text: _text, fullText: _fullText, ...event }) => event) } : { skipReason: 'missing-required-timing-case', schedule: [] }) }))));
  const dispatchConfiguration = { concurrency, maxCalls, maxEstimatedUsd, order: 'manifest candidate blocks; repeat-1 all cases then repeat-2 primary cases',
    semanticPlan, timingPlan, deadlineMs: 60000, maxCompletionTokens: 8192, temperature: 0, initialAdmission: initialConfiguration };
  const identity = await createCueRunIdentity({ cases, phase, candidates, repeats, live, dispatchConfiguration, catalog: aiAdapter.availableModels || candidates.map(c => c.model) });
  const runId = `cue:${identity.digest}`;
  outputDir ??= resolve(repositoryRoot, `output/reading-motion/evidence/cue-qualification/dry-run-${Date.now()}-${identity.digest.slice(0, 8)}`);
  await mkdir(dirname(resolve(outputDir)), { recursive: true });
  try { await mkdir(outputDir); } catch (error) { if (error.code === 'EEXIST') throw new Error('Immutable evaluation output directory already exists.'); throw error; }
  budget ??= await openCueRoundBudget({ path: roundBudgetPath || join(outputDir, 'offline-round.json'),
    roundId: roundId || runId, maxCalls, maxEstimatedUsd, mode: live ? 'live' : 'offline' });
  if (live) await budget.bindInitialAdmission(initialConfiguration);
  const report = { version: 1, runId, mode: live ? 'live inference/local job harness' : 'offline fake-adapter checks', live,
    identity, plan: { semantic: semanticPlan, expectedTrials, timing: timingPlan }, semantic: [], timing: [],
    modelCalls: 0, qualified: false, browserAccompaniment: 'unmeasured', selectedCandidate: null, baselineRetained: 'glm-5.3-flash-low', incompleteReasons: [] };
  await writeFile(join(outputDir, 'identity.json'), JSON.stringify(identity, null, 2), { flag: 'wx' });
  await writeFile(join(outputDir, 'plan.json'), JSON.stringify(report.plan, null, 2), { flag: 'wx' });
  const db = await createD1();
  let fatal = null;
  const evaluate = async plan => {
    if (fatal) { report.semantic.push({ ...plan, status: 'incomplete', reason: fatal }); return; }
    const candidate = candidates.find(c => c.id === plan.candidateId);
    const caseData = cases.find(c => c.id === plan.caseId);
    const session = await createVisualCueSession({ caseData, candidate, aiAdapter, live, budget, db, runId, trialId: plan.trialId, initialAdmission: initialConfiguration });
    await session.observe(caseData.raw, { complete: true });
    const result = await session.finish();
    report.semantic.push(result);
    if (result.fatalReason) fatal = result.fatalReason;
    if (result.attempts.length === 0 || result.status === 'failed') {
      if ((await budget.snapshot()).halted || (await budget.snapshot()).attempts.length >= maxCalls) fatal ||= 'budget-or-configuration-stop';
    }
  };
  try {
    if (phase !== 'timing') {
      for (const candidate of candidates) {
        const block = semanticPlan.filter(plan => plan.candidateId === candidate.id);
        let offset = 0;
        await Promise.all(Array.from({ length: concurrency }, async () => { while (offset < block.length) { const plan = block[offset++]; await evaluate(plan); } }));
      }
    }
    if (phase !== 'semantic') {
      for (const plan of timingPlan) {
        if (plan.skipReason) { report.timing.push({ ...plan, status: 'incomplete', reason: plan.skipReason }); continue; }
        if (fatal) { report.timing.push({ ...plan, status: 'incomplete', reason: fatal }); continue; }
        const { createReadingCueRelay } = await import('./visualCueEvaluationRelay.mjs');
        const relay = await createReadingCueRelay({ caseData: cases.find(c => c.id === plan.caseId), candidate: candidates.find(c => c.id === plan.candidateId),
          aiAdapter, live, budget, db, runId, trialId: `timing-${plan.scenario}`, schedule: plan.scenario, offlineImmediate: !live, initialAdmission: initialConfiguration });
        try { relay.startSchedule(); const result = await relay.completion;
          report.timing.push({ ...result, scenario: plan.scenario, browserAccompaniment: 'unmeasured',
            scheduleExecution: live ? 'controlled wall-clock prose schedule' : 'offline immediate scheduler checks; no latency claim' });
          fatal ||= result.fatalReason;
        } finally { await relay.close(); }
      }
    }
  } catch { fatal ||= 'runner-configuration-failure'; }
  report.semantic.sort((a, b) => semanticPlan.findIndex(p => p.caseId === a.caseId && p.trialId === a.trialId && p.candidateId === a.candidateId)
    - semanticPlan.findIndex(p => p.caseId === b.caseId && p.trialId === b.trialId && p.candidateId === b.candidateId));
  for (const plan of semanticPlan) if (phase !== 'timing' && !report.semantic.some(r => r.caseId === plan.caseId && r.trialId === plan.trialId && r.candidateId === plan.candidateId)) report.semantic.push({ ...plan, status: 'incomplete', reason: fatal || 'not-dispatched' });
  for (const plan of timingPlan) if (phase !== 'semantic' && !report.timing.some(r => r.caseId === plan.caseId && r.scenario === plan.scenario && r.candidateId === plan.candidateId)) {
    report.timing.push({ ...plan, status: 'incomplete', reason: fatal || 'not-dispatched' });
  }
  report.budget = await budget.snapshot();
  report.modelCalls = live ? [...report.semantic, ...report.timing].reduce((n, r) => n + (r.attempts?.length || 0), 0) : 0;
  report.fakeDispatches = live ? 0 : [...report.semantic, ...report.timing].reduce((n, r) => n + (r.attempts?.length || 0), 0);
  report.scores = candidates.map(candidate => ({ id: candidate.id, fullyQualified: false,
    score: scoreReadingCueRun({ cases, expectedTrials, ledgers: report.semantic.filter(r => r.candidateId === candidate.id && r.analysisComplete)
      .map(r => ({ caseId: r.caseId, trialId: r.trialId, ledger: r.ledger })) }), receiptLagP95Ms: null, estimatedCost: null }));
  // Model outputs still require independently blinded adjudication and real browser evidence.
  report.ranking = rankReadingCueCandidates(report.scores, frozenManifest.candidateOrder);
  report.incompleteReasons = ['independent-output-adjudication-required', 'browser-timing-and-accompaniment-unmeasured',
    ...(!live ? ['offline-fake-not-model-quality-evidence'] : []), ...(fatal ? [fatal] : []),
    ...(!report.budget.measuredCostComplete ? ['accounting-usage-incomplete'] : []),
    ...(report.budget.admissions?.some(a => !a.allowed) ? ['budget-admission-incomplete'] : []),
    ...(report.semantic.some(r => !r.analysisComplete) ? ['model-analysis-incomplete'] : [])];
  await writeFile(join(outputDir, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  return report;
}
