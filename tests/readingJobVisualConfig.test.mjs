import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startReadingJob } from '../functions/lib/readingJobs.js';
import { ReadingVisualJob } from '../src/worker/readingVisualJob.js';
import { observeDeliveredReading } from '../functions/lib/visualCueObserver.js';
import { getVisualInitialReadiness } from '../functions/lib/readingVisualAdmission.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { initialVisualLimits, withInitialVisualAdmission } from './helpers/visualInitialAdmissionFixtures.mjs';

const PAYLOAD = {
  spreadInfo: { name: 'One Card', key: 'single' },
  cardsInfo: [{ card: 'The Star', position: 'Present', orientation: 'Upright', meaning: 'Hope', userReflection: null }],
  userQuestion: 'Where can I find hope?', deckStyle: 'rws-1909'
};
const configured = {
  VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/visual',
  AI: { run: async () => ({ response: { proposals: [] } }) }
};

for (const [name, limits] of [
  ['missing admission limits', undefined], ['invalid admission limits', 'invalid'],
  ['zero allowance', initialVisualLimits(configured, { totalLimit: 0 })],
  ['model pin mismatch', initialVisualLimits(configured, { model: '@cf/unapproved/model' })]
]) {
  test(`${name} preserves a real narrative start without visual initialization or dispatch`, async t => {
    const DB = await createD1(); t.after(() => DB.sqlite.close());
    let proseStarts = 0;
    let providerCalls = 0;
    let visualInitializations = 0;
    const env = { ...configured, DB, VISUAL_INITIAL_LIMITS: limits,
      AI: { run: async () => { providerCalls++; throw new Error('Rejected visuals must not dispatch'); } },
      READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async (_url, options) => {
        const body = JSON.parse(options.body);
        proseStarts++;
        assert.equal(body.payload.userQuestion, PAYLOAD.userQuestion);
        assert.equal(body.visualInit, null);
        return Response.json({ ok: true });
      } }) },
      READING_VISUAL_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => { visualInitializations++; return Response.json({ ok: true }); } }) }
    };
    const result = await startReadingJob({ env, payload: PAYLOAD, waitUntil: () => { throw new Error('No visual work may be scheduled'); } });
    assert.equal(result.ok, true);
    assert.equal(proseStarts, 1);
    assert.equal(result.visualBinding, null);
    assert.equal(result.visualJobToken, null);
    assert.equal(providerCalls, 0);
    assert.equal(visualInitializations, 0);
    assert.equal(DB.rows('SELECT * FROM visual_initial_admissions').length, 0);
    assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 0);
  });
}

test('untrusted guest attribution or unavailable admission storage cannot fail the narrative start', async t => {
  const DB = await createD1(); t.after(() => DB.sqlite.close());
  for (const db of [DB, { prepare: () => { throw new Error('Controlled unavailable admission database'); } }]) {
    let starts = 0;
    const env = { ...configured, DB: db, VISUAL_INITIAL_LIMITS: initialVisualLimits(configured),
      VISUAL_INITIAL_TRUSTED_IDENTITY: { resolve: () => db === DB ? null : 'controlled-edge' },
      READING_VISUAL_JOBS: {},
      READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => { starts++; return Response.json({ ok: true }); } }) }
    };
    const result = await startReadingJob({ env, payload: PAYLOAD });
    assert.equal(result.ok, true);
    assert.equal(starts, 1);
    assert.equal(result.visualBinding, null);
  }
});

test('a held optional trusted resolver cannot delay narrative startup or response and late identity cannot spend', async t => {
  const DB = await createD1(); t.after(() => DB.sqlite.close());
  let releaseIdentity;
  const gate = new Promise(resolve => { releaseIdentity = resolve; });
  let narrativeStarts = 0, visualCalls = 0, providerCalls = 0;
  const env = withInitialVisualAdmission({ ...configured, DB,
    AI: { run: async () => { providerCalls++; return { response: { proposals: [] } }; } },
    READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => {
      narrativeStarts++; return Response.json({ ok: true });
    } }) },
    READING_VISUAL_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => {
      visualCalls++; return Response.json({ ok: true });
    } }) }
  });
  env.VISUAL_INITIAL_TRUSTED_IDENTITY = { resolve: () => gate };
  const pending = startReadingJob({ env, payload: PAYLOAD, waitUntil: () => { throw new Error('Unresolved attribution must not schedule visuals'); } });
  try {
    const finished = await Promise.race([pending.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 100))]);
    assert.equal(finished, true, 'Prose response must complete without releasing the optional resolver');
    const result = await pending;
    assert.equal(narrativeStarts, 1);
    assert.equal(result.visualBinding, null);
    assert.equal(result.visualJobToken, null);
    releaseIdentity('controlled-late-edge');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(visualCalls, 0);
    assert.equal(providerCalls, 0);
    assert.equal(DB.rows('SELECT * FROM visual_initial_admissions').length, 0);
    assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 0);
  } finally {
    releaseIdentity('controlled-late-edge');
    await pending;
  }
});

