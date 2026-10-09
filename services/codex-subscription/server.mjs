import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { CODEX_SUBSCRIPTION_MAX_BODY_BYTES, CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES, validateCodexRequest, validateCodexResult } from '../../shared/inference/codexSubscription.js';
import { runCodexSubscription } from './runner.mjs';

function authorized(header, token) {
  const received = Buffer.from(header || '');
  const expected = Buffer.from(`Bearer ${token}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function reply(response, status, body) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

export function createCodexSubscriptionServer({ token, run = runCodexSubscription, concurrency = 1, maxQueue = 8, timeoutMs = 300000, queueTimeoutMs = 60000, maxBodyBytes = CODEX_SUBSCRIPTION_MAX_BODY_BYTES } = {}) {
  if (typeof token !== 'string' || token.length < 32 || /\s/.test(token)) throw new Error('Set a random CODEX_SUBSCRIPTION_GATEWAY_TOKEN of at least 32 characters.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4 || !Number.isInteger(maxQueue) || maxQueue < 0 || maxQueue > 100) throw new Error('Invalid Codex concurrency or queue limit.');
  let active = 0;
  const queue = [];
  const requests = new Map();
  let shuttingDown = false;
  let shutdownPromise;
  const take = signal => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('cancelled')); return; }
    if (active < concurrency) { active++; resolve(); return; }
    if (queue.length >= maxQueue) { reject(Object.assign(new Error('busy'), { status: 429 })); return; }
    const item = { resolve: () => { cleanup(); active++; resolve(); } };
    const remove = () => { const index = queue.indexOf(item); if (index >= 0) queue.splice(index, 1); };
    const abort = () => { remove(); cleanup(); reject(new Error('cancelled')); };
    const timer = setTimeout(() => { remove(); cleanup(); reject(Object.assign(new Error('busy'), { status: 429 })); }, queueTimeoutMs);
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    signal.addEventListener('abort', abort, { once: true });
    queue.push(item);
  });
  const release = () => { active--; queue.shift()?.resolve(); };

  const server = http.createServer(async (request, response) => {
    if (shuttingDown) { reply(response, 503, { error: 'Codex service is stopping.' }); return; }
    if (!authorized(request.headers.authorization, token)) { reply(response, 401, { error: 'Unauthorized' }); return; }
    if (request.method === 'GET' && request.url === '/healthz') { reply(response, 200, { status: 'ok', provider: 'codex-subscription', active, queued: queue.length }); return; }
    if (request.method !== 'POST' || request.url !== '/v1/generate') { reply(response, 404, { error: 'Not found' }); return; }
    const controller = new AbortController();
    let finish;
    requests.set(controller, new Promise(resolve => { finish = resolve; }));
    const onClose = () => { if (!response.writableEnded) controller.abort(); };
    const onAbort = () => { if (!request.complete) request.destroy(); };
    response.on('close', onClose);
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let admitted = false;
    let streaming = false;
    let streamedText = '';
    const event = (name, data) => {
      if (response.destroyed || response.writableEnded) throw new Error('cancelled');
      response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > maxBodyBytes) { reply(response, 413, { error: 'Request too large' }); return; }
        chunks.push(chunk);
      }
      let input;
      try { input = validateCodexRequest(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reply(response, 400, { error: 'Invalid inference request' }); return; }
      const wantsStream = String(request.headers.accept || '').split(',').some(value => value.trim().split(';')[0] === 'text/event-stream');
      if (wantsStream && input.responseSchema) { reply(response, 400, { error: 'Structured output is not streamed.' }); return; }
      await take(controller.signal);
      admitted = true;
      if (wantsStream) {
        streaming = true;
        response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
        event('meta', { provider: 'codex-subscription' });
      }
      const onDelta = streaming ? text => {
        if (controller.signal.aborted || typeof text !== 'string') throw new Error('cancelled');
        streamedText += text;
        if (Buffer.byteLength(streamedText) > CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES) throw new Error('Output too large');
        if (text) event('delta', { text });
      } : undefined;
      const result = await run(input, { signal: controller.signal, ...(onDelta ? { onDelta } : {}) });
      if (controller.signal.aborted) throw new Error('cancelled');
      if (streaming) {
        validateCodexResult(result);
        if (result.text !== streamedText) throw new Error('Inconsistent stream');
        event('done', result);
        response.end();
      } else reply(response, 200, result);
    } catch (error) {
      const status = error.status === 429 ? 429 : controller.signal.aborted ? 504 : 503;
      const body = { error: status === 429 ? 'Codex service is busy. Try again shortly.' : 'Codex inference is unavailable. Check the service login and subscription limits.' };
      if (streaming) {
        if (!response.destroyed && !response.writableEnded) { event('error', body); response.end(); }
      } else reply(response, status, body);
    } finally {
      clearTimeout(timer);
      response.removeListener('close', onClose);
      controller.signal.removeEventListener('abort', onAbort);
      if (admitted) release();
      requests.delete(controller);
      finish();
    }
  });
  // Stop accepting work, abort both queued and active requests, then wait for
  // the runner's bounded SIGTERM/SIGKILL cleanup and temporary-file removal.
  server.shutdown = () => {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    const closed = new Promise(resolve => server.close(resolve));
    const drained = Promise.all([...requests.values()]);
    for (const controller of requests.keys()) controller.abort();
    server.closeAllConnections();
    shutdownPromise = Promise.all([closed, drained]).then(() => {});
    return shutdownPromise;
  };
  server.requestTimeout = Math.min(timeoutMs, 30000);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createCodexSubscriptionServer({
    token: process.env.CODEX_SUBSCRIPTION_GATEWAY_TOKEN,
    concurrency: Number(process.env.CODEX_SUBSCRIPTION_CONCURRENCY || 1),
    maxQueue: Number(process.env.CODEX_SUBSCRIPTION_MAX_QUEUE || 8),
    timeoutMs: Number(process.env.CODEX_SUBSCRIPTION_TIMEOUT_MS || 300000)
  });
  const host = process.env.CODEX_SUBSCRIPTION_BIND_HOST || '127.0.0.1';
  const port = Number(process.env.CODEX_SUBSCRIPTION_PORT || 8789);
  const shutdown = () => { server.shutdown().catch(() => { process.exitCode = 1; }); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  server.listen(port, host, () => console.log(`Tableu personal Codex service listening on ${host}:${server.address().port}`));
}
