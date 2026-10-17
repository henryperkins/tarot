import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost as startRoute } from '../functions/api/tarot-reading-job-start.js';
import { onRequestPost as localRetryRoute } from '../functions/api/reading-visual-retry.js';
import { onRequestPost as journalRetryRoute } from '../functions/api/journal/[id]/visual-retry.js';
import { startReadingJob } from '../functions/lib/readingJobs.js';
import { ReadingVisualJob } from '../src/worker/readingVisualJob.js';
import { observeDeliveredReading } from '../functions/lib/visualCueObserver.js';
import { createWebVisualCapability } from '../functions/lib/readingVisualWebAdmission.js';
import { getUserFromRequest } from '../functions/lib/auth.js';
import { hashApiKey } from '../functions/lib/apiKeys.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry, jsonRequest } from './helpers/journalFixtures.mjs';
import { withInitialVisualAdmission } from './helpers/visualInitialAdmissionFixtures.mjs';

const PAYLOAD = { spreadInfo: { name: 'One Card', key: 'single' },
  cardsInfo: [{ card: 'The Star', position: 'Present', orientation: 'Upright', meaning: 'Hope', userReflection: null }],
  userQuestion: 'Where can I find hope?', deckStyle: 'rws-1909' };
const SOURCE = { raw: 'The Star offers hope.', cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }], deckId: 'rws-1909' };
const FORGED = { principal: { userId: 'user-1' }, user: { subscription_tier: 'pro', subscription_status: 'active' },
  VITE_READING_ALIGNER_ENABLED: 'true', VITE_READING_MODEL_ANNOTATIONS: 'true',
  effectiveTier: 'pro', visualCapability: { userId: 'user-1', effectiveTier: 'pro', cueDisplay: true }, cueDisplay: true };

async function fixture(t, { tier = 'pro', status = 'active', credentials = 'session', allowlist = '["plus","pro"]', display = '1', realVisual = false } = {}) {
  const DB = await createD1(); t.after(() => DB.sqlite.close());
  await seedUser(DB, { tier, status }); await seedSession(DB);
  await seedEntry(DB, { narrative: SOURCE.raw, cards: SOURCE.cards, deckId: SOURCE.deckId });
  let proseStarts = 0, visualTouches = 0, aiCalls = 0;
  const bodies = [], background = [], forwardedHeaders = [];
  const env = withInitialVisualAdmission({ DB, VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake',
    VISUAL_CUE_ALLOWED_TIERS: allowlist,
    VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }),
    AI: { run: async () => { aiCalls++; return { response: { proposals: [] } }; } },
    READING_JOBS: { idFromName: id => id, get: () => ({ fetch: async (_url, options) => {
      proseStarts++; bodies.push(JSON.parse(options.body)); forwardedHeaders.push(new Headers(options.headers)); return Response.json({ ok: true });
    } }) },
    READING_VISUAL_JOBS: { idFromName: id => { visualTouches++; return id; }, get: () => ({ fetch: async () => Response.json({ ok: true }) }) }
  });
  if (realVisual) {
    const jobs = new Map();
    env.READING_VISUAL_JOBS = { idFromName: id => { visualTouches++; return id; }, get: id => {
      if (!jobs.has(id)) {
        let stored;
        jobs.set(id, new ReadingVisualJob({ blockConcurrencyWhile: fn => fn(),
          storage: { get: async () => stored, put: async (_key, value) => { stored = structuredClone(value); }, setAlarm: async () => {} },
          waitUntil: promise => background.push(promise) }, env));
      }
      return { fetch: (url, options) => jobs.get(id).fetch(new Request(url, options)) };
    } };
  }
  if (allowlist === null) delete env.VISUAL_CUE_ALLOWED_TIERS;
  let auth = {};
  if (credentials === 'session') auth = { Cookie: 'session=session-1' };
  if (credentials === 'api-key') {
    const key = 'sk_controlled-offline-api-key';
    await DB.prepare('INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('key-1', 'user-1', await hashApiKey(key), 'sk_contr', 'offline', Math.floor(Date.now() / 1000)).run();
    auth = { Authorization: `Bearer ${key}` };
  }
  if (credentials === 'service') {
    env.GPT_SERVICE_TOKEN = 'controlled-offline-service-token';
    env.GPT_SERVICE_TIER = 'pro'; auth = { Authorization: `Bearer ${env.GPT_SERVICE_TOKEN}` };
  }
  const headers = { ...auth, ...(display === null ? {} : { 'X-Reading-Cue-Display': display }) };
  const request = (path, body = PAYLOAD) => jsonRequest(`https://test${path}`, { body, headers });
  const drain = async () => { while (background.length) await Promise.all(background.splice(0)); };
  const assertExcluded = () => {
    assert.equal(visualTouches, 0, 'excluded requests never touch visual DO');
    assert.equal(aiCalls, 0, 'excluded requests never touch AI');
    for (const table of ['visual_initial_admissions', 'visual_initial_reservations', 'visual_retry_claims', 'reading_visual_results']) {
      assert.equal(DB.rows(`SELECT * FROM ${table}`).length, 0, `${table} stays empty`);
    }
  };
  return { env, DB, bodies, forwardedHeaders, request, drain, background, assertExcluded, proseStarts: () => proseStarts, aiCalls: () => aiCalls };
}

