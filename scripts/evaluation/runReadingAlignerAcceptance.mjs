#!/usr/bin/env node
// Ordinary production acceptance. No beta, development server, Worker or provider is started.
import { fork, spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFile, chmod, lstat, mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureValidationSource } from '../dev-reading-cue-validation.mjs';
import { freezeOutput, hashOutputFiles, verifyOutputIntegrity } from '../lib/readingCueOutputIntegrity.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const protectedPorts = new Set([8787, 5175, 8789, 9235]);
export const ACCEPTANCE_PROJECTS = ['chromium', 'webkit'].flatMap(browser => ['desktop', 'phone'].flatMap(form => ['normal', 'reduced'].map(motion => `${browser}-${form}-${motion}`)));
const flags = { VITE_READING_ALIGNER_ENABLED: 'true', VITE_READING_MODEL_ANNOTATIONS: 'false' };
const within = (parent, child) => child === parent || child.startsWith(parent + path.sep);

export function validateAcceptanceManifest(m) {
  if (m?.version !== 1 || !path.isAbsolute(m.sourceRoot || '') || !/^[a-f0-9]{40}$/.test(m.sourceHead || '')) throw new Error('An exact source root and HEAD are required.');
  if (m.mode !== 'production' || m.dev !== false || m.prod !== true || m.apiMode !== 'offline-fail-closed') throw new Error('Only ordinary production with DEV false and offline API is admitted.');
  if (Object.keys(m.flags || {}).sort().join(',') !== Object.keys(flags).sort().join(',') || Object.entries(flags).some(([key, value]) => m.flags[key] !== value)) throw new Error('Exact aligner-only production flag contract required.');
  if (m.apiProxyOrigin || m.proxy || m.env || m.provider || m.live) throw new Error('Proxy/external API origins and inherited environments are forbidden.');
  if (Object.keys(m.origins || {}).sort().join(',') !== 'api,frontend') throw new Error('Explicit owned origins required.');
  const ports = Object.values(m.origins).map(value => {
    let url; try { url = new URL(value); } catch { throw new Error('Invalid loopback origin.'); }
    const port = Number(url.port);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || port < 1 || port > 65535 || protectedPorts.has(port)
      || value !== url.origin || url.username || url.password) throw new Error('Protected/nonloopback origin rejected.');
    return port;
  });
  if (new Set(ports).size !== ports.length) throw new Error('Owned origins must use distinct ports.');
  if (!Array.isArray(m.projects) || m.projects.length !== 8 || ACCEPTANCE_PROJECTS.some((name, index) => m.projects[index] !== name)) throw new Error('Eight exact browser profiles required.');
  if (!Array.isArray(m.sourceFiles) || !m.sourceFiles.length || new Set(m.sourceFiles.map(file => file.path)).size !== m.sourceFiles.length
    || m.sourceFiles.some(file => typeof file.path !== 'string' || path.isAbsolute(file.path) || file.path.includes('\\') || file.path.split('/').includes('..')
      || /(?:^|\/)(?:\.[^/]+|node_modules|credentials|sessions)(?:\/|$)/.test(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256 || '') || !Number.isSafeInteger(file.bytes))) throw new Error('Explicit pinned regular source files required.');
  if (!/^[a-f0-9]{64}$/.test(m.snapshotDigest || '') || sha(JSON.stringify(m.sourceFiles)) !== m.snapshotDigest) throw new Error('Pinned source digest mismatch.');
  if (m.prebuiltDirectory && !/^[a-f0-9]{64}$/.test(m.expectedOutputDigest || '')) throw new Error('Output reuse requires its expected digest.');
  if (m.prebuiltDirectory) throw new Error('Output reuse is unsupported; use a fresh candidate build with an optional expected digest.');
  if (m.expectedOutputDigest != null && !/^[a-f0-9]{64}$/.test(m.expectedOutputDigest)) throw new Error('Invalid expected output digest.');
  if (m.decisions?.D1 !== 'retain-complete-quote-exposed-line' || !m.decisions?.D7) throw new Error('Recorded D1/D7 dispositions required.');
  return m;
}

