import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFakeReadingJobs, hangingRunner, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { jsonRequest } from './helpers/journalFixtures.mjs';
import { cancelMcpJob, getMcpJobSnapshot, startReadingJob } from '../functions/lib/readingJobs.js';
import { onRequestPost as publicStart } from '../functions/api/tarot-reading-job-start.js';
import { onRequestGet as publicStatus } from '../functions/api/tarot-reading-job-status.js';
import { onRequestGet as publicStream } from '../functions/api/tarot-reading-job-stream.js';
import { onRequestPost as publicCancel } from '../functions/api/tarot-reading-job-cancel.js';
import { JOB_TTL_MS, MCP_JOB_TTL_MS } from '../src/worker/readingJob.js';
import { SPREADS } from '../src/data/spreads.js';

const PAYLOAD = {
  spreadInfo: { name: SPREADS.single.name, key: 'single' },
  cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }]
};

const SNAPSHOT = {
  spreadInfo: { name: SPREADS.single.name, key: 'single' },
  cardsInfo: [{
    position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope',
    number: 17, suit: null, rank: null, rankValue: null
  }],
  userQuestion: null,
  deckStyle: 'rws-1909',
  personalization: null,
  seed: null
};

function environment(runReading) {
  const jobs = createFakeReadingJobs({ runReading });
  return { jobs, env: { READING_JOBS: jobs.namespace } };
}

function publicCall(handler, env, { jobId, jobToken, method = 'GET', path = '' }) {
  return handler({
    request: new Request(`https://example.com/api/tarot-reading/jobs/${jobId}${path}`, { method, headers: { 'X-Job-Token': jobToken } }),
    env,
    params: { id: jobId }
  });
}

describe('startReadingJob with a principal', () => {
  it('runs the reading as the principal and forwards no request credentials', async () => {
    const calls = [];
    const { jobs, env } = environment(readingRunner({ calls }));

    const started = await startReadingJob({
      env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT,
      forwardHeaders: { authorization: 'Bearer must-not-leak', cookie: 'session=must-not-leak' }
    });
    await jobs.settle();

    assert.equal(started.ok, true);
    assert.deepEqual(calls[0].principal, { userId: 'user-1' });
    assert.equal(calls[0].request.headers.get('Authorization'), null);
    assert.equal(calls[0].request.headers.get('Cookie'), null);
  });

  it('keeps app jobs on forwarded request credentials', async () => {
    const calls = [];
    const { jobs, env } = environment(readingRunner({ calls }));

    await startReadingJob({ env, payload: PAYLOAD, forwardHeaders: { authorization: 'Bearer app-user' } });
    await jobs.settle();

    assert.equal(calls[0].principal, undefined);
    assert.equal(calls[0].request.headers.get('Authorization'), 'Bearer app-user');
  });

  it('serves the snapshot, result and themes to the owning principal', async () => {
    const { jobs, env } = environment(readingRunner({ reading: 'Hope returns.', requestId: 'req-42' }));
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();

    const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-1' });

    assert.equal(result.ok, true);
    assert.equal(result.data.status, 'complete');
    assert.deepEqual(result.data.snapshot, SNAPSHOT);
    assert.equal(result.data.result.reading, 'Hope returns.');
    assert.equal(result.data.result.requestId, 'req-42');
    assert.deepEqual(result.data.meta.themes, { dominantSuit: 'Cups' });
  });

  it('answers the same 404 for a wrong token or another principal', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();

    const wrongToken = await getMcpJobSnapshot({ env, jobId, jobToken: 'nope', userId: 'user-1' });
    const wrongUser = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-2' });
    assert.deepEqual([wrongToken.status, wrongUser.status], [404, 404]);
    assert.equal(wrongToken.error, wrongUser.error);
  });

  it('rejects an invalid payload before creating a job', async () => {
    const { jobs, env } = environment(readingRunner());
    const result = await startReadingJob({ env, payload: { spreadInfo: {} }, principal: { userId: 'user-1' } });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(jobs.instances.size, 0);
  });

  it('answers 503 when reading jobs are not configured', async () => {
    const result = await startReadingJob({ env: {}, payload: PAYLOAD });
    assert.deepEqual(result, { ok: false, status: 503, error: 'Reading jobs not configured.' });
  });
});

describe('public job routes', () => {
  it('hide principal jobs from status, stream and cancel, even with the right token', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();

    const status = await publicCall(publicStatus, env, { jobId, jobToken });
    const stream = await publicCall(publicStream, env, { jobId, jobToken, path: '/stream' });
    const cancel = await publicCall(publicCancel, env, { jobId, jobToken, method: 'POST', path: '/cancel' });

    assert.deepEqual([status.status, stream.status, cancel.status], [404, 404, 404]);
    const still = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-1' });
    assert.equal(still.data.status, 'complete', 'the public cancel must not touch the job');
  });

  it('keep working for app jobs', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, forwardHeaders: {} });
    await jobs.settle();

    const status = await publicCall(publicStatus, env, { jobId, jobToken });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).status, 'complete');
  });

  it('never let a request body smuggle a principal through the public start route', async () => {
    const calls = [];
    const { jobs, env } = environment(readingRunner({ calls }));

    const response = await publicStart({
      request: jsonRequest('https://example.com/api/tarot-reading/jobs', { body: { ...PAYLOAD, principal: { userId: 'user-1' } } }),
      env
    });
    await jobs.settle();

    assert.equal(response.status, 200);
    assert.equal(calls[0].principal, undefined);
    const { jobId, jobToken } = await response.json();
    assert.equal((await publicCall(publicStatus, env, { jobId, jobToken })).status, 200);
  });
});

describe('retention and cancellation', () => {
  it('keeps MCP jobs for 24 hours and app jobs for 1 hour after they finish', async () => {
    const { jobs, env } = environment(readingRunner());
    const mcp = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    const app = await startReadingJob({ env, payload: PAYLOAD, forwardHeaders: {} });
    await jobs.settle();

    const remaining = (jobId) => jobs.instances.get(jobId).object.job.expiresAt - Date.now();
    assert.ok(Math.abs(remaining(mcp.jobId) - MCP_JOB_TTL_MS) < 5000);
    assert.ok(Math.abs(remaining(app.jobId) - JOB_TTL_MS) < 5000);
  });

  it('cancels a running MCP job, and leaves a finished one intact', async () => {
    const { jobs, env } = environment(hangingRunner());
    const running = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });

    const cancelled = await cancelMcpJob({ env, jobId: running.jobId, jobToken: running.jobToken, userId: 'user-1' });
    await jobs.settle();
    assert.deepEqual(cancelled, { ok: true, data: { status: 'cancelled' } });
    const after = await getMcpJobSnapshot({ env, jobId: running.jobId, jobToken: running.jobToken, userId: 'user-1' });
    assert.equal(after.data.status, 'error');
    assert.equal(after.data.error, 'Reading cancelled.');

    const done = environment(readingRunner());
    const finished = await startReadingJob({ env: done.env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await done.jobs.settle();
    const noop = await cancelMcpJob({ env: done.env, jobId: finished.jobId, jobToken: finished.jobToken, userId: 'user-1' });
    assert.deepEqual(noop, { ok: true, data: { status: 'complete' } });
  });

  it('reports an expired MCP job as 410', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();
    jobs.instances.get(jobId).object.job.expiresAt = Date.now() - 1;

    const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-1' });
    assert.deepEqual([result.ok, result.status], [false, 410]);
  });
});
