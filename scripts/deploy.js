#!/usr/bin/env node
/**
 * Deployment Script with Migration Support
 *
 * This script ensures D1 migrations are applied before deploying the worker.
 * It tracks applied migrations in a _migrations table to prevent re-application.
 *
 * Usage:
 *   node scripts/deploy.js                       # Apply migrations + deploy
 *   node scripts/deploy.js --migrations-only     # Only apply migrations
 *   node scripts/deploy.js --dry-run             # Show what would be done
 *   node scripts/deploy.js --db-name <name>      # Override D1 DB name
 *   node scripts/deploy.js --allow-changed-migrations
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN - Required for remote operations
 *   CLOUDFLARE_ACCOUNT_ID - Optional (uses wrangler.jsonc if not set)
 *   CLOUDFLARE_D1_DATABASE_NAME - Optional D1 database name override
 *   STRICT_MIGRATION_CHECKS - Optional strict checksum mismatch policy (true/false)
 *   ALLOW_CHANGED_MIGRATIONS - Optional override for checksum mismatch policy (true/false)
 */

import { spawnSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT_DIR, 'migrations');
const WRANGLER_CONFIG = join(ROOT_DIR, 'wrangler.jsonc');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function logError(message) {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
}

function sleep(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, ms);
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function getArgValue(argv, flag) {
  const directPrefix = `${flag}=`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === flag) {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        return next;
      }
      return null;
    }
    if (arg.startsWith(directPrefix)) {
      return arg.slice(directPrefix.length) || null;
    }
  }
  return null;
}

export function parseCliArgs(argv = []) {
  const dryRun = argv.includes('--dry-run');
  const migrationsOnly = argv.includes('--migrations-only');
  const local = argv.includes('--local');
  const verbose = argv.includes('--verbose') || argv.includes('-v');
  const allowChangedMigrations = argv.includes('--allow-changed-migrations');
  const strictMigrationChecks = argv.includes('--strict-migration-checks');
  const dbName = getArgValue(argv, '--db-name');

  return {
    dryRun,
    migrationsOnly,
    local,
    verbose,
    allowChangedMigrations,
    strictMigrationChecks,
    dbName
  };
}

export function stripJsonComments(content) {
  if (typeof content !== 'string') return '';

  let stripped = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (escapeNext) {
      stripped += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      stripped += char;
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      stripped += char;
      continue;
    }

    if (!inString && char === '/' && next === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      if (content[i] === '\n') stripped += '\n';
      continue;
    }

    if (!inString && char === '/' && next === '*') {
      i += 2;
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 1;
      continue;
    }

    stripped += char;
  }

  return stripped;
}

export function parseJsoncConfig(content) {
  const stripped = stripJsonComments(content);
  const normalized = stripTrailingCommas(stripped);
  const parsed = JSON.parse(normalized);
  return parsed;
}

export function stripTrailingCommas(content) {
  if (typeof content !== 'string') return '';

  let stripped = '';
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      stripped += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      stripped += char;
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      stripped += char;
      continue;
    }

    if (!inString && char === ',') {
      let j = i + 1;
      while (j < content.length && /\s/.test(content[j])) j++;
      if (content[j] === '}' || content[j] === ']') {
        continue;
      }
    }

    stripped += char;
  }

  return stripped;
}

function loadWranglerConfig(configPath = WRANGLER_CONFIG) {
  const content = readFileSync(configPath, 'utf-8');
  return parseJsoncConfig(content);
}

export function resolveD1DatabaseName({
  explicitDbName = null,
  envDbName = null,
  wranglerConfig = null
} = {}) {
  if (explicitDbName && String(explicitDbName).trim()) {
    return String(explicitDbName).trim();
  }

  if (envDbName && String(envDbName).trim()) {
    return String(envDbName).trim();
  }

  const d1Databases = Array.isArray(wranglerConfig?.d1_databases)
    ? wranglerConfig.d1_databases
    : [];

  if (d1Databases.length === 0) {
    throw new Error('No D1 databases found in wrangler.jsonc. Add d1_databases or pass --db-name.');
  }

  const preferred = d1Databases.find((db) => db?.binding === 'DB' && db?.database_name)
    || d1Databases.find((db) => db?.database_name);

  if (!preferred?.database_name) {
    throw new Error('Unable to resolve D1 database_name from wrangler.jsonc. Pass --db-name.');
  }

  return preferred.database_name;
}

