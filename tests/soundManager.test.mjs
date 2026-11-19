import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import { SoundManager } from '../src/lib/SoundManager.js';
import { decodeMp3 } from '../scripts/lib/audioLevels.mjs';

// Enough of Web Audio for the manager to synthesize its cues.
class FakeParam {
  value = 0;
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  gain = new FakeParam();
  connect() {}
}
class FakeOscillator extends FakeNode {
  frequency = new FakeParam();
  sounding = false;
  start() { this.sounding = true; }
  // A time schedules the end of a one-shot cue; without one it ends now.
  stop(when) {
    if (when > 0) return;
    this.sounding = false;
    this.onended?.();
  }
}
class FakeContext {
  state = 'running';
  currentTime = 0;
  destination = new FakeNode();
  oscillators = [];
  createGain() { return new FakeNode(); }
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  // Exercise the synthesized fallback when the device cannot decode the file.
  decodeAudioData() { return Promise.reject(new Error('Unable to decode audio data')); }
  resume() { return Promise.resolve(); }
}

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
// The reading's ambient bed, as the scene shell asks for it.
const AMBIENT = ['narrative-ambient', { essential: false, loop: true, restart: false }];
const sounding = manager => manager.context.oscillators.filter(oscillator => oscillator.sounding).length;

beforeEach(() => {
  globalThis.window = { AudioContext: FakeContext };
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
  mock.method(console, 'warn', () => {});
});

afterEach(() => {
  mock.restoreAll();
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalFetch === undefined) delete globalThis.fetch;
  else globalThis.fetch = originalFetch;
});

test('a loop asked to keep going is not started a second time', async () => {
  const manager = new SoundManager();
  await manager.play(...AMBIENT);
  // The reading moves from the interlude to the narrative and asks again.
  await manager.play(...AMBIENT);
  assert.equal(sounding(manager), 1);
  manager.stop('narrative-ambient');
  assert.equal(sounding(manager), 0, 'stop must silence everything that was started');
});

test('two starts made before the sound has loaded still make one loop', async () => {
  const manager = new SoundManager();
  await Promise.all([manager.play(...AMBIENT), manager.play(...AMBIENT)]);
  assert.equal(sounding(manager), 1);
  manager.stop('narrative-ambient');
  assert.equal(sounding(manager), 0);
});

test('stop cancels a loop that is still loading', async () => {
  const manager = new SoundManager();
  const starting = manager.play(...AMBIENT);
  manager.stop('narrative-ambient');
  await starting;
  assert.equal(sounding(manager), 0);
});

test('a stopped loop can be started again', async () => {
  const manager = new SoundManager();
  await manager.play(...AMBIENT);
  manager.stop('narrative-ambient');
  await manager.play(...AMBIENT);
  assert.equal(sounding(manager), 1);
});

test('a one-shot cue played twice restarts instead of overlapping', async () => {
  const manager = new SoundManager();
  await manager.play('flip');
  await manager.play('flip');
  assert.equal(manager.context.oscillators.length, 2);
  assert.equal(sounding(manager), 1);
});

test('two plays of a one-shot cue made together sound once', async () => {
  const manager = new SoundManager();
  await Promise.all([manager.play('flip'), manager.play('flip')]);
  assert.equal(sounding(manager), 1);
});

test('muting stops active cues and cancels pending starts even after a quick unmute', async () => {
  const manager = new SoundManager();
  await manager.play(...AMBIENT);
  const pending = manager.play('shuffle');
  manager.mute(true);
  assert.equal(await manager.play('deal'), null);
  manager.mute(false);
  assert.equal(await pending, null);
  assert.equal(sounding(manager), 0);
  await manager.play('deal');
  assert.equal(sounding(manager), 1);
});

