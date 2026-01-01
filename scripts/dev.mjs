#!/usr/bin/env node
/*
  Cross-platform dev runner.

  Why:
  - `./dev.sh` works on bash/macOS/Linux, but fails in Windows PowerShell.
  - This script starts the same stack: Vite (frontend) + build (dist) + Wrangler dev (worker).

  Usage:
  - npm run dev
  - node scripts/dev.mjs --smoke   (validate setup only)
*/

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

function projectRoot() {
  // scripts/dev.mjs -> repo root
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseDevVars(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    env[key] = value;
  }
  return env;
}

function loadDevVarsIntoProcessEnv(rootDir) {
  const envFile = path.join(rootDir, '.dev.vars');
  if (!fs.existsSync(envFile)) {
    console.log('⚠️  .dev.vars not found. API-powered features may fall back to local generators.');
    return;
  }

  console.log('🔐 Loading environment variables from .dev.vars');
  const parsed = parseDevVars(fs.readFileSync(envFile, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForAny(urls, { label, timeoutMs = 30_000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const url of urls) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await httpOk(url);
      if (ok) return url;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label ?? 'service'} (${urls.join(', ')})`);
}

function spawnNpm(args, { rootDir } = {}) {
  // On Windows, `npm` is a .cmd shim. Node's `spawn()` cannot execute .cmd
  // directly (CreateProcess limitation), so run it via cmd.exe.
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });
  }

  return spawn('npm', args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
}

function parsePortFromAddress(address) {
  const match = String(address).match(/:(\d+)$/);
  return match ? match[1] : null;
}

function findWindowsPidsOnPorts(ports) {
  const portSet = new Set(ports.map((port) => String(port)));
  const result = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return [];

  const pids = new Set();
  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('TCP')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) continue;
    const port = parsePortFromAddress(parts[1]);
    if (!port || !portSet.has(port)) continue;
    if (parts[4]) pids.add(parts[4]);
  }

  return Array.from(pids);
}

function findUnixPidsOnPorts(ports) {
  const portList = ports.join(',');
  const result = spawnSync('lsof', [`-ti:${portList}`], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return [];

  return Array.from(
    new Set(
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
}

async function cleanupPorts(ports) {
  if (!ports.length) return;
  console.log(`?? Cleaning up any existing processes on ports: ${ports.join(', ')}`);
  const pids = process.platform === 'win32'
    ? findWindowsPidsOnPorts(ports)
    : findUnixPidsOnPorts(ports);

  if (!pids.length) return;

  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
      }
    } catch {
      // best-effort
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
}

function taskkillTree(pid) {
  return new Promise((resolve) => {
    const child = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

async function killProcessTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      await taskkillTree(child.pid);
      return;
    }
    child.kill('SIGTERM');
  } catch {
    // best-effort
  }
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function printHelp() {
  console.log('Tableau dev runner');
  console.log('');
  console.log('Usage:');
  console.log('  npm run dev');
  console.log('  node scripts/dev.mjs --smoke');
  console.log('');
  console.log('Options:');
  console.log('  --skip-migrations   Skip applying local D1 migrations');
}

async function main() {
  const rootDir = projectRoot();
  const pkg = readJson(path.join(rootDir, 'package.json'));

  if (hasFlag('--help') || hasFlag('-h')) {
    printHelp();
    return;
  }

  const requiredScripts = ['dev:frontend', 'dev:workers', 'build'];
  const missing = requiredScripts.filter((s) => !pkg.scripts?.[s]);
  if (missing.length) {
    throw new Error(
      `Missing npm scripts: ${missing.join(', ')}. Expected in package.json scripts.`
    );
  }

  loadDevVarsIntoProcessEnv(rootDir);

  if (hasFlag('--smoke')) {
    console.log('✅ Smoke check passed.');
    console.log('Would run:');
    console.log('  - npm run dev:frontend');
    console.log('  - npm run build');
    console.log('  - npm run dev:workers');
    return;
  }

  // Keep local D1 in a usable state for auth/journal endpoints.
  // This is a no-op after the first run once migrations are tracked.
  if (!hasFlag('--skip-migrations') && pkg.scripts?.['migrations:apply:local']) {
    console.log('🗄️  Applying local D1 migrations...');
    const migChild = spawnNpm(['run', 'migrations:apply:local'], { rootDir });
    const migExitCode = await new Promise((resolve) => {
      migChild.on('exit', (code) => resolve(code ?? 1));
    });
    if (migExitCode !== 0) {
      console.warn(`⚠️  Local migrations failed (exit code: ${migExitCode}). Auth/journal endpoints may not work until migrations are applied.`);
    }
    console.log('');
  }

  console.log('🔮 Starting Tableau development environment (Workers mode)...');
  console.log('');

  await cleanupPorts([5173, 5174, 8787]);

  let viteChild;
  let wranglerChild;
  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n🛑 Shutting down development servers...');
    await killProcessTree(wranglerChild);
    await killProcessTree(viteChild);
  };

  process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
  });

  try {
    // 1) Start Vite
    console.log('📦 Starting Vite frontend server...');
    viteChild = spawnNpm(['run', 'dev:frontend'], { rootDir });
    viteChild.on('error', async (err) => {
      if (shuttingDown) return;
      console.error(`Vite failed to start: ${err?.message ?? String(err)}`);
      await shutdown();
      process.exit(1);
    });
    viteChild.on('exit', async (code) => {
      if (shuttingDown) return;
      console.error(`Vite exited unexpectedly (code: ${code ?? 'unknown'}).`);
      await shutdown();
      process.exit(code ?? 1);
    });

    console.log('⏳ Waiting for Vite to start...');
    const viteUrl = await waitForAny(['http://localhost:5173', 'http://localhost:5174'], {
      label: 'Vite',
      timeoutMs: 30_000,
    });
    console.log(`✅ Vite is ready! (${viteUrl})`);

    // 2) Build dist for worker static assets
    console.log('🏗️  Building frontend assets for Workers...');
    const buildChild = spawnNpm(['run', 'build'], { rootDir });
    const buildExitCode = await new Promise((resolve) => {
      buildChild.on('exit', (code) => resolve(code ?? 1));
    });
    if (buildExitCode !== 0) {
      console.error(`❌ Build failed (exit code: ${buildExitCode}).`);
      await shutdown();
      process.exit(buildExitCode);
    }

    // 3) Start Wrangler worker dev
    console.log('⚡ Starting Wrangler Workers dev server...');
    wranglerChild = spawnNpm(['run', 'dev:workers'], { rootDir });
    wranglerChild.on('error', async (err) => {
      if (shuttingDown) return;
      console.error(`Wrangler failed to start: ${err?.message ?? String(err)}`);
      await shutdown();
      process.exit(1);
    });
    wranglerChild.on('exit', async (code) => {
      if (shuttingDown) return;
      console.error(`Wrangler exited unexpectedly (code: ${code ?? 'unknown'}).`);
      await shutdown();
      process.exit(code ?? 1);
    });

    // Wrangler may prompt for OAuth on first run (especially when using remote bindings like AI).
    // Don't hard-fail if it isn't reachable immediately.
    console.log('⏳ Waiting for Workers...');
    try {
      await waitForAny(['http://localhost:8787'], { label: 'Workers', timeoutMs: 120_000 });
      console.log('✅ Workers dev server is ready!');
    } catch (err) {
      console.warn(`⚠️  Workers not responding yet: ${err?.message ?? String(err)}`);
      console.warn('   If Wrangler is asking you to log in, complete the OAuth flow and the server will come up shortly.');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Development environment running! (Workers mode)');
    console.log('');
    console.log(`🌐 Access your app at: ${viteUrl}`);
    console.log('');
    console.log('📝 Notes:');
    console.log(`  - Frontend HMR (Vite): ${viteUrl} (USE THIS!)`);
    console.log('  - Full app with API: http://localhost:8787 (API backend)');
    console.log('  - Workers serve static assets from dist/');
    console.log('  - API routes handled by src/worker/index.js');
    console.log('  - Press Ctrl+C to stop all servers');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Keep running until child processes exit or Ctrl+C
    await new Promise(() => {});
  } catch (err) {
    await shutdown();
    throw err;
  }
}

main().catch((err) => {
  console.error(`\n❌ Dev runner failed: ${err?.message ?? String(err)}`);
  process.exit(1);
});
