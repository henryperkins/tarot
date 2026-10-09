/**
 * Visual job helpers for ReadingVisualJob Durable Object.
 */

const DO_ORIGIN = 'https://reading-visual-jobs';

export function getVisualJobStub(env, readingResultId) {
  if (!env?.READING_VISUAL_JOBS || !readingResultId) return null;
  return env.READING_VISUAL_JOBS.get(env.READING_VISUAL_JOBS.idFromName(readingResultId));
}

export async function initVisualJob({
  env,
  binding,
  visualToken,
  ownerUserId = null,
  validationContext = {}
}) {
  const stub = getVisualJobStub(env, binding?.readingResultId);
  if (!stub) return { ok: false, status: 503, error: 'Reading visual jobs not configured.' };

  const response = await stub.fetch(`${DO_ORIGIN}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binding,
      visualToken,
      ownerUserId,
      validationContext
    })
  });

  if (!response.ok) {
    let data = null;
    try { data = await response.json(); } catch { /* Non-JSON errors retain the generic transport message. */ }
    return { ok: false, status: response.status, error: data?.error || 'Failed to initialize visual job.' };
  }

  return { ok: true };
}

export async function getVisualJobSnapshot({
  env,
  readingResultId,
  visualToken = null,
  userId = null
}) {
  const stub = getVisualJobStub(env, readingResultId);
  if (!stub) return { ok: false, status: 503, error: 'Reading visual jobs not configured.' };

  const headers = new Headers();
  if (visualToken) headers.set('X-Visual-Token', visualToken);
  if (userId) headers.set('X-User-Id', userId);

  const response = await stub.fetch(`${DO_ORIGIN}/snapshot`, { headers });
  let data = null;
  try { data = await response.json(); } catch { /* Non-JSON errors retain the generic transport message. */ }

  if (!response.ok) {
    return { ok: false, status: response.status, error: data?.error || 'Failed to get snapshot.' };
  }

  return { ok: true, data };
}

export async function cancelVisualJob({
  env,
  readingResultId,
  visualToken = null,
  userId = null
}) {
  const stub = getVisualJobStub(env, readingResultId);
  if (!stub) return { ok: false, status: 503, error: 'Reading visual jobs not configured.' };

  const headers = new Headers();
  if (visualToken) headers.set('X-Visual-Token', visualToken);
  if (userId) headers.set('X-User-Id', userId);

  const response = await stub.fetch(`${DO_ORIGIN}/cancel`, {
    method: 'POST',
    headers
  });

  let data = null;
  try { data = await response.json(); } catch { /* Non-JSON errors retain the generic transport message. */ }

  if (!response.ok) {
    return { ok: false, status: response.status, error: data?.error || 'Failed to cancel visual job.' };
  }

  return { ok: true, data };
}
