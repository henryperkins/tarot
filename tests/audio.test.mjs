import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanupAudio, initAudio, playFlip, toggleAmbience } from '../src/lib/audio.js';
import { decodeMp3, measureLoop } from '../scripts/lib/audioLevels.mjs';

// Interaction listeners attach to window. This one also reports how many are
// attached, because a listener left behind is otherwise invisible.
class ListeningWindow extends EventTarget {
  #listeners = new Map();
  addEventListener(type, listener, options) {
    this.#listeners.set(type, (this.#listeners.get(type) ?? new Set()).add(listener));
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    this.#listeners.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  listening(type) { return this.#listeners.get(type)?.size ?? 0; }
}

const originalAudio = globalThis.Audio;
const originalWindow = globalThis.window;
let players;
// Returns the error a browser refuses a start with, or nothing to accept it.
let refusePlayback;
// Returns the promise of an accepted start for the test to settle, or nothing.
let delayPlayback;

beforeEach(() => {
  players = [];
  refusePlayback = null;
  delayPlayback = null;
  globalThis.window = new ListeningWindow();
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.paused = true;
      this.playCount = 0;
      players.push(this);
    }
    play() {
      this.playCount++;
      // A refused start leaves the element paused. An accepted one plays,
      // even when it is interrupted afterwards.
      const refusal = refusePlayback?.(this);
      if (refusal) return Promise.reject(refusal);
      this.paused = false;
      return delayPlayback?.(this) ?? Promise.resolve();
    }
    pause() { this.paused = true; }
  };
});

