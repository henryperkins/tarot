import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadingJob } from '../src/worker/readingJob.js';

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
