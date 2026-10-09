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

test('narration health describes both choices and their configured availability without synthesis', async t => {
  const calls = mockProvider(t);
  let auraCalls = 0;
  const AI = { run() { auraCalls++; throw new Error('Health must not synthesize'); } };
  for (const [env, available] of [[{}, [false, false]], [{ AI }, [false, true]], [configuration, [true, false]], [{ ...configuration, AI }, [true, true]]]) {
    const response = await onRequestGet({ env });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.providers.map(provider => provider.id), ['elevenlabs', 'deepgram']);
    assert.deepEqual(payload.providers.map(provider => provider.available), available);
    assert.equal(payload.providers[0].model, DEFAULT_MODEL);
    assert.equal(payload.providers[1].model, '@cf/deepgram/aura-2-en');
    assert.ok(!JSON.stringify(payload).includes(TEST_KEY));
  }
  assert.equal(calls.length, 0);
  assert.equal(auraCalls, 0);
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

test('missing accounting prevents synthesis for either explicitly chosen narrator', async t => {
  const calls = mockProvider(t);
  let auraCalls = 0;
  const env = { ...configuration, AI: { async run() { auraCalls++; return new Response('Unexpected speech').body; } } };
  for (const provider of ['elevenlabs', 'deepgram']) {
    const response = await onRequestPost({ request: request({ text: 'A reading.', provider }), env });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).errorCode, 'ACCOUNTING_UNAVAILABLE');
  }
  assert.equal(calls.length, 0);
  assert.equal(auraCalls, 0);
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
  const response = await onRequestPost({ request: request({ text: 'A'.repeat(4000), provider: 'elevenlabs' }, { stream: true }), env: { ...configuration, DB } });
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
  const response = await onRequestPost({ request: request({ text: 'A reading.', provider: 'elevenlabs' }, { stream: true, signal: controller.signal }), env: { ...configuration, DB } });
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
  const narration = onRequestPost({ request: request({ text: 'A reading.', provider: 'elevenlabs' }, { stream: true, signal: controller.signal }), env: { ...configuration, DB } });
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
  const response = await onRequestPost({ request: request({ text: 'A reading.', provider: 'elevenlabs' }, { stream: true }), env: { ...configuration, DB } });
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
  const response = await onRequestPost({ request: request({ text: 'A reading.', provider: 'elevenlabs' }, { stream: true }), env: { ...configuration, DB } });
  const reading = response.arrayBuffer();
  t.mock.timers.tick(NARRATION_DEADLINE_MS);
  await assert.rejects(reading);
  assert.equal(cancelled, true);
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});

for (const provider of ['elevenlabs', 'deepgram']) {
  for (const stream of [false, true]) {
    test(`explicit ${provider} uses only its chosen provider for ${stream ? 'streamed' : 'buffered'} narration`, async t => {
      const calls = mockProvider(t, async () => audioResponse('ElevenLabs MP3'));
      const DB = await createD1();
      const auraCalls = [];
      const response = await onRequestPost({ request: request({ text: 'The Star offers renewal.', provider }, { stream }), env: {
        ...configuration, DB,
        AI: { async run(model, input) { auraCalls.push({ model, input }); return new Response('Deepgram MP3').body; } }
      } });
      assert.equal(response.status, 200);
      const actualProvider = provider === 'deepgram' ? 'workers-ai-aura-2' : 'elevenlabs';
      if (stream) {
        assert.equal(response.headers.get('x-tts-provider'), actualProvider);
        assert.equal(await response.text(), provider === 'deepgram' ? 'Deepgram MP3' : 'ElevenLabs MP3');
      } else {
        const payload = await response.json();
        assert.equal(payload.provider, actualProvider);
        assert.equal(Buffer.from(payload.audio.split(',')[1], 'base64').toString(), provider === 'deepgram' ? 'Deepgram MP3' : 'ElevenLabs MP3');
      }
      assert.equal(calls.length, provider === 'elevenlabs' ? 1 : 0);
      assert.equal(auraCalls.length, provider === 'deepgram' ? 1 : 0);
      if (provider === 'deepgram') assert.deepEqual(auraCalls[0], {
        model: '@cf/deepgram/aura-2-en', input: { text: 'The Star offers renewal.', speaker: 'cora' }
      });
      assert.deepEqual(usage(DB), [{ used: 1, reserved: 0 }]);
    });
  }
}