// Missing/blank provider-model pins also reject initial admission. Every other
// case has valid admission so it can exercise its provider or DO readiness gate.
for (const [name, overrides, initialReady] of [
  ['missing', {}, false],
  ['provider only', { VISUAL_CUE_PROVIDER: 'workers-ai' }, false],
  ['model only', { VISUAL_CUE_MODEL: '@cf/controlled/visual' }, false],
  ['blank model', { ...configured, VISUAL_CUE_MODEL: '   ' }, false],
  ['unsupported provider', { ...configured, VISUAL_CUE_PROVIDER: 'narrative' }, true],
  ['missing AI binding', { ...configured, AI: undefined }, true],
  ['non-callable AI binding', { ...configured, AI: { run: true } }, true],
  ['missing visual job binding', { ...configured, READING_VISUAL_JOBS: undefined }, true]
]) {
  test(`${name} visual configuration starts narrative without visual state, hashing or database work`, async t => {
    let started;
    let databaseCalls = 0;
    let visualCalls = 0;
    let backgroundCalls = 0;
    let digestCalls = 0;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    t.mock.method(crypto.subtle, 'digest', (...args) => { digestCalls++; return digest(...args); });
    const env = withInitialVisualAdmission({
      READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async (_url, options) => {
        started = JSON.parse(options.body);
        return Response.json({ ok: true });
      } }) },
      READING_VISUAL_JOBS: { idFromName: id => id, get: () => { visualCalls++; return { fetch: async () => Response.json({ ok: true }) }; } },
      DB: { prepare: () => { databaseCalls++; throw new Error('Visual storage must remain untouched'); } },
      ...overrides
    });
    assert.equal(getVisualInitialReadiness(env).ready, initialReady);
    assert.equal(typeof env.VISUAL_INITIAL_TRUSTED_IDENTITY.resolve(), 'string');
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
  const env = withInitialVisualAdmission({ ...configured, DB: db,
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
  });
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

test('stalled original admission cannot delay narrative startup or its response', async t => {
  const DB = await createD1(); t.after(() => DB.sqlite.close());
  let releaseAdmission;
  const gate = new Promise(resolve => { releaseAdmission = resolve; });
  let admissionStarted = false, narrativeStarted = false, modelCalls = 0;
  const prepare = DB.prepare.bind(DB);
  DB.prepare = sql => {
    const wrap = statement => new Proxy(statement, { get(target, key) {
      if (key === 'bind') return (...args) => wrap(target.bind(...args));
      if (key === 'run' && /INSERT INTO visual_initial_admissions/.test(sql)) return async () => {
        admissionStarted = true;
        await gate;
        return target.run();
      };
      return Reflect.get(target, key);
    } });
    return wrap(prepare(sql));
  };
  const tasks = [];
  const env = withInitialVisualAdmission({ ...configured, DB,
    AI: { run: async () => { modelCalls++; return { response: { proposals: [] } }; } },
    READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => {
      narrativeStarted = true;
      return Response.json({ ok: true });
    } }) }
  });
  const visual = new ReadingVisualJob({ blockConcurrencyWhile: callback => callback(),
    storage: { get: async () => null, put: async () => {}, setAlarm: async () => {} },
    waitUntil: promise => tasks.push(promise) }, env);
  env.READING_VISUAL_JOBS = { idFromName: id => id, get: () => ({ fetch: (url, options) => visual.fetch(new Request(url, options)) }) };
  t.after(() => { releaseAdmission(); DB.prepare = prepare; });
  const result = await startReadingJob({ env, payload: { ...PAYLOAD,
    initialAdmission: { aggregateScope: 'client-forged-scope', userId: 'spoofed' } },
  waitUntil: promise => tasks.push(promise) });
  assert.equal(narrativeStarted, true);
  assert.equal(result.ok, true, 'Response returns while optional admission SQL remains held');
  assert.ok(result.visualJobToken);
  assert.equal(modelCalls, 0);
  while (!admissionStarted) await new Promise(resolve => setImmediate(resolve));
  assert.equal(visual.binding, null);
  releaseAdmission();
  await Promise.all(tasks);
  assert.equal(visual.status, 'running');
  assert.match(DB.rows('SELECT aggregate_scope FROM visual_initial_admissions')[0].aggregate_scope, /^guest-edge:[a-f0-9]{64}$/);
  assert.equal(modelCalls, 0, 'Admission/init itself never invokes the provider');
  await observeDeliveredReading({ env, binding: result.visualBinding, raw: 'The Star offers hope.', deliveredEventId: 1, complete: true });
  await Promise.all(tasks);
  assert.equal(modelCalls, 1);
  assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 1);
});
