import { loadShareRecord } from '../../../lib/shareData.js';
import { getClientIdentifier, hashClientIdentifier } from '../../../lib/clientId.js';

const ALLOWED_REASONS = new Set([
  'spam',
  'harassment',
  'hate',
  'sexual',
  'self-harm',
  'violence',
  'other'
]);

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const REPORT_RATE_LIMIT_MAX = 8;
const REPORT_RATE_LIMIT_WINDOW_SECONDS = 60;

function sanitizeString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

async function deriveReporterId(request) {
  const clientId = getClientIdentifier(request);
  const userAgent = sanitizeString(request.headers.get('User-Agent') || '', 200);
  const fingerprintSource = `${clientId}|${userAgent || 'ua:unknown'}`;

  const fingerprint = await hashClientIdentifier(fingerprintSource, 'share-note-reporter-v1');
  if (fingerprint && fingerprint !== 'anonymous') {
    return `anon-${fingerprint}`.slice(0, 80);
  }

  return `anon-${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
}

async function computeRetryAfterSeconds(db, token, reporterId, now, requestId) {
  try {
    const windowStart = now - REPORT_RATE_LIMIT_WINDOW_SECONDS;
    const row = await db.prepare(`
      SELECT MIN(created_at) AS oldest_created_at
      FROM share_note_reports
      WHERE token = ? AND reporter_id = ? AND created_at >= ?
    `).bind(token, reporterId, windowStart).first();

    const oldestCreatedAt = Number(row?.oldest_created_at);
    if (!Number.isFinite(oldestCreatedAt) || oldestCreatedAt <= 0) {
      return REPORT_RATE_LIMIT_WINDOW_SECONDS;
    }

    return Math.max(1, REPORT_RATE_LIMIT_WINDOW_SECONDS - (now - oldestCreatedAt));
  } catch (error) {
    console.warn(`[${requestId}] share-note report retry-after lookup failed:`, error?.message || error);
    return REPORT_RATE_LIMIT_WINDOW_SECONDS;
  }
}

export async function onRequestPost(context) {
  const { env, params, request } = context;
  const requestId = crypto.randomUUID();
  try {
    const share = await loadShareRecord(env, params.token);
    if (!share) {
      return jsonResponse({ error: 'Share link not found' }, 404);
    }
    if (share.expiresAt && share.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonResponse({ error: 'Share link expired' }, 410);
    }

    const payload = await request.json().catch(() => ({}));
    const noteId = sanitizeString(payload.noteId, 80);
    if (!noteId) {
      return jsonResponse({ error: 'Note id is required' }, 400);
    }

    const reason = sanitizeString(payload.reason, 40).toLowerCase();
    if (!ALLOWED_REASONS.has(reason)) {
      return jsonResponse({ error: 'Invalid report reason' }, 400);
    }

    const details = sanitizeString(payload.details, 600);
    if (reason === 'other' && !details) {
      return jsonResponse({ error: 'Please include details for other reports' }, 400);
    }

    const reporterId = await deriveReporterId(request);

    const noteRow = await env.DB.prepare(`
      SELECT id FROM share_notes
      WHERE id = ? AND token = ?
    `).bind(noteId, params.token).first();

    if (!noteRow) {
      return jsonResponse({ error: 'Note not found' }, 404);
    }

    const existing = await env.DB.prepare(`
      SELECT id FROM share_note_reports
      WHERE note_id = ? AND reporter_id = ?
    `).bind(noteId, reporterId).first();

    if (existing) {
      return jsonResponse({ status: 'already_reported' }, 200);
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - REPORT_RATE_LIMIT_WINDOW_SECONDS;
    const userAgent = sanitizeString(request.headers.get('User-Agent') || '', 200) || null;

    try {
      const insertResult = await env.DB.prepare(`
        INSERT INTO share_note_reports
          (id, note_id, token, reporter_id, reason, details, user_agent, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        WHERE (
          SELECT COUNT(1) FROM share_note_reports
          WHERE token = ? AND reporter_id = ? AND created_at >= ?
        ) < ?
      `).bind(
        id,
        noteId,
        params.token,
        reporterId,
        reason,
        details || null,
        userAgent,
        now,
        params.token,
        reporterId,
        windowStart,
        REPORT_RATE_LIMIT_MAX
      ).run();

      const inserted = Number(insertResult?.meta?.changes || 0) > 0;
      if (!inserted) {
        const retryAfter = await computeRetryAfterSeconds(env.DB, params.token, reporterId, now, requestId);
        return jsonResponse(
          {
            error: 'Too many reports submitted. Please wait before trying again.',
            retryAfter
          },
          429,
          { 'Retry-After': String(retryAfter) }
        );
      }
    } catch (insertError) {
      if (/unique constraint/i.test(insertError?.message || '')) {
        return jsonResponse({ status: 'already_reported' }, 200);
      }
      throw insertError;
    }

    return jsonResponse({ status: 'reported' }, 201);
  } catch (error) {
    console.error('POST /api/share-notes/:token/report error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
