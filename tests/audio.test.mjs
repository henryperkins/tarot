import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupAudio, initAudio, playFlip, toggleAmbience } from '../src/lib/audio.js';

const originalAudio = globalThis.Audio;
let players;
let rejectPlayback;

beforeEach(() => {
  players = [];
  rejectPlayback = false;
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
      this.paused = false;
      return rejectPlayback ? Promise.reject(new Error('Playback interrupted')) : Promise.resolve();
    }
    pause() { this.paused = true; }
  };
});

afterEach(() => {
  cleanupAudio();
  if (originalAudio === undefined) delete globalThis.Audio;
  else globalThis.Audio = originalAudio;
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
  assert.equal(player.src, '/sounds/ambience.mp3');
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
  rejectPlayback = true;
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
