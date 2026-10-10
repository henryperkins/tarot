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
import { readVisualJobEvents, isVisualJobTerminal, postSavedVisualRetry } from '../src/lib/readingVisualStream.js';
import { requestSavedVisualRetry, adoptSavedVisualReplay, readVisualResume, readSavedVisualEntry, savedVisualRecovery,
  projectJournalEntryVisuals, mergeCachedJournalVisuals, savedVisualSourceKey, adoptEntryVisuals } from '../src/lib/readingVisualStorage.js';
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
  const env = { DB: db, VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake',
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
      const cookies = [session && `session=${session}`, jar.principal && `visual_replay_principal=${jar.principal}`].filter(Boolean);
      if (cookies.length) headers.set('Cookie', cookies.join('; '));
      const method = init.method || 'GET';
      const request = new Request(absolute, { method, headers, body: init.body, signal: init.signal });
      requests.push({ method, path: absolute.pathname });
      let match; let result;
      if (absolute.pathname === '/api/tarot-reading/visual-retry') result = await localRetryRoute.onRequestPost({ env, request });
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
  for await (const { data } of readVisualJobEvents({ readingResultId: handle.readingResultId, visualJobId: handle.visualJobId,
    visualJobToken: handle.visualJobToken, fetchImpl, retryDelay: 0 })) {
    if (isVisualJobTerminal(data.status)) {
      return adoptSavedVisualReplay({ namespace, entryId, resume: handle, cueLedger: data.cueLedger, status: data.status, cloud, storage });
    }
  }
  throw new Error('Replay stream ended without a terminal state.');
}

const localEntry = (overrides = {}) => ({ id: 'local-guest', ts: 1, personalReading: RAW, cards: CARDS, deckId: 'rws-1909',
  question: 'What renews me?', reflections: { Overall: 'Hope' }, spread: 'One card', spreadKey: 'single', ...overrides });

test('guest local expiry: one explicit retry claims once, replay transport adopts static cues, repeats never dispatch again', async t => {
  const f = await fixture(t, { user: false });
  const store = memoryStorage();
  const entry = localEntry();
  store.setItem('tarot_journal', JSON.stringify([entry]));
  const fetchImpl = f.api();
  assert.equal(savedVisualRecovery(entry).canRetry, true);
  const result = await requestSavedVisualRetry({ namespace: 'anon', entry, fetchImpl, storage: store });
  // Claim/status are durable before the action resolves; the capability is private.
  assert.equal(result.state.retryStatus, 'pending');
  const pending = readSavedVisualEntry({ namespace: 'anon', entryId: entry.id, storage: store });
  assert.equal(pending.visualState.retryStatus, 'pending');
  const handle = readVisualResume({ namespace: 'anon', entryId: entry.id, storage: store });
  assert.equal(JSON.stringify(pending).includes(handle.visualJobToken), false);
  assert.equal(JSON.stringify(pending).includes(handle.attemptId), false);
  await f.drain();
  assert.equal(f.calls(), 1);
  const settled = await subscribeAndSettle({ namespace: 'anon', entryId: entry.id, fetchImpl, storage: store });
  assert.equal(settled.adopted, true);
  const adopted = readSavedVisualEntry({ namespace: 'anon', entryId: entry.id, storage: store });
  assert.equal(adopted.personalReading, RAW);
  assert.equal(adopted.visualState.retryStatus, 'complete');
  assert.equal(savedVisualRecovery(adopted).phase, 'complete');
  const restored = hydrateEntryVisuals(adopted);
  assert.equal(restored.hasVisuals, true);
  assert.equal(restored.cues[0].passage.quote, 'pours into a pool');
  assert.equal(readVisualResume({ namespace: 'anon', entryId: entry.id, storage: store }), null);
  // A second explicit request for the same source (another tab, or reload that
  // lost local state) returns the existing claim and never dispatches again.
  const again = await postSavedVisualRetry({ savedSource: { raw: RAW, cards: CARDS, deckId: 'rws-1909', question: 'What renews me?', reflections: { Overall: 'Hope' } }, fetchImpl });
  assert.equal(again.state.retryStatus, 'complete');
  await f.drain();
  assert.equal(f.calls(), 1);
  // Exactly the two explicit POSTs; the transport was GET-only.
  assert.deepEqual(f.requests.filter(request => request.method === 'POST').map(request => request.path),
    ['/api/tarot-reading/visual-retry', '/api/tarot-reading/visual-retry']);
  assert.equal(f.requests.filter(request => request.path.startsWith('/api/tarot-reading/visual-replays/')).every(request => request.method === 'GET'), true);
});

