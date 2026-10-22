import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { KV_SCHEMA_SQL } from '../spacefast/bindings/kv.js';
import { READING_JOBS_SCHEMA } from '../spacefast/jobs/store.js';
import { RUNTIME_CANARY_SCHEMA } from '../spacefast/canary.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Fail a build when Cloudflare's schema changed without a reviewed native port. */
export async function verifySpacefastSchemaSources() {
  const fingerprints = JSON.parse(await readFile(path.join(root, 'spacefast/migrations/source-fingerprints.json'), 'utf8'));
  const names = (await readdir(path.join(root, 'migrations'))).filter(name => name.endsWith('.sql')).sort();
  if (names.join('\n') !== Object.keys(fingerprints).sort().join('\n')) throw new Error('Spacefast database migration inventory needs review');
  for (const name of names) {
    const digest = createHash('sha256').update(await readFile(path.join(root, 'migrations', name))).digest('hex');
    if (digest !== fingerprints[name]) throw new Error(`Spacefast database port needs review for migration ${name}`);
  }
}

export async function loadSpacefastMigrations() {
  await verifySpacefastSchemaSources();
  const names = (await readdir(path.join(root, 'spacefast/migrations'))).filter(name => name.endsWith('.sql') && name !== '0005_native_bindings.sql').sort();
  const migrations = await Promise.all(names.map(async name => ({ name, sql: await readFile(path.join(root, 'spacefast/migrations', name), 'utf8') })));
  migrations.push({ name: '0005_native_bindings.sql', sql: `${KV_SCHEMA_SQL};\n${READING_JOBS_SCHEMA};\n${RUNTIME_CANARY_SCHEMA};\n` });
  return migrations;
}

// The build hook materializes binding schemas beside the reviewed MySQL port;
// Wrangler's migrations_dir then carries these statements into the artifact.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const migrations = await loadSpacefastMigrations();
  const bindingMigration = migrations.at(-1);
  await writeFile(path.join(root, 'spacefast/migrations', bindingMigration.name), bindingMigration.sql);
  console.log(`Prepared ${migrations.length} native MySQL migrations.`);
}
