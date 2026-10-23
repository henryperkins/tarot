import { installJournalLocks } from './helpers/journalHookDriver.mjs';
const modelClientEnv = { DEV: false, MODE: 'production', VITE_READING_ALIGNER_ENABLED: 'true', VITE_READING_MODEL_ANNOTATIONS: 'true' };
// Task 11 client <-> server contract. The browser-side recovery functions talk to
// the real Task 9/10 route handlers over an injected fetch. D1 is in-process
// SQLite with every migration; the DO is the real ReadingVisualJob class with
// in-memory storage; the visual provider (env.AI) and the guest trusted-edge
// identity are fakes. Sessions are seeded fixture rows, not real accounts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser } from './helpers/journalFixtures.mjs';
import { ReadingVisualJob } from '../src/worker/readingVisualJob.js';
import * as localRetryRoute from '../functions/api/reading-visual-retry.js';
import * as replayRoute from '../functions/api/reading-visual-replay.js';
import * as cloudRetryRoute from '../functions/api/journal/[id]/visual-retry.js';
import * as entryRoute from '../functions/api/journal/[id].js';
import * as journalRoute from '../functions/api/journal.js';
import { readVisualJobEvents, isVisualJobTerminal, postSavedVisualRetry } from '../src/lib/readingVisualStream.js';
import { requestSavedVisualRetry, adoptSavedVisualReplay, readVisualResume, readSavedVisualEntry, savedVisualRecovery,
  projectJournalEntryVisuals, mergeCachedJournalVisuals, savedVisualSourceKey, adoptEntryVisuals, needsCloudVisualRefresh,
  fingerprintSavedVisualEntry, publicVisualSnapshot, savedVisualSource } from '../src/lib/readingVisualStorage.js';
import { hydrateEntryVisuals } from '../src/utils/journalStorage.js';

const RAW = 'The Star pours into a pool. Words such as visualJobToken and attemptId remain ordinary prose here.';
const CARDS = [{ name: 'The Star', position: 'Present', orientation: 'Upright' }];
const PROPOSALS = { response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: 'pours into a pool',
  targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] } };

