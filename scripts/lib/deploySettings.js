import { randomUUID } from 'node:crypto';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const VARIABLE_TYPES = new Set(['plain_text', 'json', 'secret_text', 'secret_key']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function getDeploymentEnvironment(config, env) {
  if (env.WRANGLER_CI_OVERRIDE_NAME && env.WRANGLER_CI_OVERRIDE_NAME !== config.name) {
    throw new Error('Worker name override differs from the settings preservation target.');
  }
  // Match Wrangler's configured-account precedence. Pin these in the child
  // environment too, so auto-loaded .env files cannot change the API or Worker.
  return {
    ...env,
    CLOUDFLARE_ACCOUNT_ID: config.account_id || env.CLOUDFLARE_ACCOUNT_ID,
    WRANGLER_CI_OVERRIDE_NAME: config.name,
    CLOUDFLARE_API_BASE_URL: env.CLOUDFLARE_API_BASE_URL || env.CF_API_BASE_URL || 'https://api.cloudflare.com/client/v4'
  };
}

function validateWorkerSettings(settings) {
  if (!isObject(settings) || !Array.isArray(settings.bindings)
    || (settings.observability != null && !isObject(settings.observability))) return false;
  const names = new Set();
  for (const binding of settings.bindings) {
    if (typeof binding?.name !== 'string' || !binding.name || typeof binding?.type !== 'string' || !binding.type || names.has(binding.name)) return false;
    names.add(binding.name);
    if (binding.type === 'plain_text' && typeof binding.text !== 'string') return false;
    if (binding.type === 'json') {
      if (binding.json === undefined) return false;
      try { variableValue(binding); } catch { return false; }
    }
  }
  for (const value of [settings.observability, settings.observability?.logs, settings.observability?.traces, settings.observability?.issues]) {
    if (value == null) continue;
    if (!isObject(value)) return false;
    for (const key of ['enabled', 'persist', 'invocation_logs', 'redact_query_string']) {
      if (value[key] !== undefined && typeof value[key] !== 'boolean') return false;
    }
    if (value.head_sampling_rate !== undefined && (!Number.isFinite(value.head_sampling_rate) || value.head_sampling_rate < 0 || value.head_sampling_rate > 1)) return false;
    if (value.destinations !== undefined && (!Array.isArray(value.destinations) || value.destinations.some(name => typeof name !== 'string'))) return false;
  }
  return true;
}

/** Use Wrangler's existing login (including refresh), without logging credentials. */
export function createWorkerSettingsReader({ config, env, runWrangler }) {
  env = getDeploymentEnvironment(config, env);
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const workerName = config.name;
  if (!/^[a-f0-9]{32}$/i.test(accountId || '') || !/^[a-z0-9_-]+$/i.test(workerName || '')) {
    throw new Error('Settings preservation requires a configured Cloudflare account ID and Worker name.');
  }
  const auth = runWrangler(['auth', 'token', '--json'], {
    // Wrangler otherwise writes auth token JSON to its debug log, even when
    // stdout is captured. Keep credential retrieval entirely in memory.
    env: { ...env, WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG: 'log' }
  });
  if (auth.status !== 0) throw new Error('Cannot authenticate settings preservation with Wrangler.');
  let credentials;
  try {
    credentials = JSON.parse(auth.stdout);
  } catch {
    throw new Error('Wrangler returned invalid authentication data.');
  }
  let headers;
  if (['oauth', 'api_token'].includes(credentials?.type) && credentials.token) {
    headers = { Authorization: `Bearer ${credentials.token}` };
  } else if (credentials?.type === 'api_key' && credentials.key && credentials.email) {
    headers = { 'X-Auth-Key': credentials.key, 'X-Auth-Email': credentials.email };
  } else {
    throw new Error('Wrangler did not return usable authentication data.');
  }
  const baseUrl = env.CLOUDFLARE_API_BASE_URL || env.CF_API_BASE_URL || 'https://api.cloudflare.com/client/v4';
  const url = `${baseUrl.replace(/\/$/, '')}/accounts/${accountId}/workers/scripts/${workerName}/settings`;
  return async () => {
    let response;
    let body;
    try {
      response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
      body = await response.json();
    } catch {
      throw new Error('Cannot read Worker settings; refusing to deploy without preservation.');
    }
    // Only the API's explicit "Worker not found" response permits a first deploy.
    if (response.status === 404 && body?.errors?.some(error => error.code === 10007)) return null;
    if (!response.ok || body?.success !== true) {
      throw new Error(`Cannot read Worker settings (HTTP ${response.status}); refusing to deploy without preservation.`);
    }
    const settings = body.result;
    if (!validateWorkerSettings(settings)) {
      throw new Error('Cloudflare returned invalid Worker settings; refusing to deploy without preservation.');
    }
    return settings;
  };
}

/** Existing bindings win; checked-in vars supply defaults only for new names. */
export function buildDeploymentConfig(config, settings) {
  const next = structuredClone(config);
  if (config.unsafe?.metadata && ['bindings', 'keep_bindings', 'observability'].some(key => Object.hasOwn(config.unsafe.metadata, key))) {
    throw new Error('Unsafe upload metadata cannot override bindings, retention, or observability during a preserving release.');
  }
  const configuredNames = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.binding === 'string') configuredNames.add(value.binding);
    for (const entry of Object.values(value)) visit(entry);
  };
  for (const [key, value] of Object.entries(config)) {
    if (!['vars', 'env', 'define', 'alias'].includes(key)) visit(value);
  }
  for (const bindings of [config.durable_objects?.bindings, config.send_email, config.ratelimits, config.logfwdr?.bindings, config.unsafe?.bindings, config.unsafe?.ratelimits]) {
    for (const binding of bindings || []) if (binding.name) configuredNames.add(binding.name);
  }
  for (const bindings of [config.wasm_modules, config.text_blobs, config.data_blobs]) {
    for (const name of Object.keys(bindings || {})) configuredNames.add(name);
  }
  for (const binding of settings?.bindings || []) {
    if (VARIABLE_TYPES.has(binding.type) && configuredNames.has(binding.name)) {
      throw new Error(`Configured binding would replace an existing dashboard variable or secret: ${binding.name}`);
    }
  }
  const existingNames = new Set(settings?.bindings.map(binding => binding.name) || []);
  next.keep_vars = true;
  next.vars = Object.fromEntries(Object.entries(config.vars || {}).filter(([name]) => !existingNames.has(name)));
  // This must be normal config: Wrangler patches observability after code upload,
  // independently of unsafe.metadata. Carry forward logs, traces, and Issues.
  next.observability = { ...config.observability, ...settings?.observability };
  for (const key of ['logs', 'traces', 'issues']) {
    if (config.observability?.[key] || settings?.observability?.[key]) {
      next.observability[key] = { ...config.observability?.[key], ...settings?.observability?.[key] };
    }
  }
  return next;
}

