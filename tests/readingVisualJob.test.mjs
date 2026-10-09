import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadingVisualJob } from '../src/worker/readingVisualJob.js';
import { createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

function createBinding(readingResultId = 'res-1', sourceRevision = 0) {
  return {
    readingResultId,
    sourceRevision,
    spreadHash: '0000000000000000000000000000000000000000000000000000000000000001',
    contextHash: '0000000000000000000000000000000000000000000000000000000000000002',
    artworkEdition: 'rws-immanuelle-vector',
    catalogVersion: 'v1'
  };
}

const CARDS = [
  { index: 0, canonicalName: 'The Star', detailIds: ['pool-pour', 'land-pour'] }
];

async function createJob(t, { stored = null, runAnnotation = null, env = {} } = {}) {
  let storageState = stored ? JSON.parse(JSON.stringify(stored)) : null;
  const storage = {
    get: async (_key) => storageState,
    put: async (key, value) => { storageState = JSON.parse(JSON.stringify(value)); }
  };
  const waitUntilPromises = [];
  const fakeState = {
    blockConcurrencyWhile: (fn) => fn(),
    storage,
    waitUntil: (p) => waitUntilPromises.push(p)
  };
  const job = new ReadingVisualJob(fakeState, env, { runAnnotation });
  await job.initialized;
  return { job, fakeState, waitUntilPromises, getStorage: () => storageState };
}

test('initialization sets binding, token, owner and validation context', async (t) => {
  const { job } = await createJob(t);
  const binding = createBinding();
  const initRes = await job.fetch(new Request('https://reading-visual-jobs/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      visualToken: 'sec-token-1',
      ownerUserId: 'user-1',
      validationContext: { cards: CARDS }
    })
  }));
  assert.equal(initRes.status, 200);
  assert.equal(job.visualToken, 'sec-token-1');
  assert.equal(job.ownerUserId, 'user-1');
  assert.equal(job.binding.readingResultId, 'res-1');
});

test('owner and capability isolation rejects unauthorized snapshot access', async (t) => {
  const { job } = await createJob(t);
  const binding = createBinding();
  await job.fetch(new Request('https://reading-visual-jobs/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      visualToken: 'secret-token-123',
      ownerUserId: 'user-1',
      validationContext: { cards: CARDS }
    })
  }));

  // Missing token/auth -> 401
  const noAuth = await job.fetch(new Request('https://reading-visual-jobs/snapshot'));
  assert.equal(noAuth.status, 401);

  // Wrong token -> 403
  const wrongToken = await job.fetch(new Request('https://reading-visual-jobs/snapshot', {
    headers: { 'X-Visual-Token': 'wrong' }
  }));
  assert.equal(wrongToken.status, 403);

  // Correct token -> 200
  const validToken = await job.fetch(new Request('https://reading-visual-jobs/snapshot', {
    headers: { 'X-Visual-Token': 'secret-token-123' }
  }));
  assert.equal(validToken.status, 200);

  // Correct owner header -> 200
  const validOwner = await job.fetch(new Request('https://reading-visual-jobs/snapshot', {
    headers: { 'X-User-Id': 'user-1' }
  }));
  assert.equal(validOwner.status, 200);
});

