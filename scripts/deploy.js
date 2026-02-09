#!/usr/bin/env node
/**
 * Deployment Script with Migration Support
 *
 * This script ensures D1 migrations are applied before deploying the worker.
 * It tracks applied migrations in a _migrations table to prevent re-application.
 *
 * Usage:
 *   node scripts/deploy.js                    # Apply migrations + deploy
 *   node scripts/deploy.js --migrations-only  # Only apply migrations
 *   node scripts/deploy.js --dry-run          # Show what would be done
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN - Required for remote operations
 *   CLOUDFLARE_ACCOUNT_ID - Optional (uses wrangler.jsonc if not set)
 *
 * CI Usage:
 *   This script exits with code 0 on success, non-zero on failure.
 *   Migration failures are fatal and will abort deployment.
 */

import { spawnSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT_DIR, 'migrations');
const WRANGLER_CONFIG = join(ROOT_DIR, 'wrangler.jsonc');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MIGRATIONS_ONLY = args.includes('--migrations-only');
const LOCAL = args.includes('--local');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

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

/**
 * Execute a wrangler command and return the result.
 *
 * IMPORTANT (Windows):
 * - Avoid shell-quoting problems by passing argv arrays.
 * - Invoke `npx` via cmd.exe to avoid Node spawn() EINVAL on .cmd shims.
 */
