import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import {
  extractAndEmbed,
  extractNextStepsWithAI,
  scheduleCoachExtraction,
  storeCoachExtraction
} from '../functions/lib/coachSuggestion.js';
import { onRequestPost as backfill } from '../functions/api/coach-extraction-backfill.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedUser } from './helpers/journalFixtures.mjs';

const NARRATIVE = `${'The Star invites a measured pause. '.repeat(8)}\n\n### Gentle Next Steps\n- Take one slow walk.\n- Name one boundary.`;
const STEPS = ['Take one slow walk', 'Name one boundary'];
const EXTRACTION_RESPONSE = { model: '@cf/zai-org/glm-5.3-flash', response: STEPS };
const EMBEDDING_RESPONSE = { model: '@cf/baai/bge-m3', data: [[1, 0], [0, 1]] };

async function journal(t, ids = ['entry']) {
  const DB = await createD1();
  t.after(() => DB.sqlite.close());
  await seedUser(DB, { id: 'reader' });
  for (const id of ids) await seedEntry(DB, { id, userId: 'reader', narrative: NARRATIVE });
  return DB;
}

function delayedResponse(response, milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(response);
    }, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

test('a journal save retains coach steps when extraction takes twelve seconds', async (t) => {
  const DB = await journal(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const started = Promise.withResolvers();
  const env = {
    DB,
    AI: { run(_model, input, { signal }) {
      if (!input.messages) return Promise.resolve(EMBEDDING_RESPONSE);
      started.resolve();
      return delayedResponse(EXTRACTION_RESPONSE, 12000, signal);
    } }
  };
  const pending = [];
  scheduleCoachExtraction(env, 'entry', NARRATIVE, {
    provider: 'claude-api', requestId: 'slow-extraction', waitUntil: promise => pending.push(promise)
  });
  await started.promise;
  t.mock.timers.tick(12000);
  await Promise.all(pending);

  const [entry] = DB.rows('SELECT narrative, extracted_steps, step_embeddings, extraction_version FROM journal_entries');
  assert.equal(entry.narrative, NARRATIVE);
  assert.deepEqual(JSON.parse(entry.extracted_steps), STEPS);
  assert.deepEqual(JSON.parse(entry.step_embeddings), [[1, 0], [0, 1]]);
  assert.equal(entry.extraction_version, 'v2');
  assert.deepEqual(DB.rows('SELECT task, state FROM inference_attempts ORDER BY rowid'), [
    { task: 'coach-extraction', state: 'accepted' },
    { task: 'coach-embedding', state: 'accepted' }
  ]);
});

test('an extraction deadline is recorded as a timeout and leaves the entry retryable', async (t) => {
  const DB = await journal(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const started = Promise.withResolvers();
  const pending = extractAndEmbed({
    DB,
    AI: { run(_model, _input, { signal }) {
      started.resolve();
      return delayedResponse(EXTRACTION_RESPONSE, 60000, signal);
    } }
  }, NARRATIVE, 'extraction-timeout');
  await started.promise;
  t.mock.timers.tick(25000);
  const result = await pending;

  assert.equal(result.status, 'timeout');
  assert.equal(await storeCoachExtraction({ DB }, 'entry', result), false);
  assert.equal(DB.rows('SELECT extraction_version FROM journal_entries')[0].extraction_version, null);
  assert.deepEqual(DB.rows('SELECT task, state, reason FROM inference_attempts'), [
    { task: 'coach-extraction', state: 'failed', reason: 'timeout' }
  ]);

  const retry = await extractAndEmbed({ DB, AI: { run: async (_model, input) => (
    input.messages ? EXTRACTION_RESPONSE : EMBEDDING_RESPONSE
  ) } }, NARRATIVE, 'extraction-retry');
  assert.equal(await storeCoachExtraction({ DB }, 'entry', retry), true);
  const [entry] = DB.rows('SELECT extracted_steps, extraction_version FROM journal_entries');
  assert.deepEqual(JSON.parse(entry.extracted_steps), STEPS);
  assert.equal(entry.extraction_version, 'v2');
});

test('extraction settles before the background budget even if the provider ignores abort', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const started = Promise.withResolvers();
  const provider = Promise.withResolvers();
  let result;
  const pending = extractNextStepsWithAI({ AI: { run() {
    started.resolve();
    return provider.promise;
  } } }, NARRATIVE, 'unresponsive-extraction').then(value => { result = value; });
  await started.promise;
  t.mock.timers.tick(25000);
  await setImmediate();

  try {
    assert.equal(result?.status, 'timeout');
  } finally {
    provider.resolve(EXTRACTION_RESPONSE);
    await pending;
  }
  assert.equal(result.status, 'timeout', 'A late provider result cannot replace the timeout');
});

test('an unresponsive embedding provider preserves extracted steps within its deadline', async (t) => {
  const DB = await journal(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const started = Promise.withResolvers();
  const provider = Promise.withResolvers();
  let result;
  const pending = extractAndEmbed({ AI: { run(_model, input) {
    if (input.messages) return Promise.resolve(EXTRACTION_RESPONSE);
    started.resolve();
    return provider.promise;
  } } }, NARRATIVE, 'unresponsive-embedding').then(value => { result = value; });
  await started.promise;
  t.mock.timers.tick(5000);
  await setImmediate();

  try {
    assert.equal(result?.status, 'steps_only');
  } finally {
    provider.resolve({ data: [] });
    await pending;
  }
  assert.equal(await storeCoachExtraction({ DB }, 'entry', result), true);
  const [entry] = DB.rows('SELECT extracted_steps, step_embeddings, extraction_version FROM journal_entries');
  assert.deepEqual(JSON.parse(entry.extracted_steps), STEPS);
  assert.equal(entry.step_embeddings, null);
  assert.equal(entry.extraction_version, 'v2-steps-only');
});

test('backfill reserves enough time for extraction and embeddings before starting another entry', async (t) => {
  const DB = await journal(t, ['first', 'second']);
  await DB.prepare("UPDATE journal_entries SET created_at = 2000 WHERE id = 'first'").run();
  await DB.prepare("UPDATE journal_entries SET created_at = 1000 WHERE id = 'second'").run();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const response = await backfill({
    request: new Request('https://example.test/api/coach-extraction-backfill?limit=2', {
      method: 'POST', headers: { Authorization: 'Bearer test-admin-key' }
    }),
    env: { DB, ADMIN_API_KEY: 'test-admin-key', AI: { run: async (_model, input) => {
      if (!input.messages) return EMBEDDING_RESPONSE;
      t.mock.timers.tick(6000);
      return EXTRACTION_RESPONSE;
    } } }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.processed, 1);
  assert.equal(body.attempted, 1);
  assert.equal(body.remaining, 1);
  assert.equal(body.stoppedEarly, true);
  assert.ok(body.timeBudgetMs < 30000);
  assert.deepEqual(DB.rows('SELECT id, extraction_version FROM journal_entries ORDER BY id'), [
    { id: 'first', extraction_version: 'v2' },
    { id: 'second', extraction_version: null }
  ]);
});
