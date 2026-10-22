import { ReadingJob, JOB_TTL_MS, MCP_JOB_TTL_MS } from '../../src/worker/readingJob.js';
import { formatSSEEvent } from '../../functions/lib/readingStream.js';
import { jsonResponse } from '../../functions/lib/utils.js';
import { ReadingJobsStore } from './store.js';

export { ensureReadingJobsSchema, READING_JOBS_SCHEMA } from './store.js';

const NOT_FOUND = 'Reading job not found.';
const MAX_STORED_EVENTS = 300;
const HEARTBEAT_MS = 15000;
const DEFAULT_POLL_MS = 1000;
const DEFAULT_LEASE_MS = 30000;
const MAX_CAS_ATTEMPTS = 8;

function errorResponse(status, error) {
  return jsonResponse({ error }, { status });
}

function deletionTime(state) {
  const job = state.job;
  return job.expiresAt || (job.startedAt || job.createdAt) + job.retentionMs;
}

function pruneEvents(state) {
  if (state.events.length <= MAX_STORED_EVENTS) return;
  const metadata = state.events.find((event) => event.event === 'meta');
  const otherEvents = metadata ? state.events.filter((event) => event.id !== metadata.id) : state.events;
  const kept = metadata ? MAX_STORED_EVENTS - 1 : MAX_STORED_EVENTS;
  const dropped = otherEvents.length - kept;
  if (dropped > 0) {
    state.truncatedBeforeId = Math.max(state.truncatedBeforeId, otherEvents[dropped - 1].id);
  }
  state.events = metadata ? [metadata, ...otherEvents.slice(-kept)] : otherEvents.slice(-kept);
}

function finishState(row, message, now) {
  const state = structuredClone(row.state);
  state.events.push({ id: state.nextEventId++, event: 'error', data: { message }, timestamp: now });
  pruneEvents(state);
  Object.assign(state.job, {
    status: 'error', error: message, errorCode: null, updatedAt: now, expiresAt: now + state.job.retentionMs
  });
  return state;
}

/**
 * Keep the existing provider parser/metadata behavior, with SQL writes fenced by
 * a runner lease and revision. Local memory serves only the active computation;
 * all readers and cancellations use the database, including in other isolates.
 */
class PersistentRunner extends ReadingJob {
  constructor(namespace, row, owner) {
    const state = {
      blockConcurrencyWhile: (callback) => callback(),
      storage: { get: async () => structuredClone(row.state) },
      waitUntil: namespace.ctx.waitUntil.bind(namespace.ctx)
    };
    super(state, namespace.env, { runReading: namespace.options.runReading });
    this.namespace = namespace;
    this.id = row.id;
    this.owner = owner;
    this.revision = row.revision;
    this.persistQueue = Promise.resolve();
    this.monitor = null;
    this.monitorBusy = false;
    this.stopped = false;
    this.responseReader = null;
  }

  snapshot() {
    return structuredClone({
      job: this.job, events: this.events, nextEventId: this.nextEventId,
      textSoFar: this.textSoFar, truncatedBeforeId: this.truncatedBeforeId,
      readingResultId: this.readingResultId, visualBinding: this.visualBinding,
      visualJobToken: this.visualJobToken, visualInit: this.visualInit
    });
  }

  appendEvent(event, data) {
    if (this.stopped || this.job.status !== 'running') return;
    super.appendEvent(event, data);
  }

  persistState() {
    if (this.stopped) return this.persistQueue;
    const snapshot = this.snapshot();
    this.persistQueue = this.persistQueue.then(async () => {
      if (this.stopped) return;
      const now = this.namespace.options.now();
      const saved = await this.namespace.store.saveOwned(this.id, this.revision, this.owner,
        snapshot, now + this.namespace.options.leaseMs, deletionTime(snapshot), now);
      if (!saved) {
        this.stop();
        return;
      }
      this.revision += 1;
    }).catch(() => {
      // A failed write leaves the lease to expire. Never emit a successful
      // result from memory or let a stale runner recreate a cancelled job.
      this.stop();
    });
    return this.persistQueue;
  }