test('explicit ElevenLabs cannot fall back to Deepgram when its key is missing', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  let auraCalls = 0;
  const response = await onRequestPost({ request: request({ text: 'A reading.', provider: 'elevenlabs' }), env: {
    DB, AI: { async run() { auraCalls++; return new Response('Unexpected Deepgram speech').body; } }
  } });
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
  assert.equal(auraCalls, 0);
  assert.deepEqual(usage(DB), []);
  assert.deepEqual(DB.rows('SELECT * FROM narration_requests'), []);
});

test('explicit Deepgram cannot fall back to ElevenLabs when its binding is missing', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  const response = await onRequestPost({ request: request({ text: 'A reading.', provider: 'deepgram' }), env: { ...configuration, DB } });
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
  assert.deepEqual(usage(DB), []);
});

test('invalid explicit provider names cannot reach accounting or inference', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  let auraCalls = 0;
  const env = { ...configuration, DB, AI: { async run() { auraCalls++; return new Response('Unexpected speech').body; } } };
  for (const provider of [null, '', 'azure', 'azure-sdk', 'hume', 'workers-ai-aura-2', 'ElevenLabs', 'elevenlabs ', ' deepgram', 1, {}, []]) {
    const response = await onRequestPost({ request: request({ text: 'A reading.', provider }), env });
    assert.equal(response.status, 400, `Invalid provider ${JSON.stringify(provider)} must be rejected`);
  }
  assert.equal(calls.length, 0);
  assert.equal(auraCalls, 0);
  assert.deepEqual(DB.rows('SELECT * FROM narration_requests'), []);
  assert.deepEqual(DB.rows('SELECT * FROM narration_request_limits'), []);
  assert.deepEqual(usage(DB), []);
});

test('changing the chosen provider cannot reset the monthly narration allowance', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  let auraCalls = 0;
  const env = { ...configuration, DB, AI: { async run() { auraCalls++; return new Response('Deepgram MP3').body; } } };
  for (const provider of ['elevenlabs', 'deepgram', 'elevenlabs']) {
    const response = await onRequestPost({ request: request({ text: 'A reading.', provider }), env });
    assert.equal(response.status, 200);
  }
  for (const provider of ['deepgram', 'elevenlabs']) {
    const response = await onRequestPost({ request: request({ text: 'A further reading.', provider }), env });
    assert.equal(response.status, 429);
    assert.equal((await response.json()).errorCode, 'TIER_LIMIT');
  }
  assert.equal(calls.length, 2);
  assert.equal(auraCalls, 1);
  assert.deepEqual(usage(DB), [{ used: 3, reserved: 0 }]);
});

test('a Deepgram failure refunds once and another chosen provider can use the allowance', async t => {
  const calls = mockProvider(t);
  const DB = await createD1();
  let auraCalls = 0;
  const env = { ...configuration, DB, AI: { async run() { auraCalls++; throw new Error('Deepgram synthesis failed'); } } };
  const failed = await onRequestPost({ request: request({ text: 'A reading.', provider: 'deepgram' }), env });
  assert.equal(failed.status, 503);
  assert.equal(calls.length, 0, 'A selected provider failure never switches the narrator');
  assert.equal(auraCalls, 1);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
  const completed = await onRequestPost({ request: request({ text: 'A reading.', provider: 'elevenlabs' }), env });
  assert.equal(completed.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(usage(DB), [{ used: 1, reserved: 0 }]);
  assert.deepEqual(DB.rows('SELECT state FROM narration_requests ORDER BY updated_at'), [{ state: 'released' }, { state: 'settled' }]);
});

test('choosing another provider cannot start a concurrent narration for the same identity', async t => {
  let cancelled = false;
  const calls = mockProvider(t, async () => audioResponse(new ReadableStream({ cancel() { cancelled = true; } })));
  const DB = await createD1();
  let auraCalls = 0;
  const env = { ...configuration, DB, AI: { async run() { auraCalls++; return new Response('Deepgram MP3').body; } } };
  const first = await onRequestPost({ request: request({ text: 'An active reading.', provider: 'elevenlabs' }, { stream: true }), env });
  assert.equal(first.status, 200);
  const second = await onRequestPost({ request: request({ text: 'Another reading.', provider: 'deepgram' }, { stream: true }), env });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).errorCode, 'NARRATION_BUSY');
  assert.equal(calls.length, 1);
  assert.equal(auraCalls, 0);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 1 }]);
  await first.body.cancel();
  assert.equal(cancelled, true);
  assert.deepEqual(usage(DB), [{ used: 0, reserved: 0 }]);
});