export function acceptanceEnvironment(directory, source = process.env) {
  return { PATH: source.PATH || '/usr/bin:/bin', NODE_ENV: 'production', CI: 'true', NO_COLOR: '1', LANG: 'C.UTF-8',
    HOME: path.join(directory, 'home'), TMPDIR: path.join(directory, 'tmp'), XDG_CONFIG_HOME: path.join(directory, 'home/config'),
    XDG_CACHE_HOME: path.join(directory, 'home/cache'), XDG_DATA_HOME: path.join(directory, 'home/data'), ...flags };
}
async function noLinks(filename) {
  let location = path.parse(filename).root;
  for (const segment of filename.split(path.sep).filter(Boolean)) {
    location = path.join(location, segment);
    const stat = await lstat(location).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (stat?.isSymbolicLink()) throw new Error('Symlinked source/evidence path rejected.');
  }
}
const listen = (server, port) => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
const closeServer = server => new Promise(resolve => { server.closeAllConnections?.(); if (server.listening) server.close(resolve); else resolve(); });
async function assertPortAvailable(port) { const socket = net.createServer(); try { await listen(socket, port); } finally { await closeServer(socket); } }
export async function preflightAcceptance({ manifest, evidenceRoot, adapters = {}, runtimeEnvironment } = {}) {
  validateAcceptanceManifest(manifest);
  if (runtimeEnvironment && Object.keys(runtimeEnvironment).some(key => /KEY|TOKEN|SECRET|PROVIDER|ORIGIN|PROXY/i.test(key))) throw new Error('Inherited credential/environment rejected.');
  if (!path.isAbsolute(evidenceRoot || '') || within(path.resolve(manifest.sourceRoot), path.resolve(evidenceRoot)) || within('/home/ubuntu/tarot', path.resolve(evidenceRoot))) throw new Error('New private evidence root must be outside source.');
  await noLinks(path.resolve(evidenceRoot));
  const existing = await lstat(evidenceRoot).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing) throw new Error('Evidence root must be new; prior evidence is never reused.');
  const getHead = adapters.getHead || (async () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: manifest.sourceRoot, encoding: 'utf8', env: { PATH: process.env.PATH } }).trim());
  if (await getHead() !== manifest.sourceHead) throw new Error('Pinned source HEAD is stale.');
  await noLinks(manifest.sourceRoot);
  for (const file of manifest.sourceFiles) {
    const location = path.join(manifest.sourceRoot, file.path); await noLinks(location);
    const stat = await lstat(location); const bytes = await readFile(location);
    if (!stat.isFile() || bytes.length !== file.bytes || sha(bytes) !== file.sha256) throw new Error(`Pinned source changed: ${file.path}`);
  }
  for (const origin of Object.values(manifest.origins)) await (adapters.assertPortAvailable || assertPortAvailable)(Number(new URL(origin).port));
  return manifest;
}

