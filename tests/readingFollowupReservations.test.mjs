import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  reserveFollowUpSlot,
  finalizeFollowUpUsage,
  releaseFollowUpReservation,
  touchFollowUpReservation,
  getPerReadingFollowUpCount,
  getDailyFollowUpCount
} from '../functions/api/reading-followup.js';

class MockStatement {
  constructor(query, db) {
    this.query = query;
    this.db = db;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    return this.db.resolveFirst(this.query, this.params);
  }

  async run() {
    return this.db.resolveRun(this.query, this.params);
  }
}

class MockFollowUpDb {
  constructor(rows = []) {
    this.rows = rows.map(row => ({ ...row }));
  }

  prepare(query) {
    return new MockStatement(query, this);
  }

  resolveFirst(query, params) {
    if (query.includes('SELECT COUNT(*) as count') && query.includes('reading_request_id')) {
      const [userId, readingIdentifier, cutoffSeconds] = params;
      const count = this.rows.filter(row => (
        row.user_id === userId &&
        row.reading_request_id === readingIdentifier &&
        isCounted(row, cutoffSeconds)
      )).length;
      return { count };
    }

    if (query.includes('SELECT COUNT(*) as count') && query.includes('DATE(datetime(created_at')) {
      const [userId, today, cutoffSeconds] = params;
      const count = this.rows.filter(row => (
        row.user_id === userId &&
        isSameDay(row.created_at, today) &&
        isCounted(row, cutoffSeconds)
      )).length;
      return { count };
    }

    if (query.includes('SELECT turn_number FROM follow_up_usage')) {
      const [reservationId] = params;
      const row = this.rows.find(entry => entry.id === reservationId);
      return row ? { turn_number: row.turn_number } : null;
    }

    return null;
  }

  resolveRun(query, params) {
    if (query.includes('DELETE FROM follow_up_usage') && query.includes('COALESCE')) {
      const [cutoffSeconds] = params;
      const before = this.rows.length;
      this.rows = this.rows.filter(row => !(
        row.response_length == null &&
        getUpdatedAt(row) < cutoffSeconds
      ));
      return { meta: { changes: before - this.rows.length } };
    }

    if (query.includes('DELETE FROM follow_up_usage') && query.includes('WHERE id = ?')) {
      const [reservationId] = params;
      const before = this.rows.length;
      this.rows = this.rows.filter(row => !(
        row.id === reservationId && row.response_length == null
      ));
      return { meta: { changes: before - this.rows.length } };
    }

    if (query.includes('UPDATE follow_up_usage') && query.includes('SET response_length')) {
      const [responseLength, journalContextUsed, patternsFound, latencyMs, provider, reservationId] = params;
      const row = this.rows.find(entry => entry.id === reservationId);
      if (!row) {
        return { meta: { changes: 0 } };
      }
      row.response_length = responseLength;
      row.journal_context_used = journalContextUsed;
      row.patterns_found = patternsFound;
      row.latency_ms = latencyMs;
      row.provider = provider;
      return { meta: { changes: 1 } };
    }

    if (query.includes('UPDATE follow_up_usage') && query.includes('SET reservation_updated_at')) {
      const [reservationUpdatedAt, reservationId] = params;
      const row = this.rows.find(entry => entry.id === reservationId && entry.response_length == null);
      if (!row) {
        return { meta: { changes: 0 } };
      }
      row.reservation_updated_at = reservationUpdatedAt;
      return { meta: { changes: 1 } };
    }

    if (query.includes('INSERT INTO follow_up_usage')) {
      const [
        userId,
        readingIdentifier,
        cutoffSeconds,
        perDayUserId,
        perDayCutoffSeconds,
        today,
        reservationId,
        insertUserId,
        requestId,
        insertReadingId,
        questionLength,
        createdAt,
        reservationUpdatedAt,
        perReadingLimit,
        perDayLimit
      ] = params;

      const perReadingRows = this.rows.filter(row => (
        row.user_id === userId &&
        row.reading_request_id === readingIdentifier &&
        isCounted(row, cutoffSeconds)
      ));
      const perReadingCount = perReadingRows.length;
      const maxTurn = perReadingRows.reduce((max, row) => Math.max(max, row.turn_number || 0), 0);

      const perDayCount = this.rows.filter(row => (
        row.user_id === perDayUserId &&
        isSameDay(row.created_at, today) &&
        isCounted(row, perDayCutoffSeconds)
      )).length;

      if (perReadingCount >= perReadingLimit || perDayCount >= perDayLimit) {
        return { meta: { changes: 0 } };
      }

      this.rows.push({
        id: reservationId,
        user_id: insertUserId,
        request_id: requestId,
        reading_request_id: insertReadingId,
        turn_number: maxTurn + 1,
        question_length: questionLength,
        response_length: null,
        journal_context_used: 0,
        patterns_found: 0,
        latency_ms: null,
        provider: null,
        created_at: createdAt,
        reservation_updated_at: reservationUpdatedAt
      });

      return { meta: { changes: 1 } };
    }

    return { meta: { changes: 0 } };
  }
}

function getUpdatedAt(row) {
  return row.reservation_updated_at ?? row.created_at;
}

function isCounted(row, cutoffSeconds) {
  return row.response_length != null || getUpdatedAt(row) >= cutoffSeconds;
}

function isSameDay(createdAtSeconds, today) {
  return new Date(createdAtSeconds * 1000).toISOString().split('T')[0] === today;
}

