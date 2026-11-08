// OpenAI failures must say why in the Worker log (sanitized), while errors that
// can reach clients carry identifiers only. Production gpt-6.1-sol readings
// failed for days as a bare "Responses API returned error".
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { safeProviderIdentifier, sanitizeProviderErrorMessage } from '../functions/lib/providerErrorDetails.js';
import { sanitizeAnthropicErrorMessage } from '../functions/lib/anthropicMessages.js';
import { callOpenAIResponses, describeOpenAIFailure } from '../functions/lib/openaiResponses.js';
import { callOpenAIResponsesStream, transformOpenAIStream } from '../functions/lib/openaiResponsesStream.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const env = { OPENAI_API_KEY: 'offline-test-key' };
const options = { instructions: 'Be helpful.', input: 'A synthetic fixture.', requestId: 'offline-reading' };
const event = (type, data = {}) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const PRIVATE_MESSAGE = 'Could not answer "my private question" for person@example.com';
const UPSTREAM_REQUEST_ID = 'req_0123456789abcdef0123456789abcdef';
const RESPONSE_ID = `resp_${'a1'.repeat(24)}`;

function captureWarnings(t) {
  const lines = [];
  t.mock.method(console, 'warn', (...args) => { lines.push(args.join(' ')); });
  return lines;
}

function sse(body) {
  return new Response(body, { headers: { 'content-type': 'text/event-stream', 'x-request-id': UPSTREAM_REQUEST_ID } });
}

describe('provider error details', () => {
  test('keeps plain identifiers and masks quoted text, addresses and tokens', () => {
    assert.equal(safeProviderIdentifier('model_not_found'), 'model_not_found');
    assert.equal(safeProviderIdentifier('reasoning.summary'), 'reasoning.summary');
    assert.equal(safeProviderIdentifier('two words'), null);
    assert.equal(safeProviderIdentifier(42), null);
    assert.equal(sanitizeProviderErrorMessage(PRIVATE_MESSAGE), 'Could not answer "[redacted]" for [redacted]');
    assert.equal(sanitizeAnthropicErrorMessage, sanitizeProviderErrorMessage, 'Claude and OpenAI share one sanitizer');
  });

  test('reads every OpenAI failure shape', () => {
    assert.deepEqual(describeOpenAIFailure({ type: 'error', code: 'server_error', message: 'Try again.', param: null }),
      { type: null, code: 'server_error', param: null, reason: null, responseId: null, message: 'Try again.' });
    assert.deepEqual(describeOpenAIFailure({ error: { type: 'invalid_request_error', code: 'model_not_found', param: 'model', message: 'The model `gpt-x` does not exist.' } }),
      { type: 'invalid_request_error', code: 'model_not_found', param: 'model', reason: null, responseId: null, message: 'The model `gpt-x` does not exist.' });
    assert.deepEqual(describeOpenAIFailure({ type: 'response.failed', response: { id: RESPONSE_ID, status: 'failed', error: { code: 'server_error', message: PRIVATE_MESSAGE } } }),
      { type: null, code: 'server_error', param: null, reason: null, responseId: RESPONSE_ID, message: 'Could not answer "[redacted]" for [redacted]' });
    assert.equal(describeOpenAIFailure({ type: 'response.incomplete', response: { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } } }).reason, 'max_output_tokens');
    assert.deepEqual(describeOpenAIFailure(null), { type: null, code: null, param: null, reason: null, responseId: null, message: null });
  });
});

