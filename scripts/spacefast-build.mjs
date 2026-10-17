import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
import { parse } from 'jsonc-parser';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadSpacefastMigrations } from './spacefast-database-migrations.mjs';
import { auditApplicationSql } from './spacefast-database-audit.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist-spacefast');
const config = parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
const migrations = await loadSpacefastMigrations();
const sqlAudit = await auditApplicationSql();
if (sqlAudit.unresolved.length || sqlAudit.failures.length) throw new Error('Spacefast application SQL inventory needs review; run scripts/spacefast-database-audit.mjs');
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

await viteBuild({ root, define: { 'import.meta.env.VITE_READING_MODEL_ANNOTATIONS': JSON.stringify('false') } });
await rm(output, { recursive: true, force: true });
await cp(resolve(root, 'dist'), output, { recursive: true });
await mkdir(resolve(output, '.server'), { recursive: true });
await mkdir(resolve(output, '.server/migrations'), { recursive: true });
for (const migration of migrations) await writeFile(resolve(output, '.server/migrations', migration.name), migration.sql);
const html = await readFile(resolve(output, 'index.html'), 'utf8');
const result = await bundle({
  absWorkingDir: root,
  entryPoints: ['spacefast/entry.js'],
  outfile: resolve(output, '.server/handler.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  metafile: true,
  external: ['cloudflare:*', 'node:*'],
  plugins: [{
    name: 'tableu-spacefast-build',
    setup(builder) {
      builder.onResolve({ filter: /^tableu:spacefast-build$/ }, () => ({ path: 'build', namespace: 'tableu' }));
      builder.onLoad({ filter: /.*/, namespace: 'tableu' }, () => ({
        contents: `export const html=${JSON.stringify(html)};export const defaults=${JSON.stringify(config.vars || {})};export const revision=${JSON.stringify(revision)};`,
        loader: 'js',
      }));
    },
  }],
});
await writeFile(resolve(output, 'sf.jsonc'), `${JSON.stringify({
  $schema: 'https://spacefast.com/schemas/sf.json',
  // The supported Worker profile below declares main and nodejs_compat.
  // Spacefast 0.5's explicit runtime.entry path drops that profile's flags.
  runtime: { kind: 'functions', compatibilityDate: '2026-07-01' },
  fallback: { path: 'index.html', status: 200 },
  cleanUrls: false,
  listing: false,
  ...(process.env.TABLEU_CRONS_ENABLED === 'true' ? { crons: [
    { path: '/api/maintenance/spacefast/daily/{{ vars.TABLEU_CRON_SECRET }}', schedule: '0 3 * * *' },
  ] } : {}),
}, null, 2)}\n`);
// This is a supported Functions profile, distinct from the source project's
// Cloudflare deployment: no automatic binding or asset-routing conversion.
await writeFile(resolve(output, 'wrangler.jsonc'), `${JSON.stringify({
  name: 'tableu-spacefast',
  main: '.server/handler.mjs',
  compatibility_date: '2026-07-01',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: [{ binding: 'DB', database_name: 'tableu-spacefast', migrations_dir: '.server/migrations' }],
}, null, 2)}\n`);
await mkdir(resolve(root, 'output/spacefast'), { recursive: true });
await writeFile(resolve(root, 'output/spacefast/build-metafile.json'), `${JSON.stringify(result.metafile, null, 2)}\n`);
console.log(`Spacefast artifact: ${output}`);
