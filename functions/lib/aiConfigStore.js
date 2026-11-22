import { CATALOG_VERSION, ConfigError, configEnabled, configEnvironment, effortAlias, featureOverridesAllowed, getFeature, normalizePolicy } from './aiConfigCatalog.js';
import { sha256Hex } from './crypto.js';

function database(env) {
  if (!env.DB?.prepare) throw new ConfigError(503, 'storage_unavailable', 'Configuration storage is unavailable.');
  return env.DB.withSession?.('first-primary') || env.DB;
}

async function latest(db, environment, id) {
  return db.prepare('SELECT * FROM ai_feature_config_revisions WHERE environment = ? AND feature_id = ? ORDER BY revision DESC LIMIT 1')
    .bind(environment, id).first();
}

async function activeRow(env, id) {
  if (!configEnabled(env) || !featureOverridesAllowed(env, id)) return null;
  return latest(database(env), configEnvironment(env), id);
}

function inspectSaved(feature, row) {
  const legacy = row.catalog_version === '1';
  const incompatible = () => new ConfigError(503, 'incompatible_revision', 'The saved assignment needs a catalog migration.');
  if (!legacy && row.catalog_version !== CATALOG_VERSION) throw incompatible();
  try {
    const raw = JSON.parse(row.policy_json);
    const retiredModels = [];
    const policy = normalizePolicy(feature, raw, { legacy, retiredModels });
    return { policy, retiredModels, policyStatus: retiredModels.length ? 'repair_required' : 'ready',
      effortAlias: raw.primary.reasoningEffort === undefined ? effortAlias(raw.primary, feature.deploymentEffortAlias?.original, 'deployment')
        : effortAlias(raw.primary, raw.primary.reasoningEffort, 'revision') };
  } catch (error) {
    if (error instanceof ConfigError || error instanceof SyntaxError) throw incompatible();
    throw error;
  }
}

// Feature consumers use null to preserve all legacy call-specific defaults.
export async function resolveFeatureConfig(env, id) {
  const row = await activeRow(env, id);
  if (!row) return null;
  const saved = inspectSaved(getFeature(env, id), row);
  if (saved.retiredModels.length) throw new ConfigError(503, 'retired_model', 'Replace the retired model in this assignment.');
  return { revision: row.revision, policy: saved.policy };
}

function token(env, feature, revision) {
  return sha256Hex(JSON.stringify([configEnvironment(env), CATALOG_VERSION, feature.id, feature.policy, revision]));
}

export async function describeFeature(env, id) {
  const feature = getFeature(env, id);
  const row = await activeRow(env, id);
  const revision = row?.revision || 0;
  const view = { ...feature, revision, baseToken: await token(env, feature, revision), policyStatus: 'ready', retiredModels: [] };
  if (!row) return view;
  try {
    return { ...view, ...inspectSaved(feature, row) };
  } catch (error) {
    if (error.code !== 'incompatible_revision') throw error;
    return { ...view, policyStatus: 'migration_required', writable: false, readOnlyReason: error.message };
  }
}

function diffPolicies(before, after) {
  const diff = [];
  function change(field, a, b) {
    if (a !== b) diff.push({ field, before: a ?? null, after: b ?? null });
  }
  for (const key of ['providerId', 'modelId', 'reasoningEffort']) change('primary.' + key, before.primary[key], after.primary[key]);
  const a = before.fallbacks.map(step => step.providerId);
  const b = after.fallbacks.map(step => step.providerId);
  if (a.join(',') !== b.join(',')) diff.push({ field: 'fallbacks.order', before: a, after: b });
  for (const step of after.fallbacks) {
    const old = [before.primary, ...before.fallbacks].find(item => item.providerId === step.providerId);
    for (const key of ['modelId', 'reasoningEffort']) change('fallbacks.' + step.providerId + '.' + key, old?.[key], step[key]);
  }
  return diff;
}

function orderedProperties(_key, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
}

function receipt(policy, revision, baseToken) {
  return { revision, baseToken, policy, policyStatus: 'ready', retiredModels: [], effortAlias: null };
}

