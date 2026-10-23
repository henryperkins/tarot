import { persistReadingMemoryAccess } from '../../functions/lib/userMemory.js';
import { onRequestPost as tarotReadingPost } from '../../functions/api/tarot-reading.js';
import { formatSSEEvent } from '../../functions/lib/readingStream.js';
import { jsonResponse } from '../../functions/lib/utils.js';
import { observeDeliveredReading } from '../../functions/lib/visualCueObserver.js';

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive'
};

export const JOB_TTL_MS = 60 * 60 * 1000;
// Jobs started by the ChatGPT MCP tools stay readable for a day, so a reading
// can still be saved later in the same conversation (spec §7.4).
export const MCP_JOB_TTL_MS = 24 * 60 * 60 * 1000;
const JOB_NOT_FOUND = 'Reading job not found.';
const MAX_STORED_EVENTS = 300;
const PERSIST_BATCH_EVENTS = 15;
const PERSIST_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 15000;
// Older versions ignore this separate key, but their job-envelope writes drop
// run/attempt validation identities. Rollback needs a receipt-aware target or
// drained receipts; keeping this raw key alone does not guarantee later replay.
const MEMORY_RECEIPT_KEY = 'readingMemoryReceipt';
const MEMORY_RETRY_DELAYS_MS = [5000, 30000];
const MAX_MEMORY_ROUNDS = 3;
const boundedIdentity = value => typeof value === 'string' && value.length > 0 && value.length <= 256;

function normalizeMemoryUsage(value) {
  if (!value || !boundedIdentity(value.userId) || !boundedIdentity(value.requestId)
    || !boundedIdentity(value.attemptId) || !Number.isFinite(value.completedAt) || value.completedAt <= 0
    || !Array.isArray(value.ids) || !value.ids.length || value.ids.length > 3
    || value.ids.some(id => !boundedIdentity(id))) return null;
  return Object.freeze({
    userId: value.userId, ids: Object.freeze([...new Set(value.ids)]),
    completedAt: value.completedAt, requestId: value.requestId, attemptId: value.attemptId
  });
}

function receiptMatches(receipt, stored) {
  const job = stored?.job;
  return receipt?.version === 1 && normalizeMemoryUsage(receipt)
    && boundedIdentity(receipt.receiptId) && boundedIdentity(receipt.runId) && boundedIdentity(receipt.jobId)
    && receipt.jobId === job?.jobId && receipt.runId === stored.runId
    && receipt.attemptId === stored.acceptedAttemptId
    && job.status === 'complete' && typeof job.result?.reading === 'string' && job.result.reading.length > 0
    && !job.result.gateBlocked && !['safe-fallback', 'safety-gate'].includes(job.result.provider)
    && receipt.requestId === job.result.requestId
    && Number.isFinite(job.expiresAt) && job.expiresAt > 0
    && (!job.principalUserId || receipt.userId === job.principalUserId)
    && Number.isInteger(receipt.attempts) && receipt.attempts >= 0 && receipt.attempts <= MAX_MEMORY_ROUNDS
    && (receipt.nextAttemptAt === null || (Number.isFinite(receipt.nextAttemptAt) && receipt.nextAttemptAt >= 0));
}

function buildError(status, message) {
  return jsonResponse({ error: message }, { status });
}

function getJobToken(request) {
  return request.headers.get('X-Job-Token') || '';
}

