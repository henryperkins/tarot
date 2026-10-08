import assert from 'node:assert/strict';
import test from 'node:test';
import { speakText, enqueueTTSChunk, finalizeTTSStream, getCurrentTTSState, cleanupAudio } from '../src/lib/audio.js';
import { djb2Hash } from '../src/lib/utils.js';

function browser(t, mediaSource = false) {
  const players = [];
  const storage = Object.create(null);
  Object.defineProperties(storage, {
    getItem: { value(key) { return storage[key] ?? null; } },
    setItem: { value(key, value) { storage[key] = String(value); } },
    removeItem: { value(key) { delete storage[key]; } }
  });
  for (const key of ['window', 'Audio', 'MediaSource', 'localStorage']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (!descriptor) Object.defineProperty(globalThis, key, { value: undefined, writable: true, configurable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  }
  t.mock.property(globalThis, 'localStorage', storage);
  t.mock.property(globalThis, 'window', { addEventListener() {}, removeEventListener() {}, localStorage: storage });
  t.mock.property(globalThis, 'Audio', class extends EventTarget {
    constructor(src) { super(); this.src = src; this.paused = true; this.ended = false; players.push(this); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
  });
  t.mock.method(URL, 'createObjectURL', () => 'blob:test-audio');
  t.mock.method(URL, 'revokeObjectURL', () => {});
  if (mediaSource) {
    t.mock.property(globalThis, 'MediaSource', class extends EventTarget {
      static isTypeSupported() { return true; }
      constructor() { super(); this.readyState = 'open'; queueMicrotask(() => this.dispatchEvent(new Event('sourceopen'))); }
      addSourceBuffer() { return Object.assign(new EventTarget(), { appendBuffer() {}, updating: false }); }
      endOfStream() {}
    });
  } else t.mock.property(globalThis, 'MediaSource', undefined);
  t.after(() => cleanupAudio());
  return { players, storage };
}

async function waitFor(predicate) {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('Narration did not reach the expected state');
}

test('queued live narration retains its monthly limit message and upgrade details', async t => {
  browser(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3
  }, { status: 429 }));
  assert.equal(enqueueTTSChunk({ text: 'A complete reading.', context: 'full-reading' }), true);
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
  const state = getCurrentTTSState();
  assert.equal(state.status, 'error');
  assert.equal(state.errorCode, 'TIER_LIMIT');
  assert.match(state.message, /Monthly limit reached \(3\/3\)/);
  assert.deepEqual(state.errorDetails, { errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3 });
});

for (const mediaSource of [false, true]) {
  test(`incomplete narration surfaces an error in ${mediaSource ? 'progressive' : 'blob'} playback`, async t => {
    browser(t, mediaSource);
    t.mock.method(console, 'error', () => {});
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('Audio body failed')); } }), { headers: { 'content-type': 'audio/mpeg' } }));
    await speakText({ text: 'A complete reading.', enabled: true, stream: true, context: 'full-reading' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(getCurrentTTSState().status, 'error');
    assert.equal(getCurrentTTSState().errorCode, 'NARRATION_INCOMPLETE');
    assert.ok(getCurrentTTSState().message.includes('Please try again'));
  });
}

test('switching narrator uses separate caches and preserves the actual provider metadata', async t => {
  const { players, storage } = browser(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    const provider = body.provider === 'deepgram' ? 'workers-ai-aura-2' : 'elevenlabs';
    return Response.json({ audio: `data:audio/mpeg;base64,${Buffer.from(provider).toString('base64')}`, provider });
  });
  const narration = { text: 'A provider cache reading.', enabled: true, voice: 'nova', speed: 1.25, context: 'card-reveal' };
  await speakText({ ...narration, provider: 'elevenlabs' });
  const elevenAudio = players.at(-1).src;
  assert.equal(getCurrentTTSState().source, 'network');
  assert.equal(getCurrentTTSState().provider, 'elevenlabs');
  assert.equal(players.at(-1).playbackRate, 1.25);

  await speakText({ ...narration, provider: 'deepgram' });
  const deepgramAudio = players.at(-1).src;
  assert.notEqual(deepgramAudio, elevenAudio);
  assert.equal(getCurrentTTSState().source, 'network');
  assert.equal(getCurrentTTSState().provider, 'workers-ai-aura-2');

  await speakText({ ...narration, provider: 'elevenlabs' });
  assert.equal(players.at(-1).src, elevenAudio);
  assert.equal(getCurrentTTSState().source, 'cache');
  assert.equal(getCurrentTTSState().provider, 'elevenlabs');
  await speakText({ ...narration, provider: 'deepgram' });
  assert.equal(players.at(-1).src, deepgramAudio);
  assert.equal(getCurrentTTSState().source, 'cache');
  assert.equal(getCurrentTTSState().provider, 'workers-ai-aura-2');
  assert.deepEqual(calls.map(call => [call.url, call.body.provider]), [['/api/tts', 'elevenlabs'], ['/api/tts', 'deepgram']]);
  assert.equal(Object.keys(storage).filter(key => key.startsWith('tts_cache_')).length, 2);
});

