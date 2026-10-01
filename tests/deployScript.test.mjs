import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  parseCliArgs,
  stripJsonComments,
  stripTrailingCommas,
  parseJsoncConfig,
  resolveD1DatabaseName,
  evaluateChangedMigrations,
  getMigrationChecksum,
  findMigrationChanges,
  REVIEWED_MIGRATION_CHECKSUMS,
  shouldTreatMigrationExecutionAsFailure,
  isMissingMigrationsTableError,
  extractWranglerErrorMessage,
  isRetriableDeployError
} from '../scripts/deploy.js';

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);

// `SELECT name, checksum FROM _migrations` on production D1, 2026-10-01.
// 0000–0014 were recorded from a CRLF checkout; 0010_add_user_tokens, 0020 and
// 0021 were recorded before the edits listed in REVIEWED_MIGRATION_CHECKSUMS.
const PRODUCTION_MIGRATION_CHECKSUMS = Object.freeze({
  '0000_migration_tracking.sql': 'f87567e3c86ec16c',
  '0001_initial_schema.sql': 'b3335f728dd0d22f',
  '0002_add_auth_and_journals.sql': '78d42761a7a9b66f',
  '0003_add_share_tables.sql': '75e5d93cb3557c72',
  '0004_add_api_keys.sql': 'cadc52b86c53c329',
  '0005_add_archetype_journey.sql': 'de292ebea867d636',
  '0006_add_user_preferences.sql': 'e6534d4f9511bba4',
  '0007_add_request_id_and_dedup_index.sql': 'f311c87531244813',
  '0008_add_subscriptions.sql': '18f2f6bdb99a16a0',
  '0009_add_deck_id.sql': '87d9406c9aa8789d',
  '0010_add_coach_extraction.sql': '9d1661074641f19e',
  '0010_add_user_tokens.sql': '677f08698d36d411',
  '0011_add_usage_tracking.sql': '9615304b43c8c958',
  '0012_add_webhook_idempotency.sql': 'f0e996a767afa88a',
  '0013_add_pattern_tracking.sql': '828a1dc468e62872',
  '0014_add_archive_tables.sql': '21d244bcdc0e1e6a',
  '0015_add_quality_tracking.sql': 'c0a4ed8860417db5',
  '0015_eval_metrics.sql': '72005826f3750356',
  '0016_add_journal_location.sql': '30c1633a4cdf1c89',
  '0016_eval_metrics_hallucinations.sql': 'f145800212bb8b90',
  '0017_add_follow_up_usage.sql': 'feb76648f929d45a',
  '0018_add_journal_followups.sql': '5d807cc7c54d755d',
  '0019_add_user_memories.sql': '0e47515ca321d986',
  '0020_add_user_preferences.sql': 'afacf18dac558a7c',
  '0021_add_journal_followups_cleanup_trigger.sql': '022207ccf5f781f6',
  '0022_fix_quality_stats_null_uniqueness.sql': '37e74af7a77aa21e',
  '0023_add_follow_up_reservation_updated_at.sql': 'd6a6b2860861b4e0',
  '0024_add_user_tokens.sql': '992d9865a295331c',
  '0025_add_oauth_identities.sql': 'cda6878a4a042e97',
  '0026_add_pattern_tracking_failures.sql': '159fe21ccd64dd44',
  '0027_add_share_note_reports.sql': '4524ee65e0b6d628',
  '0028_add_user_media.sql': 'b4d4a6c9d69fc8e0',
  '0029_add_journal_followups_canonical_answer.sql': '6e49edb45106dcb7',
  '0030_add_journal_idempotency_key.sql': '34c8f80a893ccc34',
  '0031_add_oauth_registration_counters.sql': '8c6ea3f848a00099',
  '0032_add_journal_source_usage.sql': 'a082cbfd29855794'
});

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

test('getMigrationChecksum ignores line endings', () => {
  const lf = 'CREATE TABLE t (id TEXT);\nCREATE INDEX i ON t(id);\n';
  assert.equal(getMigrationChecksum(lf.replace(/\n/g, '\r\n')), getMigrationChecksum(lf));
  assert.notEqual(getMigrationChecksum(`${lf}-- edit\n`), getMigrationChecksum(lf));
});