const EXCLUDED = [
  ['guest', { credentials: 'guest' }], ['free', { tier: 'free' }],
  ['expired paid subscription', { tier: 'pro', status: 'expired' }], ['cancelled paid subscription', { status: 'canceled' }], ['unknown tier', { tier: 'enterprise' }],
  ['missing allowlist', { allowlist: null }], ['empty allowlist', { allowlist: '[]' }],
  ['malformed allowlist', { allowlist: 'plus,pro' }], ['object allowlist', { allowlist: '{"pro":true}' }],
  ['allowlist containing free', { allowlist: '["free","pro"]' }], ['nonstring allowlist entry', { allowlist: '["pro",true]' }],
  ['unlisted paid tier', { tier: 'plus', allowlist: '["pro"]' }],
  ['display gate off', { display: null }], ['malformed display opt-in', { display: 'true' }],
  ['API key owned by Pro', { credentials: 'api-key' }], ['service token', { credentials: 'service' }]
];
for (const [name, options] of EXCLUDED) {
  test(`web start ${name}: prose starts with zero visual admissions, reservations, DO or AI calls`, async t => {
    const f = await fixture(t, options);
    const response = await startRoute({ env: f.env, request: f.request('/api/tarot-reading/jobs', { ...PAYLOAD, ...FORGED }), waitUntil: p => f.background.push(p) });
    assert.equal(response.status, 200); await f.drain();
    assert.equal(f.proseStarts(), 1); assert.equal(f.bodies[0].payload.userQuestion, PAYLOAD.userQuestion);
    assert.equal(f.bodies[0].principal, undefined, 'body principal never becomes trusted principal');
    assert.equal(f.bodies[0].visualInit, null);
    assert.equal((await response.json()).visualJobToken, undefined);
    f.assertExcluded();
  });
  for (const [routeName, route, path, body] of [
    ['local', localRetryRoute, '/api/tarot-reading/visual-retry', { savedSource: SOURCE, ...FORGED }],
    ['journal', journalRetryRoute, '/api/journal/entry-1/visual-retry', FORGED]
  ]) test(`${routeName} retry ${name}: preserves prose and makes zero new claims or dispatches`, async t => {
    const f = await fixture(t, options);
    const response = await route({ env: f.env, request: f.request(path, body), params: { entryId: 'entry-1' } });
    assert.ok([200, 401, 403].includes(response.status), `safe refusal status: ${response.status}`);
    await f.drain(); f.assertExcluded();
    assert.equal(f.DB.rows('SELECT narrative FROM journal_entries')[0].narrative, SOURCE.raw);
  });
}