async function runRuntime(configPath) {
  const config = JSON.parse(await readFile(configPath, 'utf8')); const { manifest, evidenceRoot, source, buildDirectory } = config;
  const { build } = await import('vite'); const { default: base } = await import(path.join(source, 'vite.config.js'));
  let resolvedFlags;
  await build({ ...base, root: source, configFile: false, envFile: false, envDir: path.join(evidenceRoot, 'config'), mode: 'production',
    cacheDir: path.join(evidenceRoot, 'vite-cache'), logLevel: 'warn', define: Object.fromEntries(Object.entries(flags).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    plugins: [...base.plugins, { name: 'aligner-production-contract', configResolved(value) {
      resolvedFlags = { mode: value.env.MODE, dev: value.env.DEV, prod: value.env.PROD, flags };
      if (value.env.MODE !== 'production' || value.env.DEV !== false || value.env.PROD !== true) throw new Error('Build is not ordinary production.');
    } }], build: { ...base.build, outDir: buildDirectory, emptyOutDir: true, sourcemap: false } });
  const outputFiles = await hashOutputFiles(buildDirectory); const outputDigest = sha(JSON.stringify(outputFiles));
  if (manifest.expectedOutputDigest && manifest.expectedOutputDigest !== outputDigest) throw new Error('Fresh output differs from pinned expected output digest.');
  await freezeOutput(buildDirectory);
  if (!await verifyOutputIntegrity(buildDirectory, outputFiles)) throw new Error('Stale output before serving.');
  const clients = new Set(); let eventId = 0; let generation = 0; const controls = []; let closed = false;
  const send = (response, event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify({ ...data, eventId: ++eventId })}\n\n`);
  const api = http.createServer(async (request, response) => {
    if (request.headers.host !== new URL(manifest.origins.api).host) return response.writeHead(403).end();
    const url = new URL(request.url, manifest.origins.api);
    response.setHeader('Access-Control-Allow-Origin', manifest.origins.frontend); response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'X-Job-Token, Accept, Content-Type, sentry-trace, baggage');
    if (request.method === 'OPTIONS') return response.writeHead(204).end();
    if (url.pathname === '/reading' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }); clients.add(response); generation++;
      const heartbeat = setInterval(() => { if (!response.writableEnded && !response.destroyed) response.write(`: ${' '.repeat(8192)}\n\n`); }, 250); heartbeat.unref();
      response.on('close', () => { clearInterval(heartbeat); clients.delete(response); }); send(response, 'meta', { provider: 'controlled-offline', requestId: config.runId }); return;
    }
    if (url.pathname === '/__aligner_control' && request.headers['x-aligner-owner'] === config.controlToken) {
      if (request.method === 'GET') return response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ clients: clients.size, generation, controls }));
      let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 262144) return response.writeHead(413).end(); }
      const data = JSON.parse(body || '{}');
      if (data.operation === 'reset') { for (const client of clients) client.end(); controls.length = 0; }
      else if (data.operation === 'disconnect') { for (const client of clients) client.end(); }
      else if (data.operation === 'burst') { for (const item of data.events) { controls.push(item); for (const client of clients) send(client, item.event, item.data); } }
      else if (data.operation === 'emit') { controls.push({ event: data.event, data: data.data }); for (const client of clients) { send(client, data.event, data.data); if (['done', 'error'].includes(data.event)) client.end(); } }
      else return response.writeHead(400).end();
      return response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    }
    response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"error":"offline_api_unconfigured"}');
  });
  const files = new Map(outputFiles.map(file => [file.path, file])); let compromised = false;
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
  const frontend = http.createServer(async (request, response) => {
    try {
      if (request.headers.host !== new URL(manifest.origins.frontend).host) return response.writeHead(403).end();
      const pathname = decodeURIComponent(request.url.split('?')[0]);
      if (pathname === '/__aligner_identity') {
        const integrity = !compromised && await verifyOutputIntegrity(buildDirectory, outputFiles);
        return response.writeHead(integrity ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ runId: config.runId, snapshotDigest: manifest.snapshotDigest, outputDigest, outputIntegrity: integrity, ...resolvedFlags, apiMode: manifest.apiMode }));
      }
      if (/^\/(?:api|__e2e|@fs)(?:\/|$)/.test(pathname)) return response.writeHead(503).end('Offline route unavailable');
      if (!['GET', 'HEAD'].includes(request.method) || pathname.includes('\\') || pathname.split('/').some(part => part === '..' || part.startsWith('.'))) return response.writeHead(403).end();
      let filename = pathname.slice(1) || 'index.html';
      if (!files.has(filename) && /^\/(?:reading|journal|account|pricing|learn|settings|login|register)(?:\/[^.]*)?$/.test(pathname)) filename = 'index.html';
      if (!files.has(filename)) return response.writeHead(404).end();
      const location = path.join(buildDirectory, filename); const stat = await lstat(location); const bytes = await readFile(location); const expected = files.get(filename);
      if (compromised || stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o777) !== 0o444 || bytes.length !== expected.bytes || sha(bytes) !== expected.sha256) { compromised = true; return response.writeHead(503).end('Output integrity mismatch'); }
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(403).end(); }
  });
  try { await listen(api, Number(new URL(manifest.origins.api).port)); await listen(frontend, Number(new URL(manifest.origins.frontend).port)); }
  catch (error) { await Promise.all([closeServer(api), closeServer(frontend)]); throw error; }
  const close = async () => { if (closed) return; closed = true; for (const client of clients) client.end(); await Promise.all([closeServer(api), closeServer(frontend)]); process.exit(0); };
  process.once('SIGTERM', close); process.once('SIGINT', close); process.once('disconnect', close); process.on('message', message => { if (message?.kind === 'close') void close(); });
  process.send?.({ kind: 'ready', outputFiles, outputDigest, resolvedFlags, pid: process.pid });
}

function childResult(child, ready = false) {
  return new Promise((resolve, reject) => {
    if (ready) { const timer = setTimeout(() => reject(new Error('Owned production build startup timed out')), 180000); child.once('message', value => { clearTimeout(timer); value?.kind === 'ready' ? resolve(value) : reject(new Error('Owned production runtime failed')); }); child.once('exit', code => { clearTimeout(timer); reject(new Error(`Owned production runtime exited ${code}`)); }); }
    else child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', reject);
  });
}
export async function runReadingAlignerAcceptance({ manifest, evidenceRoot } = {}) {
  await preflightAcceptance({ manifest, evidenceRoot }); await mkdir(evidenceRoot, { mode: 0o700 });
  const runId = randomUUID(); const controlToken = randomUUID(); const source = path.join(evidenceRoot, 'source'); const buildDirectory = path.join(evidenceRoot, 'build');
  const write = (filename, value) => writeFile(path.join(evidenceRoot, filename), JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' });
  await write('input-manifest.json', manifest); await write('.owner.json', { runId });
  for (const name of ['config', 'home/config', 'home/cache', 'home/data', 'tmp', 'logs', 'vite-cache']) await mkdir(path.join(evidenceRoot, name), { recursive: true, mode: 0o700 });
  let runtime; let browser; let interrupted = false; let logging = Promise.resolve();
  const result = { runId, snapshotDigest: manifest.snapshotDigest, complete: false, cleanup: null };
  const onSignal = signal => { interrupted = true; result.interrupted = signal; if (browser?.exitCode === null && browser.signalCode === null) browser.kill('SIGTERM'); if (runtime?.connected) runtime.send({ kind: 'close' }); };
  const onInterrupt = () => onSignal('SIGINT'); const onTerminate = () => onSignal('SIGTERM');
  process.once('SIGINT', onInterrupt); process.once('SIGTERM', onTerminate);
  try {
    const snapshot = await captureValidationSource({ root: manifest.sourceRoot, destination: source, paths: manifest.sourceFiles.map(file => file.path) });
    if (interrupted) throw new Error('Production acceptance interrupted during source capture');
    if (snapshot.digest !== manifest.snapshotDigest) throw new Error('Pinned source changed during snapshot capture.');
    await chmod(source, 0o700); await symlink(await realpath(path.join(manifest.sourceRoot, 'node_modules')), path.join(source, 'node_modules'), 'dir'); await chmod(source, 0o555);
    const config = { manifest, evidenceRoot, source, buildDirectory, runId, controlToken }; await write('config/runtime.json', config);
    runtime = fork(path.join(source, 'scripts/evaluation/runReadingAlignerAcceptance.mjs'), ['--runtime', path.join(evidenceRoot, 'config/runtime.json')], { cwd: source, env: acceptanceEnvironment(evidenceRoot), execArgv: [], silent: true });
    const append = chunk => { logging = logging.then(() => appendFile(path.join(evidenceRoot, 'logs/runtime.log'), chunk, { mode: 0o600 })); }; runtime.stdout.on('data', append); runtime.stderr.on('data', append);
    runtime.once('exit', (code, signal) => { if (browser && browser.exitCode === null && browser.signalCode === null) { result.runtimeFailure = `runtime-exit:${code ?? signal}`; browser.kill('SIGTERM'); } });
    const ready = await childResult(runtime, true);
    if (interrupted) throw new Error('Production acceptance interrupted before browser startup');
    const runtimeManifest = { ...manifest, sourceRoot: source, runId, ownerPid: process.pid, runtimePid: runtime.pid, outputFiles: ready.outputFiles, outputDigest: ready.outputDigest, resolvedFlags: ready.resolvedFlags, controlToken, evidenceRoot };
    await write('runtime-manifest.json', runtimeManifest); result.outputDigest = ready.outputDigest;
    browser = spawn(process.execPath, [path.join(source, 'node_modules/@playwright/test/cli.js'), 'test', '--config', path.join(source, 'output/reading-motion/aligner-release.playwright.config.mjs')], { cwd: source,
      env: { ...acceptanceEnvironment(evidenceRoot), ALIGNER_ACCEPTANCE_MANIFEST: path.join(evidenceRoot, 'runtime-manifest.json'), PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/home/ubuntu/.cache/ms-playwright' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let browserLog = ''; const logBrowser = chunk => { browserLog += chunk.toString(); process.stdout.write(chunk); }; browser.stdout.on('data', logBrowser); browser.stderr.on('data', logBrowser);
    result.browser = await childResult(browser); await writeFile(path.join(evidenceRoot, 'logs/browser.log'), browserLog, { mode: 0o600 });
    result.outputIntegrity = await verifyOutputIntegrity(buildDirectory, ready.outputFiles); result.complete = result.browser.code === 0 && result.outputIntegrity && !interrupted && !result.runtimeFailure;
  } catch (error) { result.error = error.message; throw error; }
  finally {
    if (browser && browser.exitCode === null && browser.signalCode === null) browser.kill('SIGTERM');
    if (runtime && runtime.exitCode === null && runtime.signalCode === null) { const exited = childResult(runtime); runtime.send({ kind: 'close' }); let timer; await Promise.race([exited, new Promise(resolve => { timer = setTimeout(() => { runtime.kill('SIGKILL'); resolve(); }, 5000); })]); clearTimeout(timer); }
    process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onTerminate); await logging;
    result.cleanup = { runtimeExited: !runtime || runtime.exitCode !== null || runtime.signalCode !== null, browserExited: !browser || browser.exitCode !== null || browser.signalCode !== null, retainedPrivateEvidence: true };
    await write('result.json', result);
  }
  return result;
}
export async function main(args = process.argv.slice(2)) {
  const options = Object.fromEntries(args.map(arg => { const match = arg.match(/^--(manifest|evidence-root)=(.+)$/); if (!match) throw new Error('Use --manifest=/absolute/file --evidence-root=/absolute/new/private-root'); return [match[1], match[2]]; }));
  if (!path.isAbsolute(options.manifest || '') || !path.isAbsolute(options['evidence-root'] || '')) throw new Error('Absolute manifest and evidence-root required.');
  const manifest = JSON.parse(await readFile(options.manifest, 'utf8')); const result = await runReadingAlignerAcceptance({ manifest, evidenceRoot: options['evidence-root'] }); if (!result.complete) process.exitCode = 1; return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--runtime') await runRuntime(process.argv[3]).catch(error => { console.error(error.message); process.exit(1); });
  else await main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
