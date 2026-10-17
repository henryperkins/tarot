#!/usr/bin/env node
/** Controlled server acceptance only. Uses in-memory SQLite; no live services. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintVisualSource } from '../../shared/reading/visualSourceIdentity.js';
import { startReadingJob } from '../../tests/helpers/webVisualAdmissionFixtures.mjs';
import { createD1 } from '../../tests/helpers/d1Sqlite.mjs';
import { withInitialVisualAdmission } from '../../tests/helpers/visualInitialAdmissionFixtures.mjs';
import { prepareVisualInitialAdmission } from '../../functions/lib/readingVisualAdmission.js';
import { formatSSEEvent } from '../../functions/lib/readingStream.js';
import { ReadingJob } from '../../src/worker/readingJob.js';
import { ReadingVisualJob } from '../../src/worker/readingVisualJob.js';
import { getVectorGestureDetails } from '../../src/data/cardGestureArtwork.js';
import { canonicalVisualCueJSON, hashVisualCueText } from '../../shared/contracts/visualCueBatches.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixturePath = 'output/reading-motion/fixtures/three-card-transition.json';
const fixture = JSON.parse(readFileSync(resolve(root, fixturePath), 'utf8'));
const raw = fixture.excerpt;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const edition = 'rws-immanuelle-vector';
const controlledVisualConfig = {
  VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/visual',
  AI: { run: () => assert.fail('Controlled adapter must handle every annotation; no provider calls allowed') }
};
const cards = fixture.cards.map((card, index) => ({ ...card, index,
  canonicalName: card.card, artworkEdition: edition,
  detailIds: getVectorGestureDetails(card.card).map(detail => detail.id) }));
const context = { cards, question: fixture.userQuestion, reflections: fixture.reflectionsText };
const binding = { readingResultId: 'controlled-fixture-result', sourceRevision: 0,
  spreadHash: sha256(canonicalVisualCueJSON(cards)),
  contextHash: sha256(canonicalVisualCueJSON({ question: context.question, reflections: context.reflections })),
  artworkEdition: edition, catalogVersion: 'v1' };
const proposals = [
  { localAlias: 'star-name', kind: 'identity', quote: 'The Star', targets: [{ spreadIndex: 2, detailIds: [] }] },
  { localAlias: 'pool', kind: 'literal', quote: 'pouring one pitcher into a pool', targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] },
  { localAlias: 'land', kind: 'literal', quote: 'the other onto the land', targets: [{ spreadIndex: 2, detailIds: ['land-pour'] }] }
];
for (const proposal of proposals) assert.equal(raw.split(proposal.quote).length, 2, 'Fixture quote must be unique');
assert.equal(raw.split(/\s+/).length, fixture.excerptWordCount);
const prefixes = [proposals[0], proposals[1]].map(proposal => raw.slice(0, raw.indexOf(proposal.quote) + proposal.quote.length));
prefixes.push(raw);

function deferred() {
  let resolvePromise;
  const promise = new Promise(resolve => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Controlled runner timed out: ${label}`)), 2000);
    })]);
  } finally { clearTimeout(timer); }
}

async function until(predicate, label) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Controlled runner timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

function fakeState() {
  const records = new Map();
  const tasks = [];
  return {
    records, tasks,
    blockConcurrencyWhile: callback => callback(),
    storage: {
      get: async key => records.get(key),
      put: async (key, value) => { records.set(key, structuredClone(value)); },
      setAlarm: async () => {}
    },
    // Observe rejections immediately, then surface them during cleanup.
    waitUntil(promise) {
      tasks.push(Promise.resolve(promise).then(() => null, error => error));
    },
    async settle() {
      let count = 0;
      do {
        count = tasks.length;
        const errors = await bounded(Promise.all(tasks), 'background tasks');
        const failure = errors.find(Boolean);
        if (failure) throw failure;
      } while (tasks.length !== count);
    }
  };
}

function controlledAdapter() {
  const gate = deferred();
  const calls = [];
  let active = 0;
  let maximumActive = 0;
  return {
    calls, release: gate.resolve,
    get maximumActive() { return maximumActive; },
    async runAnnotation({ prompt }) {
      calls.push({ promptSha256: sha256(canonicalVisualCueJSON(prompt)) });
      maximumActive = Math.max(maximumActive, ++active);
      try {
        await gate.promise;
        const prefix = prompt.userPrompt.split('Reading Text to Analyze:\n"""\n')[1]?.split('\n"""')[0] || '';
        return { proposals: proposals.filter(proposal => prefix.includes(proposal.quote)) };
      } finally { active--; }
    }
  };
}

async function visualHarness({ initialize = true } = {}) {
  const state = fakeState();
  const adapter = controlledAdapter();
  const env = withInitialVisualAdmission({ ...controlledVisualConfig, DB: await createD1() });
  const job = new ReadingVisualJob(state, env, { runAnnotation: adapter.runAnnotation });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    adapter.release();
    try { await state.settle(); }
    finally { env.DB.sqlite.close(); }
  };
  try {
    await job.initialized;
    if (initialize) {
      const initialAdmission = await prepareVisualInitialAdmission({ env });
      const result = await job.handleInit({ json: async () => ({ binding, visualToken: 'controlled-only', validationContext: context, initialAdmission }) });
      assert.equal(result.status, 200, 'Controlled visual initialization must be admitted');
    }
  } catch (error) {
    await close();
    throw error;
  }
  return { state, adapter, job, env,
    observe: (source, deliveredEventId, complete = false, sourceBinding = binding) => job.fetch(new Request('https://visual.test/observe', {
      method: 'POST', body: JSON.stringify({ binding: sourceBinding, raw: source, deliveredEventId, complete, availableAt: deliveredEventId })
    })),
    close
  };
}

// Pause hashing at a specific scheduler boundary so race cases do not depend on CPU speed.
function pauseDigests({ firstOnly = false } = {}) {
  const original = globalThis.crypto.subtle.digest;
  const gate = deferred();
  const entered = deferred();
  const pending = [];
  let calls = 0;
  globalThis.crypto.subtle.digest = function (...args) {
    const pause = !firstOnly || calls++ === 0;
    if (pause) entered.resolve();
    const work = (async () => {
      if (pause) await gate.promise;
      return original.apply(this, args);
    })();
    pending.push(work);
    return work;
  };
  return { entered: entered.promise,
    async release() { gate.resolve(); await bounded(Promise.all(pending), 'digest barrier'); },
    restore() { gate.resolve(); globalThis.crypto.subtle.digest = original; }
  };
}

const cases = [];
async function check(id, run) {
  const result = { id, passed: false, expected: null, actual: null };
  try {
    const evidence = await run();
    Object.assign(result, evidence);
    assert.deepEqual(result.actual, result.expected);
    result.passed = true;
  } catch (error) {
    result.failure = error.code === 'ERR_ASSERTION' ? 'Acceptance expectation did not match actual behavior.' : error.message;
  }
  cases.push(result);
}

function realRequest() {
  return { spreadInfo: { name: fixture.spreadName, key: fixture.spreadKey },
    cardsInfo: fixture.cards.map(card => ({ ...card, meaning: 'Controlled schema-required fixture value.', userReflection: null })),
    userQuestion: fixture.userQuestion, reflectionsText: fixture.reflectionsText, deckStyle: fixture.deckStyle };
}

await check('real_request_preserves_spread_and_context', async () => {
  const harness = await visualHarness({ initialize: false });
  const background = [];
  let startBody;
  try {
    const request = realRequest();
    const result = await startReadingJob({ payload: request, waitUntil: promise => background.push(promise), env: {
      ...harness.env,
      READING_JOBS: { idFromName: value => value, get: () => ({ fetch: async (_url, options) => {
        startBody = JSON.parse(options.body);
        return Response.json({ ok: true });
      } }) },
      READING_VISUAL_JOBS: { idFromName: value => value, get: () => ({ fetch: (url, options) => harness.job.fetch(new Request(url, options)) }) }
    } });
    assert.equal(result.ok, true);
    await Promise.all(background);
    const initialized = harness.job.validationContext;
    const { contextHash } = await fingerprintVisualSource(request);
    return { expected: { cardNames: fixture.cards.map(card => card.card), question: fixture.userQuestion,
      reflections: fixture.reflectionsText, contextHash, initializedResult: result.readingResultId,
      indexes: [0, 1, 2], starHasSupportedPool: true, descriptorPassedToReading: true },
    actual: { cardNames: initialized.cards.map(card => card.canonicalName || card.name || card.card),
      question: initialized.question, reflections: initialized.reflections, contextHash: harness.job.binding?.contextHash,
      initializedResult: harness.job.binding?.readingResultId, indexes: initialized.cards.map(card => card.index),
      starHasSupportedPool: initialized.cards[2]?.detailIds.includes('pool-pour'),
      descriptorPassedToReading: startBody.visualInit.binding.readingResultId === result.readingResultId } };
  } finally { await harness.close(); }
});

await check('held_visual_initialization_does_not_gate_narrative_start', async () => {
  const harness = await visualHarness({ initialize: false });
  const gate = deferred();
  const background = [];
  let narrativeStarted = false;
  let visualInitialized = false;
  try {
    const result = await bounded(startReadingJob({ payload: realRequest(), waitUntil: promise => background.push(promise), env: {
      ...harness.env,
      READING_JOBS: { idFromName: value => value, get: () => ({ fetch: async () => {
        narrativeStarted = true;
        return Response.json({ ok: true });
      } }) },
      READING_VISUAL_JOBS: { idFromName: value => value, get: () => ({ fetch: async () => {
        await gate.promise;
        visualInitialized = true;
        return Response.json({ ok: true });
      } }) }
    } }), 'narrative startup independent of held visual init');
    return { expected: { started: true, narrativeStarted: true, visualInitialized: false, pendingInitializations: 1, hasVisualBinding: true },
      actual: { started: result.ok, narrativeStarted, visualInitialized, pendingInitializations: background.length, hasVisualBinding: !!result.visualBinding } };
  } finally {
    gate.resolve();
    try { await Promise.all(background); }
    finally { await harness.close(); }
  }
});

for (const mode of ['paced-sse', 'burst-sse', 'final-json']) {
  await check(`${mode}_completes_while_annotation_is_held`, async () => {
    const harness = await visualHarness();
    const state = fakeState();
    const reading = new ReadingJob(state, { ...harness.env, READING_VISUAL_JOBS: {
      idFromName: value => value, get: () => ({ fetch: (url, options) => harness.job.fetch(new Request(url, options)) })
    } });
    try {
      await reading.initialized;
      reading.visualBinding = binding;
      Object.assign(reading.job, { jobId: 'controlled-reading', status: 'running' });
      const firstEvent = formatSSEEvent('delta', { text: prefixes[0] });
      const lastEvents = formatSSEEvent('delta', { text: raw.slice(prefixes[0].length) })
        + formatSSEEvent('done', { fullText: raw });
      if (mode === 'final-json') {
        await bounded(reading.consumeResponse(Response.json({ reading: raw })), mode);
      } else if (mode === 'burst-sse') {
        await bounded(reading.consumeResponse(new Response(firstEvent + lastEvents, { headers: { 'Content-Type': 'text/event-stream' } })), mode);
      } else {
        let controller;
        const stream = new ReadableStream({ start(value) { controller = value; } });
        const consuming = reading.consumeResponse(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));
        consuming.catch(() => {});
        controller.enqueue(new TextEncoder().encode(firstEvent));
        await until(() => harness.adapter.calls.length > 0, 'first paced annotation');
        controller.enqueue(new TextEncoder().encode(lastEvents));
        controller.close();
        await bounded(consuming, mode);
      }
      await until(() => harness.adapter.calls.length > 0, 'annotation dispatch');
      return { expected: { narrativeStatus: 'complete', rawSha256: sha256(raw), annotationUnresolved: true },
        actual: { narrativeStatus: reading.job.status, rawSha256: sha256(reading.textSoFar), annotationUnresolved: harness.job.ledger.receipts.length === 0 } };
    } finally {
      // Narrative observations can still be entering the visual object. Drain
      // those senders before releasing its adapter and closing the shared DB.
      try { await state.settle(); }
      finally {
        try { await harness.close(); }
        finally { reading.closeSubscribers(); }
      }
    }
  });
}

await check('simultaneous_observation_single_flight_and_retained_commits', async () => {
  const harness = await visualHarness();
  try {
    // Hold the adapter, not global hashing: current admission and source
    // persistence also hash inputs before an observation can be accepted.
    await Promise.all(prefixes.map((prefix, index) => harness.observe(prefix, index + 1, index === 2)));
    await until(() => harness.adapter.calls.length > 0, 'burst annotation dispatch');
    const startedBeforeRelease = harness.adapter.calls.length;
    const latestPending = harness.job.pendingSnapshot?.raw === raw;
    await harness.close();
    return { expected: { startedBeforeRelease: 1, latestPending: true, maximumActive: 1, allRequestReceiptsRetained: true,
      acceptedCueCount: proposals.length, rawSha256: sha256(raw) },
    actual: { startedBeforeRelease, latestPending, maximumActive: harness.adapter.maximumActive,
      allRequestReceiptsRetained: harness.job.ledger.receipts.length === harness.adapter.calls.length,
      acceptedCueCount: harness.job.ledger.cues.length, rawSha256: sha256(harness.job.ledger.raw) } };
  } finally { await harness.close(); }
});

async function issuedRequest(source, sourceBinding = binding) {
  return { binding: sourceBinding, status: 'active', batchId: 'controlled-issued-batch', requestSequence: 1,
    analyzedEnd: source.length, analyzedHash: await hashVisualCueText(source), baseLedgerRevision: 0 };
}

await check('replacement_during_commit_rejects_previous_source', async () => {
  const harness = await visualHarness();
  const request = await issuedRequest(raw);
  harness.job.authoritativeRaw = raw;
  harness.job.requestRegistry.push(request);
  harness.job.inFlightRequest = { ...request, recoveryEpoch: harness.job.recoveryEpoch };
  const replacement = raw.slice(raw.indexOf('A figure'));
  const replacementBinding = { ...binding, sourceRevision: 1 };
  const barrier = pauseDigests({ firstOnly: true });
  let commit;
  try {
    commit = harness.job.commitBatch({ issuedRequest: request, response: { proposals }, recoveryEpoch: harness.job.recoveryEpoch });
    commit.catch(() => {});
    await bounded(barrier.entered, 'commit prefix validation');
    await harness.observe(replacement, 2, true, replacementBinding);
    await barrier.release();
    const result = await bounded(commit, 'old commit');
    return { expected: { oldCommitRejected: true, bindingRevision: 1, ledgerBindingRevision: 1, oldIdentityRetained: false },
      actual: { oldCommitRejected: !result.ok, bindingRevision: harness.job.binding.sourceRevision,
        ledgerBindingRevision: harness.job.ledger.binding.sourceRevision,
        oldIdentityRetained: harness.job.ledger.cues.some(cue => cue.kind === 'identity') },
      sourceReplacement: { kind: 'Exact suffix of the same fixture, used only for replacement testing.', rawSha256: sha256(replacement) } };
  } finally {
    barrier.restore();
    await bounded(Promise.allSettled([commit]), 'commit cleanup');
    await harness.close();
  }
});

await check('unregistered_request_cannot_commit', async () => {
  const harness = await visualHarness();
  try {
    harness.job.authoritativeRaw = raw;
    const result = await harness.job.commitBatch({ issuedRequest: await issuedRequest(raw), response: { proposals }, recoveryEpoch: harness.job.recoveryEpoch });
    return { expected: { rejected: true, receiptCount: 0, cueCount: 0 },
      actual: { rejected: !result.ok, receiptCount: harness.job.ledger.receipts.length, cueCount: harness.job.ledger.cues.length } };
  } finally { await harness.close(); }
});

await check('ledger_and_completion_persist_before_publication', async () => {
  const harness = await visualHarness();
  const publications = [];
  harness.job.subscribers.add({ controller: { enqueue(bytes) {
    const event = new TextDecoder().decode(bytes);
    const stored = harness.state.records.get('visual_job');
    if (event.includes('event: cues')) publications.push({ event: 'cues', durable: stored?.ledger?.ledgerRevision === harness.job.ledger.ledgerRevision });
    if (event.includes('event: done')) publications.push({ event: 'done', durable: stored?.status === 'complete' });
  } } });
  try {
    harness.adapter.release();
    await harness.observe(raw, 1, true);
    await harness.close();
    return { expected: [{ event: 'cues', durable: true }, { event: 'done', durable: true }], actual: publications };
  } finally { await harness.close(); harness.job.subscribers.clear(); }
});

const args = process.argv.slice(2);
let output = null;
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--output' && args[index + 1]) output = args[++index];
  else if (args[index].startsWith('--output=')) output = args[index].slice('--output='.length);
  else throw new Error(`Unknown or incomplete option: ${args[index]}`);
}
const implementationFiles = [
  'functions/lib/readingJobs.js', 'functions/lib/visualCueObserver.js', 'src/worker/readingJob.js',
  'src/worker/readingVisualJob.js', 'shared/reading/visualCueLedger.js', 'shared/generation/visualCuePrompt.js',
  'functions/lib/readingVisualAdmission.js', 'functions/lib/readingVisualWebAdmission.js',
  'tests/helpers/d1Sqlite.mjs', 'tests/helpers/visualInitialAdmissionFixtures.mjs',
  'tests/helpers/webVisualAdmissionFixtures.mjs',
  'scripts/evaluation/evaluateVisualCueHandoff.mjs'
];
const report = {
  generatedAt: new Date().toISOString(),
  worktreeHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  implementationHashes: Object.fromEntries(implementationFiles.map(path => [path, sha256(readFileSync(resolve(root, path)))])),
  evidenceKind: 'controlled-deterministic-server-acceptance',
  adapter: { kind: 'controlled deterministic exact-quote proposals', model: null, liveModelLatencyMeasured: false },
  source: { path: fixturePath, id: fixture.id, rawSha256: sha256(raw), fileSha256: sha256(readFileSync(resolve(root, fixturePath))),
    wordCount: fixture.excerptWordCount, provenance: fixture.provenance,
    note: 'Unchanged reading-only 97-word excerpt. Request-only meaning/userReflection values satisfy the schema; they are not recorded narrative output.' },
  limitations: ['In-memory Durable Object state, SQLite-backed D1 fixture and controlled scheduling; no deployed runtime, remote D1, network, or provider calls.',
    'Paid-web capability and initial spending admission use explicit offline fixtures; no live account or provider qualification.',
    'Direct job cases inject a normalized fixture context; the separate real-request case verifies start-context normalization.',
    'Paced SSE is a controlled transport test, not live generation or model latency evidence.',
    'No browser visibility/adoption timing, semantic corpus qualification, saved-entry recovery, or device evidence is established here.'],
  summary: { total: cases.length, passed: cases.filter(item => item.passed).length, failed: cases.filter(item => !item.passed).length },
  cases
};
if (output) {
  const path = resolve(root, output);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: relative(root, path), ...report.summary }));
} else console.log(JSON.stringify(report, null, 2));
process.exitCode = report.summary.failed ? 1 : 0;
