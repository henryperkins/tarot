import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  sanitizeFollowUps,
  insertFollowUps,
  loadFollowUpsByEntry,
  deleteFollowUpsByEntry
} from '../functions/lib/journalFollowups.js';

class MockDB {
  constructor({ changes = 0, failCanonicalInsert = false, followupRows = [] } = {}) {
    this.calls = [];
    this.queries = [];
    this.changes = changes;
    this.failCanonicalInsert = failCanonicalInsert;
    this.followupRows = followupRows;
  }

  prepare(query) {
    this.queries.push(query);
    return {
      bind: (...args) => ({
        run: async () => {
          if (this.failCanonicalInsert && query.includes('canonical_answer')) {
            throw new Error('no such column: canonical_answer');
          }
          this.calls.push(args);
          return { success: true, changes: this.changes };
        },
        all: async () => {
          if (query.includes('canonical_answer') && this.failCanonicalInsert) {
            throw new Error('no such column: canonical_answer');
          }
          return { results: this.followupRows };
        }
      })
    };
  }
}

describe('journal follow-ups', () => {
  test('sanitizeFollowUps drops invalid items and clamps length', () => {
    const longText = 'a'.repeat(5000);
    const cleaned = sanitizeFollowUps([
      null,
      { question: '  ', answer: 'test' },
      { question: 'q1', answer: 'a1', turnNumber: 1 },
      { question: 'q2', answer: longText, turnNumber: 1 }, // duplicate turn, should drop
      { question: 'q3', answer: longText } // clamp + auto turn
    ]);

    assert.equal(cleaned.length, 2, 'should keep two valid follow-ups');
    assert.equal(cleaned[0].turnNumber, 1);
    assert.equal(cleaned[0].canonicalAnswer, 'a1');
    assert.ok(cleaned[1].answer.endsWith('…'), 'long answer should be clamped with ellipsis');
    assert.ok(cleaned[1].canonicalAnswer.endsWith('…'), 'long canonical answer should be clamped with ellipsis');
    assert.equal(cleaned[1].turnNumber, 2, 'auto-increment missing turn');
  });

  test('insertFollowUps writes sanitized rows', async () => {
    const db = new MockDB();
    const result = await insertFollowUps(db, 'user-1', 'entry-1', [
      { question: 'q1', answer: 'a1', turnNumber: 1 },
      { question: '', answer: '' } // ignored
    ], { readingRequestId: 'read-1', requestId: 'req-1' });

    assert.equal(result.inserted, 1);
    assert.equal(db.calls.length, 1);
    const bindArgs = db.calls[0];
    // userId, entryId, reading_request_id, request_id, turn_number, question, answer, journal_context_json, created_at
    assert.equal(bindArgs[1], 'user-1');
    assert.equal(bindArgs[2], 'entry-1');
    assert.equal(bindArgs[3], 'read-1');
    assert.equal(bindArgs[4], 'req-1');
    assert.equal(bindArgs[5], 1);
    assert.equal(bindArgs[6], 'q1');
    assert.equal(bindArgs[7], 'a1');
    assert.equal(bindArgs[8], 'a1');
  });

  test('insertFollowUps falls back when canonical_answer column is not yet available', async () => {
    const db = new MockDB({ failCanonicalInsert: true });
    const result = await insertFollowUps(db, 'user-1', 'entry-1', [
      { question: 'q1', answer: 'a1', canonicalAnswer: 'canonical a1', turnNumber: 1 }
    ], { readingRequestId: 'read-1', requestId: 'req-1' });

    assert.equal(result.inserted, 1);
    assert.equal(db.calls.length, 1);
    assert.equal(db.queries.some((query) => query.includes('canonical_answer')), true);
    const bindArgs = db.calls[0];
    assert.equal(bindArgs[7], 'a1');
  });

  test('loadFollowUpsByEntry includes canonical answers only when requested', async () => {
    const db = new MockDB({
      followupRows: [
        {
          entry_id: 'entry-1',
          turn_number: 1,
          question: 'q1',
          answer: 'a1',
          canonical_answer: 'canonical a1',
          journal_context_json: JSON.stringify({ note: 'ctx' }),
          created_at: 1_700_000_000
        }
      ]
    });

    const withoutCanonical = await loadFollowUpsByEntry(db, 'user-1', ['entry-1']);
    const withCanonical = await loadFollowUpsByEntry(db, 'user-1', ['entry-1'], { includeCanonical: true });

    assert.equal(withoutCanonical.get('entry-1')[0].canonicalAnswer, undefined);
    assert.equal(withCanonical.get('entry-1')[0].canonicalAnswer, 'canonical a1');
  });

  test('deleteFollowUpsByEntry binds user and unique entry ids', async () => {
    const db = new MockDB({ changes: 2 });
    const result = await deleteFollowUpsByEntry(db, 'user-1', ['entry-1', 'entry-2', 'entry-1']);

    assert.equal(result.deleted, 2);
    assert.equal(db.queries[0].includes('DELETE FROM journal_followups'), true);
    assert.deepEqual(db.calls[0], ['user-1', 'entry-1', 'entry-2']);
  });

  test('deleteFollowUpsByEntry ignores missing table errors', async () => {
    const db = {
      prepare() {
        return {
          bind: () => ({
            run: async () => {
              throw new Error('no such table: journal_followups');
            }
          })
        };
      }
    };

    const result = await deleteFollowUpsByEntry(db, 'user-1', 'entry-1');
    assert.equal(result.deleted, 0);
  });
});
