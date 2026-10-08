import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost, splitForSpeech } from '../functions/api/tts.js';
import { NARRATION_DEADLINE_MS } from '../functions/lib/ttsLimits.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const TEST_KEY = 'elevenlabs-test-secret';
const DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL';
const DEFAULT_MODEL = 'eleven_v4';
const configuration = { ELEVENLABS_API_KEY: TEST_KEY };
const request = (body, { stream = false, signal } = {}) => new Request(`https://example.test/api/tts${stream ? '?stream=true' : ''}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.51' },
  body: JSON.stringify(body),
  signal
});
const usage = DB => DB.rows('SELECT used, reserved FROM narration_monthly_usage');
const audioResponse = (audio = 'test MP3') => new Response(audio, { headers: { 'content-type': 'audio/mpeg' } });

function mockProvider(t, handler = async () => audioResponse()) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const upstream = new Request(input, options);
    const call = {
      url: upstream.url,
      method: upstream.method,
      headers: upstream.headers,
      body: await upstream.json(),
      signal: upstream.signal
    };
    calls.push(call);
    return handler(call, calls.length);
  });
  return calls;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('ElevenLabs health reflects default and overridden server configuration without exposing its key', async () => {
  const defaults = await (await onRequestGet({ env: configuration })).json();
  assert.equal(defaults.provider, 'elevenlabs');
  assert.equal(defaults.model, DEFAULT_MODEL);
  assert.equal(defaults.voice, DEFAULT_VOICE);
  assert.equal(defaults.format, 'mp3');
  assert.equal(defaults.maxCharacters, 64000);
  assert.ok(!JSON.stringify(defaults).includes(TEST_KEY));

  const override = await (await onRequestGet({ env: {
    ...configuration,
    ELEVENLABS_VOICE_ID: ' custom-voice ',
    ELEVENLABS_MODEL_ID: ' custom-model '
  } })).json();
  assert.equal(override.voice, 'custom-voice');
  assert.equal(override.model, 'custom-model');
});

test('configured ElevenLabs uses the official streaming endpoint and keeps the key in its header', async t => {
  const calls = mockProvider(t, async () => audioResponse(new Uint8Array([73, 68, 51, 1, 2])));
  const DB = await createD1();
  let auraCalls = 0;
  const response = await onRequestPost({ request: request({ text: '  The Star offers renewal.  ', voice: 'nova', speed: 2 }), env: {
    ...configuration,
    ELEVENLABS_API_KEY: ` ${TEST_KEY} `,
    DB,
    AI: { run() { auraCalls++; throw new Error('Aura must not be selected'); } }
  } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.provider, 'elevenlabs');
  assert.equal(payload.audio, `data:audio/mpeg;base64,${Buffer.from([73, 68, 51, 1, 2]).toString('base64')}`);
  assert.equal(auraCalls, 0);
  assert.equal(calls.length, 1);
  const [call] = calls;
  const url = new URL(call.url);
  assert.equal(url.origin, 'https://api.elevenlabs.io');
  assert.equal(url.pathname, `/v1/text-to-speech/${DEFAULT_VOICE}/stream`);
  assert.equal(url.searchParams.get('output_format'), 'mp3_44100_128');
  assert.equal(call.method, 'POST');
  assert.equal(call.headers.get('xi-api-key'), TEST_KEY);
  assert.equal(call.headers.get('content-type'), 'application/json');
  assert.equal(call.body.text, 'The Star offers renewal.');
  assert.equal(call.body.model_id, DEFAULT_MODEL);
  assert.ok(!JSON.stringify(call.body).includes(TEST_KEY));
  assert.ok(!call.url.includes(TEST_KEY));
  assert.ok(!call.url.includes('nova'));
  assert.equal(call.body.voice, undefined);
  assert.equal(call.body.speed, undefined);
  assert.notEqual(call.body.voice_settings?.speed, 2);
  assert.deepEqual(usage(DB), [{ used: 1, reserved: 0 }]);
});

test('server voice and model overrides are used for synthesis', async t => {
  const calls = mockProvider(t);
  const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: {
    ...configuration,
    ELEVENLABS_VOICE_ID: ' selected-voice ',
    ELEVENLABS_MODEL_ID: ' selected-model ',
    DB: await createD1()
  } });
  assert.equal(response.status, 200);
  assert.equal(new URL(calls[0].url).pathname, '/v1/text-to-speech/selected-voice/stream');
  assert.equal(calls[0].body.model_id, 'selected-model');
});

test('blank ElevenLabs configuration preserves Aura narration without outbound REST requests', async t => {
  const calls = mockProvider(t);
  const auraCalls = [];
  const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: {
    ELEVENLABS_API_KEY: '  ',
    DB: await createD1(),
    AI: { async run(model, input) { auraCalls.push({ model, input }); return new Response('Aura MP3').body; } }
  } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, 'workers-ai-aura-2');
  assert.equal(calls.length, 0);
  assert.equal(auraCalls.length, 1);
  assert.equal(auraCalls[0].model, '@cf/deepgram/aura-2-en');
  assert.equal((await (await onRequestGet({ env: { ELEVENLABS_API_KEY: '  ' } })).json()).provider, 'unavailable');
});

test('long readings stream every ordered piece with neighboring text and count once', async t => {
  const calls = mockProvider(t, async (_call, index) => audioResponse(`<${index}>`));
  const warn = t.mock.method(console, 'warn', () => {});
  const DB = await createD1();
  const text = 'The Tower asks what was never built to last. '.repeat(160).trim() + ' THE END';
  const expectedPieces = splitForSpeech(text);
  const response = await onRequestPost({ request: request({ text }, { stream: true }), env: { ...configuration, DB } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('x-tts-provider'), 'elevenlabs');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), expectedPieces.map((_, index) => `<${index + 1}>`).join(''));
  assert.deepEqual(calls.map(call => call.body.text), expectedPieces);
  assert.ok(calls.length > 3);
  assert.ok(calls.every(call => call.body.text.length <= 1900));
  assert.ok(calls.at(-1).body.text.endsWith('THE END'));
  for (const [index, call] of calls.entries()) {
    const previous = call.body.previous_text;
    const next = call.body.next_text;
    if (index > 0) {
      assert.ok(previous?.length > 0 && previous.length <= 500);
      assert.ok(expectedPieces[index - 1].endsWith(previous));
    }
    if (index < calls.length - 1) {
      assert.ok(next?.length > 0 && next.length <= 500);
      assert.ok(expectedPieces[index + 1].startsWith(next));
    }
  }
  assert.equal(warn.mock.callCount(), 0, 'Aura-specific byte heuristics must not warn for ElevenLabs MP3');
  assert.deepEqual(usage(DB), [{ used: 1, reserved: 0 }]);
  assert.deepEqual(DB.rows('SELECT state FROM narration_requests'), [{ state: 'settled' }]);
});

for (const [body, label] of [[{}, 'missing'], [{ text: '' }, 'empty'], [{ text: '   ' }, 'blank'], [{ text: 42 }, 'non-string']]) {
  test(`ElevenLabs rejects ${label} text before paid synthesis`, async t => {
    const calls = mockProvider(t);
    const DB = await createD1();
    const response = await onRequestPost({ request: request(body), env: { ...configuration, DB } });
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
    assert.deepEqual(usage(DB), []);
  });
}

test('invalid JSON and excessive text or body size never call ElevenLabs', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  for (const [input, status] of [
    [new Request('https://example.test/api/tts', { method: 'POST', body: '{invalid' }), 400],
    [request({ text: 'x'.repeat(64001) }), 413],
    [request({ text: 'A reading.', ignored: 'x'.repeat(512 * 1024) }), 413]
  ]) {
    const response = await onRequestPost({ request: input, env: { ...configuration, DB } });
    assert.equal(response.status, status);
  }
  assert.equal(calls.length, 0);
  assert.deepEqual(usage(DB), []);
});

test('missing accounting prevents paid ElevenLabs synthesis', async t => {
  const calls = mockProvider(t);
  const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: configuration });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).errorCode, 'ACCOUNTING_UNAVAILABLE');
  assert.equal(calls.length, 0);
});

test('monthly allowance denies ElevenLabs before an additional inference', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  for (let index = 0; index < 3; index++) {
    const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: { ...configuration, DB } });
    assert.equal(response.status, 200);
  }
  const denied = await onRequestPost({ request: request({ text: 'A fourth reading.' }), env: { ...configuration, DB } });
  assert.equal(denied.status, 429);
  assert.equal((await denied.json()).errorCode, 'TIER_LIMIT');
  assert.equal(calls.length, 3);
  assert.deepEqual(usage(DB), [{ used: 3, reserved: 0 }]);
});

test('an upstream HTTP failure is not retried, exposes no private body, and refunds', async t => {
  const privateText = 'Private interpretation of the reading.';
  const calls = mockProvider(t, async () => new Response(`${TEST_KEY}: ${privateText}`, { status: 429 }));
  const DB = await createD1();
  let auraCalls = 0;
  const response = await onRequestPost({ request: request({ text: privateText }), env: {
    ...configuration,
    DB,
    AI: { run() { auraCalls++; throw new Error('Unexpected provider fallback'); } }
  } });
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.errorCode, 'NARRATION_UNAVAILABLE');
  assert.equal(payload.retryable, true);
  assert.ok(!JSON.stringify(payload).includes(TEST_KEY));
  assert.ok(!JSON.stringify(payload).includes(privateText));
  assert.equal(calls.length, 1);
  assert.equal(auraCalls, 0);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});

test('an upstream exception cannot disclose provider credentials in the public error', async t => {
  const calls = mockProvider(t, async () => { throw new Error(`Provider unavailable with ${TEST_KEY}`); });
  const DB = await createD1();
  const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: { ...configuration, DB } });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes(TEST_KEY));
  assert.equal(calls.length, 1);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});

for (const [body, headers, label] of [
  ['{"error":"private upstream error"}', { 'content-type': 'application/json' }, 'non-audio'],
  ['', { 'content-type': 'audio/mpeg' }, 'empty audio']
]) {
  test(`ElevenLabs ${label} success response fails and refunds`, async t => {
    const calls = mockProvider(t, async () => new Response(body, { headers }));
    const DB = await createD1();
    const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: { ...configuration, DB } });
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('private upstream error'));
    assert.equal(calls.length, 1);
    assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
  });
}

test('failure on a later piece does not settle a partial streamed reading or retry', async t => {
  const calls = mockProvider(t, async (_call, index) => index === 1 ? audioResponse('first MP3') : new Response('private failure', { status: 500 }));
  const DB = await createD1();
  const response = await onRequestPost({ request: request({ text: 'A'.repeat(4000) }, { stream: true }), env: { ...configuration, DB } });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(new TextDecoder().decode(first.value), 'first MP3');
  await assert.rejects(reader.read());
  reader.releaseLock();
  assert.equal(calls.length, 2);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
  assert.deepEqual(DB.rows('SELECT state FROM narration_requests'), [{ state: 'released' }]);
});

test('pre-aborted requests never start ElevenLabs synthesis', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  const controller = new AbortController();
  controller.abort();
  const response = await onRequestPost({ request: request({ text: 'A reading.' }, { stream: true, signal: controller.signal }), env: { ...configuration, DB } });
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});

test('caller abort cancels the upstream fetch while it is waiting for headers and refunds', async t => {
  const entered = deferred();
  const calls = mockProvider(t, call => {
    entered.resolve();
    return new Promise((_, reject) => {
      call.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  });
  const DB = await createD1();
  const controller = new AbortController();
  const narration = onRequestPost({ request: request({ text: 'A reading.' }, { stream: true, signal: controller.signal }), env: { ...configuration, DB } });
  await entered.promise;
  controller.abort();
  const response = await narration;
  assert.equal(response.status, 503);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});

test('consumer cancellation cancels stalled ElevenLabs audio and its upstream signal', async t => {
  let cancelled = false;
  const calls = mockProvider(t, async () => audioResponse(new ReadableStream({ cancel() { cancelled = true; } })));
  const DB = await createD1();
  const response = await onRequestPost({ request: request({ text: 'A reading.' }, { stream: true }), env: { ...configuration, DB } });
  await response.body.cancel();
  assert.equal(cancelled, true);
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});

test('narration deadline cancels stalled ElevenLabs audio and refunds without retrying', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let cancelled = false;
  const calls = mockProvider(t, async () => audioResponse(new ReadableStream({ cancel() { cancelled = true; } })));
  const DB = await createD1();
  const response = await onRequestPost({ request: request({ text: 'A reading.' }, { stream: true }), env: { ...configuration, DB } });
  const reading = response.arrayBuffer();
  t.mock.timers.tick(NARRATION_DEADLINE_MS);
  await assert.rejects(reading);
  assert.equal(cancelled, true);
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});
