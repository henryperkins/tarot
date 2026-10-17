import path from 'node:path';
import { secureDevelopmentServer } from './developmentServerSecurity.mjs';
import { buildSubscriptionEnv } from '../../services/claude-code/runner.mjs';

export const VISUAL_MODEL = '@cf/zai-org/glm-5.3-flash';
export const WORKER_PORT = 8787;
export const FRONTEND_PORT = 5175;
export const GATEWAY_PORT = 8789;
export const LOCAL_DATABASE_ID = 'f91366fb-46cf-4f25-9cca-e14576087735';
const INSPECTOR_PORT = 9235;
const SUBSCRIPTION_PROVIDERS = ['claude-code', 'codex-subscription'];
const BETA_PORTS = Object.freeze({ worker: WORKER_PORT, frontend: FRONTEND_PORT, gateway: GATEWAY_PORT, inspector: INSPECTOR_PORT });
const PORT_KEYS = Object.keys(BETA_PORTS);

/** An isolated run owns four explicit ports, a private directory and its own local database. */
export function validateIsolation(value) {
  const ports = PORT_KEYS.map(key => value?.ports?.[key]);
  if (!ports.every(port => Number.isInteger(port) && port >= 1024 && port <= 65535 && !Object.values(BETA_PORTS).includes(port))
    || new Set(ports).size !== ports.length) {
    throw new Error('Isolated runs need four distinct explicit owned ports outside the beta defaults.');
  }
  if (typeof value.privateDirectory !== 'string' || !path.isAbsolute(value.privateDirectory)) {
    throw new Error('Isolated runs need an absolute private directory.');
  }
  if (typeof value.databaseId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.databaseId)
    || value.databaseId === LOCAL_DATABASE_ID) {
    throw new Error('Isolated runs need their own local database ID.');
  }
  return { ports: Object.fromEntries(PORT_KEYS.map((key, index) => [key, ports[index]])),
    privateDirectory: path.resolve(value.privateDirectory), databaseId: value.databaseId };
}

export function parseDevelopmentOptions(argv) {
  const options = { check: false, provider: 'claude-code', ownerEmail: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (!['--check', '--provider', '--owner-email', '--isolated'].includes(flag) || seen.has(flag)) {
      throw new Error('Usage: npm run dev:reading-gestures -- [--check] [--provider claude-code|codex-subscription] [--owner-email local-account-email] [--isolated /absolute/owned-options.json]');
    }
    seen.add(flag);
    if (flag === '--check') options.check = true;
    else if (flag === '--isolated') {
      const file = argv[++index];
      if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('Isolated options must be an absolute private file.');
      options.isolated = file;
    }
    else if (flag === '--provider') {
      options.provider = argv[++index];
      if (!SUBSCRIPTION_PROVIDERS.includes(options.provider)) throw new Error('Select claude-code or codex-subscription.');
    } else {
      const email = argv[++index];
      if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('An existing local account email is required.');
      }
      options.ownerEmail = email.toLowerCase();
    }
  }
  return options;
}

export async function resolveDevelopmentOwner(db, ownerEmail, reviewerId) {
  if (!ownerEmail) return reviewerId;
  const owner = await db.prepare(`SELECT id FROM users WHERE lower(email) = ?
    AND is_active = 1 AND coalesce(auth_provider, 'password') != 'service'`)
    .bind(ownerEmail).first();
  if (!owner?.id) throw new Error('Select an existing active local account; register it in the beta first.');
  return owner.id;
}

/** Explicit allowlist: host API keys, NODE_OPTIONS and dotenv files never enter children. */
export function developmentEnvironment(source = process.env, { frontend = false } = {}) {
  const environment = buildSubscriptionEnv(source);
  if (!frontend) {
    for (const name of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']) {
      if (source[name]) environment[name] = source[name];
    }
  }
  return { ...environment, CI: 'true', NO_COLOR: '1', WRANGLER_SEND_METRICS: 'false',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    ...(frontend ? { VITE_READING_GESTURES: 'true' } : {}) };
}

export function validateLocalReviewer(credentials) {
  if (credentials?.scope !== 'local-development-only'
    || credentials?.baseUrl !== 'http://localhost:8787'
    || !['userId', 'email', 'username', 'password'].every(key => typeof credentials[key] === 'string' && credentials[key])) {
    throw new Error('A valid local-only reviewer credential file is required.');
  }
  return credentials;
}

export function developmentPaths(root, isolation = null) {
  const directory = isolation ? isolation.privateDirectory : path.join(root, '.wrangler', 'reading-gestures-beta');
  return { directory, config: path.join(directory, 'wrangler.json'),
    vars: path.join(directory, '.dev.vars'), frontendConfig: path.join(directory, 'vite.config.mjs'),
    state: path.join(directory, 'state'), logs: path.join(directory, 'logs') };
}

