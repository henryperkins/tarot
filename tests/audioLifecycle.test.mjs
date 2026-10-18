import assert from 'node:assert/strict';
import test from 'node:test';

const deferred = () => Promise.withResolvers();
const tick = () => new Promise(resolve => setImmediate(resolve));

async function setup(t, { quota = Infinity, play } = {}) {
  const players = [];
  const storage = Object.create(null);
  Object.defineProperties(storage, {
    getItem: { value(key) { return storage[key] ?? null; } },
    setItem: { value(key, value) {
      const size = Object.entries(storage).reduce((total, [k, v]) => total + (k === key ? 0 : v.length), 0) + String(value).length;
      if (size > quota) throw new DOMException('Storage full', 'QuotaExceededError');
      storage[key] = String(value);
    } },
    removeItem: { value(key) { delete storage[key]; } }
  });
  const globals = {
    localStorage: storage,
    window: { localStorage: storage, addEventListener() {}, removeEventListener() {} },
    MediaSource: undefined,
    Audio: class extends EventTarget {
      constructor(src) { super(); this.src = src; this.paused = true; this.ended = false; players.push(this); }
      play() { this.paused = false; return play?.(this) ?? Promise.resolve(); }
      pause() { this.paused = true; this.onPause?.(); this.dispatchEvent(new Event('pause')); }
    }
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  const audio = await import(`../src/lib/audio.js?lifecycle=${encodeURIComponent(t.name)}`);
  t.after(() => audio.cleanupAudio());
  return { audio, players, storage };
}

async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.fail('Playback did not reach the expected state');
}

const narration = { text: 'A complete personal reading.', enabled: true, context: 'full-reading', stream: true };
const mp3 = () => new Response('MP3 fixture bytes', { headers: { 'content-type': 'audio/mpeg' } });

test('reset aborts pending full-reading speech and ignores its late response', async t => {
  const { audio, players } = await setup(t);
  const response = deferred();
  let signal;
  t.mock.method(globalThis, 'fetch', (_url, options) => { signal = options.signal; return response.promise; });
  const pending = audio.speakText(narration);
  audio.resetTTSStream();
  response.resolve(mp3());
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(players.length, 0, 'a reset reading must never start playback');
  assert.equal(audio.getCurrentTTSState().status, 'idle');
});

test('reset clears playing narration instead of leaving an unresumable paused state', async t => {
  const { audio, players } = await setup(t);
  t.mock.method(globalThis, 'fetch', async () => mp3());
  await audio.speakText(narration);
  const player = players.at(-1);
  audio.resetTTSStream();
  await audio.resumeTTS();
  assert.equal(player.paused, true);
  assert.equal(audio.getCurrentTTSState().status, 'idle');
  assert.equal(audio.getCurrentTTSState().context, null);
});

test('a replaced play rejection cannot cancel the newer card narration', async t => {
  const waiting = deferred();
  const { audio, players } = await setup(t, { play(player) {
    if (player.src.endsWith('T0xE')) {
      player.onPause = () => waiting.reject(new DOMException('Playback interrupted', 'AbortError'));
      return waiting.promise;
    }
  } });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    audio: `data:audio/mpeg;base64,${++calls === 1 ? 'T0xE' : 'TkVX'}`, provider: 'elevenlabs'
  }));
  const first = audio.speakText({ text: 'First card.', enabled: true });
  await until(() => players.some(player => player.src.endsWith('T0xE')));
  const second = audio.speakText({ text: 'Second card.', enabled: true });
  await Promise.all([first, second]);
  assert.equal(audio.getCurrentTTSState().status, 'playing');
  assert.ok(players.some(player => player.src.endsWith('TkVX') && !player.paused));
});

test('a stale resume rejection cannot replace the new narration state', async t => {
  const waiting = deferred();
  let resuming = false;
  const { audio } = await setup(t, { play(player) {
    if (resuming && player.src.endsWith('T0xE')) return waiting.promise;
  } });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    audio: `data:audio/mpeg;base64,${++calls === 1 ? 'T0xE' : 'TkVX'}`, provider: 'elevenlabs'
  }));
  await audio.speakText({ text: 'First reading.', enabled: true });
  audio.pauseTTS();
  resuming = true;
  const resume = audio.resumeTTS();
  await audio.speakText({ text: 'Next reading.', enabled: true });
  waiting.reject(new DOMException('Playback interrupted', 'AbortError'));
  await resume;
  assert.equal(audio.getCurrentTTSState().status, 'playing');
  assert.equal(audio.getCurrentTTSState().error, null);
});

test('an older audio unlock failure cannot overwrite a replacement narration', async t => {
  const waiting = deferred();
  let unlocks = 0;
  const { audio } = await setup(t, { play(player) {
    if (player.src.startsWith('data:audio/mp3') && ++unlocks === 1) return waiting.promise;
  } });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json({ audio: 'data:audio/mpeg;base64,TkVX', provider: 'elevenlabs' }));
  const first = audio.speakText({ text: 'Old reading.', enabled: true });
  await until(() => unlocks === 1);
  await audio.speakText({ text: 'Replacement reading.', enabled: true });
  waiting.reject(new DOMException('User interaction needed', 'NotAllowedError'));
  await first;
  assert.equal(audio.getCurrentTTSState().status, 'playing');
});

test('a standalone card unlock failure cannot overwrite the narration started after it', async t => {
  const waiting = deferred();
  let unlocks = 0;
  const { audio } = await setup(t, { play(player) {
    if (player.src.startsWith('data:audio/mp3') && ++unlocks === 1) return waiting.promise;
  } });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json({ audio: 'data:audio/mpeg;base64,TkVX', provider: 'elevenlabs' }));
  const unlock = audio.unlockAudio();
  await audio.speakText({ text: 'The next card.', enabled: true, context: 'card-reveal' });
  waiting.reject(new DOMException('User interaction needed', 'NotAllowedError'));
  await unlock;
  assert.equal(audio.getCurrentTTSState().status, 'playing');
});

test('storage quota evicts old narration and caches the next card without deleting preferences', async t => {
  const { audio, storage } = await setup(t, { quota: 1200 });
  storage.setItem('tarot-voice-enabled', 'true');
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ audio: `data:audio/mpeg;base64,${'A'.repeat(400)}`, provider: 'elevenlabs' });
  });
  for (const text of ['First card.', 'Second card.', 'Third card.', 'Third card.']) {
    await audio.speakText({ text, enabled: true, context: 'card-reveal' });
  }
  assert.equal(calls, 3, 'replaying the third card must reuse the recovered cache');
  assert.equal(audio.getCurrentTTSState().source, 'cache');
  assert.equal(storage.getItem('tarot-voice-enabled'), 'true');
});
