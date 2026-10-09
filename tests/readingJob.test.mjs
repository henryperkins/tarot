import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadingJob } from '../src/worker/readingJob.js';
import { readReadingJobEvents } from '../src/lib/readingJobStream.js';

test('resuming after metadata restores attribution through the real stream client without replaying text', async (t) => {
  const { job, reader } = await createJob(t);
  await reader.cancel();
  const sourceUsage = { spreadCards: { used: true, requested: true } };
  job.appendEvent('meta', { provider: 'test', sourceUsage });
  job.appendEvent('delta', { text: 'Partial text.' });
  job.appendEvent('done', { fullText: 'Complete text.' });
  t.mock.method(globalThis, 'fetch', (url, options) => job.fetch(new Request(`https://jobs/stream?cursor=${new URL(url, 'https://jobs').searchParams.get('cursor')}`, options)));
  const events = [];
  for await (const event of readReadingJobEvents({ jobId: 'job-1', jobToken: 'secret', cursor: 2 })) events.push(event);
  assert.deepEqual(events.map(event => event.event), ['meta', 'done']);
  assert.deepEqual(events[0].data.sourceUsage, sourceUsage);
});

async function createJob(t) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const writes = [];
  const job = new ReadingJob({
    blockConcurrencyWhile: (callback) => callback(),
    storage: { get: async () => null, put: async (...args) => writes.push(args), setAlarm: async () => {} }
  }, {});
  await job.initialized;
  Object.assign(job.job, { jobId: 'job-1', token: 'secret', status: 'running' });
  t.after(() => job.closeSubscribers());
  const response = await job.fetch(new Request('https://jobs/stream', {
    headers: { 'X-Job-Token': 'secret' }
  }));
  return { job, writes, reader: response.body.getReader() };
}

test('quiet jobs send immediate and periodic SSE comments without advancing replay or storage', async (t) => {
  const { job, writes, reader } = await createJob(t);
  const subscriber = [...job.subscribers][0];
  assert.ok(subscriber.controller.desiredSize <= 0, 'connection must immediately send bytes');
  assert.match(new TextDecoder().decode((await reader.read()).value), /^:/);
  t.mock.timers.tick(15000);
  assert.ok(subscriber.controller.desiredSize <= 0, 'quiet connection must send a heartbeat');
  assert.match(new TextDecoder().decode((await reader.read()).value), /^:/);
  assert.equal(job.nextEventId, 1);
  assert.deepEqual(job.events, []);
  assert.deepEqual(writes, []);
  await reader.cancel();
  assert.equal(job.subscribers.size, 0);
  assert.equal(subscriber.heartbeat, null);
  t.mock.timers.tick(30000);
  assert.deepEqual(writes, []);
});

for (const terminal of ['done', 'error']) {
  test(`${terminal} closes heartbeat subscribers and is replayable`, async (t) => {
    const { job, reader } = await createJob(t);
    const subscriber = [...job.subscribers][0];
    job.appendEvent(terminal, terminal === 'done' ? { fullText: 'A reading.' } : { message: 'Failed.' });
    assert.equal(job.subscribers.size, 0);
    assert.equal(subscriber.heartbeat, null);
    t.mock.timers.tick(30000);
    let text = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += new TextDecoder().decode(chunk.value);
    }
    assert.match(text, new RegExp(`event: ${terminal}`));
    const replay = await job.fetch(new Request('https://jobs/stream?cursor=1', {
      headers: { 'X-Job-Token': 'secret' }
    }));
    assert.match(await replay.text(), new RegExp(`event: ${terminal}`));
    assert.equal(job.nextEventId, 2);
  });
}

test('held fake annotation promise does not block narrative deltas or done', async () => {
  const writes = [];
  const observedSnapshots = [];
  let resolveFakeAnnotation;
  const fakeAnnotationPromise = new Promise(resolve => { resolveFakeAnnotation = resolve; });

  const fakeVisualStub = {
    fetch: async (url, options) => {
      observedSnapshots.push(JSON.parse(options.body));
      // Hold annotation promise unresolved during narrative delivery
      return fakeAnnotationPromise.then(() => new Response(JSON.stringify({ ok: true })));
    }
  };

  const env = {
    READING_VISUAL_JOBS: {
      get: () => fakeVisualStub,
      idFromName: () => 'stub-id'
    }
  };

  const job = new ReadingJob({
    blockConcurrencyWhile: (callback) => callback(),
    storage: { get: async () => null, put: async (...args) => writes.push(args), setAlarm: async () => {} },
    waitUntil: () => {}
  }, env);
  await job.initialized;

  const visualBinding = {
    readingResultId: 'res-test-1',
    sourceRevision: 0,
    spreadHash: '0000000000000000000000000000000000000000000000000000000000000001',
    contextHash: '0000000000000000000000000000000000000000000000000000000000000002',
    artworkEdition: 'rws-immanuelle-vector',
    catalogVersion: 'v1'
  };

  await job.handleStart(new Request('https://jobs/start', {
    method: 'POST',
    headers: { 'X-Job-Token': 'tok-123' },
    body: JSON.stringify({
      jobId: 'job-1',
      payload: { cards: [{ name: 'The Star' }] },
      visualBinding
    })
  }));

  // Append deltas while fakeAnnotationPromise is still unresolved
  job.appendEvent('delta', { text: 'Sentence one. ' });
  job.appendEvent('delta', { text: 'Sentence two. ' });
  job.appendEvent('done', { fullText: 'Sentence one. Sentence two. Final.' });

  // Job reached complete status without waiting for visual annotation
  assert.equal(job.job.status, 'complete');
  assert.equal(job.textSoFar, 'Sentence one. Sentence two. Final.');
  assert.equal(observedSnapshots.length, 3);
  assert.equal(observedSnapshots[2].complete, true);

  resolveFakeAnnotation();
});

test('non-prefix final replacement increments visualBinding sourceRevision', async () => {
  const writes = [];
  const observedSnapshots = [];

  const fakeVisualStub = {
    fetch: async (url, options) => {
      observedSnapshots.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: true }));
    }
  };

  const env = {
    READING_VISUAL_JOBS: {
      get: () => fakeVisualStub,
      idFromName: () => 'stub-id'
    }
  };

  const job = new ReadingJob({
    blockConcurrencyWhile: (callback) => callback(),
    storage: { get: async () => null, put: async (...args) => writes.push(args), setAlarm: async () => {} },
    waitUntil: () => {}
  }, env);
  await job.initialized;

  const visualBinding = {
    readingResultId: 'res-replace-1',
    sourceRevision: 0,
    spreadHash: '0000000000000000000000000000000000000000000000000000000000000001',
    contextHash: '0000000000000000000000000000000000000000000000000000000000000002',
    artworkEdition: 'rws-immanuelle-vector',
    catalogVersion: 'v1'
  };

  await job.handleStart(new Request('https://jobs/start', {
    method: 'POST',
    headers: { 'X-Job-Token': 'tok-123' },
    body: JSON.stringify({
      jobId: 'job-1',
      payload: { cards: [{ name: 'The Star' }] },
      visualBinding
    })
  }));

  job.appendEvent('delta', { text: 'Delivered initial prose.' });
  // Final replacement: e.g. safe-fallback text that does NOT start with textSoFar
  job.appendEvent('done', { fullText: 'Safe fallback substitution that replaces previous prose.' });

  assert.equal(job.visualBinding.sourceRevision, 1);
  assert.equal(observedSnapshots[1].binding.sourceRevision, 1);
});
