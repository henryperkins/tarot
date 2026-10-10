import { deferVisualReplay, getVisualReplayLimits, initializeVisualReplay, loadActiveVisualReplay, releaseVisualReplayReadiness, reserveVisualReplay, revokeVisualReplay, settleVisualReplay } from '../../functions/lib/readingVisualRetry.js';
import { createDeadline } from '../../functions/lib/requestDeadline.js';
import { getVisualCueReadiness, runVisualCueAnnotationWithMetadata } from '../../functions/lib/visualCueProvider.js';
import { inferAttemptReason, recordInferenceAttempt } from '../../functions/lib/inferenceAttempts.js';
import { formatSSEEvent } from '../../functions/lib/readingStream.js';
import { jsonResponse } from '../../functions/lib/utils.js';
import { isOriginalVisualWorkAllowed, publicVisualLedger, commitVisualResult, expireVisualResult, loadVisualResultState, registerVisualResult, updateVisualResultSource } from '../../functions/lib/readingVisualResults.js';
import {
  canonicalVisualCueJSON, hashVisualCueText, sameVisualCueBinding,
  visualCueBindingSchema, visualCueResponseSchema
} from '../../shared/contracts/visualCueBatches.js';
import { applyVisualCueBatch, createVisualCueLedger } from '../../shared/reading/visualCueLedger.js';
import { buildVisualCuePrompt } from '../../shared/generation/visualCuePrompt.js';
import { getVectorGestureDetails } from '../data/cardGestureArtwork.js';

const STREAM_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' };
const HEARTBEAT_INTERVAL_MS = 15000;
export const VISUAL_JOB_TTL_MS = 24 * 60 * 60 * 1000;
const TERMINAL = new Set(['complete', 'failed', 'cancelled', 'expired', 'revoked']);
const BLOCKED = new Set(['cancelled', 'expired', 'revoked']);
const buildError = (status, message) => jsonResponse({ error: message }, { status });

/**
 * Narrative observation, asynchronous annotation, and publication are separate.
 * Short state transactions serialize mutations; slow model/hash work runs outside
 * them and must revalidate its epoch and application-issued request at commit.
 */
