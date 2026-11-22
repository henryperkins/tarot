import { checkFields, configEnabled, configEnvironment, ConfigError, listConnections } from './aiConfigCatalog.js';
import { getNarrationConfiguration } from './narrationConfig.js';
import { hasConnectionKeySource, loadConnectionKey } from './providerConnectionKey.js';

const keyField = { name: 'apiKey', label: 'API key', type: 'password' };
const providers = new Map([
  ['openai-native', { apiKey: 'OPENAI_API_KEY' }],
  ['claude-api', { apiKey: 'ANTHROPIC_API_KEY' }],
  ['elevenlabs', { apiKey: 'ELEVENLABS_API_KEY' }],
  ['modal-qwen', {
    endpointUrl: 'MODAL_ENDPOINT_URL', token: 'MODAL_PROXY_TOKEN',
    tokenId: 'MODAL_PROXY_TOKEN_ID', tokenSecret: 'MODAL_PROXY_TOKEN_SECRET'
  }]
]);
const modalFields = [
  { name: 'endpointUrl', label: 'HTTPS endpoint', type: 'url' },
  { name: 'tokenId', label: 'Proxy token ID', type: 'password' },
  { name: 'tokenSecret', label: 'Proxy token secret', type: 'password' },
  { name: 'token', label: 'Combined proxy token', type: 'password' }
];
const textEncoder = new TextEncoder();
const undecipherable = 'This saved connection could not be opened. Replace the credentials, disconnect, or restore deployment settings.';
const keyUnavailable = 'The provider credential encryption key is unavailable on this deployment.';
const storageUnavailable = () => new ConfigError(503, 'connection_storage_unavailable', 'Provider connection storage is unavailable.');

function invalid(field, message) {
  throw new ConfigError(422, 'invalid_connection', message, field);
}

function validateValues(env, id, values) {
  const mapping = providers.get(id);
  checkFields(values, Object.keys(mapping), 'values');
  const clean = {};
  for (const [field, value] of Object.entries(values)) {
    if (typeof value !== 'string' || value.length > 4096 || !/^[!-~]+$/.test(value.trim())) {
      invalid(field, 'Enter a valid value using printable characters without whitespace.');
    }
    clean[field] = value.trim();
  }
  if (id !== 'modal-qwen') {
    if (!clean.apiKey) invalid('apiKey', 'Enter a new API key.');
    return clean;
  }
  let endpoint;
  try { endpoint = new URL(clean.endpointUrl); } catch { invalid('endpointUrl', 'Enter a valid HTTPS Modal endpoint.'); }
  let deploymentOrigin;
  try { deploymentOrigin = new URL(env.MODAL_ENDPOINT_URL).origin; } catch { /* No custom deployment origin. */ }
  const hostedModal = endpoint.hostname.endsWith('.modal.run') && !endpoint.port;
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (!hostedModal && endpoint.origin !== deploymentOrigin)) {
    invalid('endpointUrl', 'Use an HTTPS modal.run endpoint or the configured deployment origin, without credentials, query or fragment.');
  }
  if (clean.token ? (clean.tokenId || clean.tokenSecret) : (!clean.tokenId || !clean.tokenSecret)) {
    invalid('token', 'Enter either a combined proxy token or both parts of a new token pair.');
  }
  return clean;
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function fromBase64(value) {
  return Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
}

function cipherParams(iv, environment, provider, revision) {
  return { name: 'AES-GCM', iv, additionalData: textEncoder.encode(JSON.stringify([1, environment, provider, revision])) };
}

function database(env) {
  if (!env.DB?.prepare) throw storageUnavailable();
  return env.DB.withSession?.('first-primary') || env.DB;
}

async function loadRows(env) {
  if (!configEnabled(env)) return [];
  if (!env.DB?.prepare && !hasConnectionKeySource(env)) return [];
  try {
    const result = await database(env).prepare(
      'SELECT provider_id, revision, source, iv, ciphertext FROM ai_provider_connections WHERE environment = ?'
    ).bind(configEnvironment(env)).all();
    return result.results;
  } catch (error) {
    // A deployment with no vault configured may still be on the preceding schema.
    if (!hasConnectionKeySource(env) && /no such table: (?:main\.)?ai_provider_connections\b/i.test(error.message)) return [];
    throw storageUnavailable();
  }
}

const resolved = new WeakMap();

async function effectiveConnections(env, rows, key) {
  const effective = { ...env };
  const unreadable = new Set();
  for (const row of rows) {
    const id = row.provider_id;
    if (row.source === 'deployment' || !providers.has(id)) continue;
    const mapping = providers.get(id);
    // Clear every slot first, including legacy credentials from a different Modal auth mode.
    for (const name of Object.values(mapping)) delete effective[name];
    if (row.source === 'disconnected') continue;
    try {
      key ??= await loadConnectionKey(env);
      const plain = await crypto.subtle.decrypt(
        cipherParams(fromBase64(row.iv), configEnvironment(env), id, row.revision), key, fromBase64(row.ciphertext)
      );
      const values = validateValues(env, id, JSON.parse(new TextDecoder().decode(plain)));
      for (const [field, value] of Object.entries(values)) effective[mapping[field]] = value;
    } catch {
      // Keep the affected provider disconnected until an authenticated administrator repairs it.
      unreadable.add(id);
    }
  }
  return { effective, unreadable };
}