function memoryStorage() {
  const map = new Map();
  return { get length() { return map.size; }, key: index => [...map.keys()][index],
    getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}

async function fixture(t, { response = PROPOSALS, limits = true, user = true } = {}) {
  const db = await createD1(); t.after(() => db.sqlite.close());
  if (user) { await seedUser(db); await seedSession(db, { id: 'session-1', userId: 'user-1' }); }
  const jobs = new Map(); const pending = []; let calls = 0;
  const env = { DB: db, VISUAL_CUE_ALLOWED_TIERS: '["plus","pro"]', VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake',
    ...(limits ? { VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }) } : {}),
    VISUAL_REPLAY_TRUSTED_IDENTITY: { resolve: async () => 'controlled-loopback-guest' },
    AI: { async run(...args) { calls++; return typeof response === 'function' ? response(...args) : response; } } };
  env.READING_VISUAL_JOBS = { idFromName: id => id, get(id) {
    if (!jobs.has(id)) {
      let stored;
      const state = { storage: { get: async () => stored, put: async (_, value) => { stored = structuredClone(value); }, setAlarm: async () => {} },
        blockConcurrencyWhile: fn => fn(), waitUntil: promise => pending.push(promise) };
      jobs.set(id, new ReadingVisualJob(state, env));
    }
    return { fetch: (url, options) => jobs.get(id).fetch(new Request(url, options)) };
  } };
  const requests = [];
  // Browser-side fetch: relative URLs go to the real route handlers. The guest
  // principal cookie is carried by this emulated jar (HttpOnly/Secure cookies
  // are a browser concern, not part of this contract).
  const api = ({ session = null } = {}) => {
    const jar = { principal: null };
    return async (url, init = {}) => {
      const absolute = new URL(url, 'https://tableu.test');
      const headers = new Headers(init.headers || {});
      // This injected browser represents the explicitly enabled cue-display build.
      headers.set('X-Reading-Cue-Display', '1');
      const cookies = [session && `session=${session}`, jar.principal && `visual_replay_principal=${jar.principal}`].filter(Boolean);
      if (cookies.length) headers.set('Cookie', cookies.join('; '));
      const method = init.method || 'GET';
      const request = new Request(absolute, { method, headers, body: init.body, signal: init.signal });
      requests.push({ method, path: absolute.pathname });
      let match; let result;
      if (absolute.pathname === '/api/journal') result = await journalRoute.onRequestGet({ env, request });
      else if (absolute.pathname === '/api/tarot-reading/visual-retry') result = await localRetryRoute.onRequestPost({ env, request });
      else if ((match = absolute.pathname.match(/^\/api\/journal\/([^/]+)\/visual-retry$/))) {
        result = await cloudRetryRoute.onRequestPost({ env, request, params: { entryId: decodeURIComponent(match[1]) } });
      } else if ((match = absolute.pathname.match(/^\/api\/tarot-reading\/visual-replays\/([^/]+)(?:\/(?:stream|cancel))?$/))) {
        result = await replayRoute[method === 'POST' ? 'onRequestPost' : 'onRequestGet']({ env, request, params: { visualJobId: decodeURIComponent(match[1]) } });
      } else if ((match = absolute.pathname.match(/^\/api\/journal\/([^/]+)$/))) {
        result = await entryRoute.onRequestGet({ env, request, params: { id: decodeURIComponent(match[1]) } });
      } else throw new Error(`Unexpected API ${absolute.pathname}`);
      const principal = result.headers.get('Set-Cookie')?.match(/visual_replay_principal=([^;]+)/)?.[1];
      if (principal) jar.principal = principal;
      return result;
    };
  };
  const drain = async () => { while (pending.length) await Promise.all(pending.splice(0)); };
  return { env, db, api, drain, requests, calls: () => calls };
}

async function subscribeAndSettle({ namespace, entryId, fetchImpl, storage, cloud = false }) {
  const handle = readVisualResume({ namespace, entryId, storage });
  assert.ok(handle, 'a durable private replay handle exists before subscription');
  for await (const { data } of readVisualJobEvents({ env: modelClientEnv, readingResultId: handle.readingResultId, visualJobId: handle.visualJobId,
    visualJobToken: handle.visualJobToken, fetchImpl, retryDelay: 0 })) {
    if (isVisualJobTerminal(data.status)) {
      return adoptSavedVisualReplay({ namespace, entryId, resume: handle, cueLedger: data.cueLedger, status: data.status, cloud, storage });
    }
  }
  throw new Error('Replay stream ended without a terminal state.');
}

const localEntry = (overrides = {}) => ({ id: 'local-guest', ts: 1, personalReading: RAW, cards: CARDS, deckId: 'rws-1909',
  question: 'What renews me?', reflections: { Overall: 'Hope' }, spread: 'One card', spreadKey: 'single', ...overrides });

for (const guest of [true, false]) test(`${guest ? 'guest' : 'free'} local retry preserves saved prose without model dispatch`, async t => {
  const f = await fixture(t, { user: !guest });
  if (!guest) await f.db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'inactive' WHERE id = 'user-1'").run();
  const store = memoryStorage(), entry = localEntry({ id: 'local-unentitled' });
  const namespace = guest ? 'anon' : 'user:user-1';
  store.setItem(guest ? 'tarot_journal' : 'tarot_journal_user-1', JSON.stringify([entry]));
  const fetchImpl = f.api({ session: guest ? null : 'session-1' });
  const result = await requestSavedVisualRetry({ env: modelClientEnv, namespace, entry, fetchImpl, storage: store });
  await f.drain(); assert.equal(result.state.retryStatus, 'unavailable'); assert.equal(f.calls(), 0);
  assert.equal(f.db.rows('SELECT * FROM visual_retry_claims').length, 0);
  assert.equal(readVisualResume({ namespace, entryId: entry.id, storage: store }), null);
  assert.equal(readSavedVisualEntry({ namespace, entryId: entry.id, storage: store }).personalReading, RAW);
});

