import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { sanitizeFollowUps, insertFollowUps } from '../functions/lib/journalFollowups.js';

class MockDB {
  constructor() {
    this.calls = [];
  }

  prepare() {
    return {
      bind: (...args) => ({
        run: async () => {
          this.calls.push(args);
          return { success: true };
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
    assert.ok(cleaned[1].answer.endsWith('…'), 'long answer should be clamped with ellipsis');
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
  });
});
