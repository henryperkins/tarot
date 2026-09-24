import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedUser } from './helpers/journalFixtures.mjs';

describe('SQLite D1 test harness', () => {
  it('applies every migration, including the journal tables', async () => {
    const d1 = await createD1();
    const columns = d1.rows('PRAGMA table_info(journal_entries)').map((row) => row.name);
    assert.ok(columns.includes('session_seed'));
    assert.ok(columns.includes('request_id'));
    assert.ok(columns.includes('deck_id'));
  });

  it('returns D1-shaped results from first, all and run', async () => {
    const d1 = await createD1();
    await seedUser(d1, { id: 'user-1' });

    const row = await d1.prepare('SELECT id, subscription_tier FROM users WHERE id = ?').bind('user-1').first();
    assert.deepEqual(row, { id: 'user-1', subscription_tier: 'plus' });
    assert.equal(await d1.prepare('SELECT id FROM users WHERE id = ?').bind('user-1').first('id'), 'user-1');
    assert.equal(await d1.prepare('SELECT id FROM users WHERE id = ?').bind('nobody').first(), null);

    const { results } = await d1.prepare('SELECT id FROM users').all();
    assert.equal(results.length, 1);

    const run = await d1.prepare('UPDATE users SET username = ? WHERE id = ?').bind('renamed', 'user-1').run();
    assert.equal(run.meta.changes, 1);
  });

  it('rejects undefined bindings the way D1 does', async () => {
    const d1 = await createD1();
    assert.throws(() => d1.prepare('SELECT ?').bind(undefined), /D1_TYPE_ERROR/);
  });

  it('surfaces unique-constraint failures with the SQLite message', async () => {
    const d1 = await createD1();
    await seedUser(d1, { id: 'user-1' });
    await seedEntry(d1, { id: 'entry-1', sessionSeed: 'seed-1' });
    await assert.rejects(
      seedEntry(d1, { id: 'entry-2', sessionSeed: 'seed-1' }),
      /UNIQUE constraint failed: journal_entries\.user_id, journal_entries\.session_seed/
    );
  });

  it('interleaves concurrent calls at await boundaries, like network round-trips', async () => {
    const d1 = await createD1();
    const order = [];
    const worker = async (name) => {
      await d1.prepare('SELECT 1').first();
      order.push(`${name}1`);
      await d1.prepare('SELECT 1').first();
      order.push(`${name}2`);
    };
    await Promise.all([worker('a'), worker('b')]);
    assert.deepEqual(order, ['a1', 'b1', 'a2', 'b2']);
  });

  it('rolls back a batch when one statement fails', async () => {
    const d1 = await createD1();
    await seedUser(d1, { id: 'user-1' });
    await assert.rejects(d1.batch([
      d1.prepare('UPDATE users SET username = ? WHERE id = ?').bind('changed', 'user-1'),
      d1.prepare('INSERT INTO users (id) VALUES (?)').bind('broken')
    ]));
    assert.equal(d1.rows('SELECT username FROM users WHERE id = ?', ['user-1'])[0].username, 'user_1');
  });
});