test('paid local expiry: one explicit retry claims once, replay transport adopts static cues, repeats never dispatch again', async t => {
  const f = await fixture(t);
  const store = memoryStorage();
  const entry = localEntry();
  store.setItem('tarot_journal_user-1', JSON.stringify([entry]));
  const fetchImpl = f.api({ session: 'session-1' });
  assert.equal(savedVisualRecovery(entry).canRetry, true);
  const result = await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry, fetchImpl, storage: store });
  // Claim/status are durable before the action resolves; the capability is private.
  assert.equal(result.state.retryStatus, 'pending');
  const pending = readSavedVisualEntry({ namespace: 'user:user-1', entryId: entry.id, storage: store });
  assert.equal(pending.visualState.retryStatus, 'pending');
  const handle = readVisualResume({ namespace: 'user:user-1', entryId: entry.id, storage: store });
  assert.equal(JSON.stringify(pending).includes(handle.visualJobToken), false);
  assert.equal(JSON.stringify(pending).includes(handle.attemptId), false);
  await f.drain();
  assert.equal(f.calls(), 1);
  const settled = await subscribeAndSettle({ namespace: 'user:user-1', entryId: entry.id, fetchImpl, storage: store });
  assert.equal(settled.adopted, true);
  const adopted = readSavedVisualEntry({ namespace: 'user:user-1', entryId: entry.id, storage: store });
  assert.equal(adopted.personalReading, RAW);
  assert.equal(adopted.visualState.retryStatus, 'complete');
  assert.equal(savedVisualRecovery(adopted).phase, 'complete');
  const restored = hydrateEntryVisuals(adopted);
  assert.equal(restored.hasVisuals, true);
  assert.equal(restored.cues[0].passage.quote, 'pours into a pool');
  assert.equal(readVisualResume({ namespace: 'user:user-1', entryId: entry.id, storage: store }), null);
  // A second explicit request for the same source (another tab, or reload that
  // lost local state) returns the existing claim and never dispatches again.
  const again = await postSavedVisualRetry({ env: modelClientEnv, savedSource: { raw: RAW, cards: CARDS, deckId: 'rws-1909', question: 'What renews me?', reflections: { Overall: 'Hope' } }, fetchImpl });
  assert.equal(again.state.retryStatus, 'complete');
  await f.drain();
  assert.equal(f.calls(), 1);
  // Exactly the two explicit POSTs; the transport was GET-only.
  assert.deepEqual(f.requests.filter(request => request.method === 'POST').map(request => request.path),
    ['/api/tarot-reading/visual-retry', '/api/tarot-reading/visual-retry']);
  assert.equal(f.requests.filter(request => request.path.startsWith('/api/tarot-reading/visual-replays/')).every(request => request.method === 'GET'), true);
});

test('paid local entitlement lane: authenticated web admission, one dispatch across duplicate clicks', async t => {
  const f = await fixture(t);
  const store = memoryStorage();
  const entry = localEntry({ id: 'local-plus' });
  store.setItem('tarot_journal_user-1', JSON.stringify([entry]));
  const namespace = 'user:user-1';
  const fetchImpl = f.api({ session: 'session-1' });
  const [first, second] = await Promise.all([requestSavedVisualRetry({ env: modelClientEnv, namespace, entry, fetchImpl, storage: store }),
    requestSavedVisualRetry({ env: modelClientEnv, namespace, entry, fetchImpl, storage: store }).catch(error => error)]);
  assert.equal(first.state.retryStatus, 'pending');
  // The racing duplicate converges on the same stored claim (or is fenced as stale), never a second claim.
  assert.ok(second.state?.retryStatus === 'pending' || second.code === 'stale');
  await f.drain();
  assert.equal(f.calls(), 1);
  assert.equal(f.db.rows('SELECT admission_scope FROM visual_retry_claims')[0].admission_scope, 'user:user-1');
  assert.equal((await subscribeAndSettle({ namespace, entryId: entry.id, fetchImpl, storage: store })).adopted, true);
  assert.equal(hydrateEntryVisuals(readSavedVisualEntry({ namespace, entryId: entry.id, storage: store })).hasVisuals, true);
});

