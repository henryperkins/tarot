import { onRequestPost as tarotReadingPost } from '../../functions/api/tarot-reading.js';
import { formatSSEEvent } from '../../functions/lib/readingStream.js';
import { jsonResponse } from '../../functions/lib/utils.js';

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive'
};

const JOB_TTL_MS = 60 * 60 * 1000;

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

export class ReadingJob {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.encoder = new TextEncoder();
    this.subscribers = new Set();
    this.events = [];
    this.nextEventId = 1;
    this.cancelled = false;
    this.job = {
      status: 'idle',
      jobId: null,
      token: null,
      createdAt: null,
      updatedAt: null,
      expiresAt: null,
      meta: null,
      result: null,
      error: null
    };
    this.abortController = null;
    this.runningPromise = null;
    this.initialized = this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('job');
      if (stored) {
        this.job = stored.job || this.job;
        this.events = Array.isArray(stored.events) ? stored.events : [];
        this.nextEventId = stored.nextEventId || (this.events.length + 1);
      }
    });
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

    if (!payload || !jobId) {
      return buildError(400, 'Missing reading payload.');
    }

    this.events = [];
    this.nextEventId = 1;

    this.job = {
      ...this.job,
      status: 'running',
      jobId,
      token,
      createdAt: this.job.createdAt || Date.now(),
      updatedAt: Date.now(),
      expiresAt: null,
      error: null,
      meta: null,
      result: null
    };
    this.cancelled = false;

    await this.persistState();

    if (!this.runningPromise) {
      const authHeader = request.headers.get('Authorization') || '';
      const cookieHeader = request.headers.get('Cookie') || '';
      this.runningPromise = this.runJob(payload, {
        authorization: authHeader,
        cookie: cookieHeader
      });
      this.state.waitUntil(this.runningPromise);
    }

    return jsonResponse({
      jobId,
      status: 'running'
    });
  }

  async handleStatus(request) {
    const token = getJobToken(request);
    if (!this.job.jobId) {
      return buildError(404, 'Reading job not found.');
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
    if (!this.job.jobId) {
      return buildError(404, 'Reading job not found.');
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
        subscriber = { controller };
        this.subscribers.add(subscriber);

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
          this.subscribers.delete(subscriber);
        }
      },
      cancel: () => {
        if (subscriber) {
          this.subscribers.delete(subscriber);
        }
      }
    });

    return new Response(stream, { headers: STREAM_HEADERS });
  }

  async handleCancel(request) {
    const token = getJobToken(request);
    if (!this.job.jobId) {
      return buildError(404, 'Reading job not found.');
    }
    if (!token || token !== this.job.token) {
      return buildError(403, 'Invalid job token.');
    }

    this.cancelled = true;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.appendEvent('error', { message: 'Reading cancelled.' });

    return jsonResponse({ status: 'cancelled' });
  }

  async runJob(payload, authHeaders) {
    this.abortController = new AbortController();

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      });
      if (authHeaders.authorization) {
        headers.set('Authorization', authHeaders.authorization);
      }
      if (authHeaders.cookie) {
        headers.set('Cookie', authHeaders.cookie);
      }

      const request = new Request('https://internal/api/tarot-reading?stream=true', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: this.abortController.signal
      });

      const response = await tarotReadingPost({
        request,
        env: this.env,
        waitUntil: this.state.waitUntil.bind(this.state)
      });

      await this.consumeResponse(response);
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (this.job.status !== 'error') {
          this.appendEvent('error', { message: 'Reading cancelled.' });
        }
        return;
      }
      this.appendEvent('error', { message: error?.message || 'Failed to generate reading.' });
    }
  }

  async consumeResponse(response) {
    if (this.cancelled) {
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
      const message = payload?.error || 'Failed to generate reading.';
      this.appendEvent('error', { message });
      return;
    }

    if (!isSSE) {
      const payload = await response.json();
      if (this.cancelled) {
        return;
      }
      if (payload?.reading) {
        this.appendEvent('meta', {
          requestId: payload.requestId || null,
          provider: payload.provider || null,
          themes: payload.themes || null,
          emotionalTone: payload.emotionalTone || null,
          ephemeris: payload.ephemeris || null,
          context: payload.context || null,
          contextDiagnostics: payload.contextDiagnostics || [],
          graphRAG: payload.graphRAG || null,
          spreadAnalysis: payload.spreadAnalysis || null,
          gateBlocked: payload.gateBlocked || false,
          gateReason: payload.gateReason || null,
          backendErrors: payload.backendErrors || null
        });
        this.appendEvent('done', {
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
      if (this.cancelled) {
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
      events.forEach((block) => this.processEventBlock(block));
    }

    if (buffer.trim()) {
      this.processEventBlock(buffer);
    }

    if (this.job.status === 'running' && !this.cancelled) {
      this.appendEvent('error', { message: 'Streaming ended unexpectedly.' });
    }
  }

  processEventBlock(block) {
    if (this.cancelled) return;
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

    try {
      const data = JSON.parse(eventData);
      if (eventType === 'meta') {
        this.job.meta = data;
      }
      if (eventType === 'done') {
        this.job.result = {
          reading: data.fullText || null,
          provider: data.provider || null,
          requestId: data.requestId || null,
          gateBlocked: data.gateBlocked || false,
          gateReason: data.gateReason || null
        };
      }
      this.appendEvent(eventType, data);
    } catch {
      // Ignore malformed events.
    }
  }

  appendEvent(eventType, data) {
    const entry = {
      id: this.nextEventId++,
      event: eventType,
      data,
      timestamp: Date.now()
    };

    this.events.push(entry);

    if (eventType === 'error') {
      this.job.status = 'error';
      this.job.error = data?.message || 'Streaming error.';
      this.job.expiresAt = Date.now() + JOB_TTL_MS;
    }

    if (eventType === 'done') {
      this.job.status = 'complete';
      this.job.expiresAt = Date.now() + JOB_TTL_MS;
    }

    this.job.updatedAt = Date.now();
    this.persistState().catch(() => null);
    this.broadcast(entry);

    if (eventType === 'done' || eventType === 'error') {
      this.closeSubscribers();
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
        this.subscribers.delete(subscriber);
      }
    }
  }

  closeSubscribers() {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.controller.close();
      } catch {
        // Ignore close errors.
      }
    }
    this.subscribers.clear();
  }

  async persistState() {
    await this.state.storage.put('job', {
      job: this.job,
      events: this.events,
      nextEventId: this.nextEventId
    });
  }

  async expireIfNeeded() {
    if (!this.job.expiresAt) {
      return false;
    }
    if (Date.now() < this.job.expiresAt) {
      return false;
    }
    await this.state.storage.delete('job');
    this.job = {
      status: 'idle',
      jobId: null,
      token: null,
      createdAt: null,
      updatedAt: null,
      expiresAt: null,
      meta: null,
      result: null,
      error: null
    };
    this.events = [];
    this.nextEventId = 1;
    return true;
  }
}
