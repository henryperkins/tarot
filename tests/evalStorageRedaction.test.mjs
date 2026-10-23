import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onRequestPost } from '../functions/api/tarot-reading.js';
import { saveMemory } from '../functions/lib/userMemory.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession } from './helpers/journalFixtures.mjs';
import { createReadingJobState } from './helpers/fakeReadingJobs.mjs';
import { ReadingJob } from '../src/worker/readingJob.js';

const EVAL_MODEL = '@cf/zai-org/glm-5.3';
const OMITTED_MEMORY = 'User (Henry) asks for grounded, practical advice.';
const READING = "Henry, The Sun invites a gentle reflection today. Sarah's silence can soften in its warmth. Consider one small supportive choice, Henry. Your choices shape the way forward.";

async function runStorageScenario(t, { lateCandidate = false, optOut = false, supported = false, stream = false, fallback = false, subscriptionJob = false, persistPrompts = false } = {}) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  const d1 = await createD1();
  t.after(() => d1.sqlite.close());
  await seedUser(d1);
  await seedSession(d1);
  // Put Henry last in the actual candidate SQL order, beyond the generic 24-hint cap.
  if (lateCandidate) {
    for (let index = 0; index < 99; index++) {
      const name = `Person${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + index % 26)}`;
      const memory = await saveMemory(d1, 'user-1', { text: `User (${name}) asks for grounded, practical advice.`, category: 'theme' });
      assert.equal(memory.saved, true);
      await d1.prepare('UPDATE user_memories SET created_at = ? WHERE id = ?').bind(1000 + index, memory.id).run();
    }
  }
  const memory = await saveMemory(d1, 'user-1', {
    text: supported ? 'Navigating career uncertainty' : OMITTED_MEMORY,
    category: 'theme'
  });
  assert.equal(memory.saved, true);
  await d1.prepare('UPDATE user_memories SET created_at = ? WHERE id = ?').bind(1, memory.id).run();
  const sql = [];
  const prepare = d1.prepare.bind(d1);
  t.mock.method(d1, 'prepare', query => { sql.push(query); return prepare(query); });

  const providerInputs = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    providerInputs.push(JSON.parse(init.body));
    if (String(url).includes('modal.test')) throw new Error('synthetic primary failure');
    if (subscriptionJob) {
      return new Response(`event: delta\ndata: ${JSON.stringify({ text: READING })}\n\nevent: done\ndata: ${JSON.stringify({ text: READING, structured: null, provider: 'codex-subscription', model: 'synthetic', modelSource: 'configured', usage: {} })}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
    }
    if (stream) {
      return new Response(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: 'response.output_text.delta', delta: READING })}\n\nevent: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output_text: READING } })}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
    }
    return Response.json({ output_text: READING });
  });
  const evaluatorInputs = [];
  const evaluator = {
    async run(model, input) {
      if (model !== EVAL_MODEL) throw new Error('unavailable');
      evaluatorInputs.push(input);
      return {
        response: JSON.stringify({
          personalization: 4, tarot_coherence: 4, tone: 4, safety: 5, overall: 4, safety_flag: false,
          notes: "'Henry' is used. Sarah's reflection is acknowledged."
        })
      };
    }
  };
  const pending = [];
  const routeContext = {
    request: new Request(`https://tableau.test/api/tarot-reading${stream ? '?stream=true' : ''}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: 'session=session-1' },
      body: JSON.stringify({
        spreadInfo: { key: 'single', name: 'One-Card Insight' },
        cardsInfo: [{
          card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Warmth and renewal.',
          userReflection: "Sarah's silence still hurts."
        }],
        userQuestion: supported ? 'What career choices support me today?' : 'What grounded, practical advice supports me today?',
        ...(optOut ? { useSavedMemories: false } : {})
      })
    }),
    env: {
      DB: d1,
      AI: evaluator,
      OPENAI_API_KEY: 'test',
      OPENAI_BASE_URL: 'https://provider.test',
      OPENAI_MODEL: 'gpt-5',
      OPENAI_STREAMING_ENABLED: String(stream),
      ALLOW_STREAMING_WITH_EVAL_GATE: 'true',
      EVAL_ENABLED: 'true',
      EVAL_GATE_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'false',
      PERSIST_PROMPTS: String(persistPrompts),
      ...(fallback ? { MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'test', MODAL_MODEL: 'test' } : {}),
      ...(subscriptionJob ? {
        TEXT_PROVIDER: 'codex-subscription', CODEX_SUBSCRIPTION_OWNER_USER_ID: 'user-1',
        CODEX_SUBSCRIPTION_GATEWAY_URL: 'https://codex.test', CODEX_SUBSCRIPTION_GATEWAY_TOKEN: 'synthetic',
        CODEX_SUBSCRIPTION_STREAMING_ENABLED: 'true'
      } : {})
    },
    waitUntil: promise => pending.push(promise)
  };
  let response;
  let delivered;
  if (subscriptionJob) {
    const state = createReadingJobState();
    const job = new ReadingJob(state, routeContext.env, { runReading: onRequestPost });
    t.after(() => job.closeSubscribers());
    response = await job.fetch(new Request('https://jobs/start', {
      method: 'POST', headers: { 'X-Job-Token': 'synthetic' },
      body: JSON.stringify({ jobId: 'privacy-job', payload: await routeContext.request.json(), principal: { userId: 'user-1' } })
    }));
    while (state.pending.size) await Promise.all([...state.pending]);
    assert.equal(job.job.status, 'complete', JSON.stringify(job.job));
    delivered = job.job.result;
  } else {
    response = await onRequestPost(routeContext);
    delivered = stream ? await response.text() : await response.json();
  }
  assert.equal(response.status, 200);
  assert.match(stream ? delivered : delivered.reading, /Henry/, 'synthetic provider independently supplies the name');
  await Promise.all(pending);
  const serializedProviderInputs = JSON.stringify(providerInputs);
  assert.ok(providerInputs.length >= (fallback ? 2 : 1));
  assert.doesNotMatch(serializedProviderInputs, /Henry|User \(Person|candidateNameHints|candidateRedactionNames/, 'omitted candidate text and private hints never reach a provider');
  assert.equal(serializedProviderInputs.includes('Navigating career uncertainty'), supported);
  assert.doesNotMatch(JSON.stringify(evaluatorInputs), /Person[a-z]+|candidateNameHints|candidateRedactionNames|redactionNames/, 'private hints never enter evaluator input either');

  const row = await d1.prepare('SELECT payload FROM eval_metrics').first();
  const stored = JSON.parse(row.payload);
  const counts = stored.prompt.memories;
  assert.equal(counts.candidateCount, optOut ? 0 : lateCandidate ? 100 : 1);
  assert.equal(counts.selectedCount, supported ? 1 : 0);
  assert.equal(counts.retainedCount, supported ? 1 : 0);
  assert.doesNotMatch(JSON.stringify({ ...stored, readingText: null, eval: null }), /Henry|User \(Person|candidateNameHints|candidateRedactionNames/, 'private name hints never enter ordinary telemetry');
  const memorySQL = sql.filter(query => /user_memories/.test(query));
  if (optOut) assert.deepEqual(memorySQL, [], 'explicit opt-out does not query memory storage');
  else assert.equal(memorySQL.filter(query => /FROM user_memories/.test(query)).length, 1, 'redaction reuses the single loaded candidate pool');
  const accessed = d1.rows('SELECT id FROM user_memories WHERE last_accessed_at IS NOT NULL');
  assert.deepEqual(accessed.map(row => row.id), supported ? [memory.id] : [], 'only retained supported memory can be stamped');
  assert.equal(stored._storageMode, 'redact');
  assert.doesNotMatch(stored.readingText, /Sarah/, 'current reflection names retain redaction coverage');
  assert.doesNotMatch(stored.eval.scores.notes, /Sarah/);
  if (persistPrompts) {
    assert.equal(stored.promptEngineering.privacy.piiRedacted, true);
    assert.doesNotMatch(stored.promptEngineering.redacted.response, /Henry|Sarah/, 'opt-in prompt archive protects late candidate and current reflection names');
  }
  assert.equal(stored.reversalFramework, 'none');
  return stored;
}

for (const [label, options] of [
  ['direct JSON', {}],
  ['buffered provider token stream', { stream: true }],
  ['subscription stream in a durable reading job', { subscriptionJob: true }],
  ['accepted provider fallback', { fallback: true }],
  ['late candidate after 99 distinct names', { lateCandidate: true }],
  ['opt-in prompt archive with late candidate', { lateCandidate: true, persistPrompts: true }]
]) {
  test(`stored reading and evaluator notes redact a loaded but omitted name: ${label}`, async t => {
    const stored = await runStorageScenario(t, options);
    assert.doesNotMatch(stored.readingText, /Henry/);
    assert.equal(stored.eval.scores.notes, "'[NAME]' is used. [NAME]'s reflection is acknowledged.");
  });
}

test('explicit memory opt-out does not extract candidate hints and still protects current reflection names', async t => {
  const stored = await runStorageScenario(t, { optOut: true });
  assert.match(stored.readingText, /Henry/, 'unknown synthetic provider name has no loaded candidate hint');
  assert.match(stored.eval.scores.notes, /Henry/);
});

test('supported selected memory remains retained and access-stamped', async t => {
  await runStorageScenario(t, { supported: true });
});