async function seedCloudFailure(f, { registered = false, expired = false } = {}) {
  await seedEntry(f.db, { id: 'cloud-1', cards: CARDS, narrative: RAW, reflections: { Overall: 'Hope' }, deckId: 'rws-1909' });
  const lib = await import('../functions/lib/readingVisualResults.js');
  const owned = await lib.loadOwnedJournalVisualSource({ db: f.db, userId: 'user-1', entryId: 'cloud-1' });
  const fingerprint = await lib.fingerprintSavedVisualSource(owned);
  let readingResultId = null;
  if (registered) {
    const { createVisualCueLedger, applyVisualCueBatch } = await import('../shared/reading/visualCueLedger.js');
    const { hashVisualCueText } = await import('../shared/contracts/visualCueBatches.js');
    const hashes = await lib.computeSourceFingerprint(owned.source);
    const binding = { readingResultId: 'owned-original', sourceRevision: 0, spreadHash: hashes.spreadHash, contextHash: hashes.contextHash,
      artworkEdition: owned.artworkEdition, catalogVersion: owned.catalogVersion };
    await lib.registerVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding });
    await lib.updateVisualResultSource({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, raw: RAW, complete: true });
    const accepted = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: RAW,
      issuedRequest: { binding, status: 'active', batchId: 'original', requestSequence: 1, analyzedEnd: RAW.length, analyzedHash: await hashVisualCueText(RAW), baseLedgerRevision: 0 },
      response: PROPOSALS.response, validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], getSupportedDetails: () => ['pool-pour'] } });
    await lib.commitVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, ledger: accepted.ledger, expectedLedgerRevision: 0, finalRaw: RAW });
    if (expired) await f.db.prepare("UPDATE reading_visual_results SET status = 'pending', expires_at = ? WHERE id = ?")
      .bind(Date.now() - 1, binding.readingResultId).run();
    readingResultId = binding.readingResultId;
  }
  await lib.persistJournalVisualState({ db: f.db, userId: 'user-1', entryId: 'cloud-1', sourceFingerprint: fingerprint,
    attachmentStatus: 'failed', reason: 'attachment-error', readingResultId });
  return { lib, fingerprint };
}

async function loadCloudEntry(fetchImpl, cached = null) {
  const response = await fetchImpl('/api/journal/cloud-1?includeFollowups=true');
  assert.equal(response.status, 200);
  const { entry } = await response.json();
  return mergeCachedJournalVisuals(projectJournalEntryVisuals(entry), cached);
}

function cloudCommit(memory) {
  return ({ entryId, sourceKey, update }) => {
    const current = memory.entries.find(item => item.id === entryId);
    if (!current) return { committed: false, reason: 'entry-not-found', entry: null };
    if (savedVisualSourceKey(current) !== sourceKey) return { committed: false, reason: 'source-changed', entry: current };
    const next = update(current);
    if (!next) return { committed: false, reason: 'unchanged', entry: current };
    memory.entries = memory.entries.map(item => item.id === entryId ? adoptEntryVisuals(item, next) : item);
    return { committed: true, reason: null, entry: next };
  };
}