export class ReadingVisualJob {
  constructor(state, env, { runAnnotation = null } = {}) {
    this.state = state;
    this.env = env;
    this.runAnnotationAdapter = runAnnotation;
    this.encoder = new TextEncoder();
    this.subscribers = new Set();
    this.mutations = Promise.resolve();
    this.commits = Promise.resolve();
    this.replay = null;
    this.binding = null;
    this.ownerUserId = null;
    this.visualToken = null;
    this.validationContext = { cards: [] };
    this.ledger = null;
    this.authoritativeRaw = '';
    this.status = 'pending';
    this.error = null;
    this.inFlightRequest = null;
    this.pendingSnapshot = null;
    this.requestRegistry = [];
    this.requestSequence = 0;
    this.recoveryEpoch = 1;
    this.events = [];
    this.nextEventId = 1;
    this.lastDeliveredEventId = 0;
    this.isComplete = false;
    this.expiresAt = null;
    this.abortController = null;

    this.initialized = this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('visual_job');
      if (!stored) return;
      const keys = ['replay', 'binding', 'ownerUserId', 'visualToken', 'validationContext', 'ledger', 'authoritativeRaw',
        'status', 'error', 'requestRegistry', 'requestSequence', 'events', 'nextEventId',
        'lastDeliveredEventId', 'isComplete', 'expiresAt'];
      for (const key of keys) if (stored[key] !== undefined) this[key] = stored[key];
      this.recoveryEpoch = (stored.recoveryEpoch || 0) + 1;
      for (const request of this.requestRegistry) if (request.status === 'active') request.status = 'abandoned';
      if (this.replay) {
        await this.recoverReplay();
        return;
      }
      let recovered = stored.pendingSnapshot || (stored.inFlightRequest ? {
        raw: this.authoritativeRaw, complete: this.isComplete,
        deliveredEventId: this.lastDeliveredEventId, availableAt: Date.now()
      } : null);
      if (this.env?.DB && this.binding && !['revoked', 'expired'].includes(this.status)) {
        // D1 is committed before the DO snapshot. Recover that narrow crash gap
        // instead of retrying an older ledger against a newer database revision.
        const durable = await loadVisualResultState({ db: this.env.DB, userId: this.ownerUserId,
          readingResultId: this.binding.readingResultId });
        if (!durable || durable.activeAttemptId || !await isOriginalVisualWorkAllowed({ db: this.env.DB, userId: this.ownerUserId,
          readingResultId: this.binding.readingResultId, binding: durable.binding })) {
          this.clearPrivateState('revoked');
          recovered = null;
        } else {
          const advanced = !sameVisualCueBinding(this.binding, durable.binding)
            || (durable.cueLedger?.receipts.length ?? 0) > (this.ledger?.receipts.length ?? 0);
          this.binding = durable.binding;
          this.ledger = durable.cueLedger;
          this.authoritativeRaw = durable.observedRaw;
          this.isComplete = durable.sourceComplete;
          if (advanced) { this.status = durable.status; this.events = []; }
          if (recovered || this.authoritativeRaw !== this.ledger.raw) recovered = {
            raw: this.authoritativeRaw, complete: this.isComplete,
            deliveredEventId: this.lastDeliveredEventId, availableAt: Date.now()
          };
        }
      }
      await this.persistState();
      if (this.expiresAt && this.expiresAt <= Date.now()) {
        await this.expire();
      } else if (recovered && !TERMINAL.has(this.status) && await this.originalWorkAllowed()) {
        this.state.waitUntil(this.processSnapshot(recovered));
      }
    });
  }

  transaction(callback) {
    const next = this.mutations.then(callback);
    this.mutations = next.catch(() => {});
    return next;
  }

  async persistState() {
    await this.state.storage.put('visual_job', {
      replay: this.replay, binding: this.binding, ownerUserId: this.ownerUserId, visualToken: this.visualToken,
      validationContext: this.validationContext, ledger: this.ledger,
      authoritativeRaw: this.authoritativeRaw, status: this.status, error: this.error,
      inFlightRequest: this.inFlightRequest, pendingSnapshot: this.pendingSnapshot,
      requestRegistry: this.requestRegistry, requestSequence: this.requestSequence,
      recoveryEpoch: this.recoveryEpoch, events: this.events, nextEventId: this.nextEventId,
      lastDeliveredEventId: this.lastDeliveredEventId, isComplete: this.isComplete, expiresAt: this.expiresAt
    });
    if (this.expiresAt && this.state.storage.setAlarm && !['expired', 'revoked'].includes(this.status)) {
      await this.state.storage.setAlarm(this.expiresAt);
    }
  }

  envelope(extra = {}) {
    const ledger = publicVisualLedger(this.ledger);
    return { binding: this.binding, status: this.status, ledgerRevision: this.ledger?.ledgerRevision ?? 0,
      cues: ledger?.cues ?? [], introductions: ledger?.introductions ?? [], cueLedger: ledger,
      error: this.error, eventId: this.nextEventId - 1, expiresAt: this.expiresAt, ...extra };
  }

  async checkAuth(request) {
    if (this.replay) {
      const active = await loadActiveVisualReplay({ db: this.env.DB, ...this.replay });
      if (!active || active.visual_token !== this.visualToken) return { ok: false, status: 410, error: 'Visual replay is no longer available.' };
    }
    if (['expired', 'revoked'].includes(this.status)) return { ok: false, status: 410, error: 'Visual job is no longer available.' };
    // The narrative can start before optional visual initialization finishes.
    // No credentials or private data are available yet; signal bounded retry
    // rather than permanently rejecting the newly issued capability.
    if (!this.binding) return { ok: false, status: 503, error: 'Visual job initialization is pending. Retry shortly.' };
    // Callers hold the mutation transaction: deletion can invalidate private
    // state here without racing an observation or a ledger commit. An
    // uninitialized DO must remain available for its trusted /init request.
    if (this.binding && this.env?.DB) {
      const [durable, owner] = await Promise.all([
        loadVisualResultState({ db: this.env.DB, userId: this.ownerUserId,
          readingResultId: this.binding.readingResultId }),
        this.ownerUserId
          ? this.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(this.ownerUserId).first()
          : Promise.resolve(true)
      ]);
      if (!owner || !durable || (!this.replay && durable.activeAttemptId) || (this.replay && durable.activeAttemptId !== this.replay.attemptId) || (!this.replay && !sameVisualCueBinding(durable.binding, this.binding))) {
        this.clearPrivateState('revoked');
        await this.persistState();
        this.closeSubscribers();
        return { ok: false, status: 410, error: 'Visual job is no longer available.' };
      }
    }
    const token = request.headers.get('X-Visual-Token') || request.headers.get('X-Job-Token') || new URL(request.url).searchParams.get('token');
    const userId = request.headers.get('X-User-Id');
    if (userId && this.ownerUserId && userId === this.ownerUserId) return { ok: true };
    if (token && this.visualToken && token === this.visualToken) return { ok: true };
    return { ok: false, status: token || userId ? 403 : 401, error: 'Visual job authentication required.' };
  }

  async fetch(request) {
    await this.initialized;
    if (this.expiresAt && this.expiresAt <= Date.now() && !['expired', 'revoked'].includes(this.status)) await this.expire();
    const url = new URL(request.url);
    if (url.pathname === '/replay-init') return this.handleReplayInit(request);
    if (this.replay && ['/init', '/observe'].includes(url.pathname)) return buildError(409, 'Saved replay source is immutable.');
    if (url.pathname === '/init') return this.handleInit(request);
    if (url.pathname === '/observe') return this.handleObserve(request);
    // Only trusted in-Worker callers can reach these private DO routes.
    if (url.pathname === '/revoke') return this.revoke();
    if (url.pathname === '/snapshot' || url.pathname === '/status') return this.handleSnapshot(request);
    if (url.pathname === '/stream') return this.handleStream(request);
    if (url.pathname === '/cancel') return this.handleCancel(request);
    return buildError(404, 'Not found');
  }

  async handleInit(request) {
    let body;
    try { body = await request.json(); } catch { return buildError(400, 'Invalid JSON payload.'); }
    const { binding, visualToken, ownerUserId = null, validationContext = {} } = body;
    if (!visualCueBindingSchema.safeParse(binding).success || !visualToken) return buildError(400, 'Missing visual binding or capability.');
    return this.transaction(async () => {
      if (this.binding) {
        // Retry initialization must never reset work, rotate an owner, or resurrect a revoked result.
        if (['revoked', 'expired'].includes(this.status)) return buildError(410, 'Visual job is no longer available.');
        const sameIdentity = binding.readingResultId === this.binding.readingResultId
          && binding.spreadHash === this.binding.spreadHash && binding.contextHash === this.binding.contextHash
          && binding.artworkEdition === this.binding.artworkEdition && binding.catalogVersion === this.binding.catalogVersion;
        if (!sameIdentity || visualToken !== this.visualToken || ownerUserId !== this.ownerUserId) return buildError(409, 'Visual initialization conflicts with the registered result.');
        return jsonResponse({ ok: true });
      }
      if (['revoked', 'expired'].includes(this.status)) return buildError(410, 'Visual job is no longer available.');
      const expiresAt = Date.now() + VISUAL_JOB_TTL_MS;
      const registered = await registerVisualResult({ db: this.env?.DB, userId: ownerUserId,
        readingResultId: binding.readingResultId, binding, expiresAt });
      if (!registered.ok) return buildError(409, 'Visual result registration failed.');
      Object.assign(this, { binding, visualToken, ownerUserId, validationContext,
        ledger: createVisualCueLedger(binding), status: 'running', expiresAt });
      await this.persistState();
      return jsonResponse({ ok: true });
    });
  }

  async recoverReplay() {
    // Never redispatch from eviction/status/reconnect. Even an uncertain reserved
    // call is consumed. D1 can reconcile a commit made before DO storage failed.
    const claim = await loadActiveVisualReplay({ db: this.env.DB, ...this.replay });
    if (!claim) this.clearPrivateState('revoked');
    else if (claim.retry_status === 'complete') {
      const durable = await loadVisualResultState({ db: this.env.DB, userId: this.ownerUserId, readingResultId: this.binding.readingResultId });
      if (durable?.activeAttemptId === this.replay.attemptId) { this.ledger = durable.cueLedger; this.binding = durable.binding; this.status = 'complete'; }
      else this.clearPrivateState('revoked');
    } else if (claim.dispatch_status === 'reserved') {
      await settleVisualReplay({ db: this.env.DB, claim });
      this.status = 'failed';
    } else if (claim.retry_status === 'exhausted') this.status = 'failed';
    this.inFlightRequest = null; this.pendingSnapshot = null;
    await this.persistState();
  }

  async handleReplayInit(request) {
    let body;
    try { body = await request.json(); } catch { return buildError(400, 'Invalid replay initialization.'); }
    let launch = null;
    const response = await this.transaction(async () => {
      if (['expired', 'revoked'].includes(this.status)) return buildError(410, 'Visual replay is no longer available.');
      const identity = { claimId: body.claimId, attemptId: body.attemptId, expectedClaimVersion: body.expectedClaimVersion };
      const claim = await loadActiveVisualReplay({ db: this.env.DB, ...identity });
      if (!claim || claim.visual_job_id !== body.visualJobId) return buildError(409, 'Replay claim is no longer active.');
      if (this.binding) {
        if (!this.replay || this.replay.claimId !== claim.id || this.replay.attemptId !== claim.attempt_id) return buildError(409, 'Replay identity conflicts.');
        // A readiness failure may be retried through an explicit POST only.
        if (claim.dispatch_status === 'prepared' && !this.inFlightRequest) launch = claim;
        return jsonResponse({ ok: true });
      }
      const initialized = await initializeVisualReplay({ db: this.env.DB, claim });
      if (!initialized) return buildError(409, 'Replay source is no longer active.');
      Object.assign(this, initialized, { replay: identity, ownerUserId: claim.user_id, visualToken: claim.visual_token,
        authoritativeRaw: initialized.source.raw, isComplete: true, status: 'running', expiresAt: claim.expires_at });
      await this.persistState();
      if (claim.dispatch_status === 'prepared') launch = claim;
      else await this.recoverReplay();
      return jsonResponse({ ok: true });
    });
    if (launch) this.state.waitUntil(this.processReplay(launch));
    return response;
  }

  async processReplay(claim) {
    let record;
    try {
      record = await this.transaction(async () => {
        if (this.inFlightRequest || BLOCKED.has(this.status)) return null;
        const reservation = this.reserveSnapshot({ availableAt: Date.now() });
        await this.persistState(); return reservation;
      });
      if (!record) return;
      const analyzedHash = await hashVisualCueText(this.authoritativeRaw);
      // Persisted DB reservation is the last admission step before invocation.
      const reserved = await reserveVisualReplay({ env: this.env, claim });
      if (!reserved) {
        await deferVisualReplay({ db: this.env.DB, claim });
        await this.transaction(async () => {
          if (this.isCurrent(record)) { this.inFlightRequest = null; this.status = 'failed'; await this.persistState(); }
        });
        return;
      }
      if (!this.isCurrent(record) || !await loadActiveVisualReplay({ db: this.env.DB, ...this.replay })) throw new Error('Replay admission changed.');
      const issuedRequest = { binding: this.binding, status: 'active', batchId: record.batchId,
        requestSequence: record.requestSequence, analyzedEnd: this.authoritativeRaw.length, analyzedHash, baseLedgerRevision: this.ledger.ledgerRevision };
      const captured = this.ledger;
      const configured = Number(this.env.VISUAL_CUE_TIMEOUT_MS);
      const deadline = createDeadline({ signal: this.abortController.signal,
        timeoutMs: Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60000) : 30000 });
      let response;
      let readinessLost = false;
      try { response = await deadline.run(() => {
        if (!getVisualReplayLimits(this.env) || !getVisualCueReadiness(this.env).ready) { readinessLost = true; return null; }
        return this.executeAnnotation({ rawPrefix: this.authoritativeRaw, priorAcceptedCues: captured.cues, signal: deadline.signal });
      }); }
      finally { deadline.dispose(); }
      if (readinessLost) {
        await releaseVisualReplayReadiness({ db: this.env.DB, claim });
        await deferVisualReplay({ db: this.env.DB, claim });
        await this.transaction(async () => {
          if (this.isCurrent(record)) { this.inFlightRequest = null; this.status = 'failed'; await this.persistState(); }
        });
        return;
      }
      if (!this.isCurrent(record)) return;
      const result = await applyVisualCueBatch({ ledger: captured, issuedRequest, response, authoritativeRaw: this.authoritativeRaw,
        validationContext: { ...this.validationContext, getSupportedDetails: (name, edition) => edition === 'rws-immanuelle-vector' ? getVectorGestureDetails(name) : [] } });
      if (result.ledger === captured || (response.proposals?.length && result.rejected.length && !result.addedCueIds.length)
        || !this.isCurrent(record)) throw new Error('Replay validation failed.');
      await this.transaction(async () => {
        if (!this.isCurrent(record)) return;
        if (!await settleVisualReplay({ db: this.env.DB, claim, ledger: result.ledger })) throw new Error('Replay source changed.');
        this.ledger = result.ledger; this.status = 'complete'; this.inFlightRequest = null;
        const cues = this.recordEvent('cues', this.envelope({ addedCueIds: result.addedCueIds }));
        const done = this.recordEvent('done', this.envelope());
        await this.persistState(); this.broadcast(cues); this.broadcast(done); this.closeSubscribers();
      });
    } catch {
      // Retain the prior ledger; only a validated fenced successor replaces it.
      try {
        await settleVisualReplay({ db: this.env.DB, claim });
        await deferVisualReplay({ db: this.env.DB, claim, available: getVisualCueReadiness(this.env).ready && !!getVisualReplayLimits(this.env) });
      } catch { /* Unknown state keeps the durable reservation. */ }
      await this.transaction(async () => {
        if (record && this.isCurrent(record)) { this.inFlightRequest = null; this.status = 'failed'; this.error = 'Visual accompaniment is temporarily unavailable.';
          const event = this.recordEvent('error', this.envelope()); await this.persistState(); this.broadcast(event); this.closeSubscribers(); }
      });
    }
  }

  async handleObserve(request) {
    let body;
    try { body = await request.json(); } catch { return buildError(400, 'Invalid JSON payload.'); }
    const { binding, raw, deliveredEventId = 0, complete = false, availableAt = Date.now() } = body;
    if (!visualCueBindingSchema.safeParse(binding).success || typeof raw !== 'string' || raw.length > 120000
      || !Number.isSafeInteger(deliveredEventId) || deliveredEventId < 0) return buildError(400, 'Invalid observation payload.');
    let launch = null;
    let reservation = null;
    const response = await this.transaction(async () => {
      if (BLOCKED.has(this.status)) return jsonResponse({ ok: false, status: this.status }, { status: 410 });
      if (!this.binding) return buildError(409, 'Visual job not initialized.');
      const replacement = binding.sourceRevision > this.binding.sourceRevision;
      const expectedBinding = replacement ? { ...this.binding, sourceRevision: binding.sourceRevision } : this.binding;
      if (!sameVisualCueBinding(binding, expectedBinding)) return buildError(409, 'Observation does not match the registered source.');
      if (!replacement && deliveredEventId && deliveredEventId <= this.lastDeliveredEventId) return jsonResponse({ ok: true, status: 'duplicate' }, { status: 202 });
      if (!replacement && !raw.startsWith(this.authoritativeRaw)) return buildError(409, 'Observation is not an authoritative prefix.');
      if (!replacement && this.isComplete && raw !== this.authoritativeRaw) return buildError(409, 'Completed source cannot grow.');
      const updated = await updateVisualResultSource({ db: this.env?.DB, userId: this.ownerUserId,
        readingResultId: binding.readingResultId, binding, raw, complete: Boolean(complete || (!replacement && this.isComplete)) });
      if (!updated.ok) return buildError(409, 'Visual source persistence failed.');
      if (replacement) {
        this.invalidateWork();
        this.binding = binding;
        this.ledger = createVisualCueLedger(binding);
        this.isComplete = false;
        this.events = [];
      }
      this.authoritativeRaw = raw;
      this.lastDeliveredEventId = deliveredEventId;
      this.isComplete ||= Boolean(complete);
      const snapshot = { raw, complete: this.isComplete, deliveredEventId, availableAt };
      if (this.inFlightRequest) this.pendingSnapshot = snapshot;
      else launch = snapshot;
      this.status = 'running';
      this.error = null;
      // Reserve synchronously, before hashing or dispatch, to prevent simultaneous
      // observations from each starting an independent adapter.
      if (launch) reservation = this.reserveSnapshot(launch);
      await this.persistState();
      return jsonResponse({ ok: true, status: launch ? 'accepted' : 'coalesced' }, { status: 202 });
    });
    if (launch) this.state.waitUntil(this.processSnapshot(launch, reservation));
    return response;
  }

  reserveSnapshot(snapshot) {
    const record = { batchId: crypto.randomUUID(), recoveryEpoch: this.recoveryEpoch,
      binding: this.binding, requestSequence: ++this.requestSequence, startedAt: Date.now(),
      availableAt: snapshot.availableAt, preparing: true };
    this.inFlightRequest = record;
    this.abortController = new AbortController();
    return record;
  }

  isCurrent(record) {
    return record && record.recoveryEpoch === this.recoveryEpoch && !BLOCKED.has(this.status)
      && record.batchId === this.inFlightRequest?.batchId && sameVisualCueBinding(record.binding, this.binding);
  }

  async originalWorkAllowed() {
    if (this.replay) return false;
    const binding = this.binding;
    const allowed = binding && await isOriginalVisualWorkAllowed({ db: this.env?.DB,
      userId: this.ownerUserId, readingResultId: binding.readingResultId, binding });
    if (!allowed) await this.transaction(async () => {
      this.clearPrivateState('revoked');
      await this.persistState();
      this.closeSubscribers();
    });
    return !!allowed;
  }

  async processSnapshot(snapshot, reserved = null) {
    if (!await this.originalWorkAllowed()) return;
    let record = reserved;
    if (!record) record = await this.transaction(async () => {
      if (BLOCKED.has(this.status) || this.inFlightRequest) return null;
      const next = this.reserveSnapshot(snapshot);
      this.status = 'running';
      await this.persistState();
      return next;
    });
    if (!record) return;
    try {
      if (!snapshot.raw || snapshot.raw === this.ledger?.raw) {
        return await this.finishWithoutRequest(record);
      }
      const analyzedHash = await hashVisualCueText(snapshot.raw);
      const issuedRequest = await this.transaction(async () => {
        if (!this.isCurrent(record)) return null;
        const issued = { binding: record.binding, status: 'active', batchId: record.batchId,
          requestSequence: record.requestSequence, analyzedEnd: snapshot.raw.length,
          analyzedHash, baseLedgerRevision: this.ledger.ledgerRevision };
        Object.assign(record, issued, { preparing: false });
        this.requestRegistry.push({ ...issued });
        await this.persistState();
        return issued;
      });
      if (!issuedRequest || !await this.originalWorkAllowed() || !this.isCurrent(record)) return;
      const response = await this.executeAnnotation({ rawPrefix: snapshot.raw,
        priorAcceptedCues: this.ledger.cues, signal: this.abortController?.signal });
      const committed = await this.commitBatch({ issuedRequest, response, recoveryEpoch: record.recoveryEpoch,
        availableAt: snapshot.availableAt, annotationStartedAt: record.startedAt, annotationFinishedAt: Date.now() });
      if (!committed.ok) await this.failRequest(record);
    } catch {
      // No provider errors or prompt-bearing values are sent to clients/logs.
      await this.failRequest(record);
    }
  }

  async executeAnnotation({ rawPrefix, priorAcceptedCues, signal }) {
    if (!this.replay && !await this.originalWorkAllowed()) throw new Error('Original visual work is no longer admitted.');
    signal?.throwIfAborted();
    const prompt = buildVisualCuePrompt({ rawPrefix, cards: this.validationContext?.cards ?? [],
      artworkEdition: this.binding?.artworkEdition, priorAcceptedCues,
      question: this.validationContext?.question, reflections: this.validationContext?.reflections });
    const id = crypto.randomUUID();
    const requestId = this.binding?.readingResultId;
    const startedAtMs = Date.now();
    // One row per dispatch, independent of cue acceptance and commit replay.
    const recordAttempt = metadata => recordInferenceAttempt(this.env, {
      id, requestId, task: 'visual-cues', provider: metadata?.provider ?? 'unknown',
      requestedModel: metadata?.requestedModel ?? null, model: metadata?.returnedModel ?? null,
      usage: metadata?.usage ?? null, startedAtMs: metadata?.startedAtMs ?? startedAtMs,
      finishedAtMs: metadata?.finishedAtMs ?? Date.now(), state: metadata?.outcome ?? 'accepted',
      reason: metadata?.reason ?? null
    });
    let result;
    try {
      result = await (this.runAnnotationAdapter
        ? this.runAnnotationAdapter({ prompt, responseSchema: visualCueResponseSchema, signal, env: this.env })
        : runVisualCueAnnotationWithMetadata({ env: this.env, prompt, signal }));
    } catch (error) {
      if (error?.visualCueAttempt || this.runAnnotationAdapter) await recordAttempt(error?.visualCueAttempt ?? {
        outcome: 'failed', reason: inferAttemptReason(error, signal)
      });
      throw error;
    }
    const wrapped = result && Object.hasOwn(result, 'response') && Object.hasOwn(result, 'metadata');
    await recordAttempt(wrapped ? result.metadata : null);
    // Only proposal data reaches the ledger and its public snapshots.
    return wrapped ? result.response : result;
  }

  registeredRequest(issuedRequest) {
    const registered = this.requestRegistry.find(item => item.batchId === issuedRequest?.batchId);
    if (!registered) return null;
    const { status: _status, ...fields } = registered;
    const { status: _suppliedStatus, ...supplied } = issuedRequest;
    return canonicalVisualCueJSON(fields) === canonicalVisualCueJSON(supplied) ? registered : null;
  }

  async commitBatch(options) {
    // Slow validation serializes with other callbacks, but never with observations
    // or cancellation; those can invalidate this work during any await.
    const work = this.commits.then(() => this.applyCommit(options));
    this.commits = work.catch(() => {});
    const outcome = await work;
    if (outcome.next) await this.processSnapshot(outcome.next);
    return outcome;
  }

  async applyCommit({ issuedRequest, response, recoveryEpoch, availableAt = 0, annotationStartedAt = 0, annotationFinishedAt = 0 }) {
    const captured = await this.transaction(() => {
      if (recoveryEpoch !== this.recoveryEpoch) return { reason: 'stale-epoch' };
      if (BLOCKED.has(this.status)) return { reason: this.status };
      const registered = this.registeredRequest(issuedRequest);
      if (!registered || !['active', 'committed'].includes(registered.status)) return { reason: 'unregistered-request' };
      return { ledger: this.ledger, raw: this.authoritativeRaw, context: this.validationContext, registered };
    });
    if (captured.reason) return { ok: false, reason: captured.reason };
    const result = await applyVisualCueBatch({ ledger: captured.ledger,
      issuedRequest: { ...captured.registered, status: 'active' }, response, authoritativeRaw: captured.raw,
      validationContext: { ...captured.context, getSupportedDetails: (name, edition) => edition === 'rws-immanuelle-vector' ? getVectorGestureDetails(name) : [] } });
    return this.transaction(async () => {
      if (recoveryEpoch !== this.recoveryEpoch || !sameVisualCueBinding(issuedRequest.binding, this.binding)) return { ok: false, reason: 'stale-epoch' };
      if (BLOCKED.has(this.status)) return { ok: false, reason: this.status };
      if (result.duplicate) return { ok: true, result };
      if (captured.registered.status !== 'active' || this.ledger !== captured.ledger) return { ok: false, reason: 'superseded-request' };
      if (result.ledger === captured.ledger) return { ok: false, reason: result.rejected[0]?.code || 'invalid-result' };
      const next = this.pendingSnapshot;
      const status = next ? 'running' : this.isComplete ? 'complete' : 'running';
      const persisted = await commitVisualResult({ db: this.env?.DB, userId: this.ownerUserId,
        readingResultId: this.binding.readingResultId, binding: this.binding,
        expectedLedgerRevision: captured.ledger.ledgerRevision, expectedReceiptCount: captured.ledger.receipts.length, ledger: result.ledger,
        status, finalRaw: this.isComplete ? this.authoritativeRaw : null });
      if (!persisted.ok) throw new Error('Visual result persistence failed.');
      this.ledger = result.ledger;
      captured.registered.status = 'committed';
      this.inFlightRequest = null;
      this.pendingSnapshot = null;
      this.status = status;
      this.error = null;
      const entries = [];
      // Publish even an empty-cue prefix advance: consumers need the complete,
      // source-bound ledger, not a partial collection of annotations.
      entries.push(this.recordEvent('cues', this.envelope({ addedCueIds: result.addedCueIds,
        timing: { availableAt, annotationStartedAt, annotationFinishedAt, ledgerCommittedAt: Date.now() } })));
      if (status === 'complete') entries.push(this.recordEvent('done', this.envelope()));
      await this.persistState();
      for (const entry of entries) this.broadcast(entry);
      if (TERMINAL.has(this.status)) this.closeSubscribers();
      return { ok: true, result, next };
    });
  }

  async finishWithoutRequest(record) {
    const next = await this.transaction(async () => {
      if (!this.isCurrent(record)) return null;
      this.inFlightRequest = null;
      const pending = this.pendingSnapshot;
      this.pendingSnapshot = null;
      this.status = pending ? 'running' : this.isComplete ? 'complete' : 'running';
      const persisted = await commitVisualResult({ db: this.env?.DB, userId: this.ownerUserId,
        readingResultId: this.binding.readingResultId, binding: this.binding,
        expectedLedgerRevision: this.ledger.ledgerRevision, expectedReceiptCount: this.ledger.receipts.length, ledger: this.ledger,
        status: this.status, finalRaw: this.isComplete ? this.authoritativeRaw : null });
      if (!persisted.ok) throw new Error('Visual result persistence failed.');
      const entry = this.status === 'complete' ? this.recordEvent('done', this.envelope()) : null;
      await this.persistState();
      if (entry) { this.broadcast(entry); this.closeSubscribers(); }
      return pending;
    });
    if (next) await this.processSnapshot(next);
  }

  async failRequest(record) {
    const next = await this.transaction(async () => {
      if (!this.isCurrent(record)) return null;
      const registered = this.requestRegistry.find(item => item.batchId === record.batchId);
      if (registered) registered.status = 'failed';
      this.inFlightRequest = null;
      const pending = this.pendingSnapshot;
      this.pendingSnapshot = null;
      this.status = pending ? 'running' : 'failed';
      this.error = pending ? null : (!this.runAnnotationAdapter && !this.env?.VISUAL_CUE_PROVIDER && !this.env?.VISUAL_CUE_MODEL
        ? 'Visual model is not configured.' : 'Visual accompaniment is temporarily unavailable.');
      if (!pending) await commitVisualResult({ db: this.env?.DB, userId: this.ownerUserId,
        readingResultId: this.binding.readingResultId, binding: this.binding,
        expectedLedgerRevision: this.ledger.ledgerRevision, expectedReceiptCount: this.ledger.receipts.length,
        ledger: this.ledger, status: this.status, finalRaw: this.isComplete ? this.authoritativeRaw : null });
      const entry = pending ? null : this.recordEvent('error', this.envelope({ message: this.error }));
      await this.persistState();
      if (entry) { this.broadcast(entry); this.closeSubscribers(); }
      return pending;
    });
    if (next) await this.processSnapshot(next);
  }

  invalidateWork() {
    this.recoveryEpoch++;
    this.abortController?.abort();
    this.abortController = null;
    for (const request of this.requestRegistry) if (request.status === 'active') request.status = 'abandoned';
    this.inFlightRequest = null;
    this.pendingSnapshot = null;
  }

  recordEvent(event, data) {
    const entry = { id: this.nextEventId++, event, data, timestamp: Date.now() };
    // Every event contains the latest ledger; a bounded tail suffices for replay.
    this.events = [...this.events.slice(-15), entry];
    return entry;
  }

  broadcast(entry) {
    const bytes = this.encoder.encode(formatSSEEvent(entry.event, { ...entry.data, eventId: entry.id }));
    for (const sub of this.subscribers) {
      try { sub.controller.enqueue(bytes); } catch { this.removeSubscriber(sub); }
    }
  }

  removeSubscriber(sub) {
    if (sub.heartbeat) clearInterval(sub.heartbeat);
    this.subscribers.delete(sub);
  }

  closeSubscribers() {
    for (const sub of this.subscribers) {
      try { sub.controller.close(); } catch { /* Already closed. */ }
      this.removeSubscriber(sub);
    }
  }

  async handleSnapshot(request) {
    return this.transaction(async () => {
      const auth = await this.checkAuth(request);
      return auth.ok ? jsonResponse(this.envelope()) : buildError(auth.status, auth.error);
    });
  }

  async handleCancel(request) {
    return this.transaction(async () => {
      const auth = await this.checkAuth(request);
      if (!auth.ok) return buildError(auth.status, auth.error);
      if (this.replay) {
        await revokeVisualReplay({ db: this.env.DB, replay: this.replay });
      }
      this.invalidateWork();
      this.status = 'cancelled';
      await commitVisualResult({ db: this.env?.DB, userId: this.ownerUserId,
        readingResultId: this.binding.readingResultId, binding: this.binding,
        expectedLedgerRevision: this.ledger.ledgerRevision, expectedReceiptCount: this.ledger.receipts.length,
        ledger: this.ledger, status: this.status, finalRaw: this.isComplete ? this.authoritativeRaw : null });
      const entry = this.recordEvent('done', this.envelope());
      await this.persistState();
      this.broadcast(entry);
      this.closeSubscribers();
      return jsonResponse(this.envelope());
    });
  }

  clearPrivateState(status) {
    this.invalidateWork();
    Object.assign(this, { status, visualToken: null, ownerUserId: null, ledger: null,
      authoritativeRaw: '', validationContext: { cards: [] }, requestRegistry: [], events: [], error: null });
  }

  async revoke() {
    await this.transaction(async () => {
      if (this.replay) await revokeVisualReplay({ db: this.env.DB, replay: this.replay });
      this.clearPrivateState('revoked');
      await this.persistState();
      this.closeSubscribers();
    });
    return jsonResponse({ ok: true, status: 'revoked' });
  }

  async expire() {
    await this.transaction(async () => {
      if (!this.replay) await expireVisualResult({ db: this.env?.DB, userId: this.ownerUserId, readingResultId: this.binding?.readingResultId });
      this.clearPrivateState('expired');
      await this.persistState();
      this.closeSubscribers();
    });
  }

  async alarm() {
    await this.initialized;
    if (this.expiresAt && this.expiresAt <= Date.now()) await this.expire();
  }

  async handleStream(request) {
    return this.transaction(async () => {
      const auth = await this.checkAuth(request);
      if (!auth.ok) return buildError(auth.status, auth.error);
      let subscriber;
      const stream = new ReadableStream({
        start: controller => {
          subscriber = { controller, heartbeat: null };
          controller.enqueue(this.encoder.encode(formatSSEEvent('snapshot', this.envelope())));
          if (TERMINAL.has(this.status)) {
            controller.enqueue(this.encoder.encode(formatSSEEvent('done', this.envelope())));
            controller.close();
            return;
          }
          this.subscribers.add(subscriber);
          subscriber.heartbeat = setInterval(() => {
            try { if (controller.desiredSize > 0) controller.enqueue(this.encoder.encode(': heartbeat\n\n')); }
            catch { this.removeSubscriber(subscriber); }
          }, HEARTBEAT_INTERVAL_MS);
        },
        cancel: () => { if (subscriber) this.removeSubscriber(subscriber); }
      });
      return new Response(stream, { headers: STREAM_HEADERS });
    });
  }
}
