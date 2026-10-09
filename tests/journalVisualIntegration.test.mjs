import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession } from './helpers/journalFixtures.mjs';
import { saveAppJournalEntry } from '../functions/lib/journalEntries.js';
import { onRequestGet as getEntry, onRequestDelete as deleteEntry } from '../functions/api/journal/[id].js';
import { onRequestGet as getJournal } from '../functions/api/journal.js';
import { registerVisualResult, updateVisualResultSource, commitVisualResult, computeSourceFingerprint } from '../functions/lib/readingVisualResults.js';
import { createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

const USER = { id: 'visual-integration', subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session' };
const BODY = { spread: 'One Card', spreadKey: 'single', cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }],
  question: 'Where is my hope?', personalReading: 'The Star pours into a pool.', readingResultId: 'integration-result' };
async function setup(t) {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: USER.id });
  await seedSession(db, { id: 'visual-session', userId: USER.id });
  return { DB: db };
}
async function register(env) {
  const { spreadHash, contextHash } = await computeSourceFingerprint(BODY);
  const binding = { readingResultId: BODY.readingResultId, sourceRevision: 0, spreadHash, contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  assert.equal((await registerVisualResult({ db: env.DB, userId: USER.id, readingResultId: BODY.readingResultId, binding })).ok, true);
  await updateVisualResultSource({ db: env.DB, userId: USER.id, readingResultId: BODY.readingResultId, binding, raw: BODY.personalReading, complete: true });
  const ledger = createVisualCueLedger(binding);
  ledger.raw = BODY.personalReading; ledger.analyzedEnd = ledger.raw.length; ledger.analyzedHash = await hashVisualCueText(ledger.raw);
  ledger.ledgerRevision = 1;
  ledger.cues = [{ id: 'vc:integration', kind: 'literal', passage: { start: 0, end: 8, quote: 'The Star' }, targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: ['pool-pour'] }] }];
  assert.equal((await commitVisualResult({ db: env.DB, userId: USER.id, readingResultId: BODY.readingResultId, binding, ledger, expectedLedgerRevision: 0, finalRaw: BODY.personalReading })).ok, true);
}
function request(path, method = 'GET') { return new Request(`https://test.invalid/api/journal${path}`, { method, headers: { Cookie: 'session=visual-session' } }); }

test('prose saves succeed without visual identity and with an unregistered ID', async t => {
  const env = await setup(t);
  for (const readingResultId of [null, 'unregistered']) {
    const saved = await saveAppJournalEntry({ env, user: USER, body: { ...BODY, readingResultId } });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.visual, undefined);
  }
});

test('registered completion survives save and real journal GET/list routes return source-bound ledger', async t => {
  const env = await setup(t);
  await register(env);
  const saved = await saveAppJournalEntry({ env, user: USER, body: BODY });
  const id = saved.body.entry.id;
  assert.equal(saved.body.visual.status, 'complete');
  const response = await getEntry({ env, request: request(`/${id}`), params: { id } });
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.equal(detail.entry.visual.snapshot.raw, BODY.personalReading);
  assert.equal(detail.entry.visual.binding.readingResultId, BODY.readingResultId);
  const list = await getJournal({ env, request: request('') });
  assert.equal(list.status, 200);
  const data = await list.json();
  assert.equal(data.entries[0].visual.snapshot.raw, BODY.personalReading);
});

test('actual DELETE route removes result before FK link loss and revokes the private job', async t => {
  const env = await setup(t);
  await register(env);
  let revoked = 0;
  env.READING_VISUAL_JOBS = { idFromName: id => id, get: () => ({ fetch: async url => { assert.ok(url.endsWith('/revoke')); revoked++; return new Response('{}'); } }) };
  const saved = await saveAppJournalEntry({ env, user: USER, body: BODY });
  const id = saved.body.entry.id;
  const response = await deleteEntry({ env, request: request(`/${id}`, 'DELETE'), params: { id } });
  assert.equal(response.status, 200);
  assert.equal(revoked, 1);
  assert.equal(await env.DB.prepare('SELECT id FROM reading_visual_results WHERE id = ?').bind(BODY.readingResultId).first(), null);
  assert.equal(await env.DB.prepare('SELECT id FROM journal_entries WHERE id = ?').bind(id).first(), null);
});