test('cloud failed attachment after reload repairs a same-owner registration with zero inference', async t => {
  const f = await fixture(t);
  await seedCloudFailure(f, { registered: true });
  const fetchImpl = f.api({ session: 'session-1' });
  const memory = { entries: [await loadCloudEntry(fetchImpl)] };
  const entry = memory.entries[0];
  assert.deepEqual([entry.visualState.attachmentStatus, entry.visualState.retryStatus], ['failed', 'unavailable']);
  assert.equal(Object.hasOwn(entry.visualState, 'attemptId'), false);
  assert.equal(entry.personalReading, RAW);
  assert.equal(savedVisualRecovery(entry, { cloud: true }).canRetry, true);
  const result = await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry, cloud: true, fetchImpl, storage: memoryStorage(), commit: cloudCommit(memory) });
  assert.equal(result.state.retryStatus, 'complete');
  assert.equal(f.calls(), 0);
  assert.equal(hydrateEntryVisuals(memory.entries[0]).hasVisuals, true);
  // Reload: the owned journal now reports the attached snapshot.
  const reloaded = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(reloaded.visualState.retryStatus, 'complete');
  assert.equal(hydrateEntryVisuals(reloaded).cues[0].passage.quote, 'pours into a pool');
  assert.equal(reloaded.personalReading, RAW);
});

test('cloud replay: one explicit retry, polling reaches the authoritative complete state, retries return without inference', async t => {
  const f = await fixture(t);
  await seedCloudFailure(f);
  const fetchImpl = f.api({ session: 'session-1' });
  const store = memoryStorage();
  const memory = { entries: [await loadCloudEntry(fetchImpl)] };
  const result = await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry: memory.entries[0], cloud: true, fetchImpl, storage: store, commit: cloudCommit(memory) });
  assert.equal(result.state.retryStatus, 'pending');
  assert.equal(savedVisualRecovery(memory.entries[0], { cloud: true }).phase, 'pending');
  await f.drain();
  assert.equal(f.calls(), 1);
  // Replay transport terminal state only asks the owned journal to refresh.
  assert.equal((await subscribeAndSettle({ namespace: 'user:user-1', entryId: 'cloud-1', fetchImpl, storage: store, cloud: true })).adopted, true);
  const polled = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(polled.visualState.retryStatus, 'complete');
  assert.equal(hydrateEntryVisuals(polled).hasVisuals, true);
  const again = await postSavedVisualRetry({ env: modelClientEnv, cloud: true, entryId: 'cloud-1', fetchImpl });
  assert.equal(again.state.retryStatus, 'complete');
  assert.equal(again.resumeHandle, null);
  await f.drain();
  assert.equal(f.calls(), 1);
  assert.equal(f.requests.filter(request => request.method === 'POST').length, 2);
});

test('configured cloud transient initialization failure leaves the same prepared claim explicitly retryable through reload', async t => {
  const f = await fixture(t);
  await seedCloudFailure(f);
  const binding = f.env.READING_VISUAL_JOBS;
  let failOnce = true;
  f.env.READING_VISUAL_JOBS = { idFromName: binding.idFromName, get(id) {
    return { fetch(url, init) {
      if (new URL(url).pathname === '/replay-init' && failOnce) { failOnce = false; throw new Error('controlled zero-dispatch init failure'); }
      return binding.get(id).fetch(url, init);
    } };
  } };
  const fetchImpl = f.api({ session: 'session-1' });
  const store = memoryStorage();
  const memory = { entries: [await loadCloudEntry(fetchImpl)] };
  const first = await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry: memory.entries[0], cloud: true,
    fetchImpl, storage: store, commit: cloudCommit(memory) });
  await f.drain();
  assert.deepEqual([first.state.attachmentStatus, first.state.retryStatus, first.state.reason],
    ['failed', 'available', 'configuration-unavailable']);
  assert.equal(savedVisualRecovery(memory.entries[0], { cloud: true }).canRetry, true);
  const prepared = f.db.rows('SELECT * FROM visual_retry_claims')[0];
  assert.equal(prepared.dispatch_status, 'prepared');
  assert.equal(prepared.reserved_at, null);
  assert.equal(f.calls(), 0);
  const reloaded = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(savedVisualRecovery(reloaded, { cloud: true }).canRetry, true);
  assert.equal(needsCloudVisualRefresh(reloaded), false);
  assert.equal(f.requests.filter(request => request.method === 'POST').length, 1);
  assert.deepEqual(f.db.rows('SELECT * FROM visual_retry_claims')[0], prepared);
  memory.entries = [reloaded];
  await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry: reloaded, cloud: true,
    fetchImpl, storage: store, commit: cloudCommit(memory) });
  await f.drain();
  const completed = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(completed.visualState.retryStatus, 'complete');
  assert.equal(completed.personalReading, RAW);
  assert.equal(f.calls(), 1);
  const claims = f.db.rows('SELECT * FROM visual_retry_claims');
  assert.equal(claims.length, 1);
  for (const field of ['id', 'attempt_id', 'visual_job_id', 'state_version', 'source_fingerprint']) assert.equal(claims[0][field], prepared[field]);
  assert.equal(f.requests.filter(request => request.method === 'POST').length, 2);
});