test('coalesces rapid arrivals into one in-flight and one pending request', async (t) => {
  const binding = createBinding();
  let resolveFirstAnnotation;
  const firstPromise = new Promise(resolve => { resolveFirstAnnotation = resolve; });
  const annotationCalls = [];

  const runAnnotation = async ({ prompt }) => {
    annotationCalls.push(prompt);
    if (annotationCalls.length === 1) {
      await firstPromise;
    }
    return {
      proposals: [
        {
          localAlias: `alias-${annotationCalls.length}`,
          kind: 'literal',
          quote: 'A figure pours one pitcher into a pool.',
          targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }]
        }
      ]
    };
  };

  const { job, waitUntilPromises } = await createJob(t, { runAnnotation });
  await job.fetch(new Request('https://reading-visual-jobs/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      visualToken: 'tok-1',
      validationContext: { cards: CARDS }
    })
  }));

  // First delta: starts in-flight annotation
  await job.fetch(new Request('https://reading-visual-jobs/observe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      raw: 'A figure pours one pitcher into a pool.',
      deliveredEventId: 1,
      complete: false
    })
  }));
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(annotationCalls.length, 1);
  assert.ok(job.inFlightRequest, 'first request is in flight');

  // Second and third deltas arrive while first is in-flight: should coalesce into pendingSnapshot
  await job.fetch(new Request('https://reading-visual-jobs/observe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      raw: 'A figure pours one pitcher into a pool. Second delta.',
      deliveredEventId: 2,
      complete: false
    })
  }));

  await job.fetch(new Request('https://reading-visual-jobs/observe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      raw: 'A figure pours one pitcher into a pool. Second delta. Third completed delta.',
      deliveredEventId: 3,
      complete: true
    })
  }));

  assert.equal(annotationCalls.length, 1, 'subsequent deltas coalesced without starting second in-flight');
  assert.ok(job.pendingSnapshot, 'latest snapshot is pending');
  assert.equal(job.pendingSnapshot.raw, 'A figure pours one pitcher into a pool. Second delta. Third completed delta.');
  assert.equal(job.pendingSnapshot.complete, true);

  // Now resolve first annotation
  resolveFirstAnnotation();
  await Promise.all(waitUntilPromises);

  // The pending snapshot should now run as the second annotation
  assert.equal(annotationCalls.length, 2);
  assert.equal(job.ledger.cues.length, 1);
  assert.equal(job.status, 'complete');
});

test('eviction recovery rejects old recovery-epoch responses and recovers pending snapshot', async (t) => {
  const binding = createBinding();
  const storedJob = {
    binding,
    visualToken: 'tok-recover',
    ownerUserId: 'user-1',
    validationContext: { cards: CARDS },
    ledger: createVisualCueLedger(binding),
    authoritativeRaw: 'Initial prose with pending additions.',
    isComplete: true,
    status: 'running',
    inFlightRequest: {
      batchId: 'old-batch',
      requestSequence: 1,
      analyzedEnd: 14,
      analyzedHash: await hashVisualCueText('Initial prose.'),
      baseLedgerRevision: 0,
      recoveryEpoch: 1
    },
    pendingSnapshot: {
      raw: 'Initial prose with pending additions.',
      complete: true,
      deliveredEventId: 2,
      availableAt: 2000
    },
    recoveryEpoch: 1,
    requestRegistry: [],
    events: [],
    nextEventId: 1
  };

  let annotationRan = false;
  const runAnnotation = async () => {
    annotationRan = true;
    return { proposals: [] };
  };

  // Re-instantiate job from stored state (eviction recovery)
  const { job, waitUntilPromises } = await createJob(t, { stored: storedJob, runAnnotation });

  // Recovery epoch should have incremented
  assert.equal(job.recoveryEpoch, 2);

  // Trying to commit an old recovery epoch (epoch 1) must be rejected
  const oldCommitResult = await job.commitBatch({
    issuedRequest: storedJob.inFlightRequest,
    response: { proposals: [] },
    recoveryEpoch: 1
  });
  assert.equal(oldCommitResult.ok, false);
  assert.equal(oldCommitResult.reason, 'stale-epoch');

  // Let background pendingSnapshot run
  await Promise.all(waitUntilPromises);
  assert.equal(annotationRan, true);
  assert.equal(job.status, 'complete');
  assert.equal(job.ledger.raw, storedJob.authoritativeRaw);
});

test('cancellation keeps accepted cues and halts pending work', async (t) => {
  const binding = createBinding();
  const { job } = await createJob(t);
  await job.fetch(new Request('https://reading-visual-jobs/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      visualToken: 'tok-cancel',
      validationContext: { cards: CARDS }
    })
  }));

  // Add an accepted cue directly to ledger
  job.ledger.cues.push({
    id: 'vc:test1',
    kind: 'literal',
    passage: { start: 0, end: 10, quote: 'Some quote' },
    targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: ['pool-pour'] }]
  });
  job.ledger.ledgerRevision = 1;
  job.pendingSnapshot = { raw: 'Unprocessed text', complete: true, deliveredEventId: 5, availableAt: 100 };

  const cancelRes = await job.fetch(new Request('https://reading-visual-jobs/cancel', {
    method: 'POST',
    headers: { 'X-Visual-Token': 'tok-cancel' }
  }));
  assert.equal(cancelRes.status, 200);
  assert.equal(job.status, 'cancelled');
  assert.equal(job.pendingSnapshot, null, 'pending work was cleared');
  assert.equal(job.ledger.cues.length, 1, 'accepted cues survive cancellation');
});

