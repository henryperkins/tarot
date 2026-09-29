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
const SUPPLIED = Object.freeze([
  { position: 'Past', card: 'The Hermit', orientation: 'Upright', meaning: 'Solitude' },
  { position: 'Present', card: 'Three of Cups', orientation: 'Reversed', meaning: 'Excess' },
  { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'Hope' }
]);

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

  it('refuses a reversal lens outside the supported keys before any job starts', async () => {
    const { call, jobs } = await session();
    // The prose override that the 2026-09-29 connected-tool audit (F01) saw
    // accepted and silently read through a different lens.
    const prose = 'Read reversals as an internalized or blocked expression, not a fixed outcome.';
    const started = await call('start_tarot_reading', { spreadInfo: THREE, cardsInfo: SUPPLIED, reversalFrameworkOverride: prose });
    const drawn = await call('draw_tarot_reading', { spreadInfo: THREE, reversalFrameworkOverride: prose });
    for (const result of [started, drawn]) {
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /Input validation error/);
    }
    assert.equal(jobs.instances.size, 0);
  });

  it('passes a supported reversal lens to the reading and lists the lenses in the schema', async () => {
    const calls = [];
    const { client, call, jobs } = await session({ runReading: readingRunner({ calls }) });
    await call('start_tarot_reading', { spreadInfo: THREE, cardsInfo: SUPPLIED, reversalFrameworkOverride: 'internalized' });
    await jobs.settle();
    assert.equal(JSON.parse(await calls[0].request.text()).reversalFrameworkOverride, 'internalized');

    const { tools } = await client.listTools();
    for (const name of ['draw_tarot_reading', 'start_tarot_reading']) {
      const lens = tools.find((tool) => tool.name === name).inputSchema.properties.reversalFrameworkOverride;
      assert.deepEqual(lens.enum, ['blocked', 'delayed', 'internalized', 'contextual', 'shadow', 'mirror', 'potentialBlocked'], name);
    }
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

  it('follows a job by jobId alone, and ignores the deprecated jobToken', async () => {
    const { call, jobs } = await session();
    const drawn = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();
    assert.equal(typeof drawn.jobToken, 'string', 'still returned for clients of the submitted contract');

    const waited = await call('wait_for_tarot_reading', { jobId: drawn.jobId });
    const legacy = await call('get_tarot_reading_status', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    const stale = await call('get_tarot_reading_status', { jobId: drawn.jobId, jobToken: 'not-the-token' });
    for (const result of [waited, legacy, stale]) assert.equal(result.structuredContent.status, 'complete');
    assert.doesNotMatch(waited.content[0].text, /jobToken/);
  });

  it('returns the narrative with a bounded theme summary and no provider', async () => {
    const themes = {
      dominantSuit: 'Cups', dominantElement: 'Water', majorCount: 2, reversalCount: 1, reversalFramework: 'blocked',
      suitFocus: 'long prose', knowledgeGraph: { patterns: ['large'] }, suitCounts: { Cups: 2 }
    };
    const { call, jobs } = await session({ runReading: readingRunner({ themes }) });
    const { jobId } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();

    const { structuredContent } = await call('wait_for_tarot_reading', { jobId });
    assert.deepEqual(structuredContent.themes, {
      dominantSuit: 'Cups', dominantElement: 'Water', majorCount: 2, reversalCount: 1, reversalFramework: 'blocked'
    });
    assert.equal('provider' in structuredContent, false);
  });

  it('advertises jobId as the only required job reference', async () => {
    const { client } = await session();
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    for (const name of ['wait_for_tarot_reading', 'get_tarot_reading_status', 'cancel_tarot_reading', 'save_reading_to_journal']) {
      const { required, properties } = byName[name].inputSchema;
      assert.ok(required.includes('jobId'), name);
      assert.equal(required.includes('jobToken'), false, name);
      assert.match(properties.jobToken.description, /Deprecated and ignored/, name);
    }
    for (const name of ['draw_tarot_reading', 'start_tarot_reading']) {
      assert.equal(byName[name].outputSchema.required.includes('jobToken'), false, name);
    }
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

/** A reading runner that answers with the given SSE events. */
function sseRunner(events) {
  return async () => new Response(
    events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''),
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  );
}

describe('what a finished job delivered', () => {
  async function finish(runReading) {
    const { call, jobs } = await session({ runReading });
    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();
    return call('wait_for_tarot_reading', { jobId, jobToken });
  }

  it('returns a crisis response as a support message, never as a reading', async () => {
    const waited = await finish(readingRunner({ reading: 'Please reach out to someone you trust.', provider: 'safety-gate', gateReason: 'crisis_gate' }));
    const { structuredContent: status, content } = waited;

    assert.equal(status.status, 'complete');
    assert.equal(status.reading, undefined);
    assert.equal(status.supportMessage, 'Please reach out to someone you trust.');
    assert.equal(status.gateBlocked, true);
    assert.equal(status.gateReason, 'crisis_gate');
    assert.doesNotMatch(content[0].text, /Present the narrative/);
    assert.match(content[0].text, /Set the cards aside/);
  });

  it('withholds a narrative that the safety check replaced', async () => {
    const waited = await finish(readingRunner({ reading: '## A Moment of Reflection', provider: 'safe-fallback', gateReason: 'safety_flag_true' }));
    const { structuredContent: status, content } = waited;

    assert.equal(status.status, 'complete');
    assert.equal(status.reading, undefined);
    assert.equal(status.supportMessage, undefined);
    assert.deepEqual([status.gateBlocked, status.gateReason], [true, 'safety_flag_true']);
    assert.doesNotMatch(content[0].text, /Present the narrative/);
    assert.match(content[0].text, /held back this reading/);
  });

  it('fails closed on a gate reason it does not know', async () => {
    const { structuredContent: status } = await finish(readingRunner({ reading: 'Text.', gateReason: 'new_gate' }));
    assert.equal(status.reading, undefined);
    assert.equal(status.gateBlocked, true);
  });

  it('presents a reading whose first streamed draft failed the quality gate', async () => {
    const waited = await finish(readingRunner({ reading: 'A vetted reading.', provider: 'azure-gpt5', gateReason: 'quality_gate_streaming' }));
    assert.equal(waited.structuredContent.reading, 'A vetted reading.');
    assert.equal(waited.structuredContent.gateBlocked, undefined);
    assert.match(waited.content[0].text, /Present the narrative/);
  });

  it('reports a job that finished without any text as failed', async () => {
    const waited = await finish(sseRunner([['done', { fullText: '', provider: 'modal-qwen', requestId: 'req-empty' }]]));
    assert.equal(waited.structuredContent.status, 'error');
    assert.equal(waited.structuredContent.reading, undefined);
    assert.equal(waited.content[0].text, 'The reading failed: The reading finished without any text.');
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
    const cancelTool = tools.find((tool) => tool.name === 'cancel_tarot_reading');
    assert.equal(cancelTool.annotations.destructiveHint, true);
    // ChatGPT shows this static text for every outcome, including this one.
    assert.doesNotMatch(cancelTool._meta['openai/toolInvocation/invoked'], /cancelled/i);

    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();
    const result = await call('cancel_tarot_reading', { jobId, jobToken });
    assert.equal(result.structuredContent.status, 'complete');
    assert.match(result.content[0].text, /already finished/);
  });
});
