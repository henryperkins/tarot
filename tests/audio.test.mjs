import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanupAudio, getAmbienceError, initAudio, playFlip, subscribeToAmbience, swellAmbience, toggleAmbience } from '../src/lib/audio.js';
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
const originalRequestFrame = globalThis.requestAnimationFrame;
const originalCancelFrame = globalThis.cancelAnimationFrame;
let players;
// Animation frames run only when a test asks: a hidden tab gets none, while
// its timers keep firing.
let frames;
let frameId = 0;
// Returns the error a browser refuses a start with, or nothing to accept it.
let refusePlayback;
// Returns the promise of an accepted start for the test to settle, or nothing.
let delayPlayback;

beforeEach(() => {
  players = [];
  refusePlayback = null;
  delayPlayback = null;
  frames = new Map();
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => { frames.delete(id); };
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
  if (originalRequestFrame === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = originalRequestFrame;
  if (originalCancelFrame === undefined) delete globalThis.cancelAnimationFrame;
  else globalThis.cancelAnimationFrame = originalCancelFrame;
});

test('initialization and disabled ambience do not create or fetch sound players', () => {
  initAudio();
  toggleAmbience(false);
  initAudio();
  assert.deepEqual(players, []);
});

test('flips follow Table Ambience, load on demand, and stop on mute', () => {
  initAudio();
  playFlip();
  assert.deepEqual(players, []);
  toggleAmbience(true);
  playFlip();
  const flip = players[1];
  assert.equal(flip.src, '/sounds/flip.mp3');
  flip.currentTime = 0.5;
  playFlip();
  assert.equal(players.length, 2);
  assert.equal(flip.playCount, 2);
  assert.equal(flip.currentTime, 0);
  toggleAmbience(false);
  assert.equal(flip.paused, true);
  playFlip();
  assert.equal(flip.playCount, 2);
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
  toggleAmbience(true);
  playFlip();
  const firstPlayers = [...players];
  cleanupAudio();
  assert.equal(firstPlayers.length, 2);
  assert.ok(firstPlayers.every(player => player.paused));
  toggleAmbience(true);
  playFlip();
  assert.equal(players.length, 4);
  assert.ok(players.slice(2).every(player => !player.paused));
});

test('interrupted playback is handled without an unhandled promise rejection', async () => {
  delayPlayback = () => Promise.reject(new Error('Playback interrupted'));
  toggleAmbience(true);
  playFlip();
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

// --- Ambience turned on from another tab --------------------------------------

test('ambience turned on from another tab neither loads nor plays until this tab is interacted with', async () => {
  toggleAmbience(true, { waitForInteraction: true });
  await settle();
  assert.deepEqual(players, [], 'a background tab must not fetch or start the loop');
  assert.deepEqual(waitingFor(), [1, 1, 1]);
  gesture();
  assert.equal(players.length, 1);
  assert.equal(players[0].src, '/sounds/ambience.mp3?v=2');
  assert.equal(players[0].loop, true);
  assert.equal(players[0].volume, 0.2);
  assert.equal(players[0].paused, false);
  await settle();
  assert.deepEqual(waitingFor(), [0, 0, 0]);
});

test('turning ambience off cancels a start that was waiting for this tab to be interacted with', async () => {
  toggleAmbience(true, { waitForInteraction: true });
  toggleAmbience(false);
  assert.deepEqual(waitingFor(), [0, 0, 0]);
  gesture();
  gesture('keydown');
  assert.deepEqual(players, []);
});

test('a paused loop turned on from another tab resumes only on an interaction', async () => {
  toggleAmbience(true);
  toggleAmbience(false);
  const [player] = players;
  toggleAmbience(true, { waitForInteraction: true });
  await settle();
  assert.equal(player.paused, true);
  assert.equal(player.playCount, 1);
  gesture('touchend');
  assert.equal(player.paused, false);
  assert.equal(players.length, 1);
});

test('a loop that is already playing does not wait for an interaction', async () => {
  toggleAmbience(true);
  await settle();
  toggleAmbience(true, { waitForInteraction: true });
  assert.deepEqual(waitingFor(), [0, 0, 0]);
  gesture();
  assert.equal(players[0].playCount, 1);
});

// --- A loop whose file failed to load -----------------------------------------

// What a browser leaves behind when the file cannot be fetched: the element
// keeps an error, and every later play() on it is rejected.
const loadFailure = player => {
  player.error = { code: 4 };
  return new DOMException('The element has no supported sources.', 'NotSupportedError');
};
// The network is back: only an element that already failed is still refused.
const onlyBrokenLoopsFail = player => (player.error ? loadFailure(player) : null);

test('a failed loop reports its state and retries once when the connection returns', async () => {
  const changes = [];
  const unsubscribe = subscribeToAmbience(() => changes.push(getAmbienceError()));
  try {
    refusePlayback = loadFailure;
    toggleAmbience(true);
    await settle();
    assert.match(getAmbienceError(), /background loop/i);
    assert.equal(globalThis.window.listening('online'), 1);
    gesture();
    assert.equal(players.length, 1);
    refusePlayback = onlyBrokenLoopsFail;
    gesture('online');
    await settle();
    assert.equal(players.length, 2);
    assert.equal(players[1].paused, false);
    assert.equal(getAmbienceError(), null);
    assert.equal(changes.at(-1), null);
    assert.equal(globalThis.window.listening('online'), 0);
    gesture('online');
    assert.equal(players[1].playCount, 1);
  } finally {
    unsubscribe();
  }
});

test('a mid-playback error can recover and late media events cannot revive a muted or released loop', async () => {
  toggleAmbience(true);
  await settle();
  const [first] = players;
  const staleError = first.onerror;
  first.error = { code: 2 };
  first.onerror();
  assert.ok(getAmbienceError());
  gesture('online');
  await settle();
  staleError();
  assert.equal(getAmbienceError(), null);
  const secondError = players[1].onerror;
  secondError();
  toggleAmbience(false);
  secondError();
  gesture('online');
  assert.equal(getAmbienceError(), null);
  assert.equal(players.length, 2);
  toggleAmbience(true);
  await settle();
  const lateError = players.at(-1).onerror;
  cleanupAudio();
  lateError();
  assert.equal(globalThis.window.listening('online'), 0);
  assert.equal(getAmbienceError(), null);
});

test('a reconnect that arrives before the outstanding play promise rejects still retries once', async () => {
  const first = Promise.withResolvers();
  delayPlayback = player => player === players[0] ? first.promise : null;
  toggleAmbience(true);
  gesture('online');
  first.reject(loadFailure(players[0]));
  await settle();
  assert.equal(players.length, 2);
  assert.equal(players[0].paused, true);
  assert.equal(players[1].playCount, 1);
  assert.equal(getAmbienceError(), null);
});

test('a remote On in a quiet tab waits for a local gesture even if the network returns', async () => {
  toggleAmbience(true, { waitForInteraction: true });
  gesture('online');
  playFlip();
  assert.deepEqual(players, []);
  gesture('keydown');
  playFlip();
  assert.equal(players.length, 2);
  assert.equal(players[1].src, '/sounds/flip.mp3');
});

test('a loop whose file failed to load is replaced the next time ambience is switched on', async () => {
  refusePlayback = loadFailure;
  toggleAmbience(true);
  await settle();
  const [broken] = players;
  toggleAmbience(false);
  refusePlayback = onlyBrokenLoopsFail;
  toggleAmbience(true);
  assert.equal(players.length, 2, 'a loop that cannot play must not be reused');
  assert.equal(broken.playCount, 1);
  const loop = players[1];
  assert.equal(loop.src, '/sounds/ambience.mp3?v=2');
  assert.equal(loop.loop, true);
  assert.equal(loop.volume, 0.2);
  assert.equal(loop.paused, false);
});

test('a saved preference whose file failed to load starts a new loop on the next interaction', async () => {
  // The start was refused for lack of an interaction; then the file failed to load.
  const broken = await blockedStart();
  broken.error = { code: 4 };
  refusePlayback = onlyBrokenLoopsFail;
  gesture();
  assert.equal(players.length, 2);
  assert.equal(broken.playCount, 1, 'the broken loop is not tried again');
  assert.equal(players[1].paused, false);
  await settle();
  assert.deepEqual(waitingFor(), [0, 0, 0]);
});

test('a restored On gets one gesture retry when the network error arrives before an autoplay refusal', async () => {
  refusePlayback = loadFailure;
  toggleAmbience(true, { restored: true });
  await settle();
  gesture('keydown');
  await settle();
  assert.equal(players.length, 2);
  assert.deepEqual(waitingFor(), [0, 0, 0]);
  gesture();
  assert.equal(players.length, 2);
  refusePlayback = onlyBrokenLoopsFail;
  gesture('online');
  await settle();
  assert.equal(players[2].paused, false);
});

test('ambience turned on from another tab waits for an interaction when the loop here failed to load', async () => {
  refusePlayback = loadFailure;
  toggleAmbience(true);
  await settle();
  // A browser reports a loop that failed this way as not paused.
  players[0].paused = false;
  refusePlayback = onlyBrokenLoopsFail;
  toggleAmbience(true, { waitForInteraction: true });
  assert.deepEqual(waitingFor(), [1, 1, 1]);
  gesture();
  assert.equal(players.length, 2);
  assert.equal(players[1].paused, false);
});

// --- Swells under a reading ---------------------------------------------------

// Runs the waiting animation frame as it would be `ms` from now.
const runFrame = ms => {
  const waiting = [...frames.values()];
  frames.clear();
  for (const callback of waiting) callback(performance.now() + ms);
};
const near = (actual, expected) => Math.abs(actual - expected) < 1e-9;

test('muting a failed loop mid-swell cancels its frames and releases its timer', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  toggleAmbience(true);
  await settle();
  const [first] = players;
  swellAmbience({ peak: 0.36 });
  runFrame(90);
  first.error = { code: 2 };
  first.onerror();
  toggleAmbience(false);
  t.mock.timers.tick(200);
  assert.equal(frames.size, 0);
  assert.equal(first.volume, 0.2);
  toggleAmbience(true);
  assert.equal(players[1].volume, 0.2);
});

test('a swell raises the loop and brings it back to its base volume', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  toggleAmbience(true);
  const [player] = players;
  swellAmbience({ peak: 0.36 });
  runFrame(1000);
  assert.ok(near(player.volume, 0.36), `the swell peaked at ${player.volume}`);
  t.mock.timers.tick(200);
  runFrame(1000);
  assert.ok(near(player.volume, 0.2), `the loop settled at ${player.volume}`);
});

test('a swell cut short while the tab is hidden still settles on the base volume', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  toggleAmbience(true);
  const [player] = players;
  swellAmbience({ peak: 0.36 });
  runFrame(90);
  assert.ok(player.volume > 0.25 && player.volume < 0.36, `the swell is part-way up at ${player.volume}`);
  // The tab is hidden: frames stop and timers keep firing. The reading reaches
  // another beat before the reader comes back.
  t.mock.timers.tick(200);
  swellAmbience({ peak: 0.3 });
  t.mock.timers.tick(200);
  runFrame(5000);
  assert.ok(near(player.volume, 0.2), `the loop settled at ${player.volume}`);
});

// The mix plays at about -44 dBFS RMS (20 Hz-20 kHz) once the player applies
// its base volume. The three-decibel tolerance is set around that target, not
// around a listening-tested mix: retune both constants when the mix changes.
// Narration level was not measured. If it sits near -20 dBFS RMS, the loudest
// mix this allows stays about 16 dB under it at the loudest reading swell.
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