for (const tier of ['plus', 'pro']) test(`eligible controlled ${tier} web start retains admission/registration/init`, async t => {
  const f = await fixture(t, { tier, realVisual: true });
  const response = await startRoute({ env: f.env, request: f.request('/api/tarot-reading/jobs'), waitUntil: p => f.background.push(p) });
  assert.equal(response.status, 200); const body = await response.json(); await f.drain();
  assert.ok(body.visualJobToken); assert.equal(f.bodies[0].visualInit.ownerUserId, 'user-1');
  assert.ok(body.visualExpiresAt > Date.now() + 23 * 60 * 60 * 1000, 'original recovery remains valid beyond one hour');
  assert.ok(body.visualExpiresAt <= Date.now() + 24 * 60 * 60 * 1000, 'a fixed admission deadline is returned');
  assert.ok(f.DB.rows('SELECT expires_at FROM visual_initial_admissions')[0].expires_at >= body.visualExpiresAt, 'the browser never outlives the original server job');
  assert.equal(f.DB.rows('SELECT * FROM reading_visual_results').length, 1);
  assert.equal(f.proseStarts(), 1);
  assert.equal(f.DB.rows('SELECT * FROM visual_initial_admissions').length, 1);
  assert.equal(f.aiCalls(), 0, 'init itself never invokes the controlled provider');
  const observed = await observeDeliveredReading({ env: f.env, binding: body.visualBinding,
    raw: SOURCE.raw, deliveredEventId: 1, complete: true });
  assert.equal(observed.ok, true); await f.drain();
  assert.equal(f.aiCalls(), 1); assert.equal(f.DB.rows('SELECT * FROM visual_initial_reservations').length, 1);
});

for (const mode of ['plain in-Worker', 'MCP principal', 'forged capability']) test(`${mode} start helper cannot admit model visuals`, async t => {
  const f = await fixture(t);
  const result = await startReadingJob({ env: f.env, payload: { ...PAYLOAD, ...FORGED }, ownerUserId: 'user-1',
    request: f.request('/api/tarot-reading/jobs'), ...(mode === 'MCP principal' ? { principal: { userId: 'user-1' } } : {}),
    visualCapability: mode === 'forged capability' ? FORGED.visualCapability : null,
    waitUntil: p => f.background.push(p) });
  assert.equal(result.ok, true); await f.drain(); assert.equal(result.visualBinding, null); f.assertExcluded();
});

for (const tier of ['plus', 'pro']) for (const [name, route, path, body] of [
  ['local', localRetryRoute, '/api/tarot-reading/visual-retry', { savedSource: SOURCE }],
  ['journal', journalRetryRoute, '/api/journal/entry-1/visual-retry', {}]
]) test(`eligible ${tier} ${name} retry makes one controlled call and preserves saved prose`, async t => {
  const f = await fixture(t, { tier, realVisual: true });
  const call = () => route({ env: f.env, request: f.request(path, body), params: { entryId: 'entry-1' } });
  const response = await call(); assert.equal(response.status, 200); assert.ok((await response.json()).resumeHandle);
  await f.drain(); assert.equal(f.aiCalls(), 1);
  const repeated = await call(); assert.equal(repeated.status, 200); await f.drain(); assert.equal(f.aiCalls(), 1);
  assert.equal(f.DB.rows('SELECT * FROM visual_retry_claims WHERE reserved_at IS NOT NULL').length, 1);
  assert.equal(f.DB.rows('SELECT narrative FROM journal_entries')[0].narrative, SOURCE.raw);
});

for (const mutation of ['different env', 'different owner', 'allowlist cleared', 'principal with trusted capability']) {
  test(`trusted capability cannot cross ${mutation}`, async t => {
    const f = await fixture(t), request = f.request('/api/tarot-reading/jobs');
    const user = await getUserFromRequest(request, f.env);
    const visualCapability = createWebVisualCapability({ env: f.env, request, user });
    assert.ok(visualCapability);
    if (mutation === 'allowlist cleared') f.env.VISUAL_CUE_ALLOWED_TIERS = '[]';
    const result = await startReadingJob({ env: mutation === 'different env' ? { ...f.env } : f.env, payload: PAYLOAD,
      ownerUserId: mutation === 'different owner' ? 'foreign' : user.id, visualCapability,
      ...(mutation === 'principal with trusted capability' ? { principal: { userId: user.id } } : {}),
      waitUntil: promise => f.background.push(promise) });
    assert.equal(result.ok, true); assert.equal(result.visualBinding, null); await f.drain(); f.assertExcluded();
  });
}

