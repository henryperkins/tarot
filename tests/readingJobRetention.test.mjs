import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFakeReadingJobs, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { MAX_IDS_PER_REQUEST, onRequestPost as retention } from '../functions/api/admin/reading-job-retention.js';
import { JOB_TTL_MS, MCP_JOB_TTL_MS } from '../src/worker/readingJob.js';
import { SPREADS } from '../src/data/spreads.js';

const TOKEN = 'purge-token';
const PAYLOAD = {
  spreadInfo: { name: SPREADS.single.name, key: 'single' },
  cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }]
};
const objectId = (n) => n.toString(16).padStart(64, '0');

async function startJob(jobs, id, { principal } = {}) {
  const response = await jobs.namespace.get(id).fetch('https://reading-jobs/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Job-Token': `token-${id}` },
    body: JSON.stringify({ jobId: id, payload: PAYLOAD, ...(principal ? { principal: { userId: principal }, snapshot: null } : {}) })
  });
  assert.equal(response.status, 200);
}

function call(env, { ids = [objectId(1)], token = TOKEN } = {}) {
  return retention({
    request: new Request('https://example.com/api/admin/reading-jobs/retention', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    }),
    env
  });
}

describe('POST /api/admin/reading-jobs/retention', () => {
  it('is inert unless its token is configured, and refuses a wrong token', async () => {
    const jobs = createFakeReadingJobs({ runReading: readingRunner() });
    const unset = await call({ READING_JOBS: jobs.namespace });
    const wrong = await call({ READING_JOBS: jobs.namespace, READING_JOB_PURGE_TOKEN: TOKEN }, { token: 'guess' });
    assert.deepEqual([unset.status, wrong.status], [404, 401]);
    assert.equal(jobs.instances.size, 0, 'no job was touched');
  });

  it('takes only 1 to 100 Durable Object ids', async () => {
    const env = { READING_JOBS: createFakeReadingJobs().namespace, READING_JOB_PURGE_TOKEN: TOKEN };
    const tooMany = Array.from({ length: MAX_IDS_PER_REQUEST + 1 }, (_, index) => objectId(index + 1));
    for (const ids of [[], ['job-1'], [objectId(0xabc).toUpperCase()], tooMany]) {
      assert.equal((await call(env, { ids })).status, 400);
    }
  });

  it('deletes jobs past their retention, schedules the rest, and returns only counts', async () => {
    const jobs = createFakeReadingJobs({ runReading: readingRunner({ reading: 'Private narrative.' }) });
    const env = { READING_JOBS: jobs.namespace, READING_JOB_PURGE_TOKEN: TOKEN };
    const [expiredMcp, expiredApp, staleRun, current, empty] = [1, 2, 3, 4, 5].map(objectId);
    await startJob(jobs, expiredMcp, { principal: 'user-1' });
    await startJob(jobs, expiredApp);
    await startJob(jobs, staleRun, { principal: 'user-1' });
    await startJob(jobs, current, { principal: 'user-1' });
    await jobs.settle();

    // As stored before deletion alarms: no alarm, and no startedAt.
    for (const id of [expiredMcp, expiredApp, staleRun, current]) {
      const { state, object } = jobs.instances.get(id);
      state.alarm.at = null;
      object.deletionScheduledAt = null;
      delete object.job.startedAt;
    }
    const job = (id) => jobs.instances.get(id).object.job;
    job(expiredMcp).expiresAt = Date.now() - 1;
    job(expiredApp).expiresAt = Date.now() - JOB_TTL_MS;
    Object.assign(job(staleRun), { status: 'running', expiresAt: null, createdAt: Date.now() - MCP_JOB_TTL_MS - 1 });

    const response = await call(env, { ids: [expiredMcp, expiredApp, staleRun, current, empty] });
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(text), { purged: 4, scheduled: 1, failed: 0 });
    assert.doesNotMatch(text, /Private narrative/);
    for (const id of [expiredMcp, expiredApp, staleRun, empty]) {
      assert.equal(jobs.instances.get(id).state.stored.size, 0, id);
    }
    assert.equal(jobs.instances.get(current).state.stored.size, 1);
    assert.equal(jobs.instances.get(current).state.alarm.at, job(current).expiresAt);
  });

  it('counts a job it cannot reach as failed', async () => {
    const jobs = createFakeReadingJobs({ runReading: readingRunner() });
    const unreachable = objectId(9);
    const namespace = {
      ...jobs.namespace,
      idFromString(id) {
        if (id === unreachable) throw new TypeError('Invalid Durable Object ID');
        return id;
      }
    };
    const response = await call({ READING_JOBS: namespace, READING_JOB_PURGE_TOKEN: TOKEN }, { ids: [unreachable, objectId(10)] });
    assert.deepEqual(await response.json(), { purged: 1, scheduled: 0, failed: 1 });
  });
});
