import { fork, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOutputIntegrity } from './lib/readingCueOutputIntegrity.mjs';

const sourceManifestBytes = readFileSync(new URL('./lib/readingCueValidationSource.json', import.meta.url));
const sourceManifest = JSON.parse(sourceManifestBytes);
const sourcePaths = Object.freeze(sourceManifest.paths);
const loadedEntrypointSha256 = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');

const root = fileURLToPath(new URL('..', import.meta.url));
const protectedPorts = new Set([8787, 5175, 8789, 9235]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const privateName = /(?:^|\/)(?:\.[^/]+|[^/]*\.(?:pem|crt|key)|(?:auth|credentials|sessions|logs|state))(?:\/|$)/i;
const within = (parent, child) => child === path.resolve(parent) || child.startsWith(path.resolve(parent) + path.sep);

export function validationEnvironment(directory, source = process.env) {
  return { PATH: source.PATH || '/usr/bin:/bin', NODE_ENV: 'development', CI: 'true', NO_COLOR: '1',
    LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', HOME: path.join(directory, 'home'),
    XDG_CONFIG_HOME: path.join(directory, 'home/config'), XDG_CACHE_HOME: path.join(directory, 'home/cache'),
    XDG_DATA_HOME: path.join(directory, 'home/data'), XDG_STATE_HOME: path.join(directory, 'home/state'),
    TMPDIR: path.join(directory, 'tmp'), TMP: path.join(directory, 'tmp'), TEMP: path.join(directory, 'tmp'),
    WRANGLER_LOG_PATH: path.join(directory, 'logs/wrangler.log'), WRANGLER_SEND_METRICS: 'false',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', VITE_READING_GESTURES: 'true' };
}

function validateOptions({ host, ports, privateDirectory, sourceHead, live, explicitProviders, budget }) {
  if (live || explicitProviders !== null || budget !== null) throw new Error('Only local offline validation is authorized; live dispatch is closed.');
  if (host !== '127.0.0.1') throw new Error('Offline validation requires the loopback host.');
  if (!ports || Object.keys(ports).sort().join(',') !== 'api,frontend,inspector,optimized'
    || Object.values(ports).some(value => !Number.isInteger(value) || value < 1 || value > 65535 || protectedPorts.has(value))
    || new Set(Object.values(ports)).size !== 4) throw new Error('Four distinct explicit nonprotected ports are required.');
  if (!privateDirectory || !path.isAbsolute(privateDirectory)) throw new Error('An absolute new privateDirectory is required.');
  if (!/^[a-f0-9]{40}$/.test(sourceHead || '')) throw new Error('An exact sourceHead is required.');
}

async function assertNoLinks(location) {
  const absolute = path.resolve(location);
  const segments = absolute.split(path.sep).filter(Boolean);
  let current = path.parse(absolute).root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const metadata = await lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (metadata?.isSymbolicLink()) throw new Error('Symlinked source/private path rejected.');
  }
}

/** Explicit enumerated paths only: no glob, recursive source copy, dotenv or symlink following. */
export async function captureValidationSource({ root: sourceRoot, destination, paths = sourcePaths, signal = null }) {
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length) throw new Error('Invalid immutable source allowlist.');
  await assertNoLinks(sourceRoot);
  for (const filename of paths) {
    signal?.throwIfAborted();
    if (typeof filename !== 'string' || path.isAbsolute(filename) || filename.split('/').includes('..')
      || privateName.test(filename) || filename.includes('\\')) throw new Error('Private/escaping source path rejected.');
    await assertNoLinks(path.join(sourceRoot, filename));
    if (!(await lstat(path.join(sourceRoot, filename))).isFile()) throw new Error('Allowlisted source must be a regular file.');
  }
  await mkdir(destination, { mode: 0o700 });
  const files = [];
  for (const filename of paths) {
    signal?.throwIfAborted();
    const bytes = await readFile(path.join(sourceRoot, filename));
    const output = path.join(destination, filename);
    await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, bytes, { mode: 0o444, flag: 'wx' });
    files.push({ path: filename, sha256: hash(bytes), bytes: bytes.length,
      gitBlobSha1: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') });
  }
  // Detect original changes during capture, including changes to earlier files.
  for (const file of files) {
    signal?.throwIfAborted();
    await assertNoLinks(path.join(sourceRoot, file.path));
    if (hash(await readFile(path.join(sourceRoot, file.path))) !== file.sha256) throw new Error('Source changed while capturing immutable snapshot.');
  }
  await freezeDirectories(destination);
  return { files, digest: hash(JSON.stringify(files)) };
}

async function freezeDirectories(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await freezeDirectories(path.join(directory, entry.name));
  }
  await chmod(directory, 0o555);
}

