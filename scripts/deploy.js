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

import { execSync, spawnSync } from 'child_process';
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

/**
 * Execute a wrangler command and return the result
 */
function wrangler(command, options = {}) {
  const remoteFlag = LOCAL ? '--local' : '--remote';
  const fullCommand = `npx wrangler ${command} --config ${WRANGLER_CONFIG} ${remoteFlag}`;

  if (VERBOSE) {
    log(`  $ ${fullCommand}`, 'dim');
  }

  if (DRY_RUN && !options.allowInDryRun) {
    log(`  [DRY RUN] Would execute: ${fullCommand}`, 'yellow');
    return { success: true, output: '', dryRun: true };
  }

  try {
    const output = execSync(fullCommand, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: options.capture ? 'pipe' : ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    return { success: true, output: output || '' };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

/**
 * Execute a D1 SQL query and return results
 */
function d1Query(sql, options = {}) {
  // Escape the SQL for shell
  const escapedSql = sql.replace(/'/g, "'\\''");
  const result = wrangler(`d1 execute mystic-tarot-db --command '${escapedSql}'`, {
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
  const result = wrangler(`d1 execute mystic-tarot-db --file "${filePath}"`, {
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

  // Parse the output - wrangler d1 execute returns JSON-like output
  const applied = new Map();
  try {
    // Try to parse JSON output
    const output = queryResult.output;
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const rows = JSON.parse(jsonMatch[0]);
      for (const row of rows) {
        applied.set(row.name, row.checksum);
      }
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
  const buildResult = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: true
  });

  if (buildResult.status !== 0) {
    logError('Build failed');
    return false;
  }

  // Deploy
  log('  Deploying to Cloudflare Workers...', 'dim');
  const deployResult = spawnSync('npx', ['wrangler', 'deploy', '--config', WRANGLER_CONFIG], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: true
  });

  if (deployResult.status !== 0) {
    logError('Deployment failed');
    return false;
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
