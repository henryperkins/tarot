import assert from 'node:assert/strict';
import test from 'node:test';
import { createNarrationCoordinator } from '../src/lib/narrationCoordinator.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const card = text => ({ text, enabled: true, provider: 'deepgram', context: 'card-reveal', stream: false, voice: 'nova', speed: 1 });
const reading = () => ({ ...card('A complete screened reading.'), context: 'full-reading', stream: true });
function fixture() {
  const calls = [];
  const waits = [];
  const coordinator = createNarrationCoordinator({
    speak(options) {
      const previous = calls.at(-1);
      if (previous) coordinator.updateState({ status: 'stopped', reason: 'replaced', context: previous.options.context });
      let resolve;
      let reject;
      const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
      const deferred = { promise, resolve, reject };
      calls.push({ options, ...deferred });
      coordinator.updateState({ status: 'loading', context: options.context });
      return deferred.promise;
    },
    onWaiting: waiting => waits.push(waiting)
  });
  const complete = async (index, status = 'playing', extra = {}) => {
    coordinator.updateState({ status, context: calls[index].options.context, ...extra });
    calls[index].resolve();
    await tick();
  };
  return { coordinator, calls, waits, complete };
}

test('five rapid cards dispatch first and latest, with superseded promises resolved', async () => {
  const f = fixture();
  const pending = [1, 2, 3, 4, 5].map(n => f.coordinator.request(card(`Card ${n}`)));
  assert.equal(f.calls.length, 1);
  await Promise.all(pending.slice(1, 4));
  await f.complete(0);
  assert.deepEqual(f.calls.map(call => call.options.text), ['Card 1', 'Card 5']);
  await f.complete(1);
  await Promise.all(pending);
});

test('full reading replaces queued cards, deduplicates auto/manual requests and survives replacement notification', async () => {
  const f = fixture();
  const first = f.coordinator.request(card('First card'));
  const superseded = f.coordinator.request(card('Last card'));
  const full = f.coordinator.request(reading());
  const duplicate = f.coordinator.request(reading());
  await superseded;
  assert.equal(f.calls.length, 1);
  assert.equal(f.waits.at(-1), true);
  await f.complete(0);
  assert.deepEqual(f.calls.map(call => call.options.context), ['card-reveal', 'full-reading']);
  await f.complete(1);
  await f.coordinator.request(card('Ignored during playback'));
  f.coordinator.updateState({ status: 'paused', context: 'full-reading' });
  await f.coordinator.request(card('Ignored while paused'));
  assert.equal(f.calls.length, 2);
  f.coordinator.updateState({ status: 'completed', context: 'full-reading' });
  const next = f.coordinator.request(card('Next card'));
  assert.equal(f.calls.length, 3);
  await f.complete(2);
  await Promise.all([first, full, duplicate, next]);
});

for (const status of ['loading', 'playing', 'paused']) {
  test(`cards cannot interrupt a ${status} full reading even after speak promise fulfills`, async () => {
    const f = fixture();
    const full = f.coordinator.request(reading());
    if (status !== 'loading') await f.complete(0, status);
    await f.coordinator.request(card('Ignored'));
    assert.equal(f.calls.length, 1);
    f.coordinator.cancelQueued();
    f.calls[0].resolve();
    await full;
  });
}

for (const errorCode of ['NARRATION_BUSY', 'TIER_LIMIT', 'RATE_LIMIT', 'ACCOUNTING_UNAVAILABLE', 'SERVICE_ERROR', 'NARRATION_INCOMPLETE', 'PLAYBACK_ERROR', 'AUTOPLAY_ERROR']) {
  test(`a fulfilled speak reporting ${errorCode} discards pending work until a fresh request`, async () => {
    const f = fixture();
    const first = f.coordinator.request(card('First card'));
    const queued = f.coordinator.request(reading());
    await f.complete(0, 'error', { errorCode });
    await Promise.all([first, queued]);
    assert.equal(f.calls.length, 1);
    assert.equal(f.waits.at(-1), false);
    const manual = f.coordinator.request(reading());
    assert.equal(f.calls.length, 2);
    await f.complete(1);
    await manual;
  });
}

test('unlock failure and rejected speak do not drain the queue', async () => {
  for (const rejected of [false, true]) {
    const f = fixture();
    const first = f.coordinator.request(card('Card'));
    const queued = f.coordinator.request(reading());
    if (rejected) f.calls[0].reject(new Error('Synthetic provider failure'));
    else await f.complete(0, 'unlock-failed');
    await Promise.all([first, queued]);
    assert.equal(f.calls.length, 1);
    assert.equal(f.waits.at(-1), false);
  }
});

for (const reason of ['Stop', 'voice-off', 'provider change', 'reset', 'unmount']) {
  test(`${reason} invalidation cannot dispatch old queued work or a late fulfilled request`, async () => {
    const f = fixture();
    const active = f.coordinator.request(card('Old card'));
    const queued = f.coordinator.request(reading());
    f.coordinator.cancelQueued();
    f.coordinator.updateState({ status: 'playing', context: 'card-reveal' });
    f.calls[0].resolve();
    await Promise.all([active, queued]);
    await tick();
    assert.equal(f.calls.length, 1);
    assert.equal(f.waits.at(-1), false);
  });
}

test('cached card success drains without waiting for ended and captures queued options', async () => {
  const f = fixture();
  const first = f.coordinator.request(card('Cached card'));
  const options = { ...reading(), provider: 'elevenlabs', speed: 1.5 };
  const full = f.coordinator.request(options);
  options.provider = 'deepgram';
  await f.complete(0, 'playing', { cached: true });
  assert.equal(f.calls[1].options.provider, 'elevenlabs');
  assert.equal(f.calls[1].options.speed, 1.5);
  await f.complete(1);
  await Promise.all([first, full]);
});

// The production Vite targets include browsers predating Promise.withResolvers.
test('narration requests work when Promise.withResolvers is unavailable', async t => {
  const original = Object.getOwnPropertyDescriptor(Promise, 'withResolvers');
  Object.defineProperty(Promise, 'withResolvers', { configurable: true, value: undefined });
  t.after(() => Object.defineProperty(Promise, 'withResolvers', original));
  const f = fixture();
  const pending = f.coordinator.request(card('Compatible browser card'));
  assert.equal(f.calls.length, 1);
  await f.complete(0);
  await pending;
});

test('preserving active audio discards the old queue but serializes a new manual reading', async () => {
  const f = fixture();
  const first = f.coordinator.request(card('Held card'));
  const automatic = f.coordinator.request(reading());
  f.coordinator.cancelQueued({ preserveActive: true });
  await automatic;
  const manual = f.coordinator.request(reading());
  assert.equal(f.calls.length, 1, 'manual request must still wait for the held card');
  await f.complete(0);
  assert.deepEqual(f.calls.map(call => call.options.context), ['card-reveal', 'full-reading']);
  await f.complete(1);
  await Promise.all([first, manual]);
});
