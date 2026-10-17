// Controlled backend for saved-visual recovery browser lanes (Task 11).
//
// REAL: the Task 9/10 route handlers (functions/api/*), journal/auth handlers,
// D1 SQL (in-process SQLite with every migration) and the ReadingVisualJob DO
// class (in-memory storage) run inside the Playwright process; the browser
// reaches them through page routes and an owned loopback SSE bridge.
// MOCKED (labelled in reports): the visual provider (env.AI), fixture users,
// tiers and sessions seeded into D1, the trusted guest edge identity, and the
// guest principal cookie jar (a Secure HttpOnly cookie cannot be set on an
// http loopback origin). Not wrangler/workerd, real accounts or live providers.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createD1 } from '../../tests/helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser } from '../../tests/helpers/journalFixtures.mjs';
import { initializeVisualReplay } from '../../functions/lib/readingVisualRetry.js';
import { ReadingVisualJob } from '../../src/worker/readingVisualJob.js';
import * as meRoute from '../../functions/api/auth/me.js';
import * as journalRoute from '../../functions/api/journal.js';
import * as entryRoute from '../../functions/api/journal/[id].js';
import * as cloudRetryRoute from '../../functions/api/journal/[id]/visual-retry.js';
import * as localRetryRoute from '../../functions/api/reading-visual-retry.js';
import * as replayRoute from '../../functions/api/reading-visual-replay.js';
import * as visualResults from '../../functions/lib/readingVisualResults.js';
import { applyVisualCueBatch, createVisualCueLedger } from '../../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../../shared/contracts/visualCueBatches.js';
import { fingerprintVisualSource, normalizeVisualSource } from '../../shared/reading/visualSourceIdentity.js';

export const STAR = JSON.parse(readFileSync(new URL('../../output/reading-motion/fixtures/three-card-transition.json', import.meta.url), 'utf8'));
export const STAR_CARDS = STAR.cards.map(card => ({ name: card.card, position: card.position, orientation: card.orientation }));
// Controlled provider receipt (MOCKED): identity, two literals and a grounded same-card pair.
export const STAR_PROPOSALS = [
  { localAlias: 'arrival', kind: 'identity', quote: 'The Star', targets: [{ spreadIndex: 2, detailIds: [] }] },
  { localAlias: 'pool', kind: 'literal', quote: 'one pitcher into a pool', targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] },
  { localAlias: 'land', kind: 'literal', quote: 'the other onto the land', targets: [{ spreadIndex: 2, detailIds: ['land-pour'] }] },
  { localAlias: 'balance', kind: 'balance', quote: 'Neither pitcher gets dropped.', targets: [{ spreadIndex: 2, detailIds: ['pool-pour', 'land-pour'] }],
    establishedBy: [{ localAlias: 'pool' }, { localAlias: 'land' }] }
];
const BENIGN = {
  '/api/share': { shares: [] }, '/api/journal/pattern-alerts': { alerts: [] }, '/api/memories': { memories: [] },
  '/api/archetype-journey/preferences': { preferences: { archetype_journey_enabled: false } },
  '/api/archetype-journey': { success: true, data: null }, '/api/generate-card-video': { enabled: false },
  '/api/health/tarot-reading': { ok: true }, '/api/health/tts': { ok: true }, '/api/usage': { ok: true },
  '/api/media': { media: [], items: [] }, '/api/archetype-journey/track': { success: true }
};

export function starEntry(overrides = {}) {
  return { id: 'saved-star', ts: Date.now() - 3600000, spread: 'Three-Card Story', spreadKey: 'threeCard',
    question: STAR.userQuestion, reflections: { Overall: STAR.reflectionsText }, deckId: 'rws-1909', cards: STAR_CARDS,
    personalReading: STAR.excerpt, sessionSeed: 'saved-star-seed', ...overrides };
}

/** A binding computed from the saved source exactly as the server computes it. */
export async function sourceBinding(entry, readingResultId, sourceRevision = 0) {
  const source = { raw: entry.personalReading, cards: entry.cards, deckId: entry.deckId, question: entry.question, reflections: entry.reflections };
  const { spreadHash, contextHash } = await fingerprintVisualSource(source);
  const { artworkEdition, catalogVersion } = normalizeVisualSource(source);
  return { readingResultId, sourceRevision, spreadHash, contextHash, artworkEdition, catalogVersion };
}