test('signed-in local entitlement lane: authenticated admission without cloud journal, one dispatch across duplicate clicks', async t => {
  const f = await fixture(t);
  await f.db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'inactive' WHERE id = 'user-1'").run();
  const store = memoryStorage();
  const entry = localEntry({ id: 'local-free' });
  store.setItem('tarot_journal_user-1', JSON.stringify([entry]));
  const namespace = 'user:user-1';
  const fetchImpl = f.api({ session: 'session-1' });
  // The cloud route refuses a free account; the local route admits it as the user.
  const refused = await fetchImpl('/api/journal/local-free/visual-retry', { method: 'POST' });
  assert.equal(refused.status, 403);
  const [first, second] = await Promise.all([requestSavedVisualRetry({ namespace, entry, fetchImpl, storage: store }),
    requestSavedVisualRetry({ namespace, entry, fetchImpl, storage: store }).catch(error => error)]);
  assert.equal(first.state.retryStatus, 'pending');
  // The racing duplicate converges on the same stored claim (or is fenced as stale), never a second claim.
  assert.ok(second.state?.retryStatus === 'pending' || second.code === 'stale');
  await f.drain();
  assert.equal(f.calls(), 1);
  assert.equal(f.db.rows('SELECT admission_scope FROM visual_retry_claims')[0].admission_scope, 'user:user-1');
  assert.equal((await subscribeAndSettle({ namespace, entryId: entry.id, fetchImpl, storage: store })).adopted, true);
  assert.equal(hydrateEntryVisuals(readSavedVisualEntry({ namespace, entryId: entry.id, storage: store })).hasVisuals, true);
});

async function seedCloudFailure(f, { registered = false } = {}) {
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
  const result = await requestSavedVisualRetry({ namespace: 'user:user-1', entry, cloud: true, fetchImpl, storage: memoryStorage(), commit: cloudCommit(memory) });
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
  const result = await requestSavedVisualRetry({ namespace: 'user:user-1', entry: memory.entries[0], cloud: true, fetchImpl, storage: store, commit: cloudCommit(memory) });
  assert.equal(result.state.retryStatus, 'pending');
  assert.equal(savedVisualRecovery(memory.entries[0], { cloud: true }).phase, 'pending');
  await f.drain();
  assert.equal(f.calls(), 1);
  // Replay transport terminal state only asks the owned journal to refresh.
  assert.equal((await subscribeAndSettle({ namespace: 'user:user-1', entryId: 'cloud-1', fetchImpl, storage: store, cloud: true })).adopted, true);
  const polled = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(polled.visualState.retryStatus, 'complete');
  assert.equal(hydrateEntryVisuals(polled).hasVisuals, true);
  const again = await postSavedVisualRetry({ cloud: true, entryId: 'cloud-1', fetchImpl });
  assert.equal(again.state.retryStatus, 'complete');
  assert.equal(again.resumeHandle, null);
  await f.drain();
  assert.equal(f.calls(), 1);
  assert.equal(f.requests.filter(request => request.method === 'POST').length, 2);
});

