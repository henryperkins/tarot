import { CATALOG_VERSION, ConfigError, FEATURE_IDS, checkFields, configEnabled, configEnvironment, getFeature, normalizePolicy, publicTextRestriction, specialistInventory } from '../../lib/aiConfigCatalog.js';
import { describeFeature, listHistory, savePolicy } from '../../lib/aiConfigStore.js';
import { sha256Hex, timingSafeEqual } from '../../lib/crypto.js';
import { describeReleaseReading } from '../../lib/aiConfigRelease.js';
import { listManagedConnections, resolveProviderEnvironment, saveConnection } from '../../lib/providerConnections.js';
import { fetchCodexSubscriptionModels } from '../../lib/codexSubscriptionModels.js';
import { describePersonalReadingSelection, PERSONAL_MODEL_FIELDS, savePersonalReadingModel } from '../../lib/personalReadingModel.js';
import { isLocalAdminOrigin, isLocalAdminSession } from './local-access.js';

const prefix = '/api/admin/ai-configuration';
const headers = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers });

function identifier(value, field) {
  if (typeof value !== 'string' || !/^[\w-]{1,80}$/.test(value)) {
    throw new ConfigError(422, 'invalid_identifier', 'Invalid request identifier.', field);
  }
  return value;
}

async function input(request, fields) {
  if (Number(request.headers.get('Content-Length')) > 16384) throw new ConfigError(413, 'too_large', 'Configuration payload is too large.');
  const text = await request.text();
  if (text.length > 16384) throw new ConfigError(413, 'too_large', 'Configuration payload is too large.');
  let body;
  try { body = JSON.parse(text); } catch { throw new ConfigError(400, 'invalid_json', 'Expected a JSON object.'); }
  checkFields(body, fields);
  return body;
}

function hasSampleStorage(env) {
  return typeof env.ADMIN_AI_SAMPLES?.idFromName === 'function' && typeof env.ADMIN_AI_SAMPLES?.get === 'function';
}

function sampleJobs(env) {
  if (!hasSampleStorage(env)) throw new ConfigError(503, 'samples_unavailable', 'Admin sample storage is unavailable.');
  return env.ADMIN_AI_SAMPLES.get(env.ADMIN_AI_SAMPLES.idFromName(configEnvironment(env)));
}

async function adminConfig({ request, env, params }) {
  try {
    const { id, runId, providerId } = params;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const sharedAccess = env.ADMIN_API_KEY && timingSafeEqual(request.headers.get('Authorization'), 'Bearer ' + env.ADMIN_API_KEY);
    if (!sharedAccess) {
      if (!env.ADMIN_API_KEY && !isLocalAdminOrigin(request, env)) return json({ error: 'Admin authentication is not configured.', code: 'admin_unavailable' }, 503);
      if (path === prefix + '/release-settings' || !await isLocalAdminSession(request, env)) return json({ error: 'Unauthorized', code: 'unauthorized' }, 401);
    }
    if (path === prefix + '/connections/codex-subscription/models') {
      if (!['preview', 'production'].includes(configEnvironment(env))) {
        throw new ConfigError(403, 'hosted_only', 'Use the linked reader’s owner subscription to fetch models on the local Worker.');
      }
      if (request.method === 'PUT') return json(await savePersonalReadingModel(env, await input(request, PERSONAL_MODEL_FIELDS), request.signal));
      const [catalog, preference] = await Promise.all([fetchCodexSubscriptionModels(env, request.signal), describePersonalReadingSelection(env)]);
      return json({ ...catalog, ...preference });
    }
    if (providerId && request.method === 'PUT') {
      const body = await input(request, ['action', 'baseRevision', 'values']);
      return json({ connection: await saveConnection(env, providerId, body) });
    }
    if (path === prefix + '/connections' && request.method === 'GET') return json({ connections: await listManagedConnections(env) });
    if (path === prefix + '/history' && request.method === 'GET') return json(await listHistory(env, url.searchParams.get('feature'), url.searchParams.get('cursor')));
    if (runId && request.method === 'GET') {
      getFeature(env, id);
      return await sampleJobs(env).fetch('https://admin-samples.internal/' + id + '/' + identifier(runId, 'runId'));
    }
    env = await resolveProviderEnvironment(env);
    if (id) getFeature(env, id);
    if (request.method === 'GET') {
      if (path === prefix + '/release-settings') {
        if (configEnvironment(env) !== 'production') throw new ConfigError(403, 'wrong_environment', 'Release settings are served by production.');
        const readings = await describeFeature(env, 'readings');
        const primary = readings.providers.find(adapter => adapter.id === readings.policy.primary.providerId);
        const restriction = publicTextRestriction(env);
        if (restriction) throw new ConfigError(503, 'primary_unavailable', restriction);
        if (!primary?.configured || readings.policyStatus !== 'ready') {
          throw new ConfigError(503, 'primary_unavailable', 'The configured public reading primary is unavailable for qualification.');
        }
        return json(await describeReleaseReading(env, readings));
      }
      return json({
        environment: configEnvironment(env), writable: configEnabled(env), catalogVersion: CATALOG_VERSION,
        features: await Promise.all(FEATURE_IDS.map(async key => {
          const feature = await describeFeature(env, key);
          const sampleUnavailableReason = feature.readOnlyReason || (!hasSampleStorage(env) && 'Configure admin sample storage for this deployment to run a sample.');
          return { ...feature, sampleAvailable: !sampleUnavailableReason, ...(sampleUnavailableReason && { sampleUnavailableReason }) };
        })), specialistInventory: specialistInventory(env)
      });
    }
    if (request.method === 'PUT') {
      const body = await input(request, ['baseRevision', 'baseToken', 'mutationId', 'policy']);
      identifier(body.mutationId, 'mutationId');
      const actor = sharedAccess ? 'Shared admin credential' : 'Local password session';
      return json(await savePolicy(env, id, body, actor));
    }
    const body = await input(request, ['catalogVersion', 'runId', 'policy']);
    identifier(body.runId, 'runId');
    const feature = await describeFeature(env, id);
    if (!feature.writable) throw new ConfigError(403, 'read_only', feature.readOnlyReason);
    if (body.catalogVersion !== CATALOG_VERSION) throw new ConfigError(409, 'stale_catalog', 'Reload the current model catalog.');
    const policy = normalizePolicy(feature, body.policy);
    const fingerprint = await sha256Hex(JSON.stringify(policy));
    const result = await sampleJobs(env).fetch('https://admin-samples.internal/' + id + '/' + body.runId, {
      method: 'POST',
      body: JSON.stringify({ featureId: id, environment: configEnvironment(env), runId: body.runId,
        fixtureVersion: feature.fixtureVersion, policyFingerprint: fingerprint, policy })
    });
    if (!result.ok) return result;
    return json({ runId: body.runId, pollUrl: prefix + '/features/' + id + '/samples/' + body.runId }, 202);
  } catch (err) {
    if (err instanceof ConfigError) return json({ code: err.code, error: err.message, field: err.field }, err.status);
    return json({ code: 'configuration_unavailable', error: 'Configuration storage is unavailable. Check the deployment bindings and database migration.' }, 503);
  }
}

export const overview = { onRequestGet: adminConfig };
export const connection = { onRequestPut: adminConfig };
export const subscriptionModels = { onRequestGet: adminConfig, onRequestPut: adminConfig };
export const assignment = { onRequestPut: adminConfig };
export const samples = { onRequestPost: adminConfig };
export const receipt = { onRequestGet: adminConfig };
