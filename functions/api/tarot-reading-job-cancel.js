import { jsonResponse } from '../lib/utils.js';

export const onRequestPost = async ({ request, env, params }) => {
  if (!env?.READING_JOBS) {
    return jsonResponse({ error: 'Reading jobs not configured.' }, { status: 503 });
  }

  const jobId = params?.id;
  if (!jobId) {
    return jsonResponse({ error: 'Missing job id.' }, { status: 400 });
  }

  const token =
    request.headers.get('X-Job-Token') ||
    new URL(request.url).searchParams.get('token') ||
    '';

  const headers = new Headers();
  if (token) {
    headers.set('X-Job-Token', token);
  }

  const stub = env.READING_JOBS.get(env.READING_JOBS.idFromName(jobId));
  return stub.fetch('https://reading-jobs/cancel', { method: 'POST', headers });
};