export async function resolveProviderEnvironment(env) {
  if (!configEnabled(env) || resolved.has(env)) return env;
  if (!env.DB?.prepare) throw storageUnavailable();
  const rows = await loadRows(env);
  if (!rows.some(row => row.source !== 'deployment')) return env;
  const { effective } = await effectiveConnections(env, rows);
  resolved.set(effective, env);
  return effective;
}

function inventory(effective) {
  const eleven = getNarrationConfiguration(effective, 'elevenlabs').available;
  return [...listConnections(effective), { id: 'elevenlabs', label: 'ElevenLabs', configured: eleven,
    missing: eleven ? [] : ['ELEVENLABS_API_KEY'], features: [] }];
}

function connectionView(env, row, entry, unreadable) {
  const id = entry.id;
  const managed = providers.has(id);
  const revision = row?.revision || 0;
  const enabled = configEnabled(env);
  const hasKey = hasConnectionKeySource(env);
  const editable = managed && enabled && Boolean(env.DB?.prepare) && (hasKey || revision > 0);
  const recoveryOnly = editable && !hasKey;
  let readOnlyReason;
  if (!managed) readOnlyReason = id === 'workers-ai' ? 'Provided by the deployment’s Workers AI binding.' : 'Built into Tableu.';
  else if (!enabled) readOnlyReason = 'Configuration editing is disabled for this deployment.';
  else if (!env.DB?.prepare) readOnlyReason = 'Provider connection storage is unavailable.';
  else if (!hasKey && !recoveryOnly) readOnlyReason = keyUnavailable;
  const source = managed ? row?.source || 'deployment' : id === 'workers-ai' ? 'binding' : 'builtin';
  const fields = !managed ? [] : id === 'modal-qwen' ? modalFields : [keyField];
  const managementWarning = recoveryOnly ? keyUnavailable : unreadable.has(id) ? undecipherable : undefined;
  return { ...entry, editable, source, revision, fields, ...(readOnlyReason && { readOnlyReason }),
    ...(recoveryOnly && { recoveryOnly }), ...(managementWarning && { managementWarning }) };
}

export async function listManagedConnections(environment) {
  const env = resolved.get(environment) || environment;
  const rows = await loadRows(env);
  const { effective, unreadable } = await effectiveConnections(env, rows);
  return inventory(effective).map(entry => connectionView(env, rows.find(row => row.provider_id === entry.id), entry, unreadable));
}

export async function saveConnection(environment, id, body) {
  const env = resolved.get(environment) || environment;
  if (!providers.has(id)) throw new ConfigError(422, 'read_only_connection', 'This provider has no portal-managed credentials.');
  if (!configEnabled(env)) throw new ConfigError(403, 'read_only', 'Configuration editing is disabled for this deployment.');
  const { action, baseRevision, values } = body;
  if (!['replace', 'reset', 'disconnect'].includes(action)) invalid('action', 'Choose a supported connection action.');
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0 || baseRevision >= Number.MAX_SAFE_INTEGER) invalid('baseRevision', 'A valid base revision is required.');
  if (!hasConnectionKeySource(env) && (action === 'replace' || !baseRevision)) throw new ConfigError(503, 'connection_key_unavailable', keyUnavailable);
  if (action !== 'replace' && Object.hasOwn(body, 'values')) invalid('values', 'Credentials are only accepted when replacing a connection.');
  const revision = baseRevision + 1;
  const scope = configEnvironment(env);
  const source = { replace: 'portal', reset: 'deployment', disconnect: 'disconnected' }[action];
  let iv = null;
  let ciphertext = null;
  let key;
  if (action === 'replace') {
    const fresh = validateValues(env, id, values);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    try { key = await loadConnectionKey(env); } catch { throw new ConfigError(503, 'connection_key_unavailable', keyUnavailable); }
    ciphertext = toBase64(await crypto.subtle.encrypt(cipherParams(nonce, scope, id, revision), key, textEncoder.encode(JSON.stringify(fresh))));
    iv = toBase64(nonce);
  }
  const db = database(env);
  const statement = baseRevision === 0
    ? db.prepare('INSERT INTO ai_provider_connections (environment, provider_id, revision, source, iv, ciphertext) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING')
      .bind(scope, id, revision, source, iv, ciphertext)
    : db.prepare('UPDATE ai_provider_connections SET revision = ?, source = ?, iv = ?, ciphertext = ? WHERE environment = ? AND provider_id = ? AND revision = ?')
      .bind(revision, source, iv, ciphertext, scope, id, baseRevision);
  const result = await statement.run();
  if (result.meta.changes !== 1) throw new ConfigError(409, 'connection_conflict', 'This connection changed. Reload it before saving.');
  // Report the version this request committed even if another administrator edits it immediately.
  const row = { provider_id: id, revision, source, iv, ciphertext };
  const { effective, unreadable } = await effectiveConnections(env, [row], key);
  return connectionView(env, row, inventory(effective).find(entry => entry.id === id), unreadable);
}
