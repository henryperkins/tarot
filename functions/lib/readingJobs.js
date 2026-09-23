/**
 * Reading-job helpers shared by POST /api/tarot-reading/jobs (the app) and
 * the ChatGPT MCP tools.
 *
 * MCP jobs carry an in-Worker principal and a request snapshot. The
 * ReadingJob Durable Object serves them only on its MCP paths
 * (/mcp/snapshot, /mcp/cancel), never on the public status, stream and
 * cancel routes (spec §7.4). A job token that surfaces in a ChatGPT
 * conversation therefore grants nothing outside /mcp.
 */

import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';

const DO_ORIGIN = 'https://reading-jobs';

function jobStub(env, jobId) {
  return env.READING_JOBS.get(env.READING_JOBS.idFromName(jobId));
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Validate a reading payload and start a job for it.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.READING_JOBS is required
 * @param {object} params.payload - Reading request (readingRequestSchema)
 * @param {{ userId: string }|null} [params.principal] - In-Worker callers only
 * @param {object|null} [params.snapshot] - Stored with principal jobs, for saving later
 * @param {{ authorization?: string|null, cookie?: string|null }|null} [params.forwardHeaders]
 *   Request credentials, for app jobs only; ignored when a principal is given
 */
export async function startReadingJob({ env, payload, principal = null, snapshot = null, forwardHeaders = null }) {
  if (!env?.READING_JOBS) {
    return { ok: false, status: 503, error: 'Reading jobs not configured.' };
  }

  const schemaResult = safeParseReadingRequest(payload);
  if (!schemaResult.success) {
    return { ok: false, status: 400, error: schemaResult.error || 'Invalid reading request payload.' };
  }

  const jobId = crypto.randomUUID();
  const jobToken = crypto.randomUUID();
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Job-Token': jobToken
  });
  if (!principal) {
    if (forwardHeaders?.authorization) headers.set('Authorization', forwardHeaders.authorization);
    if (forwardHeaders?.cookie) headers.set('Cookie', forwardHeaders.cookie);
  }

  const body = { payload: schemaResult.data, jobId };
  if (principal?.userId) {
    body.principal = { userId: String(principal.userId) };
    body.snapshot = snapshot ?? null;
  }

  const response = await jobStub(env, jobId).fetch(`${DO_ORIGIN}/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await readJson(response);
    return { ok: false, status: response.status, error: data?.error || 'Unable to start reading.' };
  }
  return { ok: true, jobId, jobToken };
}

async function callMcpPath(path, { env, jobId, jobToken, userId, method = 'GET' }) {
  if (!env?.READING_JOBS) {
    return { ok: false, status: 503, error: 'Reading jobs not configured.' };
  }
  if (!jobId || !jobToken || !userId) {
    return { ok: false, status: 404, error: 'Reading job not found.' };
  }
  const response = await jobStub(env, jobId).fetch(`${DO_ORIGIN}${path}`, {
    method,
    headers: { 'X-Job-Token': jobToken, 'X-Principal-User-Id': String(userId) }
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, status: response.status, error: data?.error || 'Reading job unavailable.' };
  }
  return { ok: true, data };
}

/** Snapshot, result and themes of a principal job owned by `userId`. */
export function getMcpJobSnapshot({ env, jobId, jobToken, userId }) {
  return callMcpPath('/mcp/snapshot', { env, jobId, jobToken, userId });
}

/** Cancel a principal job owned by `userId`; a finished job is left intact. */
export function cancelMcpJob({ env, jobId, jobToken, userId }) {
  return callMcpPath('/mcp/cancel', { env, jobId, jobToken, userId, method: 'POST' });
}