export function evaluateChangedMigrations(changedMigrations, {
  strictMigrationChecks = false,
  allowChangedMigrations = false
} = {}) {
  const changedCount = Array.isArray(changedMigrations) ? changedMigrations.length : 0;
  if (changedCount === 0) {
    return { ok: true, level: 'none' };
  }

  if (allowChangedMigrations) {
    return {
      ok: true,
      level: 'warn',
      reason: 'changed_migrations_allowed'
    };
  }

  if (strictMigrationChecks) {
    return {
      ok: false,
      level: 'error',
      reason: 'changed_migrations_detected'
    };
  }

  return {
    ok: true,
    level: 'warn',
    reason: 'changed_migrations_detected'
  };
}

export function shouldTreatMigrationExecutionAsFailure(result) {
  return !result?.success;
}

export function isMissingMigrationsTableError(errorMessage) {
  const normalized = String(errorMessage || '').toLowerCase();
  return (
    normalized.includes('no such table') && normalized.includes('_migrations')
  ) || normalized.includes('table "_migrations" does not exist')
    || normalized.includes('table _migrations does not exist');
}

// eslint-disable-next-line no-control-regex -- stripping ANSI escape sequences from CLI output
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*m/g;

function normalizeCommandOutput(value) {
  return String(value || '')
    .replace(ANSI_ESCAPE_RE, '')
    .trim();
}

export function extractWranglerErrorMessage(stderr = '', stdout = '') {
  const normalizedStderr = normalizeCommandOutput(stderr);
  if (normalizedStderr) {
    return normalizedStderr;
  }

  const normalizedStdout = normalizeCommandOutput(stdout);
  if (!normalizedStdout) {
    return '';
  }

  try {
    const parsed = JSON.parse(normalizedStdout);
    const primaryText = typeof parsed?.error?.text === 'string'
      ? parsed.error.text.trim()
      : '';
    if (primaryText) {
      const notes = Array.isArray(parsed?.error?.notes)
        ? parsed.error.notes
          .map((note) => (typeof note?.text === 'string' ? note.text.trim() : ''))
          .filter(Boolean)
        : [];
      return notes.length > 0
        ? `${primaryText} ${notes.join(' ')}`
        : primaryText;
    }

    if (Array.isArray(parsed?.errors)) {
      const firstError = parsed.errors
        .map((entry) => (typeof entry?.message === 'string' ? entry.message.trim() : (typeof entry?.text === 'string' ? entry.text.trim() : '')))
        .find(Boolean);
      if (firstError) {
        return firstError;
      }
    }
  } catch {
    // ignore parse errors and use plain output fallback below
  }

  return normalizedStdout;
}

function createRuntimeContext(argv = process.argv.slice(2), env = process.env) {
  const cli = parseCliArgs(argv);
  const wranglerConfig = loadWranglerConfig(WRANGLER_CONFIG);

  const strictMigrationChecks = cli.allowChangedMigrations
    ? false
    : (cli.strictMigrationChecks || parseBoolean(env.STRICT_MIGRATION_CHECKS, parseBoolean(env.CI, false)));

  const runtime = {
    rootDir: ROOT_DIR,
    migrationsDir: MIGRATIONS_DIR,
    wranglerConfigPath: WRANGLER_CONFIG,
    dryRun: cli.dryRun,
    migrationsOnly: cli.migrationsOnly,
    local: cli.local,
    verbose: cli.verbose,
    allowChangedMigrations: cli.allowChangedMigrations || parseBoolean(env.ALLOW_CHANGED_MIGRATIONS, false),
    strictMigrationChecks,
    d1DatabaseName: resolveD1DatabaseName({
      explicitDbName: cli.dbName,
      envDbName: env.CLOUDFLARE_D1_DATABASE_NAME,
      wranglerConfig
    })
  };

  return runtime;
}

let runtime = null;

/**
 * Execute a wrangler command and return the result.
 *
 * IMPORTANT (Windows):
 * - Avoid shell-quoting problems by passing argv arrays.
 * - Invoke `npx` via cmd.exe to avoid Node spawn() EINVAL on .cmd shims.
 */