export function developmentViteConfig(base, { privateDirectory, port = FRONTEND_PORT, workerPort = null }) {
  // An isolated frontend must never reach the protected beta Worker: every
  // proxied path targets the isolated run's own Worker.
  let proxy = base.server?.proxy;
  if (workerPort !== null) {
    if (!Number.isInteger(workerPort) || workerPort < 1024 || workerPort > 65535 || Object.values(BETA_PORTS).includes(workerPort)) {
      throw new Error('An isolated frontend needs its own owned Worker port.');
    }
    const target = `http://localhost:${workerPort}`;
    proxy = Object.fromEntries(Object.entries(proxy || {}).map(([route, value]) => [route,
      typeof value === 'string' ? target : { ...value, target }]));
  }
  return { ...base, envDir: privateDirectory,
    server: secureDevelopmentServer({ ...base.server, ...(proxy ? { proxy } : {}), port, strictPort: true }) };
}

/** Build only local storage bindings; do not carry routes, services, remote IDs or secrets. */
export function developmentConfig(base, { root, ownerUserId, accountId, provider = 'claude-code', isolation = null }) {
  if (!ownerUserId) throw new Error('A local owner is required.');
  const ports = isolation?.ports ?? BETA_PORTS;
  // Isolated probes have no unbudgeted Workers AI binding: live visual dispatch
  // must go through the shared Task 7 round ledger, which needs a budget-gated
  // transport that this revision does not provide.
  const visual = isolation ? {} : { VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: VISUAL_MODEL,
    VISUAL_CUE_REASONING_EFFORT: 'low', VISUAL_CUE_TIMEOUT_MS: '60000' };
  if (!SUBSCRIPTION_PROVIDERS.includes(provider)) throw new Error('Invalid local subscription provider.');
  const prefix = provider === 'codex-subscription' ? 'CODEX_SUBSCRIPTION' : 'CLAUDE_CODE';
  const safeVars = Object.fromEntries(Object.entries(base.vars || {})
    .filter(([key]) => !/(?:API_KEY|TOKEN|SECRET|PASSWORD|SENTRY|OTEL|_ENDPOINT|_URL|CLAUDE_CODE|CODEX_SUBSCRIPTION)/.test(key)));
  return {
    name: 'tableau-reading-gestures-local',
    account_id: accountId || base.account_id,
    main: path.join(root, 'src/worker/index.js'),
    compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags,
    workers_dev: false,
    preview_urls: false,
    assets: { ...base.assets, directory: path.join(root, 'dist') },
    ...(isolation ? {} : { ai: { binding: 'AI', remote: true } }),
    vars: {
      ...safeVars,
      TEXT_PROVIDER: provider,
      [`${prefix}_GATEWAY_URL`]: `http://127.0.0.1:${ports.gateway}`,
      [`${prefix}_OWNER_USER_ID`]: ownerUserId,
      [`${prefix}_TIMEOUT_MS`]: '300000',
      ...(provider === 'codex-subscription' ? { CODEX_SUBSCRIPTION_STREAMING_ENABLED: 'true' } : {}),
      ...visual,
      APP_URL: `http://localhost:${ports.worker}`,
      LOG_LLM_PROMPTS: 'false',
      PERSIST_PROMPTS: 'false',
      LOG_NARRATIVE_ENHANCEMENTS: 'false',
      LOG_ENHANCEMENT_TELEMETRY: 'false',
      METRICS_STORAGE_MODE: 'minimal',
      SKIP_PII_REDACTION: 'false'
    },
    d1_databases: [{ binding: 'DB', database_name: isolation ? `reading-cue-isolated-${isolation.databaseId.slice(0, 8)}` : 'reading-gestures-local',
      database_id: isolation?.databaseId ?? LOCAL_DATABASE_ID, remote: false, migrations_dir: path.join(root, 'migrations') }],
    kv_namespaces: (base.kv_namespaces || []).map(({ binding }, index) => ({ binding,
      id: (index + 1).toString(16).padStart(32, '0'), remote: false })),
    r2_buckets: (base.r2_buckets || []).map(({ binding }, index) => ({ binding,
      bucket_name: `reading-gestures-local-${index}`, remote: false })),
    durable_objects: { bindings: (base.durable_objects?.bindings || []).map(({ name, class_name }) => ({ name, class_name })) },
    migrations: structuredClone(base.migrations || []),
    dev: { ip: '127.0.0.1', port: ports.worker, inspector_port: ports.inspector },
    observability: { enabled: false }
  };
}

export function localMigrationArguments(paths) {
  return ['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', paths.state, '--config', paths.config];
}

export function workerArguments(paths, isolation = null) {
  // --local disables remote AI as well, so explicitly local storage is configured above.
  return ['dev', '--config', paths.config, '--persist-to', paths.state,
    '--ip', '127.0.0.1', '--port', String(isolation?.ports.worker ?? WORKER_PORT), '--show-interactive-dev-session=false'];
}
