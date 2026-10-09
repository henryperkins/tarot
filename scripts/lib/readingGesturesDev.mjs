import path from 'node:path';
import { secureDevelopmentServer } from './developmentServerSecurity.mjs';
import { buildSubscriptionEnv } from '../../services/claude-code/runner.mjs';

export const VISUAL_MODEL = '@cf/zai-org/glm-5.3-flash';
export const WORKER_PORT = 8787;
export const FRONTEND_PORT = 5175;
export const GATEWAY_PORT = 8789;
export const LOCAL_DATABASE_ID = 'f91366fb-46cf-4f25-9cca-e14576087735';
const SUBSCRIPTION_PROVIDERS = ['claude-code'];

export function parseDevelopmentOptions(argv) {
  const options = { check: false, provider: 'claude-code', ownerEmail: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (!['--check', '--provider', '--owner-email'].includes(flag) || seen.has(flag)) {
      throw new Error('Usage: npm run dev:reading-gestures -- [--check] [--provider claude-code] [--owner-email local-account-email]');
    }
    seen.add(flag);
    if (flag === '--check') options.check = true;
    else if (flag === '--provider') {
      options.provider = argv[++index];
      if (!SUBSCRIPTION_PROVIDERS.includes(options.provider)) throw new Error('Select claude-code.');
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

export function developmentPaths(root) {
  const directory = path.join(root, '.wrangler', 'reading-gestures-beta');
  return { directory, config: path.join(directory, 'wrangler.json'),
    vars: path.join(directory, '.dev.vars'), frontendConfig: path.join(directory, 'vite.config.mjs'),
    state: path.join(directory, 'state'), logs: path.join(directory, 'logs') };
}

export function developmentViteConfig(base, { privateDirectory }) {
  return { ...base, envDir: privateDirectory,
    server: secureDevelopmentServer({ ...base.server, port: FRONTEND_PORT, strictPort: true }) };
}

/** Build only local storage bindings; do not carry routes, services, remote IDs or secrets. */
export function developmentConfig(base, { root, ownerUserId, accountId, provider = 'claude-code' }) {
  if (!ownerUserId) throw new Error('A local owner is required.');
  if (!SUBSCRIPTION_PROVIDERS.includes(provider)) throw new Error('Invalid local subscription provider.');
  const prefix = 'CLAUDE_CODE';
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
    ai: { binding: 'AI', remote: true },
    vars: {
      ...safeVars,
      TEXT_PROVIDER: provider,
      [`${prefix}_GATEWAY_URL`]: `http://127.0.0.1:${GATEWAY_PORT}`,
      [`${prefix}_OWNER_USER_ID`]: ownerUserId,
      [`${prefix}_TIMEOUT_MS`]: '300000',
      VISUAL_CUE_PROVIDER: 'workers-ai',
      VISUAL_CUE_MODEL: VISUAL_MODEL,
      VISUAL_CUE_REASONING_EFFORT: 'low',
      VISUAL_CUE_TIMEOUT_MS: '60000',
      APP_URL: `http://localhost:${WORKER_PORT}`,
      LOG_LLM_PROMPTS: 'false',
      PERSIST_PROMPTS: 'false',
      LOG_NARRATIVE_ENHANCEMENTS: 'false',
      LOG_ENHANCEMENT_TELEMETRY: 'false',
      METRICS_STORAGE_MODE: 'minimal',
      SKIP_PII_REDACTION: 'false'
    },
    d1_databases: [{ binding: 'DB', database_name: 'reading-gestures-local',
      database_id: LOCAL_DATABASE_ID, remote: false, migrations_dir: path.join(root, 'migrations') }],
    kv_namespaces: (base.kv_namespaces || []).map(({ binding }, index) => ({ binding,
      id: (index + 1).toString(16).padStart(32, '0'), remote: false })),
    r2_buckets: (base.r2_buckets || []).map(({ binding }, index) => ({ binding,
      bucket_name: `reading-gestures-local-${index}`, remote: false })),
    durable_objects: { bindings: (base.durable_objects?.bindings || []).map(({ name, class_name }) => ({ name, class_name })) },
    migrations: structuredClone(base.migrations || []),
    dev: { ip: '127.0.0.1', port: WORKER_PORT, inspector_port: 9235 },
    observability: { enabled: false }
  };
}

export function localMigrationArguments(paths) {
  return ['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', paths.state, '--config', paths.config];
}

export function workerArguments(paths) {
  // --local disables remote AI as well, so explicitly local storage is configured above.
  return ['dev', '--config', paths.config, '--persist-to', paths.state,
    '--ip', '127.0.0.1', '--port', String(WORKER_PORT), '--show-interactive-dev-session=false'];
}