function wrangler(args, options = {}) {
  const remoteFlag = runtime.local ? '--local' : '--remote';
  const fullArgs = ['wrangler', ...args, '--config', runtime.wranglerConfigPath, remoteFlag];

  if (runtime.verbose) {
    const printable = ['npx', ...fullArgs]
      .map((part) => (String(part).includes(' ') ? `"${part}"` : String(part)))
      .join(' ');
    log(`  $ ${printable}`, 'dim');
  }

  if (runtime.dryRun && !options.allowInDryRun) {
    log('  [DRY RUN] Would execute wrangler command', 'yellow');
    return { success: true, output: '', dryRun: true };
  }

  const spawnOptions = {
    cwd: runtime.rootDir,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf-8'
  };

  const capture = !!options.capture;
  const stdio = capture ? ['ignore', 'pipe', 'pipe'] : 'inherit';

  // Use absolute path for npx via Node's directory to avoid PATH injection
  const npxPath = join(dirname(process.execPath), process.platform === 'win32' ? 'npx.cmd' : 'npx');

  // On Windows, .cmd shims need shell execution
  const result = process.platform === 'win32'
    ? spawnSync(process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', npxPath, ...fullArgs], { ...spawnOptions, stdio })
    : spawnSync(npxPath, fullArgs, { ...spawnOptions, stdio });

  if (result.status === 0) {
    return { success: true, output: capture ? (result.stdout || '') : '' };
  }

  return {
    success: false,
    output: capture ? (result.stdout || '') : '',
    error: capture
      ? (extractWranglerErrorMessage(result.stderr, result.stdout) || `wrangler exited with code ${result.status}`)
      : `wrangler exited with code ${result.status}`
  };
}

// Use object lookup to ensure only predefined commands can be resolved
const ALLOWED_COMMANDS = {
  npm: 'npm',
  npx: 'npx'
};

function spawnCommand(commandKey, args, options = {}) {
  const command = ALLOWED_COMMANDS[commandKey];
  if (!command) {
    throw new Error(`Command not allowed: ${commandKey}`);
  }

  const spawnOptions = {
    cwd: runtime.rootDir,
    stdio: 'inherit',
    ...options
  };

  return process.platform === 'win32'
    ? spawnSync(process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', command, ...args], spawnOptions)
    : spawnSync(command, args, spawnOptions);
}

function spawnCommandCapture(commandKey, args, options = {}) {
  const command = ALLOWED_COMMANDS[commandKey];
  if (!command) {
    throw new Error(`Command not allowed: ${commandKey}`);
  }

  const spawnOptions = {
    cwd: runtime.rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    ...options
  };

  const result = process.platform === 'win32'
    ? spawnSync(process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', command, ...args], spawnOptions)
    : spawnSync(command, args, spawnOptions);

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

export function isRetriableDeployError(output) {
  const normalized = String(output || '').toLowerCase();
  return [
    '502 bad gateway',
    '503 service unavailable',
    '504 gateway timeout',
    'received a malformed response from the api',
    'assets-upload-session',
    'temporarily unavailable',
    'fetch failed',
    'econnreset',
    'etimedout',
    'eai_again',
    'socket hang up'
  ].some((needle) => normalized.includes(needle));
}

/**
 * Execute a D1 SQL query and return results.
 */
function d1Query(sql, options = {}) {
  const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
  const result = wrangler([
    'd1',
    'execute',
    runtime.d1DatabaseName,
    '--command',
    normalizedSql,
    '--json'
  ], {
    capture: true,
    ...options
  });

  if (!result.success && runtime.verbose) {
    log(`  SQL Error: ${result.error}`, 'dim');
  }

  return result;
}

/**
 * Execute a migration file.
 */
function d1ExecuteFile(filePath) {
  return wrangler(['d1', 'execute', runtime.d1DatabaseName, '--file', filePath], {
    capture: true
  });
}

/**
 * Get list of migration files sorted by name.
 */
function getMigrationFiles() {
  return readdirSync(runtime.migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Calculate checksum of a migration file.
 */
function getFileChecksum(filename) {
  const filepath = join(runtime.migrationsDir, filename);
  const content = readFileSync(filepath, 'utf-8');
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Get list of already applied migrations from the database.
 */
async function getAppliedMigrations() {
  if (!runtime.dryRun) {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL,
        checksum TEXT
      )
    `;

    const createResult = d1Query(createTableSql);
    if (!createResult.success) {
      throw new Error(`Unable to prepare _migrations table: ${createResult.error || 'unknown error'}`);
    }
  }

  const queryResult = d1Query('SELECT name, checksum FROM _migrations', { allowInDryRun: true });

  if (queryResult.dryRun) {
    return new Map();
  }

  if (!queryResult.success) {
    if (runtime.dryRun) {
      if (isMissingMigrationsTableError(queryResult.error)) {
        logWarning('Dry-run did not find _migrations table; assuming no applied migrations.');
        return new Map();
      }
      logWarning('Dry-run could not query _migrations; assuming no applied migrations.');
      return new Map();
    }
    throw new Error(`Unable to read _migrations table: ${queryResult.error || 'unknown error'}`);
  }

  const applied = new Map();
  try {
    const output = String(queryResult.output || '').trim();
    if (!output) return applied;

    const parsed = JSON.parse(output);

    let rows = [];
    if (Array.isArray(parsed)) {
      if (Array.isArray(parsed[0]?.results)) rows = parsed[0].results;
      else rows = parsed;
    } else if (Array.isArray(parsed?.results)) {
      rows = parsed.results;
    } else if (Array.isArray(parsed?.result)) {
      rows = parsed.result;
    } else if (Array.isArray(parsed?.data)) {
      rows = parsed.data;
    }

    for (const row of rows) {
      if (!row?.name) continue;
      applied.set(row.name, row.checksum);
    }
  } catch (error) {
    throw new Error(`Could not parse migration list output: ${error.message}`);
  }

  return applied;
}

/**
 * Record a migration as applied.
 */
function recordMigration(name, checksum) {
  const now = Date.now();
  const sql = `INSERT INTO _migrations (name, applied_at, checksum) VALUES ('${name}', ${now}, '${checksum}')`;
  return d1Query(sql);
}

/**
 * Apply pending migrations.
 */
async function applyMigrations() {
  logStep('1/3', `Checking migration status (DB: ${runtime.d1DatabaseName})...`);

  const migrationFiles = getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();

  if (runtime.verbose) {
    log(`  Found ${migrationFiles.length} migration files`, 'dim');
    log(`  ${appliedMigrations.size} migrations already applied`, 'dim');
  }

  const pending = [];
  const changedMigrations = [];

  for (const file of migrationFiles) {
    const checksum = getFileChecksum(file);
    const existingChecksum = appliedMigrations.get(file);

    if (!existingChecksum) {
      pending.push({ file, checksum, status: 'new' });
    } else if (existingChecksum !== checksum) {
      changedMigrations.push({ file, expected: existingChecksum, current: checksum });
    }
  }

  const changedPolicy = evaluateChangedMigrations(changedMigrations, {
    strictMigrationChecks: runtime.strictMigrationChecks,
    allowChangedMigrations: runtime.allowChangedMigrations
  });

  if (changedMigrations.length > 0) {
    for (const changed of changedMigrations) {
      if (changedPolicy.level === 'error') {
        logError(`Migration ${changed.file} has changed since it was applied.`);
        logError(`  Expected checksum: ${changed.expected}`);
        logError(`  Current checksum:  ${changed.current}`);
      } else {
        logWarning(`Migration ${changed.file} has changed since it was applied.`);
        logWarning(`  Expected checksum: ${changed.expected}`);
        logWarning(`  Current checksum:  ${changed.current}`);
      }
    }

    if (!changedPolicy.ok) {
      logError('Changed migration files detected. Refusing to continue in strict mode.');
      logError('Create a new migration instead of editing applied files, or rerun with --allow-changed-migrations after review.');
      return false;
    }
  }

  if (pending.length === 0) {
    logSuccess('All migrations already applied');
    return true;
  }

  logStep('2/3', `Applying ${pending.length} pending migration(s)...`);

  for (const migration of pending) {
    const { file, checksum } = migration;
    log(`  Applying: ${file}`, 'blue');

    if (runtime.dryRun) {
      log('    [DRY RUN] Would apply migration', 'yellow');
      continue;
    }

    const filepath = join(runtime.migrationsDir, file);
    const executeResult = d1ExecuteFile(filepath);

    if (shouldTreatMigrationExecutionAsFailure(executeResult)) {
      logError(`Failed to apply migration: ${file}`);
      logError(`Error: ${executeResult.error || 'unknown execution error'}`);
      logError('No migration record was written. Fix the migration and rerun deploy.');
      return false;
    }

    const recordResult = recordMigration(file, checksum);
    if (!recordResult.success && !recordResult.dryRun) {
      logError(`Migration ${file} executed, but tracking record failed.`);
      logError(`Error: ${recordResult.error || 'unknown record error'}`);
      logError('Resolve _migrations table state before continuing to avoid drift.');
      return false;
    }

    logSuccess(`  Applied: ${file}`);
  }

  return true;
}

/**
 * Deploy the worker.
 */
function deployWorker() {
  logStep('3/3', 'Deploying worker...');

  if (runtime.dryRun) {
    log('  [DRY RUN] Would run: npm run build && wrangler deploy', 'yellow');
    return true;
  }

  log('  Building frontend...', 'dim');
  const buildResult = spawnCommand('npm', ['run', 'build'], {
    env: process.env
  });

  if (buildResult.status !== 0) {
    logError('Build failed');
    return false;
  }

  const maxAttempts = Math.max(1, Number.parseInt(process.env.DEPLOY_RETRY_ATTEMPTS || '3', 10) || 3);
  const maxDelayMs = Math.max(1000, Number.parseInt(process.env.DEPLOY_RETRY_MAX_DELAY_MS || '30000', 10) || 30000);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`  Deploying to Cloudflare Workers... (attempt ${attempt}/${maxAttempts})`, 'dim');
    const deployResult = spawnCommandCapture('npx', ['wrangler', 'deploy', '--config', runtime.wranglerConfigPath], {
      env: process.env
    });

    if (deployResult.stdout) {
      process.stdout.write(deployResult.stdout);
    }
    if (deployResult.stderr) {
      process.stderr.write(deployResult.stderr);
    }

    if (deployResult.status === 0) {
      return true;
    }

    const combinedOutput = `${deployResult.stdout}\n${deployResult.stderr}`;
    const shouldRetry = isRetriableDeployError(combinedOutput) && attempt < maxAttempts;

    if (!shouldRetry) {
      logError('Deployment failed');
      return false;
    }

    const delayMs = Math.min(maxDelayMs, 2000 * (2 ** (attempt - 1)));
    logWarning(`Transient deploy failure detected, retrying in ${Math.round(delayMs / 1000)}s...`);
    sleep(delayMs);
  }

  return true;
}

/**
 * Main entry point.
 */
export async function main(argv = process.argv.slice(2), env = process.env) {
  runtime = createRuntimeContext(argv, env);

  console.log('');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║           Tableu Deployment Script                         ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('');

  if (runtime.dryRun) {
    logWarning('DRY RUN MODE - No changes will be made\n');
  }

  if (runtime.local) {
    logWarning('LOCAL MODE - Operating on local D1 database\n');
  }

  if (runtime.allowChangedMigrations) {
    logWarning('Changed migration checks are overridden via --allow-changed-migrations / env flag.');
  } else if (runtime.strictMigrationChecks) {
    log('Strict migration checksum checks are enabled.', 'dim');
  }

  const migrationsOk = await applyMigrations();
  if (!migrationsOk) {
    logError('\nMigration failed! Aborting deployment.');
    process.exit(1);
  }

  if (runtime.migrationsOnly) {
    log('\n--migrations-only flag set, skipping deployment', 'dim');
  } else {
    console.log('');
    const deployOk = deployWorker();
    if (!deployOk) {
      logError('\nDeployment failed!');
      process.exit(1);
    }
  }

  console.log('');
  logSuccess('Deployment complete!');
  console.log('');
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectExecution) {
  main().catch((error) => {
    logError(`Unexpected error: ${error.message}`);
    if (runtime?.verbose) {
      console.error(error);
    }
    process.exit(1);
  });
}
