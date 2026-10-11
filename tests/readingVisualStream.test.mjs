import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readVisualJobEvents, postSavedVisualRetry } from '../src/lib/readingVisualStream.js';

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

// Task 11: saved replay transport is addressed by the fresh server-issued
// visualJobId. Snapshot/stream/reconnect are GET-only and never re-submit work.
test('replay subscription uses the visualJobId transport, keeps the capability out of URLs and never posts', async () => {
  const calls = [];
  const responses = [sse(event('snapshot', { eventId: 1, status: 'running' })),
    Response.json({ status: 'complete', eventId: 2, cueLedger: { ledgerRevision: 1 } })];
  const values = [];
  for await (const value of readVisualJobEvents({ readingResultId: 'narrative-result', visualJobId: 'replay job/1',
    visualJobToken: 'replay-private-token', retryDelay: 0,
    fetchImpl: async (url, init) => { calls.push({ url, method: init.method || 'GET', headers: init.headers }); return responses.shift(); } })) values.push(value);
  assert.deepEqual(calls.map(call => call.url), ['/api/tarot-reading/visual-replays/replay%20job%2F1/stream?cursor=0',
    '/api/tarot-reading/visual-replays/replay%20job%2F1']);
  assert.deepEqual(calls.map(call => call.method), ['GET', 'GET']);
  assert.equal(calls.every(call => call.headers['X-Visual-Token'] === 'replay-private-token' && !call.url.includes('token')), true);
  assert.equal(values.at(-1).data.status, 'complete');
});

test('original handles without transport IDs keep the original result route', async () => {
  const calls = [];
  for await (const _ of readVisualJobEvents({ readingResultId: 'original/result', visualJobToken: 'original-token', retryDelay: 0,
    fetchImpl: async url => { calls.push(url); return sse(event('done', { eventId: 1, status: 'complete' })); } })) { /* drain */ }
  assert.deepEqual(calls, ['/api/tarot-reading/visuals/original%2Fresult/stream?cursor=0']);
});

const savedSource = { raw: 'Saved prose mentioning visualJobToken.', cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }],
  deckId: 'rws-1909', question: 'What renews me?', reflections: { Overall: 'Hope' } };
test('explicit saved retry posts once to the owned cloud route or with only the explicit local source', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return Response.json({ state: { retryStatus: 'pending' }, resumeHandle: null }); };
  const cloud = await postSavedVisualRetry({ cloud: true, entryId: 'entry/1', fetchImpl });
  assert.equal(cloud.ok, true);
  assert.equal(calls[0].url, '/api/journal/entry%2F1/visual-retry');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers['X-Reading-Cue-Display'], undefined, 'gate-off retry never claims cue display');
  assert.equal(calls[0].init.body, undefined);
  const local = await postSavedVisualRetry({ cloud: false, savedSource: { ...savedSource, id: 'local-1', readingResultId: 'old-result',
    visualBinding: { readingResultId: 'old-result' }, visual: { snapshot: {} }, visualJobToken: 'must-not-send' }, fetchImpl });
  assert.equal(local.ok, true);
  assert.equal(calls[1].url, '/api/tarot-reading/visual-retry');
  assert.equal(calls[1].init.credentials, 'include');
  assert.equal(calls[1].init.headers['X-Reading-Cue-Display'], undefined, 'gate-off local retry never claims cue display');
  const body = JSON.parse(calls[1].init.body);
  assert.deepEqual(Object.keys(body), ['savedSource']);
  assert.deepEqual(body.savedSource, savedSource);
  assert.equal(calls.length, 2);
});

test('saved retry failures are typed and never retried automatically', async () => {
  let calls = 0;
  const run = response => postSavedVisualRetry({ cloud: false, savedSource, fetchImpl: async () => { calls++; if (response instanceof Error) throw response; return response; } });
  assert.deepEqual(await run(new TypeError('Failed to fetch')), { ok: false, reason: 'offline' });
  assert.deepEqual(await run(new Response('{}', { status: 503 })), { ok: false, reason: 'server', status: 503 });
  assert.deepEqual(await run(Response.json({ state: null }, { status: 404 })), { ok: false, reason: 'not-found', status: 404 });
  assert.deepEqual(await run(Response.json({ state: null }, { status: 400 })), { ok: false, reason: 'invalid-source', status: 400 });
  assert.deepEqual(await run(new Response('not json', { status: 200 })), { ok: false, reason: 'invalid-response' });
  assert.equal(calls, 5);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(postSavedVisualRetry({ cloud: true, entryId: 'one', signal: controller.signal,
    fetchImpl: (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))) }), { name: 'AbortError' });
});
