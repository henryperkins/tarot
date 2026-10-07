import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callAzureResponses } from '../functions/lib/azureResponses.js';
import { callAzureResponsesStream, callAzureResponsesStreamWithConversation, transformAzureStream } from '../functions/lib/azureResponsesStream.js';
import { fetchWithRetry } from '../functions/lib/retryWithBackoff.js';
import { createToolRoundTripStream } from '../functions/api/reading-followup.js';
import { createDeadline, runWithSignal } from '../functions/lib/requestDeadline.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const env = { OPENAI_API_KEY: 'offline-test-key' };
const options = { instructions: 'Be helpful.', input: 'A synthetic fixture.', requestId: 'offline-deadline' };
const event = (type, data = {}) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;

test('buffered Responses reject incomplete text instead of presenting a cut-off answer', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: 'Partial answer' }));
  await assert.rejects(callAzureResponses(env, options), /incomplete|cut off/i);
});

test('buffered Responses disable storage and retain the actual model', async (t) => {
  let body;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    body = JSON.parse(init.body);
    return Response.json({ status: 'completed', model: 'actual-model', output_text: 'Complete answer', usage: { output_tokens: 2 } });
  });
  const result = await callAzureResponses(env, { ...options, returnFullResponse: true });
  assert.equal(body.store, false);
  assert.equal(result.model, 'actual-model');
});

test('a caller deadline covers a stalled buffered response body', async (t) => {
  const controller = new AbortController();
  let sentSignal;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    sentSignal = init.signal;
    return { ok: true, status: 200, json: () => new Promise(() => {}) };
  });
  const pending = callAzureResponses(env, { ...options, signal: controller.signal, timeoutMs: 40 });
  setTimeout(() => controller.abort(new Error('caller cancelled')), 5);
  await assert.rejects(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('body remained unbounded')), 150))]), /caller cancelled|cancelled|aborted/i);
  assert.equal(sentSignal.aborted, true);
});

test('Retry-After cannot keep a cancelled task asleep or start another attempt', async (t) => {
  let calls = 0;
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response('', { status: 429, headers: { 'Retry-After': '3600' } });
  });
  const pending = fetchWithRetry('https://example.invalid', { signal: controller.signal }, 'deadline-fixture', 'deadline', { maxRetries: 2, baseDelayMs: 1, enableCircuitBreaker: false });
  setTimeout(() => controller.abort(new Error('task cancelled')), 5);
  await assert.rejects(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('retry remained asleep')), 150))]), /task cancelled|aborted/i);
  assert.equal(calls, 1);
});

for (const terminal of ['response.incomplete', 'response.failed', null]) {
  test(`streaming Responses refuse a successful done event after ${terminal || 'premature EOF'}`, async () => {
    const raw = new Response(event('response.output_text.delta', { delta: 'Partial' }) + (terminal ? event(terminal) : '')).body;
    const text = await new Response(transformAzureStream(raw)).text();
    assert.match(text, /event: error/);
    assert.doesNotMatch(text, /event: done/);
  });
}

for (const continuation of [false, true]) {
  test(`streaming ${continuation ? 'continuation' : 'initial'} request has storage disabled and a body deadline`, async (t) => {
    let body;
    let signal;
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
      body = JSON.parse(init.body);
      signal = init.signal;
      return new Response(new ReadableStream({ pull() { return new Promise(() => {}); } }));
    });
    const call = continuation ? callAzureResponsesStreamWithConversation : callAzureResponsesStream;
    const stream = await call(env, { ...options, conversation: [], timeoutMs: 20 });
    assert.equal(body.store, false);
    await assert.rejects(new Response(stream).text(), /timed out|deadline/i);
    assert.equal(signal.aborted, true);
  });
}

test('a task deadline interrupts a stalled tool without starting a continuation', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(
      event('response.output_item.added', { item: { type: 'function_call', call_id: 'call-1', name: 'save_memory_note' } }) +
      event('response.function_call_arguments.delta', { call_id: 'call-1', delta: '{}' }) +
      event('response.function_call_arguments.done', { call_id: 'call-1' }) +
      event('response.completed', { response: { status: 'completed' } })
    );
  });
  const deadline = createDeadline({ timeoutMs: 25 });
  t.after(() => deadline.dispose());
  const stream = createToolRoundTripStream(env, {
    instructions: 'Synthetic test', userInput: 'test', tools: [], maxTokens: 4096,
    signal: deadline.signal, onToolCall: () => new Promise(() => {})
  });
  await assert.rejects(new Response(stream).text(), /timed out/);
  assert.equal(calls, 1);
});

test('an already cancelled task never starts work', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled before start'));
  let started = false;
  assert.throws(() => runWithSignal(() => { started = true; }, controller.signal), /cancelled before start/);
  assert.equal(started, false);
});

test('buffered short tasks record returned model and rejected usage separately from configuration', async (t) => {
  const DB = await createD1();
  let count = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    status: count++ ? 'incomplete' : 'completed', model: 'returned-model', output_text: 'Synthetic answer',
    usage: { input_tokens: 10, output_tokens: 5 }
  }));
  const telemetry = { task: 'question', requestId: 'test-question' };
  await callAzureResponses({ ...env, DB }, { ...options, telemetry });
  await assert.rejects(callAzureResponses({ ...env, DB }, { ...options, telemetry }), /incomplete/);
  const rows = DB.rows('SELECT * FROM inference_attempts ORDER BY rowid');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].model, 'returned-model');
  assert.equal(rows[0].requested_model, 'gpt-5.6-sol');
  assert.equal(rows[1].state, 'failed');
  assert.equal(rows[1].usage_status, 'known');
  assert.equal(rows[1].reason, 'incomplete');
});

test('completed stream records actual model and usage once and carries it to the reading collector', async (t) => {
  const DB = await createD1();
  t.mock.method(globalThis, 'fetch', async () => new Response(
    event('response.output_text.delta', { delta: 'Complete answer' }) +
    event('response.completed', { response: { status: 'completed', model: 'returned-stream-model', usage: { input_tokens: 8, output_tokens: 4 } } })
  ));
  const stream = await callAzureResponsesStream({ ...env, DB }, { ...options, telemetry: { task: 'followup', requestId: 'test-followup' } });
  const output = await new Response(transformAzureStream(stream)).text();
  assert.match(output, /"model":"returned-stream-model"/);
  const rows = DB.rows('SELECT * FROM inference_attempts');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'accepted');
  assert.equal(rows[0].total_tokens, 12);
});
