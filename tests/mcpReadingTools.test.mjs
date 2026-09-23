import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { connectMcpClient } from './helpers/mcpClient.mjs';
import { createFakeReadingJobs, hangingRunner, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { SPREADS } from '../src/data/spreads.js';

const OWNER = Object.freeze({
  id: 'user-1', username: 'henry', subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session'
});
const OTHER = Object.freeze({ ...OWNER, id: 'user-2', username: 'guest' });
const THREE = { name: SPREADS.threeCard.name, key: 'threeCard' };

const open = [];
after(async () => {
  await Promise.all(open.map((connection) => connection.close()));
});

/** A clock whose sleep advances time instantly, so waits finish at once. */
function fastClock() {
  let current = 1_000_000;
  return { now: () => current, sleep: async (ms) => { current += ms; } };
}

async function session({ runReading = readingRunner(), user = OWNER, jobs } = {}) {
  const shared = jobs ?? createFakeReadingJobs({ runReading });
  const env = { READING_JOBS: shared.namespace };
  const connection = await connectMcpClient({ env, user, ...fastClock() });
  open.push(connection);
  const call = (name, args) => connection.client.callTool({ name, arguments: args });
  return { client: connection.client, call, jobs: shared };
}

describe('draw_tarot_reading', () => {
  it('returns the drawn cards at once, and the narrative after waiting', async () => {
    const { call, jobs } = await session({ runReading: readingRunner({ reading: 'Patience, then momentum.', requestId: 'req-7' }) });
    const drawn = await call('draw_tarot_reading', { spreadInfo: THREE, userQuestion: 'What should I focus on?', seed: 'rose' });

    assert.equal(drawn.isError, undefined);
    const { jobId, jobToken, status, cardsInfo, seed, spreadInfo, deckStyle } = drawn.structuredContent;
    assert.equal(status, 'running');
    assert.deepEqual(cardsInfo.map((card) => card.position), SPREADS.threeCard.positions);
    assert.match(seed, /^\d+$/);
    assert.deepEqual(spreadInfo, { name: SPREADS.threeCard.name, key: 'threeCard' });
    assert.equal(deckStyle, 'rws-1909');
    assert.match(drawn.content[0].text, /call wait_for_tarot_reading/);

    await jobs.settle();
    const waited = await call('wait_for_tarot_reading', { jobId, jobToken });
    assert.equal(waited.structuredContent.status, 'complete');
    assert.equal(waited.structuredContent.reading, 'Patience, then momentum.');
    assert.equal(waited.structuredContent.requestId, 'req-7');
    assert.deepEqual(waited.structuredContent.cardsInfo, cardsInfo);
    assert.deepEqual(waited.structuredContent.themes, { dominantSuit: 'Cups' });
  });

  it('draws the same cards for the same seed', async () => {
    const { call } = await session();
    const first = await call('draw_tarot_reading', { spreadInfo: THREE, seed: 'rose' });
    const second = await call('draw_tarot_reading', { spreadInfo: THREE, seed: 'rose' });
    const replay = await call('draw_tarot_reading', { spreadInfo: THREE, seed: first.structuredContent.seed });
    assert.deepEqual(first.structuredContent.cardsInfo, second.structuredContent.cardsInfo);
    assert.equal(first.structuredContent.seed, second.structuredContent.seed);
    assert.deepEqual(replay.structuredContent.cardsInfo, first.structuredContent.cardsInfo, 'the returned seed replays cards and orientations');
    assert.equal(replay.structuredContent.seed, first.structuredContent.seed);
  });

  it('accepts the uint32 boundaries and rejects invalid decimal replay seeds before starting a job', async () => {
    const { call, jobs } = await session();
    const zero = await call('draw_tarot_reading', { spreadInfo: THREE, seed: '0' });
    const max = await call('draw_tarot_reading', { spreadInfo: THREE, seed: '4294967295' });
    assert.equal(zero.isError, undefined);
    assert.match(zero.structuredContent.seed, /^\d+$/);
    assert.equal(max.structuredContent.seed, '4294967295');

    const started = jobs.instances.size;
    for (const seed of ['-1', '1.5', '4294967296']) {
      const invalid = await call('draw_tarot_reading', { spreadInfo: THREE, seed });
      assert.equal(invalid.isError, true, seed);
      assert.match(invalid.content[0].text, /unsigned 32-bit decimal integer/);
      assert.equal(jobs.instances.size, started, 'invalid seeds do not start jobs');
    }
  });

  it('runs the reading as the signed-in user, with no request credentials', async () => {
    const calls = [];
    const { call, jobs } = await session({ runReading: readingRunner({ calls }) });
    await call('draw_tarot_reading', { spreadInfo: THREE, deckStyle: 'thoth-a1' });
    await jobs.settle();

    assert.deepEqual(calls[0].principal, { userId: 'user-1' });
    assert.equal(calls[0].request.headers.get('Authorization'), null);
    assert.equal(JSON.parse(await calls[0].request.text()).deckStyle, 'thoth-a1');
  });

  it('rejects a spread outside the six keys before drawing', async () => {
    const { call, jobs } = await session();
    const result = await call('draw_tarot_reading', { spreadInfo: { name: 'Mine', key: 'custom' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Input validation error/);
    assert.equal(jobs.instances.size, 0);
  });
});

describe('start_tarot_reading', () => {
  it('starts from supplied cards and normalizes orientation', async () => {
    const { call, jobs } = await session();
    const started = await call('start_tarot_reading', {
      spreadInfo: THREE,
      cardsInfo: [
        { position: 'Past', card: 'The Hermit', orientation: 'upright', meaning: 'Solitude' },
        { position: 'Present', card: 'Three of Cups', orientation: 'reversed', meaning: 'Excess' },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'Hope' }
      ]
    });
    assert.equal(started.structuredContent.status, 'running');
    await jobs.settle();

    const { structuredContent } = await call('get_tarot_reading_status', {
      jobId: started.structuredContent.jobId, jobToken: started.structuredContent.jobToken
    });
    assert.equal(structuredContent.status, 'complete');
    assert.deepEqual(structuredContent.cardsInfo[1], {
      position: 'Present', card: 'Three of Cups', orientation: 'Reversed', meaning: 'Excess',
      number: null, suit: 'Cups', rank: 'Three', rankValue: 3
    });
  });

  it('refuses an unknown card before any job starts', async () => {
    const { call, jobs } = await session();
    const result = await call('start_tarot_reading', {
      spreadInfo: THREE,
      cardsInfo: [{ position: 'Past', card: 'The Unicorn', orientation: 'Upright', meaning: 'x' }]
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Not started: cardsInfo\[0\]/);
    assert.equal(jobs.instances.size, 0);
  });
});

describe('waiting and status', () => {
  it('returns running with timedOut instead of blocking past the timeout', async () => {
    const { call, jobs } = await session({ runReading: hangingRunner() });
    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;

    const waited = await call('wait_for_tarot_reading', { jobId, jobToken, timeoutSeconds: 3 });

    assert.equal(waited.structuredContent.status, 'running');
    assert.equal(waited.structuredContent.timedOut, true);
    assert.match(waited.content[0].text, /call wait_for_tarot_reading again/);
    assert.equal(jobs.instances.size, 1, 'no second job was started');
  });

  it('rejects a timeout above 45 seconds', async () => {
    const { call } = await session();
    const result = await call('wait_for_tarot_reading', { jobId: 'a', jobToken: 'b', timeoutSeconds: 46 });
    assert.equal(result.isError, true);
  });

  it("hides another user's job", async () => {
    const jobs = createFakeReadingJobs({ runReading: readingRunner() });
    const owner = await session({ jobs });
    const other = await session({ jobs, user: OTHER });
    const { jobId, jobToken } = (await owner.call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();

    const peek = await other.call('get_tarot_reading_status', { jobId, jobToken });
    assert.equal(peek.isError, true);
    assert.equal(peek.content[0].text, 'Reading job not found.');
  });

  it('reports a failed reading as an error status', async () => {
    const { call, jobs } = await session({
      runReading: readingRunner({ status: 403, reading: 'The "Celtic Cross" spread requires an active Plus subscription' })
    });
    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();

    const { structuredContent } = await call('get_tarot_reading_status', { jobId, jobToken });
    assert.equal(structuredContent.status, 'error');
    assert.match(structuredContent.error, /Plus subscription/);
  });
});

describe('cancel_tarot_reading', () => {
  it('cancels a running reading', async () => {
    const { call, jobs } = await session({ runReading: hangingRunner() });
    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;

    const cancelled = await call('cancel_tarot_reading', { jobId, jobToken });
    await jobs.settle();

    assert.deepEqual(cancelled.structuredContent, { jobId, status: 'cancelled' });
    const { structuredContent } = await call('get_tarot_reading_status', { jobId, jobToken });
    assert.equal(structuredContent.error, 'Reading cancelled.');
  });

  it('is marked destructive and leaves a finished reading intact', async () => {
    const { client, call, jobs } = await session();
    const { tools } = await client.listTools();
    assert.equal(tools.find((tool) => tool.name === 'cancel_tarot_reading').annotations.destructiveHint, true);

    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();
    const result = await call('cancel_tarot_reading', { jobId, jobToken });
    assert.equal(result.structuredContent.status, 'complete');
    assert.match(result.content[0].text, /already finished/);
  });
});