test('missing model configuration fails closed without provider fallback', async (t) => {
  const binding = createBinding();
  // env has NO visual model configured and no runAnnotation provided
  const { job, waitUntilPromises } = await createJob(t, { env: {} });
  await job.fetch(new Request('https://reading-visual-jobs/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      visualToken: 'tok-missing-cfg',
      validationContext: { cards: CARDS }
    })
  }));

  await job.fetch(new Request('https://reading-visual-jobs/observe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      raw: 'Prose text',
      deliveredEventId: 1,
      complete: true
    })
  }));

  await Promise.all(waitUntilPromises);
  assert.equal(job.status, 'failed');
  assert.match(job.error || '', /not configured/i);
  assert.equal(job.ledger.cues.length, 0);
});

const LITERAL_RAW = 'A figure pours one pitcher into a pool.';
const LITERAL_RESPONSE = { proposals: [{ localAlias: 'pour', kind: 'literal', quote: LITERAL_RAW,
  targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] };
async function until(predicate) {
  const deadline = Date.now() + 1000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Controlled adapter did not reach expected phase');
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}
async function init(job, binding = createBinding()) {
  const response = await job.fetch(new Request('https://visual/init', { method: 'POST',
    body: JSON.stringify({ binding, visualToken: 'lifecycle-token', validationContext: { cards: CARDS } }) }));
  assert.equal(response.status, 200);
  return binding;
}
const observe = (job, binding, raw, deliveredEventId, complete = false) => job.fetch(new Request('https://visual/observe', {
  method: 'POST', body: JSON.stringify({ binding, raw, deliveredEventId, complete })
}));

test('simultaneous observations reserve one request before digest and retain cumulative receipts', async t => {
  let release;
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const { job, waitUntilPromises } = await createJob(t, { runAnnotation: async () => {
    calls++;
    maximum = Math.max(maximum, ++active);
    await gate;
    active--;
    return LITERAL_RESPONSE;
  } });
  const binding = await init(job);
  await Promise.all([observe(job, binding, LITERAL_RAW, 1), observe(job, binding, `${LITERAL_RAW} More.`, 2),
    observe(job, binding, `${LITERAL_RAW} More. Done.`, 3, true)]);
  await until(() => calls === 1);
  assert.equal(calls, 1);
  assert.equal(job.pendingSnapshot.raw, `${LITERAL_RAW} More. Done.`);
  release();
  await Promise.all(waitUntilPromises);
  assert.equal(maximum, 1);
  assert.equal(calls, 2);
  assert.equal(job.ledger.receipts.length, 2);
  assert.equal(job.ledger.cues.length, 1);
  assert.equal(job.ledger.raw, `${LITERAL_RAW} More. Done.`);
});

test('failed request continues with the latest coalesced source, without retrying a backlog', async t => {
  let rejectFirst;
  let calls = 0;
  const { job, waitUntilPromises } = await createJob(t, { runAnnotation: () => {
    if (++calls === 1) return new Promise((_resolve, reject) => { rejectFirst = reject; });
    return LITERAL_RESPONSE;
  } });
  const binding = await init(job);
  await observe(job, binding, LITERAL_RAW, 1);
  await until(() => rejectFirst);
  await observe(job, binding, `${LITERAL_RAW} Last.`, 2, true);
  rejectFirst(new Error('Controlled adapter failure'));
  await Promise.all(waitUntilPromises);
  assert.equal(calls, 2);
  assert.equal(job.status, 'complete');
  assert.equal(job.error, null);
  assert.equal(job.ledger.raw, `${LITERAL_RAW} Last.`);
  assert.equal(job.ledger.receipts.length, 1);
});

test('duplicate callback is idempotent and cannot clear a newer request', async t => {
  let releaseSecond;
  let calls = 0;
  const { job, waitUntilPromises } = await createJob(t, { runAnnotation: () => {
    if (++calls === 1) return LITERAL_RESPONSE;
    return new Promise(resolve => { releaseSecond = resolve; });
  } });
  const binding = await init(job);
  await observe(job, binding, LITERAL_RAW, 1);
  await Promise.all(waitUntilPromises);
  const request = { ...job.requestRegistry[0], status: 'active' };
  await observe(job, binding, `${LITERAL_RAW} Later.`, 2, true);
  await until(() => releaseSecond);
  const newerId = job.inFlightRequest.batchId;
  const count = job.events.length;
  const duplicate = await job.commitBatch({ issuedRequest: request, response: LITERAL_RESPONSE, recoveryEpoch: job.recoveryEpoch });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.result.duplicate, true);
  assert.equal(job.inFlightRequest.batchId, newerId);
  assert.equal(job.events.length, count);
  releaseSecond(LITERAL_RESPONSE);
  await Promise.all(waitUntilPromises);
});

