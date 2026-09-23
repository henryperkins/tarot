import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, THREE_CARDS } from './helpers/journalFixtures.mjs';
import { isUniqueViolation, saveAppJournalEntry, saveReadingJournalEntry } from '../functions/lib/journalEntries.js';

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

const READING_ENTRY = Object.freeze({
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  question: 'What should I focus on?',
  cards: THREE_CARDS,
  personalReading: 'The Hermit asks for patience.',
  themes: { dominantSuit: 'Cups' },
  context: 'self',
  provider: 'openai-native',
  sessionSeed: null,
  requestId: 'req-mcp-1',
  deckId: 'rws-1909',
  userPreferences: null
});

/**
 * Wrap the SQLite D1 so the reading INSERT fails the way a lost D1 round
 * trip does: optionally after the row landed, optionally with the
 * verification lookup failing too.
 */
function failingInsertDb(d1, { landThenThrow = false, failVerify = false } = {}) {
  return {
    prepare(sql) {
      const statement = d1.prepare(sql);
      const isInsert = /INSERT INTO journal_entries/.test(sql);
      const isVerify = /idempotency_key = \?/.test(sql);
      return {
        bind(...args) {
          const bound = statement.bind(...args);
          return {
            first: (...rest) => (failVerify && isVerify
              ? Promise.reject(new Error('D1_ERROR: Network connection lost.'))
              : bound.first(...rest)),
            all: () => bound.all(),
            run: async () => {
              if (!isInsert) return bound.run();
              if (landThenThrow) await bound.run();
              throw new Error('D1_ERROR: Network connection lost.');
            }
          };
        }
      };
    },
    batch: (statements) => d1.batch(statements)
  };
}

describe('saveReadingJournalEntry (MCP)', () => {
  it('saves a new reading under its reading identity', async () => {
    const { d1, env } = await setup();
    const result = await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });

    assert.equal(result.outcome, 'saved');
    const [row] = d1.rows('SELECT id, user_id, idempotency_key, context, narrative, cards_json FROM journal_entries');
    assert.equal(row.id, result.entry.id);
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.idempotency_key, 'reading:req-mcp-1');
    assert.equal(row.context, 'self');
    assert.equal(row.narrative, READING_ENTRY.personalReading);
    assert.deepEqual(JSON.parse(row.cards_json), THREE_CARDS);
  });

  it('answers already_saved for a second save of the same reading', async () => {
    const { d1, env } = await setup();
    const first = await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });
    const second = await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });

    assert.equal(second.outcome, 'already_saved');
    assert.equal(second.entry.id, first.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('keeps one row when two saves of a seedless reading race', async () => {
    const { d1, env } = await setup();
    const [a, b] = await Promise.all([
      saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY }),
      saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY })
    ]);

    assert.deepEqual([a.outcome, b.outcome].sort(), ['already_saved', 'saved']);
    assert.equal(a.entry.id, b.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('keeps one row when two saves of a seeded reading race', async () => {
    const { d1, env } = await setup();
    const entry = { ...READING_ENTRY, sessionSeed: '4242' };
    const [a, b] = await Promise.all([
      saveReadingJournalEntry({ env, user: USER, entry }),
      saveReadingJournalEntry({ env, user: USER, entry })
    ]);

    assert.equal(a.entry.id, b.entry.id);
    assert.equal(countEntries(d1), 1);
    assert.equal(d1.rows('SELECT session_seed FROM journal_entries')[0].session_seed, '4242');
  });

  it('refuses a request ID that already holds a different reading', async () => {
    const { d1, env } = await setup();
    await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });
    const other = { ...READING_ENTRY, cards: [{ ...THREE_CARDS[0], orientation: 'Reversed' }, THREE_CARDS[1], THREE_CARDS[2]] };

    const result = await saveReadingJournalEntry({ env, user: USER, entry: other });

    assert.deepEqual(result, { outcome: 'conflict' });
    assert.equal(countEntries(d1), 1);
  });

  it('stores a reading without its seed when another reading holds that seed', async () => {
    const { d1, env } = await setup();
    const first = await saveReadingJournalEntry({ env, user: USER, entry: { ...READING_ENTRY, sessionSeed: 'rose', requestId: 'req-a' } });
    const secondEntry = { ...READING_ENTRY, sessionSeed: 'rose', requestId: 'req-b', personalReading: 'A different reading.' };

    const second = await saveReadingJournalEntry({ env, user: USER, entry: secondEntry });

    assert.equal(second.outcome, 'saved');
    assert.equal(second.seedShared, true);
    assert.notEqual(second.entry.id, first.entry.id);
    const rows = d1.rows('SELECT idempotency_key, session_seed FROM journal_entries ORDER BY idempotency_key');
    assert.deepEqual(rows, [
      { idempotency_key: 'reading:req-a', session_seed: 'rose' },
      { idempotency_key: 'reading:req-b', session_seed: null }
    ]);

    const retry = await saveReadingJournalEntry({ env, user: USER, entry: secondEntry });
    assert.equal(retry.outcome, 'already_saved');
    assert.equal(retry.entry.id, second.entry.id, 'a shared seed never returns the other reading');
  });

  it('answers saved when the insert landed but its response was lost', async () => {
    const { d1 } = await setup();
    const result = await saveReadingJournalEntry({
      env: { DB: failingInsertDb(d1, { landThenThrow: true }) },
      user: USER,
      entry: READING_ENTRY
    });

    assert.equal(result.outcome, 'saved');
    assert.equal(result.entry.id, d1.rows('SELECT id FROM journal_entries')[0].id);
  });

  it('answers not_saved when the insert failed and nothing landed', async () => {
    const { d1 } = await setup();
    const result = await saveReadingJournalEntry({ env: { DB: failingInsertDb(d1) }, user: USER, entry: READING_ENTRY });

    assert.deepEqual(result, { outcome: 'not_saved' });
    assert.equal(countEntries(d1), 0);
  });

  it('answers unconfirmed when the verification also fails', async () => {
    const { d1 } = await setup();
    const result = await saveReadingJournalEntry({
      env: { DB: failingInsertDb(d1, { failVerify: true }) },
      user: USER,
      entry: READING_ENTRY
    });

    assert.deepEqual(result, { outcome: 'unconfirmed' });
  });

  it('stores the narrative byte for byte', async () => {
    const { d1, env } = await setup();
    const narrative = `  ${'Long passage ✨ café. '.repeat(1000)}\r\nEnd  `;
    await saveReadingJournalEntry({ env, user: USER, entry: { ...READING_ENTRY, personalReading: narrative } });
    assert.equal(d1.rows('SELECT narrative FROM journal_entries')[0].narrative, narrative);
  });
});