  stop() {
    this.stopped = true;
    this.cancelled = true;
    this.abortController?.abort();
    this.responseReader?.cancel().catch(() => {});
  }

  async consumeResponse(response) {
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      return super.consumeResponse(response);
    }
    // Cancelling a job must wake a blocked reader even if a provider ignores
    // AbortSignal. Do not retain an open upstream response after cancellation.
    const reader = response.body.getReader();
    this.responseReader = reader;
    const proxy = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel: () => reader.cancel()
    });
    try {
      return await super.consumeResponse(new Response(proxy, {
        status: response.status, statusText: response.statusText, headers: response.headers
      }));
    } finally {
      this.responseReader = null;
      reader.releaseLock();
    }
  }

  async run(payload, credentials, principal) {
    await this.initialized;
    // An isolate can be delayed between unique-key admission and execution.
    // Cancellation/deletion that already committed must prevent provider work,
    // not merely fence the eventual result after quota was reserved again.
    const started = this.namespace.options.now();
    if (this.job.status !== 'running' || !await this.namespace.store.renew(this.id, this.owner,
      started + this.namespace.options.leaseMs, started)) {
      this.stop();
      return;
    }
    this.monitor = setInterval(async () => {
      if (this.monitorBusy || this.stopped) return;
      this.monitorBusy = true;
      try {
        const now = this.namespace.options.now();
        if (!await this.namespace.store.renew(this.id, this.owner,
          now + this.namespace.options.leaseMs, now)) this.stop();
      } catch {
        this.stop();
      } finally {
        this.monitorBusy = false;
      }
    }, this.namespace.options.pollIntervalMs);
    try {
      await super.runJob(payload, credentials, principal);
      await this.persistQueue;
    } finally {
      clearInterval(this.monitor);
    }
  }
}

class ReadingJobsNamespace {
  constructor(env, ctx, options) {
    this.env = env;
    this.ctx = ctx;
    this.options = {
      now: Date.now, pollIntervalMs: DEFAULT_POLL_MS, leaseMs: DEFAULT_LEASE_MS, ...options
    };
    if (this.options.leaseMs <= this.options.pollIntervalMs * 2 || this.options.pollIntervalMs < 1) {
      throw new Error('Reading-job lease must exceed two polling intervals.');
    }
    this.store = options?.store || new ReadingJobsStore(env.TABLEU_NATIVE_DB || env.DB,
      { initialize: options?.initialize !== false });
  }

  idFromName(name) {
    if (typeof name !== 'string' || !name || name.length > 128) throw new Error('Invalid reading-job id.');
    return name;
  }

  idFromString(id) {
    return this.idFromName(id);
  }

  get(id) {
    const jobId = this.idFromName(id);
    return {
      fetch: (input, init) => this.fetch(jobId, input instanceof Request ? input : new Request(input, init))
    };
  }

  cleanupExpired() {
    return this.store.cleanupExpired(this.options.now());
  }

