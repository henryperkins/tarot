import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { test } from 'node:test';
import { readReadingJobEvents } from '../src/lib/readingJobStream.js';

const options = { jobId: 'job-1', jobToken: 'secret' };
const event = (type, data) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
const sse = (text) => new Response(text, { headers: { 'content-type': 'text/event-stream' } });
const doneEvent = event('done', { eventId: 3, fullText: 'First second.' });
const collect = async (input = options) => {
  const result = [];
  for await (const entry of readReadingJobEvents(input)) result.push(entry);
  return result;
};

function fastRetries(t) {
  const delays = [];
  const original = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
    if (ms <= 16000) delays.push(ms);
    return original(callback, ms <= 16000 ? 0 : ms, ...args);
  });
  return delays;
}

test('reconnects after EOF using the cursor, ignoring duplicate events and comments', async (t) => {
  const delays = fastRetries(t);
  const urls = [];
  const responses = [
    sse(': connected\n\n' + event('delta', { eventId: 1, text: 'First ' })),
    sse(event('delta', { eventId: 1, text: 'First ' }) + event('delta', { eventId: 2, text: 'second.' }) + doneEvent)
  ];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    urls.push(url);
    assert.equal(init.headers['X-Job-Token'], 'secret');
    return responses.shift();
  });
  const events = await collect();
  assert.deepEqual(events.map((entry) => entry.event), ['delta', 'delta', 'done']);
  assert.equal(events.filter((entry) => entry.event === 'delta').map((entry) => entry.data.text).join(''), 'First second.');
  assert.deepEqual(urls, ['/api/tarot-reading/jobs/job-1/stream?cursor=0', '/api/tarot-reading/jobs/job-1/stream?cursor=1']);
  assert.deepEqual(delays, [1000]);
});

test('retries a network error and proxy 524 before completing', async (t) => {
  fastRetries(t);
  let attempts = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError('Failed to fetch');
    return attempts === 2 ? new Response('proxy error', { status: 524 }) : sse(doneEvent);
  });
  assert.equal((await collect()).at(-1).event, 'done');
  assert.equal(attempts, 3);
});

test('stops retrying persistent EOF with an actionable error', async (t) => {
  const delays = fastRetries(t);
  t.mock.method(globalThis, 'fetch', async () => sse(': connected\n\n'));
  await assert.rejects(collect(), /connection.*try again/i);
  assert.equal(globalThis.fetch.mock.callCount(), 6);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000]);
});

for (const status of [401, 403, 404, 410, 429]) {
  test(`does not retry terminal HTTP ${status}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Please try again.' }, { status }));
    await assert.rejects(collect(), /Please try again/);
    assert.equal(globalThis.fetch.mock.callCount(), 1);
  });
}

test('terminal SSE errors are delivered once and not retried', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => sse(event('error', { eventId: 1, message: 'Reading failed.' })));
  assert.equal((await collect())[0].event, 'error');
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('abort during reconnect backoff prevents another request', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async () => sse(''));
  const result = collect({ ...options, signal: controller.signal, onReconnect: () => controller.abort() });
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('a silent connection times out and reconnects; abort cancels the active reader', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    cancel() { cancelled += 1; }
  }), { headers: { 'content-type': 'text/event-stream' } }));
  const controller = new AbortController();
  const result = collect({ ...options, signal: controller.signal });
  const rejected = assert.rejects(result, { name: 'AbortError' });
  await nextTurn();
  t.mock.timers.tick(45000);
  await nextTurn();
  t.mock.timers.tick(1000);
  await nextTurn();
  // Abort even on assertion failure so no read is left pending.
  controller.abort();
  assert.equal(globalThis.fetch.mock.callCount(), 2);
  await rejected;
  assert.equal(cancelled, 2);
});
