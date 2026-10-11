/**
 * Reading-job helpers shared by POST /api/tarot-reading/jobs (the app) and
 * the ChatGPT MCP tools.
 *
 * MCP jobs carry an in-Worker principal and a request snapshot. The
 * ReadingJob Durable Object serves them only on its MCP paths
 * (/mcp/snapshot, /mcp/cancel), and only to that principal; never on the
 * public status, stream and cancel routes (spec §7.4). The MCP paths need
 * just the jobId, so the job token stays a server-side verifier: it guards
 * /start and the public routes, which never serve principal jobs.
 */

import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';
import { normalizeVisualSource, fingerprintVisualSource } from '../../shared/reading/visualSourceIdentity.js';
import { getVectorGestureDetails } from '../../src/data/cardGestureArtwork.js';
import { initVisualJob } from './readingVisualJobs.js';
import { registerVisualResult } from './readingVisualResults.js';
import { getVisualCueReadiness } from './visualCueProvider.js';
import { getVisualInitialReadiness, prepareVisualInitialAdmission } from './readingVisualAdmission.js';
import { hasWebVisualCapability } from './readingVisualWebAdmission.js';

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
 * @param {object|null} [params.visualCapability] - Opaque paid-web capability minted after route authentication
 * @param {{ authorization?: string|null, cookie?: string|null }|null} [params.forwardHeaders]
 *   Request credentials, for app jobs only; ignored when a principal is given
 */
export async function startReadingJob({ env, payload, principal = null, snapshot = null, forwardHeaders = null, ownerUserId = null, request = null, visualCapability = null, waitUntil }) {
  if (!env?.READING_JOBS) {
    return { ok: false, status: 503, error: 'Reading jobs not configured.' };
  }

  const schemaResult = safeParseReadingRequest(payload);
  if (!schemaResult.success) {
    return { ok: false, status: 400, error: schemaResult.error || 'Invalid reading request payload.' };
  }

  const jobId = crypto.randomUUID();
  const jobToken = crypto.randomUUID();
  const readingResultId = crypto.randomUUID();
  let visualJobToken = null;
  let visualBinding = null;
  let visualInit = null;
  if (hasWebVisualCapability({ env, capability: visualCapability, userId: ownerUserId, principal })
    && env.READING_VISUAL_JOBS && getVisualCueReadiness(env).ready && getVisualInitialReadiness(env).ready) {
    visualJobToken = crypto.randomUUID();
    const normalized = normalizeVisualSource(schemaResult.data);
    const { spreadHash, contextHash } = await fingerprintVisualSource(schemaResult.data);
    visualBinding = {
      readingResultId, sourceRevision: 0, spreadHash, contextHash,
      artworkEdition: normalized.artworkEdition, catalogVersion: normalized.catalogVersion
    };
    visualInit = {
      binding: visualBinding,
      visualToken: visualJobToken,
      ownerUserId: principal?.userId || ownerUserId || null,
      validationContext: {
        ...normalized,
        cards: normalized.cards.map(card => ({
          ...card,
          detailIds: normalized.artworkEdition === 'rws-immanuelle-vector'
            ? getVectorGestureDetails(card.canonicalName).map(detail => detail.id) : []
        }))
      }
    };
    try {
      const context = await prepareVisualInitialAdmission({ env, userId: visualInit.ownerUserId, request });
      if (!context) throw new Error('Initial visual attribution unavailable');
      visualInit.initialAdmission = context;
    } catch {
      // Rejected attribution/storage/budget configuration affects visuals only.
      visualInit = null;
      visualBinding = null;
    }
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Job-Token': jobToken
  });
  if (!principal) {
    if (forwardHeaders?.authorization) headers.set('Authorization', forwardHeaders.authorization);
    if (forwardHeaders?.cookie) headers.set('Cookie', forwardHeaders.cookie);
  }

  const body = {
    payload: schemaResult.data,
    jobId,
    readingResultId,
    visualBinding,
    visualJobToken: visualInit ? visualJobToken : null,
    visualInit
  };
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
  // Register application-owned identity independently of the optional visual
  // endpoint. Saving immediately can link this pending result even if /init is
  // unavailable; narrative execution has already started above.
  if (visualInit && env.DB) {
    try {
      const registered = await registerVisualResult({
        db: env.DB, userId: visualInit.ownerUserId, readingResultId,
        binding: visualBinding
      });
      if (!registered.ok) throw new Error('Visual result registration rejected');
    } catch {
      // Storage failure disables accompaniment without failing delivered prose.
      visualInit = null;
      visualBinding = null;
    }
  }
  // Initialization is optional background work. The narrative DO also receives
  // the descriptor so every delivered observation can initialize idempotently.
  if (visualInit && waitUntil) {
    waitUntil(initVisualJob({ env, ...visualInit }).catch(() => undefined));
  }
  return { ok: true, jobId, jobToken, readingResultId, visualBinding, visualJobToken: visualInit ? visualJobToken : null };
}

async function callMcpPath(path, { env, jobId, userId, method = 'GET' }) {
  if (!env?.READING_JOBS) {
    return { ok: false, status: 503, error: 'Reading jobs not configured.' };
  }
  if (!jobId || !userId) {
    return { ok: false, status: 404, error: 'Reading job not found.' };
  }
  const response = await jobStub(env, jobId).fetch(`${DO_ORIGIN}${path}`, {
    method,
    headers: { 'X-Principal-User-Id': String(userId) }
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, status: response.status, error: data?.error || 'Reading job unavailable.' };
  }
  return { ok: true, data };
}

/** Snapshot, result and themes of a principal job owned by `userId`. */
export function getMcpJobSnapshot({ env, jobId, userId }) {
  return callMcpPath('/mcp/snapshot', { env, jobId, userId });
}

/** Cancel a principal job owned by `userId`; a finished job is left intact. */
export function cancelMcpJob({ env, jobId, userId }) {
  return callMcpPath('/mcp/cancel', { env, jobId, userId, method: 'POST' });
}
