/**
 * Reading-job retention (maintenance)
 *
 * POST /api/admin/reading-jobs/retention
 *
 * Jobs stored before deletion alarms existed are never reached again, so
 * they outlive their retention. Each job named here deletes itself if its
 * time has passed, and otherwise schedules its deletion alarm.
 *
 * Inert (404) unless the READING_JOB_PURGE_TOKEN secret is set. Set it only
 * while running scripts/purge-expired-reading-jobs.mjs, then delete it.
 *
 * Body: { ids: string[] } with 1–100 Durable Object ids (64 hex characters).
 * Response: { purged, scheduled, failed }. Job contents are never returned.
 */

import { timingSafeEqual } from '../../lib/crypto.js';
import { jsonResponse } from '../../lib/utils.js';

export const MAX_IDS_PER_REQUEST = 100;
const OBJECT_ID = /^[0-9a-f]{64}$/;
const CONCURRENCY = 10;

async function enforceRetention(namespace, id) {
  try {
    const stub = namespace.get(namespace.idFromString(id));
    const response = await stub.fetch('https://reading-jobs/retention', { method: 'POST' });
    const data = await response.json().catch(() => null);
    return response.ok && (data?.status === 'purged' || data?.status === 'scheduled') ? data.status : 'failed';
  } catch {
    return 'failed';
  }
}

export async function onRequestPost({ request, env }) {
  const token = env.READING_JOB_PURGE_TOKEN;
  if (!token || !env.READING_JOBS) {
    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }
  if (!timingSafeEqual(request.headers.get('Authorization') || '', `Bearer ${token}`)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ids = body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > MAX_IDS_PER_REQUEST ||
    !ids.every((id) => typeof id === 'string' && OBJECT_ID.test(id))
  ) {
    return jsonResponse({ error: `ids must be 1–${MAX_IDS_PER_REQUEST} Durable Object ids` }, { status: 400 });
  }

  const counts = { purged: 0, scheduled: 0, failed: 0 };
  for (let start = 0; start < ids.length; start += CONCURRENCY) {
    const outcomes = await Promise.all(
      ids.slice(start, start + CONCURRENCY).map((id) => enforceRetention(env.READING_JOBS, id))
    );
    for (const outcome of outcomes) counts[outcome] += 1;
  }
  return jsonResponse(counts);
}
