import { getUserFromRequest } from '../lib/auth.js';
import { loadActiveVisualReplay } from '../lib/readingVisualRetry.js';
import { getVisualJobStub } from '../lib/readingVisualJobs.js';
import { jsonResponse } from '../lib/utils.js';

async function transport({ env, request, params }, cancel = false) {
  if (!env?.DB || !env.READING_VISUAL_JOBS) return jsonResponse({ error: 'Visual replay is unavailable.' }, { status: 503 });
  const url = new URL(request.url);
  const token = request.headers.get('X-Visual-Token') || request.headers.get('X-Job-Token') || url.searchParams.get('token');
  let user = null;
  try { user = await getUserFromRequest(request, env); } catch { /* Private capability is independently authenticated below. */ }
  if (!token && !user?.id) return jsonResponse({ error: 'Authentication required.' }, { status: 401 });
  const claim = await env.DB.prepare('SELECT * FROM visual_retry_claims WHERE visual_job_id = ?').bind(params?.visualJobId || '').first();
  if (!claim || !((user?.id && user.id === claim.user_id) || (token && token === claim.visual_token))) {
    return jsonResponse({ error: 'Visual replay is unavailable.' }, { status: 403 });
  }
  const active = await loadActiveVisualReplay({ db: env.DB, claimId: claim.id, attemptId: claim.attempt_id, expectedClaimVersion: claim.state_version });
  if (!active) return jsonResponse({ error: 'Visual replay is no longer available.' }, { status: 410 });
  const headers = new Headers();
  if (token) headers.set('X-Visual-Token', token);
  if (user?.id) headers.set('X-User-Id', user.id);
  const stream = url.pathname.endsWith('/stream');
  const cursor = url.searchParams.get('cursor');
  const target = cancel ? '/cancel' : stream ? `/stream${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}` : '/snapshot';
  return getVisualJobStub(env, claim.reading_result_id, claim.visual_job_id).fetch(`https://reading-visual-jobs${target}`, { method: cancel ? 'POST' : 'GET', headers });
}
export const onRequestGet = context => transport(context);
export const onRequestPost = context => new URL(context.request.url).pathname.endsWith('/cancel')
  ? transport(context, true) : jsonResponse({ error: 'Not found.' }, { status: 404 });