function createUsageRow(overrides = {}) {
  const hasResponseLength = Object.prototype.hasOwnProperty.call(overrides, 'response_length');
  const hasCreatedAt = Object.prototype.hasOwnProperty.call(overrides, 'created_at');
  const createdAt = hasCreatedAt ? overrides.created_at : BASELINE_SECONDS;
  const reservationUpdatedAt = Object.prototype.hasOwnProperty.call(overrides, 'reservation_updated_at')
    ? overrides.reservation_updated_at
    : createdAt;

  return {
    id: overrides.id || 'row-1',
    user_id: overrides.user_id || 'user-1',
    request_id: overrides.request_id || 'req-1',
    reading_request_id: overrides.reading_request_id || 'read-1',
    turn_number: overrides.turn_number || 1,
    question_length: overrides.question_length ?? 20,
    response_length: hasResponseLength ? overrides.response_length : null,
    journal_context_used: overrides.journal_context_used ?? 0,
    patterns_found: overrides.patterns_found ?? 0,
    latency_ms: overrides.latency_ms ?? null,
    provider: overrides.provider ?? null,
    created_at: createdAt,
    reservation_updated_at: reservationUpdatedAt
  };
}

const BASELINE_SECONDS = Math.floor(Date.parse('2026-01-01T12:00:00Z') / 1000);

const DEFAULT_LIMITS = { perReading: 2, perDay: 5 };

describe('follow-up reservation tracking', () => {
  test('reserveFollowUpSlot clears expired pending reservations and assigns turn number', async () => {
    const ttlSeconds = 60;
    const expiredRow = createUsageRow({
      id: 'expired',
      created_at: BASELINE_SECONDS - 120,
      reservation_updated_at: BASELINE_SECONDS - 120,
      response_length: null
    });
    const db = new MockFollowUpDb([expiredRow]);

    const result = await reserveFollowUpSlot(db, {
      userId: 'user-1',
      requestId: 'req-new',
      readingIdentifier: 'read-1',
      questionLength: 30,
      limits: DEFAULT_LIMITS,
      ttlSeconds,
      nowSeconds: BASELINE_SECONDS
    });

    assert.equal(result.reserved, true);
    assert.equal(result.turnNumber, 1);
    assert.equal(db.rows.some(row => row.id === 'expired'), false);
    assert.ok(db.rows.find(row => row.id === result.reservationId));
  });

  test('touchFollowUpReservation refreshes pending reservation for TTL counting', async () => {
    const ttlSeconds = 60;
    const pendingRow = createUsageRow({
      id: 'pending',
      created_at: BASELINE_SECONDS - 120,
      reservation_updated_at: BASELINE_SECONDS - 120,
      response_length: null
    });
    const db = new MockFollowUpDb([pendingRow]);

    const before = await getPerReadingFollowUpCount(db, 'user-1', 'read-1', {
      ttlSeconds,
      nowSeconds: BASELINE_SECONDS
    });
    assert.equal(before, 0);

    const touchResult = await touchFollowUpReservation(db, 'pending', {
      nowSeconds: BASELINE_SECONDS
    });
    assert.equal(touchResult.updated, true);

    const after = await getPerReadingFollowUpCount(db, 'user-1', 'read-1', {
      ttlSeconds,
      nowSeconds: BASELINE_SECONDS
    });
    assert.equal(after, 1);
  });

  test('finalizeFollowUpUsage persists usage and release only clears pending rows', async () => {
    const db = new MockFollowUpDb();

    const reservation = await reserveFollowUpSlot(db, {
      userId: 'user-1',
      requestId: 'req-final',
      readingIdentifier: 'read-1',
      questionLength: 10,
      limits: DEFAULT_LIMITS,
      ttlSeconds: 60,
      nowSeconds: BASELINE_SECONDS
    });

    const finalizeResult = await finalizeFollowUpUsage(db, {
      reservationId: reservation.reservationId,
      responseLength: 140,
      journalContextUsed: true,
      patternsFound: 2,
      latencyMs: 320,
      provider: 'azure-test'
    });

    assert.equal(finalizeResult.updated, true);
    const finalizedRow = db.rows.find(row => row.id === reservation.reservationId);
    assert.equal(finalizedRow.response_length, 140);

    const releaseFinalized = await releaseFollowUpReservation(db, reservation.reservationId);
    assert.equal(releaseFinalized.released, false);

    const pendingRow = createUsageRow({ id: 'pending-release', created_at: BASELINE_SECONDS });
    db.rows.push(pendingRow);

    const releasePending = await releaseFollowUpReservation(db, 'pending-release');
    assert.equal(releasePending.released, true);
    assert.equal(db.rows.some(row => row.id === 'pending-release'), false);
  });

  test('getDailyFollowUpCount ignores expired pending rows but counts completed', async () => {
    const ttlSeconds = 60;
    const expiredPending = createUsageRow({
      id: 'expired-pending',
      created_at: BASELINE_SECONDS - 120,
      reservation_updated_at: BASELINE_SECONDS - 120,
      response_length: null
    });
    const completedRow = createUsageRow({
      id: 'completed',
      created_at: BASELINE_SECONDS - 120,
      response_length: 80
    });
    const previousDay = createUsageRow({
      id: 'yesterday',
      created_at: BASELINE_SECONDS - 86400,
      response_length: 50
    });

    const db = new MockFollowUpDb([expiredPending, completedRow, previousDay]);

    const count = await getDailyFollowUpCount(db, 'user-1', {
      ttlSeconds,
      nowSeconds: BASELINE_SECONDS
    });

    assert.equal(count, 1);
  });
});
