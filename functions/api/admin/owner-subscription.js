import { checkFields, ConfigError } from '../../lib/aiConfigCatalog.js';
import { validateSession, getSessionFromCookie } from '../../lib/auth.js';
import { timingSafeEqual } from '../../lib/crypto.js';
import { readFeatureJsonBody } from '../../lib/featureUsage.js';
import { assertOwner, assertRevision, changeOwnerLink, describeOwnerLink, linkedGatewayEnv, ownerLinkDatabase, ownerRestriction, readOwnerLink } from '../../lib/ownerSubscription.js';
import { isLocalAdminOrigin, isLocalAdminSession } from './local-access.js';
import { fetchCodexSubscriptionModels } from '../../lib/codexSubscriptionModels.js';
import { describePersonalReadingSelection, PERSONAL_MODEL_FIELDS, savePersonalReadingModel } from '../../lib/personalReadingModel.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const runPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

async function body(request, fields) {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    throw new ConfigError(403, 'origin_required', 'Use the local Worker dashboard for owner subscription settings.');
  }
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new ConfigError(415, 'invalid_content', 'Expected a JSON request.');
  let data;
  try {
    data = await readFeatureJsonBody(request, 2048);
  } catch (error) {
    if (error.status === 413) throw new ConfigError(413, 'too_large', 'Request is too large.');
    throw new ConfigError(400, 'invalid_json', 'Expected valid JSON.');
  }
  checkFields(data, fields);
  return data;
}

function checkRunId(value) {
  if (typeof value !== 'string' || !runPattern.test(value)) throw new ConfigError(422, 'invalid_run_id', 'Expected a sample run ID.');
  return value;
}

function jobs(env) {
  const ns = env.OWNER_SUBSCRIPTION_SAMPLES;
  if (!ns?.idFromName || !ns?.get) throw new ConfigError(503, 'samples_unavailable', 'Owner sample storage is unavailable.');
  return ns.get(ns.idFromName('local'));
}

async function handle({ request, env, params = {} }, action) {
  try {
    if (!isLocalAdminOrigin(request, env)) return json({ code: 'local_only', error: 'Owner subscription setup is available on the local Worker.' }, 403);
    const key = env.ADMIN_API_KEY;
    if (!(key && timingSafeEqual(request.headers.get('Authorization'), 'Bearer ' + key)) && !await isLocalAdminSession(request, env)) {
      return json({ code: 'unauthorized', error: 'Admin authentication required.' }, 401);
    }
    const db = ownerLinkDatabase(env);
    const cookies = request.headers.get('Cookie') || '';
    const token = cookies.split(';').filter(cookie => cookie.trim().startsWith('session=')).length === 1 && getSessionFromCookie(cookies);
    const reader = typeof token === 'string' && token.length <= 256 && await validateSession(db, token);
    if (!reader?.sessionId || ['service', 'api_key'].includes(reader.auth_provider)) {
      return json({ code: 'reader_sign_in_required', error: 'Sign in to your Tableu reader account in this browser.' }, 403);
    }
    if (action === 'status') return json(await describeOwnerLink(env, reader, await readOwnerLink(db)));
    const restriction = ownerRestriction(env);
    if (restriction) throw new ConfigError(403, 'read_only', restriction);
    if (action === 'change') {
      const row = await changeOwnerLink(db, reader, await body(request, ['baseRevision', 'providerId']));
      return json(await describeOwnerLink(env, reader, row));
    }

    const row = await readOwnerLink(db);
    assertOwner(row, reader.id);
    if (action === 'models') {
      if (row.provider_id !== 'codex-subscription') {
        throw new ConfigError(409, 'subscription_provider_changed', 'Link the ChatGPT subscription to fetch its models.');
      }
      let gateway;
      try { gateway = await linkedGatewayEnv(env, row); } catch {
        throw new ConfigError(503, 'owner_gateway_unavailable', 'The local ChatGPT subscription gateway is unavailable. Start the Tableu dev server.');
      }
      if (request.method === 'PUT') return json(await savePersonalReadingModel(gateway, await body(request, PERSONAL_MODEL_FIELDS), request.signal));
      const [catalog, preference] = await Promise.all([fetchCodexSubscriptionModels(gateway, request.signal), describePersonalReadingSelection(gateway)]);
      const current = await readOwnerLink(db);
      assertOwner(current, reader.id);
      assertRevision(current, row.revision);
      return json({ ...catalog, ...preference });
    }
    if (action === 'sample') {
      const data = await body(request, ['baseRevision', 'runId']);
      assertRevision(row, data.baseRevision);
      const runId = checkRunId(data.runId);
      return await jobs(env).fetch('https://owner-samples.internal/' + runId, { method: 'POST',
        body: JSON.stringify({ ownerId: reader.id, revision: row.revision, providerId: row.provider_id }) });
    }
    const runId = checkRunId(params.runId);
    return await jobs(env).fetch('https://owner-samples.internal/' + runId, {
      headers: { 'X-Owner-Revision': String(row.revision), 'X-Owner-Id': reader.id }
    });
  } catch (error) {
    if (error instanceof ConfigError) return json({ code: error.code, error: error.message }, error.status);
    return json({ code: 'owner_storage_unavailable', error: 'Owner subscription settings are unavailable.' }, 503);
  }
}

export const ownerSubscription = { onRequestGet: ctx => handle(ctx, 'status'), onRequestPut: ctx => handle(ctx, 'change') };
export const ownerModels = { onRequestGet: ctx => handle(ctx, 'models'), onRequestPut: ctx => handle(ctx, 'models') };
export const ownerSample = { onRequestPost: ctx => handle(ctx, 'sample') };
export const ownerReceipt = { onRequestGet: ctx => handle(ctx, 'receipt') };
