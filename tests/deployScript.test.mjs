import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCliArgs,
  stripJsonComments,
  stripTrailingCommas,
  parseJsoncConfig,
  resolveD1DatabaseName,
  evaluateChangedMigrations,
  shouldTreatMigrationExecutionAsFailure,
  isMissingMigrationsTableError,
  isRetriableDeployError
} from '../scripts/deploy.js';

test('parseCliArgs parses db-name and strict flags', () => {
  const args = parseCliArgs([
    '--migrations-only',
    '--strict-migration-checks',
    '--db-name',
    'custom-db',
    '--verbose'
  ]);

  assert.equal(args.migrationsOnly, true);
  assert.equal(args.strictMigrationChecks, true);
  assert.equal(args.dbName, 'custom-db');
  assert.equal(args.verbose, true);
});

test('stripJsonComments preserves URL values and removes JSONC comments', () => {
  const input = `{
    // single-line comment
    "url": "https://example.com/path",
    "d1_databases": [
      { "binding": "DB", "database_name": "tarot-db" } /* inline comment */
    ]
  }`;

  const stripped = stripJsonComments(input);
  assert.equal(stripped.includes('single-line comment'), false);
  assert.equal(stripped.includes('inline comment'), false);
  assert.equal(stripped.includes('https://example.com/path'), true);
});

test('parseJsoncConfig parses wrangler-like JSONC', () => {
  const content = `{
    "name": "tableau",
    // comment
    "d1_databases": [{ "binding": "DB", "database_name": "mystic-tarot-db" }]
  }`;

  const parsed = parseJsoncConfig(content);
  assert.equal(parsed.name, 'tableau');
  assert.equal(parsed.d1_databases[0].database_name, 'mystic-tarot-db');
});

test('stripTrailingCommas removes object/array trailing commas but preserves commas in strings', () => {
  const input = `{
    "name": "tableau, tarot",
    "vars": {
      "ENABLE_DEBUG_ROUTES": "false",
    },
    "d1_databases": [
      { "binding": "DB", "database_name": "mystic-tarot-db", },
    ],
  }`;

  const stripped = stripTrailingCommas(input);
  assert.equal(stripped.includes('"tableau, tarot"'), true);
  assert.equal(stripped.includes(',\n    },'), false);
  assert.equal(stripped.includes(',\n    ],'), false);
});

test('parseJsoncConfig accepts trailing commas', () => {
  const content = `{
    "name": "tableau",
    "vars": {
      "ENABLE_DEBUG_ROUTES": "false",
    },
    "d1_databases": [
      { "binding": "DB", "database_name": "mystic-tarot-db", },
    ],
  }`;

  const parsed = parseJsoncConfig(content);
  assert.equal(parsed.name, 'tableau');
  assert.equal(parsed.vars.ENABLE_DEBUG_ROUTES, 'false');
  assert.equal(parsed.d1_databases[0].database_name, 'mystic-tarot-db');
});

test('resolveD1DatabaseName prefers explicit arg, then env, then DB binding', () => {
  const wranglerConfig = {
    d1_databases: [
      { binding: 'ANALYTICS', database_name: 'analytics-db' },
      { binding: 'DB', database_name: 'primary-db' }
    ]
  };

  assert.equal(resolveD1DatabaseName({ explicitDbName: 'cli-db', envDbName: 'env-db', wranglerConfig }), 'cli-db');
  assert.equal(resolveD1DatabaseName({ explicitDbName: '', envDbName: 'env-db', wranglerConfig }), 'env-db');
  assert.equal(resolveD1DatabaseName({ explicitDbName: '', envDbName: '', wranglerConfig }), 'primary-db');
});

test('evaluateChangedMigrations enforces strict mode and supports override', () => {
  const changed = [{ file: '0001_initial_schema.sql' }];

  const strictPolicy = evaluateChangedMigrations(changed, {
    strictMigrationChecks: true,
    allowChangedMigrations: false
  });
  assert.equal(strictPolicy.ok, false);
  assert.equal(strictPolicy.level, 'error');

  const overridePolicy = evaluateChangedMigrations(changed, {
    strictMigrationChecks: true,
    allowChangedMigrations: true
  });
  assert.equal(overridePolicy.ok, true);
  assert.equal(overridePolicy.level, 'warn');
});

test('migration execution failures stay fatal even with already-exists messages', () => {
  assert.equal(shouldTreatMigrationExecutionAsFailure({ success: true }), false);
  assert.equal(
    shouldTreatMigrationExecutionAsFailure({
      success: false,
      error: 'duplicate column name: foo already exists'
    }),
    true
  );
});

test('isMissingMigrationsTableError detects expected sqlite/d1 variants', () => {
  assert.equal(isMissingMigrationsTableError('Error: no such table: _migrations'), true);
  assert.equal(isMissingMigrationsTableError('D1_ERROR: table _migrations does not exist'), true);
  assert.equal(isMissingMigrationsTableError('permission denied'), false);
});

test('isRetriableDeployError classifies transient deploy failures', () => {
  assert.equal(isRetriableDeployError('503 Service Unavailable from API'), true);
  assert.equal(isRetriableDeployError('validation error: missing binding'), false);
});
