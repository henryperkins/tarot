import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, THREE_CARDS } from './helpers/journalFixtures.mjs';
import { isUniqueViolation, saveAppJournalEntry } from '../functions/lib/journalEntries.js';

const USER = Object.freeze({
  id: 'user-1',
  subscription_tier: 'plus',
  subscription_status: 'active',
  auth_provider: 'session'
});

const APP_BODY = Object.freeze({
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  question: 'What should I focus on?',
  cards: THREE_CARDS,
  personalReading: 'The Hermit asks for patience.',
  sessionSeed: '12345',
  requestId: 'req-app-1',
  deckId: 'rws-1909'
});

async function setup() {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1' });
  return { d1, env: { DB: d1 } };
}

function countEntries(d1) {
  return d1.rows('SELECT COUNT(*) AS n FROM journal_entries')[0].n;
}

describe('migration 0030', () => {
  it('adds a partial unique index on (user_id, idempotency_key)', async () => {
    const d1 = await createD1();
    const [index] = d1.rows(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_journal_user_idempotency_key_unique'"
    );
    assert.ok(index, 'index should exist');
    assert.match(index.sql, /UNIQUE INDEX/i);
    assert.match(index.sql, /WHERE idempotency_key IS NOT NULL/i);
  });
});

describe('isUniqueViolation', () => {
  it('matches SQLite and D1-wrapped unique errors for the named column only', () => {
    const sqlite = new Error('UNIQUE constraint failed: journal_entries.user_id, journal_entries.session_seed');
    const d1 = new Error('D1_ERROR: UNIQUE constraint failed: journal_entries.user_id, journal_entries.idempotency_key: SQLITE_CONSTRAINT');
    assert.equal(isUniqueViolation(sqlite, 'session_seed'), true);
    assert.equal(isUniqueViolation(sqlite, 'idempotency_key'), false);
    assert.equal(isUniqueViolation(d1, 'idempotency_key'), true);
    assert.equal(isUniqueViolation(new Error('no such table'), 'session_seed'), false);
  });
});

describe('saveAppJournalEntry', () => {
  it('creates an entry and answers 201', async () => {
    const { d1, env } = await setup();
    const result = await saveAppJournalEntry({ env, user: USER, body: APP_BODY });

    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    const [row] = d1.rows('SELECT user_id, session_seed, request_id, idempotency_key FROM journal_entries');
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.session_seed, '12345');
    assert.equal(row.request_id, 'req-app-1');
    assert.equal(row.idempotency_key, null, 'app saves never set a reading identity');
  });

  it('answers 400 when spread, spreadKey or cards are missing', async () => {
    const { d1, env } = await setup();
    for (const missing of ['spread', 'spreadKey', 'cards']) {
      const body = { ...APP_BODY, [missing]: undefined };
      const result = await saveAppJournalEntry({ env, user: USER, body });
      assert.equal(result.status, 400, missing);
      assert.equal(result.body.error, 'Invalid journal entry data');
    }
    assert.equal(countEntries(d1), 0);
  });

  it('returns the existing entry with 200 for a repeated seed', async () => {
    const { d1, env } = await setup();
    const first = await saveAppJournalEntry({ env, user: USER, body: APP_BODY });
    const second = await saveAppJournalEntry({ env, user: USER, body: APP_BODY });

    assert.equal(second.status, 200);
    assert.equal(second.body.deduplicated, true);
    assert.equal(second.body.entry.id, first.body.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('resolves two concurrent saves of one seed to a single row', async () => {
    const { d1, env } = await setup();
    const [a, b] = await Promise.all([
      saveAppJournalEntry({ env, user: USER, body: APP_BODY }),
      saveAppJournalEntry({ env, user: USER, body: APP_BODY })
    ]);

    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal(a.body.entry.id, b.body.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('always inserts saves without a seed', async () => {
    const { d1, env } = await setup();
    const body = { ...APP_BODY, sessionSeed: undefined };
    await saveAppJournalEntry({ env, user: USER, body });
    await saveAppJournalEntry({ env, user: USER, body });
    assert.equal(countEntries(d1), 2);
  });

  it('stores the narrative byte for byte', async () => {
    const { d1, env } = await setup();
    const narrative = '  Line one — ✨ café\r\n\r\nLine two with trailing space  ';
    await saveAppJournalEntry({ env, user: USER, body: { ...APP_BODY, personalReading: narrative } });
    assert.equal(d1.rows('SELECT narrative FROM journal_entries')[0].narrative, narrative);
  });
});