  async current(id) {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const row = await this.store.read(id);
      if (!row) return null;
      const now = this.options.now();
      if (now >= row.deleteAt) return row;
      if (row.status !== 'running' || row.leaseExpiresAt > now) return row;
      const state = finishState(row, 'Reading interrupted. Please start a new reading.', now);
      if (await this.store.finish(id, row.revision, state, deletionTime(state), now, { interrupted: true })) {
        return this.store.read(id);
      }
    }
    throw new Error('Reading-job state changed too often.');
  }

  async fetch(id, request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/start') return await this.start(id, request);
      if (!['/status', '/stream', '/cancel', '/mcp/snapshot', '/mcp/cancel', '/retention'].includes(url.pathname)) {
        return errorResponse(404, 'Not found');
      }
      const row = await this.store.read(id);
      if (url.pathname === '/retention') {
        if (!row || this.options.now() >= row.deleteAt) {
          if (row) await this.store.delete(id, row.revision);
          return jsonResponse({ status: 'purged' });
        }
        return jsonResponse({ status: 'scheduled' });
      }
      const denied = this.authorize(row, request, url.pathname);
      if (denied) return denied;
      if (this.options.now() >= row.deleteAt) {
        await this.store.delete(id, row.revision);
        return errorResponse(410, 'Reading job expired.');
      }
      const current = await this.current(id);
      if (!current) return errorResponse(404, NOT_FOUND);
      if (url.pathname === '/cancel' || url.pathname === '/mcp/cancel') return await this.cancel(id, request, url.pathname);
      if (url.pathname === '/stream') return this.stream(id, request, url, current);
      const job = current.state.job;
      if (url.pathname === '/mcp/snapshot') {
        return jsonResponse({
          jobId: job.jobId, status: job.status, snapshot: job.snapshot ?? null,
          result: job.result, error: job.error, errorCode: job.errorCode ?? null, meta: { themes: job.meta?.themes ?? null }
        });
      }
      return jsonResponse({ jobId: job.jobId, status: job.status, meta: job.meta, result: job.result, error: job.error });
    } catch {
      return errorResponse(503, 'Reading jobs temporarily unavailable.');
    }
  }

  authorize(row, request, path) {
    const job = row?.state.job;
    const mcp = path.startsWith('/mcp/');
    if (!job?.jobId || Boolean(job.principalUserId) !== mcp) return errorResponse(404, NOT_FOUND);
    if (mcp) {
      return request.headers.get('X-Principal-User-Id') === job.principalUserId ? null : errorResponse(404, NOT_FOUND);
    }
    return request.headers.get('X-Job-Token') === job.token ? null : errorResponse(403, 'Invalid job token.');
  }

  async start(id, request) {
    if (request.method !== 'POST') return errorResponse(405, 'Method not allowed.');
    const token = request.headers.get('X-Job-Token');
    if (!token) return errorResponse(401, 'Missing job token.');
    if (typeof this.ctx?.waitUntil !== 'function') {
      return errorResponse(503, 'Reading jobs require background execution support.');
    }
    let body;
    try { body = await request.json(); } catch { return errorResponse(400, 'Invalid JSON payload.'); }
    if (!body?.payload || body.jobId !== id) return errorResponse(400, 'Missing reading payload.');
    const principalUserId = typeof body.principal?.userId === 'string' && body.principal.userId
      ? body.principal.userId : null;
    const now = this.options.now();
    const state = {
      job: {
        status: 'running', jobId: id, token, createdAt: now, updatedAt: now,
        expiresAt: null, meta: null, result: null, error: null, errorCode: null, startedAt: now,
        principalUserId, snapshot: principalUserId ? (body.snapshot ?? null) : null,
        retentionMs: principalUserId ? MCP_JOB_TTL_MS : JOB_TTL_MS
      },
      events: [], nextEventId: 1, textSoFar: '', truncatedBeforeId: 0,
      readingResultId: body.readingResultId || body.visualBinding?.readingResultId || null,
      visualBinding: body.visualBinding || null, visualJobToken: body.visualJobToken || null,
      visualInit: body.visualInit || null
    };
    const owner = crypto.randomUUID();
    const admitted = await this.store.insert(id, state, owner, now + this.options.leaseMs, deletionTime(state), now);
    const row = await this.store.read(id);
    if (!row) return errorResponse(503, 'Reading jobs temporarily unavailable.');
    if (row.state.job.token !== token) return errorResponse(403, 'Invalid job token.');
    if (!admitted) return jsonResponse({ jobId: id, status: row.status });
    const runner = new PersistentRunner(this, row, owner);
    this.ctx.waitUntil(runner.run(body.payload, {
      authorization: request.headers.get('Authorization') || '', cookie: request.headers.get('Cookie') || ''
    }, principalUserId ? { userId: principalUserId } : null));
    return jsonResponse({ jobId: id, status: 'running' });
  }

  async cancel(id, request, path) {
    if (request.method !== 'POST') return errorResponse(405, 'Method not allowed.');
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const row = await this.store.read(id);
      const denied = this.authorize(row, request, path);
      if (denied) return denied;
      if (row.status !== 'running') return jsonResponse({ status: row.status });
      const now = this.options.now();
      const state = finishState(row, 'Reading cancelled.', now);
      if (await this.store.finish(id, row.revision, state, deletionTime(state), now)) {
        return jsonResponse({ status: 'cancelled' });
      }
    }
    return errorResponse(503, 'Reading jobs temporarily unavailable.');
  }

  stream(id, request, url, initial) {
    const parsed = Number.parseInt(url.searchParams.get('cursor') || '0', 10);
    let cursor = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const encoder = new TextEncoder();
    let cancelled = false;
    let timeout = null;
    let wake = null;
    let controller;
    const enqueue = (event, data) => controller.enqueue(encoder.encode(formatSSEEvent(event, data)));
    const wait = () => new Promise((resolve) => {
      wake = resolve;
      timeout = setTimeout(resolve, this.options.pollIntervalMs);
    });
    const send = (row, replayMetadata) => {
      const state = row.state;
      if (state.truncatedBeforeId > 0 && cursor <= state.truncatedBeforeId && state.textSoFar) {
        enqueue('snapshot', { fullText: state.textSoFar, eventId: state.truncatedBeforeId, truncated: true,
          ...(state.visualBinding ? { visualBinding: state.visualBinding, readingResultId: state.readingResultId } : {}) });
      }
      const metadata = state.events.findLast((event) => event.event === 'meta');
      if (replayMetadata && metadata && metadata.id <= cursor) {
        enqueue(metadata.event, { ...metadata.data, eventId: metadata.id });
      }
      const backlog = state.events.filter((event) => event.id > cursor);
      for (const event of backlog) {
        enqueue(event.event, { ...event.data, eventId: event.id });
        cursor = Math.max(cursor, event.id);
      }
      if (!backlog.length && row.status !== 'running') {
        const terminal = state.events[state.events.length - 1];
        if (terminal && (terminal.event === 'done' || terminal.event === 'error')) {
          enqueue(terminal.event, { ...terminal.data, eventId: terminal.id });
        }
      }
      return row.status !== 'running';
    };
    const stream = new ReadableStream({
      start: (streamController) => {
        controller = streamController;
        controller.enqueue(encoder.encode(': connected\n\n'));
        const pump = async () => {
          let lastHeartbeat = this.options.now();
          try {
            if (send(initial, true)) { controller.close(); return; }
            let revision = initial.revision;
            while (!cancelled) {
              await wait();
              timeout = null;
              wake = null;
              if (cancelled) return;
              const row = await this.current(id);
              if (!row || this.options.now() >= row.deleteAt || this.authorize(row, request, '/stream')) {
                enqueue('error', { message: 'Reading job unavailable.' });
                controller.close();
                return;
              }
              // Polling pauses for a slow consumer. Durable replay retains the
              // text snapshot if the bounded event history advances past it.
              if (controller.desiredSize > 0 && row.revision !== revision) {
                revision = row.revision;
                if (send(row, false)) { controller.close(); return; }
              }
              const now = this.options.now();
              if (controller.desiredSize > 0 && now - lastHeartbeat >= HEARTBEAT_MS) {
                controller.enqueue(encoder.encode(': heartbeat\n\n'));
                lastHeartbeat = now;
              }
            }
          } catch {
            if (!cancelled) {
              enqueue('error', { message: 'Reading jobs temporarily unavailable.' });
              controller.close();
            }
          }
        };
        // This work lasts for the response stream, rather than relying on a
        // detached callback after the response has completed.
        pump();
      },
      cancel: () => {
        cancelled = true;
        if (timeout !== null) clearTimeout(timeout);
        wake?.();
      }
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' }
    });
  }
}

export function createReadingJobsNamespace(env, ctx, options = {}) {
  return new ReadingJobsNamespace(env, ctx, options);
}