test('findMigrationChanges accepts checksums recorded from LF or CRLF checkouts', () => {
  const lf = 'CREATE TABLE t (id TEXT);\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  // Earlier deploys hashed the file bytes as checked out, without normalizing.
  const rawChecksum = (text) => createHash('sha256').update(text).digest('hex').substring(0, 16);
  const applied = new Map([
    ['0001_a.sql', rawChecksum(lf)],
    ['0002_b.sql', rawChecksum(crlf)]
  ]);

  for (const content of [lf, crlf]) {
    const result = findMigrationChanges([...applied.keys()], applied, () => content, {});
    assert.deepEqual(result, { pending: [], changedMigrations: [] });
  }
});

test('findMigrationChanges reports edited and new migrations', () => {
  const original = 'ALTER TABLE users ADD COLUMN a TEXT;\n';
  const edited = 'ALTER TABLE users ADD COLUMN b TEXT;\n';
  const files = { '0001_a.sql': edited, '0002_new.sql': original.replace(/\n/g, '\r\n') };
  const applied = new Map([['0001_a.sql', getMigrationChecksum(original)]]);

  const result = findMigrationChanges(Object.keys(files), applied, (file) => files[file], {});
  assert.deepEqual(result.changedMigrations, [{
    file: '0001_a.sql',
    expected: getMigrationChecksum(original),
    current: getMigrationChecksum(edited)
  }]);
  assert.deepEqual(result.pending, [{
    file: '0002_new.sql',
    checksum: getMigrationChecksum(original),
    status: 'new'
  }]);
});

test('findMigrationChanges accepts a reviewed checksum only for its own file', () => {
  const files = { '0001_a.sql': 'SELECT 1;\n', '0002_b.sql': 'SELECT 2;\n' };
  const reviewed = { '0001_a.sql': '0123456789abcdef' };

  const accepted = findMigrationChanges(
    ['0001_a.sql'],
    new Map([['0001_a.sql', '0123456789abcdef']]),
    (file) => files[file],
    reviewed
  );
  assert.deepEqual(accepted.changedMigrations, []);

  const otherValue = findMigrationChanges(
    ['0001_a.sql'],
    new Map([['0001_a.sql', 'fedcba9876543210']]),
    (file) => files[file],
    reviewed
  );
  assert.equal(otherValue.changedMigrations.length, 1);

  const otherFile = findMigrationChanges(
    ['0002_b.sql'],
    new Map([['0002_b.sql', '0123456789abcdef']]),
    (file) => files[file],
    reviewed
  );
  assert.equal(otherFile.changedMigrations.length, 1);
});

test('production migration checksums all match the checked-in migrations', () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();
  const applied = new Map(Object.entries(PRODUCTION_MIGRATION_CHECKSUMS));
  const readMigration = (file) => readFileSync(new URL(file, MIGRATIONS_DIR), 'utf-8');

  const { changedMigrations } = findMigrationChanges(files, applied, readMigration);
  assert.deepEqual(changedMigrations, []);
});

test('reviewed migration checksums name existing files whose text has since changed', () => {
  for (const [file, checksum] of Object.entries(REVIEWED_MIGRATION_CHECKSUMS)) {
    const url = new URL(file, MIGRATIONS_DIR);
    assert.ok(existsSync(url), `${file} should exist`);
    const content = readFileSync(url, 'utf-8');
    const { changedMigrations } = findMigrationChanges([file], new Map([[file, checksum]]), () => content, {});
    assert.equal(changedMigrations.length, 1, `${file} no longer needs a reviewed checksum`);
  }
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

test('extractWranglerErrorMessage prefers stderr and parses JSON stdout payloads', () => {
  assert.equal(
    extractWranglerErrorMessage('permission denied', ''),
    'permission denied'
  );

  const wranglerJsonError = JSON.stringify({
    error: {
      text: "Couldn't find DB with name 'does-not-exist'",
      notes: [{ text: 'Authentication error [code: 10000]' }]
    }
  });

  assert.equal(
    extractWranglerErrorMessage('', wranglerJsonError),
    "Couldn't find DB with name 'does-not-exist' Authentication error [code: 10000]"
  );

  assert.equal(
    extractWranglerErrorMessage('', 'plain fallback error'),
    'plain fallback error'
  );
});

test('isRetriableDeployError classifies transient deploy failures', () => {
  assert.equal(isRetriableDeployError('503 Service Unavailable from API'), true);
  assert.equal(isRetriableDeployError('validation error: missing binding'), false);
});
