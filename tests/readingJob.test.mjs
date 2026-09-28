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
    storage: { get: async () => null, put: async (...args) => writes.push(args) }
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
