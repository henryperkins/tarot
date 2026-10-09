import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startReadingJob } from '../functions/lib/readingJobs.js';
import { ReadingVisualJob } from '../src/worker/readingVisualJob.js';
import { observeDeliveredReading } from '../functions/lib/visualCueObserver.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const PAYLOAD = {
  spreadInfo: { name: 'One Card', key: 'single' },
  cardsInfo: [{ card: 'The Star', position: 'Present', orientation: 'Upright', meaning: 'Hope', userReflection: null }],
  userQuestion: 'Where can I find hope?', deckStyle: 'rws-1909'
};
const configured = {
  VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/visual',
  AI: { run: async () => ({ response: { proposals: [] } }) }
};

for (const [name, overrides] of [
  ['missing', {}],
  ['provider only', { VISUAL_CUE_PROVIDER: 'workers-ai' }],
  ['model only', { VISUAL_CUE_MODEL: '@cf/controlled/visual' }],
  ['blank model', { ...configured, VISUAL_CUE_MODEL: '   ' }],
  ['unsupported provider', { ...configured, VISUAL_CUE_PROVIDER: 'narrative' }],
  ['missing AI binding', { ...configured, AI: undefined }],
  ['non-callable AI binding', { ...configured, AI: { run: true } }],
  ['missing visual job binding', { ...configured, READING_VISUAL_JOBS: undefined }]
]) {
  test(`${name} visual configuration starts narrative without visual state, hashing or database work`, async t => {
    let started;
    let databaseCalls = 0;
    let visualCalls = 0;
    let backgroundCalls = 0;
    let digestCalls = 0;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    t.mock.method(crypto.subtle, 'digest', (...args) => { digestCalls++; return digest(...args); });
    const env = {
      READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async (_url, options) => {
        started = JSON.parse(options.body);
        return Response.json({ ok: true });
      } }) },
      READING_VISUAL_JOBS: { idFromName: id => id, get: () => { visualCalls++; return { fetch: async () => Response.json({ ok: true }) }; } },
      DB: { prepare: () => { databaseCalls++; throw new Error('Visual storage must remain untouched'); } },
      ...overrides
    };
    const result = await startReadingJob({ env, payload: PAYLOAD, waitUntil: () => { backgroundCalls++; } });
    assert.equal(result.ok, true);
    assert.deepEqual(started.payload, { ...PAYLOAD, cardsInfo: [{ ...PAYLOAD.cardsInfo[0], aliases: [] }] });
    assert.equal(started.visualBinding, null);
    assert.equal(started.visualInit, null);
    assert.equal(started.visualJobToken, null);
    assert.equal(result.visualBinding, null);
    assert.equal(result.visualJobToken, null);
    assert.equal(databaseCalls, 0);
    assert.equal(visualCalls, 0);
    assert.equal(backgroundCalls, 0);
    assert.equal(digestCalls, 0);
  });
}

test('configured visual jobs retain independent initialization, delivered prose and annotation', async t => {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  const tasks = [];
  let started;
  let modelCalls = 0;
  const env = { ...configured, DB: db,
    AI: { run: async (model, request) => {
      assert.equal(model, '@cf/controlled/visual');
      assert.ok(request.messages[1].content.includes('The Star offers hope.'));
      modelCalls++;
      return { response: { proposals: [] } };
    } },
    READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async (_url, options) => {
      started = JSON.parse(options.body);
      return Response.json({ ok: true });
    } }) }
  };
  const state = { blockConcurrencyWhile: callback => callback(),
    storage: { get: async () => null, put: async () => {}, setAlarm: async () => {} },
    waitUntil: promise => tasks.push(promise) };
  const visual = new ReadingVisualJob(state, env);
  env.READING_VISUAL_JOBS = { idFromName: id => id, get: () => ({ fetch: (url, options) => visual.fetch(new Request(url, options)) }) };
  const result = await startReadingJob({ env, payload: PAYLOAD, waitUntil: promise => tasks.push(promise) });
  assert.equal(result.ok, true);
  assert.equal(result.visualBinding.readingResultId, result.readingResultId);
  assert.ok(result.visualJobToken);
  assert.equal(started.visualInit.visualToken, result.visualJobToken);
  await Promise.all(tasks);
  assert.equal(visual.status, 'running');
  const observed = await observeDeliveredReading({ env, binding: result.visualBinding,
    raw: 'The Star offers hope.', deliveredEventId: 1, complete: true });
  assert.equal(observed.ok, true);
  await Promise.all(tasks);
  const row = await db.prepare('SELECT * FROM reading_visual_results WHERE id = ?').bind(result.readingResultId).first();
  assert.equal(row.observed_raw, 'The Star offers hope.');
  assert.equal(row.final_raw, 'The Star offers hope.');
  assert.equal(row.status, 'complete');
  assert.equal(modelCalls, 1);
});
