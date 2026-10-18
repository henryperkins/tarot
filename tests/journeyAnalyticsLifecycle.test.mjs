import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry, THREE_CARDS } from './helpers/journalFixtures.mjs';
import { onRequest as backfill } from '../functions/api/archetype-journey-backfill.js';
import { onRequest as analytics } from '../functions/api/archetype-journey.js';
import { onRequestDelete as remove } from '../functions/api/journal/[id].js';
import { onRequestPost as save, onRequestGet as list } from '../functions/api/journal.js';
import { saveReadingJournalEntry } from '../functions/lib/journalEntries.js';
import { onRequestGet as exportJournal } from '../functions/api/journal-export/index.js';
import { onRequestGet as patternAlerts } from '../functions/api/journal/pattern-alerts.js';

let db;
beforeEach(async () => {
  db = await createD1();
  await seedUser(db);
  await seedSession(db);
});
afterEach(() => db?.sqlite.close());

function request(path, method = 'GET', body) {
  return new Request(`https://example.test${path}`, {
    method, headers: { Cookie: 'session=session-1', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}
const rebuild = (database = db) => backfill({ request: request('/api/archetype-journey-backfill', 'POST'), env: { DB: database } });
const journey = async () => (await analytics({ request: request('/api/archetype-journey'), env: { DB: db } })).json();
const deleteEntry = id => remove({ request: request(`/api/journal/${id}`, 'DELETE'), env: { DB: db }, params: { id } });
const setEnabled = enabled => analytics({ request: request('/api/archetype-journey/preferences', 'PUT', { archetype_journey_enabled: enabled }), env: { DB: db } });
const savedBody = seed => ({ spread: 'Three Card', spreadKey: 'threeCard', cards: THREE_CARDS, sessionSeed: seed });
const appSave = seed => save({ request: request('/api/journal', 'POST', savedBody(seed)), env: { DB: db } });
const draws = () => db.rows('SELECT COALESCE(SUM(count), 0) AS count FROM card_appearances')[0].count;
const snapshot = () => ({ cards: db.rows('SELECT * FROM card_appearances ORDER BY id'), badges: db.rows('SELECT * FROM archetype_badges ORDER BY id') });

// Stop the real storage operation immediately before publication, keeping SQL
// execution real. Supports the old per-statement and new transactional paths.
function pausePublication(database) {
  let release;
  let signal;
  let paused = false;
  const started = new Promise(resolve => { signal = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const pause = async () => { if (!paused) { paused = true; signal(); await gate; } };
  const wrap = statement => new Proxy(statement, { get(target, key) {
    if (key === 'bind') return (...params) => wrap(target.bind(...params));
    if (key === 'run' && /DELETE FROM card_appearances/i.test(target.sql)) return async () => { await pause(); return target.run(); };
    const value = target[key];
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  return { started, release: () => release(), db: {
    prepare: sql => wrap(database.prepare(sql)),
    batch: async statements => { await pause(); return database.batch(statements); }
  } };
}

test('backfill refuses opted-out and Free users without rebuilding their data', async () => {
  await seedEntry(db);
  await setEnabled(false);
  assert.equal((await rebuild()).status, 403);
  assert.equal(draws(), 0);
  await setEnabled(true);
  await db.prepare("UPDATE users SET subscription_tier = 'free' WHERE id = 'user-1'").run();
  assert.equal((await rebuild()).status, 403);
  const tracking = await analytics({ request: request('/api/archetype-journey/track', 'POST', { entryId: 'entry-1' }), env: { DB: db } });
  assert.equal(tracking.status, 403);
  assert.equal(draws(), 0);
});

test('diagnostics detect missing later readings, extra counts, and an emptied journal', async () => {
  await seedEntry(db);
  assert.equal((await rebuild()).status, 200);
  assert.equal((await journey()).analytics.stats.needsBackfill, false);
  await seedEntry(db, { id: 'later' });
  assert.equal((await journey()).analytics.stats.needsBackfill, true);
  await rebuild();
  await db.prepare('UPDATE card_appearances SET count = count + 1').run();
  assert.equal((await journey()).analytics.stats.needsBackfill, true);
  await db.prepare('DELETE FROM journal_entries').run();
  assert.equal((await journey()).analytics.stats.needsBackfill, true);
  await rebuild();
  assert.equal(draws(), 0);
  assert.equal((await journey()).analytics.stats.needsBackfill, false);
});

test('a rebuild failure rolls back counts and badges instead of publishing a partial history', async () => {
  for (let i = 0; i < 3; i++) await seedEntry(db, { id: `entry-${i}` });
  await rebuild();
  const before = snapshot();
  await db.prepare(`CREATE TRIGGER fail_journey BEFORE INSERT ON card_appearances
    WHEN NEW.card_name = 'The Star' BEGIN SELECT RAISE(ABORT, 'injected analytics failure'); END`).run();
  assert.equal((await rebuild()).status, 500);
  assert.deepEqual(snapshot(), before);
});

test('overlapping backfills serialize and stay idempotent', async () => {
  for (let i = 0; i < 3; i++) await seedEntry(db, { id: `entry-${i}` });
  const results = await Promise.all([rebuild(), rebuild(), rebuild()]);
  assert.deepEqual(results.map(r => r.status), [200, 200, 200]);
  assert.equal(draws(), 9);
  assert.equal(db.rows('SELECT COUNT(*) AS count FROM archetype_badges')[0].count, 3);
});

test('distinct card names cannot collide in badges or block backfills, saves and deletes', async () => {
  const names = ['The Star', 'the star', 'The_Star', 'THE STAR', '星'];
  for (const [index, name] of names.entries()) {
    for (let i = 0; i < 3; i++) await seedEntry(db, { id: `variant-${index}-${i}`, cards: [{ name }] });
  }
  await seedEntry(db, { id: 'unrelated', cards: [{ name: 'The Tower' }] });
  for (const response of await Promise.all([rebuild(), rebuild()])) {
    assert.equal(response.status, 200, await response.clone().text());
  }
  const badges = db.rows('SELECT badge_key, card_name FROM archetype_badges');
  assert.equal(new Set(badges.map(badge => badge.badge_key)).size, 5);
  assert.deepEqual(badges.map(badge => badge.card_name).sort(), [...names].sort());
  assert.equal((await journey()).analytics.stats.needsBackfill, false);

  assert.equal((await appSave('after-collision')).status, 201);
  const reading = { ...savedBody('mcp-after-collision'), requestId: 'mcp-after-collision', personalReading: 'A reading.' };
  assert.equal((await saveReadingJournalEntry({ env: { DB: db }, user: { id: 'user-1' }, entry: reading })).outcome, 'saved');
  assert.equal((await deleteEntry('unrelated')).status, 200);
  assert.equal(draws(), 21);
  assert.equal((await journey()).analytics.stats.needsBackfill, false);
  assert.equal((await deleteEntry('variant-4-0')).status, 200);
  assert.equal(db.rows("SELECT * FROM archetype_badges WHERE card_name = '星'").length, 0);
  assert.equal((await journey()).analytics.stats.needsBackfill, false);
});

test('a delayed backfill reads the committed save and deletion at publication time', { timeout: 10000 }, async () => {
  await seedEntry(db, { id: 'remove-me', cards: [{ name: 'The Tower', number: 16 }] });
  await rebuild();
  const paused = pausePublication(db);
  const pending = rebuild(paused.db);
  await paused.started;
  try {
    assert.equal((await appSave('new-reading')).status, 201);
    assert.equal((await deleteEntry('remove-me')).status, 200);
  } finally { paused.release(); }
  assert.equal((await pending).status, 200);
  assert.equal(draws(), 3);
  assert.equal(db.rows("SELECT * FROM card_appearances WHERE card_name = 'The Tower'").length, 0);
  assert.equal((await journey()).analytics.stats.needsBackfill, false);
});

test('opt-out while a rebuild is waiting prevents publication', { timeout: 10000 }, async () => {
  await seedEntry(db);
  const paused = pausePublication(db);
  const pending = rebuild(paused.db);
  await paused.started;
  try { await setEnabled(false); } finally { paused.release(); }
  assert.equal((await pending).status, 403);
  assert.equal(draws(), 0);
});

test('deletion reconciles counts, timestamps, badges and gallery results before returning', async () => {
  for (let i = 0; i < 3; i++) await seedEntry(db, { id: `entry-${i}` });
  await rebuild();
  assert.equal((await deleteEntry('entry-0')).status, 200);
  assert.equal(draws(), 6);
  assert.equal(db.rows('SELECT * FROM archetype_badges').length, 0);
  await deleteEntry('entry-1');
  await deleteEntry('entry-2');
  const gallery = await analytics({ request: request('/api/archetype-journey/card-frequency'), env: { DB: db } });
  assert.equal((await gallery.json()).stats.totalDraws, 0);
  assert.equal((await journey()).analytics.stats.needsBackfill, false);
});

test('an analytics write failure rolls back journal save and deletion', async () => {
  await seedEntry(db, { id: 'keep-me' });
  await seedEntry(db, { id: 'survivor' });
  await rebuild();
  const before = snapshot();
  await db.prepare(`CREATE TRIGGER fail_journey BEFORE INSERT ON card_appearances
    BEGIN SELECT RAISE(ABORT, 'injected analytics failure'); END`).run();
  assert.equal((await appSave('must-not-save')).status, 500);
  assert.equal(db.rows('SELECT * FROM journal_entries').length, 2);
  assert.equal((await deleteEntry('keep-me')).status, 500);
  assert.equal(db.rows("SELECT * FROM journal_entries WHERE id = 'keep-me'").length, 1);
  assert.deepEqual(snapshot(), before);
});

test('app and MCP saves maintain analytics without browser tracking; retries never double-count', async () => {
  const first = await appSave('app-reading');
  const { entry } = await first.json();
  assert.equal(draws(), 3);
  assert.equal((await appSave('app-reading')).status, 200);
  const user = { id: 'user-1' };
  const reading = { ...savedBody('mcp-reading'), requestId: 'mcp-reading', personalReading: 'A reading.' };
  assert.equal((await saveReadingJournalEntry({ env: { DB: db }, user, entry: reading })).outcome, 'saved');
  assert.equal((await saveReadingJournalEntry({ env: { DB: db }, user, entry: reading })).outcome, 'already_saved');
  for (let i = 0; i < 2; i++) {
    const result = await analytics({ request: request('/api/archetype-journey/track', 'POST', { entryId: entry.id, cards: THREE_CARDS }), env: { DB: db } });
    assert.equal(result.status, 200);
  }
  assert.equal(draws(), 6);
  await setEnabled(false);
  assert.equal((await appSave('disabled-reading')).status, 201);
  assert.equal(draws(), 0);
});

test('tracking requires an owned saved entry and cannot recreate a deleted reading', async () => {
  await seedUser(db, { id: 'other' });
  await seedEntry(db, { id: 'other-entry', userId: 'other' });
  for (const entryId of ['other-entry', 'deleted-entry']) {
    const response = await analytics({ request: request('/api/archetype-journey/track', 'POST', { entryId, cards: THREE_CARDS }), env: { DB: db } });
    assert.equal(response.status, 404);
  }
  assert.equal(draws(), 0);
});

test('all-history endpoint returns more than 100 same-second entries and their follow-ups', async () => {
  for (let i = 0; i < 125; i++) {
    await seedEntry(db, { id: `history-${i}`, sessionSeed: `unique-${i}` });
  }
  await db.prepare(`INSERT INTO journal_followups (id, entry_id, user_id, turn_number, question, answer, created_at)
    VALUES ('followup', 'history-124', 'user-1', 1, 'Next?', 'Keep going.', ?)`).bind(Math.floor(Date.now() / 1000)).run();
  // Enforce D1's binding limit in the local SQLite transport.
  const limitedDb = { prepare(sql) {
    const stmt = db.prepare(sql);
    return { ...stmt, bind(...params) {
      if (params.length > 100) throw new Error('too many SQL variables');
      return stmt.bind(...params);
    } };
  } };
  const response = await list({ request: request('/api/journal?all=true&includeFollowups=true'), env: { DB: limitedDb } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.entries.length, 125);
  assert.equal(result.pagination.hasMore, false);
  assert.deepEqual(result.entries.find(e => e.id === 'history-124').followUps?.map(turn => turn.answer), ['Keep going.']);
});

test('server export defaults to the complete journal and honors an explicit limit without a silent cap', async () => {
  for (let i = 0; i < 125; i++) await seedEntry(db, { id: `export-${i}` });
  for (const [query, expected] of [['', 125], ['&limit=120', 120], ['&limit=2', 2]]) {
    const response = await exportJournal({ request: request(`/api/journal-export?format=json${query}`), env: { DB: db } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).entryCount, expected);
  }
});

test('pattern alerts return distinct owned reading IDs, excluding foreign links and deleted entries', async () => {
  await seedUser(db, { id: 'other' });
  for (let i = 0; i < 3; i++) await seedEntry(db, { id: `pattern-${i}` });
  await seedEntry(db, { id: 'foreign', userId: 'other' });
  const now = Math.floor(Date.now() / 1000);
  for (const id of ['pattern-0', 'pattern-0', 'pattern-1', 'pattern-2', 'foreign']) {
    await db.prepare(`INSERT INTO pattern_occurrences
      (user_id, entry_id, pattern_type, pattern_id, year_month, created_at) VALUES ('user-1', ?, 'dyad', '13-17', ?, ?)`)
      .bind(id, new Date().toISOString().slice(0, 7), now).run();
  }
  const getAlerts = async () => (await patternAlerts({ request: request('/api/journal/pattern-alerts'), env: { DB: db } })).json();
  const { alerts } = await getAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].occurrence_count, 3);
  assert.deepEqual(alerts[0].entryIds.sort(), ['pattern-0', 'pattern-1', 'pattern-2']);
  await deleteEntry('pattern-2');
  assert.deepEqual((await getAlerts()).alerts, []);
});

test('diagnostics repair a legacy rebuild interrupted during badge publication', async () => {
  for (let i = 0; i < 3; i++) await seedEntry(db, { id: `badge-${i}` });
  await rebuild();
  await db.prepare("DELETE FROM archetype_badges WHERE card_name = 'The Star'").run();
  assert.equal((await journey()).analytics.stats.needsBackfill, true);
  await rebuild();
  assert.equal((await journey()).analytics.stats.needsBackfill, false);
  await db.prepare("UPDATE archetype_badges SET metadata_json = '{}' WHERE card_name = 'The Star'").run();
  assert.equal((await journey()).analytics.stats.needsBackfill, true);
  await rebuild();
  assert.equal(db.rows('SELECT COUNT(*) AS count FROM archetype_badges')[0].count, 3);
});

test('a year of three-card readings rebuilds in one publication and isolates other users', async () => {
  await seedUser(db, { id: 'other' });
  await seedEntry(db, { id: 'other-reading', userId: 'other' });
  await db.prepare(`INSERT INTO card_appearances
    (user_id, card_name, year_month, count, first_seen, last_seen) VALUES ('other', 'The Star', '2025-01', 5, 1, 2)`).run();
  const start = Date.UTC(2025, 0, 1) / 1000;
  for (let i = 0; i < 365; i++) {
    await seedEntry(db, { id: `year-${i}` });
    await db.prepare('UPDATE journal_entries SET created_at = ? WHERE id = ?').bind(start + i * 86400, `year-${i}`).run();
  }
  let batches = 0;
  const monitoredDb = { prepare: sql => db.prepare(sql), batch: statements => { batches++; return db.batch(statements); } };
  const response = await rebuild(monitoredDb);
  assert.equal(response.status, 200);
  const { stats } = await response.json();
  assert.equal(stats.cardsTracked, 1095);
  assert.equal(stats.entriesProcessed, 365);
  assert.equal(stats.monthsProcessed, 12);
  assert.equal(batches, 1);
  assert.equal(db.rows("SELECT count FROM card_appearances WHERE user_id = 'other'")[0].count, 5);
});