function variableValue(binding) {
  if (binding.type === 'plain_text') return binding.text;
  if (binding.type === 'json') {
    try {
      return typeof binding.json === 'string' ? JSON.parse(binding.json) : binding.json;
    } catch {
      throw new Error(`Invalid JSON variable: ${binding.name}`);
    }
  }
  return undefined; // Secret values are never returned by the API.
}

function containsSettings(actual, expected) {
  if (!isObject(expected)) return isDeepStrictEqual(actual, expected);
  return isObject(actual) && Object.entries(expected).every(([key, value]) => containsSettings(actual[key], value));
}

export function verifyPreservedSettings(before, after, deployedConfig) {
  if (!after) throw new Error('Cannot verify settings: deployed Worker was not found.');
  const actualBindings = new Map(after.bindings.map(binding => [binding.name, binding]));
  for (const expected of before?.bindings || []) {
    if (!VARIABLE_TYPES.has(expected.type)) continue;
    const actual = actualBindings.get(expected.name);
    if (actual?.type !== expected.type || !isDeepStrictEqual(variableValue(actual), variableValue(expected))) {
      throw new Error(`Worker settings verification failed for variable: ${expected.name}`);
    }
  }
  for (const [name, value] of Object.entries(deployedConfig.vars)) {
    const actual = actualBindings.get(name);
    if (!actual || !isDeepStrictEqual(variableValue(actual), value)) {
      throw new Error(`Worker settings verification failed for new variable: ${name}`);
    }
  }
  if (!containsSettings(after.observability, deployedConfig.observability)) {
    throw new Error('Worker settings verification failed for observability (logs, traces, or Issues).');
  }
}

export function writeDeploymentConfig(rootDir, config) {
  // Keep it beside wrangler.jsonc so relative entrypoints/assets still resolve.
  // Dashboard values and credentials are never written to this file.
  const path = join(rootDir, `.wrangler-deploy-${randomUUID()}.json`);
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  return { path, cleanup: () => rmSync(path, { force: true }) };
}
