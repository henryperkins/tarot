import { getUserFromRequest } from '../lib/auth.js';
import { jsonResponse } from '../lib/utils.js';

const DO_ORIGIN = 'https://reading-visual-jobs';

function getVisualToken(request) {
  const url = new URL(request.url);
  return request.headers.get('X-Visual-Token')
    || request.headers.get('X-Job-Token')
    || url.searchParams.get('token')
    || '';
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env?.READING_VISUAL_JOBS) {
    return jsonResponse({ error: 'Reading visual jobs not configured.' }, { status: 503 });
  }

  const readingResultId = params?.readingResultId || params?.id;
  if (!readingResultId) {
    return jsonResponse({ error: 'Missing readingResultId.' }, { status: 400 });
  }

  const token = getVisualToken(request);
  let user = null;
  try {
    user = await getUserFromRequest(request, env);
  } catch { /* A valid private capability may authenticate without a session. */ }

  if (!token && !user?.id) {
    return jsonResponse({ error: 'Authentication required. Result IDs alone are not credentials.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const isStream = url.pathname.endsWith('/stream');
  const cursor = url.searchParams.get('cursor');

  const headers = new Headers();
  if (token) headers.set('X-Visual-Token', token);
  if (user?.id) headers.set('X-User-Id', String(user.id));
  if (isStream) headers.set('Accept', 'text/event-stream');

  const stub = env.READING_VISUAL_JOBS.get(env.READING_VISUAL_JOBS.idFromName(readingResultId));
  const targetPath = isStream
    ? `${DO_ORIGIN}/stream${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
    : `${DO_ORIGIN}/snapshot`;

  const response = await stub.fetch(targetPath, { headers });
  if (isStream) {
    return response;
  }

  let data = null;
  try { data = await response.json(); } catch { /* Preserve the upstream status for non-JSON failures. */ }
  return jsonResponse(data || { error: 'Unavailable' }, { status: response.status });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  if (!env?.READING_VISUAL_JOBS) {
    return jsonResponse({ error: 'Reading visual jobs not configured.' }, { status: 503 });
  }

  const readingResultId = params?.readingResultId || params?.id;
  if (!readingResultId) {
    return jsonResponse({ error: 'Missing readingResultId.' }, { status: 400 });
  }

  const token = getVisualToken(request);
  let user = null;
  try {
    user = await getUserFromRequest(request, env);
  } catch { /* A valid private capability may authenticate without a session. */ }

  if (!token && !user?.id) {
    return jsonResponse({ error: 'Authentication required.' }, { status: 401 });
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('X-Visual-Token', token);
  if (user?.id) headers.set('X-User-Id', String(user.id));

  const stub = env.READING_VISUAL_JOBS.get(env.READING_VISUAL_JOBS.idFromName(readingResultId));
  const response = await stub.fetch(`${DO_ORIGIN}/cancel`, { method: 'POST', headers });

  let data = null;
  try { data = await response.json(); } catch { /* Preserve the upstream status for non-JSON failures. */ }
  return jsonResponse(data || { status: 'cancelled' }, { status: response.status });
}
