import { configEnabled, configEnvironment, ConfigError } from './aiConfigCatalog.js';
import { ensureCodexSubscriptionConfig } from './codexSubscription.js';
import { fetchCodexSubscriptionModels } from './codexSubscriptionModels.js';
import { sha256Hex } from './crypto.js';
import { getPersonalTextProvider } from './personalTextProvider.js';

export const LOCAL_CODEX_LINK_REVISION = Symbol('local Codex owner link revision');
export const PERSONAL_MODEL_FIELDS = ['modelId', 'baseRevision', 'baseToken'];

async function selectionScope(env) {
  const owner = String(env.CODEX_SUBSCRIPTION_OWNER_USER_ID || '').trim();
  if (!configEnabled(env) || !owner) return null;
  const environment = configEnvironment(env);
  const linkRevision = env[LOCAL_CODEX_LINK_REVISION];
  if (environment === 'local' && Number.isSafeInteger(linkRevision)) {
    return { key: await sha256Hex(JSON.stringify([environment, owner, linkRevision])), owner, linkRevision };
  }
  const provider = getPersonalTextProvider(env);
  if (provider !== 'codex-subscription' && (provider || ![true, 'true'].includes(env.CODEX_SUBSCRIPTION_OWNER_ROUTING_ENABLED))) return null;
  let url;
  try { ({ url } = ensureCodexSubscriptionConfig(env)); } catch { return null; }
  return { key: await sha256Hex(JSON.stringify([environment, owner, url])), owner };
}

function preferenceDb(env) {
  if (!env.DB?.prepare) throw new ConfigError(503, 'personal_model_storage_unavailable', 'Personal Readings model storage is unavailable.');
  return env.DB.withSession?.('first-primary') || env.DB;
}

async function readSelection(env, scope) {
  const row = await preferenceDb(env).prepare('SELECT model_id, revision FROM personal_reading_models WHERE scope_key = ?')
    .bind(scope.key).first();
  return { modelId: row?.model_id ?? null, revision: row?.revision ?? 0, baseToken: scope.key };
}

export async function describePersonalReadingSelection(env) {
  const scope = await selectionScope(env);
  if (!scope) return { selection: null, editable: false,
    readOnlyReason: 'Enable AI configuration and configure ChatGPT subscription routing for a reader to set a personal Readings model.' };
  return { selection: await readSelection(env, scope), editable: true };
}

export async function resolvePersonalReadingModel(env, userId) {
  if (!userId || String(userId) !== String(env.CODEX_SUBSCRIPTION_OWNER_USER_ID || '').trim()) return null;
  const scope = await selectionScope(env);
  return scope ? (await readSelection(env, scope)).modelId : null;
}

export async function savePersonalReadingModel(env, { modelId, baseRevision, baseToken }, signal) {
  const scope = await selectionScope(env);
  if (!scope) throw new ConfigError(403, 'personal_model_read_only', 'Personal Readings model selection is unavailable for this subscription.');
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0 || typeof baseToken !== 'string' ||
    (modelId !== null && (typeof modelId !== 'string' || !modelId || modelId.length > 100))) {
    throw new ConfigError(422, 'invalid_personal_model', 'Choose a model from the current subscription list or use the gateway default.');
  }
  const changed = () => new ConfigError(409, 'personal_model_changed', 'The subscription or its Readings model changed. Fetch models again.');
  if (baseToken !== scope.key) throw changed();
  if (modelId !== null) {
    const { models } = await fetchCodexSubscriptionModels(env, signal);
    if (!models.some(model => model.id === modelId)) throw new ConfigError(422, 'personal_model_unavailable', 'This model is no longer available from the ChatGPT subscription. Fetch models again.');
  }
  const db = preferenceDb(env);
  // A local reader can unlink or switch providers while discovery is in flight.
  const linkGuard = scope.linkRevision === undefined ? '1' :
    "EXISTS (SELECT 1 FROM owner_subscription WHERE id = 1 AND owner_id = ? AND revision = ? AND provider_id = 'codex-subscription')";
  const linkArgs = scope.linkRevision === undefined ? [] : [scope.owner, scope.linkRevision];
  const statement = baseRevision === 0
    ? db.prepare('INSERT INTO personal_reading_models (scope_key, model_id, revision) SELECT ?, ?, 1 WHERE ' + linkGuard + ' ON CONFLICT(scope_key) DO NOTHING')
      .bind(scope.key, modelId, ...linkArgs)
    : db.prepare('UPDATE personal_reading_models SET model_id = ?, revision = revision + 1 WHERE scope_key = ? AND revision = ? AND ' + linkGuard)
      .bind(modelId, scope.key, baseRevision, ...linkArgs);
  if (!(await statement.run()).meta.changes) throw changed();
  return { selection: { modelId, revision: baseRevision + 1, baseToken: scope.key } };
}