test('request registry rejects unknown or tampered requests even with a valid epoch', async t => {
  const { job } = await createJob(t);
  const binding = await init(job);
  job.authoritativeRaw = LITERAL_RAW;
  const issued = { binding, status: 'active', batchId: 'never-issued', requestSequence: 1,
    analyzedEnd: LITERAL_RAW.length, analyzedHash: await hashVisualCueText(LITERAL_RAW), baseLedgerRevision: 0 };
  const unregistered = await job.commitBatch({ issuedRequest: issued, response: LITERAL_RESPONSE, recoveryEpoch: job.recoveryEpoch });
  assert.equal(unregistered.reason, 'unregistered-request');
  job.requestRegistry.push({ ...issued });
  const altered = await job.commitBatch({ issuedRequest: { ...issued, analyzedEnd: issued.analyzedEnd - 1 },
    response: LITERAL_RESPONSE, recoveryEpoch: job.recoveryEpoch });
  assert.equal(altered.reason, 'unregistered-request');
  assert.equal(job.ledger.receipts.length, 0);
});

test('source replacement aborts old work; late callback cannot overwrite the new ledger', async t => {
  let releaseFirst;
  let oldSignal;
  let calls = 0;
  const { job, waitUntilPromises } = await createJob(t, { runAnnotation: ({ signal }) => {
    if (++calls === 1) {
      oldSignal = signal;
      return new Promise(resolve => { releaseFirst = resolve; });
    }
    return { proposals: [] };
  } });
  const binding = await init(job);
  await observe(job, binding, LITERAL_RAW, 1);
  await until(() => releaseFirst);
  await observe(job, { ...binding, sourceRevision: 1 }, 'A different reading.', 2, true);
  releaseFirst(LITERAL_RESPONSE);
  await Promise.all(waitUntilPromises);
  assert.equal(oldSignal.aborted, true);
  assert.equal(job.binding.sourceRevision, 1);
  assert.equal(job.ledger.binding.sourceRevision, 1);
  assert.equal(job.ledger.raw, 'A different reading.');
  assert.equal(job.ledger.cues.length, 0);
  assert.equal(job.status, 'complete');
});

test('out-of-order observations and arbitrary bindings cannot replace an accepted source', async t => {
  const { job, waitUntilPromises } = await createJob(t, { runAnnotation: () => ({ proposals: [] }) });
  const binding = await init(job);
  await observe(job, binding, LITERAL_RAW, 2);
  assert.equal((await observe(job, binding, 'Old', 1)).status, 202);
  assert.equal(job.authoritativeRaw, LITERAL_RAW);
  assert.equal((await observe(job, { ...binding, spreadHash: 'a'.repeat(64) }, `${LITERAL_RAW} Added`, 3)).status, 409);
  assert.equal((await observe(job, { ...binding, readingResultId: 'different', sourceRevision: 1 }, 'Unrelated', 3)).status, 409);
  assert.equal((await observe(job, binding, 'Silent replacement', 4)).status, 409);
  await Promise.all(waitUntilPromises);
});

