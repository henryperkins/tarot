import { jsonResponse } from '../lib/utils.js';

export const onRequestGet = async ({ request, env, params }) => {
  if (!env?.READING_JOBS) {
    return jsonResponse({ error: 'Reading jobs not configured.' }, { status: 503 });
  }

  const jobId = params?.id;
  if (!jobId) {
    return jsonResponse({ error: 'Missing job id.' }, { status: 400 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const token =
    request.headers.get('X-Job-Token') ||
    url.searchParams.get('token') ||
    '';

  const headers = new Headers({
    'Accept': 'text/event-stream'
  });
  if (token) {
    headers.set('X-Job-Token', token);
  }

  const stub = env.READING_JOBS.get(env.READING_JOBS.idFromName(jobId));
  const targetUrl = cursor
    ? `https://reading-jobs/stream?cursor=${encodeURIComponent(cursor)}`
    : 'https://reading-jobs/stream';

  return stub.fetch(targetUrl, { headers });
};