describe('scheduled table cues', () => {
  test('a component can cancel one timer and stop can cancel all timers for one cue', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const manager = new SoundManager();
    const played = [];
    t.mock.method(manager, 'play', name => played.push(name));
    const cancel = manager.schedule('flip', 10);
    manager.schedule('flip', 20);
    manager.schedule('deal', 30);
    manager.schedule('deal', 40);
    cancel();
    manager.stop('deal');
    t.mock.timers.tick(50);
    assert.deepEqual(played, ['flip']);
  });

  test('muting discards scheduled cues and sounds requested while muted', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const manager = new SoundManager();
    const played = [];
    t.mock.method(manager, 'play', name => played.push(name));
    manager.schedule('deal', 90);
    manager.mute();
    manager.schedule('shuffle', 40);
    manager.mute(false);
    manager.schedule('knock', 20);
    t.mock.timers.tick(100);
    assert.deepEqual(played, ['knock']);
  });

  test('leaving the table stops active, scheduled and loading cues and permits the next reading', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const manager = new SoundManager();
    await manager.play('flip');
    await manager.play(...AMBIENT);
    const pending = manager.play('deal');
    manager.schedule('shuffle', 90);
    manager.stopAll();
    t.mock.timers.tick(100);
    assert.equal(await pending, null);
    assert.equal(sounding(manager), 0);
    assert.equal(manager.context.oscillators.length, 2);
    await manager.play('deal');
    assert.equal(sounding(manager), 1);
  });
});

test('the versioned table sprite decodes and contains sound at every published cue offset', async () => {
  const manager = new SoundManager();
  const assets = new URL('../public/audio/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('cinematic-sprite.json', assets), 'utf8'));
  assert.equal(manager.spriteUrl, `/audio/${manifest.file}`);
  assert.deepEqual(Object.keys(manifest.cues).sort(), Object.keys(manager.spriteMap).sort());
  const { samples, sampleRate } = await decodeMp3(await readFile(new URL(manifest.file.split('?')[0], assets)));
  for (const [name, cue] of Object.entries(manifest.cues)) {
    const { start, duration } = manager.spriteMap[name];
    assert.equal(cue.start, start);
    assert.equal(cue.duration, duration);
    const end = Math.round((start + duration) * sampleRate);
    assert.ok(end <= samples.length, name);
    const clip = samples.subarray(Math.round(start * sampleRate), end);
    const meanSquare = clip.reduce((sum, sample) => sum + sample * sample, 0) / clip.length;
    assert.ok(meanSquare > 0.00001, `${name} is silent`);
    if (name === 'narrative-ambient') {
      const room = await decodeMp3(await readFile(new URL('../sounds/ambience.mp3', assets)));
      const roomPower = room.samples.reduce((sum, sample) => sum + sample * sample, 0) / room.samples.length;
      assert.ok(meanSquare * manager.spriteMap[name].volume ** 2 < roomPower * 0.2 ** 2, 'the sustained reading tone should sit below the room at its base volume');
    }
  }
});

test('the sprite falls back once during an outage and retries on demand after reconnecting', async () => {
  globalThis.window = Object.assign(new EventTarget(), { AudioContext: FakeContext });
  let requests = 0;
  globalThis.fetch = async () => ({ ok: ++requests > 1, status: 503, arrayBuffer: async () => new ArrayBuffer(8) });
  const manager = new SoundManager();
  await manager.play('shuffle');
  await manager.play('deal');
  assert.equal(requests, 1);
  assert.equal(sounding(manager), 2);
  manager.mute(true);
  globalThis.window.dispatchEvent(new Event('online'));
  assert.equal(requests, 1, 'reconnecting while muted must not fetch any sound');
  manager.mute(false);
  const decoded = { duration: 11.2 };
  manager.context.decodeAudioData = async () => decoded;
  assert.equal(await manager.preload(), decoded);
  assert.equal(requests, 2);
});

test('a reconnect before the sprite download fails leaves the next enabled cue retryable', async () => {
  globalThis.window = Object.assign(new EventTarget(), { AudioContext: FakeContext });
  const download = Promise.withResolvers();
  const decoded = { duration: 11.2 };
  let requests = 0;
  globalThis.fetch = async () => ++requests === 1
    ? download.promise
    : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  const manager = new SoundManager();
  const pending = manager.play('shuffle');
  manager.mute();
  globalThis.window.dispatchEvent(new Event('online'));
  download.reject(new Error('Connection lost during download'));
  assert.equal(await pending, null);
  assert.equal(await manager.play('deal'), null);
  assert.equal(requests, 1, 'reconnecting or requesting a muted cue must not fetch');
  manager.mute(false);
  manager.context.decodeAudioData = async () => decoded;
  const buffers = await Promise.all([manager.preload(), manager.preload()]);
  assert.deepEqual(buffers, [decoded, decoded]);
  assert.equal(requests, 2, 'concurrent requests share the retry');
});
