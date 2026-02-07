import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onRequestPost } from '../functions/api/share-notes/[token]/report.js';

function createMockDb({ shareToken = 'share-token', shareExpiresAt = null, noteIds = ['note-1'] } = {}) {
  const reports = [];
  const validNoteIds = new Set(noteIds);

  return {
    reports,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      return {
        bind(...params) {
          return {
            first: async () => {
              if (normalized.includes('from share_tokens')) {
                const token = params[0];
                if (token !== shareToken) return null;
                return {
                  token,
                  user_id: 'user-1',
                  scope: 'journal',
                  title: 'Shared Reading',
                  created_at: 1700000000,
                  expires_at: shareExpiresAt,
                  view_count: 1,
                  meta_json: '{}'
                };
              }

              if (normalized.includes('from share_notes')) {
                const [noteId, token] = params;
                if (token !== shareToken) return null;
                return validNoteIds.has(noteId) ? { id: noteId } : null;
              }

              if (normalized.includes('from share_note_reports')) {
                if (normalized.includes('min(created_at)')) {
                  const [token, reporterId, windowStart] = params;
                  const oldest = reports
                    .filter((row) => row.token === token && row.reporter_id === reporterId && row.created_at >= windowStart)
                    .reduce((min, row) => Math.min(min, row.created_at), Number.POSITIVE_INFINITY);
                  return { oldest_created_at: Number.isFinite(oldest) ? oldest : null };
                }

                const [noteId, reporterId] = params;
                const existing = reports.find(
                  (row) => row.note_id === noteId && row.reporter_id === reporterId
                );
                return existing ? { id: existing.id } : null;
              }

              throw new Error(`Unexpected first() query in test mock: ${normalized}`);
            },
            run: async () => {
              if (!normalized.startsWith('insert into share_note_reports')) {
                throw new Error(`Unexpected run() query in test mock: ${normalized}`);
              }

              const [
                id,
                noteId,
                token,
                reporterId,
                reason,
                details,
                userAgent,
                createdAt,
                countToken,
                countReporterId,
                windowStart,
                limit
              ] = params;

              const inWindowCount = reports.filter(
                (row) =>
                  row.token === countToken &&
                  row.reporter_id === countReporterId &&
                  row.created_at >= windowStart
              ).length;

              if (inWindowCount >= limit) {
                return { success: true, meta: { changes: 0 } };
              }

              const duplicate = reports.find(
                (row) => row.note_id === noteId && row.reporter_id === reporterId
              );
              if (duplicate) {
                throw new Error('UNIQUE constraint failed: share_note_reports.note_id, share_note_reports.reporter_id');
              }

              reports.push({
                id,
                note_id: noteId,
                token,
                reporter_id: reporterId,
                reason,
                details,
                user_agent: userAgent,
                created_at: createdAt
              });

              return { success: true, meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}

function buildContext({
  db,
  token = 'share-token',
  headers = {},
  body = {}
} = {}) {
  const request = new Request(`https://example.com/api/share-notes/${token}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.5',
      'User-Agent': 'ShareReportTest/1.0',
      ...headers
    },
    body: JSON.stringify({
      noteId: 'note-1',
      reason: 'spam',
      ...body
    })
  });

  return {
    request,
    env: {
      DB: db || createMockDb({ shareToken: token })
    },
    params: { token }
  };
}

describe('share note report API', () => {
  it('derives a non-null reporter id when reporterId is missing', async () => {
    const db = createMockDb();
    const response = await onRequestPost(buildContext({ db, body: { reporterId: undefined } }));
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.status, 'reported');
    assert.equal(db.reports.length, 1);
    assert.ok(db.reports[0].reporter_id);
    assert.match(db.reports[0].reporter_id, /^anon-/);
  });

  it('prevents duplicate reports even when reporterId is omitted', async () => {
    const db = createMockDb();

    const first = await onRequestPost(buildContext({ db, body: { reporterId: undefined } }));
    const second = await onRequestPost(buildContext({ db, body: { reporterId: undefined } }));
    const secondPayload = await second.json();

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(secondPayload.status, 'already_reported');
    assert.equal(db.reports.length, 1);
  });

  it('ignores client-supplied reporterId for dedupe', async () => {
    const db = createMockDb();

    const first = await onRequestPost(buildContext({ db, body: { reporterId: 'spoof-1' } }));
    const second = await onRequestPost(buildContext({ db, body: { reporterId: 'spoof-2' } }));
    const secondPayload = await second.json();

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(secondPayload.status, 'already_reported');
    assert.equal(db.reports.length, 1);
  });

  it('rate limits repeated reports per client/token window', async () => {
    const noteIds = Array.from({ length: 20 }, (_value, index) => `note-${index + 1}`);
    const db = createMockDb({ noteIds });

    let limitedResponse = null;
    for (const noteId of noteIds) {
      const response = await onRequestPost(buildContext({
        db,
        body: { noteId, reporterId: crypto.randomUUID() }
      }));
      if (response.status === 429) {
        limitedResponse = response;
        break;
      }
    }

    assert.ok(limitedResponse, 'expected rate limiter to return 429');
    const payload = await limitedResponse.json();
    assert.equal(payload.error, 'Too many reports submitted. Please wait before trying again.');
    assert.ok(Number(limitedResponse.headers.get('Retry-After')) >= 1);
  });
});