describe('streamed OpenAI failures', () => {
  test('an error event is logged with its code, request ID and sanitized message', async (t) => {
    const warnings = captureWarnings(t);
    const DB = await createD1();
    t.mock.method(globalThis, 'fetch', async () => sse(
      event('response.created', { response: { id: RESPONSE_ID, status: 'in_progress', model: 'gpt-x' } }) +
      event('error', { code: 'server_error', message: PRIVATE_MESSAGE, param: null, sequence_number: 2 })
    ));
    const stream = await callOpenAIResponsesStream({ ...env, DB }, { ...options, telemetry: { task: 'reading', requestId: 'telemetry-id' } });
    const output = await new Response(transformOpenAIStream(stream)).text();

    assert.match(output, /event: error/);
    assert.match(output, /Responses API returned error \(server_error\); a complete answer is required\./);
    assert.doesNotMatch(output, /private question|person@example\.com/, 'the client sees identifiers only');
    const line = warnings.find(text => text.includes('[openai-native]'));
    assert.equal(line, `[offline-reading] [openai-native] Stream returned error (server_error, request ${UPSTREAM_REQUEST_ID}): Could not answer "[redacted]" for [redacted]`);
    assert.equal(DB.rows('SELECT reason FROM inference_attempts')[0].reason, 'incomplete', 'attempt telemetry is unchanged');
  });

  test('a failed response names its error code and response ID', async (t) => {
    const warnings = captureWarnings(t);
    t.mock.method(globalThis, 'fetch', async () => sse(event('response.failed', {
      response: { id: RESPONSE_ID, status: 'failed', error: { code: 'rate_limit_exceeded', message: 'Slow down.' } }
    })));
    const output = await new Response(transformOpenAIStream(await callOpenAIResponsesStream(env, options))).text();
    assert.match(output, /Responses API returned response\.failed \(rate_limit_exceeded\)/);
    assert.ok(warnings.includes(`[offline-reading] [openai-native] Stream returned response.failed (rate_limit_exceeded, response ${RESPONSE_ID}, request ${UPSTREAM_REQUEST_ID}): Slow down.`));
  });

  test('an incomplete response names its reason', async (t) => {
    const warnings = captureWarnings(t);
    t.mock.method(globalThis, 'fetch', async () => sse(event('response.incomplete', {
      response: { status: 'incomplete', incomplete_details: { reason: 'content_filter' } }
    })));
    const output = await new Response(transformOpenAIStream(await callOpenAIResponsesStream(env, options))).text();
    assert.match(output, /Responses API returned response\.incomplete \(content_filter\)/);
    assert.ok(warnings.some(text => text.startsWith('[offline-reading] [openai-native] Stream returned response.incomplete (content_filter')));
  });

  test('a rejected stream request names the HTTP error and logs OpenAI\'s explanation', async (t) => {
    const warnings = captureWarnings(t);
    t.mock.method(globalThis, 'fetch', async () => Response.json({
      error: { type: 'invalid_request_error', code: 'model_not_found', param: 'model', message: 'The model `gpt-x` does not exist or you do not have access to it.' }
    }, { status: 404, headers: { 'x-request-id': UPSTREAM_REQUEST_ID } }));
    await assert.rejects(callOpenAIResponsesStream(env, options), (error) => {
      assert.equal(error.message, 'Responses API error HTTP 404 (invalid_request_error, model_not_found).');
      return true;
    });
    assert.ok(warnings.includes(`[offline-reading] [openai-native] Request failed (HTTP 404, invalid_request_error, model_not_found, param model, request ${UPSTREAM_REQUEST_ID}): The model \`gpt-x\` does not exist or you do not have access to it.`));
  });

  test('OPENAI_TIMEOUT_MS sets the stream deadline when the caller passes none', async (t) => {
    let signal;
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
      signal = init.signal;
      return new Response(new ReadableStream({ pull() { return new Promise(() => {}); } }));
    });
    const startedAt = Date.now();
    const stream = await callOpenAIResponsesStream({ ...env, OPENAI_TIMEOUT_MS: '1000' }, options);
    await assert.rejects(new Response(stream).text(), /timed out|deadline/i);
    const elapsed = Date.now() - startedAt;
    assert.ok(elapsed >= 900 && elapsed < 5000, `deadline took ${elapsed} ms`);
    assert.equal(signal.aborted, true);
  });
});

describe('buffered OpenAI failures', () => {
  test('a failed response names its error code and logs the message', async (t) => {
    const warnings = captureWarnings(t);
    t.mock.method(globalThis, 'fetch', async () => Response.json({
      id: RESPONSE_ID, status: 'failed', model: 'gpt-x', error: { code: 'server_error', message: PRIVATE_MESSAGE }
    }));
    await assert.rejects(callOpenAIResponses(env, options), /^Error: Responses API returned failed \(server_error\); a complete answer is required\.$/);
    assert.ok(warnings.includes(`[offline-reading] [openai-native] Response failed (server_error, response ${RESPONSE_ID}): Could not answer "[redacted]" for [redacted]`));
  });

  test('a rejected request logs OpenAI\'s explanation without putting it in the error', async (t) => {
    const warnings = captureWarnings(t);
    t.mock.method(globalThis, 'fetch', async () => Response.json({
      error: { type: 'invalid_request_error', code: 'unsupported_value', param: 'reasoning.summary', message: PRIVATE_MESSAGE }
    }, { status: 400, headers: { 'x-request-id': UPSTREAM_REQUEST_ID } }));
    await assert.rejects(callOpenAIResponses(env, options), (error) => {
      assert.equal(error.message, 'HTTP 400');
      return true;
    });
    assert.ok(warnings.includes(`[offline-reading] [openai-native] Request failed (HTTP 400, invalid_request_error, unsupported_value, param reasoning.summary, request ${UPSTREAM_REQUEST_ID}): Could not answer "[redacted]" for [redacted]`));
  });
});
