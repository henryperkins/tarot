import assert from 'node:assert/strict';
import test from 'node:test';
import { speakText, getCurrentTTSState, cleanupAudio } from '../src/lib/audio.js';

function browser(t, mediaSource = false) {
  for (const key of ['window', 'Audio', 'MediaSource']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    if (!descriptor) Object.defineProperty(globalThis, key, { value: undefined, writable: true, configurable: true });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; });
  }
  t.mock.property(globalThis, 'window', { addEventListener() {}, removeEventListener() {} });
  t.mock.property(globalThis, 'Audio', class extends EventTarget {
    constructor() { super(); this.paused = true; }
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
}

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
