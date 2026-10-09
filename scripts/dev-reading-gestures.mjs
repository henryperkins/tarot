#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { hashPassword } from '../functions/lib/auth.js';
import { createClaudeCodeServer } from '../services/claude-code/server.mjs';
import { buildSubscriptionEnv, runClaudeCode, verifySubscriptionLogin } from '../services/claude-code/runner.mjs';
import { parseJsoncConfig } from './deploy.js';
import { developmentConfig, developmentEnvironment, developmentPaths, FRONTEND_PORT,
  GATEWAY_PORT, localMigrationArguments, parseDevelopmentOptions, resolveDevelopmentOwner, validateLocalReviewer, VISUAL_MODEL,
  workerArguments, WORKER_PORT } from './lib/readingGesturesDev.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const credentialPath = path.join(os.homedir(), '.config/tableu/agent-reviewer.local.json');

async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${port} is occupied; stop its existing service explicitly before starting this beta.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

async function waitFor(url, child, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('A development service exited before becoming ready. Check its private log.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.status < 500) return;
    } catch { /* The child is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('A development service did not become ready. Check its private log.');
}

async function seedReviewer(paths, credentials, config, ownerEmail) {
  // A database-only proxy avoids constructing unrelated AI/DO bindings during seeding.
  const seedConfig = path.join(paths.directory, 'seed.wrangler.json');
  await writeFile(seedConfig, JSON.stringify({ name: config.name,
    compatibility_date: config.compatibility_date, d1_databases: config.d1_databases }), { mode: 0o600 });
  const proxy = await getPlatformProxy({ configPath: seedConfig, envFiles: [],
    persist: { path: path.join(paths.state, 'v3') }, remoteBindings: false });
  try {
    const { hash, salt } = await hashPassword(credentials.password);
    const now = Math.floor(Date.now() / 1000);
    // Values stay in the parameterized local binding, never CLI arguments or SQL files.
    await proxy.env.DB.prepare(`INSERT INTO users
      (id, email, username, password_hash, password_salt, created_at, updated_at,
       is_active, email_verified, subscription_tier, subscription_status, auth_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 'pro', 'active', 'password')
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, username=excluded.username,
       password_hash=excluded.password_hash, password_salt=excluded.password_salt,
       updated_at=excluded.updated_at, is_active=1, email_verified=1,
       subscription_tier='pro', subscription_status='active', auth_provider='password'`)
      .bind(credentials.userId, credentials.email, credentials.username, hash, salt, now, now).run();
    return await resolveDevelopmentOwner(proxy.env.DB, ownerEmail, credentials.userId);
  } finally { await proxy.dispose(); await rm(seedConfig, { force: true }); }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseDevelopmentOptions(argv);
  const prefix = 'CLAUDE_CODE';
  const credentials = validateLocalReviewer(JSON.parse(await readFile(credentialPath, 'utf8')));
  const hostEnv = { ...buildSubscriptionEnv(process.env),
    CLAUDE_CODE_MODEL: 'claude-opus-5-5', CLAUDE_CODE_EFFORT: 'xhigh' };
  await verifySubscriptionLogin({ hostEnv, signal: AbortSignal.timeout(30000) });
  const base = parseJsoncConfig(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
  const config = developmentConfig(base, { root, ownerUserId: credentials.userId,
    provider: options.provider, accountId: process.env.CLOUDFLARE_ACCOUNT_ID });
  if (!config.account_id) throw new Error('A Cloudflare account is required for the independent visual model.');
  if (options.check) {
    console.log('Subscription login and local reviewer prerequisites passed. No inference or database changes were made.');
    if (options.ownerEmail) console.log('The selected owner account will be resolved in the isolated database at startup.');
    console.log(`Visual candidate: ${VISUAL_MODEL}. Its live access and cue quality still need verification.`);
    return;
  }
  for (const port of [WORKER_PORT, FRONTEND_PORT, GATEWAY_PORT, 9235]) await requireFreePort(port);

  const paths = developmentPaths(root);
  for (const directory of [paths.directory, paths.logs, paths.state]) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
  }
  const token = randomBytes(32).toString('hex');
  await writeFile(paths.config, JSON.stringify(config, null, 2), { mode: 0o600 });
  await writeFile(paths.vars, `${prefix}_GATEWAY_TOKEN=${token}\n`, { mode: 0o600 });
  await chmod(paths.vars, 0o600);
  await writeFile(paths.frontendConfig, `import base from ${JSON.stringify(pathToFileURL(path.join(root, 'vite.config.js')).href)};\nimport { developmentViteConfig } from ${JSON.stringify(pathToFileURL(path.join(root, 'scripts/lib/readingGesturesDev.mjs')).href)};\nexport default developmentViteConfig(base, { privateDirectory: ${JSON.stringify(paths.directory)} });\n`, { mode: 0o600 });

  const children = new Set();
  const logs = new Set();
  let gateway;
  let stopping = false;
  let finish;
  const stopped = new Promise(resolve => { finish = resolve; });
  const stop = async () => {
    if (stopping) return stopped;
    stopping = true;
    for (const child of children) {
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already stopped. */ }
    }
    await gateway?.shutdown();
    await Promise.all([...children].map(child => new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timer = setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already stopped. */ }
      }, 1500);
      child.once('close', () => { clearTimeout(timer); resolve(); });
    })));
    for (const log of logs) log.end();
    await rm(paths.vars, { force: true });
    finish();
  };
  const onSignal = () => { void stop(); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  const launch = (script, args, name, environment, cwd = paths.directory) => {
    const log = createWriteStream(path.join(paths.logs, `${name}.log`), { flags: 'a', mode: 0o600 });
    logs.add(log);
    const child = spawn(process.execPath, [script, ...args], { cwd,
      env: environment, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    children.add(child);
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.once('error', () => { process.exitCode = 1; void stop(); });
    return child;
  };
  const workerEnv = developmentEnvironment();
  const frontendEnv = developmentEnvironment(process.env, { frontend: true });
  const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
  const vite = path.join(root, 'node_modules/vite/bin/vite.js');
  try {
    console.log('Preparing isolated local D1 migrations and reviewer account…');
    const migration = launch(wrangler, localMigrationArguments(paths), 'migrations', workerEnv);
    const migrationCode = await new Promise(resolve => migration.once('close', resolve));
    children.delete(migration);
    if (stopping) return;
    if (migrationCode !== 0) throw new Error('Local migrations failed. Check the private migrations.log; no remote database was touched.');
    const ownerUserId = await seedReviewer(paths, credentials, config, options.ownerEmail);
    config.vars[`${prefix}_OWNER_USER_ID`] = ownerUserId;
    await writeFile(paths.config, JSON.stringify(config, null, 2), { mode: 0o600 });
    if (stopping) return;
    console.log('Building local Worker assets…');
    const build = launch(vite, ['build', root, '--config', paths.frontendConfig], 'build', frontendEnv, root);
    const buildCode = await new Promise(resolve => build.once('close', resolve));
    children.delete(build);
    if (stopping) return;
    if (buildCode !== 0) throw new Error('Local asset build failed. Check the private build.log.');

    // Only the sanitized, subscription-authenticated environment reaches inference.
    gateway = createClaudeCodeServer({ token,
      run: (input, requestOptions) => runClaudeCode(input, { ...requestOptions, hostEnv }) });
    const gatewayCounts = new Map();
    gateway.on('request', (request, response) => {
      // Bounded diagnostic vocabulary: never print URLs, headers or request bodies.
      const method = ['GET', 'POST'].includes(request.method) ? request.method : 'other';
      const route = ['/healthz', '/v1/generate'].includes(request.url) ? request.url : 'other';
      const key = `${method} ${route}`;
      const count = (gatewayCounts.get(key) || 0) + 1;
      gatewayCounts.set(key, count);
      console.log(`${options.provider} gateway: ${key}, request ${count}`);
      response.once('finish', () => console.log(`${options.provider} gateway: ${key}, status ${response.statusCode}`));
    });
    await new Promise((resolve, reject) => {
      gateway.once('error', reject);
      gateway.listen(GATEWAY_PORT, '127.0.0.1', resolve);
    });
    const worker = launch(wrangler, workerArguments(paths), 'worker', workerEnv);
    worker.once('close', () => { if (!stopping) { process.exitCode = 1; void stop(); } });
    await waitFor(`http://127.0.0.1:${WORKER_PORT}/api/auth/me`, worker);
    const frontend = launch(vite, [root, '--config', paths.frontendConfig], 'frontend', frontendEnv, root);
    frontend.once('close', () => { if (!stopping) { process.exitCode = 1; void stop(); } });
    await waitFor(`http://127.0.0.1:${FRONTEND_PORT}/`, frontend);
    console.log(`Reading gestures beta: http://localhost:${FRONTEND_PORT}/`);
    console.log(`Real local login/API: http://localhost:${WORKER_PORT}/ — sign in to the selected local owner account.`);
    console.log(`Narrative: ${options.provider} (${hostEnv[`${prefix}_MODEL`]}, ${hostEnv[`${prefix}_EFFORT`]}). Visual candidate: ${VISUAL_MODEL}.`);
    console.log(`Private state and logs: ${paths.directory}. Ctrl+C stops only this runner's processes.`);
    await stopped;
  } finally {
    await stop();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
