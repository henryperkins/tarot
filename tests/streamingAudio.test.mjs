import assert from 'node:assert/strict';
import test from 'node:test';
import { streamAudioToMediaSource } from '../src/lib/streamingAudio.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); }
  assert.fail('Stream did not reach the expected state');
}

function fixture({ chunks = [[1], [2], [3]], appendFailure, secondsPerAppend = 1, stall = false } = {}) {
  const accepted = [];
  const removed = [];
  const errors = [];
  let start = 0;
  let end = 0;
  let attempts = 0;
  let pulls = 0;
  let cancelled = false;
  const buffer = Object.assign(new EventTarget(), {
    buffered: { get length() { return end > start ? 1 : 0; }, start: () => start, end: () => end },
    appendBuffer(bytes) {
      const failure = appendFailure?.(++attempts, removed.length);
      if (failure === 'decode') { queueMicrotask(() => this.dispatchEvent(new Event('error'))); return; }
      if (failure) throw new DOMException('Buffer full', failure);
      accepted.push(...bytes);
      end += secondsPerAppend;
      queueMicrotask(() => this.dispatchEvent(new Event('updateend')));
    },
    remove(_from, to) {
      removed.push(to);
      start = Math.min(end, to);
      queueMicrotask(() => this.dispatchEvent(new Event('updateend')));
    }
  });
  const mediaSource = Object.assign(new EventTarget(), {
    readyState: 'open', addSourceBuffer: () => buffer,
    endOfStream() { this.readyState = 'ended'; }
  });
  const audio = Object.assign(new EventTarget(), { currentTime: 0 });
  const controller = new AbortController();
  const response = new Response(new ReadableStream({
    pull(target) {
      if (stall) return;
      if (pulls < chunks.length) target.enqueue(new Uint8Array(chunks[pulls++]));
      else target.close();
    },
    cancel() { cancelled = true; }
  }), { headers: { 'content-type': 'audio/mpeg' } });
  const run = () => streamAudioToMediaSource(response, mediaSource, {
    signal: controller.signal, getAudio: () => audio, onError: error => errors.push(error)
  });
  const seek = time => { audio.currentTime = time; audio.dispatchEvent(new Event('timeupdate')); };
  return { run, seek, response, mediaSource, audio, controller, accepted, removed, errors,
    pulls: () => pulls, attempts: () => attempts, cancelled: () => cancelled };
}

test('buffer quota retries the same bytes after playback frees space', async () => {
  const f = fixture({ secondsPerAppend: 10, appendFailure: (attempt, removals) => attempt > 1 && !removals ? 'QuotaExceededError' : null });
  const work = f.run();
  await until(() => f.attempts() === 2);
  assert.deepEqual(f.accepted, [1]);
  f.seek(5);
  await work;
  assert.deepEqual(f.accepted, [1, 2, 3]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.mediaSource.readyState, 'ended');
  assert.equal(f.response.body.locked, false);
});

test('paused playback bounds network reads and abort releases a waiting reader', async () => {
  const f = fixture({ chunks: Array.from({ length: 50 }, (_, i) => [i]), secondsPerAppend: 30 });
  const work = f.run();
  await until(() => f.accepted.length === 2);
  await tick();
  assert.ok(f.pulls() < 5, 'the reader must backpressure a long response');
  f.seek(30);
  await until(() => f.accepted.length === 3);
  assert.ok(f.removed.length > 0, 'played data must be removed');
  f.controller.abort();
  await work;
  assert.deepEqual(f.errors, []);
  assert.equal(f.cancelled(), true);
  assert.equal(f.response.body.locked, false);
  const accepted = f.accepted.length;
  f.seek(60);
  await tick();
  assert.equal(f.accepted.length, accepted);
});

for (const failure of ['QuotaExceededError', 'InvalidStateError', 'decode']) {
  test(`unrecoverable ${failure} reports failure and cancels the stream`, async () => {
    const f = fixture({ appendFailure: () => failure });
    await f.run();
    assert.equal(f.errors.length, 1);
    assert.equal(f.cancelled(), true);
    assert.equal(f.response.body.locked, false);
    assert.notEqual(f.mediaSource.readyState, 'ended');
  });
}

test('abort before sourceopen cannot start buffering later', async () => {
  const f = fixture();
  f.mediaSource.readyState = 'closed';
  const work = f.run();
  f.controller.abort();
  await work;
  f.mediaSource.readyState = 'open';
  f.mediaSource.dispatchEvent(new Event('sourceopen'));
  await tick();
  assert.deepEqual(f.accepted, []);
  assert.deepEqual(f.errors, []);
  assert.equal(f.cancelled(), true);
  assert.equal(f.response.body.locked, false);
});

test('a player error cancels a pending network read and releases its lock', async t => {
  const f = fixture({ stall: true });
  let finished = false;
  const work = f.run().then(() => { finished = true; });
  t.after(async () => { f.controller.abort(); await work; });
  await tick();
  f.audio.dispatchEvent(new Event('error'));
  await tick();
  assert.equal(finished, true, 'decoder failure must settle even while waiting for network bytes');
  assert.equal(f.cancelled(), true);
  assert.equal(f.response.body.locked, false);
  assert.equal(f.errors.length, 1);
});