for (const [name, overrides] of [
  ['missing provider', { VISUAL_CUE_PROVIDER: undefined }], ['missing model', { VISUAL_CUE_MODEL: undefined }],
  ['blank model', { VISUAL_CUE_MODEL: ' ' }], ['unsupported provider', { VISUAL_CUE_PROVIDER: 'narrative' }],
  ['missing AI', { AI: undefined }], ['missing initial limits', { VISUAL_INITIAL_LIMITS: undefined }],
  ['malformed initial limits', { VISUAL_INITIAL_LIMITS: '{}' }], ['missing visual DO', { READING_VISUAL_JOBS: undefined }]
]) test(`eligible paid display request with ${name} retains prose and zero model admissions`, async t => {
  const f = await fixture(t); Object.assign(f.env, overrides);
  const response = await startRoute({ env: f.env, request: f.request('/api/tarot-reading/jobs'), waitUntil: p => f.background.push(p) });
  assert.equal(response.status, 200); await f.drain(); assert.equal(f.proseStarts(), 1);
  assert.equal(f.bodies[0].visualInit, null); f.assertExcluded();
});

const MIXED_AUTHORIZATION = [
  ['canonical API key', 'Bearer sk_controlled-mixed-key'],
  ['lowercase API scheme', 'bearer sk_controlled-mixed-key'],
  ['uppercase API scheme', 'BEARER sk_controlled-mixed-key'],
  ['multiple API separators', 'Bearer  sk_controlled-mixed-key'],
  ['tab API separator', 'Bearer\tsk_controlled-mixed-key'],
  ['invalid canonical API key', 'Bearer sk_invalid-mixed-key'],
  ['invalid lowercase API key', 'bearer sk_invalid-mixed-key'],
  ['canonical service token', 'Bearer controlled-mixed-service-token'],
  ['lowercase service scheme', 'bearer controlled-mixed-service-token'],
  ['multiple service separators', 'Bearer  controlled-mixed-service-token'],
  ['tab service separator', 'Bearer\tcontrolled-mixed-service-token'],
  ['valid session bearer', 'Bearer session-1'],
  ['ambiguous non-Bearer scheme', 'Basic controlled-ambiguous-value'],
  ['empty authorization', '']
];
for (const [credentialName, authorization] of MIXED_AUTHORIZATION) for (const [routeName, route, path, body] of [
  ['start', startRoute, '/api/tarot-reading/jobs', { ...PAYLOAD, ...FORGED }],
  ['local retry', localRetryRoute, '/api/tarot-reading/visual-retry', { savedSource: SOURCE, ...FORGED }],
  ['journal retry', journalRetryRoute, '/api/journal/entry-1/visual-retry', FORGED]
]) test(`mixed credential ${credentialName} with Pro cookie excludes ${routeName} visual work`, async t => {
  const f = await fixture(t);
  const key = 'sk_controlled-mixed-key';
  await f.DB.prepare('INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind('mixed-key', 'user-1', await hashApiKey(key), 'sk_contr', 'offline mixed credential', Math.floor(Date.now() / 1000)).run();
  f.env.GPT_SERVICE_TOKEN = 'controlled-mixed-service-token';
  f.env.GPT_SERVICE_TIER = 'pro';
  const request = f.request(path, body); request.headers.set('Authorization', authorization);
  const response = await route({ env: f.env, request, params: { entryId: 'entry-1' }, waitUntil: p => f.background.push(p) });
  assert.ok([200, 403].includes(response.status), `existing route authentication status: ${response.status}`);
  await f.drain(); f.assertExcluded();
  assert.equal(f.DB.rows('SELECT narrative FROM journal_entries WHERE id = ?', ['entry-1'])[0].narrative, SOURCE.raw);
  if (routeName === 'start') {
    assert.equal(response.status, 200); assert.equal(f.proseStarts(), 1);
    assert.equal(f.bodies[0].payload.userQuestion, PAYLOAD.userQuestion);
    assert.equal(f.bodies[0].visualInit, null);
    assert.equal(f.forwardedHeaders[0].get('Authorization'), authorization || null, 'prose credentials retain existing forwarding');
    assert.equal(f.forwardedHeaders[0].get('Cookie'), 'session=session-1');
  }
});
