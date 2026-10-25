import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestGet } from '../functions/api/journal.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedSession, seedUser } from './helpers/journalFixtures.mjs';

async function setup(t) {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db);
  await seedSession(db);
  return db;
}

async function page(db, params) {
  const response = await onRequestGet({
    request: new Request(`https://example.test/api/journal?${new URLSearchParams(params)}`, {
      headers: { Cookie: 'session=session-1' }
    }), env: { DB: db }
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('timestamp and ID cursors retain every owned reading saved in the same second', async t => {
  const db = await setup(t);
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    await seedEntry(db, { id, narrative: `Complete reading ${id}` });
    await db.prepare('UPDATE journal_entries SET created_at = 1700100000, question = ? WHERE id = ?').bind(id, id).run();
  }
  await seedUser(db, { id: 'other' });
  await seedEntry(db, { id: 'private-other', userId: 'other' });
  const seen = [];
  let params = { limit: '2' };
  for (let index = 0; index < 5; index += 1) {
    const result = await page(db, params);
    seen.push(...result.entries.map(entry => entry.id));
    assert.ok(result.entries.every(entry => entry.personalReading === `Complete reading ${entry.id}`));
    if (!result.pagination.hasMore) break;
    assert.ok(result.pagination.nextCursorId);
    params = { limit: '2', cursor: String(result.pagination.nextCursor), cursorId: result.pagination.nextCursorId };
  }
  assert.deepEqual(seen, ['e', 'd', 'c', 'b', 'a']);
});

test('continuation uses raw rows even when logical duplicates collapse within a page', async t => {
  const db = await setup(t);
  for (const id of ['a', 'b', 'c']) {
    await seedEntry(db, { id });
    await db.prepare('UPDATE journal_entries SET created_at = 1700100000 WHERE id = ?').bind(id).run();
  }
  await seedEntry(db, { id: 'older', sessionSeed: 'distinct-older' });
  await db.prepare("UPDATE journal_entries SET created_at = 1700000000 WHERE id = 'older'").run();
  const first = await page(db, { limit: '3' });
  assert.equal(first.entries.length, 1);
  assert.equal(first.pagination.hasMore, true);
  assert.equal(first.pagination.nextCursorId, 'a');
  const second = await page(db, { limit: '3', cursor: String(first.pagination.nextCursor), cursorId: first.pagination.nextCursorId });
  assert.deepEqual(second.entries.map(entry => entry.id), ['older']);
});

test('legacy timestamp-only cursors still select strictly older readings', async t => {
  const db = await setup(t);
  await seedEntry(db, { id: 'older' });
  await seedEntry(db, { id: 'newer' });
  await db.prepare("UPDATE journal_entries SET created_at = 1700000000 WHERE id = 'older'").run();
  await db.prepare("UPDATE journal_entries SET created_at = 1700100000 WHERE id = 'newer'").run();
  const result = await page(db, { limit: '10', cursor: '1700100000000' });
  assert.deepEqual(result.entries.map(entry => entry.id), ['older']);
});