test('cumulative events and completed stream use durable full ledger snapshots and close', async t => {
  const { job, waitUntilPromises, getStorage } = await createJob(t, { runAnnotation: () => LITERAL_RESPONSE });
  const binding = await init(job);
  const published = [];
  job.subscribers.add({ controller: { enqueue(bytes) {
    const text = new TextDecoder().decode(bytes);
    const data = JSON.parse(text.split('data: ')[1]);
    assert.deepEqual(data.cueLedger, getStorage().ledger);
    assert.equal(data.status, getStorage().status);
    published.push(data);
  }, close() {} } });
  await observe(job, binding, LITERAL_RAW, 1, true);
  await Promise.all(waitUntilPromises);
  assert.equal(published.length, 2);
  const stream = await job.fetch(new Request('https://visual/stream?cursor=999', { headers: { 'X-Visual-Token': 'lifecycle-token' } }));
  const text = await stream.text();
  assert.match(text, /event: snapshot/);
  assert.match(text, /event: done/);
  assert.match(text, /"raw":"A figure pours one pitcher into a pool\."/);
  assert.equal(job.subscribers.size, 0);
});

test('revoke permanently closes private access and cannot be resurrected by initialization or a late callback', async t => {
  let release;
  const { job, waitUntilPromises, getStorage } = await createJob(t, { runAnnotation: () => new Promise(resolve => { release = resolve; }) });
  const binding = await init(job);
  await observe(job, binding, LITERAL_RAW, 1, true);
  await until(() => release);
  await job.fetch(new Request('https://visual/revoke', { method: 'POST' }));
  release(LITERAL_RESPONSE);
  await Promise.all(waitUntilPromises);
  assert.equal(job.status, 'revoked');
  assert.equal(job.ledger, null);
  assert.equal(job.authoritativeRaw, '');
  assert.equal(getStorage().visualToken, null);
  assert.equal((await job.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': 'lifecycle-token' } }))).status, 410);
  assert.equal((await job.fetch(new Request('https://visual/init', { method: 'POST',
    body: JSON.stringify({ binding, visualToken: 'lifecycle-token', validationContext: { cards: CARDS } }) }))).status, 410);
});

test('expiry alarm removes unsaved private state and rejects old capability', async t => {
  const { job, getStorage } = await createJob(t);
  await init(job);
  job.expiresAt = Date.now() - 1;
  await job.alarm();
  assert.equal(job.status, 'expired');
  assert.equal(getStorage().ledger, null);
  assert.equal(getStorage().visualToken, null);
  assert.equal((await job.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': 'lifecycle-token' } }))).status, 410);
});

test('recovery adopts a D1 commit made just before DO storage failure', async t => {
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const { registerVisualResult, updateVisualResultSource, commitVisualResult } = await import('../functions/lib/readingVisualResults.js');
  const db = await createD1();
  t.after(() => db.sqlite.close());
  const binding = createBinding('recovered-durable-result');
  await registerVisualResult({ db, readingResultId: binding.readingResultId, binding });
  await updateVisualResultSource({ db, readingResultId: binding.readingResultId, binding, raw: LITERAL_RAW, complete: true });
  const initial = createVisualCueLedger(binding);
  const { applyVisualCueBatch } = await import('../shared/reading/visualCueLedger.js');
  const request = { binding, status: 'active', batchId: 'persisted-first', requestSequence: 1,
    analyzedEnd: LITERAL_RAW.length, analyzedHash: await hashVisualCueText(LITERAL_RAW), baseLedgerRevision: 0 };
  const committed = await applyVisualCueBatch({ ledger: initial, issuedRequest: request,
    response: LITERAL_RESPONSE, authoritativeRaw: LITERAL_RAW,
    validationContext: { cards: CARDS, getSupportedDetails: () => [{ id: 'pool-pour' }] } });
  assert.equal(committed.ledger.cues.length, 1);
  assert.equal((await commitVisualResult({ db, readingResultId: binding.readingResultId, binding,
    expectedLedgerRevision: 0, ledger: committed.ledger, status: 'complete', finalRaw: LITERAL_RAW })).ok, true);
  const { job, waitUntilPromises } = await createJob(t, { env: { DB: db }, stored: {
    binding, visualToken: 'lifecycle-token', validationContext: { cards: CARDS },
    ledger: initial, authoritativeRaw: LITERAL_RAW, isComplete: true, status: 'running',
    inFlightRequest: request, requestRegistry: [request], recoveryEpoch: 1
  }, runAnnotation: () => { assert.fail('Already committed source must not be re-annotated'); } });
  await Promise.all(waitUntilPromises);
  assert.deepEqual(job.ledger, committed.ledger);
  assert.equal(job.status, 'complete');
});

test('deleted owner invalidates a capability even if account deletion missed its initialization race', async t => {
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const { seedUser } = await import('./helpers/journalFixtures.mjs');
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: 'deleted-owner' });
  const { job, getStorage } = await createJob(t, { env: { DB: db } });
  await job.fetch(new Request('https://visual/init', { method: 'POST', body: JSON.stringify({
    binding: createBinding('owner-race'), visualToken: 'private-owner-token', ownerUserId: 'deleted-owner', validationContext: { cards: CARDS }
  }) }));
  await db.prepare('DELETE FROM reading_visual_results WHERE user_id = ?').bind('deleted-owner').run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind('deleted-owner').run();
  const response = await job.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': 'private-owner-token' } }));
  assert.equal(response.status, 410);
  assert.equal(job.status, 'revoked');
  assert.equal(getStorage().visualToken, null);
  assert.equal(getStorage().ledger, null);
});

for (const ownerUserId of ['surviving-owner', null]) {
  test(`deleted durable result rejects its old capability even before DO revocation (${ownerUserId || 'guest'})`, async t => {
    const { createD1 } = await import('./helpers/d1Sqlite.mjs');
    const { seedUser } = await import('./helpers/journalFixtures.mjs');
    const db = await createD1();
    t.after(() => db.sqlite.close());
    if (ownerUserId) await seedUser(db, { id: ownerUserId });
    const { job, getStorage } = await createJob(t, { env: { DB: db } });
    const binding = createBinding(`deleted-result-${ownerUserId || 'guest'}`);
    await job.fetch(new Request('https://visual/init', { method: 'POST', body: JSON.stringify({
      binding, visualToken: 'deleted-result-token', ownerUserId, validationContext: { cards: CARDS }
    }) }));
    await db.prepare('DELETE FROM reading_visual_results WHERE id = ?').bind(binding.readingResultId).run();
    if (ownerUserId) assert.ok(await db.prepare('SELECT id FROM users WHERE id = ?').bind(ownerUserId).first());
    const response = await job.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': 'deleted-result-token' } }));
    assert.equal(response.status, 410);
    assert.equal(job.status, 'revoked');
    assert.equal(getStorage().visualToken, null);
    assert.equal(getStorage().ledger, null);
    assert.equal((await job.fetch(new Request('https://visual/stream', { headers: { 'X-Visual-Token': 'deleted-result-token' } }))).status, 410);
  });
}

test('reading an uninitialized visual result cannot prevent its later trusted initialization', async t => {
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const db = await createD1();
  t.after(() => db.sqlite.close());
  const { job } = await createJob(t, { env: { DB: db } });
  assert.equal((await job.fetch(new Request('https://visual/snapshot'))).status, 503);
  assert.equal(job.status, 'pending');
  await init(job);
  assert.equal(job.status, 'running');
});

test('real start exposes retryable visual transport while optional initialization is held', async t => {
  const { startReadingJob } = await import('../functions/lib/readingJobs.js');
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile(new URL('../output/reading-motion/fixtures/three-card-transition.json', import.meta.url), 'utf8'));
  let releaseInit;
  const gate = new Promise(resolve => { releaseInit = resolve; });
  const background = [];
  const { job } = await createJob(t);
  t.after(() => { releaseInit(); job.closeSubscribers(); });
  const result = await startReadingJob({
    payload: { spreadInfo: { name: fixture.spreadName, key: fixture.spreadKey },
      cardsInfo: fixture.cards.map(card => ({ ...card, meaning: 'Controlled schema-required fixture value.', userReflection: null })),
      userQuestion: fixture.userQuestion, reflectionsText: fixture.reflectionsText, deckStyle: fixture.deckStyle },
    waitUntil: promise => background.push(promise),
    env: {
      VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/model',
      AI: { run: async () => { throw new Error('Initialization must not perform inference'); } },
      READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => Response.json({ ok: true }) }) },
      READING_VISUAL_JOBS: { idFromName: id => id, get: () => ({ fetch: async (url, options) => {
        if (new URL(url).pathname === '/init') await gate;
        return job.fetch(new Request(url, options));
      } }) }
    }
  });
  assert.equal(result.ok, true, 'Narrative starts before visual initialization resolves');
  const headers = { 'X-Visual-Token': result.visualJobToken };
  for (const route of ['snapshot', 'stream']) {
    const response = await job.fetch(new Request(`https://visual/${route}`, { headers }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Visual job initialization is pending. Retry shortly.' });
  }
  releaseInit();
  await Promise.all(background);
  assert.equal((await job.fetch(new Request('https://visual/snapshot', { headers }))).status, 200);
  const stream = await job.fetch(new Request('https://visual/stream', { headers }));
  assert.equal(stream.status, 200);
  await stream.body.cancel();
  assert.equal((await job.fetch(new Request('https://visual/stream', { headers: { 'X-Visual-Token': 'wrong-token' } }))).status, 403);
});