/** A validated accepted ledger (fixture cue data, not model output). */
export async function acceptedLedger(binding, raw, proposals = STAR_PROPOSALS.slice(1, 2)) {
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
    issuedRequest: { binding, batchId: `fixture-${binding.readingResultId}`, requestSequence: 1, status: 'active',
      analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
    response: { proposals }, validationContext: { cards: STAR_CARDS.map((card, index) => ({ index, canonicalName: card.name })),
      getSupportedDetails: () => ['pool-pour', 'land-pour'] } });
  if (result.rejected.length) throw new Error(`Fixture ledger rejected: ${JSON.stringify(result.rejected)}`);
  return result.ledger;
}

export async function createRecoveryBackend(context, { configured = true, provider = 'accept' } = {}) {
  const db = await createD1();
  const requests = [];
  const unexpected = [];
  const pageErrors = [];
  context.on?.('weberror', error => pageErrors.push(String(error.error()?.stack || error.error() || error)));
  const work = new Set();
  const gates = [];
  let providerCalls = 0;
  let providerMode = provider;
  let releaseProvider;
  const providerReleased = new Promise(resolve => { releaseProvider = resolve; });
  let session = null;
  let principal = null;
  const track = promise => {
    const tracked = Promise.resolve(promise).catch(() => {}).finally(() => work.delete(tracked));
    work.add(tracked);
  };
  const env = { DB: db, VISUAL_CUE_ALLOWED_TIERS: '["plus","pro"]', VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'controlled-fake-provider',
    ...(configured ? { VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 5, windowMs: 60000, totalLimit: 10 }) } : {}),
    VISUAL_REPLAY_TRUSTED_IDENTITY: { resolve: async () => 'controlled-loopback-guest' },
    AI: { async run() {
      providerCalls++;
      if (providerMode === 'hold') await providerReleased;
      if (providerMode === 'reject') throw new Error('controlled provider rejection');
      return { response: { proposals: STAR_PROPOSALS } };
    } } };
  const jobs = new Map();
  env.READING_VISUAL_JOBS = { idFromName: id => id, get(id) {
    if (!jobs.has(id)) {
      let stored;
      const state = { storage: { get: async () => stored, put: async (_, value) => { stored = structuredClone(value); }, setAlarm: async () => {} },
        blockConcurrencyWhile: fn => fn(), waitUntil: track };
      jobs.set(id, new ReadingVisualJob(state, env));
    }
    return { fetch: (url, init) => jobs.get(id).fetch(new Request(url, init)) };
  } };

  async function dispatch({ method, pathname, search = '', headers = {}, body }) {
    const cookie = [session && `session=${session}`, principal && `visual_replay_principal=${principal}`].filter(Boolean).join('; ');
    const requestHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      if (!['cookie', 'host', 'content-length', 'connection'].includes(key.toLowerCase()) && !key.startsWith(':')) requestHeaders.set(key, value);
    }
    if (cookie) requestHeaders.set('Cookie', cookie);
    const request = new Request(`https://journal.test${pathname}${search}`, { method, headers: requestHeaders,
      body: ['GET', 'HEAD'].includes(method) || !body?.length ? undefined : body });
    const base = { request, env, params: {}, waitUntil: track };
    let match;
    if (pathname === '/api/auth/me') return meRoute.onRequestGet(base);
    if (pathname === '/api/auth/logout') { session = null; return Response.json({ success: true }); }
    if (pathname === '/api/journal') return method === 'POST' ? journalRoute.onRequestPost(base) : journalRoute.onRequestGet(base);
    if ((match = pathname.match(/^\/api\/journal\/([^/]+)\/visual-retry$/)) && method === 'POST') {
      return cloudRetryRoute.onRequestPost({ ...base, params: { entryId: decodeURIComponent(match[1]) } });
    }
    if ((match = pathname.match(/^\/api\/journal\/([^/]+)$/)) && !BENIGN[pathname]) {
      const params = { id: decodeURIComponent(match[1]) };
      return method === 'DELETE' ? entryRoute.onRequestDelete({ ...base, params }) : entryRoute.onRequestGet({ ...base, params });
    }
    if (pathname === '/api/tarot-reading/visual-retry' && method === 'POST') return localRetryRoute.onRequestPost(base);
    if ((match = pathname.match(/^\/api\/tarot-reading\/visual-replays\/([^/]+)(?:\/(?:stream|cancel))?$/))) {
      return replayRoute[method === 'POST' ? 'onRequestPost' : 'onRequestGet']({ ...base, params: { visualJobId: decodeURIComponent(match[1]) } });
    }
    // Original visual transports are not provisioned in these lanes: an expired capability.
    if (pathname.startsWith('/api/tarot-reading/visuals/')) return Response.json({ error: 'Visual job is no longer available.' }, { status: 410 });
    if (BENIGN[pathname]) return Response.json(BENIGN[pathname]);
    unexpected.push(`${method} ${pathname}`);
    return Response.json({}, { status: 404 });
  }

  // Owned loopback bridge for SSE: the replay stream must flow incrementally.
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'X-Visual-Token, Accept');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://bridge.invalid');
    let reader;
    req.on('close', () => reader?.cancel().catch(() => {}));
    try {
      const response = await dispatch({ method: req.method, pathname: url.pathname, search: url.search, headers: req.headers });
      res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'text/plain', 'Cache-Control': 'no-cache' });
      if (!response.body) { res.end(); return; }
      reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch { /* Client closed the stream. */ }
    res.end();
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const bridgeOrigin = `http://127.0.0.1:${server.address().port}`;

  // This controlled bridge never permits external browser network traffic.
  await context.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return hostname === '127.0.0.1' || hostname === 'localhost' ? route.fallback() : route.abort('blockedbyclient');
  });
  await context.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
  await context.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname.endsWith('sentry.io')) return route.fulfill({ json: {} });
    const method = request.method();
    requests.push({ method, path: url.pathname, at: Date.now() });
    if (/^\/api\/tarot-reading\/visual-replays\/[^/]+\/stream$/.test(url.pathname)) {
      return route.continue({ url: `${bridgeOrigin}${url.pathname}${url.search}` });
    }
    const gate = gates.find(item => !item.used && item.method === method && item.pattern.test(url.pathname));
    if (gate?.abort) { gate.used = true; return route.abort('internetdisconnected'); }
    let response;
    try {
      response = await dispatch({ method, pathname: url.pathname, search: url.search, headers: await request.allHeaders(), body: request.postDataBuffer() });
    } catch (error) {
      response = Response.json({ error: 'bridge-dispatch-failed', message: String(error?.message || error) }, { status: 500 });
    }
    const issued = response.headers.get('Set-Cookie')?.match(/visual_replay_principal=([^;]+)/)?.[1];
    if (issued) principal = issued;
    const text = await response.text();
    if (gate) { gate.used = true; gate.response = JSON.parse(text); gate.reached(); await gate.released; }
    const headers = Object.fromEntries([...response.headers].filter(([key]) => key.toLowerCase() !== 'set-cookie'));
    try { await route.fulfill({ status: response.status, headers, body: text }); } catch { /* Page closed. */ }
  });

  return {
    db, env, requests, unexpected, pageErrors,
    diagnostics: () => ({ unexpectedApi: unexpected, pageErrors, requests, providerCalls }),
    providerCalls: () => providerCalls,
    setProvider(mode) { providerMode = mode; },
    releaseProvider() { releaseProvider(); },
    /** Actual authenticated public route, used to reserve paid work before a tier change. */
    postLocalRetry(savedSource) {
      return dispatch({ method: 'POST', pathname: '/api/tarot-reading/visual-retry',
        headers: { 'Content-Type': 'application/json', 'X-Reading-Cue-Display': '1' },
        body: JSON.stringify({ savedSource }) });
    },
    setSession(id) { session = id; },
    retryPosts: () => requests.filter(item => item.method === 'POST' && /visual-retry$/.test(item.path)),
    transportRequests: () => requests.filter(item => item.path.startsWith('/api/tarot-reading/visual-replays/')),
    /** Hold the next matching response after the server computed it (network latency). */
    holdNext(method, pattern) {
      const gate = { method, pattern, used: false };
      gate.reachedPromise = new Promise(resolve => { gate.reached = resolve; });
      gate.released = new Promise(resolve => { gate.release = resolve; });
      gates.push(gate);
      return gate;
    },
    /** Drop the next matching request before it reaches the server (offline). */
    failNext(method, pattern) { gates.push({ method, pattern, used: false, abort: true }); },
    async settle() { while (work.size) await Promise.all([...work]); },
    async seedAccount({ id, tier = 'plus', sessionId = `session-${id}` }) {
      await seedUser(db, { id, tier, status: tier === 'free' ? 'inactive' : 'active' });
      await seedSession(db, { id: sessionId, userId: id });
      return sessionId;
    },
    /** Historical, already-reserved work only. Never grants new model admission.
     * The real POST routes below remain the sole setup for NEW retry work. */
    async seedHistoricalReplay({ userId, entry, binding, cloud = false, stateVersion = 1 }) {
      const source = { raw: entry.personalReading, cards: entry.cards, deckId: entry.deckId,
        question: entry.question, reflections: entry.reflections };
      const owned = cloud ? await visualResults.loadOwnedJournalVisualSource({ db, userId, entryId: entry.id }) : null;
      const fingerprint = await visualResults.fingerprintSavedVisualSource(owned || { source, ...normalizeVisualSource(source) });
      const prior = cloud ? await visualResults.loadJournalVisualState({ env, db, userId, entryId: entry.id }) : null;
      const id = crypto.randomUUID(), attemptId = crypto.randomUUID(), now = Date.now();
      const journalVersion = cloud ? prior.stateVersion + 1 : null;
      const fields = owned ? Object.fromEntries(['narrative', 'cards_json', 'question', 'reflections_json', 'deck_id'].map(key => [key, owned.row[key]])) : null;
      await db.prepare(`INSERT INTO visual_retry_claims
        (id, admission_scope, source_fingerprint, user_id, journal_entry_id, reading_result_id, attempt_id, visual_job_id,
          dispatch_status, retry_status, state_version, created_at, updated_at, aggregate_scope, source_json, saved_fields_json,
          journal_state_version, binding_json, visual_token, expires_at, reserved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reserved', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, `user:${userId}`, fingerprint, userId, cloud ? entry.id : null, binding.readingResultId,
          attemptId, crypto.randomUUID(), stateVersion, now - 1000, now - 1000, `user:${userId}`, JSON.stringify(source),
          fields ? JSON.stringify(fields) : null, journalVersion, JSON.stringify(binding), crypto.randomUUID(), now + 86400000, now - 1000).run();
      if (cloud) await db.prepare(`UPDATE journal_visual_state SET claim_id = ?, attempt_id = ?, state_version = ?,
        attachment_status = 'pending', retry_status = 'pending', reason = NULL WHERE journal_entry_id = ? AND user_id = ?`)
        .bind(id, attemptId, journalVersion, entry.id, userId).run();
      const claim = db.rows('SELECT * FROM visual_retry_claims WHERE id = ?', [id])[0];
      if (!await initializeVisualReplay({ db, claim })) throw new Error('Invalid historical replay fixture');
      return { claim, fingerprint };
    },
    /** Saved cloud row with a durable failed attachment (optionally an owned, complete original). */
    async seedCloudEntry({ userId, entry, attachment = 'failed', registered = false, pendingOriginal = false }) {
      await seedEntry(db, { id: entry.id, userId, cards: entry.cards, narrative: entry.personalReading,
        reflections: entry.reflections, deckId: entry.deckId, sessionSeed: entry.sessionSeed, spreadName: entry.spread, spreadKey: entry.spreadKey });
      await db.prepare('UPDATE journal_entries SET question = ? WHERE id = ?').bind(entry.question, entry.id).run();
      const owned = await visualResults.loadOwnedJournalVisualSource({ db, userId, entryId: entry.id });
      const fingerprint = await visualResults.fingerprintSavedVisualSource(owned);
      const binding = await sourceBinding(entry, `${entry.id}-original`);
      if (registered || pendingOriginal) {
        await visualResults.registerVisualResult({ db, userId, readingResultId: binding.readingResultId, binding });
        if (pendingOriginal) {
          await visualResults.updateVisualResultSource({ db, userId, readingResultId: binding.readingResultId, binding,
            raw: entry.personalReading.slice(0, 80) });
          await visualResults.attachJournalVisualResult({ db, userId, entryId: entry.id, readingResultId: binding.readingResultId });
          return { binding, fingerprint };
        }
        await visualResults.updateVisualResultSource({ db, userId, readingResultId: binding.readingResultId, binding, raw: entry.personalReading, complete: true });
        await visualResults.commitVisualResult({ db, userId, readingResultId: binding.readingResultId, binding, expectedLedgerRevision: 0,
          ledger: await acceptedLedger(binding, entry.personalReading), finalRaw: entry.personalReading });
      }
      await visualResults.persistJournalVisualState({ db, userId, entryId: entry.id, sourceFingerprint: fingerprint,
        attachmentStatus: attachment, reason: 'attachment-error', readingResultId: registered ? binding.readingResultId : null });
      return { binding, fingerprint };
    },
    /** The original job finishes server-side (fixture ledger, no provider call). */
    async completeOriginal({ userId, entry, binding }) {
      await visualResults.updateVisualResultSource({ db, userId, readingResultId: binding.readingResultId, binding, raw: entry.personalReading, complete: true });
      const row = db.rows('SELECT ledger_revision FROM reading_visual_results WHERE id = ?', [binding.readingResultId])[0];
      return visualResults.commitVisualResult({ db, userId, readingResultId: binding.readingResultId, binding,
        expectedLedgerRevision: row?.ledger_revision ?? 0, ledger: await acceptedLedger(binding, entry.personalReading, STAR_PROPOSALS.slice(0, 3)),
        finalRaw: entry.personalReading });
    },
    async close() {
      releaseProvider();
      for (const gate of gates) gate.release?.();
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
      await Promise.race([Promise.all([...work]), new Promise(resolve => setTimeout(resolve, 2000))]);
      db.sqlite.close();
    }
  };
}