test('no annotation configuration: explicit retry makes zero calls and records status-only unavailability', async t => {
  const f = await fixture(t, { limits: false });
  await seedCloudFailure(f);
  const store = memoryStorage();
  const local = localEntry({ id: 'local-unconfigured' });
  store.setItem('tarot_journal', JSON.stringify([local]));
  const localResult = await requestSavedVisualRetry({ namespace: 'anon', entry: local, fetchImpl: f.api(), storage: store });
  assert.deepEqual([localResult.state.retryStatus, localResult.state.reason], ['unavailable', 'configuration-unavailable']);
  assert.equal(savedVisualRecovery(readSavedVisualEntry({ namespace: 'anon', entryId: local.id, storage: store })).canRetry, false);
  const fetchImpl = f.api({ session: 'session-1' });
  const memory = { entries: [await loadCloudEntry(fetchImpl)] };
  const cloudResult = await requestSavedVisualRetry({ namespace: 'user:user-1', entry: memory.entries[0], cloud: true, fetchImpl, storage: store, commit: cloudCommit(memory) });
  assert.equal(cloudResult.state.reason, 'configuration-unavailable');
  // Reload keeps the outcome for the same server state version.
  const reloaded = await loadCloudEntry(fetchImpl, memory.entries[0]);
  assert.equal(savedVisualRecovery(reloaded, { cloud: true }).phase, 'unavailable');
  await f.drain();
  assert.equal(f.calls(), 0);
  assert.equal(f.db.rows('SELECT * FROM visual_retry_claims').length, 0);
});

test('exhausted retry after reload offers status only and the server refuses another dispatch', async t => {
  const f = await fixture(t, { response: () => Promise.reject(new Error('fake provider rejection')) });
  const store = memoryStorage();
  const entry = localEntry({ id: 'local-exhausted' });
  store.setItem('tarot_journal', JSON.stringify([entry]));
  const fetchImpl = f.api();
  await requestSavedVisualRetry({ namespace: 'anon', entry, fetchImpl, storage: store });
  await f.drain();
  const settled = await subscribeAndSettle({ namespace: 'anon', entryId: entry.id, fetchImpl, storage: store });
  assert.equal(settled.adopted, true);
  // Reload: a fresh read of the same storage.
  const reloaded = readSavedVisualEntry({ namespace: 'anon', entryId: entry.id, storage: store });
  assert.equal(reloaded.visualState.retryStatus, 'exhausted');
  assert.deepEqual(savedVisualRecovery(reloaded), { phase: 'unavailable', canRetry: false, state: reloaded.visualState });
  await assert.rejects(requestSavedVisualRetry({ namespace: 'anon', entry: reloaded, fetchImpl, storage: store }), { code: 'ineligible' });
  const forced = await postSavedVisualRetry({ savedSource: { raw: RAW, cards: CARDS, deckId: 'rws-1909', question: 'What renews me?', reflections: { Overall: 'Hope' } }, fetchImpl });
  assert.equal(forced.state.retryStatus, 'exhausted');
  assert.equal(forced.resumeHandle, null);
  await f.drain();
  assert.equal(f.calls(), 1);
  assert.equal(reloaded.personalReading, RAW);
});

for (const race of ['delete', 'source replacement', 'account switch']) {
  test(`${race} while the retry response is pending patches nothing and leaves no private handle`, async t => {
    const f = await fixture(t, { user: false });
    const store = memoryStorage();
    const entry = localEntry({ id: `local-${race.replace(' ', '-')}` });
    store.setItem('tarot_journal', JSON.stringify([entry]));
    let release; const gate = new Promise(resolve => { release = resolve; });
    const inner = f.api();
    let current = true;
    const fetchImpl = async (url, init) => { const response = await inner(url, init); await gate; return response; };
    const pending = requestSavedVisualRetry({ namespace: 'anon', entry, fetchImpl, storage: store, isCurrent: () => current });
    while (!f.requests.length) await new Promise(resolve => setImmediate(resolve));
    if (race === 'delete') store.setItem('tarot_journal', '[]');
    if (race === 'source replacement') store.setItem('tarot_journal', JSON.stringify([{ ...entry, reflections: { Overall: 'Replaced' } }]));
    if (race === 'account switch') current = false;
    const before = store.getItem('tarot_journal');
    release();
    await assert.rejects(pending, error => ['stale', 'not-found'].includes(error.code));
    await f.drain();
    assert.equal(store.getItem('tarot_journal'), before);
    assert.equal(readVisualResume({ namespace: 'anon', entryId: entry.id, storage: store }), null);
    // The server claim/dispatch is bounded independently of the client.
    assert.ok(f.calls() <= 1);
  });
}
