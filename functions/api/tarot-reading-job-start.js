import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';

function generateId(prefix) {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

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

  const schemaResult = safeParseReadingRequest(payload);
  if (!schemaResult.success) {
    return jsonResponse(
      { error: schemaResult.error || 'Invalid reading request payload.' },
      { status: 400 }
    );
  }

  const jobId = generateId('job');
  const jobToken = generateId('token');
  const stub = env.READING_JOBS.get(env.READING_JOBS.idFromName(jobId));

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Job-Token': jobToken
  });
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }
  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }

  const startResponse = await stub.fetch('https://reading-jobs/start', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      payload: schemaResult.data,
      jobId
    })
  });

  if (!startResponse.ok) {
    let errorPayload = null;
    try {
      errorPayload = await startResponse.json();
    } catch {
      errorPayload = null;
    }
    const message = errorPayload?.error || 'Unable to start reading.';
    return jsonResponse({ error: message }, { status: startResponse.status });
  }

  return jsonResponse({
    jobId,
    jobToken
  });
};