export async function removeValidationDirectory(directory) {
  const metadata = await lstat(directory).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (!metadata) return;
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('Cleanup refuses an unowned symlink/file root.');
  await chmod(directory, 0o700);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await removeValidationDirectory(path.join(directory, entry.name));
  }
  await rm(directory, { recursive: true, force: true });
}

const listen = (server, port, host) => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
});
const closeServer = server => new Promise(resolve => {
  if (!server.listening) return resolve();
  server.closeAllConnections?.(); server.close(resolve);
});

async function preflight(ports, host) {
  const handles = [];
  try {
    for (const port of Object.values(ports)) {
      const handle = net.createServer(); handles.push(handle);
      await listen(handle, port, host);
    }
  } finally { await Promise.all(handles.map(closeServer)); }
}

async function terminateChild(child) {
  if (!child) return true;
  let exited = child.exitCode !== null || child.signalCode !== null;
  const exit = exited ? Promise.resolve(true) : new Promise(resolve => child.once('exit', () => { exited = true; resolve(true); }));
  const signal = value => {
    try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, value); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  const groupExists = () => {
    if (process.platform === 'win32') return !exited;
    try { process.kill(-child.pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
  };
  const boundedExit = async delay => {
    let timer;
    const result = await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => resolve(false), delay); })]);
    clearTimeout(timer); return result;
  };
  if (!exited && child.connected) child.send({ kind: 'close' }, () => {});
  if (!exited && !await boundedExit(5000)) {
    signal('SIGTERM');
    if (!await boundedExit(2000)) { signal('SIGKILL'); await boundedExit(2000); }
  }
  // A premature direct-child exit must not strand its workerd/esbuild descendants.
  if (groupExists()) {
    signal('SIGTERM');
    const deadline = Date.now() + 2000;
    while (groupExists() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    if (groupExists()) {
      signal('SIGKILL');
      const killedDeadline = Date.now() + 2000;
      while (groupExists() && Date.now() < killedDeadline) await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  if (!exited || groupExists()) throw new Error('Owned process group failed bounded shutdown; private state retained.');
  return true;
}

export async function startReadingCueValidation({ host = '127.0.0.1', ports, privateDirectory, sourceHead,
  live = false, explicitProviders = null, budget = null } = {}) {
  validateOptions({ host, ports, privateDirectory, sourceHead, live, explicitProviders, budget });
  const actualHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
  if (actualHead.status !== 0 || actualHead.stdout.trim() !== sourceHead) throw new Error('Expected source HEAD is stale.');
  const directory = path.resolve(privateDirectory); const dependencies = await realpath(path.join(root, 'node_modules'));
  if ([root, dependencies, '/home/ubuntu/tarot'].some(protectedRoot => within(protectedRoot, directory))) {
    throw new Error('Private state must be outside source, dependencies and the primary checkout.');
  }
  await assertNoLinks(directory);
  const existing = await lstat(directory).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing && (!existing.isDirectory() || (await readdir(directory)).length)) throw new Error('Private directory must be new or empty.');
  await preflight(ports, host);
  const runId = randomUUID(); let child; let snapshot; let runnerSnapshot; let owned = false; let closing; let runtimeFailure = null; let outputFiles; let outputCompromised = false;
  const controller = new AbortController(); let starting = true; let finishStartup;
  const startupFinished = new Promise(resolve => { finishStartup = resolve; });
  const close = () => {
    if (closing) return closing;
    closing = (async () => {
      controller.abort();
      if (starting) await startupFinished;
      process.removeListener('SIGINT', onSignal); process.removeListener('SIGTERM', onSignal);
      const childExited = await terminateChild(child);
      let sourceIntegrity = true;
      for (const [folder, captured] of [['source', snapshot], ['runner', runnerSnapshot]]) if (captured) for (const file of captured.files) {
        try { if (hash(await readFile(path.join(directory, folder, file.path))) !== file.sha256) sourceIntegrity = false; } catch { sourceIntegrity = false; }
      }
      const outputIntegrity = !outputCompromised && (!outputFiles || await verifyOutputIntegrity(path.join(directory, 'build'), outputFiles));
      if (!outputIntegrity) runtimeFailure = 'output-integrity-mismatch';
      if (owned) {
        const marker = JSON.parse(await readFile(path.join(directory, '.owner.json'), 'utf8'));
        if (marker.runId !== runId) throw new Error('Cleanup ownership marker changed; state retained.');
        await removeValidationDirectory(directory);
      }
      return { runId, childExited, sourceIntegrity, outputIntegrity, stateRemoved: owned, runtimeFailure };
    })();
    return closing;
  };
  const onSignal = () => { void close().catch(() => { process.exitCode = 1; }); };
  try {
    if (!existing) await mkdir(directory, { mode: 0o700 });
    await chmod(directory, 0o700);
    await writeFile(path.join(directory, '.owner.json'), JSON.stringify({ runId }), { mode: 0o600, flag: 'wx' });
    owned = true;
    process.once('SIGINT', onSignal); process.once('SIGTERM', onSignal);
    for (const name of ['config', 'state', 'home/config', 'home/cache', 'home/data', 'home/state', 'tmp', 'logs', 'vite-cache', 'build']) {
      await mkdir(path.join(directory, name), { recursive: true, mode: 0o700 });
    }
    await writeFile(path.join(directory, 'config', '.env'), '', { mode: 0o600, flag: 'wx' });
    snapshot = await captureValidationSource({ root, destination: path.join(directory, 'source'), signal: controller.signal });
    controller.signal.throwIfAborted();
    await chmod(path.join(directory, 'source'), 0o700);
    await symlink(dependencies, path.join(directory, 'source', 'node_modules'), 'dir');
    await chmod(path.join(directory, 'source'), 0o555);
    runnerSnapshot = await captureValidationSource({ root, destination: path.join(directory, 'runner'),
      paths: ['scripts/lib/readingCueValidationChild.mjs', 'scripts/lib/developmentServerSecurity.mjs', 'scripts/lib/readingCueOutputIntegrity.mjs'], signal: controller.signal });
    await chmod(path.join(directory, 'runner'), 0o700);
    await symlink(dependencies, path.join(directory, 'runner/node_modules'), 'dir');
    await chmod(path.join(directory, 'runner'), 0o555);
    const capturedHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
    if (capturedHead.status !== 0 || capturedHead.stdout.trim() !== sourceHead) throw new Error('Source HEAD changed during capture.');
    const tree = spawnSync('git', ['ls-tree', '--full-tree', '-rz', 'HEAD'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH } });
    if (tree.status !== 0) throw new Error('Unable to identify HEAD source bytes.');
    const headBlobs = new Map(tree.stdout.split('\0').filter(Boolean).map(line => { const [meta, filename] = line.split('\t'); return [filename, meta.split(' ')[2]]; }));
    const buildIdentity = { runId, expectedHead: sourceHead, actualHead: actualHead.stdout.trim(),
      dirtyPaths: snapshot.files.filter(file => headBlobs.get(file.path) !== file.gitBlobSha1).map(file => file.path), snapshotDigest: snapshot.digest, sourceFiles: snapshot.files,
      lockfileSha256: snapshot.files.find(file => file.path === 'package-lock.json').sha256,
      runtimeSourceHashes: { entrypointSha256: loadedEntrypointSha256, runnerFiles: runnerSnapshot.files },
      sourceAllowlistVersion: sourceManifest.version, sourceAllowlistSha256: hash(sourceManifestBytes), sourceScope: sourceManifest.scope,
      mode: 'reading-cue-validation', dev: false, minify: 'esbuild', apiMode: 'offline-fail-closed',
      dataIdentity: 'unconfigured-offline-api', origins: Object.fromEntries(['frontend', 'api', 'optimized'].map(key => [key, `http://${host}:${ports[key]}`])) };
    const config = { directory, dependencies, ports, host, buildIdentity };
    await writeFile(path.join(directory, 'config/runtime.json'), JSON.stringify(config), { mode: 0o600, flag: 'wx' });
    controller.signal.throwIfAborted();
    child = fork(path.join(directory, 'runner/scripts/lib/readingCueValidationChild.mjs'), [path.join(directory, 'config/runtime.json')],
      { cwd: path.join(directory, 'source'), detached: process.platform !== 'win32', execArgv: [],
        env: validationEnvironment(directory), silent: true });
    // Bounded private log tail. Never embed private child output in public exceptions.
    let log = '';
    const append = chunk => { log = (log + chunk.toString()).slice(-65536); };
    child.stdout.on('data', append); child.stderr.on('data', append);
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Owned validation startup timed out.')), 120000);
      const finish = callback => value => { clearTimeout(timer); controller.signal.removeEventListener('abort', aborted); child.removeListener('message', ready); child.removeListener('exit', exit); child.removeListener('error', failed); callback(value); };
      const aborted = finish(() => reject(new Error('Owned validation startup cancelled.')));
      const ready = finish(value => { if (value?.kind === 'ready') resolve(value); else reject(new Error(`Owned validation startup failed: ${value?.error || 'inspect private logs'}`)); });
      const exit = finish(() => reject(new Error('Owned validation child exited during startup.')));
      const failed = finish(() => reject(new Error('Owned validation child could not launch.')));
      controller.signal.addEventListener('abort', aborted, { once: true });
      child.once('message', ready); child.once('exit', exit); child.once('error', failed);
    }).catch(async error => {
      await writeFile(path.join(directory, 'logs/child.log'), log, { mode: 0o600 }); throw error;
    });
    child.once('exit', (code, signal) => { if (!closing) { runtimeFailure = signal ? `child-signal-${signal}` : `child-exit-${code}`; void close().catch(() => { process.exitCode = 1; }); } });
    await writeFile(path.join(directory, 'logs/child.log'), log, { mode: 0o600 });
    Object.assign(buildIdentity, result.identity);
    outputFiles = result.identity.outputFiles;
    child.on('message', message => { if (message?.kind === 'integrity-failed') { outputCompromised = true; runtimeFailure = 'output-integrity-mismatch'; } });
    const ownedResources = { pid: child.pid, processGroup: process.platform !== 'win32' ? child.pid : null,
      listeners: result.listeners, inspector: { port: ports.inspector, reserved: true, measured: false },
      database: { provisioned: true, usedByBrowser: false, persistence: 'private-local-d1', remote: false } };
    controller.signal.throwIfAborted(); starting = false; finishStartup();
    return { origins: buildIdentity.origins, buildIdentity, ownedResources, close };
  } catch (error) { starting = false; finishStartup(); await close(); throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/dev-reading-cue-validation.mjs /absolute/owned-options.json');
  const owned = await startReadingCueValidation(JSON.parse(await readFile(process.argv[2], 'utf8')));
  // The caller retains this manifest exclusively; it contains no credential values.
  console.log(JSON.stringify({ origins: owned.origins, buildIdentity: owned.buildIdentity, ownedResources: owned.ownedResources }));
}