test('accepted cues remain readable through snapshot and stream after provider configuration is removed', async t => {
  let inferenceCalls = 0;
  const env = { VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/model',
    AI: { run: async () => { inferenceCalls++; return { response: LITERAL_RESPONSE }; } } };
  const { job, waitUntilPromises, getStorage } = await createJob(t, { env });
  const binding = await init(job);
  await observe(job, binding, LITERAL_RAW, 1, true);
  await Promise.all(waitUntilPromises);
  assert.equal(inferenceCalls, 1);
  assert.equal(job.status, 'complete');
  assert.equal(job.ledger.cues.length, 1);
  const accepted = structuredClone(job.ledger.cues);
  const revision = job.ledger.ledgerRevision;
  const stored = getStorage();
  delete env.VISUAL_CUE_PROVIDER;
  delete env.VISUAL_CUE_MODEL;
  delete env.AI;
  const { job: restored } = await createJob(t, { stored, env });
  const headers = { 'X-Visual-Token': 'lifecycle-token' };
  for (const target of [job, restored]) {
    for (const path of ['snapshot', 'status']) {
      const response = await target.fetch(new Request(`https://visual/${path}`, { headers }));
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.deepEqual(data.cues, accepted);
      assert.equal(data.ledgerRevision, revision);
    }
    const response = await target.fetch(new Request('https://visual/stream', { headers }));
    assert.equal(response.status, 200);
    const stream = await response.text();
    const data = JSON.parse(stream.split('\n').find(line => line.startsWith('data: ')).slice(6));
    assert.deepEqual(data.cues, accepted);
    assert.equal(data.ledgerRevision, revision);
    assert.equal((await target.fetch(new Request('https://visual/snapshot'))).status, 401);
    assert.equal((await target.fetch(new Request('https://visual/stream', { headers: { 'X-Visual-Token': 'wrong' } }))).status, 403);
  }
  assert.equal(inferenceCalls, 1, 'Reading accepted cues never starts new inference');
});

test('cold-start pending work without a provider fails without erasing accepted cues', async t => {
  const { job, waitUntilPromises, getStorage } = await createJob(t, { runAnnotation: async () => LITERAL_RESPONSE });
  const binding = await init(job);
  await observe(job, binding, LITERAL_RAW, 1, true);
  await Promise.all(waitUntilPromises);
  const stored = getStorage();
  const accepted = structuredClone(stored.ledger.cues);
  stored.status = 'running';
  stored.isComplete = false;
  stored.authoritativeRaw = `${LITERAL_RAW} A later sentence.`;
  stored.pendingSnapshot = { raw: stored.authoritativeRaw, complete: true, deliveredEventId: 2, availableAt: 1000 };
  let inferenceCalls = 0;
  const { job: recovered, waitUntilPromises: recovery } = await createJob(t, { stored,
    env: { AI: { run: async () => { inferenceCalls++; return { response: LITERAL_RESPONSE }; } } } });
  await Promise.all(recovery);
  assert.equal(inferenceCalls, 0);
  assert.equal(recovered.status, 'failed');
  const response = await recovered.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': 'lifecycle-token' } }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).cues, accepted);
});
