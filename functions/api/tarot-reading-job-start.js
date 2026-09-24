import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { startReadingJob } from '../lib/readingJobs.js';

/**
 * POST /api/tarot-reading/jobs
 * Starts a reading job for the app. The job authenticates with the caller's
 * forwarded credentials; a principal can never be supplied through this
 * route (see functions/lib/readingJobs.js).
 */
export const onRequestPost = async ({ request, env }) => {
  if (!env?.READING_JOBS) {
    return jsonResponse({ error: 'Reading jobs not configured.' }, { status: 503 });
  }

  let payload = null;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    return jsonResponse({ error: error?.message || 'Invalid JSON payload.' }, { status: 400 });
  }

  const result = await startReadingJob({
    env,
    payload,
    forwardHeaders: {
      authorization: request.headers.get('Authorization'),
      cookie: request.headers.get('Cookie')
    }
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: result.status });
  }
  return jsonResponse({ jobId: result.jobId, jobToken: result.jobToken });
};