test('no annotation configuration: explicit retry makes zero calls and records status-only unavailability', async t => {
  const f = await fixture(t, { limits: false });
  await seedCloudFailure(f);
  const store = memoryStorage();
  const local = localEntry({ id: 'local-unconfigured' });
  store.setItem('tarot_journal', JSON.stringify([local]));
  const localResult = await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'anon', entry: local, fetchImpl: f.api(), storage: store });
  assert.deepEqual([localResult.state.retryStatus, localResult.state.reason], ['unavailable', 'configuration-unavailable']);
  assert.equal(savedVisualRecovery(readSavedVisualEntry({ namespace: 'anon', entryId: local.id, storage: store })).canRetry, false);
  const fetchImpl = f.api({ session: 'session-1' });
  const memory = { entries: [await loadCloudEntry(fetchImpl)] };
  assert.equal(savedVisualRecovery(memory.entries[0], { cloud: true }).canRetry, false);
  await assert.rejects(requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry: memory.entries[0], cloud: true,
    fetchImpl, storage: store, commit: cloudCommit(memory) }), { code: 'ineligible' });
  // A forced explicit request is also status-only; the normal UI makes none.
  const cloudResult = await postSavedVisualRetry({ env: modelClientEnv, cloud: true, entryId: 'cloud-1', fetchImpl });
  assert.equal(cloudResult.state.reason, 'configuration-unavailable');
  assert.equal(cloudResult.resumeHandle, null);
  // Reload keeps the outcome for the same server state version.
  const reloaded = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(savedVisualRecovery(reloaded, { cloud: true }).phase, 'unavailable');
  await f.drain();
  assert.equal(f.calls(), 0);
  assert.equal(f.db.rows('SELECT * FROM visual_retry_claims').length, 0);
});

test('expired cloud original without replay configuration is status-only on its first list and detail responses', async t => {
  const f = await fixture(t, { limits: false });
  await seedCloudFailure(f, { registered: true, expired: true });
  const fetchImpl = f.api({ session: 'session-1' });
  const entry = await loadCloudEntry(fetchImpl);
  const listResponse = await fetchImpl('/api/journal');
  assert.equal(listResponse.status, 200);
  const { entries } = await listResponse.json();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].visualState.attemptId, null);
  for (const saved of [entry, ...entries.map(projectJournalEntryVisuals)]) {
    assert.deepEqual([saved.visualState.attachmentStatus, saved.visualState.retryStatus, saved.visualState.reason],
      ['expired', 'unavailable', 'configuration-unavailable']);
    assert.equal(savedVisualRecovery(saved, { cloud: true }).canRetry, false);
    assert.equal(needsCloudVisualRefresh(saved), false);
    assert.equal(saved.personalReading, RAW);
    assert.equal(Object.hasOwn(saved.visualState, 'attemptId'), false);
  }
  assert.equal(f.requests.some(request => request.method === 'POST'), false);
  assert.equal(f.calls(), 0);
  assert.equal(f.db.rows('SELECT id FROM visual_retry_claims').length, 0);
});