function wrangler(args, options = {}) {
  const remoteFlag = LOCAL ? '--local' : '--remote';
  const fullArgs = ['wrangler', ...args, '--config', WRANGLER_CONFIG, remoteFlag];

  if (VERBOSE) {
    const printable = ['npx', ...fullArgs]
      .map((part) => (String(part).includes(' ') ? `"${part}"` : String(part)))
      .join(' ');
    log(`  $ ${printable}`, 'dim');
  }

  if (DRY_RUN && !options.allowInDryRun) {
    log('  [DRY RUN] Would execute wrangler command', 'yellow');
    return { success: true, output: '', dryRun: true };
  }

  const spawnOptions = {
    cwd: ROOT_DIR,
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
    error: capture ? (result.stderr || `wrangler exited with code ${result.status}`) : `wrangler exited with code ${result.status}`
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
    cwd: ROOT_DIR,
    stdio: 'inherit',
    ...options
  };

  // Use COMSPEC with fallback to absolute path for Windows
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
    cwd: ROOT_DIR,
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

function isRetriableDeployError(output) {
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
 * Execute a D1 SQL query and return results
 */
function d1Query(sql, options = {}) {
  // Pass SQL as an argv value to avoid platform-specific shell quoting.
  const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
  // `--json` makes output parseable across platforms.
  const result = wrangler(['d1', 'execute', 'mystic-tarot-db', '--command', normalizedSql, '--json'], {
    capture: true,
    ...options
  });

  if (!result.success && VERBOSE) {
    log(`  SQL Error: ${result.error}`, 'dim');
  }

  return result;
}

/**
 * Execute a migration file
 */
function d1ExecuteFile(filePath) {
  const result = wrangler(['d1', 'execute', 'mystic-tarot-db', '--file', filePath], {
    capture: true
  });
  return result;
}

/**
 * Get list of migration files sorted by name
 */
function getMigrationFiles() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files;
}

/**
 * Calculate checksum of a migration file
 */
function getFileChecksum(filename) {
  const filepath = join(MIGRATIONS_DIR, filename);
  const content = readFileSync(filepath, 'utf-8');
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Get list of already applied migrations from the database
 */
async function getAppliedMigrations() {
  // First ensure the _migrations table exists
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL,
      checksum TEXT
    )
  `;

  const createResult = d1Query(createTableSql, { allowInDryRun: true });
  if (!createResult.success && !createResult.dryRun) {
    // Table might already exist with different structure, try to continue
    if (VERBOSE) {
      logWarning('Could not create _migrations table (may already exist)');
    }
  }

  // Query existing migrations
  const queryResult = d1Query('SELECT name, checksum FROM _migrations', { allowInDryRun: true });

  if (queryResult.dryRun) {
    return new Map();
  }

  if (!queryResult.success) {
    // Table might not exist yet, return empty
    return new Map();
  }

  // Parse the output - we request `--json` for a stable shape.
  const applied = new Map();
  try {
    const output = String(queryResult.output || '').trim();
    if (!output) return applied;

    const parsed = JSON.parse(output);

    // Wrangler --json shape for D1 execute is usually:
    //   [ { results: [ {col: val, ...}, ... ], success: true, meta: {...} } ]
    // But we also support other shapes defensively.
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
  } catch (e) {
    // If parsing fails, assume no migrations applied
    if (VERBOSE) {
      log(`  Could not parse migration list: ${e.message}`, 'dim');
    }
  }

  return applied;
}

/**
 * Record a migration as applied
 */
function recordMigration(name, checksum) {
  const now = Date.now();
  const sql = `INSERT INTO _migrations (name, applied_at, checksum) VALUES ('${name}', ${now}, '${checksum}')`;
  return d1Query(sql);
}

/**
 * Apply pending migrations
 */
async function applyMigrations() {
  logStep('1/3', 'Checking migration status...');

  const migrationFiles = getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();

  if (VERBOSE) {
    log(`  Found ${migrationFiles.length} migration files`, 'dim');
    log(`  ${appliedMigrations.size} migrations already applied`, 'dim');
  }

  // Determine which migrations need to be applied
  const pending = [];
  for (const file of migrationFiles) {
    const checksum = getFileChecksum(file);
    const existingChecksum = appliedMigrations.get(file);

    if (!existingChecksum) {
      pending.push({ file, checksum, status: 'new' });
    } else if (existingChecksum !== checksum) {
      logWarning(`Migration ${file} has changed since it was applied!`);
      logWarning(`  Expected checksum: ${existingChecksum}`);
      logWarning(`  Current checksum:  ${checksum}`);
      // Don't re-apply changed migrations, just warn
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

    if (DRY_RUN) {
      log(`    [DRY RUN] Would apply migration`, 'yellow');
      continue;
    }

    const filepath = join(MIGRATIONS_DIR, file);
    const result = d1ExecuteFile(filepath);

    if (!result.success) {
      // Check if it's a "column already exists" type error (migration was partially applied)
      const errorLower = (result.error || '').toLowerCase();
      const isAlreadyExists =
        errorLower.includes('already exists') ||
        errorLower.includes('duplicate column');

      if (isAlreadyExists) {
        logWarning(`  Migration ${file} appears to be partially applied, recording as complete`);
      } else {
        logError(`Failed to apply migration: ${file}`);
        logError(`Error: ${result.error}`);
        return false;
      }
    }

    // Record the migration
    const recordResult = recordMigration(file, checksum);
    if (!recordResult.success && !recordResult.dryRun) {
      logWarning(`  Could not record migration ${file} in tracking table`);
    }

    logSuccess(`  Applied: ${file}`);
  }

  return true;
}

/**
 * Deploy the worker
 */
function deployWorker() {
  logStep('3/3', 'Deploying worker...');

  if (DRY_RUN) {
    log('  [DRY RUN] Would run: npm run build && wrangler deploy', 'yellow');
    return true;
  }

  // Build first
  log('  Building frontend...', 'dim');
  const buildResult = spawnCommand('npm', ['run', 'build'], {
    env: process.env
  });

  if (buildResult.status !== 0) {
    logError('Build failed');
    return false;
  }

  // Deploy
  const maxAttempts = Math.max(1, Number.parseInt(process.env.DEPLOY_RETRY_ATTEMPTS || '3', 10) || 3);
  const maxDelayMs = Math.max(1000, Number.parseInt(process.env.DEPLOY_RETRY_MAX_DELAY_MS || '30000', 10) || 30000);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`  Deploying to Cloudflare Workers... (attempt ${attempt}/${maxAttempts})`, 'dim');
    const deployResult = spawnCommandCapture('npx', ['wrangler', 'deploy', '--config', WRANGLER_CONFIG], {
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
 * Main entry point
 */
async function main() {
  console.log('');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║           Tableu Deployment Script                         ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  console.log('');

  if (DRY_RUN) {
    logWarning('DRY RUN MODE - No changes will be made\n');
  }

  if (LOCAL) {
    logWarning('LOCAL MODE - Operating on local D1 database\n');
  }

  // Step 1 & 2: Apply migrations
  const migrationsOk = await applyMigrations();
  if (!migrationsOk) {
    logError('\nMigration failed! Aborting deployment.');
    process.exit(1);
  }

  // Step 3: Deploy (unless --migrations-only)
  if (MIGRATIONS_ONLY) {
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

main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  if (VERBOSE) {
    console.error(error);
  }
  process.exit(1);
});
