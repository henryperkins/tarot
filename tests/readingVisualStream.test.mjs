import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readVisualJobEvents } from '../src/lib/readingVisualStream.js';

const event = (kind, data) => `event: ${kind}\ndata: ${JSON.stringify(data)}\n\n`;
const sse = value => new Response(value, { headers: { 'Content-Type': 'text/event-stream' } });
async function collect(responses, options = {}) {
  const calls = [];
  const values = [];
  for await (const value of readVisualJobEvents({ readingResultId: 'result', visualJobToken: 'private-token', retryDelay: 0,
    fetchImpl: async (url, init) => { calls.push({ url, headers: init.headers }); return responses.shift(); }, ...options })) values.push(value);
  return { calls, values };
}
test('clean EOF recovers full cumulative snapshot after narrative completion', async () => {
  const snapshot = { binding: { readingResultId: 'result' }, cueLedger: { ledgerRevision: 2 }, status: 'complete', eventId: 4 };
  const result = await collect([sse(event('cues', { eventId: 2, cueLedger: { ledgerRevision: 1 } })), Response.json(snapshot)]);
  assert.equal(result.calls.length, 2);
  assert.deepEqual(result.values.at(-1), { event: 'snapshot', data: snapshot });
  assert.equal(result.calls[0].url.includes('private-token'), false);
  assert.equal(result.calls[0].headers['X-Visual-Token'], 'private-token');
});
test('failed snapshots retry and cursor survives reconnect', async () => {
  const result = await collect([
    sse(event('cues', { eventId: 3 })), new Response('', { status: 503 }),
    Response.json({ status: 'running', eventId: 3 }), sse(event('done', { eventId: 4, status: 'complete' }))
  ]);
  assert.equal(result.calls.length, 4);
  assert.match(result.calls.at(-1).url, /cursor=3$/);
  assert.equal(result.values.at(-1).event, 'done');
});
test('failed initial HTTP and repeated EOF have a bounded retry budget', async () => {
  let calls = 0;
  await assert.rejects(collect([], { maxFailures: 3, fetchImpl: async () => { calls++; return new Response('', { status: 503 }); } }), /could not be restored/);
  assert.equal(calls, 3);
});
test('expired capability fails without repeated requests', async () => {
  let calls = 0;
  await assert.rejects(collect([], { fetchImpl: async () => { calls++; return new Response('', { status: 410 }); } }), /unavailable/);
  assert.equal(calls, 1);
});
test('abort closes an idle subscription and prevents old result callbacks', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const result = collect([], { signal: controller.signal, fetchImpl: async () => new Response(new ReadableStream({
    start() { setTimeout(() => controller.abort(), 0); }, cancel() { cancelled = true; }
  }), { headers: { 'Content-Type': 'text/event-stream' } }) });
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(cancelled, true);
});