test('expired cloud action after replay configuration disappears commits status-only unavailability and stays disabled on reload', async t => {
  const f = await fixture(t);
  await seedCloudFailure(f, { registered: true, expired: true });
  const fetchImpl = f.api({ session: 'session-1' });
  const memory = { entries: [await loadCloudEntry(fetchImpl)] };
  const before = memory.entries[0];
  assert.deepEqual([before.visualState.attachmentStatus, before.visualState.retryStatus], ['expired', 'available']);
  assert.equal(savedVisualRecovery(before, { cloud: true }).canRetry, true);
  delete f.env.VISUAL_REPLAY_LIMITS;
  const result = await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry: before, cloud: true,
    fetchImpl, storage: memoryStorage(), commit: cloudCommit(memory) });
  assert.deepEqual([result.state.attachmentStatus, result.state.retryStatus, result.state.reason],
    ['expired', 'unavailable', 'configuration-unavailable']);
  assert.equal(savedVisualRecovery(memory.entries[0], { cloud: true }).canRetry, false);
  const reloaded = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(savedVisualRecovery(reloaded, { cloud: true }).canRetry, false);
  assert.equal(reloaded.personalReading, RAW);
  assert.equal(f.requests.filter(request => request.method === 'POST').length, 1);
  assert.equal(f.calls(), 0);
  assert.equal(f.db.rows('SELECT id FROM visual_retry_claims').length, 0);
});

test('actual unconfigured local retry retains an expired cached original attachment, version and exact accepted cues', async t => {
  const f = await fixture(t, { limits: false, user: false });
  const lib = await import('../functions/lib/readingVisualResults.js');
  const entry = localEntry({ id: 'local-expired-cache' });
  const source = savedVisualSource(entry);
  const hashes = await lib.computeSourceFingerprint(source);
  const { normalizeVisualSource } = await import('../shared/reading/visualSourceIdentity.js');
  const { artworkEdition, catalogVersion } = normalizeVisualSource(source);
  const binding = { readingResultId: 'local-cached-original', sourceRevision: 0, spreadHash: hashes.spreadHash,
    contextHash: hashes.contextHash, artworkEdition, catalogVersion };
  const { createVisualCueLedger, applyVisualCueBatch } = await import('../shared/reading/visualCueLedger.js');
  const { hashVisualCueText } = await import('../shared/contracts/visualCueBatches.js');
  const accepted = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: RAW,
    issuedRequest: { binding, status: 'active', batchId: 'saved-original', requestSequence: 1, analyzedEnd: RAW.length,
      analyzedHash: await hashVisualCueText(RAW), baseLedgerRevision: 0 }, response: PROPOSALS.response,
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], getSupportedDetails: () => ['pool-pour'] } });
  assert.deepEqual(accepted.rejected, []);
  const visual = publicVisualSnapshot({ binding, raw: RAW, cueLedger: accepted.ledger, status: 'expired' });
  const saved = { ...entry, visual, visualBinding: binding, visualState: { attachmentStatus: 'expired', retryStatus: 'available',
    sourceFingerprint: await fingerprintSavedVisualEntry(entry), stateVersion: 4, reason: 'expired' } };
  const store = memoryStorage();
  store.setItem('tarot_journal', JSON.stringify([saved]));
  const before = f.db.rows('SELECT * FROM visual_guest_principals');
  const result = await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'anon', entry: saved, storage: store, fetchImpl: f.api() });
  assert.deepEqual(result.entry.visualState, { ...saved.visualState, retryStatus: 'unavailable', reason: 'configuration-unavailable' });
  assert.deepEqual(result.entry.visual, visual);
  assert.equal(result.entry.personalReading, RAW);
  assert.equal(savedVisualRecovery(result.entry).canRetry, false);
  assert.equal(f.requests.filter(request => request.method === 'POST').length, 1);
  assert.equal(f.calls(), 0);
  assert.equal(f.db.rows('SELECT id FROM visual_retry_claims').length, 0);
  assert.deepEqual(f.db.rows('SELECT * FROM visual_guest_principals'), before);
});