test('legacy narrator preferences migrate to the ElevenLabs request and reuse its cache', async t => {
  browser(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json({ audio: 'data:audio/mpeg;base64,SUQz', provider: 'elevenlabs' });
  });
  const narration = { text: 'A migrated provider reading.', enabled: true };
  for (const provider of ['azure', 'azure-sdk', 'hume', undefined, 'elevenlabs']) {
    await speakText({ ...narration, provider });
    assert.equal(getCurrentTTSState().provider, 'elevenlabs');
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/tts');
  assert.equal(calls[0].body.provider, 'elevenlabs');
  assert.equal(getCurrentTTSState().source, 'cache');
});

test('unscoped reader cache entries from the previous release never override the selected narrator', async t => {
  const { players, storage } = browser(t);
  const text = 'A cache migration reading.';
  const oldCacheKey = `tts_cache_${djb2Hash(`reader-eleven-v4|${text}|default|verse|default|default|default`).toString(36)}`;
  storage.setItem(oldCacheKey, JSON.stringify({ audio: 'data:audio/mpeg;base64,T0xE', provider: 'workers-ai-aura-2', timestamp: Date.now() }));
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).provider, 'elevenlabs');
    return Response.json({ audio: 'data:audio/mpeg;base64,TkVX', provider: 'elevenlabs' });
  });
  await speakText({ text, enabled: true, provider: 'elevenlabs' });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(players.at(-1).src, 'data:audio/mpeg;base64,TkVX');
  assert.equal(getCurrentTTSState().provider, 'elevenlabs');
  assert.equal(getCurrentTTSState().source, 'network');
});

for (const provider of ['elevenlabs', 'deepgram']) {
  test(`${provider} streaming requests retain the selected narrator and server identity`, async t => {
    browser(t);
    const calls = [];
    const actualProvider = provider === 'deepgram' ? 'workers-ai-aura-2' : 'elevenlabs';
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response('MP3 bytes', { headers: { 'content-type': 'audio/mpeg', 'x-tts-provider': actualProvider } });
    });
    await speakText({ text: 'A complete reading.', enabled: true, stream: true, context: 'full-reading', provider });
    assert.deepEqual(calls.map(call => [call.url, call.body.provider]), [['/api/tts?stream=true', provider]]);
    assert.equal(getCurrentTTSState().status, 'playing');
    assert.equal(getCurrentTTSState().provider, actualProvider);
    assert.equal(getCurrentTTSState().source, 'stream');
  });
}

test('queued narration retains each segment narrator until its own network request', async t => {
  const { players } = browser(t);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    return new Response('MP3 bytes', { headers: { 'content-type': 'audio/mpeg', 'x-tts-provider': body.provider === 'deepgram' ? 'workers-ai-aura-2' : 'elevenlabs' } });
  });
  assert.equal(enqueueTTSChunk({ text: 'The first queued reading.', provider: 'deepgram' }), true);
  assert.equal(enqueueTTSChunk({ text: 'The second queued reading.', provider: 'azure-sdk' }), true);
  finalizeTTSStream();
  await waitFor(() => calls.length === 1 && getCurrentTTSState().status === 'playing');
  assert.equal(getCurrentTTSState().provider, 'workers-ai-aura-2');
  assert.equal(calls[0].body.provider, 'deepgram');
  const firstAudio = players.at(-1);
  firstAudio.ended = true;
  firstAudio.dispatchEvent(new Event('ended'));
  await waitFor(() => calls.length === 2 && getCurrentTTSState().status === 'playing' && getCurrentTTSState().provider === 'elevenlabs');
  assert.deepEqual(calls.map(call => [call.url, call.body.provider]), [['/api/tts?stream=true', 'deepgram'], ['/api/tts?stream=true', 'elevenlabs']]);
  assert.deepEqual(calls.map(call => call.body.text), ['The first queued reading.', 'The second queued reading.']);
  players.at(-1).ended = true;
  players.at(-1).dispatchEvent(new Event('ended'));
  await waitFor(() => getCurrentTTSState().status === 'completed');
});