function normalizeCursor(value) {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function emptyJob() {
  return {
    status: 'idle',
    jobId: null,
    token: null,
    createdAt: null,
    updatedAt: null,
    expiresAt: null,
    meta: null,
    result: null,
    error: null,
    // Machine-readable reason for a failed job, when the reading service gave one.
    errorCode: null,
    startedAt: null,
    // Set only for jobs started by the MCP tools (in-Worker callers).
    principalUserId: null,
    snapshot: null,
    retentionMs: null
  };
}

export class ReadingJob {
  /**
   * @param {DurableObjectState} state
   * @param {object} env
   * @param {{ runReading?: Function }} [options] - Tests inject the reading
   *   runner; the Workers runtime always uses the default.
   */
  constructor(state, env, { runReading = tarotReadingPost } = {}) {
    this.state = state;
    this.env = env;
    this.runReading = runReading;
    this.encoder = new TextEncoder();
    this.subscribers = new Set();
    this.events = [];
    this.nextEventId = 1;
    this.textSoFar = '';
    this.truncatedBeforeId = 0;
    this.persistEventCount = 0;
    this.lastPersistAt = 0;
    this.cancelled = false;
    this.pendingMemoryUsage = null;
    this.memoryReceipt = null;
    this.runId = null;
    this.acceptedAttemptId = null;
    this.storageTail = Promise.resolve();
    this.receiptDrain = null;
    this.job = emptyJob();
    this.readingResultId = null;
    this.visualBinding = null;
    this.visualJobToken = null;
    this.visualInit = null;
    this.abortController = null;
    this.runningPromise = null;
    this.deletionScheduledAt = null;
    this.initialized = this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('job');
      if (stored) {
        this.job = stored.job || this.job;
        this.runId = stored.runId || null;
        this.acceptedAttemptId = stored.acceptedAttemptId || null;
        this.readingResultId = stored.readingResultId || null;
        this.visualBinding = stored.visualBinding || null;
        this.visualJobToken = stored.visualJobToken || null;
        this.visualInit = stored.visualInit || null;
        this.events = Array.isArray(stored.events) ? stored.events : [];
        this.nextEventId = stored.nextEventId || (this.events.length + 1);
        this.textSoFar = typeof stored.textSoFar === 'string' ? stored.textSoFar : '';
        this.truncatedBeforeId = stored.truncatedBeforeId || 0;
      }
      const receipt = await this.state.storage.get(MEMORY_RECEIPT_KEY);
      this.memoryReceipt = receiptMatches(receipt, stored) ? receipt : null;
    });
    const resume = this.initialized.then(() => {
      if (this.memoryReceipt) return this.drainMemoryReceipt();
    });
    this.state.waitUntil?.(resume);
  }

  async fetch(request) {
    await this.initialized;
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/start') {
      return this.handleStart(request);
    }
    if (pathname === '/status') {
      return this.handleStatus(request);
    }
    if (pathname === '/stream') {
      return this.handleStream(request, url);
    }
    if (pathname === '/cancel') {
      return this.handleCancel(request);
    }
    if (pathname === '/mcp/snapshot') {
      return this.handleMcpSnapshot(request);
    }
    if (pathname === '/mcp/cancel') {
      return this.handleMcpCancel(request);
    }
    if (pathname === '/retention') {
      return this.handleRetention();
    }

    return buildError(404, 'Not found');
  }

  async handleStart(request) {
    const token = getJobToken(request);
    if (!token) {
      return buildError(401, 'Missing job token.');
    }

    if (this.job.token && this.job.token !== token) {
      return buildError(403, 'Invalid job token.');
    }

    if (this.job.status === 'running' || this.job.status === 'complete') {
      return jsonResponse({
        jobId: this.job.jobId,
        status: this.job.status
      });
    }

    let body = null;
    try {
      body = await request.json();
    } catch {
      return buildError(400, 'Invalid JSON payload.');
    }

    const payload = body?.payload;
    const jobId = body?.jobId;
    // Only in-Worker callers (readingJobs.startReadingJob, for the MCP tools)
    // send a principal; the public job-start route never does.
    const principalUserId = typeof body?.principal?.userId === 'string' && body.principal.userId
      ? body.principal.userId
      : null;

    if (!payload || !jobId) {
      return buildError(400, 'Missing reading payload.');
    }
    // Another start may have won while this request's body was being read.
    if (this.job.status === 'running' || this.job.status === 'complete') {
      return jsonResponse({ jobId: this.job.jobId, status: this.job.status });
    }
    if (this.job.token && this.job.token !== token) return buildError(403, 'Invalid job token.');
    this.readingResultId = body?.readingResultId || body?.visualBinding?.readingResultId || null;
    this.visualBinding = body?.visualBinding || null;
    this.visualJobToken = body?.visualJobToken || null;
    this.visualInit = body?.visualInit || null;

    this.events = [];
    this.nextEventId = 1;
    this.truncatedBeforeId = 0;
    this.textSoFar = '';
    this.persistEventCount = 0;
    this.lastPersistAt = 0;

    this.job = {
      ...this.job,
      status: 'running',
      jobId,
      token,
      createdAt: this.job.createdAt || Date.now(),
      startedAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: null,
      error: null,
      errorCode: null,
      meta: null,
      result: null,
      principalUserId,
      snapshot: principalUserId ? (body.snapshot ?? null) : null,
      retentionMs: principalUserId ? MCP_JOB_TTL_MS : JOB_TTL_MS
    };
    this.cancelled = false;
    this.pendingMemoryUsage = null;
    this.memoryReceipt = null;
    this.runId = crypto.randomUUID();
    this.acceptedAttemptId = null;
    const runId = this.runId;

    await this.persistState();

    if (this.isActiveRun(runId)) {
      const authHeader = request.headers.get('Authorization') || '';
      const cookieHeader = request.headers.get('Cookie') || '';
      const running = this.runJob(payload, {
        authorization: authHeader,
        cookie: cookieHeader
      }, principalUserId ? { userId: principalUserId } : null);
      this.runningPromise = running;
      this.state.waitUntil(running.finally(() => {
        if (this.runId === runId && this.runningPromise === running) this.runningPromise = null;
      }));
    }

    return jsonResponse({
      jobId,
      status: this.job.status
    });
  }

  async handleStatus(request) {
    const token = getJobToken(request);
    if (!this.job.jobId || this.isPrincipalJob()) {
      return buildError(404, JOB_NOT_FOUND);
    }
    if (!token || token !== this.job.token) {
      return buildError(403, 'Invalid job token.');
    }

    if (await this.expireIfNeeded()) {
      return buildError(410, 'Reading job expired.');
    }

    return jsonResponse({
      jobId: this.job.jobId,
      status: this.job.status,
      meta: this.job.meta,
      result: this.job.result,
      error: this.job.error
    });
  }

  async handleStream(request, url) {
    const token = getJobToken(request);
    if (!this.job.jobId || this.isPrincipalJob()) {
      return buildError(404, JOB_NOT_FOUND);
    }
    if (!token || token !== this.job.token) {
      return buildError(403, 'Invalid job token.');
    }

    if (await this.expireIfNeeded()) {
      return buildError(410, 'Reading job expired.');
    }

    const cursor = normalizeCursor(url.searchParams.get('cursor'));

    let subscriber = null;
    const stream = new ReadableStream({
      start: (controller) => {
        subscriber = { controller, heartbeat: null };
        this.subscribers.add(subscriber);

        // Transport-only comments keep quiet, buffered providers connected.
        // They must not consume event IDs or enter durable replay storage.
        controller.enqueue(this.encoder.encode(': connected\n\n'));

        if (this.truncatedBeforeId > 0 && cursor <= this.truncatedBeforeId && this.textSoFar) {
          controller.enqueue(this.encoder.encode(
            formatSSEEvent('snapshot', {
              fullText: this.textSoFar,
              eventId: this.truncatedBeforeId,
              truncated: true,
              ...(this.visualBinding ? { visualBinding: this.visualBinding, readingResultId: this.readingResultId } : {})
            })
          ));
        }

        // Metadata is a snapshot, not a text delta. A resumed consumer may
        // have lost its in-memory copy even though its cursor was persisted.
        const metadata = this.events.findLast((event) => event.event === 'meta');
        if (metadata && metadata.id <= cursor) {
          controller.enqueue(this.encoder.encode(this.formatEvent(metadata)));
        }
        const backlog = this.events.filter((event) => event.id > cursor);
        backlog.forEach((event) => {
          controller.enqueue(this.encoder.encode(this.formatEvent(event)));
        });

        if (!backlog.length && this.job.status !== 'running') {
          const terminal = this.events[this.events.length - 1];
          if (terminal && (terminal.event === 'done' || terminal.event === 'error')) {
            controller.enqueue(this.encoder.encode(this.formatEvent(terminal)));
          }
        }

        if (this.job.status !== 'running') {
          controller.close();
          this.removeSubscriber(subscriber);
        } else {
          subscriber.heartbeat = setInterval(() => {
            try {
              // Do not accumulate heartbeats for a slow/disconnected reader.
              if (controller.desiredSize > 0) {
                controller.enqueue(this.encoder.encode(': heartbeat\n\n'));
              }
            } catch {
              this.removeSubscriber(subscriber);
            }
          }, HEARTBEAT_INTERVAL_MS);
        }
      },
      cancel: () => {
        if (subscriber) {
          this.removeSubscriber(subscriber);
        }
      }
    });

    return new Response(stream, { headers: STREAM_HEADERS });
  }

  async handleCancel(request) {
    const token = getJobToken(request);
    if (!this.job.jobId || this.isPrincipalJob()) {
      return buildError(404, JOB_NOT_FOUND);
    }
    if (!token || token !== this.job.token) {
      return buildError(403, 'Invalid job token.');
    }

    await this.cancelRun();

    return jsonResponse({ status: this.job.status === 'complete' ? 'complete' : 'cancelled' });
  }

  cancelRun() {
    if (this.job.status === 'complete' || this.job.status === 'error') return;
    this.cancelled = true;
    this.pendingMemoryUsage = null;

    if (this.abortController) {
      this.abortController.abort();
    }

    // The final status transition shares the terminal commit lane. A cancel
    // arriving after the guarded success write cannot publish a second terminal.
    return this.serializeStorage(async () => {
      if (this.job.status !== 'running') return;
      this.appendEvent('error', { message: 'Reading cancelled.' });
      await this.state.storage.put('job', this.snapshotState());
      await this.setNextAlarm(this.state.storage);
    });
  }

  isPrincipalJob() {
    return Boolean(this.job.principalUserId);
  }

  /**
   * Gate for the MCP-only paths. The job must be a principal job, and the
   * caller must be that principal. The job token is not needed here: it stays
   * server-side, guarding /start and the public routes, which never serve
   * principal jobs. Every failure is the same 404, so these paths reveal
   * nothing about other jobs.
   */
  async authorizeMcp(request) {
    const principal = request.headers.get('X-Principal-User-Id') || '';
    if (!this.job.jobId || !this.isPrincipalJob() || principal !== this.job.principalUserId) {
      return buildError(404, JOB_NOT_FOUND);
    }
    if (await this.expireIfNeeded()) {
      return buildError(410, 'Reading job expired.');
    }
    return null;
  }

  async handleMcpSnapshot(request) {
    const denied = await this.authorizeMcp(request);
    if (denied) return denied;
    return jsonResponse({
      jobId: this.job.jobId,
      status: this.job.status,
      snapshot: this.job.snapshot ?? null,
      result: this.job.result,
      error: this.job.error,
      errorCode: this.job.errorCode ?? null,
      meta: { themes: this.job.meta?.themes ?? null }
    });
  }

  async handleMcpCancel(request) {
    const denied = await this.authorizeMcp(request);
    if (denied) return denied;
    // A finished reading keeps its result; only a running job is cancelled.
    if (this.job.status !== 'running') {
      return jsonResponse({ status: this.job.status });
    }
    await this.cancelRun();
    return jsonResponse({ status: 'cancelled' });
  }

  async runJob(payload, authHeaders, principal = null) {
    this.abortController = new AbortController();
    const runId = this.runId;

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      });
      // A principal job authenticates by principal alone; request
      // credentials are never forwarded for it.
      if (!principal && authHeaders.authorization) {
        headers.set('Authorization', authHeaders.authorization);
      }
      if (!principal && authHeaders.cookie) {
        headers.set('Cookie', authHeaders.cookie);
      }

      const request = new Request('https://internal/api/tarot-reading?stream=true', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: this.abortController.signal
      });

      const response = await this.runReading({
        request,
        env: this.env,
        waitUntil: this.state.waitUntil.bind(this.state),
        onReadingMemoryUsage: usage => {
          if (!this.cancelled && this.job.status === 'running' && runId === this.runId) this.pendingMemoryUsage = normalizeMemoryUsage(usage);
        },
        ...(principal ? { principal } : {})
      });

      if (!this.isActiveRun(runId)) return;
      await this.consumeResponse(response, runId);
    } catch (error) {
      if (runId !== this.runId) return;
      if (error?.name === 'AbortError') {
        if (this.job.status !== 'error') {
          this.appendEvent('error', { message: 'Reading cancelled.' });
        }
        return;
      }
      this.appendEvent('error', { message: error?.message || 'Failed to generate reading.' });
    }
  }

  isActiveRun(runId) {
    return runId === this.runId && Boolean(this.job.jobId) && this.job.status === 'running' && !this.cancelled;
  }

  async consumeResponse(response, runId = this.runId) {
    if (!this.isActiveRun(runId)) {
      return;
    }
    const contentType = response.headers.get('content-type') || '';
    const isSSE = contentType.includes('text/event-stream');

    if (!response.ok && !isSSE) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!this.isActiveRun(runId)) return;
      const message = payload?.message || payload?.error || 'Failed to generate reading.';
      let code = typeof payload?.code === 'string' ? payload.code : null;
      if (!code && payload?.tierLimited === true) {
        code = response.status === 429 ? 'reading_limit_reached' : 'plan_feature_unavailable';
      }
      this.appendEvent('error', {
        message,
        ...(code ? { code } : {}),
        ...(payload?.retryable === true ? { retryable: true } : {})
      });
      return;
    }

    if (!isSSE) {
      const payload = await response.json();
      if (!this.isActiveRun(runId)) {
        return;
      }
      if (payload?.reading) {
        const meta = {
          requestId: payload.requestId || null,
          provider: payload.provider || null,
          themes: payload.themes || null,
          reasoning: payload.reasoning || null,
          emotionalTone: payload.emotionalTone || null,
          ephemeris: payload.ephemeris || null,
          context: payload.context || null,
          contextDiagnostics: payload.contextDiagnostics || [],
          graphRAG: payload.graphRAG || null,
          sourceUsage: payload.sourceUsage || null,
          spreadAnalysis: payload.spreadAnalysis || null,
          gateBlocked: payload.gateBlocked || false,
          gateReason: payload.gateReason || null,
          backendErrors: payload.backendErrors || null
        };
        // Mirror processEventBlock, so JSON responses expose meta and result
        // through /status and /mcp/snapshot exactly as SSE responses do.
        this.job.meta = meta;
        this.appendEvent('meta', meta);
        await this.appendEvent('done', {
          fullText: payload.reading,
          provider: payload.provider || null,
          requestId: payload.requestId || null,
          gateBlocked: payload.gateBlocked || false,
          gateReason: payload.gateReason || null
        });
      } else {
        this.appendEvent('error', { message: 'Failed to generate reading.' });
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      this.appendEvent('error', { message: 'Streaming response missing body.' });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!this.isActiveRun(runId)) {
        try {
          await reader.cancel();
        } catch {
          // Ignore cancellation errors.
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const block of events) await this.processEventBlock(block, runId);
    }

    if (buffer.trim()) {
      await this.processEventBlock(buffer, runId);
    }

    if (this.isActiveRun(runId)) {
      this.appendEvent('error', { message: 'Streaming ended unexpectedly.' });
    }
  }

  async processEventBlock(block, runId = this.runId) {
    if (!this.isActiveRun(runId)) return;
    if (!block || !block.trim()) return;
    const lines = block.split(/\r?\n/);
    let eventType = '';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        eventData = line.slice(5).trim();
      }
    }

    if (!eventType || !eventData) return;

    let data;
    try { data = JSON.parse(eventData); } catch { return; }
    if (eventType === 'meta') this.job.meta = data;
    await this.appendEvent(eventType, data);
  }

  appendEvent(eventType, data) {
    if (eventType === 'done') return this.completeJob(data);
    if (this.job.status === 'complete' || this.job.status === 'error') return;
    if (this.cancelled && eventType !== 'error') return;
    const entry = {
      id: this.nextEventId++,
      event: eventType,
      data,
      timestamp: Date.now()
    };

    if (eventType === 'delta' && typeof data?.text === 'string') {
      this.textSoFar += data.text;
    }
    if (this.visualBinding) {
      entry.data = { ...data, visualBinding: this.visualBinding, readingResultId: this.readingResultId };
    }
    this.events.push(entry);
    this.pruneEvents();

    if (eventType === 'error') {
      this.pendingMemoryUsage = null;
      this.job.status = 'error';
      this.job.error = data?.message || 'Streaming error.';
      this.job.errorCode = typeof data?.code === 'string' ? data.code : null;
      this.job.expiresAt = Date.now() + (this.job.retentionMs || JOB_TTL_MS);
    }


    this.job.updatedAt = Date.now();
    this.maybePersist(eventType);
    this.broadcast(entry);

    // Observe only accepted outgoing raw prose. Optional visual initialization and
    // annotation run independently and never delay reading delivery/completion.
    if (this.visualBinding && eventType === 'delta') {
      this.state.waitUntil(observeDeliveredReading({
        env: this.env, init: this.visualInit, binding: this.visualBinding,
        raw: this.textSoFar, deliveredEventId: entry.id,
        complete: false, availableAt: entry.timestamp
      }).catch(() => null));
    }

    if (eventType === 'error') {
      this.closeSubscribers();
    }
  }

  pruneEvents() {
    if (this.events.length <= MAX_STORED_EVENTS) return;
    const meta = this.events.find((event) => event.event === 'meta') || null;
    const metaId = meta?.id;
    const keepCount = metaId ? Math.max(1, MAX_STORED_EVENTS - 1) : MAX_STORED_EVENTS;
    const nonMetaEvents = metaId
      ? this.events.filter((event) => event.id !== metaId)
      : this.events;
    const dropCount = nonMetaEvents.length - keepCount;
    if (dropCount > 0) {
      const lastDropped = nonMetaEvents[dropCount - 1];
      this.truncatedBeforeId = Math.max(this.truncatedBeforeId, lastDropped.id);
    }
    const tailEvents = nonMetaEvents.slice(-keepCount);
    this.events = metaId ? [meta, ...tailEvents] : tailEvents;
  }

  maybePersist(eventType) {
    const now = Date.now();
    if (eventType === 'done' || eventType === 'error' || eventType === 'meta') {
      this.persistEventCount = 0;
      this.lastPersistAt = now;
      this.persistState().catch(() => null);
      return;
    }

    this.persistEventCount += 1;
    if (this.persistEventCount >= PERSIST_BATCH_EVENTS || now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.persistEventCount = 0;
      this.lastPersistAt = now;
      this.persistState().catch(() => null);
    }
  }

  formatEvent(entry) {
    return formatSSEEvent(entry.event, { ...entry.data, eventId: entry.id });
  }

  broadcast(entry) {
    const payload = this.encoder.encode(this.formatEvent(entry));
    for (const subscriber of this.subscribers) {
      try {
        subscriber.controller.enqueue(payload);
      } catch {
        this.removeSubscriber(subscriber);
      }
    }
  }

  removeSubscriber(subscriber) {
    if (subscriber.heartbeat !== null) {
      clearInterval(subscriber.heartbeat);
      subscriber.heartbeat = null;
    }
    this.subscribers.delete(subscriber);
  }

  closeSubscribers() {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.controller.close();
      } catch {
        // Ignore close errors.
      }
      this.removeSubscriber(subscriber);
    }
    this.subscribers.clear();
  }

  serializeStorage(operation) {
    const result = this.storageTail.then(operation);
    this.storageTail = result.catch(() => {});
    return result;
  }

  snapshotState() {
    return structuredClone({
      job: this.job, runId: this.runId, acceptedAttemptId: this.acceptedAttemptId,
      readingResultId: this.readingResultId, visualBinding: this.visualBinding,
      visualJobToken: this.visualJobToken, visualInit: this.visualInit,
      events: this.events, nextEventId: this.nextEventId,
      textSoFar: this.textSoFar, truncatedBeforeId: this.truncatedBeforeId
    });
  }

  persistState() {
    return this.serializeStorage(async () => {
      // Build the snapshot when this ordered write runs, never before an await.
      if (!this.job.jobId) return;
      await this.state.storage.put('job', this.snapshotState());
      await this.setNextAlarm(this.state.storage);
    });
  }

  completeJob(data) {
    const runId = this.runId;
    const completion = this.serializeStorage(async () => {
      if (this.cancelled || !this.job.jobId || this.job.status !== 'running' || this.runId !== runId) return;
      const snapshot = this.snapshotState();
      const now = Date.now();
      const previousText = snapshot.textSoFar;
      snapshot.job.result = {
        reading: typeof data?.fullText === 'string' ? data.fullText : null,
        provider: data?.provider || null, requestId: data?.requestId || null,
        gateBlocked: Boolean(data?.gateBlocked), gateReason: data?.gateReason || null
      };
      snapshot.job.status = 'complete';
      snapshot.job.updatedAt = now;
      snapshot.job.expiresAt = now + (snapshot.job.retentionMs || JOB_TTL_MS);
      snapshot.textSoFar = snapshot.job.result.reading || '';
      if (snapshot.visualBinding && previousText && !snapshot.textSoFar.startsWith(previousText)) {
        snapshot.visualBinding.sourceRevision += 1;
      }
      const entry = { id: snapshot.nextEventId++, event: 'done', data, timestamp: now };
      if (snapshot.visualBinding) entry.data = { ...data, visualBinding: snapshot.visualBinding, readingResultId: snapshot.readingResultId };
      snapshot.events.push(entry);
      if (snapshot.events.length > MAX_STORED_EVENTS) {
        const meta = snapshot.events.find(event => event.event === 'meta');
        const tail = snapshot.events.filter(event => event !== meta);
        const removed = tail.splice(0, tail.length - MAX_STORED_EVENTS + (meta ? 1 : 0));
        snapshot.truncatedBeforeId = Math.max(snapshot.truncatedBeforeId, removed.at(-1)?.id || 0);
        snapshot.events = meta ? [meta, ...tail] : tail;
      }
      const usage = this.pendingMemoryUsage;
      snapshot.acceptedAttemptId = usage?.attemptId || null;
      const receipt = usage ? {
        ...usage, version: 1, jobId: snapshot.job.jobId, runId,
        receiptId: crypto.randomUUID(), attempts: 0, nextAttemptAt: 0
      } : null;
      const acceptedReceipt = receiptMatches(receipt, snapshot) ? receipt : null;
      const committed = await this.state.storage.transaction(async storage => {
        const stored = await storage.get('job');
        if (this.cancelled || this.runId !== runId || stored?.runId !== runId
          || stored?.job?.jobId !== snapshot.job.jobId || stored.job.status !== 'running') return false;
        await storage.put('job', snapshot);
        if (acceptedReceipt) await storage.put(MEMORY_RECEIPT_KEY, acceptedReceipt);
        else await storage.delete(MEMORY_RECEIPT_KEY);
        await storage.setAlarm(acceptedReceipt ? now : snapshot.job.expiresAt);
        return true;
      });
      if (!committed || this.runId !== runId || !this.job.jobId) return;
      this.job = snapshot.job;
      this.events = snapshot.events;
      this.nextEventId = snapshot.nextEventId;
      this.textSoFar = snapshot.textSoFar;
      this.truncatedBeforeId = snapshot.truncatedBeforeId;
      this.visualBinding = snapshot.visualBinding;
      this.acceptedAttemptId = snapshot.acceptedAttemptId;
      this.memoryReceipt = acceptedReceipt;
      this.pendingMemoryUsage = null;
      this.deletionScheduledAt = acceptedReceipt ? now : snapshot.job.expiresAt;
      this.broadcast(entry);
      this.closeSubscribers();
      if (snapshot.visualBinding) this.state.waitUntil(observeDeliveredReading({
        env: this.env, init: this.visualInit, binding: snapshot.visualBinding,
        raw: snapshot.textSoFar, deliveredEventId: entry.id, complete: true, availableAt: now
      }).catch(() => null));
    });
    // Persistence is optional only after the successful terminal commit.
    return completion.then(() => {
      if (this.memoryReceipt) this.state.waitUntil(this.drainMemoryReceipt());
    }).catch(() => {
      console.warn('[reading-job] terminal_persistence_failed');
      this.pendingMemoryUsage = null;
      this.appendEvent('error', { message: 'Unable to finish this reading.' });
    });
  }

  drainMemoryReceipt() {
    if (this.receiptDrain) return this.receiptDrain;
    const work = (async () => {
      const claimed = await this.serializeStorage(() => this.state.storage.transaction(async storage => {
        const stored = await storage.get('job');
        const receipt = await storage.get(MEMORY_RECEIPT_KEY);
        const now = Date.now();
        if (!receiptMatches(receipt, stored) || this.runId !== stored.runId
          || !this.job.jobId || now >= stored.job.expiresAt || receipt.attempts >= MAX_MEMORY_ROUNDS
          || (receipt.nextAttemptAt || 0) > now) {
          await this.setNextAlarm(storage);
          return null;
        }
        const attempts = receipt.attempts + 1;
        const next = { ...receipt, attempts, nextAttemptAt: attempts < MAX_MEMORY_ROUNDS ? now + MEMORY_RETRY_DELAYS_MS[attempts - 1] : null };
        await storage.put(MEMORY_RECEIPT_KEY, next);
        await this.setNextAlarm(storage, next, stored.job);
        return next;
      }));
      if (!claimed) return;
      if (claimed.runId !== this.runId || !this.job.jobId) return;
      this.memoryReceipt = claimed;
      const persisted = await persistReadingMemoryAccess(this.env.DB, claimed);
      if (!persisted) return;
      const acknowledged = await this.serializeStorage(() => this.state.storage.transaction(async storage => {
        const stored = await storage.get('job');
        const current = await storage.get(MEMORY_RECEIPT_KEY);
        if (!receiptMatches(current, stored) || this.runId !== stored.runId
          || current.receiptId !== claimed.receiptId || !this.job.jobId) return;
        await storage.delete(MEMORY_RECEIPT_KEY);
        await this.setNextAlarm(storage, null, stored.job);
        return true;
      }));
      if (acknowledged && this.memoryReceipt?.receiptId === claimed.receiptId) this.memoryReceipt = null;
    })().catch(() => { console.warn('[reading-job] memory_receipt_persistence_failed'); });
    this.receiptDrain = work;
    work.finally(() => { if (this.receiptDrain === work) this.receiptDrain = null; });
    return work;
  }

  /**
   * When this job's storage is deleted: at expiry once it finishes, or one
   * retention period after it started if it never does (a run cut off by an
   * eviction never reaches done or error).
   */
  deletionTime() {
    if (this.job.expiresAt) return this.job.expiresAt;
    const startedAt = this.job.startedAt || this.job.createdAt;
    return startedAt ? startedAt + (this.job.retentionMs || JOB_TTL_MS) : null;
  }

  /**
   * Nothing else reaches a job nobody asks about again, so without an alarm
   * its reading would stay stored indefinitely instead of for its retention.
   */
  scheduleDeletion() {
    return this.serializeStorage(() => this.setNextAlarm(this.state.storage));
  }

  async setNextAlarm(storage, receipt = this.memoryReceipt, job = this.job) {
    const startedAt = job.startedAt || job.createdAt;
    const expiry = job.expiresAt || (startedAt ? startedAt + (job.retentionMs || JOB_TTL_MS) : null);
    if (!job.jobId || !expiry) return;
    const retryAt = receipt && receipt.attempts < MAX_MEMORY_ROUNDS && receipt.nextAttemptAt !== null
      ? Math.max(Date.now(), receipt.nextAttemptAt) : Infinity;
    const at = Math.min(expiry, retryAt);
    await storage.setAlarm(at);
  }

  /**
   * For jobs stored before deletion alarms existed; reached only through the
   * maintenance route. Deletes the job if its time has passed, and otherwise
   * schedules its alarm. Never returns job contents.
   */
  async handleRetention() {
    const at = this.deletionTime();
    if (!this.job.jobId || !at || Date.now() >= at) {
      await this.purge();
      return jsonResponse({ status: 'purged' });
    }
    this.deletionScheduledAt = null;
    await this.scheduleDeletion();
    return jsonResponse({ status: 'scheduled' });
  }

  async alarm() {
    await this.initialized;
    this.deletionScheduledAt = null;
    const at = this.deletionTime();
    if (!at || Date.now() >= at) return this.purge();
    await this.drainMemoryReceipt();
    await this.scheduleDeletion();
  }

  /** Delete everything this job stored, and stop any run still going. */
  async purge() {
    // Forget the job before stopping its run or awaiting storage, so a run
    // that ends meanwhile finds nothing to persist or schedule.
    const run = this.abortController;
    this.cancelled = true;
    this.closeSubscribers();
    this.job = emptyJob();
    this.pendingMemoryUsage = null;
    this.memoryReceipt = null;
    this.runId = null;
    this.acceptedAttemptId = null;
    this.events = [];
    this.nextEventId = 1;
    this.textSoFar = '';
    this.truncatedBeforeId = 0;
    this.persistEventCount = 0;
    this.lastPersistAt = 0;
    this.deletionScheduledAt = null;
    run?.abort();
    // deleteAll() keeps the alarm before compatibility date 2026-02-24, and
    // deleting only the 'job' key would leave storage metadata behind.
    await this.serializeStorage(async () => {
      await this.state.storage.deleteAlarm();
      await this.state.storage.deleteAll();
    });
  }

  async expireIfNeeded() {
    if (!this.job.expiresAt) {
      return false;
    }
    if (Date.now() < this.job.expiresAt) {
      return false;
    }
    await this.purge();
    return true;
  }
}
