import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onRequestGet } from '../functions/api/journal.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser } from './helpers/journalFixtures.mjs';

async function setup(t, user = {}) {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, user);
  await seedSession(db);
  return db;
}

function request(db, query = 'summary=true', headers = { Cookie: 'session=session-1' }) {
  return onRequestGet({
    request: new Request(`https://example.test/api/journal?${query}`, { headers }),
    env: { DB: db }
  });
}

function observeQueries(db) {
  const queries = [];
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    queries.push(sql);
    return prepare(sql);
  };
  return queries;
}

function journalQueries(queries) {
  return queries.filter(sql => /\b(?:journal_[a-z_]+|reading_visual_[a-z_]+|visual_[a-z_]+)\b/i.test(sql));
}

test('journal summary returns the owner total and latest timestamp in milliseconds regardless of list pagination', async t => {
  const db = await setup(t);
  await seedEntry(db, { id: 'owner-oldest' });
  await seedEntry(db, { id: 'owner-middle' });
  await seedEntry(db, { id: 'owner-latest' });
  await db.prepare('UPDATE journal_entries SET created_at = ? WHERE id = ?').bind(1700000000, 'owner-oldest').run();
  await db.prepare('UPDATE journal_entries SET created_at = ? WHERE id = ?').bind(1700050000, 'owner-middle').run();
  await db.prepare('UPDATE journal_entries SET created_at = ? WHERE id = ?').bind(1700100000, 'owner-latest').run();
  await seedUser(db, { id: 'other-user' });
  await seedEntry(db, { id: 'other-latest', userId: 'other-user' });
  await db.prepare('UPDATE journal_entries SET created_at = ? WHERE id = ?').bind(1800000000, 'other-latest').run();

  const response = await request(db, 'summary=true&limit=1&offset=30&cursor=1&all=true&includeFollowups=true');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { summary: { total: 3, lastReadingAt: 1700100000000 } });
  assert.match(response.headers.get('Content-Type'), /application\/json/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('an empty owner journal returns zero and null even when another owner has readings', async t => {
  const db = await setup(t);
  await seedUser(db, { id: 'other-user' });
  await seedEntry(db, { id: 'other-entry', userId: 'other-user' });

  const response = await request(db);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { summary: { total: 0, lastReadingAt: null } });
});

test('journal summary loads only an aggregate and never reading content, vectors, visuals or follow-ups', async t => {
  const db = await setup(t);
  await seedEntry(db, { narrative: 'Private reading content.'.repeat(5000), reflections: { Overall: 'Private reflection.' } });
  await db.prepare(`UPDATE journal_entries SET created_at = 1700100000,
    question = 'Private question.', extracted_steps = '["Private step."]',
    step_embeddings = ?, extraction_version = 'private-version' WHERE id = 'entry-1'`)
    .bind(JSON.stringify([Array(1024).fill(0.5)])).run();
  const queries = observeQueries(db);

  const response = await request(db, 'summary=true&includeFollowups=true');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { summary: { total: 1, lastReadingAt: 1700100000000 } });
  const dataQueries = journalQueries(queries);
  assert.equal(dataQueries.length, 1, 'summary must use one aggregate without related journal data queries');
  assert.match(dataQueries[0], /\bCOUNT\s*\(\s*\*\s*\)/i);
  assert.match(dataQueries[0], /\bMAX\s*\(\s*created_at\s*\)/i);
  assert.doesNotMatch(dataQueries[0], /\b(?:question|cards_json|narrative|reflections_json|extracted_steps|step_embeddings)\b/i);
});

test('an active Pro account can read the journal summary', async t => {
  const db = await setup(t, { tier: 'pro' });

  const response = await request(db);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { summary: { total: 0, lastReadingAt: null } });
});

for (const [name, user] of [
  ['a Free account', { tier: 'free' }],
  ['an expired Plus account', { tier: 'plus', status: 'expired' }]
]) {
  test(`${name} receives 403 before any journal summary query`, async t => {
    const db = await setup(t, user);
    await seedEntry(db);
    const queries = observeQueries(db);

    const response = await request(db);

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.tierLimited, true);
    assert.equal(payload.requiredTier, 'plus');
    assert.equal(payload.summary, undefined);
    assert.deepEqual(journalQueries(queries), []);
  });
}

test('a guest receives 401 without any journal summary query', async t => {
  const db = await setup(t);
  const queries = observeQueries(db);

  const response = await request(db, 'summary=true', {});

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Not authenticated' });
  assert.deepEqual(journalQueries(queries), []);
});

test('a failed journal summary read returns the existing generic 500 response', async t => {
  const db = await setup(t);
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    if (/\bjournal_entries\b/i.test(sql)) throw new Error('Private database failure');
    return prepare(sql);
  };
  t.mock.method(console, 'error', () => {});

  const response = await request(db);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal server error' });
});

test('summary=false preserves the existing paginated list response', async t => {
  const db = await setup(t);
  await seedEntry(db, { id: 'first-entry', narrative: 'The first reading.' });
  await seedEntry(db, { id: 'second-entry', narrative: 'The second reading.' });
  await db.prepare("UPDATE journal_entries SET created_at = 1700100000 WHERE id = 'second-entry'").run();
  await db.prepare("UPDATE journal_entries SET created_at = 1700000000 WHERE id = 'first-entry'").run();

  const response = await request(db, 'summary=false&limit=1');

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.summary, undefined);
  assert.equal(payload.entries.length, 1);
  assert.equal(payload.entries[0].id, 'second-entry');
  assert.equal(payload.entries[0].personalReading, 'The second reading.');
  assert.deepEqual(payload.pagination, {
    total: 2, limit: 1, offset: 0, cursor: null, nextCursor: 1700100000000, hasMore: true
  });
});