afterEach(() => {
  cleanupAudio();
  if (originalAudio === undefined) delete globalThis.Audio;
  else globalThis.Audio = originalAudio;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test('initialization and disabled ambience do not create or fetch sound players', () => {
  initAudio();
  toggleAmbience(false);
  initAudio();
  assert.deepEqual(players, []);
});

test('the first flip creates its sound on demand and subsequent flips reuse it', () => {
  initAudio();
  playFlip();
  assert.equal(players.length, 1);
  assert.equal(players[0].src, '/sounds/flip.mp3');
  players[0].currentTime = 0.5;
  playFlip();
  assert.equal(players.length, 1);
  assert.equal(players[0].playCount, 2);
  assert.equal(players[0].currentTime, 0);
});

test('ambience can start before initialization, pause, and resume the same loop', () => {
  // Preferences restore the stored setting before the initialization effect.
  toggleAmbience(true);
  assert.equal(players.length, 1);
  const player = players[0];
  assert.equal(player.src, '/sounds/ambience.mp3?v=2');
  assert.equal(player.loop, true);
  assert.equal(player.volume, 0.2);
  initAudio();
  toggleAmbience(false);
  assert.equal(player.paused, true);
  toggleAmbience(true);
  assert.equal(player.paused, false);
  assert.equal(player.playCount, 2);
  assert.equal(players.length, 1);
});

test('cleanup releases sound players and later interactions can recreate them', () => {
  playFlip();
  toggleAmbience(true);
  const firstPlayers = [...players];
  cleanupAudio();
  assert.equal(firstPlayers.length, 2);
  assert.ok(firstPlayers.every(player => player.paused));
  playFlip();
  toggleAmbience(true);
  assert.equal(players.length, 4);
  assert.ok(players.slice(2).every(player => !player.paused));
});

test('interrupted playback is handled without an unhandled promise rejection', async () => {
  delayPlayback = () => Promise.reject(new Error('Playback interrupted'));
  playFlip();
  toggleAmbience(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(players.length, 2);
});

test('sound actions safely do nothing when the browser Audio API is unavailable', () => {
  delete globalThis.Audio;
  assert.doesNotThrow(() => {
    initAudio();
    playFlip();
    toggleAmbience(true);
    toggleAmbience(false);
  });
});

// --- Ambience start, autoplay denial and gesture retry ------------------------

const autoplayDenied = () => new DOMException("play() failed because the user didn't interact with the document first.", 'NotAllowedError');
const settle = () => new Promise(resolve => setImmediate(resolve));
const gesture = (type = 'click') => globalThis.window.dispatchEvent(new Event(type));
// How many listeners wait for each interaction that can start the loop.
const waitingFor = () => ['click', 'touchend', 'keydown'].map(type => globalThis.window.listening(type));

// A blocked start followed by the given interaction, on one player.
async function blockedStart() {
  refusePlayback = autoplayDenied;
  toggleAmbience(true);
  await settle();
  refusePlayback = null;
  return players.at(-1);
}

for (const type of ['click', 'touchend', 'keydown']) {
  test(`a blocked ambience start plays the same loop on the next ${type}`, async () => {
    const player = await blockedStart();
    assert.equal(player.paused, true, 'a refused start must not look like playback');
    assert.deepEqual(waitingFor(), [1, 1, 1]);
    gesture(type);
    assert.equal(player.playCount, 2, 'the retry must call play() inside the interaction');
    assert.equal(player.paused, false);
    assert.equal(players.length, 1);
  });
}

test('a started ambience loop stops listening for interactions', async () => {
  const player = await blockedStart();
  gesture();
  await settle();
  assert.deepEqual(waitingFor(), [0, 0, 0]);
  gesture();
  gesture('keydown');
  assert.equal(player.playCount, 2);
});

test('an interaction the browser still refuses keeps the ambience retry for the next one', async () => {
  refusePlayback = autoplayDenied;
  toggleAmbience(true);
  await settle();
  const player = players.at(-1);
  gesture('keydown');
  await settle();
  assert.equal(player.paused, true);
  assert.deepEqual(waitingFor(), [1, 1, 1], 'still waiting, without a second set of listeners');
  refusePlayback = null;
  gesture('click');
  assert.equal(player.playCount, 3);
  assert.equal(player.paused, false);
});

test('turning ambience off before any interaction cancels the pending start', async () => {
  const player = await blockedStart();
  toggleAmbience(false);
  assert.deepEqual(waitingFor(), [0, 0, 0]);
  gesture();
  gesture('keydown');
  assert.equal(player.playCount, 1);
  assert.equal(player.paused, true);
});

test('a refusal that lands after ambience was turned off does not wait for an interaction', async () => {
  refusePlayback = autoplayDenied;
  toggleAmbience(true);
  // The refusal is delivered asynchronously; Off gets in first.
  toggleAmbience(false);
  await settle();
  refusePlayback = null;
  gesture();
  assert.equal(players.at(-1).playCount, 1);
});

test('rapid off and on leaves one playing loop and ignores the interrupted start', async () => {
  const interrupted = Promise.withResolvers();
  let starts = 0;
  delayPlayback = () => (++starts === 1 ? interrupted.promise : null);
  toggleAmbience(true);
  toggleAmbience(false);
  toggleAmbience(true);
  interrupted.reject(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
  await settle();
  const [player] = players;
  assert.equal(players.length, 1);
  assert.equal(player.paused, false);
  gesture();
  assert.equal(player.playCount, 2, 'an interrupted start is not an autoplay denial');
});

test('a refusal from an earlier start cannot re-arm the retry once a later start is playing', async () => {
  const earlier = Promise.withResolvers();
  let starts = 0;
  delayPlayback = () => (++starts === 1 ? earlier.promise : null);
  toggleAmbience(true);
  toggleAmbience(false);
  toggleAmbience(true);
  await settle();
  earlier.reject(autoplayDenied());
  await settle();
  const [player] = players;
  assert.deepEqual(waitingFor(), [0, 0, 0]);
  gesture();
  assert.equal(player.playCount, 2);
  assert.equal(player.paused, false);
});

test('a start that settles late cannot cancel the retry a later start is waiting on', async () => {
  const earlier = Promise.withResolvers();
  let starts = 0;
  delayPlayback = () => (++starts === 1 ? earlier.promise : null);
  toggleAmbience(true);
  toggleAmbience(false);
  refusePlayback = autoplayDenied;
  toggleAmbience(true);
  await settle();
  earlier.resolve();
  await settle();
  refusePlayback = null;
  assert.deepEqual(waitingFor(), [1, 1, 1]);
  gesture();
  assert.equal(players[0].paused, false);
});

for (const name of ['AbortError', 'NotSupportedError']) {
  test(`a start that fails with ${name} is not retried on later interactions`, async () => {
    refusePlayback = () => new DOMException('The element has no supported sources.', name);
    toggleAmbience(true);
    await settle();
    refusePlayback = null;
    gesture();
    gesture('keydown');
    assert.equal(players.at(-1).playCount, 1);
  });
}

test('cleanup drops a pending ambience start and a remount retries once on its own loop', async () => {
  const first = await blockedStart();
  cleanupAudio();
  assert.deepEqual(waitingFor(), [0, 0, 0]);
  gesture();
  assert.equal(first.playCount, 1, 'a released loop must not start');
  const second = await blockedStart();
  assert.notEqual(second, first);
  assert.deepEqual(waitingFor(), [1, 1, 1]);
  gesture();
  assert.equal(second.playCount, 2, 'one interaction, one retry');
  assert.equal(first.playCount, 1);
  assert.equal(second.paused, false);
});

test('the ambience retry does not depend on the narration unlock listeners', async () => {
  const audio = await import('../src/lib/audio.js?unlocked-before-ambience');
  try {
    audio.initAudio();
    gesture();
    await settle();
    // The silent unlock clip has played and its listeners are gone.
    const unlockClips = players.length;
    refusePlayback = autoplayDenied;
    audio.toggleAmbience(true);
    await settle();
    refusePlayback = null;
    const player = players.at(-1);
    gesture();
    assert.equal(players.length, unlockClips + 1, 'no further unlock clip is needed');
    assert.equal(player.playCount, 2);
    assert.equal(player.paused, false);
  } finally {
    audio.cleanupAudio();
  }
});

// The mix plays at about -44 dBFS RMS (20 Hz-20 kHz) once the player applies
// its base volume. Three decibels either way keeps it audible on small
// speakers and at least 15 dB under narration at the loudest reading swell.
// The track this replaced played at -66.5 dBFS, nearly all of it below 20 Hz.
const AMBIENCE_PLAYED_DBFS = -44;
const AMBIENCE_TOLERANCE_DB = 3;
let decodedAmbience;

// Measures the file the player requests, at the volume the player sets.
async function playedAmbience() {
  toggleAmbience(true);
  const player = players.at(-1);
  const file = new URL(`../public${new URL(player.src, 'https://tableu.test').pathname}`, import.meta.url);
  decodedAmbience ??= decodeMp3(new Uint8Array(await readFile(file))).then(({ samples, sampleRate }) => measureLoop(samples, sampleRate));
  const loop = await decodedAmbience;
  return { loop, playedDbfs: loop.audibleDbfs + 20 * Math.log10(player.volume) };
}

test('the ambience loop is audible at the volume the player sets', async () => {
  const { playedDbfs } = await playedAmbience();
  assert.ok(Math.abs(playedDbfs - AMBIENCE_PLAYED_DBFS) <= AMBIENCE_TOLERANCE_DB,
    `20 Hz-20 kHz content plays at ${playedDbfs.toFixed(1)} dBFS RMS; expected ${AMBIENCE_PLAYED_DBFS} within ${AMBIENCE_TOLERANCE_DB} dB`);
});

test('the ambience loop carries no subsonic energy or DC offset', async () => {
  const { loop } = await playedAmbience();
  assert.ok(loop.subsonicShare < 0.01, `${(loop.subsonicShare * 100).toFixed(2)}% of the energy is below 20 Hz`);
  assert.ok(Math.abs(loop.dcOffset) < 0.001, `DC offset is ${loop.dcOffset.toFixed(4)}`);
});

test('the ambience loop restarts at the level it ends on', async () => {
  const { loop } = await playedAmbience();
  for (const [edge, level] of [['first', loop.headDbfs], ['last', loop.tailDbfs]]) {
    assert.ok(Math.abs(level - loop.audibleDbfs) <= 6,
      `the ${edge} 20 ms sit at ${level.toFixed(1)} dBFS against ${loop.audibleDbfs.toFixed(1)} dBFS for the loop`);
  }
  assert.ok(loop.joinStep <= 5 * loop.typicalStep,
    `the join steps ${loop.joinStep.toExponential(2)} against a typical ${loop.typicalStep.toExponential(2)}`);
});