async function replay(row, { baseRevision, baseToken, policy }) {
  // Validate against the exact historically accepted request. Its model or
  // effort may have since retired, and the original digest used its catalog.
  const saved = JSON.parse(row.policy_json);
  const digest = await sha256Hex(JSON.stringify([baseRevision, baseToken, saved]));
  if (row.request_digest !== digest || JSON.stringify(policy, orderedProperties) !== JSON.stringify(saved, orderedProperties)) {
    throw new ConfigError(409, 'mutation_conflict', 'This save identifier was already used for a different change.');
  }
  if (row.catalog_version === '1') return { revision: row.revision, baseToken: row.issued_token, policy: saved };
  return receipt(saved, row.revision, row.issued_token);
}

export async function savePolicy(env, id, body, actor) {
  const feature = getFeature(env, id);
  if (!feature.writable) throw new ConfigError(403, 'read_only', 'This assignment is read-only in this environment.');
  const { baseRevision, baseToken, mutationId } = body;
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0 || !/^[0-9a-f]{64}$/.test(baseToken || '')) {
    throw new ConfigError(422, 'invalid_base', 'Reload the saved revision and try again.');
  }
  const db = database(env);
  const environment = configEnvironment(env);
  const lookup = () => db.prepare('SELECT * FROM ai_feature_config_revisions WHERE environment = ? AND feature_id = ? AND mutation_id = ?')
    .bind(environment, id, mutationId).first();
  const previous = await lookup();
  if (previous) return replay(previous, body);
  const saved = await latest(db, environment, id);
  const revision = saved?.revision || 0;
  const conflict = () => new ConfigError(409, 'stale_base', 'The saved settings changed. Reload the current revision to compare your edits.');
  if (baseRevision !== revision || baseToken !== await token(env, feature, revision)) {
    const raced = await lookup();
    if (raced) return replay(raced, body);
    throw conflict();
  }
  const before = saved ? inspectSaved(feature, saved).policy : feature.policy;
  const policy = normalizePolicy(feature, body.policy);
  if (before.primary.providerId !== policy.primary.providerId && !feature.providers.find(item => item.id === policy.primary.providerId)?.configured) {
    throw new ConfigError(422, 'provider_unavailable', 'Configure the selected primary provider first.', 'primary.providerId');
  }
  if (!diffPolicies(before, policy).length) throw new ConfigError(422, 'no_changes', 'There are no changes to save.');
  const diff = diffPolicies(saved ? JSON.parse(saved.policy_json) : before, policy);
  const digest = await sha256Hex(JSON.stringify([baseRevision, baseToken, policy]));
  const next = revision + 1;
  const issued = await token(env, feature, next);
  const inserted = await db.prepare(`INSERT INTO ai_feature_config_revisions
    (environment, feature_id, revision, catalog_version, policy_json, diff_json, issued_token, mutation_id, request_digest, request_id, actor, created_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE COALESCE((SELECT MAX(revision) FROM ai_feature_config_revisions WHERE environment = ? AND feature_id = ?), 0) = ?
    ON CONFLICT DO NOTHING`).bind(environment, id, next, CATALOG_VERSION, JSON.stringify(policy), JSON.stringify(diff), issued,
    mutationId, digest, crypto.randomUUID(), actor, new Date().toISOString(), environment, id, revision).run();
  if (inserted.meta.changes === 1) return receipt(policy, next, issued);
  const raced = await lookup();
  if (raced) return replay(raced, body);
  throw conflict();
}

export async function listHistory(env, featureId, cursor) {
  if (!configEnabled(env)) return { entries: [], nextCursor: null };
  const before = cursor === null ? Number.MAX_SAFE_INTEGER : Number(cursor);
  if (!Number.isSafeInteger(before) || before <= 0) throw new ConfigError(422, 'invalid_cursor', 'Invalid history cursor.');
  if (featureId) getFeature(env, featureId);
  const filter = featureId ? 'AND feature_id = ?' : '';
  const args = [configEnvironment(env), before, ...(featureId ? [featureId] : [])];
  const { results } = await database(env).prepare(`SELECT id, feature_id, revision, created_at, actor, diff_json
    FROM ai_feature_config_revisions WHERE environment = ? AND id < ? ${filter} ORDER BY id DESC LIMIT 26`).bind(...args).all();
  return {
    entries: results.slice(0, 25).map(row => ({
      featureId: row.feature_id, revision: row.revision, createdAt: row.created_at,
      environment: configEnvironment(env), actor: row.actor, diff: JSON.parse(row.diff_json)
    })),
    nextCursor: results.length > 25 ? String(results[24].id) : null
  };
}
