/** Owned loopback transport for controlled prose and real independent cue SSE. */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { ReadingJob } from '../../../src/worker/readingJob.js';
import { formatSSEEvent } from '../../../functions/lib/readingStream.js';
import { createVisualCueSession, createCueMemoryState, buildCueDeliverySchedule, cueValidationContext } from './visualCueEvaluationHarness.mjs';
import { cueDigest } from './visualCueEvaluationBudget.mjs';

function waitUntil(atMs, signal) {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, Math.max(0, atMs - Date.now()));
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

export async function createReadingCueRelay({ caseData, candidate, aiAdapter, live = false, budget, db,
  runId = `relay:${randomUUID()}`, trialId = 'timing', schedule = 'paced', sourceMode = 'sse',
  frontendOrigin = null, offlineImmediate = false, initialAdmission } = {}) {
  if (!['sse', 'json'].includes(sourceMode) || (live && offlineImmediate)) throw new Error('Invalid controlled relay source configuration.');
  if (frontendOrigin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(frontendOrigin)) throw new Error('Relay frontend must be exact loopback origin.');
  const session = await createVisualCueSession({ caseData, candidate, aiAdapter, live, budget, db, runId, trialId, initialAdmission });
  const state = createCueMemoryState();
  const scheduleController = new AbortController();
  const frozenEvents = buildCueDeliverySchedule(caseData.raw, schedule);
  const scheduleEvents = [];
  const startData = { jobId: `job:${cueDigest({ runId, caseId: caseData.id, trialId, candidate }).slice(0, 40)}`,
    jobToken: `local:${randomUUID()}`, readingResultId: session.binding.readingResultId,
    visualBinding: session.binding, visualJobToken: session.token };
  let releaseSchedule;
  const scheduleGate = new Promise(resolve => { releaseSchedule = resolve; });
  let complete;
  const completion = new Promise(resolve => { complete = resolve; });
  let started = false;
  let readingStarted = false;
  let closed = false;
    let finishing = null;
  const env = { ...session.env, READING_VISUAL_JOBS: { idFromName: name => name, get: id => ({
    fetch: (url, options) => {
      if (id !== session.binding.readingResultId) throw new Error('Unregistered relay visual source.');
      const request = url instanceof Request ? url : new Request(url, options);
      if (new URL(request.url).pathname === '/observe') {
        return request.clone().json().then(body => session.observe(body.raw, { complete: body.complete,
          deliveredEventId: body.deliveredEventId, availableAt: body.availableAt, sourceBinding: body.binding })).then(result =>
          new Response(JSON.stringify({ ok: true, status: result.outcome }), { status: 202 }));
      }
      return session.job.fetch(request);
    }
  }) } };
  const reading = new ReadingJob(state, env, { runReading: async ({ request }) => {
    if (sourceMode === 'json') {
      await scheduleGate;
      if (scheduleController.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      scheduleEvents.push({ type: 'json-completion', rawLength: caseData.raw.length, rawSha256: cueDigest(caseData.raw), dispatchedAtMs: Date.now() });
      return new Response(JSON.stringify({ reading: caseData.raw, provider: 'controlled-fixture-prose', requestId: startData.readingResultId }),
        { headers: { 'Content-Type': 'application/json' } });
    }
    const stream = new ReadableStream({ start(controller) {
      (async () => {
        let sourceEventId = 0;
        const encoder = new TextEncoder();
        const emit = (type, data) => controller.enqueue(encoder.encode(formatSSEEvent(type, { ...data, eventId: ++sourceEventId })));
        try {
          emit('meta', { provider: 'controlled-fixture-prose', requestId: startData.readingResultId });
          await scheduleGate;
          const startMs = Date.now();
          for (const event of frozenEvents) {
            if (!offlineImmediate && schedule === 'paced') await waitUntil(startMs + event.atMs, scheduleController.signal);
            if (scheduleController.signal.aborted || request.signal.aborted) break;
            const text = event.text ?? event.fullText;
            scheduleEvents.push({ type: event.type, end: event.end, scheduledAtMs: startMs + event.atMs,
              dispatchedAtMs: Date.now(), textSha256: cueDigest(text) });
            emit(event.type, event.type === 'delta' ? { text: event.text } : { fullText: event.fullText,
              provider: 'controlled-fixture-prose', requestId: startData.readingResultId });
          }
          controller.close();
        } catch { try { controller.close(); } catch { /* Cancelled reader. */ } }
      })();
    }, cancel() { scheduleController.abort(); } });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  await reading.initialized;
  async function finish() {
    finishing ??= (async () => {
      await state.drain();
      const report = await session.finish();
      const result = { ...report, sourceMode, scenario: schedule, narrativeStatus: reading.job.status,
        narrativeRawSha256: cueDigest(reading.textSoFar), narrativeRawLength: reading.textSoFar.length,
        narrativeSourceMatchesCase: reading.textSoFar === caseData.raw, scheduleEvents: structuredClone(scheduleEvents),
        serverEvents: reading.events.map(event => ({ id: event.id, type: event.event, atMs: event.timestamp,
          rawLength: typeof event.data?.text === 'string' ? event.data.text.length : event.data?.fullText?.length ?? null,
          sourceRevision: event.data?.visualBinding?.sourceRevision ?? 0 })),
        controlledProse: true, browserAccompaniment: 'unmeasured', clockDomain: 'server Date.now' };
      complete(result);
      return result;
    })();
    return finishing;
  }
  async function ensureReadingStarted() {
    if (readingStarted) return;
    readingStarted = true;
    await reading.fetch(new Request('https://cue-local/start', { method: 'POST', headers: { 'X-Job-Token': startData.jobToken },
      body: JSON.stringify({ jobId: startData.jobId, readingResultId: startData.readingResultId, visualBinding: session.binding,
        visualJobToken: session.token, payload: { cards: cueValidationContext(caseData).cards, question: caseData.question,
          reflectionsText: caseData.reflections || '', deckStyle: caseData.deckStyle } }) }));
  }
  async function cancel() {
    scheduleController.abort();
    releaseSchedule();
    if (readingStarted && reading.job.status === 'running') await reading.fetch(new Request('https://cue-local/cancel', {
      method: 'POST', headers: { 'X-Job-Token': startData.jobToken }
    }));
    if (!['complete', 'failed', 'cancelled'].includes(session.job.status)) await session.cancel();
    await finish();
  }
  const server = createServer(async (request, response) => {
    let reader;
    try {
      if (request.headers.host !== new URL(origin).host) { response.writeHead(403).end(); return; }
      const requestOrigin = request.headers.origin;
      if (requestOrigin && requestOrigin !== frontendOrigin && requestOrigin !== origin) { response.writeHead(403).end(); return; }
      if (requestOrigin) {
        response.setHeader('Access-Control-Allow-Origin', requestOrigin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Job-Token,X-Visual-Token,sentry-trace,baggage');
        response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      }
      if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
      const url = new URL(request.url, origin);
      let result;
      if (url.pathname === '/api/tarot-reading/jobs' && request.method === 'POST') {
        // Drain/discard caller body. The frozen selected case owns this relay.
        let received = 0;
        for await (const bytes of request) { received += bytes.length; if (received > 120000) throw new Error('Oversized relay start.'); }
        await ensureReadingStarted();
        result = new Response(JSON.stringify(startData), { headers: { 'Content-Type': 'application/json' } });
      } else {
        const narrativeBase = `/api/tarot-reading/jobs/${startData.jobId}`;
        const visualBase = `/api/tarot-reading/visuals/${startData.readingResultId}`;
        const narrativeBases = [narrativeBase, `/api/tarot-reading/jobs/${encodeURIComponent(startData.jobId)}`];
        const visualBases = [visualBase, `/api/tarot-reading/visuals/${encodeURIComponent(startData.readingResultId)}`];
        // Match exact owned raw/canonical-encoded IDs without broad decoding:
        // encoded slashes, double encoding and foreign IDs remain out of scope.
        const matchedNarrative = narrativeBases.find(base => url.pathname === base || url.pathname.startsWith(`${base}/`));
        const matchedVisual = visualBases.find(base => url.pathname === base || url.pathname.startsWith(`${base}/`));
        const isNarrative = Boolean(matchedNarrative);
        const suffix = matchedNarrative ? url.pathname.slice(matchedNarrative.length) : matchedVisual ? url.pathname.slice(matchedVisual.length) : null;
        if (suffix === null || !['', '/stream', '/status', '/cancel'].includes(suffix)) { response.writeHead(404).end(); return; }
        if ((suffix === '/cancel') !== (request.method === 'POST') || (!['GET', 'POST'].includes(request.method))) { response.writeHead(405).end(); return; }
        const headers = new Headers();
        if (request.headers['x-job-token']) headers.set('X-Job-Token', request.headers['x-job-token']);
        if (request.headers['x-visual-token']) headers.set('X-Visual-Token', request.headers['x-visual-token']);
        if (isNarrative && !readingStarted) await ensureReadingStarted();
        result = await (isNarrative ? reading : session.job).fetch(new Request(`https://cue-local${suffix || (isNarrative ? '/status' : '/snapshot')}${url.search}`, { method: request.method, headers }));
        if (suffix === '/cancel' && result.ok) await cancel();
      }
      response.writeHead(result.status, Object.fromEntries(result.headers));
      if (!result.body) { response.end(); return; }
      reader = result.body.getReader();
      response.on('close', () => { reader.cancel().catch(() => {}); });
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done || response.destroyed) break;
        response.write(Buffer.from(chunk.value));
      }
      response.end();
    } catch {
      reader?.cancel().catch(() => {});
      if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' });
      if (!response.destroyed) response.end('{"error":"Controlled relay unavailable."}');
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, selectedCaseId: caseData.id, runId, startData, completion, session, readingJob: reading,
    // Contains recorded fixture prose only. Never use this relay for private fresh readings.
    frozenSchedule: structuredClone(frozenEvents),
    startSchedule() {
      if (closed || started) return;
      started = true;
      ensureReadingStarted().then(() => { releaseSchedule(); return finish(); }).catch(async () => { await cancel(); });
    },
    async close() {
      if (closed) return;
      closed = true;
      if (!finishing || !['complete', 'failed', 'cancelled'].includes(session.job.status)) await cancel();
      else await finishing;
      reading.closeSubscribers(); session.job.closeSubscribers();
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    }
  };
}