test('exhausted retry after reload offers status only and the server refuses another dispatch', async t => {
  const f = await fixture(t, { response: () => Promise.reject(new Error('fake provider rejection')) });
  const store = memoryStorage();
  const entry = localEntry({ id: 'local-exhausted' });
  store.setItem('tarot_journal_user-1', JSON.stringify([entry]));
  const fetchImpl = f.api({ session: 'session-1' });
  await requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry, fetchImpl, storage: store });
  await f.drain();
  const settled = await subscribeAndSettle({ namespace: 'user:user-1', entryId: entry.id, fetchImpl, storage: store });
  assert.equal(settled.adopted, true);
  // Reload: a fresh read of the same storage.
  const reloaded = readSavedVisualEntry({ namespace: 'user:user-1', entryId: entry.id, storage: store });
  assert.equal(reloaded.visualState.retryStatus, 'exhausted');
  assert.deepEqual(savedVisualRecovery(reloaded), { phase: 'unavailable', canRetry: false, state: reloaded.visualState });
  await assert.rejects(requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry: reloaded, fetchImpl, storage: store }), { code: 'ineligible' });
  const forced = await postSavedVisualRetry({ env: modelClientEnv, savedSource: { raw: RAW, cards: CARDS, deckId: 'rws-1909', question: 'What renews me?', reflections: { Overall: 'Hope' } }, fetchImpl });
  assert.equal(forced.state.retryStatus, 'exhausted');
  assert.equal(forced.resumeHandle, null);
  await f.drain();
  assert.equal(f.calls(), 1);
  assert.equal(reloaded.personalReading, RAW);
});

for (const race of ['delete', 'source replacement', 'account switch']) {
  test(`${race} while the retry response is pending patches nothing and leaves no private handle`, async t => {
    const f = await fixture(t);
    const store = memoryStorage();
    const entry = localEntry({ id: `local-${race.replace(' ', '-')}` });
    store.setItem('tarot_journal_user-1', JSON.stringify([entry]));
    let release; const gate = new Promise(resolve => { release = resolve; });
    const inner = f.api({ session: 'session-1' });
    let current = true;
    let ready; const reached = new Promise(resolve => { ready = resolve; });
    let delayedBody;
    const fetchImpl = async (url, init) => { const response = await inner(url, init); delayedBody = await response.clone().json(); ready(); await gate; return response; };
    const pending = requestSavedVisualRetry({ env: modelClientEnv, namespace: 'user:user-1', entry, fetchImpl, storage: store, isCurrent: () => current });
    pending.catch(() => {});
    t.after(() => release());
    await reached;
    await f.drain();
    assert.ok(delayedBody.resumeHandle?.visualJobToken, 'delayed response must carry a private handle');
    assert.ok(delayedBody.resumeHandle?.visualJobId);
    assert.equal(f.calls(), 1);
    const claims = f.db.rows('SELECT * FROM visual_retry_claims');
    assert.equal(claims.length, 1);
    assert.equal(claims[0].visual_job_id, delayedBody.resumeHandle.visualJobId);
    assert.ok(claims[0].reserved_at > 0);
    assert.equal(claims[0].user_id, 'user-1');
    if (race === 'delete') store.setItem('tarot_journal_user-1', '[]');
    if (race === 'source replacement') store.setItem('tarot_journal_user-1', JSON.stringify([{ ...entry, reflections: { Overall: 'Replaced' } }]));
    if (race === 'account switch') current = false;
    const before = store.getItem('tarot_journal_user-1');
    release();
    await assert.rejects(pending, error => ['stale', 'not-found'].includes(error.code));
    await f.drain();
    assert.equal(store.getItem('tarot_journal_user-1'), before);
    assert.equal(readVisualResume({ namespace: 'user:user-1', entryId: entry.id, storage: store }), null);
    // The server claim/dispatch is bounded independently of the client.
    assert.equal(f.calls(), 1);
  });
}

test.beforeEach(t => installJournalLocks(t));
